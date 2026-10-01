const test=require('node:test'),a=require('node:assert/strict'),s=require('../../source'); test('empty unknowns block',()=>a.equal(s.buildResearchQuestions({unknowns:[]}).status,'BLOCKED'));
