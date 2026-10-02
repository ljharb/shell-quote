'use strict';

var test = require('tape');
var parse = require('../').parse;

test('single operators', function (t) {
	t.same(parse('beep | boop'), ['beep', { op: '|' }, 'boop']);
	t.same(parse('beep|boop'), ['beep', { op: '|' }, 'boop']);
	t.same(parse('beep \\| boop'), ['beep', '|', 'boop']);
	t.same(parse('beep "|boop"'), ['beep', '|boop']);

	t.same(parse('echo zing &'), ['echo', 'zing', { op: '&' }]);
	t.same(parse('echo zing&'), ['echo', 'zing', { op: '&' }]);
	t.same(parse('echo zing\\&'), ['echo', 'zing&']);
	t.same(parse('echo "zing\\&"'), ['echo', 'zing\\&']);

	t.same(parse('beep;boop'), ['beep', { op: ';' }, 'boop']);
	t.same(parse('(beep;boop)'), [
		{ op: '(' }, 'beep', { op: ';' }, 'boop', { op: ')' }
	]);

	t.same(parse('beep>boop'), ['beep', { op: '>' }, 'boop']);
	t.same(parse('beep 2>boop'), ['beep', '2', { op: '>' }, 'boop']);
	t.same(parse('beep<boop'), ['beep', { op: '<' }, 'boop']);

	t.end();
});

test('double operators', function (t) {
	t.same(parse('beep || boop'), ['beep', { op: '||' }, 'boop']);
	t.same(parse('beep||boop'), ['beep', { op: '||' }, 'boop']);
	t.same(parse('beep ||boop'), ['beep', { op: '||' }, 'boop']);
	t.same(parse('beep|| boop'), ['beep', { op: '||' }, 'boop']);
	t.same(parse('beep  ||   boop'), ['beep', { op: '||' }, 'boop']);

	t.same(parse('beep && boop'), ['beep', { op: '&&' }, 'boop']);
	t.same(
		parse('beep && boop || byte'),
		['beep', { op: '&&' }, 'boop', { op: '||' }, 'byte']
	);
	t.same(
		parse('beep&&boop||byte'),
		['beep', { op: '&&' }, 'boop', { op: '||' }, 'byte']
	);
	t.same(
		parse('beep\\&\\&boop||byte'),
		['beep&&boop', { op: '||' }, 'byte']
	);
	t.same(
		parse('beep\\&&boop||byte'),
		['beep&', { op: '&' }, 'boop', { op: '||' }, 'byte']
	);
	t.same(
		parse('beep;;boop|&byte>>blip'),
		['beep', { op: ';;' }, 'boop', { op: '|&' }, 'byte', { op: '>>' }, 'blip']
	);

	t.same(parse('beep 2>&1'), ['beep', '2', { op: '>&' }, '1']);

	t.same(
		parse('beep<(boop)'),
		['beep', { op: '<(' }, 'boop', { op: ')' }]
	);
	t.same(
		parse('beep<<(boop)'),
		['beep', { op: '<' }, { op: '<(' }, 'boop', { op: ')' }]
	);

	t.end();
});

test('duplicating input file descriptors', function (t) {
	// duplicating stdout to file descriptor 3
	t.same(parse('beep 3<&1'), ['beep', '3', { op: '<&' }, '1']);

	// duplicating stdout to file descriptor 0, i.e. stdin
	t.same(parse('beep <&1'), ['beep', { op: '<&' }, '1']);

	// closes stdin
	t.same(parse('beep <&-'), ['beep', { op: '<&' }, '-']);

	t.end();
});

test('here strings', function (t) {
	t.same(parse('cat <<< "hello world"'), ['cat', { op: '<<<' }, 'hello world']);
	t.same(parse('cat <<< hello'), ['cat', { op: '<<<' }, 'hello']);
	t.same(parse('cat<<<hello'), ['cat', { op: '<<<' }, 'hello']);
	t.same(parse('cat<<<"hello world"'), ['cat', { op: '<<<' }, 'hello world']);

	t.end();
});

