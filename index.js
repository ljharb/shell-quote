exports.quote = function (xs) {
    return xs.map(function (s) {
        if (s && typeof s === 'object') {
            return s.op;
        }
        // Enclose strings with metacharacters in single quoted,
        // and escape any single quotes.
        // Match strictly to avoid escaping things that don't need to be.
        // bash: |  & ; ( ) < > space tab
        // Also escapes bash curly brace ranges {a..b} {a..z..3} {1..20} {a,b} but not
        // {a...b} or {..a}
        if ((/(?:["\\$`!\s|&;\(\)<>]|{[\d]+\.{2}[\d]+(?:\.\.\d+)?}|{[a-zA-Z].{2}[a-zA-Z](?:\.\.\d+)?}|{[^{]*,[^}]*})/m).test(s)) {
            // If input contains outer single quote, escape each of them individually.
            // eg. 'a b c' -> \''a b c'\'
            var outer_quotes = s.match(/^('*)(.*?)('*)$/s);

            // the starting outer quotes individually escaped
            return String(outer_quotes[1]).replace(/(.)/g, '\\$1') +
                // the text inside the outer single quotes is single quoted
                "'" + outer_quotes[2].replace(/'/g, '\'\\\'\'') + "'" +
                // the ending outer quotes individually escaped
                String(outer_quotes[3]).replace(/(.)/g, '\\$1');
        }
        // Only escape the single quotes in strings without metachars or
        // separators
        return String(s).replace(/(')/g, '\\$1');
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
    return match.map(function (s) {
        if (/^'/.test(s)) {
            return s
                .replace(/^'|'$/g, '')
                .replace(/\\(["'\\$`(){}!#&*|])/g, '$1')
            ;
        }
        else if (/^"/.test(s)) {
            return s
                .replace(/^"|"$/g, '')
                .replace(/(^|[^\\])\$(\w+)/g, getVar)
                .replace(/(^|[^\\])\${(\w+)}/g, getVar)
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
    });
    
    function getVar (_, pre, key) {
        return pre + String(env[key] || '');
    }
};
