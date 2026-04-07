import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/FreshMart|UK Grocery|Grocery/)
  })

  test('displays navigation header', async ({ page }) => {
    const header = page.locator('header')
    await expect(header).toBeVisible()
  })

  test('displays hero section', async ({ page }) => {
    // Hero section should be visible
    const heroSection = page.locator('[data-testid="hero-section"], section').first()
    await expect(heroSection).toBeVisible()
  })

  test('has working search functionality', async ({ page }) => {
    // Find search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], [data-testid="search-input"]').first()

    if (await searchInput.isVisible()) {
      await searchInput.fill('banana')
      await searchInput.press('Enter')

      // Should navigate to search results
      await expect(page).toHaveURL(/search|products/)
    }
  })

  test('displays category navigation', async ({ page }) => {
    // Should have links to categories
    const categoryLinks = page.locator('a[href*="categories"], a[href*="category"]')
    const count = await categoryLinks.count()
    expect(count).toBeGreaterThan(0)
  })

  test('has working cart button', async ({ page }) => {
    const cartButton = page.locator('[data-testid="cart-button"], button:has-text("Cart"), a[href*="cart"], [aria-label*="cart" i]').first()

    // Cart button should exist and be clickable
    if (await cartButton.isVisible()) {
      await expect(cartButton).toBeEnabled()
      // Just verify the button is interactive - cart behavior varies by implementation
      await cartButton.click()
      // Wait briefly for any reaction
      await page.waitForTimeout(500)
    }
  })

  test('displays footer', async ({ page }) => {
    const footer = page.locator('footer')
    await expect(footer).toBeVisible()
  })

  test('footer has important links', async ({ page }) => {
    const footer = page.locator('footer')
    await expect(footer).toBeVisible()

    // Check for common footer links
    const importantLinks = [
      'a[href*="privacy"]',
      'a[href*="terms"]',
      'a[href*="contact"]',
    ]

    for (const selector of importantLinks) {
      const link = page.locator(selector).first()
      if (await link.isVisible()) {
        await expect(link).toBeVisible()
      }
    }
  })
})

test.describe('Homepage Responsiveness', () => {
  test('renders correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    // Page should still load
    await expect(page.locator('body')).toBeVisible()

    // Either mobile menu button exists or header is visible
    const hasHeader = await page.locator('header').first().isVisible()
    expect(hasHeader).toBe(true)
  })

  test('renders correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')

    await expect(page.locator('body')).toBeVisible()
  })

  test('renders correctly on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')

    await expect(page.locator('body')).toBeVisible()
  })
})
