// Common spelling mistakes in Swedish/English queries
const commonFixes: Record<string, string> = {
  'automtoive': 'automotive',
  'amazo': 'amazon',
  'volv': 'volvo',
  'lexx': 'lex',
  'databas': 'database',
  'personl': 'personal',
};

export function suggestSpellingFix(query: string): string | null {
  const words = query.toLowerCase().split(/\s+/);
  let hasChanges = false;
  
  const fixed = words.map(word => {
    const cleaned = word.replace(/[.,!?;:]/g, '');
    if (commonFixes[cleaned]) {
      hasChanges = true;
      return commonFixes[cleaned];
    }
    return word;
  }).join(' ');
  
  return hasChanges ? fixed : null;
}
