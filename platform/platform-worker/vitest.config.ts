import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

/**
 * Static ES256 test key pair.
 * The public key is set as AUTH_JWT_PUBLIC_KEY binding so the worker's
 * verifyJwt() can validate tokens signed by the matching private key.
 *
 * The private key (PKCS8 PEM) is exposed to tests via a binding so they
 * can import it with jose and sign test JWTs at runtime.
 */
const TEST_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEm9G4OYaSkYT2uA8CePRe6mQBznUe
jHBMRIok15KCnNuIOscb57kyE9IXLxi1Z/qpKx14ulGrX2ro1ukdFVIqBA==
-----END PUBLIC KEY-----`

const TEST_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg8mcUFyqt9/9nZDVm
ZcuAY4WJ1b0ikbSDnnsdts3L6OmhRANCAASb0bg5hpKRhPa4DwJ49F7qZAHOdR6M
cExEiiTXkoKc24g6xxvnuTIT0hcvGLVn+qkrHXi6UatfaujW6R0VUioE
-----END PRIVATE KEY-----`

const TEST_ISSUER = 'https://auth.test.deep.space'

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        bindings: {
          AUTH_JWT_PUBLIC_KEY: TEST_PUBLIC_KEY_PEM,
          AUTH_JWT_ISSUER: TEST_ISSUER,
          INTERNAL_STORAGE_HMAC_SECRET: 'test-hmac-secret-key-for-internal-auth',
          PLATFORM_IDENTITY_SECRET: 'test-platform-identity-secret',
          TEST_PRIVATE_KEY_PEM: TEST_PRIVATE_KEY_PEM,
        },
      },
    }),
  ],
  test: {
    fileParallelism: false,
  },
})
