import { test, expect } from '@playwright/test'

test.describe('calculator smoke', () => {
  test('home loads', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1#t-title')).toBeVisible()
  })

  test('B2B tab: job search and tax form sync', async ({ page }) => {
    await page.goto('/')
    await page.locator('#tab-b2b').click()
    await expect(page.locator('#b2b-role-input')).toBeVisible()

    await page.locator('#b2b-role-input').fill('software')
    const first = page.locator('#b2b-role-suggest li').first()
    await expect(first).toBeVisible({ timeout: 10_000 })
    await first.click()

    await expect(page.locator('#b2b-tax')).toHaveValue('ryczalt_12')
    await expect(page.locator('#b2b-role-result')).toContainText(/Selected:|Wybrano:/)
  })
})
