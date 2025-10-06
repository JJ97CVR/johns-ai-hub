// PII Detection and Filtering
// Detects and filters personally identifiable information

export interface PIIDetectionResult {
  containsPII: boolean;
  detectedTypes: string[];
  filteredText: string;
}

const piiPatterns = {
  swedish_ssn: {
    pattern: /\b(19|20)\d{6}[-]?\d{4}\b/g,
    name: 'Swedish Personal Number',
    replacement: '[SSN_REDACTED]'
  },
  us_ssn: {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    name: 'US Social Security Number',
    replacement: '[SSN_REDACTED]'
  },
  email: {
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    name: 'Email Address',
    replacement: '[EMAIL_REDACTED]'
  },
  credit_card: {
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    name: 'Credit Card Number',
    replacement: '[CARD_REDACTED]'
  },
  phone: {
    pattern: /\b(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}\b/g,
    name: 'Phone Number',
    replacement: '[PHONE_REDACTED]'
  },
  ip_address: {
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    name: 'IP Address',
    replacement: '[IP_REDACTED]'
  }
};

/**
 * Detect if text contains PII
 */
export function containsPII(text: string): boolean {
  return Object.values(piiPatterns).some(({ pattern }) => {
    // Reset regex lastIndex to avoid state issues
    const regex = new RegExp(pattern.source, pattern.flags);
    return regex.test(text);
  });
}

/**
 * Detect and filter PII from text
 */
export function filterPII(text: string): PIIDetectionResult {
  let filteredText = text;
  const detectedTypes: string[] = [];

  for (const [key, { pattern, name, replacement }] of Object.entries(piiPatterns)) {
    const regex = new RegExp(pattern.source, pattern.flags);
    if (regex.test(text)) {
      detectedTypes.push(name);
      filteredText = filteredText.replace(regex, replacement);
    }
  }

  return {
    containsPII: detectedTypes.length > 0,
    detectedTypes,
    filteredText
  };
}

/**
 * Validate text doesn't contain sensitive PII before processing
 */
export function validateNoPII(text: string): { valid: boolean; error?: string } {
  const result = filterPII(text);
  
  if (result.containsPII) {
    return {
      valid: false,
      error: `Message contains sensitive information (${result.detectedTypes.join(', ')}). Please remove personal data before sending.`
    };
  }

  return { valid: true };
}
