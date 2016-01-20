var assert = require('assert'),
    Oms = require('..'),
    StreamTest = require('streamtest')['v2'];

var inputData = [914,925,934,330,116,46,834,328,594,852,416,49,385,766,801,746,243,925,20,683],
    testTargets = [0, 50, 100, 200, 500, 925, 1000];

describe('NumericMatching', function() {

  describe('Matching empty array', function() {
    
    it('should work without parameters', function(done) {
      // NOTE: Omitting the `new` keyword here intentionally
      var oms = Oms();
      
      // Test pipeline
      StreamTest.fromObjects(inputData.slice(0))
      .pipe(oms)
      .pipe(StreamTest.toObjects(function(err, objects) {
        // console.log(err, objects);
        assert(!err);
        assert(objects);
        assert(objects.length === inputData.length);
        objects.forEach(function(obj, index) {
          assert.strictEqual(obj.source, inputData[index]);
          assert(obj.target === undefined);
          assert(obj.distance === undefined);
        });
        done();
      }));
    });
	  
  });
  
  describe('Matching without max distance', function() {
    
    it('should match closest items', function(done) {
      var oms = new Oms({
        targets: testTargets.slice(0)
      });
      
      // Test pipeline
      StreamTest.fromObjects(inputData.slice(0))
      .pipe(oms)
      .pipe(StreamTest.toObjects(function(err, objects) {
        // console.log(err, objects);
        assert(!err);
        assert(objects);
        assert(objects.length === inputData.length);
        assert.deepStrictEqual(objects, [ 
          { source: 925, target: 925, distance: 0 },
          { source: 914 },
          { source: 934, target: 1000, distance: 66 },
          { source: 330 },
          { source: 116, target: 100, distance: 16 },
          { source: 46 },
          { source: 834 },
          { source: 328 },
          { source: 594 },
          { source: 852 },
          { source: 416, target: 500, distance: 84 },
          { source: 49, target: 50, distance: 1 },
          { source: 385 },
          { source: 766 },
          { source: 801 },
          { source: 746 },
          { source: 243, target: 200, distance: 43 },
          { source: 925 },
          { source: 20, target: 0, distance: 20 },
          { source: 683 } 
        ]);
        done();
      }));
    });
	  
  });
  
  describe('Matching with max distance', function() {
    
    it('should match closest items', function(done) {
      var oms = new Oms({
        targets: testTargets.slice(0),
        maxDistance: 50
      });
      
      // Test pipeline
      StreamTest.fromObjects(inputData.slice(0))
      .pipe(oms)
      .pipe(StreamTest.toObjects(function(err, objects) {
        // console.log(err, objects);
        assert(!err);
        assert(objects);
        assert(objects.length === inputData.length);
        assert.deepStrictEqual(objects, [ 
          { source: 925, target: 925, distance: 0 },
          { source: 934 },
          { source: 330 },
          { source: 834 },
          { source: 328 },
          { source: 594 },
          { source: 852 },
          { source: 416 },
          { source: 385 },
          { source: 766 },
          { source: 801 },
          { source: 746 },
          { source: 925 },
          { source: 683 },
          { source: 914 },
          { source: 116, target: 100, distance: 16 },
          { source: 46 },
          { source: 49, target: 50, distance: 1 },
          { source: 243, target: 200, distance: 43 },
          { source: 20, target: 0, distance: 20 }
        ]);
        done();
      }));
    });
	  
  });
  
  /*
  StreamTest.versions.forEach(function(version) {
    describe('for ' + version + ' streams', function() {

      it('should work with buffers', function(done) {
        var expectedBuffers = [Buffer('test'), Buffer('test2')];
        var inputStream = StreamTest[version].fromChunks(expectedBuffers.slice(0));
        var outputStream = StreamTest[version].toChunks(function(err, buffers) {
          if(err) {
            return done(err);
          }
          assert.deepEqual(buffers, expectedBuffers);
          done();
        });
        
        inputStream.pipe(outputStream);
      });

      it('should report errors with buffers', function(done) {
        var expectedBuffers = [Buffer('test'), Buffer('test2')];
        var inputStream = StreamTest[version].fromErroredChunks(new Error('Ooops'), expectedBuffers.slice(0));
        var outputStream = StreamTest[version].toChunks(function(err, buffers) {
          assert(err);
          assert(!buffers);
          done();
        });
        inputStream.on('error', function(err) {
          outputStream.emit('error', err);
        });
        inputStream.pipe(outputStream);
      });

      it('should work when wanting whole text', function(done) {
        var expectedBuffers = ['test', 'test2'];
        var inputStream = StreamTest[version].fromObjects(expectedBuffers.slice(0));
        var outputStream = StreamTest[version].toText(function(err, buffers) {
          if(err) {
            return done(err);
          }
          assert.deepEqual(buffers, expectedBuffers.join(''));
          done();
        });
        
        inputStream.pipe(outputStream);
      });

      it('should report errors when wanting whole text', function(done) {
        var expectedBuffers = [Buffer('test'), Buffer('test2')];
        var inputStream = StreamTest[version].fromErroredChunks(new Error('Ooops'), expectedBuffers.slice(0));
        inputStream.on('error', function(err) {
          outputStream.emit('error', err);
        });
        var outputStream = StreamTest[version].toText(function(err, buffers) {
          assert(err);
          assert(!buffers);
          done();
        });
        
        inputStream.pipe(outputStream);
      });

      it('should work with objects', function(done) {
        var expectedObjs = [{
          test: 'test'
        }, {
          test: 'test2'
        }];
        var inputStream = StreamTest[version].fromObjects(expectedObjs.slice(0));
        var outputStream = StreamTest[version].toObjects(function(err, objs) {
          if(err) {
            return done(err);
          }
          assert.deepEqual(objs, expectedObjs);
          done();
        });
        
        inputStream.pipe(outputStream);
      });

      it('should report errors with objects', function(done) {
        var expectedObjs = [{
          test: 'test'
        }, {
          test: 'test2'
        }];
        var inputStream = StreamTest[version].fromErroredObjects(new Error('Ooops'), expectedObjs.slice(0));
        inputStream.on('error', function(err) {
          outputStream.emit('error', err);
        });
        var outputStream = StreamTest[version].toObjects(function(err, objs) {
          assert(err);
          assert(!objs);
          done();
        });
        
        inputStream.pipe(outputStream);
      });

    });

  });
  */
  
});

