const test=require('node:test'),a=require('node:assert/strict'),s=require('../../source');test('build graph',()=>a.deepEqual(s.run({nodes:['a','b'],edges:[{from:'a',to:'b'}]}).graph,{a:['b'],b:[]}));
