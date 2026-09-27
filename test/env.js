'use strict';

var test = require('tape');
var parse = require('../').parse;

test('expand environment variables', function (t) {
	t.same(parse('a $XYZ c', { XYZ: 'b' }), ['a', 'b', 'c']);
	t.same(parse('a${XYZ}c', { XYZ: 'b' }), ['abc']);
	t.same(parse('a${XYZ}c $XYZ', { XYZ: 'b' }), ['abc', 'b']);
	t.same(parse('"-$X-$Y-"', { X: 'a', Y: 'b' }), ['-a-b-']);
	t.same(parse("'-$X-$Y-'", { X: 'a', Y: 'b' }), ['-$X-$Y-']);
	t.same(parse('qrs"$zzz"wxy', { zzz: 'tuv' }), ['qrstuvwxy']);
	t.same(parse("qrs'$zzz'wxy", { zzz: 'tuv' }), ['qrs$zzzwxy']);
	t.same(parse('qrs${zzz}wxy'), ['qrswxy']);
	t.same(parse('qrs$wxy $'), ['qrs', '$']);
	t.same(parse('grep "xy$"'), ['grep', 'xy$']);
	t.same(parse('ab$x', { x: 'c' }), ['abc']);
	t.same(parse('ab\\$x', { x: 'c' }), ['ab$x']);
	t.same(parse('ab${x}def', { x: 'c' }), ['abcdef']);
	t.same(parse('ab\\${x}def', { x: 'c' }), ['ab${x}def']);
	t.same(parse('"ab\\${x}def"', { x: 'c' }), ['ab${x}def']);

	t.end();
});

test('expand environment variables within here-strings', function (t) {
	t.same(parse('a <<< $x', { x: 'Joe' }), ['a', { op: '<<<' }, 'Joe']);
	t.same(parse('a <<< ${x}', { x: 'Joe' }), ['a', { op: '<<<' }, 'Joe']);
	t.same(parse('a <<< "$x"', { x: 'Joe' }), ['a', { op: '<<<' }, 'Joe']);
	t.same(parse('a <<< "${x}"', { x: 'Joe' }), ['a', { op: '<<<' }, 'Joe']);

	t.end();
});

test('environment variables with metacharacters', function (t) {
	t.same(parse('a $XYZ c', { XYZ: '"b"' }), ['a', '"b"', 'c']);
	t.same(parse('a $XYZ c', { XYZ: '$X', X: 5 }), ['a', '$X', 'c']);
	t.same(parse('a"$XYZ"c', { XYZ: "'xyz'" }), ["a'xyz'c"]);

	t.end();
});

test('special shell parameters', function (t) {
	var chars = '*@#?-$!0_'.split('');
	t.plan(chars.length);

	chars.forEach(function (c) {
		var env = {};
		env[c] = 'xxx';
		t.same(parse('a $' + c + ' c', env), ['a', 'xxx', 'c']);
	});
});

test('special shell parameters preserve adjacent text', function (t) {
	'*@#?-$!'.split('').forEach(function (c) {
		var env = {};
		env[c] = 'value';
		t.same(parse('$' + c + 'suffix', env), ['valuesuffix'], 'unquoted $' + c + ' with a suffix');
		t.same(parse('"$' + c + 'suffix"', env), ['valuesuffix'], 'double-quoted $' + c + ' with a suffix');
		t.same(parse('$' + c + ':suffix', env), ['value:suffix'], '$' + c + ' followed by punctuation');
		t.same(parse('$' + c, env), ['value'], '$' + c + ' at the end of input');
		t.same(parse('"$' + c + '"', env), ['value'], '$' + c + ' before a closing quote');
	});

	t.end();
});

test('resume parsing syntax after a special shell parameter', function (t) {
	var env = { '?': '1', '!': '2' };
	t.same(parse('$?$!', env), ['12'], 'expand consecutive special parameters');
	t.same(parse('"$?$!"', env), ['12'], 'expand consecutive special parameters inside double quotes');
	t.same(parse('$?\\ suffix', env), ['1 suffix'], 'handle an escaped space after a special parameter');
	t.same(parse('"$?"\'suffix\'', env), ['1suffix'], 'close double quotes before entering single quotes');
	t.same(parse('$?;echo', env), ['1', { op: ';' }, 'echo'], 'preserve a control operator after a special parameter');
	t.same(parse('$?suffix'), ['suffix'], 'preserve the suffix when the parameter is unset');
	t.same(parse('$?suffix', { '?': 'one two' }, { splitUnquoted: true }), ['one', 'twosuffix'], 'append the suffix to the last split field');
	t.same(parse('$?$!', function (key) { return env[key]; }), ['12'], 'expand consecutive special parameters with a lookup function');
	t.same(parse('$?\'#x\' y', env), ['1#x', 'y'], 'open single quotes right after a special parameter');
	t.same(parse('$?"a;b"', env), ['1a;b'], 'open double quotes right after a special parameter');
	t.same(parse('$?\\$x', { '?': '1', x: 'X' }), ['1$x'], 'keep an escaped dollar sign after a special parameter literal');
	t.same(parse('$?*', env), [{ op: 'glob', pattern: '1*' }], 'a glob character after a special parameter makes a glob');

	t.end();
});

test('`$_` followed by name characters is a longer variable name', function (t) {
	var env = {
		_: 'A',
		_foo: 'B',
		__: 'C',
		_1: 'D'
	};
	t.same(parse('$_foo', env), ['B'], '`$_foo` is the variable `_foo`');
	t.same(parse('$__', env), ['C'], '`$__` is the variable `__`');
	t.same(parse('$_1', env), ['D'], '`$_1` is the variable `_1`');
	t.same(parse('"$_foo"', env), ['B'], 'double-quoted `$_foo` is the variable `_foo`');
	t.same(parse('$_:x', env), ['A:x'], '`$_` followed by punctuation');
	t.same(parse('$_', env), ['A'], '`$_` at the end of input');

	t.end();
});
