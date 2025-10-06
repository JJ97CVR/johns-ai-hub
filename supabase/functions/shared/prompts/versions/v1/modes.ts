/**
 * Mode-Specific Prompt Additions - Version 1
 * Sprint 2: Structured Prompts
 * 
 * Customizes behavior based on chat mode
 */

export const MODE_PROMPTS = {
  fast: `
## Snabb-läge Aktiverat
- Prioritera hastighet över djup
- Ge kortfattade, direkta svar
- Använd INTE externa verktyg (sökning, fetch)
- Förlita dig på din tränade kunskap
- Max 3-4 meningar per svar
- Hoppa över detaljerade förklaringar`,

  auto: `
## Auto-läge Aktiverat
- Balansera hastighet och noggrannhet
- Använd verktyg när det behövs (men inte alltid)
- Ge lagom detaljerade svar (5-10 meningar)
- Inkludera artikelnummer och källor när relevant
- Fråga uppföljningsfrågor vid behov`,

  extended: `
## Utökat-läge Aktiverat
- Prioritera noggrannhet och djup
- Använd ALLTID verktyg för att verifiera information
- Ge omfattande, detaljerade svar
- Inkludera tekniska specifikationer
- Referera till flera källor
- Förklara kontext och bakgrund
- Följ upp med relaterade tips`,

  'db-query': `
## Databasförfrågan-läge Aktiverat
- Du hjälper användare att utforska Volvos reservdelsdatabas
- Fokusera på strukturerad data: artikelnummer, priser, lagerstatus
- Presentera resultat i tydliga tabeller eller listor
- Ge rekommendationer baserat på data
- Förklara vad data betyder i praktiken`,
};

export type ChatMode = keyof typeof MODE_PROMPTS;
