"use strict";
const test=require('node:test'),a=require('node:assert/strict'),{run}=require('../../source/index.js');test('stack evidence dominates changed-file hint',()=>{const r=run({stack:[{file:'src/a.js'}],changedFiles:['src/b.js']});a.equal(r.locations[0].file,'src/a.js');});
