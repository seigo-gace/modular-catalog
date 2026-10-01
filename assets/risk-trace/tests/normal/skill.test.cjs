const test=require('node:test'),a=require('node:assert/strict'),s=require('../../source');test('critical blocks',()=>a.equal(s.run({risks:[{id:'r',impact:4,likelihood:4}]}).status,'BLOCKED'));
