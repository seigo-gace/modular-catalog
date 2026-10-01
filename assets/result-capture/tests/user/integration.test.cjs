const t=require('node:test'),a=require('node:assert/strict'),s=require('../../source');t('does not invent missing timing',()=>a.equal(s.run({task_id:'t',tool:'x',exit_code:0}).status,'BLOCKED'));
