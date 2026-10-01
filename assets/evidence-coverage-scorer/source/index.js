"use strict";
function scoreEvidenceCoverage(input={}){
 const claims=Array.isArray(input.claims)?input.claims:[]; const evidence=Array.isArray(input.evidence)?input.evidence:[];
 if(!claims.length) return {status:'BLOCKED',reason:'NO_CLAIMS',covered:0,total:0,score:null,missing_claim_ids:[]};
 const ids=new Set(evidence.flatMap(e=>Array.isArray(e.claim_ids)?e.claim_ids:[]));
 const missing=claims.map(c=>c&&c.id).filter(Boolean).filter(id=>!ids.has(id));
 const covered=claims.filter(c=>c&&c.id&&ids.has(c.id)).length;
 return {status:'READY',covered,total:claims.length,score:covered/claims.length,missing_claim_ids:missing,complete:covered===claims.length};
}
module.exports={scoreEvidenceCoverage};
