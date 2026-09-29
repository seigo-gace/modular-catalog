const assert=require('node:assert/strict'); const {run}=require('../../source/index.js'); const r=run({requirements:[{id:'u',text:'unclear'}]}); assert.equal(r.constraints.unknown[0].id,'u');
