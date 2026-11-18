'use strict';

var test = require('tape');
var parse = require('../').parse;

test('comment', function (t) {
	t.same(parse('beep #boop'), ['beep', { comment: 'boop' }]);
	t.same(parse('beep # boop'), ['beep', { comment: ' boop' }]);
	t.same(parse('beep # > boop'), ['beep', { comment: ' > boop' }]);
	t.same(parse('beep # "> boop"'), ['beep', { comment: ' "> boop"' }]);
	t.same(parse('beep "#"'), ['beep', '#']);
	t.same(parse('beep #"#"#'), ['beep', { comment: '"#"#' }]);
	t.same(parse('beep > boop # > foo'), ['beep', { op: '>' }, 'boop', { comment: ' > foo' }]);
	t.end();
});

test('a `#` inside a word does not start a comment', function (t) {
	t.same(parse('beep#boop'), ['beep#boop']);
	t.same(parse('beep#boop bop'), ['beep#boop', 'bop']);
	t.same(parse('FOO=a#b node x.js'), ['FOO=a#b', 'node', 'x.js']);
	t.same(parse('"beep"#boop'), ['beep#boop'], 'after a double-quoted part');
	t.same(parse('\'beep\'#boop'), ['beep#boop'], 'after a single-quoted part');
	t.same(parse('beep\\\\#boop'), ['beep\\#boop'], 'after an escaped backslash');
	t.same(parse('beep#boop # bop'), ['beep#boop', { comment: ' bop' }], 'a later word can still start a comment');
	t.same(parse('beep;#boop'), ['beep', { op: ';' }, { comment: 'boop' }], 'after an operator');
	t.same(parse('(beep)#boop'), [{ op: '(' }, 'beep', { op: ')' }, { comment: 'boop' }], 'after a closing parenthesis');
	t.end();
});
