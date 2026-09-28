"use strict";
function run({text,protected_patterns=[]}){text=String(text||'');const hits=[];if(/(?:api[_-]?key|secret|token)s*[:=]s*[^s]+/i.test(text))hits.push('SECRET_PATTERN');for(const p of protected_patterns)if(text.includes(p))hits.push('PROTECTED_RESOURCE');return{status:hits.length?'REJECT':'PASS',hits:[...new Set(hits)]};}
module.exports={run};
