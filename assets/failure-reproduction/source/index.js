"use strict";
function run({attempts=[]}){if(!Array.isArray(attempts)||!attempts.length)return{status:"BLOCKED",signature:null};const failures=attempts.filter(a=>a.executed===true&&a.failed===true&&a.signature);if(!failures.length)return{status:"NOT_REPRODUCED",signature:null};const counts=new Map();for(const f of failures)counts.set(f.signature,(counts.get(f.signature)||0)+1);const [signature,count]=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];return{status:count>=2?"PASS":"PARTIAL",signature,count,total:attempts.length};}
module.exports={run};
