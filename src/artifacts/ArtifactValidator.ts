export interface ValidationResult { ok: boolean; errors: string[]; }
export function validateResearchReport(json: any): ValidationResult {
  const errors: string[] = [];
  if (!json || typeof json !== 'object') errors.push('not an object');
  else {
    if (typeof json.summary !== 'string' || json.summary.trim().length < 20) errors.push('summary missing/short');
    if (!Array.isArray(json.sources) || json.sources.length < 1) errors.push('sources empty');
  }
  return { ok: errors.length === 0, errors };
}
export function validateExecutionPlan(json: any): ValidationResult {
  const errors: string[] = [];
  if (!json || typeof json !== 'object') errors.push('not an object');
  else {
    if (!Array.isArray(json.stack)) errors.push('stack missing');
    if (typeof json.architecture !== 'string' || !json.architecture) errors.push('architecture missing');
    if (!Array.isArray(json.subtasks) || json.subtasks.length < 1) errors.push('subtasks missing');
  }
  return { ok: errors.length === 0, errors };
}
