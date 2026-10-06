"use strict";
function run({declared=[],required=[]}){if(!Array.isArray(declared)||!Array.isArray(required))return{status:"BLOCKED",missing:[]};const d=new Set(declared);const missing=[...new Set(required)].filter(x=>!d.has(x));return{status:"PASS",missing};}
module.exports={run};
