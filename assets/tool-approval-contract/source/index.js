"use strict";
function run({request,allowed_tools=[],requires_approval=[] ,approved=false}){if(!request?.tool)return{status:"BLOCKED",reason:"MISSING_TOOL"};if(!allowed_tools.includes(request.tool))return{status:"REJECT",reason:"TOOL_NOT_ALLOWED"};if(requires_approval.includes(request.tool)&&!approved)return{status:"BLOCKED",reason:"APPROVAL_REQUIRED"};return{status:"PASS",request};}
module.exports={run};
