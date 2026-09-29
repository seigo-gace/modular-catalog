"use strict";
function run({command,network="deny",filesystem="workspace",limits={}}){if(!command)return{status:"BLOCKED",reason:"MISSING_COMMAND"};if(network!=="deny")return{status:"REJECT",reason:"NETWORK_NOT_DENIED"};if(filesystem!=="workspace")return{status:"REJECT",reason:"FILESYSTEM_SCOPE"};if(!(limits.timeout_ms>0)||!(limits.memory_mb>0))return{status:"BLOCKED",reason:"LIMITS_REQUIRED"};return{status:"PASS",execution:{command,network,filesystem,limits}};}
module.exports={run};
