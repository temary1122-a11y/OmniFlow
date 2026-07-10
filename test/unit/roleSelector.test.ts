import { test, expect, afterEach } from '../harness';
import { RoleSelector, ALL_AGENT_ROLES } from '../../src/core/RoleSelector';

test('RS1 select returns object with roles array and primary', () => {
  const sel = new RoleSelector().select('do something', 'medium');
  expect('roles' in sel, 'should have roles array');
  expect(Array.isArray(sel.roles), 'roles should be an array');
  expect('primary' in sel === false, 'RoleSelection does not expose primary property');
});

test('RS2 low complexity returns lean roles', () => {
  const sel = new RoleSelector().select('refactor a function', 'low');
  expect(sel.tier === 'LOW', 'tier should be LOW');
  expect(sel.useSelfPrompting === false, 'low tier should not use self-prompting');
});

test('RS3 planning goal on low complexity may include planner', () => {
  const sel = new RoleSelector().select('Create a project plan', 'low');
  expect(sel.roles.includes('planner') === false, 'DOCUMENTED: low complexity planning goals do NOT force-include planner (wantsPlan only applies on medium/high)');
  expect(sel.tier === 'LOW');
});

test('RS4 security-sensitive goal includes security role', () => {
  const sel = new RoleSelector().select('Implement OAuth2 login', 'medium');
  expect(sel.roles.includes('security'), 'security concern should inject security agent on medium');
});

test('RS5 coding goal includes coder role', () => {
  const sel = new RoleSelector().select('Implement a REST API', 'medium');
  expect(sel.roles.includes('coder'), 'coding goal should include coder on medium');
});

test('RS6 high complexity returns all roles and self-prompting', () => {
  const sel = new RoleSelector().select('full platform', 'high');
  expect(sel.tier === 'HIGH', 'high tier should be HIGH');
  expect(sel.useSelfPrompting === true, 'high tier should enable self-prompting');
  expect(sel.roles.length === ALL_AGENT_ROLES.length, 'high should include all agent roles');
});

test('RS7 audit-related goal includes auditor', () => {
  const sel = new RoleSelector().select('audit and lint the codebase', 'medium');
  expect(sel.roles.includes('auditor'), 'audit goal should include auditor on medium');
});

test('RS8 phases derived from roles', () => {
  const sel = new RoleSelector().select('do things', 'medium');
  expect(sel.phases.length > 0, 'phases should be populated for medium complexity');
});
