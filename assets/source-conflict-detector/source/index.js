"use strict";
function detectSourceConflicts(input={}){
 const xs=Array.isArray(input.claims)?input.claims:[];
 const by=new Map();
 for(const c of xs){ if(!c||!c.key||c.value===undefined||!c.source_id) continue; const arr=by.get(c.key)||[]; arr.push(c); by.set(c.key,arr); }
 const conflicts=[];
 for(const [key,arr] of by){ const vals=[...new Set(arr.map(x=>JSON.stringify(x.value)))]; if(vals.length>1) conflicts.push({key,source_ids:[...new Set(arr.map(x=>x.source_id))],values:arr.map(x=>x.value)}); }
 return {status:'READY',conflicts,has_conflict:conflicts.length>0};
}
module.exports={detectSourceConflicts};
