"use strict";
function run({before_hash,after_hash,rollback_hash}){if(!before_hash||!after_hash)return{status:"BLOCKED",rollback_ready:false};if(before_hash===after_hash)return{status:"PASS",changed:false,rollback_ready:true};if(!rollback_hash)return{status:"BLOCKED",changed:true,rollback_ready:false,reason:"MISSING_ROLLBACK"};return{status:rollback_hash===before_hash?"PASS":"REJECT",changed:true,rollback_ready:rollback_hash===before_hash};}
module.exports={run};
