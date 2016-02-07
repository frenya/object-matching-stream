(function () {
    "use strict";

    // Libraries
    var util = require('util'),
        debug = require('debug')('oms:matcher'),
        levenshtein = require('fast-levenshtein');

    function ObjectMatcher(opts) {

        // Make sure this is used as a constructor
        if (!this) return new ObjectMatcher(opts);

        this.targets = opts.targets || [];
        this.distanceFunction = opts.distanceFunction || defaultDistance;
        this.maxDistance = opts.maxDistance || Number.MAX_VALUE;

        debug('Matching ' + this.targets.length + ' items with max distance ' + this.maxDistance);

        // Local variables
        this.inputs = [];
        this.inputDistances = [];
        this.bestMatches = [];
        
        // Measuring matching matrix's size high watermark
        this.arraySizes = [];
        this.matrixSizeHWM = 0;

        // Callbacks
        this.onmatch = opts.onmatch || defaultOnMatch;
        this.onmiss = opts.onmiss || defaultOnMiss;

    }

    ObjectMatcher.prototype.push = function (obj) {

        debug('Processing ' + obj);

        var distances = this.calculateTargetDistances(obj);

        var inputIndex = this.inputs.length;
        this.inputs.push(obj);
        this.inputDistances.push(distances);

        // Update best matches (recursively)
        this.findBestMatchForIndex(inputIndex);

        var hwm = this.arraySizes.reduce(function (a, b) { return a + b; }, 0);
        this.matrixSizeHWM = Math.max(this.matrixSizeHWM, hwm);
        
    }

    ObjectMatcher.prototype.end = function () {

        // Report the high water mark
        debug('HWM: ' + this.matrixSizeHWM);

        var me = this;
        this.inputs.forEach(function (input, index) {
            me.reportInput(index);
        });
        
        this.targets.forEach(function (target) {
            me.onmiss(null, target); 
        });

    }

    module.exports = ObjectMatcher;

    // Matching

    /**
	 * Generates an array of tuples (target id, distance) 
	 * in increasing order of distance.
     *
     * Ignores all matches farther than the max distance
     * or target's current best match's distance.
     *
     * NOTE:
     * - the map() function ignores deleted items (i.e. only valid targets are measured)
     * - the filter() function removes all non-eligible distances
     * - the sort() function makes sure better match always precedes a worse one
	 */
    ObjectMatcher.prototype.calculateTargetDistances = function(obj) {

        var me = this;
        var distances = this.targets.map(function(target, i) {
            var dist = me.distanceFunction(obj, target);
            return (target !== null) ? { index: i, distance: dist } : null;
        }).filter(function(match) {
            // Don't store invalid or too distant matches
            if (!match || match.distance > me.maxDistance) return false;

            var targetBestMatch = me.bestMatches[match.index];
            return (!targetBestMatch || targetBestMatch.distance > match.distance);
        }).sort(function(a, b) { 
            var d1 = a ? a.distance : Number.MAX_VALUE,
                d2 = b ? b.distance : Number.MAX_VALUE;
            return d1 - d2;
        });

        return distances;

    }

    ObjectMatcher.prototype.findBestMatchForIndex = function(inputIndex) {

        debug(inputIndex + ': ' +  this.inputs[inputIndex]);

        // These are the distances of this particular input
        // from all the targets in increasing order of distance.
        var distances = this.inputDistances[inputIndex];
        debug('in ' + JSON.stringify(distances));

        while (distances.length > 0) {
            var dist = distances[0],
                targetBestMatch = this.bestMatches[dist.index];		// This is the target's best match so far

            if (!targetBestMatch || targetBestMatch.distance > dist.distance) {
                // We are a better match, let's update the best matches record
                this.bestMatches[dist.index] = { index: inputIndex, distance: dist.distance };
                debug('=> ' + this.targets[dist.index] + '[' + dist.distance + ']');

                // If this is a perfect match, report it now
                if (dist.distance === 0) this.reportInput(inputIndex);
                
                // Recursively find best match for the input we just replaced
                if (targetBestMatch) this.findBestMatchForIndex(targetBestMatch.index);

                break;
            }

            // Remove the first item and continue with the next best match
            distances.shift();
        }
        
        // Log array size for performance measurements
        this.arraySizes[inputIndex] = distances.length;
        
        // This object is now a MISS
        if (distances.length === 0) this.reportInput(inputIndex);

    }
    
    ObjectMatcher.prototype.reportInput = function (inputIndex) {
        
        var distances = this.inputDistances[inputIndex],
            nearestMatch = distances[0];
        
        if (nearestMatch) {
            // if (nearestMatch.distance !== 0) return;
            
            var targetIndex = nearestMatch.index;
            this.onmatch(this.inputs[inputIndex], this.targets[targetIndex], nearestMatch.distance);
            
            // Make sure this input is also the target's best match
            if (this.bestMatches[targetIndex].index !== inputIndex) console.warn('Reporting match on sub-optimal match');
            
            // Remove the object from array (keeping indexes)
            delete this.targets[targetIndex];
            // Leave best matches untouched so that further calls see the better match
            // (the targets is ignored by new inputs, but older inputs might still have it as match)
            // NO: delete this.bestMatches[targetIndex];
        }
        else {
            this.onmiss(this.inputs[inputIndex], null);
        }
        
        // Remove the object from array (keeping indexes)
        delete this.inputs[inputIndex];
        delete this.inputDistances[inputIndex];
        
    }

    /*
    ObjectMatcher.prototype.reportMatchOrMiss = function(obj, nearestMatch, reportOnlyIdenticalAndRemoveThem) {

        if (!nearestMatch || nearestMatch.distance > this.maxDistance) {
            // Report the miss
            this.onmiss(obj);
        }
        else if ((nearestMatch.distance === 0) || !reportOnlyIdenticalAndRemoveThem) {
            // Report the match
            this.onmatch(obj, this.targets[nearestMatch.index], nearestMatch.distance);

            // When reporting identical matches, remove them from targets
            // so that no target can be matched twice
            if (reportOnlyIdenticalAndRemoveThem) { 
                delete this.targets[nearestMatch.index];


                // We might be replacing an existing match, so let's rematch it
                var targetBestMatch = this.bestMatches[nearestMatch.index];
                if (targetBestMatch) this.findBestMatchForIndex(targetBestMatch.index);
            }
        }
        else return false;

        return true;

    }
    */

    // Supporting methods

    function defaultDistance(a, b) {

        if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b);
        else if (typeof a === 'string' && typeof b === 'string') return levenshtein.get(a, b);
        else return null;

    }

    function defaultOnMatch(input, target, distance) {

        if (distance === 0) {
            console.log(input, ' === ', target);	
        }
        else {
            console.log(input, ' ~' + distance + '~ ', target);
        }

    }

    function defaultOnMiss(input) {

        console.log(input, ' UNMATCHED');	

    }

})();