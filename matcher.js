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
		
		// Callbacks
		this.onmatch = opts.onmatch || defaultOnMatch;
		this.onmiss = opts.onmiss || defaultOnMiss;
        
    }
	
	ObjectMatcher.prototype.push = function (obj) {
		
		debug('Processing ' + obj);
		
		var distances = this.calculateTargetDistances(obj);
		
		// Check whether we found an identical match or miss completely
		// in such case, report the item, otherwise add it to the input list
		// and update best matches
		var nearestMatch = distances[0];
		if (!this.reportMatchOrMiss(obj, nearestMatch, true)) {
			// Update the distance matrix and perform matchup
			var inputIndex = this.inputs.length;
			this.inputs.push(obj);
			this.inputDistances.push(distances);
			
			this.findBestMatchForIndex(inputIndex);
			
			// debug('Current state');
			// debug(this.inputDistances);
		}
		
	}
	
	ObjectMatcher.prototype.end = function () {
		
		for (var i = 0; i < this.inputs.length; i++) {
			this.reportMatchOrMiss(this.inputs[i], this.inputDistances[i][0], false);
		}
		
	}

    module.exports = ObjectMatcher;
	
	// Matching
	
	/**
	 * Generates an array of tuples (target id, distance) 
	 * in increasing order of distance.
	 */
	ObjectMatcher.prototype.calculateTargetDistances = function(obj) {

		var me = this;
		var distances = this.targets.map(function(target, i) {
			var dist = me.distanceFunction(obj, target);
			return (target !== null) ? { index: i, distance: dist } : null;
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
		
		while ((distances.length > 0) && distances[0]) {
			var dist = distances[0],
				targetBestMatch = this.bestMatches[dist.index];		// This is the target's best match so far
			
			if (!targetBestMatch || targetBestMatch.distance > dist.distance) {
				// We are a better match, let's update the best matches record
				this.bestMatches[dist.index] = { index: inputIndex, distance: dist.distance };
				debug('=> ' + this.targets[dist.index] + '[' + dist.distance + ']');

				// Recursively find best match for the input we just replaced
				if (targetBestMatch) this.findBestMatchForIndex(targetBestMatch.index);
				
				return;
			}
			
			// Remove the first item and continue with the next best match
			distances.shift();
		}
		
	}
	
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
			if (reportOnlyIdenticalAndRemoveThem) this.targets[nearestMatch.index] = null;
		}
		else return false;
		
		return true;
		
	}

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