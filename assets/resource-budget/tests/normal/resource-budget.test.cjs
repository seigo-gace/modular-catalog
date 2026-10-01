const assert=require('node:assert/strict'); const {run}=require('../../source/index.js'); assert.equal(run({limits:{cpu:2,memory_mb:1024},request:{cpu:1,memory_mb:512}}).status,'ALLOW');
