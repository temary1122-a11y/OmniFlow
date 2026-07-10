import { Virtuoso } from 'react-virtuoso';
import type { VirtuosoHandle } from 'react-virtuoso';
import type { Message } from '@/types';
import { ChatRow } from './ChatRow';
import { useOmniStore } from '@/store/omniStore';
import { useEffect, useRef } from 'react';

export function MessageList({ messages }: { messages: Message[] }) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const scrollTargetPhase = useOmniStore((s) => s.scrollTargetPhase);
  const clearScrollTarget = useOmniStore((s) => s.clearScrollTarget);

  useEffect(() => {
    if (!scrollTargetPhase || !virtuosoRef.current) return;

    const targetIndex = messages.findIndex((msg) => {
      if (msg.phase === scrollTargetPhase) return true;
      return msg.parts.some((p) => {
        if (p.type === 'phase') return p.from === scrollTargetPhase;
        if (p.type === 'commentary' || p.type === 'reasoning') return p.phase === scrollTargetPhase;
        return false;
      });
    });

    if (targetIndex >= 0) {
      virtuosoRef.current.scrollToIndex({ index: targetIndex, behavior: 'smooth', align: 'start' });
    }

    clearScrollTarget();
  }, [scrollTargetPhase, messages, clearScrollTarget]);

  return (
    <div style={{ flex: 1, minHeight: 0, height: '100%', display: 'flex' }}>
      <Virtuoso<Message>
        ref={virtuosoRef}
        data={messages}
        style={{ height: '100%', width: '100%' }}
        className="omni-fade-in"
        followOutput={(isAtBottom) => (isAtBottom ? 'smooth' : false)}
        initialTopMostItemIndex={Math.max(0, messages.length - 1)}
        alignToBottom
        increaseViewportBy={{ top: 240, bottom: 240 }}
        itemContent={(_index, message) => <ChatRow message={message} />}
        components={{
          Header: () => <div style={{ height: 'var(--space-3, 12px)' }} />,
          Footer: () => <div style={{ height: 'var(--space-4, 16px)' }} />,
        }}
      />
    </div>
  );
}
