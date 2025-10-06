import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ThreadMemory {
  threadSummary: string;
  entities: Record<string, any>;
  pinnedFacts: Record<string, any>;
}

/**
 * FIX P1: Extract entities from messages using regex patterns
 * Fast, no API calls needed - extracts common patterns
 */
export function extractEntitiesFromMessages(
  messages: Array<{ role: string; content: string }>
): Record<string, any> {
  const entities: Record<string, any> = {
    dates: new Set<string>(),
    partNumbers: new Set<string>(),
    products: new Set<string>(),
    measurements: new Set<string>(),
    years: new Set<string>(),
    prices: new Set<string>(),
  };
  
  for (const msg of messages) {
    const content = msg.content;
    
    // Extract dates (YYYY-MM-DD format)
    const dates = content.match(/\b\d{4}-\d{2}-\d{2}\b/g);
    if (dates) dates.forEach(d => entities.dates.add(d));
    
    // Extract years (2020-2029 range)
    const years = content.match(/\b20[2-9]\d\b/g);
    if (years) years.forEach(y => entities.years.add(y));
    
    // Extract part numbers (various formats: 12345-678, A1234, etc)
    const partNumbers = content.match(/\b[A-Z]?\d{4,6}[-]?\d{2,4}\b/g);
    if (partNumbers) partNumbers.forEach(p => entities.partNumbers.add(p));
    
    // Extract product names (Capital Letter followed by word + number/letter)
    const products = content.match(/\b[A-ZÅÄÖ][a-zåäö]+\s+[A-Z0-9][a-z0-9-]+\b/g);
    if (products) products.forEach(p => entities.products.add(p));
    
    // Extract measurements with units
    const measurements = content.match(/\b\d+[\s]*(kr|sek|€|\$|USD|EUR|SEK|MB|GB|TB|km|m|cm|kg|g|ton)\b/gi);
    if (measurements) measurements.forEach(m => entities.measurements.add(m));
    
    // Extract prices (more specific)
    const prices = content.match(/\b\d+[\s]*(kr|kronor|sek|€|euro|\$|dollar|USD|EUR|SEK)\b/gi);
    if (prices) prices.forEach(p => entities.prices.add(p));
  }
  
  // Convert Sets to Arrays and remove empty categories
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(entities)) {
    const arr = Array.from(value as Set<string>);
    if (arr.length > 0) {
      result[key] = arr.slice(0, 20); // Limit to 20 per category
    }
  }
  
  return result;
}

/**
 * Build enriched query with entities for better RAG retrieval
 */
export function enrichQueryWithEntities(
  query: string,
  entities: Record<string, any>
): string {
  if (!entities || Object.keys(entities).length === 0) {
    return query;
  }
  
  const entitySummary: string[] = [];
  
  if (entities.products?.length > 0) {
    entitySummary.push(`Products: ${entities.products.join(', ')}`);
  }
  if (entities.partNumbers?.length > 0) {
    entitySummary.push(`Part numbers: ${entities.partNumbers.join(', ')}`);
  }
  if (entities.dates?.length > 0) {
    entitySummary.push(`Dates: ${entities.dates.join(', ')}`);
  }
  if (entities.years?.length > 0) {
    entitySummary.push(`Years: ${entities.years.join(', ')}`);
  }
  
  if (entitySummary.length === 0) {
    return query;
  }
  
  return `${query}\n\nContext from conversation: ${entitySummary.join(' | ')}`;
}

/**
 * Extract entities from recent conversation (AI-powered, more accurate)
 */
export async function extractEntities(
  messages: Array<{ role: string; content: string }>,
  lovableApiKey: string
): Promise<Record<string, any>> {
  try {
    const conversationText = messages
      .slice(-6)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `Extrahera strukturerade entiteter från konversationen. Returnera BARA JSON.
Format: {"delnummer": [...], "modeller": [...], "årsmodeller": [...], "preferenser": {...}, "personer": [...]}`,
          },
          { role: 'user', content: conversationText },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error('Entity extraction failed:', response.status);
      return {};
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    
    // Extract JSON from markdown if present
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[1] || jsonMatch[0]) : {};
  } catch (error) {
    console.error('Entity extraction error:', error);
    return {};
  }
}

/**
 * Update thread summary with new information
 */
export async function summarizeThread(
  prevSummary: string,
  recentMessages: Array<{ role: string; content: string }>,
  lovableApiKey: string
): Promise<string> {
  try {
    const recentText = recentMessages
      .slice(-20)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `Uppdatera sammanfattningen med nya fakta och vad som efterfrågats. Max 2000 tecken.
TIDIGARE SAMMANFATTNING:
${prevSummary || 'Ingen tidigare sammanfattning'}

REGLER:
- Behåll viktiga fakta från tidigare
- Lägg till nya ämnen/preferenser
- Ta bort irrelevant information
- Koncis, faktabaserad stil`,
          },
          { role: 'user', content: `SENASTE MEDDELANDEN:\n${recentText}` },
        ],
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      console.error('Summarization failed:', response.status);
      return prevSummary;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || prevSummary;
  } catch (error) {
    console.error('Summarization error:', error);
    return prevSummary;
  }
}

/**
 * Retrieve thread memory for injection into prompt
 * SPRINT 2: Simplified - removed conversation_insights dependency
 */
export async function getThreadMemory(
  supabase: any,
  conversationId: string
): Promise<ThreadMemory> {
  // SPRINT 2: Return empty memory - conversation_insights removed
  return { threadSummary: '', entities: {}, pinnedFacts: {} };
}

/**
 * Update thread memory after assistant response
 */
export async function updateThreadMemory(
  supabase: any,
  conversationId: string,
  messages: Array<{ role: string; content: string }>,
  assistantText: string,
  lovableApiKey: string
): Promise<void> {
  try {
    const memory = await getThreadMemory(supabase, conversationId);
    
    // Extract new entities
    const newEntities = await extractEntities(
      [...messages.slice(-6), { role: 'assistant', content: assistantText }],
      lovableApiKey
    );

    // Update summary
    const newSummary = await summarizeThread(
      memory.threadSummary,
      [...messages.slice(-20), { role: 'assistant', content: assistantText }],
      lovableApiKey
    );

    // SPRINT 2: Removed conversation_insights insert (unused feature)
    
    console.log('✅ Thread memory update skipped (conversation_insights removed)');
  } catch (error) {
    console.error('Thread memory update error:', error);
  }
}
