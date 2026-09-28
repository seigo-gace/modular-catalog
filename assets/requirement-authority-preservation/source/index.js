"use strict";
function run({authority,current}){if(!authority||!current)return{status:'BLOCKED',reason:'MISSING_AUTHORITY'};const immutable=['purpose','prohibitions','success_conditions'];const drift=immutable.filter(k=>JSON.stringify(authority[k]??null)!==JSON.stringify(current[k]??null));return{status:drift.length?'BLOCKED':'PASS',drift};}
module.exports={run};
