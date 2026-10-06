const test=require('node:test'),a=require('node:assert/strict'),s=require('../../source');test('extracts critical',()=>a.equal(s.run({issues:[{id:'x',severity:'CRITICAL'}]}).blocking.length,1));
