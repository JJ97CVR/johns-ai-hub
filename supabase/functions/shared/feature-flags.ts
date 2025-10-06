/**
 * Feature Flags Module
 * Sprint 6: Architecture
 * 
 * Provides runtime configuration through database-backed feature flags.
 * Enables A/B testing, gradual rollouts, and kill switches without deployments.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Feature flag configuration
 */
export interface FeatureFlag {
  flag_key: string;
  enabled: boolean;
  description?: string;
  config?: Record<string, any>;
}

// In-memory cache for feature flags
let flagCache: Map<string, FeatureFlag> = new Map();
let lastCacheUpdate = 0;
const CACHE_TTL_MS = 60000; // 1 minute

/**
 * Check if a feature flag is enabled
 * 
 * @param supabase - Supabase client
 * @param flagKey - The feature flag key to check
 * @returns True if the flag is enabled, false otherwise
 * 
 * @example
 * ```typescript
 * const webSearchEnabled = await isFeatureEnabled(supabase, 'web_search');
 * if (webSearchEnabled) {
 *   // Use web search tool
 * }
 * ```
 */
export async function isFeatureEnabled(
  supabase: SupabaseClient,
  flagKey: string
): Promise<boolean> {
  const flag = await getFeatureFlag(supabase, flagKey);
  return flag?.enabled ?? false;
}

/**
 * Get a feature flag with its configuration
 * 
 * @param supabase - Supabase client
 * @param flagKey - The feature flag key
 * @returns The feature flag object or null
 */
export async function getFeatureFlag(
  supabase: SupabaseClient,
  flagKey: string
): Promise<FeatureFlag | null> {
  // Check cache first
  const now = Date.now();
  if (now - lastCacheUpdate < CACHE_TTL_MS && flagCache.has(flagKey)) {
    return flagCache.get(flagKey)!;
  }

  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('flag_key', flagKey)
      .single();

    if (error || !data) {
      console.warn(`Feature flag '${flagKey}' not found, defaulting to disabled`);
      return null;
    }

    // Update cache
    flagCache.set(flagKey, data);
    lastCacheUpdate = now;

    return data;
  } catch (error) {
    console.error(`Error fetching feature flag '${flagKey}':`, error);
    return null;
  }
}

/**
 * Get configuration value from a feature flag
 * 
 * @param supabase - Supabase client
 * @param flagKey - The feature flag key
 * @param configKey - The configuration key within the flag
 * @param defaultValue - Default value if flag or config not found
 * @returns The configuration value
 * 
 * @example
 * ```typescript
 * const maxResults = await getFeatureConfig(supabase, 'web_search', 'max_results', 5);
 * ```
 */
export async function getFeatureConfig<T = any>(
  supabase: SupabaseClient,
  flagKey: string,
  configKey: string,
  defaultValue: T
): Promise<T> {
  const flag = await getFeatureFlag(supabase, flagKey);
  
  if (!flag?.enabled || !flag.config) {
    return defaultValue;
  }

  return (flag.config[configKey] as T) ?? defaultValue;
}

/**
 * Refresh the feature flag cache
 * Call this when you know flags have been updated
 */
export function clearFeatureFlagCache(): void {
  flagCache.clear();
  lastCacheUpdate = 0;
}

/**
 * Get all enabled features (for debugging/monitoring)
 */
export async function getEnabledFeatures(
  supabase: SupabaseClient
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('flag_key')
      .eq('enabled', true);

    if (error || !data) {
      return [];
    }

    return data.map(f => f.flag_key);
  } catch (error) {
    console.error('Error fetching enabled features:', error);
    return [];
  }
}
