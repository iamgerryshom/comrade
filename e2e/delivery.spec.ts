import { expect, test, type Page } from '@playwright/test'

/**
 * The core promise of Comrade, end to end, with three tabs in one browser:
 *  - a lecturer sends a notice to COMP 210
 *  - student A (online) confirms receipt → "Delivered"
 *  - student B ("Simulate offline") doesn't → exactly one SMS after the (8 s) timeout
 */

async function demoLogin(page: Page, key: string) {
  await page.goto('/login')
  await page.getByTestId(`demo-${key}`).click()
  await expect(page).toHaveURL(/\/home$/)
}

async function simulateOffline(page: Page) {
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible()
  if ((page.viewportSize()?.width ?? 0) >= 640) {
    await page.getByRole('switch', { name: 'Simulate offline' }).click()
  } else {
    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('menuitem', { name: /Simulate offline/ }).click()
    await page.keyboard.press('Escape')
  }
  await expect(page.getByText(/Simulating offline/)).toBeVisible()
}

test('lecturer → unit: online student DELIVERED, offline student gets exactly one SMS', async ({ context }) => {
  const lecturer = await context.newPage()
  await demoLogin(lecturer, 'lecturer')

  const studentA = await context.newPage()
  await demoLogin(studentA, 'student')

  const studentB = await context.newPage()
  await demoLogin(studentB, 'student2')
  await simulateOffline(studentB)

  // Compose to COMP 210
  await lecturer.goto('/compose')
  await lecturer.getByRole('radio', { name: 'Unit' }).click()
  await lecturer.locator('#aud-unit').click()
  await lecturer.getByRole('option', { name: /COMP 210/ }).click()
  await expect(lecturer.getByText(/This will reach/)).toBeVisible()
  const title = `E2E CAT moved ${Date.now() % 100000}`
  await lecturer.getByLabel('Title').fill(title)
  await lecturer.getByLabel('Message').fill('The CAT moves to Friday 10am in LH3. Same topics.')
  await expect(lecturer.getByTestId('sms-preview')).toContainText('From: Lecturer COMP210')
  await lecturer.getByRole('button', { name: 'Send notice' }).click()
  await expect(lecturer).toHaveURL(/\/sent\/.+/)

  // Student A's device confirms receipt
  const rowA = lecturer.getByTestId('recipient-u_student')
  await expect(rowA).toHaveAttribute('data-status', /^(DELIVERED|READ)$/, { timeout: 15_000 })
  await expect(rowA.getByText('Delivered')).toBeVisible()

  // Student A got the notice in their inbox in real time
  await expect(studentA.getByText(title).first()).toBeVisible({ timeout: 10_000 })

  // Student B is waiting, then falls back to SMS after the timeout
  const rowB = lecturer.getByTestId('recipient-u_student2')
  await expect(rowB).toHaveAttribute('data-status', /^(PUSHED|PENDING)$/)
  await expect(rowB).toHaveAttribute('data-status', /^SMS_(SENT|DELIVERED)$/, { timeout: 30_000 })

  // The SMS appears on the mock phone, exactly once
  await studentB.goto('/demo/sms?uid=u_student2')
  const bubbles = studentB.getByTestId('sms-bubble').filter({ hasText: title.slice(0, 20) })
  await expect(bubbles).toHaveCount(1, { timeout: 10_000 })
  await expect(bubbles.first()).toContainText('[COMRADE-KSU] ACADEMIC:')
  await expect(bubbles.first()).toContainText('From: Lecturer COMP210')

  // Wait a few more worker ticks: still exactly one
  await studentB.waitForTimeout(5000)
  await expect(bubbles).toHaveCount(1)
})

test('an ordinary student cannot open compose or lookup (403)', async ({ page }) => {
  await demoLogin(page, 'student')
  await page.goto('/compose')
  await expect(page.getByText("You don't have permission for this")).toBeVisible()
  await page.goto('/lookup')
  await expect(page.getByText("You don't have permission for this")).toBeVisible()
})

test('no horizontal scrolling on key screens', async ({ page }) => {
  await demoLogin(page, 'registrar')
  for (const path of ['/home', '/inbox', '/compose', '/sent', '/explorer', '/analytics', '/admin/users', '/admin/audit', '/profile', '/demo/sms']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1)
  }
})
