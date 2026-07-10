import { describe, expect, it } from 'vitest';
import { parseToolCalls, extractBalancedBraces } from '../../src/core/ToolCallParser';

describe('extractBalancedBraces', () => {
  it('extracts nested JSON object', () => {
    const s = 'prefix {"a": {"b": 1}} suffix';
    expect(extractBalancedBraces(s)).toBe('{"a": {"b": 1}}');
  });
});

describe('parseToolCalls', () => {
  const known = new Set(['noop', 'write_file']);

  it('parses JSON tool field', () => {
    const calls = parseToolCalls('{"tool":"noop","arguments":{"x":1}}', (n) => known.has(n));
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('noop');
    expect(calls[0].arguments).toEqual({ x: 1 });
  });

  it('ignores unknown tools', () => {
    const calls = parseToolCalls('{"tool":"unknown","arguments":{}}', (n) => known.has(n));
    expect(calls).toHaveLength(0);
  });

  it('parses XML-style tool call', () => {
    const calls = parseToolCalls('<write_file><path>out.txt</path><content>hi</content></write_file>', (n) =>
      known.has(n)
    );
    expect(calls[0]?.name).toBe('write_file');
    expect(calls[0]?.arguments.path).toBe('out.txt');
  });
});
