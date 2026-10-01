"use strict";
function run({budget,actual}={}){
  const b=Number(budget),a=Number(actual);
  if(!Number.isFinite(b)||!Number.isFinite(a)||b<0||a<0) return {status:"BLOCKED",reason:"INVALID_AMOUNT"};
  const variance=a-b;
  const variance_pct=b===0?(a===0?0:null):(variance/b)*100;
  return {status:"PASS",budget:b,actual:a,variance,variance_pct};
}
module.exports={run};
