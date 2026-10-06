const test=require('node:test'),a=require('node:assert/strict'),s=require('../../source');test('generates',()=>a.deepEqual(s.run({rule:x=>x>0,candidates:[1,0,-1]}).counterexamples,[0,-1]));
