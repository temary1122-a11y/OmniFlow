export interface RequestClassification {
  complexity: 'simple' | 'medium' | 'complex';
  confidence: number;
  dimensions: {
    tokenCount: number;
    codePresence: boolean;
    toolUseDetection: boolean;
    reasoningComplexity: number;
    domainSpecificity: number;
    multiHopRequirements: boolean;
    creativityLevel: number;
    precisionNeeds: number;
    contextLengthRequirements: number;
    latencySensitivity: number;
    costTolerance: number;
    securityRequirements: number;
    languageComplexity: number;
    outputFormatConstraints: string[];
  };
  reasoning: string;
}

export interface ClassificationConfig {
  tokenThresholds: {
    simple: number;
    medium: number;
  };
  reasoningKeywords: string[];
  codeKeywords: string[];
  toolUseKeywords: string[];
  domainSpecificKeywords: Record<string, string[]>;
}

export class RequestClassifier {
  private config: ClassificationConfig;

  constructor(config?: Partial<ClassificationConfig>) {
    this.config = {
      tokenThresholds: {
        simple: 500,
        medium: 2000,
      },
      reasoningKeywords: [
        'analyze', 'evaluate', 'compare', 'synthesize', 'reason', 'why', 'how',
        'explain', 'justify', 'critique', 'assess', 'determine', 'derive',
        'conclude', 'infer', 'deduce', 'strategy', 'architecture', 'design'
      ],
      codeKeywords: [
        'function', 'class', 'method', 'variable', 'algorithm', 'implement',
        'code', 'programming', 'debug', 'refactor', 'api', 'endpoint',
        'database', 'query', 'async', 'promise', 'interface', 'type'
      ],
      toolUseKeywords: [
        'search', 'find', 'look up', 'retrieve', 'fetch', 'query', 'browse',
        'read file', 'write file', 'execute', 'run', 'compile', 'test'
      ],
      domainSpecificKeywords: {
        'web': ['http', 'api', 'rest', 'graphql', 'frontend', 'backend', 'server'],
        'ml': ['model', 'training', 'neural', 'dataset', 'inference', 'tensor'],
        'security': ['auth', 'encrypt', 'hash', 'token', 'permission', 'vulnerability'],
        'database': ['sql', 'query', 'schema', 'index', 'transaction', 'migration'],
      },
      ...config,
    };
  }

  classify(prompt: string, systemPrompt?: string): RequestClassification {
    const fullText = `${systemPrompt || ''}\n${prompt}`;
    const dimensions = this.analyzeDimensions(fullText);
    
    const complexity = this.determineComplexity(dimensions);
    const confidence = this.calculateConfidence(dimensions, complexity);
    const reasoning = this.explainClassification(dimensions, complexity);

    return {
      complexity,
      confidence,
      dimensions,
      reasoning,
    };
  }

  private analyzeDimensions(text: string): RequestClassification['dimensions'] {
    const lowerText = text.toLowerCase();
    
    return {
      tokenCount: this.estimateTokenCount(text),
      codePresence: this.detectCodePresence(lowerText),
      toolUseDetection: this.detectToolUse(lowerText),
      reasoningComplexity: this.detectReasoningComplexity(lowerText),
      domainSpecificity: this.detectDomainSpecificity(lowerText),
      multiHopRequirements: this.detectMultiHopRequirements(lowerText),
      creativityLevel: this.detectCreativityLevel(lowerText),
      precisionNeeds: this.detectPrecisionNeeds(lowerText),
      contextLengthRequirements: this.estimateContextLength(text),
      latencySensitivity: this.detectLatencySensitivity(lowerText),
      costTolerance: this.detectCostTolerance(lowerText),
      securityRequirements: this.detectSecurityRequirements(lowerText),
      languageComplexity: this.detectLanguageComplexity(text),
      outputFormatConstraints: this.detectOutputFormatConstraints(lowerText),
    };
  }

  private estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private detectCodePresence(text: string): boolean {
    return this.config.codeKeywords.some(keyword => text.includes(keyword)) ||
           text.includes('```') ||
           text.includes('function(') ||
           text.includes('class ') ||
           text.includes('def ');
  }

  private detectToolUse(text: string): boolean {
    return this.config.toolUseKeywords.some(keyword => text.includes(keyword));
  }

  private detectReasoningComplexity(text: string): number {
    const reasoningCount = this.config.reasoningKeywords.filter(keyword => 
      text.includes(keyword)
    ).length;
    
    // Normalize to 0-1 range
    return Math.min(reasoningCount / 5, 1);
  }

  private detectDomainSpecificity(text: string): number {
    let domainMatches = 0;
    for (const domain in this.config.domainSpecificKeywords) {
      const keywords = this.config.domainSpecificKeywords[domain];
      if (keywords.some(keyword => text.includes(keyword))) {
        domainMatches++;
      }
    }
    
    // Normalize to 0-1 range (max 4 domains)
    return domainMatches / 4;
  }

  private detectMultiHopRequirements(text: string): boolean {
    const multiHopIndicators = [
      'then', 'after that', 'subsequently', 'followed by', 'next',
      'step by step', 'sequence', 'pipeline', 'workflow'
    ];
    
    return multiHopIndicators.some(indicator => text.includes(indicator));
  }

