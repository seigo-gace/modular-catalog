"use strict";
const test=require('node:test'),a=require('node:assert/strict'),{run}=require('../../source/index.js');test('sizes instances by utilization target',()=>{const r=run({demandPerMinute:120,capacityPerInstancePerMinute:100,targetUtilization:.75});a.equal(r.instances,2);a.equal(r.headroom,80);});
