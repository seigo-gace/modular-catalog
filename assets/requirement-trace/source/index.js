"use strict";
function run({requirements,artifacts}){if(!Array.isArray(requirements)||!Array.isArray(artifacts))return{status:'BLOCKED',missing:['INPUT']};const covered=new Set(artifacts.flatMap(a=>a.requirement_ids||[]));const missing=requirements.map(r=>r.id).filter(id=>!covered.has(id));return{status:missing.length?'BLOCKED':'PASS',missing};}
module.exports={run};
