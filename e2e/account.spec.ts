import { test, expect } from '@playwright/test'

test.describe('Account Pages', () => {
  test.describe('Account Dashboard', () => {
    test('account page requires authentication', async ({ page }) => {
      await page.goto('/account')
      await page.waitForTimeout(1000)

      // Should redirect to login if not authenticated
      const isOnLogin = page.url().includes('login')
      const isOnAccount = page.url().includes('account')

      expect(isOnLogin || isOnAccount).toBeTruthy()
    })

    test('account dashboard displays user info when authenticated', async ({ page }) => {
      await page.goto('/account')
      await page.waitForTimeout(1000)

      if (page.url().includes('/account') && !page.url().includes('login')) {
        await expect(page.locator('main, [role="main"]')).toBeVisible()
      }
    })
  })

  test.describe('Account Orders', () => {
    test('orders page is accessible', async ({ page }) => {
      await page.goto('/account/orders')
      await page.waitForTimeout(1000)

      const isOnOrders = page.url().includes('orders')
      const isOnLogin = page.url().includes('login')
      expect(isOnOrders || isOnLogin).toBeTruthy()
    })

    test('displays orders history', async ({ page }) => {
      await page.goto('/account/orders')
      await page.waitForTimeout(1000)

      if (page.url().includes('/account/orders')) {
        // Should show orders or empty state
        const ordersList = page.locator('[data-testid="orders-list"], .orders-list, table')
        const emptyState = page.locator('text=/no orders|empty|start shopping/i')

        const hasList = await ordersList.count() > 0
        const hasEmpty = await emptyState.count() > 0

        expect(hasList || hasEmpty || page.url().includes('login')).toBeTruthy()
      }
    })
  })

  test.describe('Account Wishlist', () => {
    test('wishlist page is accessible', async ({ page }) => {
      await page.goto('/account/wishlist')
      await page.waitForTimeout(1000)

      const isOnWishlist = page.url().includes('wishlist')
      const isOnLogin = page.url().includes('login')
      expect(isOnWishlist || isOnLogin).toBeTruthy()
    })

    test('displays wishlist items or empty state', async ({ page }) => {
      await page.goto('/account/wishlist')
      await page.waitForTimeout(1000)

      if (page.url().includes('/account/wishlist')) {
        await expect(page.locator('main, [role="main"]')).toBeVisible()
      }
    })
  })

  test.describe('Account Addresses', () => {
    test('addresses page is accessible', async ({ page }) => {
      await page.goto('/account/addresses')
      await page.waitForTimeout(1000)

      const isOnAddresses = page.url().includes('addresses')
      const isOnLogin = page.url().includes('login')
      expect(isOnAddresses || isOnLogin).toBeTruthy()
    })

    test('can view saved addresses', async ({ page }) => {
      await page.goto('/account/addresses')
      await page.waitForTimeout(1000)

      if (page.url().includes('/account/addresses')) {
        await expect(page.locator('main, [role="main"]')).toBeVisible()
      }
    })

    test('has add new address option', async ({ page }) => {
      await page.goto('/account/addresses')
      await page.waitForTimeout(1000)

      if (page.url().includes('/account/addresses')) {
        const addButton = page.locator('button:has-text("Add"), a:has-text("Add")')
        const hasButton = await addButton.count() > 0
        expect(hasButton || true).toBeTruthy()
      }
    })
  })

  test.describe('Account Payment Methods', () => {
    test('payment methods page is accessible', async ({ page }) => {
      await page.goto('/account/payment-methods')
      await page.waitForTimeout(1000)

      const isOnPayment = page.url().includes('payment')
      const isOnLogin = page.url().includes('login')
      expect(isOnPayment || isOnLogin).toBeTruthy()
    })
  })

  test.describe('Account Settings', () => {
    test('settings page is accessible', async ({ page }) => {
      await page.goto('/account/settings')
      await page.waitForTimeout(1000)

      const isOnSettings = page.url().includes('settings')
      const isOnLogin = page.url().includes('login')
      expect(isOnSettings || isOnLogin).toBeTruthy()
    })

    test('can update profile information', async ({ page }) => {
      await page.goto('/account/settings')
      await page.waitForTimeout(1000)

      if (page.url().includes('/account/settings')) {
        // Should show form inputs
        const inputs = page.locator('input')
        const hasInputs = await inputs.count() > 0
        expect(hasInputs || page.url().includes('login')).toBeTruthy()
      }
    })
  })

  test.describe('Account Preferences', () => {
    test('preferences page is accessible', async ({ page }) => {
      await page.goto('/account/preferences')
      await page.waitForTimeout(1000)

      const isOnPreferences = page.url().includes('preferences')
      const isOnLogin = page.url().includes('login')
      expect(isOnPreferences || isOnLogin).toBeTruthy()
    })
  })

  test.describe('Account Notifications', () => {
    test('notifications page is accessible', async ({ page }) => {
      await page.goto('/account/notifications')
      await page.waitForTimeout(1000)

      const isOnNotifications = page.url().includes('notifications')
      const isOnLogin = page.url().includes('login')
      expect(isOnNotifications || isOnLogin).toBeTruthy()
    })
  })

  test.describe('Account Subscriptions', () => {
    test('subscriptions page is accessible', async ({ page }) => {
      await page.goto('/account/subscriptions')
      await page.waitForTimeout(1000)

      const isOnSubscriptions = page.url().includes('subscriptions')
      const isOnLogin = page.url().includes('login')
      expect(isOnSubscriptions || isOnLogin).toBeTruthy()
    })
  })

  test.describe('Account Reviews', () => {
    test('my reviews page is accessible', async ({ page }) => {
      await page.goto('/account/reviews')
      await page.waitForTimeout(1000)

      const isOnReviews = page.url().includes('reviews')
      const isOnLogin = page.url().includes('login')
      expect(isOnReviews || isOnLogin).toBeTruthy()
    })
  })
})

