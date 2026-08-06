import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * WORKFLOW: legal content stays in sync between web and mobile — v1.0.0.
 * Contract: features/mobile-legal-sections/.
 *
 * Packages/Mobile/src/legal/content.js is GENERATED from brand-web's
 * lib/legal/**, because Metro cannot resolve outside Packages/Mobile/ (the
 * same constraint that forces src/components/InflxMark.js to be a duplicate).
 *
 * A generated file that can quietly go stale is worse than no generated file:
 * the website would show a corrected policy while three mobile apps kept
 * serving the old text, and nobody would notice until it mattered. This runs
 * the generator in --check mode, which re-renders in memory and fails if the
 * result differs from what is committed.
 */

const ROOT = resolve(__dirname, '../..');

test.describe('WORKFLOW: legal content sync', () => {
  test('the mobile legal bundle matches the web source', () => {
    let output = '';
    try {
      output = execFileSync(
        process.execPath,
        [resolve(ROOT, 'scripts/sync-legal-to-mobile.mjs'), '--check'],
        { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
    } catch (err: any) {
      const detail = `${err?.stdout || ''}${err?.stderr || ''}`.trim();
      throw new Error(
        'Mobile legal content has drifted from the web source.\n' +
        'Run: node scripts/sync-legal-to-mobile.mjs\n\n' + detail,
      );
    }

    expect(output).toContain('In sync');
  });
});
