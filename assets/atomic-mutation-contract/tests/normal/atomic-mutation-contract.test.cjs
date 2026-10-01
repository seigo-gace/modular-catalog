const assert=require('node:assert/strict'); const {run}=require('../../source/index.js'); assert.equal(run({target:'x',expected_before:1,after:2,rollback:'set 1',approval_ref:'a1'}).status,'READY');
