import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * WORKFLOW: brand-web auth — phone entry → OTP step.
 *
 * This is the reference L2 workflow test for the contract-driven
 * pipeline. It proves the whole machinery end-to-end:
 *   - real user behaviour (type phone, click Send OTP)
 *   - network interception (deterministic, no live backend needed)
 *   - workflow assertion (UI advanced to the OTP step) — NOT a
 *     "page compiled" check
 *   - before/after screenshots captured into qa/artifacts/screenshots
 *
 * Expected outputs are defined in
 *   features/brand-web-auth/03-expected-outputs.md
 */

const SHOTS = path.join(__dirname, '..', '..', 'artifacts', 'screenshots');

function shotDir(phase: 'before' | 'after') {
  const d = path.join(SHOTS, phase);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

test.describe('WORKFLOW: brand-web auth — phone → OTP step', () => {
  test('a brand can submit phone and reach the OTP step', async ({ page }) => {
    // Deterministic: stub the OTP endpoint so the workflow does not
    // depend on a live backend / OTP service. The contract under test
    // is the UI workflow transition, not the SMS provider.
    await page.route('**/auth/send-otp', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { message: 'OTP sent' } }),
      }),
    );

    // ── Step: land on the login workflow entrypoint ──
    await page.goto('/login');
    await expect(page.getByText('Brand Dashboard')).toBeVisible();
    const phone = page.locator('input[type="tel"]');
    await expect(phone).toBeVisible();
    await page.screenshot({
      path: path.join(shotDir('before'), 'brand-auth__phone-step.png'),
      fullPage: true,
    });

    // ── Step: real user action ──
    await phone.fill('9876543210');
    await page.getByRole('button', { name: /send otp/i }).click();

    // ── Workflow success = the UI advanced to the OTP step ──
    await expect(page.getByText(/OTP sent to \+91/i)).toBeVisible();
    await expect(page.locator('#otp-0')).toBeVisible();
    await page.screenshot({
      path: path.join(shotDir('after'), 'brand-auth__otp-step.png'),
      fullPage: true,
    });
  });
});
