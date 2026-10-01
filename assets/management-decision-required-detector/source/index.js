"use strict";
function run({records=[]}={}){
  if(!Array.isArray(records)) return {status:"BLOCKED",decisions:[],reason:"INVALID_RECORDS"};
  const decisions=[];
  for(const r of records){
    if(!r||!r.id) continue;
    const reasons=[];
    if(r.decision_required===true) reasons.push("EXPLICIT_DECISION_REQUIRED");
    if(r.blocking===true) reasons.push("BLOCKING");
    if(r.escalation==="management") reasons.push("MANAGEMENT_ESCALATION");
    if(["HIGH","CRITICAL"].includes(r.risk)&&r.requires_human_decision===true) reasons.push("HIGH_RISK_HUMAN_DECISION");
    if(reasons.length) decisions.push({id:r.id,reasons});
  }
  return {status:"PASS",decisions};
}
module.exports={run};
