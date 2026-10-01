"use strict";
function run({rule,candidates=[]}){if(typeof rule!=='function'||!Array.isArray(candidates))return{status:"BLOCKED",counterexamples:[]};const out=[];for(const c of candidates){try{if(!rule(c))out.push(c);}catch(e){out.push({input:c,error:String(e.message||e)});}}return{status:"PASS",counterexamples:out};}
module.exports={run};
