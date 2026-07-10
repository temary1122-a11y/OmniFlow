import type { Message, MessagePart } from '@/types';

export const uid = (p = 'id') => p + '-' + Math.random().toString(36).slice(2, 9);

/** Maps tool callId → message index for pairing TOOL_RESULT with TOOL_CALL. */
export const callIndex = new Map<string, number>();

export function appendPart(messages: Message[], part: MessagePart): Message[] {
  const next = messages.slice();
  const last = next[next.length - 1];
  if (last && last.role === 'assistant') {
    next[next.length - 1] = { ...last, parts: [...last.parts, part] };
    return next;
  }
  next.push({ id: uid('msg'), role: 'assistant', timestamp: Date.now(), parts: [part] });
  return next;
}

export function newMessage(role: Message['role'], parts: MessagePart[]): Message {
  return { id: uid('msg'), role, timestamp: Date.now(), parts };
}
