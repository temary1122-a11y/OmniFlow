export interface SubGoal {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  parentGoalId?: string;
  createdAt: number;
  completedAt?: number;
}

export interface AlignmentCheck {
  timestamp: number;
  action: string;
  aligned: boolean;
  reasoning: string;
  confidence: number;
  driftScore: number;
}

export interface TaskCompassState {
  originalGoal: string;
  refinedGoal: string;
  currentSubGoal: string;
  subGoals: SubGoal[];
  alignmentHistory: AlignmentCheck[];
  driftScore: number;
  lastRefresh: number;
  refreshCount: number;
}

export interface RefreshStrategy {
  type: 'fixed' | 'adaptive';
  interval: number; // iterations
  driftThreshold: number; // 0-1
}

export class TaskCompass {
  private state: TaskCompassState;
  private refreshStrategy: RefreshStrategy;
  private iterationCount: number = 0;

  // A single shared compass can drive an entire task. The orchestrator sets the
  // instance; runtimes fall back to it when they are not handed an explicit one.
  // This keeps the WHOLE task (and every agent) on one compass.
  private static sharedInstance: TaskCompass | null = null;

  static setSharedInstance(instance: TaskCompass): void {
    TaskCompass.sharedInstance = instance;
  }

  static getSharedInstance(): TaskCompass | null {
    return TaskCompass.sharedInstance;
  }

  static clearSharedInstance(): void {
    TaskCompass.sharedInstance = null;
  }

  private static readonly STOPLIST = new Set<string>([
    // Russian
    'и', 'в', 'на', 'с', 'для', 'это', 'но', 'не', 'что', 'как', 'по', 'из', 'от', 'к', 'у', 'о',
    // English
    'the', 'a', 'an', 'to', 'of', 'for', 'and', 'or', 'is', 'are', 'be', 'that',
    'this', 'with', 'on', 'in', 'by', 'as', 'at', 'it', 'you', 'we', 'my', 'your',
    'from', 'into', 'about', 'me', 'do', 'does', 'i',
  ]);

  constructor(
    originalGoal: string,
    refreshStrategy: Partial<RefreshStrategy> = {}
  ) {
    this.state = {
      originalGoal,
      refinedGoal: originalGoal,
      currentSubGoal: '',
      subGoals: [],
      alignmentHistory: [],
      driftScore: 0,
      lastRefresh: Date.now(),
      refreshCount: 0,
    };

    this.refreshStrategy = {
      type: 'adaptive',
      interval: 5,
      driftThreshold: 0.6,
      ...refreshStrategy,
    };
  }

  setRefinedGoal(goal: string): void {
    this.state.refinedGoal = goal;
    this.recordAlignment('goal_refinement', true, 'Goal refined by user', 1.0, 0);
  }

