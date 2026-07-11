import type { ModelRouter } from '../routing/ModelRouter';
import type { EventBus } from './EventBus';

/**
 * Top-level routing intent decided by the LLM (model-driven), NOT by a
 * hardcoded switch. This is the first thing Omni does with a user request,
 * mirroring how Claude Code / Codex / Devin / Kilo let the model evaluate the
 * prompt and choose the path instead of forcing a fixed pipeline.
 */
export type OmniIntent =
  | 'chat'      // question / explanation / conversation — no files touched
  | 'ask'       // alias of chat (UI "ask" mode)
  | 'code'      // build / create / implement / add / change in the workspace
  | 'research'  // investigate / analyze only (no code changes)
  | 'debug'     // something is broken and must be diagnosed/fixed
  | 'refactor'  // improve structure without changing behavior
  | 'migrate'   // move code / stack from one to another
  | 'unknown';

export interface IntentDecision {
  intent: OmniIntent;
  confidence: number;
  reasoning: string;
  /** Whether fulfilling the request requires writing code/artifacts to disk. */
  requiresBuild: boolean;
  /** Short LLM-produced decomposition/steps (for build/research tasks). */
  decomposition?: string[];
  /** True when the decision came from the local heuristic (LLM unavailable). */
  heuristic: boolean;
}

const CLASSIFY_SYSTEM = `You are the intent classifier for "Omni", an autonomous coding/agent harness inside a code editor.
Given a user request, decide the SINGLE best routing intent.
- "chat": the user is asking a question, wants an explanation, a concept, help, or a conversation. No files need to be created or changed. Examples: "who are you", "what is a closure", "explain this error", "how do promises work".
- "code": the user wants something built, created, implemented, added, or changed in the workspace (a feature, script, file, app, component). Examples: "build a REST API", "create a button component", "add a logout button", "make a todo list app".
- "research": the user wants investigation/analysis ONLY (no code changes), OR wants CURRENT/LIVE information from the web that must be looked up fresh (news, latest/current events, today's updates, recent prices/rates/weather, "find out", "look up", "search for"). Examples: "research best practices for X", "analyze this codebase", "what libraries exist for Y", "find today's news", "what are the latest AI models", "look up the current price of X". The researcher agent owns web search (Exa/Tavily) — route any request that needs up-to-date web data here, even in chat mode.
- "debug": something is broken and must be diagnosed/fixed. Examples: "login is broken", "fix the crash on startup".
- "refactor": improve existing code structure without changing behavior. Examples: "refactor the auth module", "clean up the utils".
- "migrate": move code/stack from one to another. Examples: "migrate to TypeScript", "port this to Python".

Respond with ONLY a JSON object, no prose, in this exact shape:
{"intent": string, "confidence": number (0..1), "reasoning": string, "requiresBuild": boolean, "decomposition": string[]?}

When unsure between chat and code, choose "code" ONLY if the user clearly wants an artifact/file produced; otherwise "chat".`;

export class IntentRouter {
  constructor(
    private router: ModelRouter,
    private apiKeys: Record<string, string>,
    private eventBus?: EventBus
  ) {}

  async classify(rawGoal: string, opts: { mode?: string; workspaceRoot?: string } = {}): Promise<IntentDecision> {
    const prompt =
      `USER REQUEST:\n"""\n${rawGoal}\n"""\n\n` +
      `Classify the intent of this request. If it is a build/code task, also provide a brief ` +
      `"decomposition" (3-6 steps). Respond ONLY with JSON.`;

    try {
      const res = await this.router.call(
        { phase: 'intake', agentRole: 'orchestrator', complexity: 'low' } as any,
        prompt,
        CLASSIFY_SYSTEM,
        this.apiKeys
      );
      const parsed = this.parseJsonSafe(res.content || '');
      if (parsed && typeof parsed.intent === 'string') {
        const intent = this.normalizeIntent(parsed.intent);

        // Single default mode: the LLM chooses the path (chat / research / code)
        // for EVERY message — we never force a 'chat' mode here. The only
        // override is live/current web data, which always belongs to the
        // researcher's web_search tooling, not a chat answer.
        const needsWeb = this.requiresLiveWeb(rawGoal);
        if ((intent === 'chat' || intent === 'ask') && needsWeb) {
          return this.decision('research', 0.95, 'Request needs current/live web info → researcher (web search)', false, false);
        }

        const requiresBuild =
          typeof parsed.requiresBuild === 'boolean'
            ? parsed.requiresBuild
            : intent === 'chat' || intent === 'ask' || intent === 'research';

        return this.decision(
          intent,
          typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
          parsed.reasoning ?? '',
          requiresBuild,
          false,
          Array.isArray(parsed.decomposition) ? parsed.decomposition.map(String) : undefined
        );
      }
    } catch {
      // LLM unavailable (e.g. rate-limited / no key) — fall back to heuristics.
    }

    return this.heuristic(rawGoal);
  }

