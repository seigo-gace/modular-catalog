const t=require('node:test'),a=require('node:assert/strict'),s=require('../../source');t('requires claim binding',()=>a.equal(s.run({worker_id:'w',task_id:'t',evidence:{id:'e'}}).status,'BLOCKED'));
