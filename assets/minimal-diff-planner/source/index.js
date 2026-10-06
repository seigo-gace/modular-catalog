"use strict";
function run({required_changes=[],candidate_changes=[]}){if(!Array.isArray(required_changes)||!Array.isArray(candidate_changes))return{status:"BLOCKED",selected:[],excess:[]};const req=new Set(required_changes.map(x=>x.file+":"+(x.symbol||"")));const selected=[],excess=[];for(const c of candidate_changes){const k=c.file+":"+(c.symbol||"");(req.has(k)?selected:excess).push(c);}const missing=[...req].filter(k=>!selected.some(c=>c.file+":"+(c.symbol||"")===k));return{status:missing.length||excess.length?"REVIEW":"PASS",selected,excess,missing};}
module.exports={run};
