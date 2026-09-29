"use strict";
function run({baseline,observed}){if(!baseline||observed===undefined)return{status:"BLOCKED",reproduced:false,reason:"MISSING_BASELINE_OR_OBSERVATION"};const reproduced=JSON.stringify(baseline.expected_failure)===JSON.stringify(observed.failure);return{status:reproduced?"PASS":"BLOCKED",reproduced,expected:baseline.expected_failure,observed:observed.failure};}
module.exports={run};
