/**
 * Chat Utilities
 * Sprint 6: Architecture Refactoring
 * 
 * Helper functions for chat processing.
 */

/**
 * Extract code blocks from markdown text
 */
export function extractCodeBlocks(text: string): Array<{ language: string; code: string }> {
  const blocks = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      code: match[2],
    });
  }
  
  return blocks;
}

/**
 * Remove narration preambles from assistant responses
 */
export function scrubPreamble(text: string): string {
  return text
    .replace(/^\s*(jag söker.*?|kör webbsökning.*?|låt mig.*?|ett ögonblick.*?|en sekund.*?|nu .*?)\s*/i, '')
    .replace(/^\s*(I('m| am) (searching|looking|checking).*?|Let me (search|look|check).*?|One moment.*?)\s*/i, '')
    .trim();
}

/**
 * Extract knowledge URLs from citations
 */
export function extractKnowledgeUrls(citations: any[]): string[] {
  return citations
    .filter(c => typeof c.url === 'string' && c.url.includes('knowledge'))
    .map(c => c.url);
}

/**
 * Parse model string into provider and base model
 */
export function parseModelString(model: string): { provider: string; baseModel: string } {
  const modelParts = model.split('/');
  const provider = (modelParts[0] || 'google') as 'openai' | 'anthropic' | 'google';
  const baseModel = modelParts[1] || model;
  
  return { provider, baseModel };
}
