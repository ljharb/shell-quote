# shell-quote

Parse and quote shell commands.

[![build status](https://secure.travis-ci.org/substack/node-shell-quote.png)](http://travis-ci.org/substack/node-shell-quote)

# example

## quote

``` js
var quote = require('shell-quote').quote;
var s = quote([ 'a', 'b c d', '$f', '"g"' ]);
console.log(s);
```

output

```
a 'b c d' \$f '"g"'
```

## parse

``` js
var parse = require('shell-quote').parse;
var xs = parse('a "b c" \\$def \'it\\\'s great\'');
console.dir(xs);
```

output

```
[ 'a', 'b c', '\\$def', 'it\'s great' ]
```

## parse with an environment variable

``` js
var parse = require('shell-quote').parse;
var xs = parse('beep --boop="$PWD"', { PWD: '/home/robot' });
console.dir(xs);
```

output

```
[ 'beep', '--boop=/home/robot' ]
```

# methods

``` js
var quote = require('shell-quote').quote;
var parse = require('shell-quote').parse;
```

## quote(args)

Return a quoted string for the array `args` suitable for using in shell
commands.

## parse(cmd, env={})

Return an array of arguments from the quoted string `cmd`.

Interpolate embedded bash-style `$VARNAME` and `${VARNAME}` variables with
the `env` object which like bash will replace undefined variables with `""`.

# install

With [npm](http://npmjs.org) do:

```
npm install shell-quote
```

# license

MIT
