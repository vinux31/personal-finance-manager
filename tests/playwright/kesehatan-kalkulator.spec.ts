import { test, expect } from '@playwright/test'

// Phase 15 STRAT-05 UAT — kalkulator compound interest
// Pre-condition: dev server running OR baseURL points to deployable build (configured in
// playwright.config.ts — not yet present in repo as of 2026-05-10; spec authored ahead of
// runner setup, see Plan 15-04 SUMMARY for status).

test.describe('Kalkulator Compound Interest (Phase 15 STRAT-05)', () => {

  test('banner click on landing navigates to /kesehatan/kalkulator', async ({ page }) => {
    await page.goto('/kesehatan')
    await page.waitForSelector('text=Buka kalkulator', { timeout: 10000 })
    await page.click('text=Buka kalkulator')
    await expect(page).toHaveURL(/\/kesehatan\/kalkulator$/)
    await expect(page.locator('h1')).toContainText('Kalkulator Compound Interest')
  })

  test('default state shows big number around Rp 205 juta', async ({ page }) => {
    await page.goto('/kesehatan/kalkulator')
    await page.waitForSelector('h1:has-text("Kalkulator Compound Interest")', { timeout: 10000 })
    // Locate big number — text-4xl tabular-nums element after "Nilai akhir setelah" label
    const bigNumber = page.locator('text=/Rp[\\s\\u00A0]+\\d{3}\\.\\d{3}\\.\\d{3}/').first()
    await bigNumber.waitFor({ timeout: 5000 })
    const text = await bigNumber.textContent()
    expect(text, 'big number should contain Rupiah prefix').toMatch(/Rp/)
    // Default scenario yields ~Rp 205,736,000 ± noise
    const digits = text!.replace(/\D/g, '')
    const num = Number(digits)
    expect(num).toBeGreaterThan(190_000_000)
    expect(num).toBeLessThan(220_000_000)
  })

  test('tenor < 5 shows table placeholder (Atur tenor minimal 5 tahun)', async ({ page }) => {
    await page.goto('/kesehatan/kalkulator')
    await page.waitForSelector('h1:has-text("Kalkulator Compound Interest")', { timeout: 10000 })
    // Tenor input is the LAST input[type="number"] on page (render order: rupiah, rupiah,
    // percent, years — the percent input has step="0.5" + inputMode=decimal; tenor uses
    // inputMode=numeric. Both render type=number so .last() resolves to tenor.)
    const tenorInput = page.locator('input[type="number"]').last()
    await tenorInput.fill('3')
    await tenorInput.blur()
    // Assert placeholder text visible in table card
    await expect(page.locator('text=Atur tenor minimal 5 tahun')).toBeVisible({ timeout: 3000 })
  })

  test('changing tenor updates big number (real-time recalc, D-07)', async ({ page }) => {
    await page.goto('/kesehatan/kalkulator')
    await page.waitForSelector('h1:has-text("Kalkulator Compound Interest")', { timeout: 10000 })
    const bigNumber = page.locator('text=/Rp[\\s\\u00A0]+\\d{3}\\.\\d{3}\\.\\d{3}/').first()
    const initialText = await bigNumber.textContent()
    const initialDigits = Number(initialText!.replace(/\D/g, ''))

    // Increase tenor to 40 (max)
    const tenorInput = page.locator('input[type="number"]').last()
    await tenorInput.fill('40')
    await tenorInput.blur()
    // Wait for re-render
    await page.waitForTimeout(200)
    const updatedText = await bigNumber.textContent()
    const updatedDigits = Number(updatedText!.replace(/\D/g, ''))

    expect(
      updatedDigits,
      `40-yr value should exceed 10-yr default value (${initialDigits})`,
    ).toBeGreaterThan(initialDigits * 5)
  })

  test('Recharts SVG chart rendered', async ({ page }) => {
    await page.goto('/kesehatan/kalkulator')
    await page.waitForSelector('h1:has-text("Kalkulator Compound Interest")', { timeout: 10000 })
    // Recharts wraps everything in svg with class containing "recharts"
    await page.waitForSelector('svg.recharts-surface, svg[class*="recharts"]', { timeout: 5000 })
    const svgCount = await page.locator('svg[class*="recharts"]').count()
    expect(svgCount).toBeGreaterThan(0)
  })

})
