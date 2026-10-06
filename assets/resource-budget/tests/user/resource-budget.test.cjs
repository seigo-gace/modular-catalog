const assert=require('node:assert/strict'); const {run}=require('../../source/index.js'); assert.equal(run({limits:{restarts:1},request:{restarts:2}}).reason,'RESTARTS_EXCEEDED');
