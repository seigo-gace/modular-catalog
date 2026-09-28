"use strict";
function run({unknowns=[],blocking=[]}){const reasons=[...unknowns.map(x=>'UNKNOWN:'+x),...blocking.map(x=>'BLOCK:'+x)];return{status:reasons.length?'BLOCKED':'PASS',reasons};}
module.exports={run};
