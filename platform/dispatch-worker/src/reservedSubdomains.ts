/**
 * Reserved Subdomains for app.space
 *
 * Subdomains that cannot be claimed by users for deployments.
 * Enforced at both deploy-time (API) and request-time (dispatch worker).
 *
 * Categories:
 *   - Infrastructure: subdomains used by platform services (Clerk, DNS, etc.)
 *   - Platform: official product pages and services
 *   - Auth/Security: prevent phishing and confusion with auth flows
 *   - Email: protect email-related subdomains (emails send from {name}@app.space)
 *   - Environment: staging, dev, test, etc.
 *   - Generic: common subdomains that should never be user-controlled
 *
 * Ported verbatim from Miyagi3 `packages/shared-utils/src/reservedSubdomains.ts`.
 */

// ── Infrastructure ──────────────────────────────────────────────────────────
// Subdomains actively used by the platform or likely to be used for services.

const INFRASTRUCTURE = [
  'clerk',       // Clerk auth proxy (clerk.app.space)
  'api',         // API gateway
  'cdn',         // Content delivery
  'ns', 'ns1', 'ns2', 'ns3', 'ns4', // DNS nameservers
  'dns',         // DNS
  'ftp', 'sftp', // File transfer
  'smtp', 'imap', 'pop', 'pop3', // Mail servers
  'mx',          // Mail exchange
  'ws', 'wss',   // WebSocket
  'static',      // Static assets
  'assets',      // Asset hosting
  'media',       // Media hosting
  'images', 'img', // Image hosting
  'files',       // File hosting
] as const

// ── Platform ────────────────────────────────────────────────────────────────
// Official product pages, docs, and services.

const PLATFORM = [
  'www',         // Root redirect
  'admin',       // Admin panel
  // 'dashboard' — removed: used by internal app (dashboard.app.space)
  'console',     // Console
  'app', 'apps', // Confusing with app.space itself
  // 'docs' — removed: used by internal app (docs.app.space)
  'status',      // Status page
  'support',     // Support portal
  'help',        // Help center
  'blog',        // Blog
  'about',       // About page
  'legal',       // Legal
  'terms',       // Terms of service
  'privacy',     // Privacy policy
  'deep', 'deepspace', 'deep-space', // Brand name
  'miyagi',      // Product name
  'spaces',      // Product name
] as const

// ── Auth & Security ─────────────────────────────────────────────────────────
// Prevent phishing by blocking subdomains that look like auth flows.

const AUTH_SECURITY = [
  'login', 'signin', 'sign-in',
  'logout', 'signout', 'sign-out',
  'signup', 'sign-up', 'register',
  'auth', 'oauth', 'sso',
  'account', 'accounts',
  'billing', 'payment', 'pay', 'checkout', 'subscribe',
  'security', 'verify', 'confirm',
  'reset', 'password', 'forgot',
  'token', 'tokens',
  'session', 'sessions',
] as const

// ── Email ───────────────────────────────────────────────────────────────────
// Emails are sent from {name}@app.space — protect standard mailbox names.

const EMAIL = [
  // 'mail' — removed: used by internal app (mail.app.space), no DNS conflict
  'email',
  'noreply', 'no-reply',
  'postmaster',
  'abuse',
  'webmaster',
  'hostmaster',
  'mailer-daemon',
  'info',
  'contact',
  'newsletter',
] as const

// ── Environment ─────────────────────────────────────────────────────────────
// Environment / lifecycle names that shouldn't be user subdomains.

const ENVIRONMENT = [
  'staging', 'stg',
  'dev', 'development',
  'test', 'testing',
  'sandbox',
  'demo',
  'preview',
  'prod', 'production',
  'beta', 'alpha', 'canary',
  'localhost', 'local',
  'internal',
] as const

// ── Generic Reserved ────────────────────────────────────────────────────────
// Common reserved words and edge cases.

const GENERIC = [
  'system', 'root',
  'null', 'undefined', 'void',
  'true', 'false',
  'config', 'settings',
  'proxy',
  'redirect',
  'webhook', 'webhooks',
  'graphql',
  'rest',
  'download', 'downloads',
  'upload', 'uploads',
  'search',
  'store', 'shop',
  'home',
  'new', 'create', 'edit', 'delete',
] as const

// ── Merged Set ──────────────────────────────────────────────────────────────

/**
 * Complete set of reserved subdomain names (lowercased).
 * Use `isReservedSubdomain()` for validation — it handles case-insensitivity.
 */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  ...INFRASTRUCTURE,
  ...PLATFORM,
  ...AUTH_SECURITY,
  ...EMAIL,
  ...ENVIRONMENT,
  ...GENERIC,
])

/**
 * Check whether a subdomain name is reserved and cannot be used for deployments.
 *
 * @param name - The subdomain / app name to check (case-insensitive)
 * @returns `true` if the name is reserved
 */
export function isReservedSubdomain(name: string): boolean {
  return RESERVED_SUBDOMAINS.has(name.toLowerCase())
}

/**
 * Validate an app name for deployment, returning a human-readable error
 * if the name is reserved.
 *
 * @param name - The app name to validate
 * @returns `null` if valid, or an error message string if reserved
 */
export function validateAppName(name: string): string | null {
  if (isReservedSubdomain(name)) {
    return `"${name}" is a reserved subdomain and cannot be used for deployments. Please choose a different name.`
  }
  return null
}
