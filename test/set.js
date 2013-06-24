var test = require('tape');
var parse = require('../').parse;

test('set env vars', function (t) {
    t.same(
        parse('ABC=444 x y z'),
        [ { key: 'X', value: '444' }, 'x', 'y', 'z' ]
    );
    t.same(
        parse('ABC=3\\ 4\\ 5 x y z'),
        [ { key: 'X', value: '3 4 5' }, 'x', 'y', 'z' ]
    );
    t.same(
        parse('X="7 8 9" printx'),
        [ { key: 'X', value: '7 8 9' }, 'printx' ]
    );
    
    t.end();
});
