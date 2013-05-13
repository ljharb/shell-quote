exports.quote = function (xs) {
    return xs.map(function (s) {
        if (s && typeof s === 'object') {
            return s.op.replace(/(.)/g, '\\$1');
        }
        else if (/["\s]/.test(s) && !/'/.test(s)) {
            return "'" + s.replace(/(['\\])/g, '\\$1') + "'";
        }
        else if (/["'\s]/.test(s)) {
            return '"' + s.replace(/(["\\$`(){}!#&*|])/g, '\\$1') + '"';
        }
        else {
            return s.replace(/([\\$`(){}!#&*|])/g, '\\$1');
        }
    }).join(' ');
};

var CONTROL = '(?:' + [
    '\\|\\|', '\\&\\&', ';;', '\\|\\&', '[&;()|<>]'
].join('|') + ')';
var META = '|&;()<> \\t';

exports.parse = function parse (s, env) {
    var chunker = new RegExp([
        '([\'"])((\\\\\\1|[^\\1])*?)\\1', // quotes
        '(\\\\[' + META + ']|[^\\s' + META + '])+', // barewords
        '(' + CONTROL + ')' // control chars
    ].join('|'), 'g');
    var match = s.match(chunker);
    if (!match) return [];
    if (!env) env = {};
    return [].concat.apply([], match.map(function (s) {
        if (/^'/.test(s)) {
            return s
                .replace(/^'|'$/g, '')
                .replace(/\\(["'\\$`(){}!#&*|])/g, '$1')
            ;
        }
        else if (/^"/.test(s) && typeof env === 'function') {
            var res = [];
            s = s.replace(/^"|"$/g, '');
            
            var begin = 0, bracket = false;
            for (var i = 0; i < s.length; i++) {
                if (s.charAt(i) !== '$' || s.charAt(i-1) === '\\') continue;
                if (s.charAt(i+1) === '{') {
                    i ++;
                    bracket = true;
                }
                if (/^[*@#?$!0_-]$/.test(s.charAt(i+1))
                && (!bracket || (bracket && s.charAt(i+2) === '}'))) {
                    res.push(s.slice(begin, i));
                    var r = env(s.charAt(i+1));
                    if (typeof r === 'object') res.push(r);
                    else res[res.length-1] += r;
                    i ++;
                    if (bracket) i++;
                    begin = i + 1;
                    continue;
                }
                for (var j=i+1; j < s.length && /\w/.test(s.charAt(j)); j++);
                if (j-(i+1) > 1) {
                    res.push(s.slice(begin, i));
                    var r = env(s.slice(i+1, j));
                    if (typeof r === 'object') res.push(r);
                    else res[res.length-1] += r;
                    begin = j;
                }
            }
            res.push(s.slice(begin));
            return res.map(function (c) {
                if (typeof c === 'object') return c;
                return c.replace(/\\([ "'\\$`(){}!#&*|])/g, '$1');
            });
        }
        else if (/^"/.test(s)) {
            return s.replace(/^"|"$/g, '')
                .replace(/(^|[^\\])\$(\w+|[*@#?$!0_-])/g, getVar)
                .replace(/(^|[^\\])\${(\w+|[*@#?$!0_-])}/g, getVar)
                .replace(/\\([ "'\\$`(){}!#&*|])/g, '$1')
            ;
        }
        else if (RegExp('^' + CONTROL + '$').test(s)) {
            return { op: s };
        }
        else return s.replace(
            /(['"])((\\\1|[^\1])*?)\1|[^'"]+/g,
            function (s, q) {
                if (/^['"]/.test(s)) return parse(s, env);
                return parse('"' + s + '"', env);
            }
        );
    }));
    
    function getVar (_, pre, key) {
        return pre + String(env[key] || '');
    }
};
