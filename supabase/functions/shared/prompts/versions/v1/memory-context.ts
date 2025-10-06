/**
 * Memory & Context Prompt Templates - Version 1
 * Sprint 2: Structured Prompts
 * 
 * Templates for thread memory and entity context
 */

/**
 * Format thread memory summary into prompt
 */
export function formatThreadMemory(summary: string): string {
  if (!summary || summary.trim() === '') {
    return '';
  }

  return `
## Konversationshistorik
${summary}

Använd denna kontext för att ge mer personliga och relevanta svar.`;
}

/**
 * Format extracted entities into prompt
 */
export function formatEntities(entities: Record<string, string[]>): string {
  const hasEntities = Object.keys(entities).length > 0;
  
  if (!hasEntities) {
    return '';
  }

  let entityText = '\n## Identifierade Enheter i Konversationen\n';
  
  if (entities.parts?.length > 0) {
    entityText += `\n**Reservdelar:** ${entities.parts.join(', ')}`;
  }
  
  if (entities.models?.length > 0) {
    entityText += `\n**Modeller:** ${entities.models.join(', ')}`;
  }
  
  if (entities.locations?.length > 0) {
    entityText += `\n**Platser:** ${entities.locations.join(', ')}`;
  }
  
  if (entities.years?.length > 0) {
    entityText += `\n**Årsmodeller:** ${entities.years.join(', ')}`;
  }

  entityText += '\n\nAnvänd dessa enheter för att göra ditt svar mer relevant och specifikt.';
  
  return entityText;
}

/**
 * Format organization facts into prompt
 */
export function formatOrgFacts(facts: Array<{ key: string; value: string; description?: string }>): string {
  if (!facts || facts.length === 0) {
    return '';
  }

  let factsText = '\n## Organisationsinformation\n';
  
  for (const fact of facts) {
    factsText += `\n- **${fact.key}**: ${fact.value}`;
    if (fact.description) {
      factsText += ` (${fact.description})`;
    }
  }
  
  factsText += '\n\nAnvänd denna information när det är relevant för användarens fråga.';
  
  return factsText;
}
