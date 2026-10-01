const test=require('node:test'),a=require('node:assert/strict'),s=require('../../source');test('find missing',()=>a.deepEqual(s.run({declared:['a'],required:['a','b']}).missing,['b']));
