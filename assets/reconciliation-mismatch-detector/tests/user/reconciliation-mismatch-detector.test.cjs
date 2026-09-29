const assert=require('node:assert/strict'); const {run}=require('../../source/index.js'); assert.equal(run({canonical:{a:{b:1}},provider:{a:{b:1}},fields:['a.b']}).status,'PASS');
