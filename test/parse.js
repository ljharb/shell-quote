'use strict';

var test = require('tape');
var parse = require('../').parse;
var quote = require('../').quote;

test('parse shell commands', function (t) {
	t.same(parse(''), [], 'parses an empty string');

	t['throws'](
		function () { parse('${}'); },
		Error,
		'empty substitution throws'
	);
	t['throws'](
		function () { parse('${'); },
		Error,
		'incomplete substitution throws'
	);

	t.same(parse('a \'b\' "c"'), ['a', 'b', 'c']);
	t.same(
		parse('beep "boop" \'foo bar baz\' "it\'s \\"so\\" groovy"'),
		['beep', 'boop', 'foo bar baz', 'it\'s "so" groovy']
	);
	t.same(parse('a b\\ c d'), ['a', 'b c', 'd']);
	t.same(parse('\\$beep bo\\`op'), ['$beep', 'bo`op']);
	t.same(parse('echo "foo = \\"foo\\""'), ['echo', 'foo = "foo"']);
	t.same(parse(''), []);
	t.same(parse(' '), []);
	t.same(parse('\t'), []);
	t.same(parse('a"b c d"e'), ['ab c de']);
	t.same(parse('a\\ b"c d"\\ e f'), ['a bc d e', 'f']);
	t.same(parse('a\\ b"c d"\\ e\'f g\' h'), ['a bc d ef g', 'h']);
	t.same(parse("x \"bl'a\"'h'"), ['x', "bl'ah"]);

	// inside single quotes everything is literal, so a backslash does not escape
	// the closing quote and a quoted token must end at its first closing quote
	t.same(parse("'\\' '\\'"), ['\\', '\\'], 'single-quoted backslashes parse as two separate tokens');
	t.same(parse("'\\'\\''"), ["\\'"], 'single-quoted backslash joined with an escaped quote');
	t.same(parse(quote(['\\', '\\'])), ['\\', '\\'], 'quote/parse round-trips a pair of backslashes');
	t.same(parse("x bl^'a^'h'", {}, { escape: '^' }), ['x', "bl'a'h"]);
	t.same(parse('abcH def', {}, { escape: 'H' }), ['abc def']);

	t.deepEqual(parse('# abc  def  ghi'), [{ comment: ' abc  def  ghi' }], 'start-of-line comment content is unparsed');
	t.deepEqual(parse('xyz # abc  def  ghi'), ['xyz', { comment: ' abc  def  ghi' }], 'comment content is unparsed');

	t.deepEqual(parse('-x "" -y'), ['-x', '', '-y'], 'empty string is preserved');

	t.same(
		parse('2;b', {}, { escape: 'd' }),
		[{ op: '2;b' }],
		'control char in unquoted context mid-token with regex-special escape returns op'
	);

	t.end();
});

test('single quotes are literal', function (t) {
	t.same(parse("'\\'\\'"), ["\\'"], 'close-escape-reopen produces a quote after a quoted backslash');
	t.same(parse("'a'\\''b'"), ["a'b"], 'close-escape-reopen embeds a quote mid-word');
	t.same(parse("'\\'x"), ['\\x'], 'bareword joins a preceding quoted backslash');
	t.same(parse("a'\\'b"), ['a\\b'], 'quoted backslash joins surrounding barewords');
	t.same(parse("''"), [''], 'empty single quotes produce an empty token');
	t.same(parse("''a''"), ['a'], 'empty single quotes join adjacent content');
	t.same(parse("'*'"), ['*'], 'quoted glob char is a plain string, not a glob');

	t.end();
});

test('unmatched single quotes', function (t) {
	// real shells reject unterminated quotes; parse is lenient, and these pin the shape of that leniency
	t.same(parse("'"), [], 'a lone quote is dropped');
	t.same(parse("'a"), ['a'], 'an unterminated quote keeps its content');
	t.same(parse("a'b"), ['a', 'b'], 'an unmatched quote mid-word splits the token');

	t.end();
});

