import { describe, it, expect } from 'vitest';
import { filterPII } from '../pii-filter.ts';

describe('pii-filter', () => {
  describe('Swedish Personal Numbers', () => {
    it('should redact valid Swedish personal numbers', () => {
      const result = filterPII('Mitt personnummer är 19900101-1234');
      expect(result.filteredText).toBe('Mitt personnummer är [SSN_REDACTED]');
      expect(result.containsPII).toBe(true);
      expect(result.detectedTypes).toContain('Swedish Personal Number');
    });

    it('should redact personal numbers without dash', () => {
      const result = filterPII('Personnummer: 199001011234');
      expect(result.filteredText).toContain('[SSN_REDACTED]');
    });

    it('should not redact product numbers', () => {
      const result = filterPII('Produktnummer 123456-7890');
      expect(result.filteredText).not.toContain('[SSN_REDACTED]');
    });

    it('should not redact phone numbers', () => {
      const result = filterPII('Ring 0701234567');
      expect(result.filteredText).not.toContain('[SSN_REDACTED]');
    });
  });

  describe('Email Addresses', () => {
    it('should redact email addresses', () => {
      const result = filterPII('Kontakta mig på user@example.com');
      expect(result.filteredText).toBe('Kontakta mig på [EMAIL_REDACTED]');
      expect(result.containsPII).toBe(true);
      expect(result.detectedTypes).toContain('Email Address');
    });

    it('should redact multiple emails', () => {
      const result = filterPII('Emails: user1@test.com och user2@test.com');
      expect(result.filteredText).toBe('Emails: [EMAIL_REDACTED] och [EMAIL_REDACTED]');
    });
  });

  describe('Phone Numbers', () => {
    it('should redact Swedish phone numbers', () => {
      const result = filterPII('Ring 070-123 45 67');
      expect(result.filteredText).toBe('Ring [PHONE_REDACTED]');
      expect(result.containsPII).toBe(true);
      expect(result.detectedTypes).toContain('Phone Number');
    });

    it('should redact international phone numbers', () => {
      const result = filterPII('Call +46 70 123 45 67');
      expect(result.filteredText).toBe('Call [PHONE_REDACTED]');
    });
  });

  describe('IP Addresses', () => {
    it('should redact valid IP addresses', () => {
      const result = filterPII('Server IP: 192.168.1.1');
      expect(result.filteredText).toBe('Server IP: [IP_REDACTED]');
      expect(result.containsPII).toBe(true);
      expect(result.detectedTypes).toContain('IP Address');
    });

    it('should not redact version numbers', () => {
      const result = filterPII('Version 1.2.3.4');
      expect(result.filteredText).toBe('Version 1.2.3.4');
      expect(result.containsPII).toBe(false);
    });

    it('should not redact invalid IP addresses', () => {
      const result = filterPII('Invalid IP: 999.999.999.999');
      expect(result.filteredText).toBe('Invalid IP: 999.999.999.999');
    });
  });

  describe('Credit Card Numbers', () => {
    it('should redact credit card numbers', () => {
      const result = filterPII('Card: 4532-1234-5678-9010');
      expect(result.filteredText).toBe('Card: [CARD_REDACTED]');
      expect(result.containsPII).toBe(true);
      expect(result.detectedTypes).toContain('Credit Card Number');
    });

    it('should redact cards without dashes', () => {
      const result = filterPII('Card: 4532123456789010');
      expect(result.filteredText).toBe('Card: [CARD_REDACTED]');
    });
  });

  describe('Multiple PII Types', () => {
    it('should detect and redact multiple PII types', () => {
      const text = 'Kontakt: user@test.com, tel 070-1234567, personnummer 19900101-1234';
      const result = filterPII(text);
      
      expect(result.containsPII).toBe(true);
      expect(result.detectedTypes).toContain('Email Address');
      expect(result.detectedTypes).toContain('Phone Number');
      expect(result.detectedTypes).toContain('Swedish Personal Number');
      expect(result.filteredText).not.toContain('user@test.com');
      expect(result.filteredText).not.toContain('070-1234567');
      expect(result.filteredText).not.toContain('19900101-1234');
    });
  });

  describe('No PII', () => {
    it('should return original text when no PII detected', () => {
      const text = 'Hej! Hur mår du? Jag vill veta om produkten.';
      const result = filterPII(text);
      
      expect(result.containsPII).toBe(false);
      expect(result.filteredText).toBe(text);
      expect(result.detectedTypes).toEqual([]);
    });
  });
});
