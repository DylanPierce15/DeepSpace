/**
 * Playwright global teardown — no-op.
 *
 * The E2E runner script handles undeploy via `deepspace undeploy`.
 */

export default async function globalTeardown() {
  // Teardown handled by the E2E runner script
}
