"use strict";
function run({claims,evidence}){if(!Array.isArray(claims)||!evidence)return{status:'BLOCKED',unsupported:[]};const unsupported=claims.filter(c=>c.type==='fact'&&!evidence[c.id]).map(c=>c.id);return{status:unsupported.length?'REJECT':'PASS',unsupported};}
module.exports={run};