test('an escaped backslash does not escape the character after it', function (t) {
	t.same(parse('a\\\\ b'), ['a\\', 'b'], 'a space after an escaped backslash separates words');
	t.same(parse('a\\\\;echo b'), ['a\\', { op: ';' }, 'echo', 'b'], 'a `;` after an escaped backslash is an operator');
	t.same(parse('x\\\\|cat'), ['x\\', { op: '|' }, 'cat'], 'a `|` after an escaped backslash is an operator');
	t.same(parse('a\\\\"b c"'), ['a\\b c'], 'a `"` after an escaped backslash opens a quoted string');
	t.same(parse('"a\\\\" b'), ['a\\', 'b'], 'an escaped backslash does not escape a closing `"`');
	t.same(parse('"a\\\\" "b"'), ['a\\', 'b'], 'a double-quoted string ends at its first unescaped `"`');
	t.same(parse('"a\\\\";echo "b"'), ['a\\', { op: ';' }, 'echo', 'b'], 'a `;` after a closing `"` is an operator');
	t.same(parse('"a\\\\\\"b" c'), ['a\\"b', 'c'], 'an escaped backslash then an escaped `"` inside double quotes');
	t.same(parse('\\\\\\ y'), ['\\ y'], 'an escaped backslash then an escaped space');
	t.same(
		parse('dir "C:\\Program Files\\"', {}, { escape: '^' }),
		['dir', 'C:\\Program Files\\'],
		'with a custom escape, a backslash before a closing `"` is literal'
	);

	t.end();
});

test('double-quoted strings stay linear with a custom escape', function (t) {
	// a double-quote pattern that ignores the custom escape rescans to the end at every `"`
	var input = new Array(1e5 + 1).join('\\"');
	t.same(parse(input, {}, { escape: '^' }), [new Array(1e5 + 1).join('\\')], 'one word of backslashes');

	t.end();
});

test('nested parameter expansion', function (t) {
	t.same(parse('${a${b}c}'), [''], 'a nested ${} is consumed as one substitution, not split at the first }');
	t.same(parse('${a${b}}'), [''], 'a nested ${} at the end is consumed as one substitution');
	t.same(parse('${foo{bar}'), [''], 'a lone { that is not part of a nested ${} does not change brace depth');
	t.same(
		parse('level=${levels[$RANDOM%${#levels[@]}]}'),
		['level='],
		'a nested array-index expansion is consumed whole, without leaking a partial token'
	);

	t.end();
});

test('splitUnquoted: field-splits unquoted variable expansion (#1)', function (t) {
	var env = { T: 'c d', E: '', S: '  c   d  ', W: '   ' };
	var opts = { splitUnquoted: true };

	t.same(parse('test a b $T', env, opts), ['test', 'a', 'b', 'c', 'd'], 'unquoted expansion splits into separate tokens');
	t.same(parse('a$T', env, opts), ['ac', 'd'], 'the first field joins the preceding text');
	t.same(parse('$T x', env, opts), ['c', 'd', 'x'], 'the last field is a token of its own');
	t.same(parse('x${T}y', env, opts), ['xc', 'dy'], 'fields join text on both sides');
	t.same(parse('$S', env, opts), ['c', 'd'], 'leading, trailing, and repeated whitespace collapses');
	t.same(parse('a$S', env, opts), ['a', 'c', 'd'], 'leading whitespace closes the preceding field');
	t.same(parse('$W', env, opts), [], 'an all-whitespace expansion produces no tokens');
	t.same(parse('a$W b', env, opts), ['a', 'b'], 'an all-whitespace expansion just separates fields');
	t.same(parse('$E', env, opts), [], 'an empty unquoted expansion produces no token');
	t.same(parse('"$T"', env, opts), ['c d'], 'a quoted expansion is never split');
	t.same(parse('-x "" -y', env, opts), ['-x', '', '-y'], 'a quoted empty string is still preserved');
	t.same(parse('a $F b', function () { return 'c d'; }, opts), ['a', 'c', 'd', 'b'], 'the env-function path splits too');

	t.same(parse('test a b $T', env), ['test', 'a', 'b', 'c d'], 'without the option, unquoted expansion is not split');

	t.end();
});

