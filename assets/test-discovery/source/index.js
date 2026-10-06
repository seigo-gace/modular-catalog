"use strict";
function run({changed_files=[],mapping={}}){if(!Array.isArray(changed_files)||!mapping||typeof mapping!=="object")return{status:"BLOCKED",tests:[],uncovered:[]};const tests=new Set(),uncovered=[];for(const f of changed_files){const xs=mapping[f]||[];if(!xs.length)uncovered.push(f);xs.forEach(x=>tests.add(x));}return{status:uncovered.length?"PARTIAL":"PASS",tests:[...tests].sort(),uncovered};}
module.exports={run};
