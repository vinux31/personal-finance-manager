import { test, expect } from '@playwright/test'

// Phase 15 STRAT-04 + STRAT-06 UAT — modul edukasi navigation + glossary tooltip
// Pre-condition: dev server running OR baseURL points to deployable build (configured in
// playwright.config.ts — not yet present in repo as of 2026-05-10; spec authored ahead of
// runner setup, see Plan 15-04 SUMMARY for status). All page.goto() calls use relative
// paths so spec adapts to whatever baseURL the runner config eventually provides.

test.describe('Kesehatan Modul Edukasi (Phase 15 STRAT-04 + STRAT-06)', () => {

  test('navigation from landing → modul page shows H1 + breadcrumb', async ({ page }) => {
    await page.goto('/kesehatan')
    // Wait for landing grid to render at least one modul card
    await page.waitForSelector('text=Pondasi & Cash Flow', { timeout: 10000 })
    await page.click('text=Pondasi & Cash Flow')
    await expect(page).toHaveURL(/\/kesehatan\/arus-kas$/)
    // Breadcrumb
    await expect(page.locator('nav[aria-label="Breadcrumb"]')).toContainText('Kesehatan')
    await expect(page.locator('nav[aria-label="Breadcrumb"]')).toContainText('Pondasi')
    // H1
    await expect(page.locator('h1')).toContainText('Pondasi')
  })

  test('H1 uses Fraunces serif (or Georgia FOUT fallback)', async ({ page }) => {
    await page.goto('/kesehatan/arus-kas')
    await page.waitForSelector('h1', { timeout: 10000 })
    const fontFamily = await page.locator('h1').evaluate((el) => {
      return window.getComputedStyle(el).fontFamily
    })
    // Acceptance: Fraunces (loaded) OR Georgia (FOUT fallback) in family chain
    const matchesContract = /Fraunces|Georgia|serif/i.test(fontFamily)
    expect(
      matchesContract,
      `H1 font-family should include Fraunces/Georgia/serif but got: ${fontFamily}`,
    ).toBe(true)
  })

  test('glossary tooltip opens on click and shows definition (alokasi-aset modul)', async ({ page }) => {
    await page.goto('/kesehatan/alokasi-aset')
    // Wait for at least one glossary trigger (role=button, aria-label starting "Definisi:")
    const trigger = page.locator('[role="button"][aria-label^="Definisi:"]').first()
    await trigger.waitFor({ timeout: 10000 })
    await trigger.click()
    // Popover content is portaled to body — query by visible text snippet from definitions.
    // alokasi-aset modul has [[asset-allocation]] + [[dca]] + [[rebalancing]] + [[expense-ratio]]
    // Whichever is first triggered, definition contains specific phrases:
    const definitionVisible = await page
      .locator('text=/Strategi (pembagian portofolio|investasi rutin)|jual yang naik tinggi|Biaya tahunan reksadana/')
      .first()
      .isVisible({ timeout: 3000 })
    expect(definitionVisible).toBe(true)
  })

  test('footer prev/next nav wrap-around: arus-kas → tujuan → … → perilaku → arus-kas', async ({ page }) => {
    await page.goto('/kesehatan/arus-kas')
    // Click next link
    const nextLink = page.locator('footer a[aria-label^="Modul berikutnya:"]').first()
    await nextLink.waitFor({ timeout: 10000 })
    await nextLink.click()
    await expect(page).toHaveURL(/\/kesehatan\/tujuan$/)

    // Wrap-around test: visit last modul, click next → first
    await page.goto('/kesehatan/perilaku')
    const nextLinkLast = page.locator('footer a[aria-label^="Modul berikutnya:"]').first()
    await nextLinkLast.waitFor({ timeout: 10000 })
    await nextLinkLast.click()
    await expect(page).toHaveURL(/\/kesehatan\/arus-kas$/)
  })

  test('invalid slug redirects to /kesehatan landing', async ({ page }) => {
    await page.goto('/kesehatan/totally-not-a-real-modul-slug')
    // ModulRenderer renders Navigate to="/kesehatan" replace
    await page.waitForURL(/\/kesehatan(\/)?$/, { timeout: 5000 })
    expect(page.url()).toMatch(/\/kesehatan(\/)?$/)
  })

})