test('splitUnquoted: a string value is a custom IFS (#1)', function (t) {
	function o(ifs) { return { splitUnquoted: ifs }; }

	t.same(parse('${V}', { V: 'a:b' }, o(':')), ['a', 'b'], 'a non-whitespace IFS char splits fields');
	t.same(parse('${V}', { V: 'a::b' }, o(':')), ['a', '', 'b'], 'adjacent non-whitespace delimiters yield an empty field');
	t.same(parse('${V}', { V: ':a:' }, o(':')), ['', 'a'], 'a leading delimiter yields a leading empty; a trailing one does not');
	t.same(parse('${V}', { V: 'a::' }, o(':')), ['a', ''], 'a trailing double delimiter yields one empty field');
	t.same(parse('${V}', { V: ':' }, o(':')), [''], 'a lone delimiter yields a single empty field');
	t.same(parse('${V}', { V: '::' }, o(':')), ['', ''], 'two delimiters yield two empty fields');
	t.same(parse('${V}${W}', { V: 'a:', W: ':b' }, o(':')), ['a', '', 'b'], 'delimiters spanning an expansion boundary merge into one run');
	t.same(parse('a${V}${W}z', { V: ':x:', W: ':y:' }, o(':')), ['a', 'x', '', 'y', 'z'], 'fields join literal text on both sides across expansions');
	t.same(parse('${V}', { V: 'a : b' }, o(' :')), ['a', 'b'], 'whitespace around a non-whitespace delimiter is absorbed');
	t.same(parse('${V}', { V: 'a b:c' }, o(' :')), ['a', 'b', 'c'], 'mixed IFS: whitespace and non-whitespace each delimit');
	t.same(parse('${V}', { V: 'a,b' }, o(',')), ['a', 'b'], 'any character can be the IFS');
	t.same(parse('${V}', { V: 'a b' }, o('')), ['a b'], 'an empty IFS string disables splitting');

	t.end();
});

test('parse stays linear in token count (GHSA-395f-4hp3-45gv)', function (t) {
	// the old concat-in-reduce finalizer was O(n^2): this many tokens took
	// ~minutes, so under the unfixed code this test hangs rather than passes
	var n = 2e5;
	var input = new Array(n + 1).join('x '); // avoid String#repeat for old engines

	var words = parse(input);
	t.equal(words.length, n, 'every token is returned');
	t.equal(words[0], 'x', 'first token is correct');
	t.equal(words[n - 1], 'x', 'last token is correct');

	var withEnv = parse(input, function () { return 'v'; });
	t.equal(withEnv.length, n, 'env-function path returns every token');

	t.end();
});

