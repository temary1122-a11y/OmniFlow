export interface ParsedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Extract a JSON object with balanced outer braces from a string starting with `{`.
 */
export function extractBalancedBraces(s: string): string {
  const start = s.indexOf('{');
  if (start === -1) return '{}';
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return s.slice(start);
}

/**
 * Parse tool calls from free-form LLM text when native function-calling is absent.
 * Only returns tools that pass `isKnownTool`.
 */
export function parseToolCalls(
  content: string,
  isKnownTool: (name: string) => boolean
): ParsedToolCall[] {
  const toolCalls: ParsedToolCall[] = [];

  const toolNamePattern = /"tool"\s*:\s*"([^"]+)"/g;
  let nameMatch: RegExpExecArray | null;
  while ((nameMatch = toolNamePattern.exec(content)) !== null) {
    const toolName = nameMatch[1];
    if (!isKnownTool(toolName)) continue;
    const rest = content.slice(nameMatch.index + nameMatch[0].length);
    const argPattern = /(?:"arguments"|"args")\s*:\s*(\{[\s\S]*)/;
    const argMatch = argPattern.exec(rest);
    let args: Record<string, unknown> = {};
    if (argMatch) {
      const balanced = extractBalancedBraces(argMatch[1]);
      try {
        args = JSON.parse(balanced) as Record<string, unknown>;
      } catch {
        args = {};
      }
    }
    toolCalls.push({ name: toolName, arguments: args });
  }

  let match: RegExpExecArray | null;
  const xmlPattern = /<([a-zA-Z_][a-zA-Z0-9_]*)>([\s\S]*?)<\/\1>/g;
  while ((match = xmlPattern.exec(content)) !== null) {
    const toolName = match[1];
    const innerContent = match[2];
    if (isKnownTool(toolName)) {
      let args: Record<string, unknown> = {};
      const argPattern = /<([a-zA-Z_][a-zA-Z0-9_]*)>([\s\S]*?)<\/\1>/g;
      const argMatches = [...innerContent.matchAll(argPattern)];
      if (argMatches.length > 0) {
        for (const argMatch of argMatches) {
          let value: unknown = argMatch[2].trim();
          try {
            value = JSON.parse(String(value));
          } catch {
            /* keep string */
          }
          args[argMatch[1]] = value;
        }
      } else {
        try {
          args = JSON.parse(innerContent.trim()) as Record<string, unknown>;
        } catch {
          args = { content: innerContent.trim() };
        }
      }
      toolCalls.push({ name: toolName, arguments: args });
    }
  }

  if (toolCalls.length === 0) {
    const nameJsonPattern = /\{[\s\S]*?"name"\s*:\s*"([^"]+)"[\s\S]*?\}/g;
    while ((match = nameJsonPattern.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[0]) as Record<string, unknown>;
        const name = parsed.name;
        if (typeof name === 'string' && isKnownTool(name)) {
          toolCalls.push({
            name,
            arguments:
              (parsed.arguments as Record<string, unknown>) ||
              (parsed.args as Record<string, unknown>) ||
              (parsed.parameters as Record<string, unknown>) ||
              {},
          });
        }
      } catch {
        /* skip */
      }
    }
  }

  if (toolCalls.length === 0) {
    const toolPattern = /(?:tool|call|function)\s*:\s*(\w+)\s*(?:with\s+arguments)?\s*(\{[\s\S]*?\})/gi;
    while ((match = toolPattern.exec(content)) !== null) {
      const toolName = match[1];
      if (isKnownTool(toolName)) {
        try {
          const args = match[2] ? (JSON.parse(match[2]) as Record<string, unknown>) : {};
          toolCalls.push({ name: toolName, arguments: args });
        } catch {
          /* skip */
        }
      }
    }
  }

  if (toolCalls.length === 0) {
    const simplePattern = /(?:using|calling|execute)\s+(\w+)\s*(?:with|:)?\s*(\{[\s\S]*?\})?/gi;
    while ((match = simplePattern.exec(content)) !== null) {
      const toolName = match[1];
      if (isKnownTool(toolName)) {
        try {
          const args = match[2] ? (JSON.parse(match[2]) as Record<string, unknown>) : {};
          toolCalls.push({ name: toolName, arguments: args });
        } catch {
          /* skip */
        }
      }
    }
  }

  if (toolCalls.length === 0) {
    const funcPattern =
      /(\w+)\s*\(\s*["']([^"']*)["']\s*(?:,\s*["']([^"']*)["']\s*)?(?:,\s*["']([^"']*)["']\s*)?\)/g;
    while ((match = funcPattern.exec(content)) !== null) {
      const toolName = match[1];
      if (isKnownTool(toolName)) {
        const args: Record<string, unknown> = {};
        if (match[2]) args.path = match[2];
        if (match[3]) args.content = match[3];
        if (match[4]) args.extra = match[4];
        toolCalls.push({ name: toolName, arguments: args });
      }
    }
  }

  return toolCalls;
}
