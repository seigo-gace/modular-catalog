"use strict";
function run({claims=[],requirements=[],evidence={}}){if(!Array.isArray(claims)||!Array.isArray(requirements)||typeof evidence!=='object')return{status:'BLOCKED',issues:[]};const issues=[];for(const r of requirements)if(!claims.some(c=>c.requirement_id===r.id))issues.push({type:'MISSING_REQUIREMENT',id:r.id});for(const c of claims)if(c.kind==='fact'&&!evidence[c.id])issues.push({type:'UNSUPPORTED_CLAIM',id:c.id});return{status:issues.length?'REVISE':'PASS',issues};}
module.exports={run};
