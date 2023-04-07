'use strict';

// '<(' is process substitution operator and
// can be parsed the same as control operator
var CONTROL = '(?:' + [
	'\\|\\|',
	'\\&\\&',
	';;',
	'\\|\\&',
	'\\<\\(',
	'\\<\\<\\<',
	'>>',
	'>\\&',
	'<\\&',
	'[&;()|<>]'
].join('|') + ')';
var controlRE = new RegExp('^' + CONTROL + '$');
var META = '|&;()<> \\t';
var SINGLE_QUOTE = '"((\\\\"|[^"])*?)"';
var DOUBLE_QUOTE = '\'((\\\\\'|[^\'])*?)\'';
var hash = /^#$/;

var SQ = "'";
var DQ = '"';
var DS = '$';

var TOKEN = '';
var mult = 0x100000000; // Math.pow(16, 8);
for (var i = 0; i < 4; i++) {
	TOKEN += (mult * Math.random()).toString(16);
}
var startsWithToken = new RegExp('^' + TOKEN);

function parseInternal(s, env, opts) {
	if (!opts) {
		opts = {};
	}
	var BS = opts.escape || '\\';
	var BAREWORD = '(\\' + BS + '[\'"' + META + ']|[^\\s\'"' + META + '])+';

	var chunker = new RegExp([
		'(' + CONTROL + ')', // control chars
		'(' + BAREWORD + '|' + SINGLE_QUOTE + '|' + DOUBLE_QUOTE + ')+'
	].join('|'), 'g');

	var matches = s.match(chunker);

	if (!matches) {
		return [];
	}
	if (!env) {
		env = {};
	}

	var commented = false;

	function getVar(_, pre, key) {
		var r = typeof env === 'function' ? env(key) : env[key];
		if (r === undefined && key != '') {
			r = '';
		} else if (r === undefined) {
			r = '$';
		}

		if (typeof r === 'object') {
			return pre + TOKEN + JSON.stringify(r) + TOKEN;
		}
		return pre + r;
	}

	return matches.filter(Boolean).map(function (s, j, match) {
		if (commented) {
			return void undefined;
		}
		if (controlRE.test(s)) {
			return { op: s };
		}

		// Hand-written scanner/parser for Bash quoting rules:
		//
		// 1. inside single quotes, all characters are printed literally.
		// 2. inside double quotes, all characters are printed literally
		//    except variables prefixed by '$' and backslashes followed by
		//    either a double quote or another backslash.
		// 3. outside of any quotes, backslashes are treated as escape
		//    characters and not printed (unless they are themselves escaped)
		// 4. quote context can switch mid-token if there is no whitespace
		//     between the two quote contexts (e.g. all'one'"token" parses as
		//     "allonetoken")
		var quote = false;
		var esc = false;
		var out = '';
		var isGlob = false;
		var i;

		function parseEnvVar() {
			i += 1;
			var varend;
			var varname;
			// debugger
			if (s.charAt(i) === '{') {
				i += 1;
				if (s.charAt(i) === '}') {
					throw new Error('Bad substitution: ' + s.substr(i - 2, 3));
				}
				varend = s.indexOf('}', i);
				if (varend < 0) {
					throw new Error('Bad substitution: ' + s.substr(i));
				}
				varname = s.substr(i, varend - i);
				i = varend;
			} else if ((/[*@#?$!_-]/).test(s.charAt(i))) {
				varname = s.charAt(i);
				i += 1;
			} else {
				varend = s.substr(i).match(/[^\w\d_]/);
				if (!varend) {
					varname = s.substr(i);
					i = s.length;
				} else {
					varname = s.substr(i, varend.index);
					i += varend.index - 1;
				}
			}
			return getVar(null, '', varname);
		}

		for (i = 0; i < s.length; i++) {
			var c = s.charAt(i);
			isGlob = isGlob || (!quote && (c === '*' || c === '?'));
			if (esc) {
				out += c;
				esc = false;
			} else if (quote) {
				if (c === quote) {
					quote = false;
				} else if (quote == SQ) {
					out += c;
				} else { // Double quote
					if (c === BS) {
						i += 1;
						c = s.charAt(i);
						if (c === DQ || c === BS || c === DS) {
							out += c;
						} else {
							out += BS + c;
						}
					} else if (c === DS) {
						out += parseEnvVar();
					} else {
						out += c;
					}
				}
			} else if (c === DQ || c === SQ) {
				quote = c;
			} else if (controlRE.test(c)) {
				return { op: s };
			} else if (hash.test(c)) {
				commented = true;
				var commentObj = { comment: s.slice(i + 1) + match.slice(j + 1).join(' ') };
				if (out.length) {
					return [out, commentObj];
				}
				return [commentObj];
			} else if (c === BS) {
				esc = true;
			} else if (c === DS) {
				out += parseEnvVar();
			} else {
				out += c;
			}
		}

		if (isGlob) {
			return { op: 'glob', pattern: out };
		}

		return out;
	}).reduce(function (prev, arg) { // finalize parsed arguments
		return typeof arg === 'undefined' ? prev : prev.concat(arg);
	}, []);
}

module.exports = function parse(s, env, opts) {
	var mapped = parseInternal(s, env, opts);
	if (typeof env !== 'function') {
		return mapped;
	}
	return mapped.reduce(function (acc, s) {
		if (typeof s === 'object') {
			return acc.concat(s);
		}
		var xs = s.split(RegExp('(' + TOKEN + '.*?' + TOKEN + ')', 'g'));
		if (xs.length === 1) {
			return acc.concat(xs[0]);
		}
		return acc.concat(xs.filter(Boolean).map(function (x) {
			if (startsWithToken.test(x)) {
				return JSON.parse(x.split(TOKEN)[1]);
			}
			return x;
		}));
	}, []);
};