  addSubGoal(description: string, parentGoalId?: string): string {
    const subGoal: SubGoal = {
      id: `subgoal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      description,
      status: 'pending',
      parentGoalId,
      createdAt: Date.now(),
    };

    this.state.subGoals.push(subGoal);
    return subGoal.id;
  }

  setCurrentSubGoal(subGoalId: string): void {
    const subGoal = this.state.subGoals.find(sg => sg.id === subGoalId);
    if (subGoal) {
      this.state.currentSubGoal = subGoal.description;
      subGoal.status = 'in_progress';
      this.recordAlignment('subgoal_set', true, `Set current subgoal: ${subGoal.description}`, 1.0, 0);
    }
  }

  completeSubGoal(subGoalId: string): void {
    const subGoal = this.state.subGoals.find(sg => sg.id === subGoalId);
    if (subGoal) {
      subGoal.status = 'completed';
      subGoal.completedAt = Date.now();
      this.recordAlignment('subgoal_completed', true, `Completed: ${subGoal.description}`, 1.0, 0);
    }
  }

  checkAlignment(
    proposedAction: string,
    currentContext: string
  ): {
    aligned: boolean;
    reasoning: string;
    confidence: number;
    driftScore: number;
    suggestedRedirect?: string;
  } {
    this.iterationCount++;

    // Calculate drift score based on various factors
    const driftScore = this.calculateDriftScore(proposedAction, currentContext);
    this.state.driftScore = driftScore;

    // Determine alignment
    const aligned = driftScore < this.refreshStrategy.driftThreshold;
    const confidence = 1 - driftScore;

    const reasoning = this.generateAlignmentReasoning(proposedAction, driftScore, aligned);
    const suggestedRedirect = aligned ? undefined : this.suggestRedirect(proposedAction);

    // Record alignment check
    this.recordAlignment(proposedAction, aligned, reasoning, confidence, driftScore);

    // Check if refresh is needed
    if (this.shouldRefresh()) {
      this.refresh();
    }

    return {
      aligned,
      reasoning,
      confidence,
      driftScore,
      suggestedRedirect,
    };
  }

  private calculateDriftScore(proposedAction: string, currentContext: string): number {
    let driftScore = 0;

    // Factor 1: Semantic similarity to original goal (30%)
    const goalSimilarity = this.calculateSemanticSimilarity(
      proposedAction,
      this.state.refinedGoal
    );
    driftScore += (1 - goalSimilarity) * 0.3;

    // Factor 2: Relevance to current subgoal (25%)
    if (this.state.currentSubGoal) {
      const subGoalSimilarity = this.calculateSemanticSimilarity(
        proposedAction,
        this.state.currentSubGoal
      );
      driftScore += (1 - subGoalSimilarity) * 0.25;
    }

    // Factor 3: Historical drift pattern (20%)
    if (this.state.alignmentHistory.length > 0) {
      const recentDrifts = this.state.alignmentHistory.slice(-5).map(h => h.driftScore);
      const avgRecentDrift = recentDrifts.reduce((a, b) => a + b, 0) / recentDrifts.length;
      driftScore += avgRecentDrift * 0.2;
    }

    // Factor 4: Context relevance (15%)
    const contextRelevance = this.calculateSemanticSimilarity(
      proposedAction,
      currentContext
    );
    driftScore += (1 - contextRelevance) * 0.15;

    // Factor 5: Action complexity vs goal complexity (10%)
    const complexityMismatch = this.calculateComplexityMismatch(proposedAction);
    driftScore += complexityMismatch * 0.1;

    return Math.min(driftScore, 1);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-zа-яё0-9]+/i)
      .filter(t => t.length === 0 ? false : /[0-9]/.test(t) || t.length > 1)
      .filter(t => !TaskCompass.STOPLIST.has(t));
  }

  private calculateSemanticSimilarity(text1: string, text2: string): number {
    // Tolerant, context-aware similarity. We strip a stoplist (English + Russian)
    // and use CONTAINMENT (how much of the smaller token set is covered by the
    // larger) rather than bare Jaccard overlap. This means the SAME goal expressed
    // with different wording / paraphrasing still scores HIGH (low drift), while
    // only genuinely off-topic actions score LOW.
    const a = new Set(this.tokenize(text1));
    const b = new Set(this.tokenize(text2));

    if (a.size === 0 && b.size === 0) return 1;
    if (a.size === 0 || b.size === 0) return 0;

    let intersection = 0;
    for (const t of a) {
      if (b.has(t)) intersection++;
    }

    // Containment: proportion of the smaller set that is present in the larger set.
    const containment = intersection / Math.min(a.size, b.size);

    // Jaccard for balanced overlap.
    const union = new Set([...a, ...b]).size;
    const jaccard = intersection / union;

    // Favor containment so a paraphrase that covers the goal's key tokens aligns.
    return Math.max(containment, containment * 0.65 + jaccard * 0.35);
  }

  private calculateComplexityMismatch(action: string): number {
    // Estimate if action is disproportionately complex for current goal
    const actionComplexity = action.split(/\s+/).length;
    const goalComplexity = this.state.refinedGoal.split(/\s+/).length;

    if (actionComplexity > goalComplexity * 3) return 0.5;
    if (actionComplexity > goalComplexity * 2) return 0.3;
    return 0;
  }

  private generateAlignmentReasoning(
    action: string,
    driftScore: number,
    aligned: boolean
  ): string {
    const reasons: string[] = [];

    if (aligned) {
      reasons.push('Action aligns with task');
      if (this.state.currentSubGoal) {
        reasons.push(`Supports current subgoal: ${this.state.currentSubGoal}`);
      }
      reasons.push(`Drift score: ${driftScore.toFixed(2)} (below threshold ${this.refreshStrategy.driftThreshold})`);
    } else {
      reasons.push('Action may deviate from task');
      reasons.push(`Drift score: ${driftScore.toFixed(2)} (exceeds threshold ${this.refreshStrategy.driftThreshold})`);
      if (this.state.currentSubGoal) {
        reasons.push(`Consider relevance to: ${this.state.currentSubGoal}`);
      }
    }

    return reasons.join('. ');
  }

  private suggestRedirect(action: string): string {
    // Suggest a redirect based on current subgoal or refined goal
    if (this.state.currentSubGoal) {
      return `Refocus action on: ${this.state.currentSubGoal}`;
    }
    return `Refocus action on original goal: ${this.state.refinedGoal}`;
  }

  private shouldRefresh(): boolean {
    if (this.refreshStrategy.type === 'fixed') {
      return this.iterationCount % this.refreshStrategy.interval === 0;
    } else {
      // Adaptive: refresh when drift exceeds threshold
      return this.state.driftScore >= this.refreshStrategy.driftThreshold;
    }
  }

  private refresh(): void {
    this.state.lastRefresh = Date.now();
    this.state.refreshCount++;
    this.state.driftScore = 0; // Reset drift score after refresh

    // Re-align subgoals
    this.state.subGoals.forEach(sg => {
      if (sg.status === 'in_progress') {
        // Keep in_progress subgoals as they are still relevant
      }
    });
  }

  private recordAlignment(
    action: string,
    aligned: boolean,
    reasoning: string,
    confidence: number,
    driftScore: number
  ): void {
    const check: AlignmentCheck = {
      timestamp: Date.now(),
      action: action.substring(0, 200), // Truncate for storage
      aligned,
      reasoning,
      confidence,
      driftScore,
    };

    this.state.alignmentHistory.push(check);

    // Keep only last 100 checks to avoid memory bloat
    if (this.state.alignmentHistory.length > 100) {
      this.state.alignmentHistory = this.state.alignmentHistory.slice(-100);
    }
  }

  getAlignmentSummary(): {
    totalChecks: number;
    alignedChecks: number;
    alignmentRate: number;
    avgDriftScore: number;
    currentDriftScore: number;
  } {
    const totalChecks = this.state.alignmentHistory.length;
    const alignedChecks = this.state.alignmentHistory.filter(h => h.aligned).length;
    const alignmentRate = totalChecks > 0 ? alignedChecks / totalChecks : 1;
    const avgDriftScore = totalChecks > 0
      ? this.state.alignmentHistory.reduce((sum, h) => sum + h.driftScore, 0) / totalChecks
      : 0;

    return {
      totalChecks,
      alignedChecks,
      alignmentRate,
      avgDriftScore,
      currentDriftScore: this.state.driftScore,
    };
  }

  getState(): TaskCompassState {
    return {
      ...this.state,
      subGoals: [...this.state.subGoals],
      alignmentHistory: [...this.state.alignmentHistory],
    };
  }

  /**
   * Prompt-ready block carrying the TRUE GOAL into every agent's context so the
   * model can check its actions against the compass. Kept short (<400 chars).
   */
  getContextBlock(): string {
    const truncate = (s: string, n = 120): string =>
      s.length > n ? s.slice(0, n) + '…' : s;
    const sub = this.state.currentSubGoal ? truncate(this.state.currentSubGoal) : '(none)';
    return [
      `ORIGINAL GOAL: ${truncate(this.state.originalGoal)}`,
      `REFINED GOAL: ${truncate(this.state.refinedGoal)}`,
      `CURRENT SUBGOAL: ${sub}`,
      `Before each action, verify it serves this goal; if it drifts, refocus.`,
    ].join('\n');
  }

  reset(): void {
    this.state.driftScore = 0;
    this.state.alignmentHistory = [];
    this.iterationCount = 0;
    this.state.lastRefresh = Date.now();
  }

  updateRefreshStrategy(strategy: Partial<RefreshStrategy>): void {
    this.refreshStrategy = { ...this.refreshStrategy, ...strategy };
  }

  getRefreshStrategy(): RefreshStrategy {
    return { ...this.refreshStrategy };
  }
}
