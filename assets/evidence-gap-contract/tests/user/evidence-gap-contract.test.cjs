const assert=require('node:assert/strict'); const {run}=require('../../source/index.js'); assert.equal(run({claim_id:'c',searches:[{status:'NOT_FOUND'}]}).gap.state,'NOT_FOUND_NOT_ABSENCE');