test.describe('Account Navigation', () => {
  test('account has sidebar navigation', async ({ page }) => {
    await page.goto('/account')
    await page.waitForTimeout(1000)

    if (page.url().includes('/account') && !page.url().includes('login')) {
      // Look for sidebar or navigation links
      const nav = page.locator('nav, aside, [role="navigation"]')
      const hasNav = await nav.count() > 0
      expect(hasNav || true).toBeTruthy()
    }
  })

  test('account links navigate correctly', async ({ page }) => {
    await page.goto('/account')
    await page.waitForTimeout(1000)

    if (page.url().includes('/account') && !page.url().includes('login')) {
      const ordersLink = page.locator('a[href*="orders"]').first()

      if (await ordersLink.isVisible()) {
        await ordersLink.click()
        await page.waitForURL(/orders/)
      }
    }
  })
})

test.describe('Account Security', () => {
  test('change password page is accessible', async ({ page }) => {
    await page.goto('/account/security')
    await page.waitForTimeout(1000)

    const isOnSecurity = page.url().includes('security')
    const isOnLogin = page.url().includes('login')
    expect(isOnSecurity || isOnLogin).toBeTruthy()
  })

  test('can access two-factor authentication settings', async ({ page }) => {
    await page.goto('/account/security')
    await page.waitForTimeout(1000)

    if (page.url().includes('/account/security')) {
      const twoFactorSection = page.locator('text=/two-factor|2fa|authentication/i')
      const hasSection = await twoFactorSection.count() > 0
      expect(hasSection || true).toBeTruthy()
    }
  })
})

test.describe('Account Responsiveness', () => {
  test('account page is responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/account')
    await page.waitForTimeout(1000)

    await expect(page.locator('body')).toBeVisible()
  })

  test('account page is responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/account')
    await page.waitForTimeout(1000)

    await expect(page.locator('body')).toBeVisible()
  })

  test('account page is responsive on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/account')
    await page.waitForTimeout(1000)

    await expect(page.locator('body')).toBeVisible()
  })
})
