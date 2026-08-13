import { test, expect } from '@playwright/test'
import { randomUUID } from 'crypto'

const TEST_DATE = '2026-08-15'
const BASE_URL = 'http://localhost:3000'

test.describe('Unified Calendar Interactive Core', () => {

  // Skip if we can't login, we assume auth is handled or we test the UI components
  // To avoid login redirect, we will navigate directly, but wait, if unauthenticated, Next.js redirects to /login.
  // The test needs to authenticate first!
  test.beforeEach(async ({ page }) => {
    // Basic auth for DevTest local
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', 'admin@devtest.local')
    await page.fill('input[type="password"]', 'DevTest123!')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/office|dashboard/)
  })

  test('Detail View & Toggle Status', async ({ page }) => {
    await page.goto(`${BASE_URL}/office/scheduling?date=${TEST_DATE}&view=calendar&range=week`)

    await expect(page.locator('.bg-slate-200, .bg-blue-100, .bg-amber-100').first()).toBeVisible({ timeout: 15000 })
    
    const eventLocator = page.locator('.bg-slate-200, .bg-blue-100, .bg-amber-100').first()
    const eventTitle = await eventLocator.locator('span.truncate, .font-semibold span').first().innerText()
    
    await eventLocator.click()

    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('h2')).toContainText(eventTitle)

    const statusSelect = dialog.locator('button[role="combobox"]')
    await expect(statusSelect).toBeVisible()

    await statusSelect.click()
    const listbox = page.locator('[role="listbox"]')
    await expect(listbox).toBeVisible()

    await dialog.locator('button:has-text("Close")').click()
    await expect(dialog).not.toBeVisible()
  })

  test('Manage View Filters - Additive Checkboxes', async ({ page }) => {
    await page.goto(`${BASE_URL}/office/scheduling?date=${TEST_DATE}&view=calendar&range=week`)
    
    const jobsCheckbox = page.locator('label:has-text("Jobs") input[type="checkbox"]')
    await jobsCheckbox.uncheck()

    await page.waitForURL(/type=/)
    const url = page.url()
    expect(url).not.toContain('jobs')
    expect(url).toContain('tasks')
  })

  test('Date Navigation & Week/Day View Toggle', async ({ page }) => {
    await page.goto(`${BASE_URL}/office/scheduling?date=${TEST_DATE}&view=calendar&range=week`)
    
    const headerGrid = page.locator('.grid-cols-8').first()
    await expect(headerGrid).toBeVisible()

    await page.locator('button:has(svg.lucide-chevron-right)').click()
    
    await page.waitForURL(/date=/)
    const newUrl = page.url()
    expect(newUrl).not.toContain(TEST_DATE)

    await page.locator('button:has-text("Day")').click()

    const dayGrid = page.locator('.grid-cols-2').first()
    await expect(dayGrid).toBeVisible()
  })
})
