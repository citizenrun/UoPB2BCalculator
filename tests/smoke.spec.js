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

  test('UoP/B2B grids: entered values stay unchanged after Calculate', async ({ page }) => {
    await page.goto('/')
    await waitForJobRules(page)

    // UoP vacation + L4 + bonus should remain exactly as entered.
    await page.locator('#v0').fill('5')
    await page.locator('#l1').fill('3')
    await page.locator('#ob2').fill('1200')
    await page.locator('#btn-calc').click()

    await expect(page.locator('#v0')).toHaveValue('5')
    await expect(page.locator('#l1')).toHaveValue('3')
    await expect(page.locator('#ob2')).toHaveValue('1200')

    // B2B day-off + extra revenue should remain exactly as entered.
    await page.locator('#tab-b2b').click()
    await page.locator('#bv0').fill('5')
    await page.locator('#bb1').fill('1500')
    await page.locator('#b2b-btn').click()

    await expect(page.locator('#bv0')).toHaveValue('5')
    await expect(page.locator('#bb1')).toHaveValue('1500')
  })

  test('UoP inputs happy path: core fields persist and table renders', async ({ page }) => {
    await page.goto('/')
    await waitForJobRules(page)

    await page.locator('#brutto').fill('27000')
    await page.locator('#br-add').fill('500')
    await page.locator('#kup-type').selectOption('auto')
    await page.locator('#kup-pct').selectOption('80')
    await page.locator('#med').fill('15.75')
    await page.locator('#msp').fill('167.82')
    await page.locator('#oth').fill('20')
    await page.locator('#btn-calc').click()

    await expect(page.locator('#brutto')).toHaveValue('27000')
    await expect(page.locator('#br-add')).toHaveValue('500')
    await expect(page.locator('#kup-pct')).toHaveValue('80')
    await expect(page.locator('#med')).toHaveValue('15.75')
    await expect(page.locator('#msp')).toHaveValue('167.82')
    await expect(page.locator('#oth')).toHaveValue('20')
    await expect(page.locator('#t-det tbody tr')).toHaveCount(13)
  })

  test('UoP edge cases: custom year/cap and PIT0+KUP warning behavior', async ({ page }) => {
    await page.goto('/')
    await waitForJobRules(page)

    await page.locator('#rok').selectOption('2027')
    await expect(page.locator('#cap-wrap')).toBeVisible()
    await page.locator('#cap-custom').fill('310000')
    await page.locator('#kup-type').selectOption('auto')
    await page.locator('#pit0').selectOption('1')
    await expect(page.locator('#pit0-kup-warn')).toBeVisible()

    await page.locator('#btn-calc').click()
    await expect(page.locator('#rok')).toHaveValue('2027')
    await expect(page.locator('#cap-custom')).toHaveValue('310000')
    await expect(page.locator('#pit0-kup-warn')).toBeVisible()

    await page.locator('#pit0').selectOption('0')
    await expect(page.locator('#pit0-kup-warn')).toBeHidden()
  })

  test('Reverse calculator happy+edge: keeps inputs and returns result', async ({ page }) => {
    await page.goto('/')
    await waitForJobRules(page)
    await page.locator('#tab-rev').click()

    await page.locator('#rev-netto').fill('15000')
    await page.locator('#rev-month').selectOption('5')
    await page.locator('#rev-btn').click()

    await expect(page.locator('#rev-netto')).toHaveValue('15000')
    await expect(page.locator('#rev-month')).toHaveValue('5')
    await expect(page.locator('#rev-result')).toContainText(/zł|PLN/)

    await page.locator('#rev-netto').fill('0')
    await page.locator('#rev-btn').click()
    await expect(page.locator('#rev-netto')).toHaveValue('0')
  })

  test('B2B inputs happy+edge: main form values persist after Calculate', async ({ page }) => {
    await page.goto('/')
    await waitForJobRules(page)
    await page.locator('#tab-b2b').click()

    await page.locator('#b2b-inv').fill('33099')
    await page.locator('#b2b-costs').fill('500')
    await page.locator('#b2b-rok').selectOption('2025')
    await page.locator('#b2b-tax').selectOption('linear')
    await page.locator('#b2b-zus').selectOption('pref')
    await page.locator('#b2b-chorob').selectOption('1')
    await page.locator('#b2b-bill').selectOption('fixed')
    await page.locator('#b2b-btn').click()

    await expect(page.locator('#b2b-inv')).toHaveValue('33099')
    await expect(page.locator('#b2b-costs')).toHaveValue('500')
    await expect(page.locator('#b2b-rok')).toHaveValue('2025')
    await expect(page.locator('#b2b-tax')).toHaveValue('linear')
    await expect(page.locator('#b2b-zus')).toHaveValue('pref')
    await expect(page.locator('#b2b-chorob')).toHaveValue('1')
    await expect(page.locator('#b2b-bill')).toHaveValue('fixed')
    await expect(page.locator('#b2b-table-wrap')).toBeVisible()
  })
})
