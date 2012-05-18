var test = require('tap').test;
var parse = require('../').parse;

test('parse shell commands', function (t) {
    t.same(parse('a \'b\' "c"'), [ 'a', 'b', 'c' ]);
    
    t.same(
        parse('beep "boop" \'foo bar baz\' "it\'s \\"so\\" groovy"'),
        [ 'beep', 'boop', 'foo bar baz', 'it\'s "so" groovy' ]
    );
    t.end();
});
