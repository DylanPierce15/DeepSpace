/**
 * Canvas feature tests.
 *
 * Tests the canvas collaboration feature:
 * - Page load and document list
 * - Create and delete canvas documents
 * - Add, move, and delete shapes
 * - Shape persistence across page reloads
 * - Two-user real-time collaboration
 */

import { test, expect, APP_URL } from './fixtures'
import { signIn } from './helpers'

const CANVAS_URL = `${APP_URL}/canvas`

/** Navigate to canvas page, sign in, wait for page to be ready. */
async function goToCanvasSignedIn(page: import('@playwright/test').Page, user: 1 | 2 = 1) {
  await page.goto(CANVAS_URL, { waitUntil: 'networkidle' })
  await signIn(page, user)
  await expect(page.locator('[data-testid="canvas-page"]')).toBeVisible({ timeout: 20_000 })
}

/** Create a new canvas and wait for the canvas view to appear. Returns the canvas title. */
async function createCanvas(page: import('@playwright/test').Page, title?: string) {
  const name = title ?? `canvas-${Date.now()}`
  await page.locator('[data-testid="canvas-create-btn"]').click()
  await page.locator('[data-testid="canvas-title-input"]').fill(name)
  await page.locator('[data-testid="canvas-create-submit"]').click()
  // Wait for canvas card to appear in list
  await expect(page.locator(`text=${name}`)).toBeVisible({ timeout: 10_000 })
  return name
}

/** Click a canvas card to open it and wait for the canvas view. */
async function openCanvas(page: import('@playwright/test').Page, title: string) {
  await page.locator(`text=${title}`).click()
  await expect(page.locator('[data-testid="canvas-view"]')).toBeVisible({ timeout: 10_000 })
}

/** Select the rectangle tool and draw a shape on the canvas. */
async function drawRect(page: import('@playwright/test').Page) {
  await page.locator('[data-testid="tool-rect"]').click()
  const svg = page.locator('[data-testid="canvas-svg"]')
  const box = await svg.boundingBox()
  if (!box) throw new Error('SVG not found')
  // Draw from center area
  const startX = box.x + box.width / 3
  const startY = box.y + box.height / 3
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 120, startY + 80, { steps: 5 })
  await page.mouse.up()
}

// ============================================================================
// Page load
// ============================================================================

test.describe('canvas — page load', () => {
  test('shows canvas page after sign-in', async ({ page }) => {
    await goToCanvasSignedIn(page)
    await expect(page.locator('[data-testid="canvas-page"]')).toBeVisible()
  })

  test('shows create button for authenticated users', async ({ page }) => {
    await goToCanvasSignedIn(page)
    await expect(page.locator('[data-testid="canvas-create-btn"]')).toBeVisible()
  })
})

// ============================================================================
// Create and manage documents
// ============================================================================

test.describe('canvas — documents', () => {
  test('can create a canvas document', async ({ page }) => {
    await goToCanvasSignedIn(page)
    const title = await createCanvas(page)
    await expect(page.locator(`text=${title}`)).toBeVisible()
  })

  test('can open a canvas document', async ({ page }) => {
    await goToCanvasSignedIn(page)
    const title = await createCanvas(page)
    await openCanvas(page, title)
    await expect(page.locator('[data-testid="canvas-toolbar"]')).toBeVisible()
  })

  test('can navigate back from canvas to list', async ({ page }) => {
    await goToCanvasSignedIn(page)
    const title = await createCanvas(page)
    await openCanvas(page, title)
    await page.locator('[data-testid="canvas-back"]').click()
    await expect(page.locator('[data-testid="canvas-create-btn"]')).toBeVisible({ timeout: 5_000 })
  })
})

// ============================================================================
// Shape operations
// ============================================================================

test.describe('canvas — shapes', () => {
  test('can add a rectangle shape', async ({ page }) => {
    await goToCanvasSignedIn(page)
    const title = await createCanvas(page)
    await openCanvas(page, title)
    await drawRect(page)
    // After drawing, tool switches to select and a shape should exist
    const shapes = page.locator('[data-testid^="shape-"]')
    await expect(shapes.first()).toBeVisible({ timeout: 10_000 })
  })

  test('can select and delete a shape', async ({ page }) => {
    await goToCanvasSignedIn(page)
    const title = await createCanvas(page)
    await openCanvas(page, title)
    await drawRect(page)

    const shape = page.locator('[data-testid^="shape-"]').first()
    await expect(shape).toBeVisible({ timeout: 10_000 })

    // Click shape to select it
    await shape.click()
    // Delete via toolbar
    await page.locator('[data-testid="canvas-delete"]').click()
    await expect(page.locator('[data-testid^="shape-"]')).not.toBeVisible({ timeout: 5_000 })
  })

  test('can move a shape by dragging', async ({ page }) => {
    await goToCanvasSignedIn(page)
    const title = await createCanvas(page)
    await openCanvas(page, title)
    await drawRect(page)

    const shape = page.locator('[data-testid^="shape-"]').first()
    await expect(shape).toBeVisible({ timeout: 10_000 })

    // Get initial position
    const box = await shape.boundingBox()
    if (!box) throw new Error('Shape not found')

    // Drag shape
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50, { steps: 5 })
    await page.mouse.up()

    // Shape should still exist after move
    await expect(page.locator('[data-testid^="shape-"]').first()).toBeVisible()
  })
})

// ============================================================================
// Persistence
// ============================================================================

test.describe('canvas — persistence', () => {
  test('shapes persist after page reload', async ({ page }) => {
    await goToCanvasSignedIn(page)
    const title = await createCanvas(page)
    await openCanvas(page, title)
    await drawRect(page)
    await expect(page.locator('[data-testid^="shape-"]').first()).toBeVisible({ timeout: 10_000 })

    // Reload and navigate back to the same canvas
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="canvas-page"]')).toBeVisible({ timeout: 20_000 })
    await openCanvas(page, title)
    await expect(page.locator('[data-testid^="shape-"]').first()).toBeVisible({ timeout: 10_000 })
  })
})

// ============================================================================
// Two users
// ============================================================================

test.describe('canvas — two users', () => {
  test('user 2 sees shapes from user 1 in real time', async ({ browser }) => {
    // User 1 creates a canvas and draws a shape
    const ctx1 = await browser.newContext()
    const page1 = await ctx1.newPage()
    await goToCanvasSignedIn(page1, 1)
    const title = await createCanvas(page1)
    await openCanvas(page1, title)
    await drawRect(page1)
    await expect(page1.locator('[data-testid^="shape-"]').first()).toBeVisible({ timeout: 10_000 })

    // User 2 opens the same canvas
    const ctx2 = await browser.newContext()
    const page2 = await ctx2.newPage()
    await goToCanvasSignedIn(page2, 2)
    await openCanvas(page2, title)

    // User 2 should see the shape
    await expect(page2.locator('[data-testid^="shape-"]').first()).toBeVisible({ timeout: 10_000 })

    await ctx1.close()
    await ctx2.close()
  })
})
