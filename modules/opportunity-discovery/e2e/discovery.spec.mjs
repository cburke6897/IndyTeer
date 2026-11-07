import { test, expect } from '@playwright/test'
test('Discovery renders source facts, filters without requests, and fits a mobile screen', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Good causes. Found for you.' })).toBeVisible()
  await expect(page.locator('.opportunity-card')).toHaveCount(2)
  await page.getByRole('searchbox', { name: 'Search opportunities' }).fill('cleanup 2')
  await expect(page.locator('.opportunity-card')).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'Original listing ↗' })).toHaveAttribute(
    'href',
    'https://example.org/2',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
test('An authorized review imports one draft and retains original attribution', async ({
  page,
}) => {
  await page.route('https://testtesttesttesttest.supabase.co/auth/v1/**', async (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
      })
    return route.fulfill({
      json: { access_token: 'test-token', refresh_token: 'test-refresh', expires_in: 3600 },
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  })
  await page.goto('/')
  const card = page
    .locator('.opportunity-card')
    .filter({ hasText: 'Test-only volunteer cleanup 1' })
  await card.getByRole('button', { name: 'Review & import' }).click()
  await page.getByLabel('Email', { exact: true }).fill('reviewer@example.test')
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Connect securely' }).click()
  await expect(
    page.getByRole('dialog', { name: '' }).filter({ hasText: 'REVIEW BEFORE IMPORT' }),
  ).toBeVisible()
  await page.getByLabel('City', { exact: true }).fill('Gary')
  await page.getByLabel('Confirmed capacity').fill('10')
  await page.locator('#facts-confirmed').check()
  await page.locator('#authorization-confirmed').check()
  await page.getByRole('button', { name: 'Import as draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft imported')
  await page.getByRole('combobox', { name: 'Listing status' }).selectOption('imported')
  await expect(page.locator('.opportunity-card')).toHaveCount(1)
  const listing = await page.request.get('/api/listings')
  const body = await listing.json()
  expect(body.items.find((i) => i.status === 'imported').import.opportunity_id).toBe('test-draft')
  expect(await page.evaluate(() => localStorage.length)).toBe(0)
})
test('Automatic discovery can be paused and a rejected listing leaves the queue', async ({
  page,
}) => {
  await page.goto('/')
  await page.locator('#schedule').check()
  await expect
    .poll(async () => (await (await page.request.get('/api/status')).json()).scheduler)
    .toBe(true)
  await page.locator('#schedule').uncheck()
  const card = page
    .locator('.opportunity-card')
    .filter({ hasText: 'Test-only volunteer cleanup 2' })
  await card.getByRole('button', { name: 'Dismiss', exact: true }).click()
  await expect(page.locator('.opportunity-card')).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Listing status' }).selectOption('rejected')
  await expect(page.locator('.opportunity-card')).toHaveCount(1)
})
