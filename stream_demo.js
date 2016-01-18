var ObjectMatchingStream = require('./index');

var matcher = new ObjectMatchingStream({
	targets: 'quick brown fox jumped over a lazy dog'.split(' '),
	maxDistance: 2
});

matcher.on('data', function (data) { console.log(data) });

matcher.write('a');
matcher.write('bomb');
matcher.write('foxy');
matcher.write('love');
matcher.write('quiver');
matcher.write('lazy');
matcher.write('bowie');
matcher.write('lazy');
matcher.write('brownie');
matcher.write('jump');
matcher.write('b');
matcher.write('xxx');
matcher.write('jumper');
matcher.end();

/*
matcher.write('a');
matcher.write('quick');
matcher.write('fox');
matcher.write('over');
matcher.write('dog');
matcher.write('brown');
matcher.write('jumped');
matcher.write('lazy');
matcher.end();
*/