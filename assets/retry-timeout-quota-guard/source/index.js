"use strict";
function run({attempt,max_attempts,elapsed_ms,timeout_ms,remaining_quota}){if([attempt,max_attempts,elapsed_ms,timeout_ms,remaining_quota].some(v=>typeof v!=='number'))return{status:'BLOCKED',action:'STOP'};if(remaining_quota<=0)return{status:'BLOCKED',action:'STOP_QUOTA'};if(elapsed_ms>=timeout_ms)return{status:'BLOCKED',action:'STOP_TIMEOUT'};if(attempt>=max_attempts)return{status:'BLOCKED',action:'STOP_RETRY'};return{status:'PASS',action:'RETRY_ALLOWED'};}
module.exports={run};
