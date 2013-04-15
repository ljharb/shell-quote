exports.quote = function (xs) {
    return xs.map(function (s) {
        if (/["\s]/.test(s) && !/'/.test(s)) {
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

var re = {
    chunk: /(['"])((\\\1|[^\1])*?)\1|(\\ |\S)+/g
};

exports.parse = function parse (s, env) {
    if (!env) env = {};
    return s.match(re.chunk).map(function (s) {
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
        else return s
            .replace(/(^|[^\\])\$(\w+)/g, getVar)
            .replace(/(^|[^\\])\${(\w+)}/g, getVar)
            .replace(/\\([ "'\\$`(){}!#&*|])/g, '$1')
        ;
    });
    
    function getVar (_, pre, key) {
        return pre + String(env[key] || '');
    }
};
