"use strict";const test=require('node:test');const a=require('node:assert/strict');const s=require('../../source/index.js');
test('invariants extracted',()=>a.deepEqual(s.extractInvariants({statements:['x','must keep API','禁止: delete']}).invariants,['must keep API','禁止: delete']));
test('negative space finds missing',()=>a.deepEqual(s.findNegativeSpace({required:['a','b'],covered:['a']}).missing,['b']));
test('dependency graph and cycle detection',()=>{const g=s.buildDependencyGraph({edges:[['a','b'],['b','c'],['c','a']]});a.ok(s.detectDependencyCycles({graph:g}).cycles.length>0);});
test('interface boundary fails without owner',()=>a.equal(s.designInterfaceBoundary({inputs:['i'],outputs:['o']}).valid,false));
test('untrusted data to persistent sink is surfaced',()=>a.equal(s.analyzeDataFlow({flows:[{from:'external',to:'persistent',trust:'untrusted'}]}).untrustedToSink.length,1));
test('cross document conflict detected',()=>a.equal(s.checkCrossDocumentConsistency({documents:[{values:{port:1}},{values:{port:2}}],keys:['port']}).status,'CONFLICT'));
test('recovery plan blocks missing verify',()=>a.equal(s.buildFailureRecoveryPlan({failures:[{id:'f',detect:'d',recover:'r'}]}).steps[0].status,'BLOCKED'));
test('risk and rollback fail closed',()=>{a.deepEqual(s.traceRisks({risks:[{id:'r',severity:'critical'}]}).blocking,['r']);a.equal(s.buildRollbackPlan({changes:[{resource:'x',before:'old'}]}).status,'BLOCKED');});
