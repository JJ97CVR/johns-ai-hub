/**
 * Centralized Timeout Configuration
 * Single source of truth for all timeout values across the application
 */

/**
 * Get timeout value from environment or use default
 */
function getTimeout(envKey: string, defaultValue: number): number {
  const value = Deno.env.get(envKey);
  return value ? parseInt(value, 10) : defaultValue;
}

export const TIMEOUTS = {
  // Frontend timeouts (client-side)
  FRONTEND_TIMEOUT: getTimeout('FRONTEND_TIMEOUT', 90000), // 90s
  ACTIVITY_TIMEOUT: getTimeout('ACTIVITY_TIMEOUT', 60000), // 60s
  
  // API timeouts (backend-side)
  API_TIMEOUT: getTimeout('API_TIMEOUT', 30000), // 30s
  
  // Mode-specific deadlines
  FAST_MODE: 7000,      // 7s for fast mode
  AUTO_MODE: 25000,     // 25s for auto mode (increased from 18s)
  EXTENDED_MODE: 30000, // 30s for extended mode
} as const;

/**
 * Get mode-specific deadline
 */
export function getModeDeadline(mode: 'fast' | 'auto' | 'extended'): number {
  switch (mode) {
    case 'fast':
      return TIMEOUTS.FAST_MODE;
    case 'extended':
      return TIMEOUTS.EXTENDED_MODE;
    default:
      return TIMEOUTS.AUTO_MODE;
  }
}
