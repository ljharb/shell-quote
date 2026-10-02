'use strict';

/** @import { ControlOperator } from './parse' */

/** @type {ControlOperator['op'][]} */
var OPS = /** @type {const} */ ([
	'||',
	'&&',
	';;',
	'|&',
	'<(',
	'<<<',
	'<<-',
	'<<',
	'>>',
	'>&',
	'>|',
	'<&',
	'<>',
	'&',
	';',
	'(',
	')',
	'|',
	'<',
	'>'
]);
var LINE_TERMINATORS = /[\n\r\u2028\u2029]/;
var GLOB_SHELL_SPECIAL = /[\s#!"$&'():;<=>@\\^`|~]/g;

/** @type {typeof import('./quote')} */
module.exports = function quote(xs) {
	var sawComment = false;
	return xs.map(function (s) {
		if (sawComment && typeof s === 'string' && LINE_TERMINATORS.test(s)) {
			throw new TypeError('a token after a `comment` must not contain line terminators');
		}
		if (s === '') {
			return /** @type {const} */ ('\'\'');
		}
		if (s && typeof s === 'object') {
			if ('op' in s && s.op === 'glob') {
				if (typeof s.pattern !== 'string') {
					throw new TypeError('glob token requires a string `pattern`');
				}
				if (LINE_TERMINATORS.test(s.pattern)) {
					throw new TypeError('glob `pattern` must not contain line terminators');
				}
				if (s.pattern === '') {
					return /** @type {const} */ ('\'\'');
				}
				return s.pattern.replace(GLOB_SHELL_SPECIAL, '\\$&');
			}
			if ('op' in s && typeof s.op === 'string') {
				if (OPS.indexOf(s.op) < 0) {
					throw new TypeError('invalid `op` value: ' + JSON.stringify(s.op));
				}
				return s.op.replace(/[\s\S]/g, '\\$&');
			}
			if ('comment' in s && typeof s.comment === 'string') {
				if (LINE_TERMINATORS.test(s.comment)) {
					throw new TypeError('`comment` must not contain line terminators');
				}
				sawComment = true;
				return '#' + s.comment;
			}
			throw new TypeError('unrecognized object token shape');
		}
		if ((/'/).test(s) && (/!/).test(s)) {
			return "'" + s.replace(/'/g, "'\"'\"'") + "'";
		}
		if ((/["\s\\]/).test(s) && !(/'/).test(s)) {
			return "'" + s + "'";
		}
		if ((/["'\s]/).test(s)) {
			return '"' + s.replace(/(["\\$`])/g, '\\$1') + '"';
		}
		return String(s).replace(/([A-Za-z]:)?([#!"$&'()*,:;<=>?@[\\\]^`{|}~])/g, '$1\\$2');
	}).join(' ');
};
