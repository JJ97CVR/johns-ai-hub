/**
 * Application Constants
 * Sprint 6: P3 Items
 * 
 * Centralizes magic numbers and configuration values
 * for better maintainability and documentation.
 */

// ============================================
// FILE UPLOAD LIMITS
// ============================================

/** Maximum file size in bytes (50MB) */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Maximum file size in MB for display */
export const MAX_FILE_SIZE_MB = 50;

/** Allowed file extensions for upload */
export const ALLOWED_FILE_EXTENSIONS = [
  'xlsx', 'xls', 'csv', 'json', 'py', 'txt', 
  'png', 'jpg', 'jpeg', 'pdf'
] as const;

// ============================================
// RATE LIMITING
// ============================================

/** Rate limit: Max requests per window */
export const RATE_LIMIT_MAX_REQUESTS = 100;

/** Rate limit: Time window in milliseconds (1 minute) */
export const RATE_LIMIT_WINDOW_MS = 60000;

/** Rate limit: Refill rate (requests per second) */
export const RATE_LIMIT_REFILL_RATE = 2;

/** Strict rate limit: Max requests per minute */
export const STRICT_RATE_LIMIT_REQUESTS = 10;

// ============================================
// CHAT & MESSAGING
// ============================================

/** Maximum conversation history length in tokens */
export const MAX_HISTORY_TOKENS = {
  fast: 2000,
  auto: 4000,
  extended: 8000,
} as const;

/** Reserved tokens for AI response */
export const RESERVED_TOKENS_RESPONSE = 1024;

/** Reserved tokens for tool calls */
export const RESERVED_TOKENS_TOOLS = 256;

/** Default max iterations for agentic loop */
export const DEFAULT_MAX_ITERATIONS = {
  fast: 1,
  auto: 2,
  extended: 3,
} as const;

/** Message update time window (5 minutes in milliseconds) */
export const MESSAGE_UPDATE_WINDOW_MS = 5 * 60 * 1000;

// ============================================
// CACHING
// ============================================

/** Default cache expiration in days */
export const DEFAULT_CACHE_EXPIRY_DAYS = 14;

/** Feature flag cache TTL in milliseconds (1 minute) */
export const FEATURE_FLAG_CACHE_TTL_MS = 60000;

/** Default confidence score for cached responses */
export const DEFAULT_CONFIDENCE_SCORE = 0.8;

// ============================================
// DATABASE & CLEANUP
// ============================================

/** Analytics retention period in days */
export const ANALYTICS_RETENTION_DAYS = 60;

/** Logs retention period in days */
export const LOGS_RETENTION_DAYS = 30;

/** Audit logs retention period in days */
export const AUDIT_LOGS_RETENTION_DAYS = 90;

/** Rate limits cleanup threshold (2 hours in milliseconds) */
export const RATE_LIMIT_CLEANUP_HOURS = 2;

// ============================================
// RAG & KNOWLEDGE RETRIEVAL
// ============================================

/** Default similarity threshold for knowledge matching */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.7;

/** Default number of knowledge results to retrieve */
export const DEFAULT_TOP_K = 5;

/** Part number pattern for Volvo parts */
export const VOLVO_PART_PATTERN = /\b\d{7,8}\b/;

// ============================================
// TIMEOUTS & DEADLINES
// ============================================

/** Default deadline per mode (in milliseconds) */
export const MODE_DEADLINES = {
  fast: 15000,    // 15 seconds
  auto: 45000,    // 45 seconds
  extended: 90000, // 90 seconds
} as const;

// ============================================
// UI CONSTANTS
// ============================================

/** Avatar initials length */
export const AVATAR_INITIALS_LENGTH = 2;

/** Textarea max height in pixels */
export const TEXTAREA_MAX_HEIGHT = 200;

/** Textarea min height in pixels */
export const TEXTAREA_MIN_HEIGHT = 56;

/** Default conversation title */
export const DEFAULT_CONVERSATION_TITLE = 'New Chat';

// ============================================
// ANALYTICS QUEUE
// ============================================

/** Analytics batch processing size */
export const ANALYTICS_BATCH_SIZE = 100;

/** Analytics processing interval (1 minute) */
export const ANALYTICS_PROCESS_INTERVAL_MS = 60000;

/** Max retry attempts for analytics events */
export const ANALYTICS_MAX_RETRIES = 3;

// ============================================
// DATA RETENTION (Sprint 4)
// ============================================

/** Data retention policies for automated cleanup */
export const RETENTION_POLICIES = {
  ANALYTICS: { days: 60, table: 'query_analytics' },
  LOGS: { days: 30, table: 'structured_logs' },
  AUDIT: { days: 90, table: 'admin_audit_log' },
  RATE_LIMITS: { hours: 2, tables: ['rate_limits', 'model_rate_limits'] },
  CHECKPOINTS: { hours: 1, table: 'loop_checkpoints' },
  SOFT_DELETED: { days: 30, tables: ['conversations', 'messages', 'uploaded_files'] }
} as const;
