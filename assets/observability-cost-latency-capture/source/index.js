"use strict";
function run({worker_id,task_id,model,calls,tokens_in,tokens_out,latency_ms,cost=0}){const nums=[calls,tokens_in,tokens_out,latency_ms,cost];if(!worker_id||!task_id||nums.some(v=>typeof v!=='number'||v<0))return{status:'BLOCKED',record:null};return{status:'PASS',record:{worker_id,task_id,model:model||null,calls,tokens_in,tokens_out,latency_ms,cost}};}
module.exports={run};
