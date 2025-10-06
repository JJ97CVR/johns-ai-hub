import { describe, it, expect } from 'vitest';
import { extractEntitiesFromMessages, enrichQueryWithEntities } from '../memory.ts';

describe('memory', () => {
  describe('extractEntitiesFromMessages', () => {
    it('should extract dates from messages', () => {
      const messages = [
        { role: 'user', content: 'Boka möte 2025-01-15' },
        { role: 'assistant', content: 'Jag har bokat mötet den 2025-01-20' },
      ];

      const entities = extractEntitiesFromMessages(messages);

      expect(entities.dates).toBeDefined();
      expect(entities.dates).toContain('2025-01-15');
      expect(entities.dates).toContain('2025-01-20');
    });

    it('should extract years from messages', () => {
      const messages = [
        { role: 'user', content: 'Volvo modeller från 2024 och 2025' },
      ];

      const entities = extractEntitiesFromMessages(messages);

      expect(entities.years).toBeDefined();
      expect(entities.years).toContain('2024');
      expect(entities.years).toContain('2025');
    });

    it('should extract part numbers', () => {
      const messages = [
        { role: 'user', content: 'Letar efter artikelnummer 12345-678 och A9876' },
      ];

      const entities = extractEntitiesFromMessages(messages);

      expect(entities.partNumbers).toBeDefined();
      expect(entities.partNumbers.length).toBeGreaterThan(0);
    });

    it('should extract measurements with units', () => {
      const messages = [
        { role: 'user', content: 'Produkten kostar 500 kr och väger 3 kg' },
      ];

      const entities = extractEntitiesFromMessages(messages);

      expect(entities.measurements).toBeDefined();
      expect(entities.measurements.some((m: string) => m.includes('kr'))).toBe(true);
      expect(entities.measurements.some((m: string) => m.includes('kg'))).toBe(true);
    });

    it('should extract prices', () => {
      const messages = [
        { role: 'user', content: 'Priset är 1500 kronor eller 150 euro' },
      ];

      const entities = extractEntitiesFromMessages(messages);

      expect(entities.prices).toBeDefined();
      expect(entities.prices.length).toBeGreaterThan(0);
    });

    it('should limit entities per category', () => {
      const messages = Array(30).fill({ 
        role: 'user', 
        content: '2024-01-01 2024-01-02 2024-01-03 2024-01-04 2024-01-05' 
      });

      const entities = extractEntitiesFromMessages(messages);

      // Should limit to 20 per category
      if (entities.dates) {
        expect(entities.dates.length).toBeLessThanOrEqual(20);
      }
    });

    it('should return empty object for messages without entities', () => {
      const messages = [
        { role: 'user', content: 'Hej, hur mår du?' },
        { role: 'assistant', content: 'Jag mår bra, tack!' },
      ];

      const entities = extractEntitiesFromMessages(messages);

      expect(Object.keys(entities).length).toBe(0);
    });
  });

  describe('enrichQueryWithEntities', () => {
    it('should enrich query with product entities', () => {
      const query = 'Vad kostar denna?';
      const entities = {
        products: ['Volvo XC90', 'Scania R500'],
      };

      const enriched = enrichQueryWithEntities(query, entities);

      expect(enriched).toContain('Volvo XC90');
      expect(enriched).toContain('Scania R500');
      expect(enriched).toContain(query);
    });

    it('should enrich query with part numbers', () => {
      const query = 'Finns det i lager?';
      const entities = {
        partNumbers: ['12345-678', 'A9876'],
      };

      const enriched = enrichQueryWithEntities(query, entities);

      expect(enriched).toContain('12345-678');
      expect(enriched).toContain('A9876');
    });

    it('should enrich query with dates', () => {
      const query = 'När levereras det?';
      const entities = {
        dates: ['2025-01-15'],
      };

      const enriched = enrichQueryWithEntities(query, entities);

      expect(enriched).toContain('2025-01-15');
    });

    it('should return original query when no entities', () => {
      const query = 'Test query';
      const entities = {};

      const enriched = enrichQueryWithEntities(query, entities);

      expect(enriched).toBe(query);
    });

    it('should handle multiple entity types', () => {
      const query = 'Status?';
      const entities = {
        products: ['Product A'],
        dates: ['2025-01-15'],
        partNumbers: ['12345'],
      };

      const enriched = enrichQueryWithEntities(query, entities);

      expect(enriched).toContain('Product A');
      expect(enriched).toContain('2025-01-15');
      expect(enriched).toContain('12345');
    });
  });
});
