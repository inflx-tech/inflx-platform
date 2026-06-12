'use strict';

/**
 * SSRF-guard test for imageIngest (contract: listing-image-urls). No network for
 * the literal-IP / scheme cases; only 'localhost' uses an offline DNS lookup.
 *   node scripts/test-image-ingest.js
 */
const ingest = require('../src/services/imageIngest.service');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };

console.log('imageIngest SSRF guard');

// isPrivateIp — must BLOCK
['127.0.0.1', '0.0.0.0', '10.0.0.5', '172.16.0.1', '172.31.255.1', '192.168.1.1',
 '169.254.169.254', '100.64.0.1', '::1', 'fe80::1', 'fc00::1', 'fd12::3', 'ff02::1', '::ffff:127.0.0.1']
  .forEach(ip => ok(ingest.isPrivateIp(ip), `blocks ${ip}`));

// isPrivateIp — must ALLOW (public)
['8.8.8.8', '1.1.1.1', '11.0.0.1', '172.15.0.1', '172.32.0.1', '2606:4700:4700::1111']
  .forEach(ip => ok(!ingest.isPrivateIp(ip), `allows ${ip}`));

(async () => {
  const rej = async (u) => { try { await ingest.assertSafeUrl(u); ok(false, `should reject ${u}`); } catch (e) { ok(true, `rejects ${u} (${e.message})`); } };
  await rej('ftp://example.com/x.jpg');           // bad scheme
  await rej('file:///etc/passwd');                // bad scheme
  await rej('not a url');                          // invalid
  await rej('http://127.0.0.1/x.jpg');            // loopback literal
  await rej('http://169.254.169.254/latest/');   // cloud metadata
  await rej('http://[::1]/x.jpg');               // v6 loopback literal
  await rej('http://192.168.0.10/p.png');        // private literal
  await rej('http://localhost:3001/x.jpg');      // resolves to loopback (offline DNS)

  console.log(`\nTOTALS: ${pass} pass / ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
