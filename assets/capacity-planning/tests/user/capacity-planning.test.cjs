"use strict";
const test=require('node:test'),a=require('node:assert/strict'),{run}=require('../../source/index.js');test('blocks impossible capacity',()=>{a.equal(run({demandPerMinute:10,capacityPerInstancePerMinute:0}).status,'BLOCKED');});
