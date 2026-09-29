const assert=require('node:assert/strict'); const {run}=require('../../source/index.js'); const r=run({budget:100,actual:120}); assert.equal(r.variance,20); assert.equal(r.variance_pct,20);
