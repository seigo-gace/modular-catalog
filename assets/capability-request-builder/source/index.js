"use strict";
function run({task_id,needed,reason,evidence_required=[]}){if(!task_id||!Array.isArray(needed)||!needed.length||!reason)return{status:'BLOCKED',request:null};return{status:'PASS',request:{task_id,needed:[...new Set(needed)].sort(),reason,evidence_required:[...new Set(evidence_required)].sort()}};}
module.exports={run};
