const assert=require('node:assert/strict'); const {run}=require('../../source/index.js'); const r=run({budget:0,actual:10}); assert.equal(r.variance_pct,null); assert.equal(r.variance,10);
