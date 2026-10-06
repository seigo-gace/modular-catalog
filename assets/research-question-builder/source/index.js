"use strict";
function buildResearchQuestions(input={}){
 const unknowns=Array.isArray(input.unknowns)?input.unknowns:[];
 const scope=String(input.scope||'').trim();
 if(!unknowns.length) return {status:'BLOCKED',reason:'NO_UNKNOWNS',questions:[]};
 const questions=unknowns.filter(x=>x&&x.id&&x.text).map((x,i)=>({question_id:`rq${i+1}`,unknown_id:x.id,question:`${x.text}${scope?` [scope:${scope}]`:''}`,evidence_required:x.evidence_required!==false}));
 return questions.length?{status:'READY',questions}:{status:'BLOCKED',reason:'INVALID_UNKNOWNS',questions:[]};
}
module.exports={buildResearchQuestions};
