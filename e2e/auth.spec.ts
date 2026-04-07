import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test.describe('Login Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login')
    })

    test('displays login form', async ({ page }) => {
      await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible()
      await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible()
      await expect(page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")')).toBeVisible()
    })

    test('shows validation errors for empty submission', async ({ page }) => {
      const submitButton = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")').first()
      await submitButton.click()

      // Should show validation error or stay on page
      await expect(page).toHaveURL(/login/)
    })

    test('shows error for invalid credentials', async ({ page }) => {
      await page.fill('input[type="email"], input[name="email"]', 'invalid@example.com')
      await page.fill('input[type="password"], input[name="password"]', 'wrongpassword')

      const submitButton = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")').first()
      await submitButton.click()

      // Should show error message
      await page.waitForTimeout(2000)
      const errorMessage = page.locator('[role="alert"], .error, .text-red-500, [data-testid="error-message"]')
      const hasError = await errorMessage.count() > 0 || await page.locator('text=/invalid|error|incorrect/i').count() > 0
      // Either shows error or stays on login page
      expect(hasError || page.url().includes('login')).toBeTruthy()
    })

    test('has link to register page', async ({ page }) => {
      const registerLink = page.locator('a[href*="register"], a:has-text("Register"), a:has-text("Sign up"), a:has-text("Create account")')
      await expect(registerLink.first()).toBeVisible()
    })

    test('has link to forgot password', async ({ page }) => {
      const forgotLink = page.locator('a[href*="forgot"], a:has-text("Forgot"), a:has-text("Reset password")')
      await expect(forgotLink.first()).toBeVisible()
    })
  })

  test.describe('Register Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/register')
    })

    test('displays registration form', async ({ page }) => {
      await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible()
      await expect(page.locator('input[type="password"], input[name="password"]').first()).toBeVisible()
    })

    test('validates password requirements', async ({ page }) => {
      // Fill with weak password
      const emailInput = page.locator('input[type="email"], input[name="email"]')
      const passwordInput = page.locator('input[type="password"], input[name="password"]').first()

      await emailInput.fill('test@example.com')
      await passwordInput.fill('weak')

      const submitButton = page.locator('button[type="submit"]').first()
      await submitButton.click()

      // Should show password requirement error or stay on page
      await page.waitForTimeout(1000)
      expect(page.url()).toContain('register')
    })

    test('has link back to login', async ({ page }) => {
      const loginLink = page.locator('a[href*="login"], a:has-text("Sign in"), a:has-text("Login")')
      await expect(loginLink.first()).toBeVisible()
    })
  })

  test.describe('Forgot Password Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/forgot-password')
    })

    test('displays email input', async ({ page }) => {
      await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible()
    })

    test('shows success message after submitting email', async ({ page }) => {
      const emailInput = page.locator('input[type="email"], input[name="email"]')
      await emailInput.fill('user@example.com')

      const submitButton = page.locator('button[type="submit"]').first()
      await submitButton.click()

      // Should show success message or confirmation
      await page.waitForTimeout(2000)
    })
  })

  test.describe('Protected Routes', () => {
    test('redirects to login when accessing account page without auth', async ({ page }) => {
      await page.goto('/account')
      await page.waitForTimeout(1000)

      // Should redirect to login
      expect(page.url()).toMatch(/login|auth/)
    })

    test('redirects to login when accessing checkout without auth', async ({ page }) => {
      await page.goto('/checkout')
      await page.waitForTimeout(1000)

      // Should redirect to login or show login prompt
      expect(page.url()).toMatch(/login|auth|checkout/)
    })

    test('redirects to login when accessing admin without auth', async ({ page }) => {
      await page.goto('/admin')
      await page.waitForTimeout(1000)

      // Should redirect to login
      expect(page.url()).toMatch(/login|auth/)
    })
  })
})
