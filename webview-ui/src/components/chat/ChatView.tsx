import { useOmniStore } from '@/store/omniStore';
import { MessageList } from './MessageList';
import { PromptInput } from './PromptInput';
import { ClarifyingQuestions } from './ClarifyingQuestions';
import { ApprovalCard } from './ApprovalCard';
import { ApiKeyPromptCard } from './ApiKeyPromptCard';
import { StartupScreen } from './StartupScreen';

export function ChatView() {
  const sessionId = useOmniStore((s) => s.sessionId);
  const messages = useOmniStore((s) => s.messages);
  const pendingQuestions = useOmniStore((s) => s.pendingQuestions);
  const pendingApproval = useOmniStore((s) => s.pendingApproval);
  const pendingApiKeyPrompt = useOmniStore((s) => s.pendingApiKeyPrompt);
  const startNewSession = useOmniStore((s) => s.startNewSession);
  const submitAnswers = useOmniStore((s) => s.submitAnswers);
  const submitApproval = useOmniStore((s) => s.submitApproval);

  const noSession = sessionId === '' && messages.length === 0;

  if (noSession) {
    return <StartupScreen onStartNewSession={(goal, mode) => startNewSession(goal, mode)} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex' }}>
        <MessageList messages={messages} />
      </div>

      {pendingQuestions && (
        <div style={{ padding: '0 12px', flexShrink: 0, maxHeight: '50vh', overflowY: 'auto', overflowX: 'hidden' }}>
          <ClarifyingQuestions questions={pendingQuestions} onSubmit={submitAnswers} />
        </div>
      )}

      {pendingApproval && (
        <div style={{ padding: '0 12px', flexShrink: 0, maxHeight: '50vh', overflowY: 'auto', overflowX: 'hidden' }}>
          <ApprovalCard
            approval={pendingApproval}
            onApprove={(fb) => submitApproval(pendingApproval.requestId, true, fb)}
            onReject={(fb) => submitApproval(pendingApproval.requestId, false, fb)}
          />
        </div>
      )}

      {pendingApiKeyPrompt && (
        <div style={{ padding: '0 12px', flexShrink: 0, maxHeight: '60vh', overflowY: 'auto', overflowX: 'hidden' }}>
          <ApiKeyPromptCard prompt={pendingApiKeyPrompt} />
        </div>
      )}

      <PromptInput />
    </div>
  );
}
