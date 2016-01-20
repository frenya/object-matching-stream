(function () {
    "use strict";

    // Libraries
    var stream = require('stream'), 
        util = require('util'),
        Queue = require('./lib/Queue.js'),
		debug = require('debug')('oms'),
		ObjectMatcher = require('./matcher');

    function ObjectMatchingStream(opts) {
		// Make sure this is used as a constructor
		if (!this) return new ObjectMatchingStream(opts);
		
        stream.Duplex.call(this, {objectMode: true});
        
		// Setup the object matcher
		this.matcher = new ObjectMatcher(opts || {});
		this.matcher.onmatch = this.handleMatch.bind(this);
		this.matcher.onmiss = this.handleMiss.bind(this);
		
		// Setup internal queuing
        this._queue = new Queue();
        this._eof = false;
        this._queueDrained = false;
        
        this.on('finish', function() {
            debug('Finished writing stuff!!');
			this.matcher.end();
            this._eof = true;
	        if (this._queueDrained) {
				this._queueDrained = false;
            	this._read(1);
        	}
        });
    }

    util.inherits(ObjectMatchingStream, stream.Duplex);

    ObjectMatchingStream.prototype._write = function (obj, encodingIgnored, done) {

		this.matcher.push(obj);
		
        done();

    }

    ObjectMatchingStream.prototype._read = function (sizeIgnored) {
        
        while(!this._queue.isEmpty()) {
			var obj = this._queue.dequeue();
			debug('Pushing', obj);
            if (!this.push(obj)) {
            	debug('Output full, number of remaining items in queue is ' + this._queue.getLength());
                return;
			}
        }

        // Signal End-of-File to consumers if appropriate
        if (this._eof) {
            debug('Signalling EOF');
            this.push(null);
        }
        else this._queueDrained = true;

    }
	
	ObjectMatchingStream.prototype.handleMatch = function (input, target, distance) {
		
		this.enqueueObject({ source: input, target: target, distance: distance });
		
	}
	
	ObjectMatchingStream.prototype.handleMiss = function (input) {

		this.enqueueObject({ source: input });
		
	}
	    
	ObjectMatchingStream.prototype.enqueueObject = function (obj) {
		
		this._queue.enqueue(obj);
		
        if (this._queueDrained) {
            this._queueDrained = false;
            this._read(1);
        }

	}

    module.exports = ObjectMatchingStream;
    
})();