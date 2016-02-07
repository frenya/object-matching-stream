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
        this.inputMatches = [];
        this.bestMatches = [];
        
        // Measuring matching matrix's size high watermark
        this.arraySizes = [];
        this.matrixSizeHWM = 0;

        // Callbacks
        this.onmatch = opts.onmatch || defaultOnMatch;
        this.onmiss = opts.onmiss || defaultOnMiss;

    }

    /**
     * Main entry method. Takes a given input and runs it
     * through the matching matrix.
     */
    ObjectMatcher.prototype.push = function (input) {

        debug('Processing ' + input);

        var matches = this.calculateTargetMatches(input);

        var inputIndex = this.inputs.length;
        this.inputs.push(input);
        this.inputMatches.push(matches);

        // Update best matches (recursively)
        this.findBestMatchForIndex(inputIndex);

        // Update high water mark (performance diagnostics)
        var hwm = this.arraySizes.reduce(function (a, b) { return a + b; }, 0);
        this.matrixSizeHWM = Math.max(this.matrixSizeHWM, hwm);
        
    }

    ObjectMatcher.prototype.end = function () {

        // Log the high water mark to console
        debug('HWM: ' + this.matrixSizeHWM);

        var me = this;
        
        // Report unmatched inputs (skips deleted)
        this.inputs.forEach(function (input, index) {
            me.reportInput(index);
        });
        
        // Report unmatched targets (skips deleted)
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
    ObjectMatcher.prototype.calculateTargetMatches = function(input) {

        var me = this;
        return this.targets.map(function(target, i) {
            var dist = me.distanceFunction(input, target);
            return (target !== null) ? { targetIndex: i, distance: dist } : null;
        }).filter(function(match) {
            // Don't store invalid or too distant matches
            if (!match || match.distance > me.maxDistance) return false;

            // Only store matches that are closer than the current best match
            var targetBestMatch = me.bestMatches[match.targetIndex];
            return (!targetBestMatch || targetBestMatch.distance > match.distance);
        }).sort(function(a, b) { 
            var d1 = a ? a.distance : Number.MAX_VALUE,
                d2 = b ? b.distance : Number.MAX_VALUE;
            return d1 - d2;
        });

    }

    /**
     * Goes through  all the eligible matches for a give input
     * (by shifting the inputMatches[inputIndex] array)
     * until it finds one that is the best match for a particular target.
     *
     * If successful, updates the bestMatches array and when applicable
     * continues recursively for the input that was previously matched
     * with the given target.
     *
     * Reports perfect matches (distance = 0) and misses (no eligible matches left).
     */
    ObjectMatcher.prototype.findBestMatchForIndex = function(inputIndex) {

        debug(inputIndex + ': ' +  this.inputs[inputIndex]);

        // These are the distances of this particular input
        // from all the targets in increasing order of distance.
        var matches = this.inputMatches[inputIndex];
        debug('in ' + JSON.stringify(matches));

        while (matches.length > 0) {
            var nearestMatch = matches[0],
                targetBestMatch = this.bestMatches[nearestMatch.targetIndex];		// This is the target's best match so far

            if (!targetBestMatch || targetBestMatch.distance > nearestMatch.distance) {
                // We are a better match, let's update the best matches record
                this.bestMatches[nearestMatch.targetIndex] = { inputIndex: inputIndex, distance: nearestMatch.distance };
                debug('=> ' + this.targets[nearestMatch.targetIndex] + '[' + nearestMatch.distance + ']');

                // If this is a perfect match, report it now
                if (nearestMatch.distance === 0) this.reportInput(inputIndex);
                
                // Recursively find best match for the input we just replaced
                if (targetBestMatch) this.findBestMatchForIndex(targetBestMatch.inputIndex);

                break;
            }

            // Remove the first item and continue with the next best match
            matches.shift();
        }
        
        // Log array size for performance measurements
        this.arraySizes[inputIndex] = matches.length;
        
        // This object is now a MISS
        if (matches.length === 0) this.reportInput(inputIndex);

    }
    
    /**
     * Calls this.onmiss or this.onmatch callback for given input
     * and removes both the input and the matched target (on match)
     * from their respective arrays.
     */
    ObjectMatcher.prototype.reportInput = function (inputIndex) {
        
        var matches = this.inputMatches[inputIndex],
            nearestMatch = matches[0];
        
        if (nearestMatch) {
            // if (nearestMatch.distance !== 0) return;
            
            var targetIndex = nearestMatch.targetIndex;
            this.onmatch(this.inputs[inputIndex], this.targets[targetIndex], nearestMatch.distance);
            
            // Make sure this input is also the target's best match
            if (this.bestMatches[targetIndex].inputIndex !== inputIndex) console.warn('Reporting match on sub-optimal match');
            
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
        delete this.inputMatches[inputIndex];
        
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