/**
 * Parts Module - Volvo artikelnummer hantering
 * Normalisering och detektering av Volvo delsnummer
 */

/**
 * Normaliserar artikelnummer genom att ta bort alla icke-siffror
 * @example "673-797" -> "673797"
 * @example "0673797" -> "0673797"
 */
export function normalizePartNo(input: string): string {
  return input.replace(/\D/g, "");
}

/**
 * Detekterar om en sträng innehåller ett Volvo artikelnummer
 * Matchar:
 * - 6-7 siffriga nummer (673797, 0673797)
 * - 3-3/4 format med bindestreck/space (673-797, 673 797)
 * 
 * @example isVolvoPartNumber("Vad är 673797?") -> true
 * @example isVolvoPartNumber("673-797 för Amazon") -> true
 * @example isVolvoPartNumber("Hur byter jag olja?") -> false
 */
export function isVolvoPartNumber(q: string): boolean {
  // Ta bort allt utom siffror, bindestreck och space
  const s = q.replace(/[^\d\- ]/g, "");
  
  // Match: 6-7 siffror, eller 3-3/4 med ev. bindestreck/space
  return /\b\d{6,7}\b/.test(s) || /\b\d{3}[-\s]?\d{3,4}\b/.test(s);
}
