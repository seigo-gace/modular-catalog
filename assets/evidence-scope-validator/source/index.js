"use strict";
function validateEvidenceScope(input={}){
 const claim=input.claim||{}; const evidence=input.evidence||{};
 if(!claim.scope||!evidence.scope) return {status:'BLOCKED',reason:'MISSING_SCOPE'};
 const c=Array.isArray(claim.scope)?claim.scope:[claim.scope]; const e=new Set(Array.isArray(evidence.scope)?evidence.scope:[evidence.scope]);
 const missing=c.filter(x=>!e.has(x));
 return {status:missing.length?'OUT_OF_SCOPE':'PASS',missing_scope:missing};
}
module.exports={validateEvidenceScope};
