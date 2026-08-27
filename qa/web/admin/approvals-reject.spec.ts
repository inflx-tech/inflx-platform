import { test, expect } from '@playwright/test';
import path from 'node:path';
import { seedAdminSession, stubAdminApis, shotDir } from '../_helpers/adminSession';

/**
 * WORKFLOW: admin approvals — reject a pending brand with a reason.
 * Contract: features/admin-approvals-reject/ (locked 2026-05-18).
 *
 * A — reject with a predefined reason
 * B — reject with an "Other" custom reason
 * C — guard: no reason selected → Confirm disabled, no PATCH
 *
 * Success = the PATCH carries the exact reason (or no PATCH when
 * unreasoned), not "the panel rendered".
 *
 * 2026-07-29 — the reason key was corrected from `rejection_reason` to
 * `reason`. These tests stub the admin API and only inspect the captured
 * body, so they passed while every real reject 422'd: the backend reads
 * `reason` (backend/src/controllers/admin.controller.js:97, which throws
 * VALIDATION_ERROR when it is falsy) and there is no validation middleware
 * anywhere to normalise the two names. The assertions below now encode the
 * contract the server actually enforces.
 * Contract: features/admin-approval-consolidation/.
 *
 * 2026-08-27 — features/admin-people-pipeline relocated brand reject from
 * /admin/approvals (now a summary-only dashboard, no action buttons) to
 * Brands -> Pending Verification. Same UI shape (reason-picker, required
 * "Other" text, disabled Confirm until a reason exists), new URL.
 */

test.describe('WORKFLOW: admin approvals — reject with a reason', () => {
  test('A — reject with a predefined reason carries it in the PATCH', async ({ page, context }) => {
    await seedAdminSession(context, page);
    const cap = await stubAdminApis(page);

    await page.goto('/admin/brands?tab=pending');
    await expect(page.getByText('QA Diner')).toBeVisible();

    await page.getByRole('button', { name: 'Reject', exact: true }).click();
    await expect(page.getByText('Select rejection reason')).toBeVisible();
    await page.screenshot({
      path: path.join(shotDir('before'), 'admin-reject__reason-panel.png'),
      fullPage: true,
    });

    await page.getByRole('button', { name: 'Duplicate account', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm Reject', exact: true }).click();

    await expect(page.getByText(/rejected successfully/i)).toBeVisible();
    await page.screenshot({
      path: path.join(shotDir('after'), 'admin-reject__rejected.png'),
      fullPage: true,
    });

    expect(cap.patchBody).toEqual({ status: 'rejected', reason: 'Duplicate account' });
  });

  test('B — "Other" requires custom text and sends it as the reason', async ({ page, context }) => {
    await seedAdminSession(context, page);
    const cap = await stubAdminApis(page);

    await page.goto('/admin/brands?tab=pending');
    await expect(page.getByText('QA Diner')).toBeVisible();
    await page.getByRole('button', { name: 'Reject', exact: true }).click();

    await page.getByRole('button', { name: 'Other', exact: true }).click();
    const textarea = page.getByPlaceholder('Enter custom reason...');
    await expect(textarea).toBeVisible();

    // Confirm stays disabled until custom text is entered
    const confirm = page.getByRole('button', { name: 'Confirm Reject', exact: true });
    await expect(confirm).toBeDisabled();
    await textarea.fill('Spam signup');
    await expect(confirm).toBeEnabled();

    await confirm.click();
    await expect(page.getByText(/rejected successfully/i)).toBeVisible();
    expect(cap.patchBody).toEqual({ status: 'rejected', reason: 'Spam signup' });
  });

  test('C — guard: no reason selected → Confirm disabled and no PATCH', async ({ page, context }) => {
    await seedAdminSession(context, page);
    const cap = await stubAdminApis(page);

    await page.goto('/admin/brands?tab=pending');
    await expect(page.getByText('QA Diner')).toBeVisible();
    await page.getByRole('button', { name: 'Reject', exact: true }).click();
    await expect(page.getByText('Select rejection reason')).toBeVisible();

    await expect(
      page.getByRole('button', { name: 'Confirm Reject', exact: true }),
    ).toBeDisabled();
    expect(cap.patchCalls).toBe(0);
  });
});