test('ANSI-C quoting', function (t) {
	t.same(parse('$\'\''), [''], 'empty ANSI-C string');
	t.same(parse('$\'abc\''), ['abc'], 'plain ANSI-C string');
	t.same(parse('echo $\'it\\\'s\''), ['echo', 'it\'s'], 'an escaped quote does not end the string');
	t.same(parse('$\'{"a":"${field}"}\''), ['{"a":"${field}"}'], 'variables are not expanded');
	t.same(parse('$\'$HOME\'', { HOME: '/home/robot' }), ['$HOME'], 'env is not consulted');
	t.same(parse('$\'cost is $5\''), ['cost is $5'], 'no word splitting, no expansion');
	t.same(parse('foo$\'\\n\'bar'), ['foo\nbar'], 'mid-token ANSI-C string');
	t.same(parse('a $\'x\' b'), ['a', 'x', 'b'], 'standalone ANSI-C string is its own word');

	t.same(parse('$\'line1\\nline2\''), ['line1\nline2'], '\\n is decoded');
	t.same(parse('$\'tab\\there\''), ['tab\there'], '\\t is decoded');
	t.same(parse('$\'\\x41\''), ['A'], '\\xHH is decoded');
	t.same(parse('$\'\\x4\''), ['\u0004'], 'a single hex digit is decoded');
	t.same(parse('$\'\\101\''), ['A'], 'octal escapes are decoded');
	t.same(parse('$\'\\u0041\''), ['A'], '\\uHHHH is decoded');
	t.same(parse('$\'\\U0001F600\''), ['\uD83D\uDE00'], '\\UHHHHHHHH is decoded, as a surrogate pair');
	t.same(parse('$\'\\U00110000\''), ['\\U00110000'], 'an out of range \\U escape is left alone');
	t.same(parse('$\'\\e\''), ['\u001B'], '\\e is ESC');
	t.same(parse('$\'\\ca\''), ['\u0001'], '\\ca is a control character');
	t.same(parse('$\'\\c?\''), ['\u007F'], '\\c? is DEL');
	t.same(parse('$\'a\\"b\''), ['a"b'], '\\" is a double quote');
	t.same(parse('$\'a\\\\b\''), ['a\\b'], 'a doubled backslash is a backslash');
	t.same(parse('$\'a\\zb\''), ['a\\zb'], 'an unrecognized escape keeps its backslash');
	t.same(parse('$\'\\xzz\''), ['\\xzz'], '\\x with no hex digits keeps its backslash');

	t.same(parse('"a$\'\\n\'b"'), ['a$\'\\n\'b'], 'not special inside double quotes');

	t.end();
});

test('ANSI-C quoting: word boundaries and edge cases', function (t) {
	t.same(parse('a$\'x\\\' y\''), ['ax\' y'], 'an escaped quote mid-word does not end the string');
	t.same(parse('x$\'a\\\'b\' | c \'z\''), ['xa\'b', { op: '|' }, 'c', 'z'], 'an operator after a mid-word ANSI-C string is an operator');
	t.same(parse('a$\'x\\\' ; y\''), ['ax\' ; y'], 'a `;` inside an ANSI-C string is not an operator');
	t.same(parse('x\\\\$\'it\\\'s\' y'), ['x\\it\'s', 'y'], 'an ANSI-C string after an escaped backslash');
	t.same(parse('$\'abc\\\''), ['$abc\\'], 'an unterminated ANSI-C string is not decoded');
	t.same(parse('$A$\'x\'', { A: 'a ' }, { splitUnquoted: true }), ['a', 'x'], 'a pending field split ends before an ANSI-C string');
	t.same(parse('a $\'\' b', {}, { splitUnquoted: true }), ['a', '', 'b'], 'an empty ANSI-C string is an empty word');
	t.same(parse('$\'a\\0b\'c'), ['ac'], 'a NUL ends the string, as in bash');
	t.same(parse('$\'\\477\''), ['?'], 'octal escapes are masked to 8 bits');
	t.same(parse('$\'\\c\\\\\''), ['\u001C'], '\\c\\\\ is one control character');
	t.same(parse('$\'a\\c\''), ['a\\c'], 'a trailing \\c keeps its backslash');
	t.same(parse('$\'a\\nb\'', {}, { escape: '^' }), ['a\nb'], 'a backslash is always the escape inside $\'...\'');

	t.end();
});

test('ANSI-C quoting stays linear on an unterminated string', function (t) {
	// an ambiguous body pattern backtracks exponentially here, so this would hang rather than fail
	var backslashes = new Array(1e5 + 1).join('\\');
	t.same(parse('$\'' + backslashes), ['$', backslashes.slice(5e4)], 'an unterminated $\' then 100000 backslashes');

	t.end();
});
