import { test, expect } from '../harness';
import { AgentConsultant } from '../../src/core/AgentConsultant';

function fakeEventBus() {
  const events: Array<{ type: string; payload?: unknown }> = [];
  return {
    events,
    emit: (e: { type: string; payload?: unknown }) => { events.push(e); },
  };
}

const researcher = {
  respondToPrompt: async () => ({ content: 'RESEARCH-ANSWER' }),
};

const callLlm = async () => ({ content: 'LLM-FALLBACK' });
const getApiKeys = () => ({ openai: 'k' });

test('AC1 agent with respondToPrompt is consulted directly', async () => {
  const bus = fakeEventBus();
  const c = new AgentConsultant({ researcher }, callLlm, getApiKeys, bus as any);
  const ans = await c.consult('researcher', 'what lib?', 'coder');
  expect(ans === 'RESEARCH-ANSWER', 'should return agent response');
  const consultEvents = bus.events.filter((e) => e.type === 'AGENT_CONSULT');
  expect(consultEvents.length === 2, 'should emit AGENT_CONSULT twice');
  expect((consultEvents[1].payload as any).answer === 'RESEARCH-ANSWER', 'after payload has answer');
});

test('AC2 agent without respondToPrompt falls back to LLM', async () => {
  const bus = fakeEventBus();
  const c = new AgentConsultant({ security: {} }, callLlm, getApiKeys, bus as any);
  const ans = await c.consult('security', 'is this safe?');
  expect(ans === 'LLM-FALLBACK', 'should use LLM fallback');
});

test('AC3 recursion guard blocks nested consult', async () => {
  const bus = fakeEventBus();
  let c: AgentConsultant;
  const nested = {
    respondToPrompt: async () => {
      const inner = await c.consult('planner', 'inner?');
      return { content: 'OUTER-' + inner };
    },
  };
  c = new AgentConsultant({ planner: nested }, callLlm, getApiKeys, bus as any);
  const ans = await c.consult('planner', 'outer?');
  expect(ans.includes('[consultation nesting blocked'), 'nested consult must be blocked: ' + ans);
});
