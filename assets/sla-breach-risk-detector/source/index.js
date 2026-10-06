"use strict";
function run({due_at,now_at,status="OPEN",policy={}}={}){
  if(status==="DONE") return {status:"PASS",risk:"CLOSED",hours_remaining:null};
  const due=Date.parse(due_at||""),now=Date.parse(now_at||"");
  const critical=Number(policy.critical_hours),warning=Number(policy.warning_hours);
  if(Number.isNaN(due)||Number.isNaN(now)||!Number.isFinite(critical)||!Number.isFinite(warning)||critical<0||warning<critical)
    return {status:"BLOCKED",reason:"INVALID_INPUT"};
  const hours=(due-now)/3600000;
  const risk=hours<0?"BREACHED":hours<=critical?"CRITICAL":hours<=warning?"AT_RISK":"OK";
  return {status:"PASS",risk,hours_remaining:hours};
}
module.exports={run};
