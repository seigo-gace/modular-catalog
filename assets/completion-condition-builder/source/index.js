"use strict";
function run({conditions,evidence}){if(!Array.isArray(conditions)||!evidence)return{status:'BLOCKED',unmet:['INPUT']};const unmet=conditions.filter(c=>!evidence[c.id]).map(c=>c.id);return{status:unmet.length?'INCOMPLETE':'COMPLETE',unmet};}
module.exports={run};
