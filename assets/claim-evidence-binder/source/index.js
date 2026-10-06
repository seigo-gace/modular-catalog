"use strict";
function bindClaimEvidence(input={}){
 const claim=input.claim||{}; const evidence=Array.isArray(input.evidence)?input.evidence:[];
 if(!claim.id) return {status:'BLOCKED',reason:'MISSING_CLAIM_ID'};
 const refs=evidence.filter(e=>Array.isArray(e.claim_ids)&&e.claim_ids.includes(claim.id)&&e.source_id).map(e=>e.source_id);
 const counters=evidence.filter(e=>Array.isArray(e.counter_claim_ids)&&e.counter_claim_ids.includes(claim.id)&&e.source_id).map(e=>e.source_id);
 return {status:refs.length?'READY':'UNSUPPORTED',claim_id:claim.id,evidence_refs:[...new Set(refs)],counter_evidence_refs:[...new Set(counters)]};
}
module.exports={bindClaimEvidence};
