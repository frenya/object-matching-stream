var ObjectMatcher = require('./matcher');

var matcher = new ObjectMatcher({
	targets: 'quick brown fox jumped over a lazy dog'.split(' ')
});

var distances = matcher.calculateTargetDistances('bomb');

console.log(distances);

matcher.push('a');
matcher.push('bomb');
matcher.push('foxy');
matcher.push('love');
matcher.push('quiver');
matcher.push('lazy');
matcher.push('bowie');
matcher.push('lazy');
matcher.push('brownie');
matcher.push('jump');
matcher.push('b');
matcher.push('xxx');
matcher.push('jumper');
matcher.end();
