import { test, expect } from '@playwright/test'

async function waitForJobRules(page) {
  await page.waitForFunction(() => window.__JOB_RULES_READY === true, null, { timeout: 15_000 })
  const ok = await page.evaluate(() => window.__JOB_RULES_OK === true)
  expect(ok, 'job-rules.json must load (check public/ and dev server)').toBe(true)
}

test.describe('calculator smoke', () => {
  test('home loads', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1#t-title')).toBeVisible()
  })

  test('B2B tab: job search and tax form sync', async ({ page }) => {
    await page.goto('/')
    await waitForJobRules(page)
    await page.locator('#tab-b2b').click()
    await expect(page.locator('#b2b-role-input')).toBeVisible()

    await page.locator('#b2b-role-input').fill('software')
    const first = page.locator('#b2b-role-suggest li').first()
    await expect(first).toBeVisible({ timeout: 10_000 })
    await first.click()

    await expect(page.locator('#b2b-tax')).toHaveValue('ryczalt_12')
    await expect(page.locator('#b2b-role-result')).toContainText(/Selected:|Wybrano:/)
  })

  test('B2B tab: Sound Designer sets tax dropdown to Ryczałt 5.5% (wytwórcza / PKWiU 59.20)', async ({ page }) => {
    await page.goto('/')
    await waitForJobRules(page)
    await page.locator('#tab-b2b').click()
    await page.locator('#b2b-role-input').fill('sound designer')
    const row = page.locator('#b2b-role-suggest li', { hasText: 'Sound Designer / Audio Engineer' })
    await expect(row.first()).toBeVisible({ timeout: 10_000 })
    await row.first().click()
    await expect(page.locator('#b2b-tax')).toHaveValue('ryczalt_55')
    await expect(page.locator('#b2b-role-result')).toContainText(/5[.,]5%|5\.5%/)
  })
})
