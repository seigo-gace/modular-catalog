"use strict";
function run({fragments,max_items=50}){if(!Array.isArray(fragments)||!Number.isInteger(max_items)||max_items<1)return{status:'BLOCKED',context:[]};const by=new Map();for(const f of fragments){if(!f||!f.id||f.value===undefined)continue;const prev=by.get(f.id);if(!prev||(f.priority??99)<(prev.priority??99))by.set(f.id,f);}return{status:'PASS',context:[...by.values()].sort((a,b)=>(a.priority??99)-(b.priority??99)).slice(0,max_items)};}
module.exports={run};
