"use strict";
function run({requirements=[]}){if(!Array.isArray(requirements))return{status:"BLOCKED",invariants:[]};const out=[];for(const r of requirements){if(!r||!r.id)continue;if(r.must_not_change===true||r.kind==="invariant"||r.required===true)out.push({id:r.id,value:r.value??r.text??null});}return{status:"PASS",invariants:out};}
module.exports={run};
