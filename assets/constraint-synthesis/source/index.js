"use strict";
function run({requirements=[]}={}){if(!Array.isArray(requirements))return{status:"BLOCKED",constraints:null};const must=[],must_not=[],unknown=[];for(const r of requirements){if(!r||!r.id)continue;const item={id:r.id,value:r.value??r.text??null};if(r.kind==='must'||r.required===true)must.push(item);else if(r.kind==='must_not'||r.prohibited===true)must_not.push(item);else unknown.push(item);}return{status:"PASS",constraints:{must,must_not,unknown}};}
module.exports={run};
