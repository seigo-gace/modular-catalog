const assert=require('node:assert/strict'); const {run}=require('../../source/index.js'); assert.equal(run({claim:{id:'c1',text:'x'},scopes:['official']}).requests.length,1);
