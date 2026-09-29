"use strict";
function run({nodes=[],edges=[]}){if(!Array.isArray(nodes)||!Array.isArray(edges))return{status:"BLOCKED",graph:{}};const ids=new Set(nodes.map(n=>typeof n==='string'?n:n.id).filter(Boolean)),graph={};for(const id of ids)graph[id]=[];const invalid=[];for(const e of edges){if(!e||!ids.has(e.from)||!ids.has(e.to)){invalid.push(e);continue;}graph[e.from].push(e.to);}for(const k in graph)graph[k]=[...new Set(graph[k])].sort();return{status:invalid.length?'PARTIAL':'PASS',graph,invalid_edges:invalid};}
module.exports={run};
