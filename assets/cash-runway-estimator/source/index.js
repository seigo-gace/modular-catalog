"use strict";
function run({cash,monthly_net_burn}={}){
  const c=Number(cash),b=Number(monthly_net_burn);
  if(!Number.isFinite(c)||!Number.isFinite(b)||c<0) return {status:"BLOCKED",reason:"INVALID_INPUT"};
  if(b<=0) return {status:"PASS",runway_months:null,state:"NON_BURNING"};
  return {status:"PASS",runway_months:c/b,state:c===0?"NO_RUNWAY":"BURNING"};
}
module.exports={run};
