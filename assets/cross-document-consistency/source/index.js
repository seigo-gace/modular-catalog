"use strict";
function run({documents=[]}){if(!Array.isArray(documents))return{status:"BLOCKED",conflicts:[]};const seen=new Map(),conflicts=[];for(const d of documents){for(const [k,v] of Object.entries(d?.facts||{})){if(seen.has(k)&&JSON.stringify(seen.get(k).value)!==JSON.stringify(v))conflicts.push({key:k,a:{doc:seen.get(k).doc,value:seen.get(k).value},b:{doc:d.id,value:v}});else if(!seen.has(k))seen.set(k,{doc:d.id,value:v});}}return{status:conflicts.length?'CONFLICT':'PASS',conflicts};}
module.exports={run};