  private detectCreativityLevel(text: string): number {
    const creativeIndicators = [
      'create', 'design', 'invent', 'imagine', 'generate', 'innovate',
      'novel', 'original', 'unique', 'creative', 'artistic'
    ];
    
    const count = creativeIndicators.filter(indicator => text.includes(indicator)).length;
    return Math.min(count / 3, 1);
  }

  private detectPrecisionNeeds(text: string): number {
    const precisionIndicators = [
      'exact', 'precise', 'accurate', 'specific', 'detailed',
      'thorough', 'comprehensive', 'exact match', 'specifically'
    ];
    
    const count = precisionIndicators.filter(indicator => text.includes(indicator)).length;
    return Math.min(count / 3, 1);
  }

  private estimateContextLength(text: string): number {
    // Estimate based on token count and complexity
    const tokenCount = this.estimateTokenCount(text);
    
    if (tokenCount < 500) return 4096;
    if (tokenCount < 2000) return 8192;
    if (tokenCount < 5000) return 16384;
    return 32768;
  }

  private detectLatencySensitivity(text: string): number {
    const latencyIndicators = [
      'fast', 'quick', 'real-time', 'immediate', 'instant',
      'low latency', 'responsive', 'speed', 'performance'
    ];
    
    const count = latencyIndicators.filter(indicator => text.includes(indicator)).length;
    return Math.min(count / 2, 1);
  }

  private detectCostTolerance(text: string): number {
    const costIndicators = [
      'cheap', 'free', 'low cost', 'budget', 'economical',
      'expensive', 'premium', 'high quality', 'best'
    ];
    
    const cheapCount = costIndicators.slice(0, 5).filter(indicator => text.includes(indicator)).length;
    const premiumCount = costIndicators.slice(5).filter(indicator => text.includes(indicator)).length;
    
    // Return -1 (cost-sensitive) to 1 (quality-focused)
    return (premiumCount - cheapCount) / Math.max(premiumCount + cheapCount, 1);
  }

  private detectSecurityRequirements(text: string): number {
    const securityIndicators = [
      'secure', 'encrypt', 'authenticate', 'authorize', 'protect',
      'security', 'vulnerability', 'compliance', 'audit', 'permission'
    ];
    
    const count = securityIndicators.filter(indicator => text.includes(indicator)).length;
    return Math.min(count / 3, 1);
  }

  private detectLanguageComplexity(text: string): number {
    // Simple heuristic based on sentence structure and vocabulary
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return 0;
    
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;
    
    // Normalize: simple (avg < 10 words) to complex (avg > 20 words)
    return Math.min(Math.max((avgSentenceLength - 10) / 10, 0), 1);
  }

  private detectOutputFormatConstraints(text: string): string[] {
    const formats: string[] = [];
    
    if (text.includes('json')) formats.push('json');
    if (text.includes('markdown') || text.includes('md')) formats.push('markdown');
    if (text.includes('html')) formats.push('html');
    if (text.includes('xml')) formats.push('xml');
    if (text.includes('yaml') || text.includes('yml')) formats.push('yaml');
    if (text.includes('csv')) formats.push('csv');
    if (text.includes('table')) formats.push('table');
    if (text.includes('list')) formats.push('list');
    
    return formats;
  }

  private determineComplexity(dimensions: RequestClassification['dimensions']): 'simple' | 'medium' | 'complex' {
    let score = 0;
    
    // Token count (0-30 points)
    if (dimensions.tokenCount < this.config.tokenThresholds.simple) score += 10;
    else if (dimensions.tokenCount < this.config.tokenThresholds.medium) score += 20;
    else score += 30;
    
    // Code presence (0-15 points)
    if (dimensions.codePresence) score += 15;
    
    // Tool use (0-10 points)
    if (dimensions.toolUseDetection) score += 10;
    
    // Reasoning complexity (0-15 points)
    score += dimensions.reasoningComplexity * 15;
    
    // Multi-hop requirements (0-10 points)
    if (dimensions.multiHopRequirements) score += 10;
    
    // Domain specificity (0-10 points)
    score += dimensions.domainSpecificity * 10;
    
    // Total: 0-100 points
    if (score < 35) return 'simple';
    if (score < 65) return 'medium';
    return 'complex';
  }

  private calculateConfidence(
    dimensions: RequestClassification['dimensions'],
    complexity: 'simple' | 'medium' | 'complex'
  ): number {
    // Higher confidence for extreme cases (very simple or very complex)
    const tokenScore = dimensions.tokenCount;
    
    if (complexity === 'simple' && tokenScore < 200) return 0.9;
    if (complexity === 'complex' && tokenScore > 3000) return 0.9;
    
    // Medium confidence for borderline cases
    return 0.7;
  }

  private explainClassification(
    dimensions: RequestClassification['dimensions'],
    complexity: 'simple' | 'medium' | 'complex'
  ): string {
    const reasons: string[] = [];
    
    reasons.push(`Token count: ${dimensions.tokenCount}`);
    
    if (dimensions.codePresence) reasons.push('Contains code');
    if (dimensions.toolUseDetection) reasons.push('Requires tool use');
    if (dimensions.multiHopRequirements) reasons.push('Multi-step task');
    if (dimensions.reasoningComplexity > 0.5) reasons.push('High reasoning complexity');
    if (dimensions.domainSpecificity > 0.5) reasons.push('Domain-specific');
    
    return `Classified as ${complexity} because: ${reasons.join(', ')}`;
  }

  updateConfig(config: Partial<ClassificationConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
