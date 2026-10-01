"use strict";
function run({worker_id,task_id,claim_id,evidence}){if(!worker_id||!task_id||!claim_id||!evidence?.id)return{status:"BLOCKED",entry:null};return{status:"PASS",entry:{worker_id,task_id,claim_id,evidence_id:evidence.id,digest:evidence.digest||null,kind:evidence.kind||"unknown"}};}
module.exports={run};
