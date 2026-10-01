"use strict";
function rank(x){return ({master:1,notion_authority:2,notion_spec:3,code_contract:4,runtime:5,github:6,readme:7,chat:8})[x]||99}function run({claims}){if(!Array.isArray(claims)||!claims.length)return{status:'BLOCKED',selected:null};const s=[...claims].sort((a,b)=>rank(a.source_type)-rank(b.source_type))[0];return{status:'PASS',selected:s};}
module.exports={run};
