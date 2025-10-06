/**
 * Part Number Intelligence
 * Känner igen och hanterar Volvo artikelnummer smart
 */

export interface PartNumberInfo {
  isPartNumber: boolean;
  partNumber?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface QueryStrategy {
  tools: string[];
  enhancedQuery: string;
  priority: 'knowledge_base' | 'web' | 'auto';
}

/**
 * Känner igen om en query innehåller ett artikelnummer
 */
export function detectPartNumber(query: string): PartNumberInfo {
  // Volvo artikelnummer är ofta 6-7 siffror
  const partNoMatch = query.match(/\b(\d{6,7})\b/);
  
  if (!partNoMatch) {
    return { isPartNumber: false, confidence: 'low' };
  }
  
  const partNumber = partNoMatch[1];
  
  // High confidence om frågan innehåller bil-relaterade ord
  const carContext = /volvo|amazon|bil|del|reserv|artikel/i.test(query);
  const locationContext = /vart|var|sitter|finns|placering|monterad/i.test(query);
  
  return {
    isPartNumber: true,
    partNumber,
    confidence: (carContext || locationContext) ? 'high' : 'medium'
  };
}

/**
 * Bestäm optimal tool-strategi baserat på query-typ
 */
export function determineQueryStrategy(query: string): QueryStrategy {
  const partInfo = detectPartNumber(query);
  
  // CASE 1: Artikelnummer-sökning
  if (partInfo.isPartNumber && partInfo.confidence === 'high') {
    const enhancedQuery = enhancePartNumberQuery(query, partInfo.partNumber!);
    
    // Om frågan är om placering → Sök webben först (oftast mer aktuellt)
    if (/vart|var|sitter|placering|monterad/i.test(query)) {
      return {
        tools: ['web_search', 'knowledge_base_search'],
        enhancedQuery,
        priority: 'web'
      };
    }
    
    // Om frågan är om specifikation → Sök KB först (mer tillförlitligt)
    return {
      tools: ['knowledge_base_search', 'web_search'],
      enhancedQuery,
      priority: 'knowledge_base'
    };
  }
  
  // CASE 2: Generell teknisk fråga
  if (/hur|vad är|förklara|fungerar|betyder/i.test(query)) {
    return {
      tools: ['knowledge_base_search', 'web_search'],
      enhancedQuery: query,
      priority: 'knowledge_base'
    };
  }
  
  // CASE 3: Aktuell info (priser, tillgänglighet)
  if (/pris|kostar|finns|tillgänglig|beställa|köpa/i.test(query)) {
    return {
      tools: ['web_search'],
      enhancedQuery: query,
      priority: 'web'
    };
  }
  
  // DEFAULT: Auto-strategi
  return {
    tools: ['auto'],
    enhancedQuery: query,
    priority: 'auto'
  };
}

/**
 * Förbättra artikelnummer-query för bättre sökresultat
 */
function enhancePartNumberQuery(originalQuery: string, partNumber: string): string {
  // Behåll original query men lägg till kontext för bättre resultat
  const hasVolvo = /volvo/i.test(originalQuery);
  const prefix = hasVolvo ? '' : 'Volvo ';
  
  // Lägg till relevanta sökord
  if (/vart|var|sitter|placering/i.test(originalQuery)) {
    return `${prefix}artikelnummer ${partNumber} placering funktion beskrivning`;
  }
  
  if (/vad är|vad gör|funktion/i.test(originalQuery)) {
    return `${prefix}artikelnummer ${partNumber} specifikation funktion`;
  }
  
  return `${prefix}artikelnummer ${partNumber} reservdel`;
}

/**
 * Formatera svar baserat på query-typ
 */
export function formatPartNumberResponse(
  query: string,
  partNumber: string,
  results: { web?: string; kb?: string }
): string {
  const isLocationQuery = /vart|var|sitter|placering/i.test(query);
  
  if (isLocationQuery) {
    return `📍 **Artikelnummer ${partNumber}**

${results.web || results.kb || 'Information ej hittad'}

💡 *Tips: Dubbelkolla alltid artikelnumret mot din specifika Volvo-modell*`;
  }
  
  return `🔧 **Artikelnummer ${partNumber}**

${results.web || results.kb || 'Information ej hittad'}`;
}

/**
 * EXEMPEL PÅ ANVÄNDNING:
 * 
 * // I din chat/index.ts:
 * import { determineQueryStrategy, formatPartNumberResponse } from './part-intelligence.ts';
 * 
 * const strategy = determineQueryStrategy(message);
 * 
 * if (strategy.priority === 'web') {
 *   // Kör web search först
 *   const webResults = await tools.web_search(strategy.enhancedQuery);
 *   return formatPartNumberResponse(message, partNumber, { web: webResults });
 * }
 */
