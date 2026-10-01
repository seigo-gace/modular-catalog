"use strict";
function run({action={},policy={}}={}){
  if(!action||typeof action!=="object"||!Array.isArray(action.flags)||!Array.isArray(policy.high_risk_flags)||!Array.isArray(policy.medium_risk_flags))
    return {status:"BLOCKED",risk:null,reason:"INVALID_INPUT"};
  const flags=[...new Set(action.flags)];
  const high=flags.filter(x=>policy.high_risk_flags.includes(x));
  const medium=flags.filter(x=>policy.medium_risk_flags.includes(x));
  const risk=high.length?"HIGH":medium.length?"MEDIUM":"LOW";
  return {status:"PASS",risk,matched:{high,medium},requires_approval:risk==="HIGH"||policy.approve_medium===true&&risk==="MEDIUM"};
}
module.exports={run};