test('here documents', function (t) {
	t.same(parse('cat > tmp.txt << a'), ['cat', { op: '>' }, 'tmp.txt', { op: '<<' }, 'a']);
	t.same(parse('cat << EOF'), ['cat', { op: '<<' }, 'EOF']);
	t.same(parse('cat<<EOF'), ['cat', { op: '<<' }, 'EOF']);
	t.same(parse('cat <<\'EOF\''), ['cat', { op: '<<' }, 'EOF']);
	t.same(parse('cat <<"E OF"'), ['cat', { op: '<<' }, 'E OF']);
	t.same(parse('cat 3<<EOF'), ['cat', '3', { op: '<<' }, 'EOF']);
	t.same(parse('cat <<a <<b'), ['cat', { op: '<<' }, 'a', { op: '<<' }, 'b']);
	t.same(parse('cat <<EOF | wc -l'), ['cat', { op: '<<' }, 'EOF', { op: '|' }, 'wc', '-l']);
	t.same(parse('cat <<'), ['cat', { op: '<<' }], 'at the end of the input');

	t.same(parse('cat < < a'), ['cat', { op: '<' }, { op: '<' }, 'a'], 'separated `<` are still two operators');
	t.same(parse('cat \\<\\< a'), ['cat', '<<', 'a'], 'escaped');
	t.same(parse('cat \\<< a'), ['cat', '<', { op: '<' }, 'a'], 'partly escaped');
	t.same(parse('cat "<<" a'), ['cat', '<<', 'a'], 'quoted');
	t.same(parse('cat ^<^< a', {}, { escape: '^' }), ['cat', '<<', 'a'], 'escaped with a custom escape');
	t.same(parse('cat << a', {}, { escape: '^' }), ['cat', { op: '<<' }, 'a'], 'unescaped with a custom escape');

	t.same(parse('cat <<<< a'), ['cat', { op: '<<<' }, { op: '<' }, 'a'], '`<<<` wins over `<<`');
	t.same(parse('cat <<<<< a'), ['cat', { op: '<<<' }, { op: '<<' }, 'a']);
	t.same(parse('cat <<& a'), ['cat', { op: '<<' }, { op: '&' }, 'a'], '`<<` wins over `<&`');

	t.same(
		parse('cat <<(boop)'),
		['cat', { op: '<' }, { op: '<(' }, 'boop', { op: ')' }],
		'`<<(` is `<` and `<(`, as zsh reads it'
	);
	t.same(
		parse('cat << (boop)'),
		['cat', { op: '<<' }, { op: '(' }, 'boop', { op: ')' }],
		'a separated `(` does not split `<<`'
	);

	t.same(
		parse('cat << EOF\nhello\nEOF\n'),
		['cat', { op: '<<' }, 'EOF', 'hello', 'EOF'],
		'the body is not recognized'
	);

	t.end();
});

test('here documents that strip leading tabs', function (t) {
	t.same(parse('cat <<-EOF'), ['cat', { op: '<<-' }, 'EOF']);
	t.same(parse('cat <<- EOF'), ['cat', { op: '<<-' }, 'EOF']);
	t.same(parse('cat<<-EOF'), ['cat', { op: '<<-' }, 'EOF']);
	t.same(parse('cat <<-\'EOF\''), ['cat', { op: '<<-' }, 'EOF']);
	t.same(parse('cat <<--EOF'), ['cat', { op: '<<-' }, '-EOF']);

	t.same(parse('cat << -EOF'), ['cat', { op: '<<' }, '-EOF'], 'a separated `-` belongs to the delimiter');
	t.same(parse('cat <<\\-EOF'), ['cat', { op: '<<' }, '-EOF'], 'an escaped `-` belongs to the delimiter');
	t.same(parse('cat <<"-EOF"'), ['cat', { op: '<<' }, '-EOF'], 'a quoted `-` belongs to the delimiter');
	t.same(parse('cat \\<\\<- a'), ['cat', '<<-', 'a'], 'escaped');
	t.same(parse('cat "<<-" a'), ['cat', '<<-', 'a'], 'quoted');
	t.same(parse('cat <<<-EOF'), ['cat', { op: '<<<' }, '-EOF'], '`<<<` wins over `<<-`');
	t.same(
		parse('cat <<-(boop)'),
		['cat', { op: '<<-' }, { op: '(' }, 'boop', { op: ')' }],
		'`<<-(` is `<<-` and `(`, as every shell reads it'
	);
	t.same(parse('cat <<-EOF', {}, { escape: '^' }), ['cat', { op: '<<-' }, 'EOF'], 'with a custom escape');
	t.same(parse('cat <<^-EOF', {}, { escape: '^' }), ['cat', { op: '<<' }, '-EOF'], 'escaped with a custom escape');

	t.end();
});

test('glob patterns', function (t) {
	t.same(
		parse('tap test/*.test.js'),
		['tap', { op: 'glob', pattern: 'test/*.test.js' }]
	);

	t.same(parse('tap "test/*.test.js"'), ['tap', 'test/*.test.js']);
	t.end();
});
