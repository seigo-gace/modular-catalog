"use strict";
function run({action,risk,capability,policy={}}={}){
  if(!action||!risk||!capability||!Array.isArray(policy.routes)) return {status:"BLOCKED",route:null,reason:"INVALID_INPUT"};
  const matches=policy.routes.filter(r=>r&&
    (!r.actions||r.actions.includes(action)) &&
    (!r.risks||r.risks.includes(risk)) &&
    (!r.capabilities||r.capabilities.includes(capability)));
  if(matches.length!==1) return {status:"BLOCKED",route:null,reason:matches.length?"AMBIGUOUS_ROUTE":"NO_ROUTE"};
  return {status:"PASS",route:matches[0].route};
}
module.exports={run};
