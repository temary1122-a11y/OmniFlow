import type { Phase } from '../../shared/types';
import { EventBus } from './EventBus';

const PHASE_ORDER: Phase[] = [
  'intake',
  'research',
  'planning',
  'build',
  'audit',
  'security',
  'verify',
  'deliver',
];

export class PhaseEngine {
  private currentPhase: Phase = 'intake';
  private completedPhases: Phase[] = [];
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  transitionTo(phase: Phase): void {
    const from = this.currentPhase;
    if (from !== phase && !this.completedPhases.includes(from)) {
      this.completedPhases.push(from);
    }
    this.currentPhase = phase;
    this.eventBus.emit({
      type: 'PHASE_TRANSITION',
      payload: { from, to: phase, timestamp: Date.now() },
    });
  }

  getCurrentPhase(): Phase {
    return this.currentPhase;
  }

  getCompletedPhases(): Phase[] {
    return [...this.completedPhases];
  }

  getPhaseOrder(): Phase[] {
    return [...PHASE_ORDER];
  }

  reset(): void {
    this.currentPhase = 'intake';
    this.completedPhases = [];
  }
}
