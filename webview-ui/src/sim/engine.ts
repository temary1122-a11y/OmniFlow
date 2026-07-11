// TODO: INTEGRATION - delete simulateDemoFlow and rely on real backend OMNIFLOW_STATE_UPDATE + event stream

import type {
  AgentRole,
  ApprovalRequiredPayload,
  BackendEvent,
  ClarifyingQuestion,
  DeliveryReport,
  Phase,
  VerificationVerdict,
} from "@/types";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const uid = () => `id_${Math.random().toString(36).slice(2, 10)}`;
const now = () => Date.now();

let cancelled = false;
let pauseResolve: (() => void) | null = null;
const pauseGate = (): Promise<void> => new Promise<void>((r) => { pauseResolve = r; });

export function cancelDemo(): void {
  cancelled = true;
  pauseResolve?.();
  pauseResolve = null;
}

async function wait(ms: number): Promise<void> {
  let rem = ms;
  const slice = 50;
  while (rem > 0) {
    if (cancelled) return;
    await Promise.race([delay(Math.min(slice, rem)), pauseGate()]);
    rem -= slice;
  }
}

export async function simulateDemoFlow(handle: (e: BackendEvent) => void): Promise<void> {
  cancelled = false;
  const emit = (e: BackendEvent) => handle(e);

  const status = (agentId: AgentRole, st: "idle" | "working" | "done" | "blocked" | "error", message?: string) =>
    emit({ type: "AGENT_STATUS_UPDATE", payload: { agentId, status: st, message } });
  const phase = (from: Phase, to: Phase) =>
    emit({ type: "PHASE_TRANSITION", payload: { from, to, timestamp: now() } });
  const tool = async (agentId: AgentRole, toolName: string, args: Record<string, unknown>, output: string) => {
    const id = uid();
    emit({ type: "TOOL_CALL", payload: { agentId, toolName, args, timestamp: now(), callId: id } });
    await wait(600);
    emit({ type: "TOOL_RESULT", payload: { agentId, toolName, success: true, output, timestamp: now(), callId: id } });
  };

  try {
    // 1. intake → research
    phase("intake", "research");

    // 2. clarify
    status("orchestrator", "working", "Parsing goal…");
    status("clarifier", "working", "Gathering requirements…");
    await wait(500);
    const questions: ClarifyingQuestion[] = [
      { id: "q1", question: "Какой стек предпочитаете?", options: ["React+TS", "Vue", "Без разницы"], allowCustom: true },
    ];
    emit({ type: "CLARIFYING_QUESTIONS", payload: { taskId: "t1", questions } });
    await wait(3000); // simulate user, gate auto-resolves
    status("clarifier", "done", "Decisions captured");

    // 3. research
    emit({ type: "REASONING_TRACE", payload: { agentId: "orchestrator", phase: "research", thought: "Routing to researcher for codebase analysis…", timestamp: now() } });
    await wait(400);
    await tool("researcher", "web_search", { query: "best react express setup 2026" }, "Found 3 relevant sources on React+Express scaffolding.");
    emit({ type: "AGENT_COMMENTARY", payload: { agentId: "researcher", phase: "research", message: "Codebase scanned, requirements gathered.", timestamp: now() } });
    emit({ type: "AGENT_CONSULT", payload: { from: "orchestrator", to: "researcher", question: "Оцени сложность задачи?", answer: "medium — стандартный каркас приложения." } });
    await wait(400);
    status("researcher", "done");

    // 4. research → planning + approval
    phase("research", "planning");
    status("planner", "working", "Decomposing into execution plan…");
    await wait(400);
    await tool("planner", "plan_writer", { target: "src/app.ts" }, "Plan written: 1 module, 1 acceptance criterion.");
    const approval: ApprovalRequiredPayload = {
      requestId: "ap1",
      title: "План реализации",
      tier: "medium",
      architecture: "Feature-based",
      stack: ["React", "Express"],
      acceptanceCriteria: ["приложение запускается и отвечает 200 на /"],
      files: ["src/app.ts"],
      summary: "Создать минимальное приложение src/app.ts на React+Express.",
    };
    emit({ type: "APPROVAL_REQUIRED", payload: approval });
    await wait(3000);
    status("planner", "done", "Plan approved");

    // 5. build
    phase("planning", "build");
    status("coder", "working", "Writing src/app.ts…");
    emit({ type: "ARTIFACT_CREATED", payload: { filePath: "src/app.ts", agentId: "coder", taskId: "t1" } });
    await wait(300);
    await tool("coder", "write_file", { path: "src/app.ts" }, "+ export const app = createApp();\n+ app.get('/', (_req, res) => res.send('ok'));");
    status("coder", "done");

    // 6. audit
    phase("build", "audit");
    status("auditor", "working", "Reviewing diffs…");
    await wait(300);
    await tool("auditor", "review", { file: "src/app.ts" }, "Diff clean. No blocking issues.");
    status("auditor", "done");

    // 7. security
    phase("audit", "security");
    status("security", "working", "Scanning for vulnerabilities…");
    await wait(300);
    await tool("security", "security_scan", { paths: ["src/app.ts"] }, "scan complete — 0 critical, 0 high.");
    status("security", "done");

    // 8. verify
    phase("security", "verify");
    status("verifier", "working", "Validating acceptance criteria…");
    await wait(300);
    emit({ type: "VERIFY_BOUNCE", payload: { attempt: 1, failedCriteria: ["test flaky"], feedback: "fix flaky test" } });
    await wait(600);
    const verdict: VerificationVerdict = "PASS";
    emit({ type: "VERIFICATION_RESULT", payload: { subtaskId: "t1", verdict, risks: [] } });
    status("verifier", "done");

    // 9. deliver
    phase("verify", "deliver");
    status("orchestrator", "working", "Delivering…");
    const report: DeliveryReport = {
      taskId: "t1",
      artifacts: [{ filePath: "src/app.ts", opened: false }],
      verdict: "PASS",
      durationMs: 42000,
      ledgerPath: "omni/ledger.json",
      runInstructions: "npm i && npm start",
      summary: "Готово: создан src/app.ts",
    };
    emit({ type: "DELIVERY_COMPLETE", payload: { taskId: "t1", report } });

    // 10. finalize
    status("orchestrator", "done", "All done.");
  } catch (_e: unknown) {
    if (!cancelled) throw _e;
  }
}
