"use strict";
function run({due_at,now_at,policy={}}={}){
  const due=Date.parse(due_at||""), now=Date.parse(now_at||"");
  const critical=Number(policy.critical_hours), soon=Number(policy.soon_hours);
  if(Number.isNaN(due)||Number.isNaN(now)||!Number.isFinite(critical)||!Number.isFinite(soon)||critical<0||soon<critical)
    return {status:"BLOCKED",reason:"INVALID_INPUT"};
  const hours=(due-now)/3600000;
  const urgency=hours<0?"OVERDUE":hours<=critical?"CRITICAL":hours<=soon?"SOON":"NORMAL";
  return {status:"PASS",urgency,hours_remaining:hours};
}
module.exports={run};
