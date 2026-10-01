"use strict";
function run({value,required=[]}){if(value===null||typeof value!=='object'||Array.isArray(value))return{status:'BLOCKED',missing:required};const missing=required.filter(k=>!(k in value));return{status:missing.length?'BLOCKED':'PASS',missing};}
module.exports={run};
