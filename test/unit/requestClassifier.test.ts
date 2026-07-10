import { test, expect } from '../harness';
import { RequestClassifier } from '../../src/routing/RequestClassifier';

test('RC1 short greeting is classified simple with high confidence', () => {
  const rc = new RequestClassifier();
  const c = rc.classify('Hi there');
  expect(c.complexity === 'simple', `short greeting should be simple, got ${c.complexity}`);
  expect(c.confidence === 0.9, `simple+short should have confidence 0.9, got ${c.confidence}`);
  expect(c.dimensions.tokenCount > 0, 'tokenCount must be computed');
});

test('RC2 code + reasoning + multi-hop is classified complex', () => {
  const rc = new RequestClassifier();
  const prompt =
    'Analyze, evaluate, compare, synthesize and derive the authentication model and api database schema, then implement the function step by step and use search to find the class.';
  const c = rc.classify(prompt);
  expect(c.complexity === 'complex', `code+reasoning+multihop should be complex, got ${c.complexity}`);
  expect(c.dimensions.codePresence === true, 'codePresence should be detected');
  expect(c.dimensions.multiHopRequirements === true, 'multi-hop should be detected');
});

test('RC3 dimensions detect code, json format and security', () => {
  const rc = new RequestClassifier();
  const code = rc.classify('function(' );
  expect(code.dimensions.codePresence === true, 'function( should flag codePresence');

  const json = rc.classify('Return the result as json');
  expect(json.dimensions.outputFormatConstraints.includes('json'), 'json format should be detected');

  const sec = rc.classify('Please encrypt and authenticate the token securely');
  expect(sec.dimensions.securityRequirements > 0, 'security signals should raise securityRequirements');
});

test('RC4 classification shape is always valid', () => {
  const rc = new RequestClassifier();
  for (const p of ['', 'do thing', 'Analyze the very long and complicated distributed system architecture with multiple services and reasoning.']) {
    const c = rc.classify(p);
    expect(['simple', 'medium', 'complex'].includes(c.complexity), `complexity must be valid, got ${c.complexity}`);
    expect(c.confidence >= 0 && c.confidence <= 1, `confidence must be in [0,1], got ${c.confidence}`);
    expect(typeof c.reasoning === 'string', 'reasoning must be a string');
  }
});