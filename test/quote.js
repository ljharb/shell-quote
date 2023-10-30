var test = require('tape');
var quote = require('../').quote;

test('quote', function (t) {
	t.equal(quote(['a', 'b', 'c d']), "a b 'c d'");
	var quoted = quote(['a', 'b', "it's a \"neat thing\""]);
	t.equal(
		quoted,
		'a b \'it\'\\\'\'s a "neat thing"\''
	);
	t.isEqual(quoted.length, 28);
	t.equal(
		quote(['$', '`', '\'']),
		'\'$\' \'`\' \\\''
	);
	t.equal(quote([]), '');
	t.equal(quote(["'"]), "\\'");
	t.equal(quote(["''"]), "\\'\\'");
	t.equal(quote(['a\nb']), "'a\nb'");
	t.equal(quote([' #(){}*|][!']), "' #(){}*|][!'");
	t.equal(quote(["'#(){}*|][!"]), "\\''#(){}*|][!'");
	t.equal(quote(["'#(){}*|][!"]), '\\\'\'#(){}*|][!\'');
	t.equal(quote(['X#(){}*|][!']), "'X#(){}*|][!'");
	t.equal(quote(['a\n#\nb']), "'a\n#\nb'");
	t.equal(quote(['><;{}']), "'><;{}'");
	t.equal(quote(['a', 1, true, false]), 'a 1 true false');
	t.equal(quote(['a', 1, null, undefined]), 'a 1 null undefined');
	t.equal(quote(['a\\x']), "'a\\x'");

	// Bash brace expansions {a,b} or {a..b} must be quoted
	t.equal(quote(['a{1,2}']), "'a{1,2}'");
	t.equal(quote(['a{,2}']), "'a{,2}'");
	t.equal(quote(['a{,,2}']), "'a{,,2}'");
	t.equal(quote(['\'a{,,2}\'']), "\\''a{,,2}'\\'");
	t.equal(quote(['a{1..2}']), "'a{1..2}'");
	t.equal(quote(['a{X..Z}']), "'a{X..Z}'");
	t.equal(quote(['a{{1..2}}']), "'a{{1..2}}'");

	// ... but non brace expansions should not be
	t.equal(quote(['a{1...2}']), "a{1...2}");
	t.equal(quote(['a{1...2}']), "a{1...2}");
	t.equal(quote(['a{1..Z}']), "a{1..Z}");
	t.equal(quote(['a{a1..b1}']), "a{a1..b1}");
	t.equal(quote(['a{1a..4}']), "a{1a..4}");
	t.equal(quote(['a{..6}']), "a{..6}");
	t.equal(quote(['a{{1...2}}']), "a{{1...2}}");
	t.equal(quote(['a{1.2}']), "a{1.2}");
	t.equal(quote(['a{{1.2}}']), "a{{1.2}}");
	t.equal(quote(['a{12}']), "a{12}");
	quoted = quote(['\\ \\']);
	t.equal(quoted, "'\\ \\'");
	t.isEqual(quoted.length, 5); // 3-char string + 2 quotes
	// TODO: Ugly expansion of single quote at beginning or end of strings.
	// Should return \'
	t.equal(quote(["'$'"]), "\\''$'\\'");
	t.equal(quote(["'"]), "\\'");
	t.equal(quote(['gcc', '-DVAR=value']), 'gcc -DVAR=value');
	t.equal(quote(['gcc', '-DVAR=value with space']), "gcc '-DVAR=value with space'");
	t.end();
});

test('quote ops', function (t) {
	t.equal(quote(['a', { op: '|' }, 'b']), 'a | b');
	t.equal(
		quote(['a', { op: '&&' }, 'b', { op: ';' }, 'c']),
		'a && b ; c'
	);
	t.end();
});

test('quote windows paths', { skip: 'breaking change, disabled until 2.x' }, function (t) {
	var path = 'C:\\projects\\node-shell-quote\\index.js';

	t.equal(quote([path, 'b', 'c d']), 'C:\\projects\\node-shell-quote\\index.js b \'c d\'');

	t.end();
});

test("chars for windows paths don't break out", function (t) {
	var x = '`:\\a\\b';
	t.equal(quote([x]), "'`:\\a\\b'");
	t.end();
});