  /**
   * Heuristic: does this request need CURRENT/LIVE web data that must be
   * looked up fresh (and therefore belongs to the researcher's web_search
   * tooling, not the chat agent's training knowledge)?
   */
  requiresLiveWeb(goal: string): boolean {
    const g = goal.toLowerCase();
    const liveSignals = [
      'news', 'новост', 'сегодня', 'today', 'current', 'latest', 'recent', 'up-to-date', 'up to date',
      'актуальн', 'последн', 'свеж', 'сейчас', 'right now', 'this week', 'this month', 'this year',
      'эта недел', 'этот год', 'цен', 'курс', 'price', 'prices', 'rate', 'rates', 'weather', 'погод',
      'stock', 'stocks', 'trending', 'happening', 'происходит', 'find', 'search', 'look up', 'lookup',
      'найди', 'поищ', 'узнай', 'выясни', 'google', 'what is the', 'кто сейчас', 'что сейчас',
    ];
    return liveSignals.some((s) => g.includes(s));
  }

  private normalizeIntent(s: string): OmniIntent {
    const x = s.toLowerCase();
    if (x.includes('chat') || x.includes('question') || x.includes('ask') || x.includes('conversat')) return 'chat';
    if (x.includes('research') || x.includes('investigat') || x.includes('analy')) return 'research';
    if (x.includes('debug') || x.includes('broken') || x.includes('fix')) return 'debug';
    if (x.includes('refactor')) return 'refactor';
    if (x.includes('migrat')) return 'migrate';
    if (x.includes('code') || x.includes('build') || x.includes('implement') || x.includes('create') || x.includes('add')) return 'code';
    return 'unknown';
  }

  /** Local fallback so the harness still routes sensibly when the LLM is down. */
  private heuristic(goal: string): IntentDecision {
    const g = goal.toLowerCase().trim();

    // Anything asking for live/current web data belongs to the researcher.
    if (this.requiresLiveWeb(g)) {
      return this.decision('research', 0.85, 'Live/current web data requested → researcher', false, true);
    }

    // Direct questions usually want an answer, not a file — unless they also
    // carry an imperative build verb ("how do I build a bot").
    const isQuestion =
      /^(who|what|when|where|why|how|which|is|are|can|could|should|do|does|did|explain|describe|tell me|что|кто|почему|как|где|когда|зачем|объясни|расскажи|опиши)\b/.test(g) ||
      /\?\s*$/.test(g);
    if (isQuestion) {
      if (/\b(build|create|make|implement|write|generate|develop|code|скрипт|напиши|создай|сделай|реализуй|построй)\b/.test(g)) {
        return this.decision('code', 0.8, 'Question containing a build verb → code', true, true);
      }
      if (this.requiresLiveWeb(g)) {
        return this.decision('research', 0.85, 'Question needs live/current web data → researcher', false, true);
      }
      return this.decision('chat', 0.85, 'Question without build intent → chat', false, true);
    }

    if (/\b(build|create|make|implement|write|generate|develop|add|fix|напиши|создай|сделай|реализуй|исправь|почини|добавь)\b/.test(g)) {
      return this.decision('code', 0.85, 'Imperative build verb → code', true, true);
    }
    if (/\b(research|investigate|analyze|analyse|study|изучи|исследуй|проанализируй)\b/.test(g)) {
      return this.decision('research', 0.8, 'Research verb → research', false, true);
    }
    if (/\b(refactor|clean up|cleanup|улучши структуру)\b/.test(g)) {
      return this.decision('refactor', 0.8, 'Refactor verb → refactor', true, true);
    }
    if (/\b(migrate|port .* to|перенеси)\b/.test(g)) {
      return this.decision('migrate', 0.8, 'Migrate verb → migrate', true, true);
    }

    // Default: a request with no clear build/research/migrate signal is most
    // likely a conversation or question — answer directly instead of forcing a
    // build pipeline that would have nothing to produce (and fail verification).
    return this.decision('chat', 0.5, 'No clear signal — defaulting to chat', false, true);
  }

  private decision(
    intent: OmniIntent,
    confidence: number,
    reasoning: string,
    requiresBuild: boolean,
    heuristic: boolean,
    decomposition?: string[]
  ): IntentDecision {
    return { intent, confidence, reasoning, requiresBuild, decomposition, heuristic };
  }

  private parseJsonSafe(text: string): any {
    if (!text) return null;
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fenced ? fenced[1] : text;
    try {
      return JSON.parse(raw.trim());
    } catch {
      // Try to salvage a JSON object from loose text.
      const objMatch = raw.match(/\{[\s\S]*\}/);
      if (objMatch) {
        try {
          return JSON.parse(objMatch[0].trim());
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}
