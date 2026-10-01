"use strict";
function run({claims=[]}){if(!Array.isArray(claims))return{status:"BLOCKED",contradictions:[]};const by=new Map(),out=[];for(const c of claims){if(!c||!c.subject||!c.predicate)continue;const k=c.subject+'|'+c.predicate;if(by.has(k)&&JSON.stringify(by.get(k).value)!==JSON.stringify(c.value))out.push({a:by.get(k).id,b:c.id,key:k});else if(!by.has(k))by.set(k,c);}return{status:out.length?'CONTRADICTION':'PASS',contradictions:out};}
module.exports={run};
