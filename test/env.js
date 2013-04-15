var test = require('tap').test;
var parse = require('../').parse;

test('expand environment variables', function (t) {
    t.same(parse('a $XYZ c', { XYZ: 'b' }), [ 'a', 'b', 'c' ]);
    t.same(parse('a${XYZ}c', { XYZ: 'b' }), [ 'abc' ]);
    t.same(parse('a${XYZ}c $XYZ', { XYZ: 'b' }), [ 'abcb b' ]);
    t.same(parse('"_$X-$Y_"', { X: 'a', Y: 'b' }), [ '_a-b_' ]);
    t.same(parse("'_$X-$Y_'", { X: 'a', Y: 'b' }), [ '_$X-$Y_' ]);
    t.same(parse('qrs"$zzz"wxy', { zzz: 'tuv' }), [ 'qrstuvwxy' ]);
    t.same(parse("qrs'$zzz'wxy", { zzz: 'tuv' }), [ 'qrs$zzzwxy' ]);
    t.same(parse("qrs${zzz}wxy"), [ 'qrswxy' ]);
    t.same(parse("ab$x", { x: 'c' }), [ 'abc' ]);
    t.same(parse("ab\\$x", { x: 'c' }), [ 'ab$x' ]);
    t.same(parse("ab${x}def", { x: 'c' }), [ 'abcdef' ]);
    t.same(parse("ab\\${x}def", { x: 'c' }), [ 'ab${x}def' ]);
    
    t.end();
});
