"use strict";
function run({impact,urgency,policy={}}={}){
  const i=Number(impact),u=Number(urgency);
  const s1=Number(policy.sev1_min),s2=Number(policy.sev2_min),s3=Number(policy.sev3_min);
  if(![i,u,s1,s2,s3].every(Number.isFinite)||i<0||u<0||s1<=s2||s2<=s3||s3<0)
    return {status:"BLOCKED",reason:"INVALID_INPUT"};
  const score=i*u;
  const severity=score>=s1?"SEV1":score>=s2?"SEV2":score>=s3?"SEV3":"SEV4";
  return {status:"PASS",severity,score};
}
module.exports={run};
