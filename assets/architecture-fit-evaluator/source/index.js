"use strict";
function run({candidate={},required=[],forbidden=[]}={}){if(!candidate||typeof candidate!=="object"||!Array.isArray(required)||!Array.isArray(forbidden))return{status:"BLOCKED",reason:"INVALID_INPUT"};const caps=new Set(Array.isArray(candidate.capabilities)?candidate.capabilities:[]);const traits=new Set(Array.isArray(candidate.traits)?candidate.traits:[]);const missing=required.filter(x=>!caps.has(x));const violations=forbidden.filter(x=>traits.has(x));return{status:missing.length||violations.length?"REJECT":"PASS",missing,violations};}
module.exports={run};
