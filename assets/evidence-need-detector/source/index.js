"use strict";
function run({claims}){if(!Array.isArray(claims))return{status:'BLOCKED',needs:[]};const needs=claims.filter(c=>c.type!=='opinion'&&!c.evidence_ref).map(c=>c.id);return{status:'PASS',needs};}
module.exports={run};
