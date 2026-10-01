const test=require('node:test'),a=require('node:assert/strict'),s=require('../../source'); test('empty list blocks',()=>a.equal(s.rankSources({sources:[]}).status,'BLOCKED'));
