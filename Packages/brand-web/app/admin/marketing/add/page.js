'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { marketingApi } from '../../../../lib/api';

export default function AddLeadPage() {
  const router = useRouter();
  const [mode, setMode] = useState('single'); // 'single' or 'bulk'
  const [targetType, setTargetType] = useState('influencer');

  // Single intake form
  const [handle, setHandle] = useState('');
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');
  const [niche, setNiche] = useState('');
  const [subNiche, setSubNiche] = useState('');
  const [industry, setIndustry] = useState('');
  const [subIndustry, setSubIndustry] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [conflict, setConflict] = useState(null);

  // Bulk
  const [bulkText, setBulkText] = useState('');
  const [bulkResult, setBulkResult] = useState(null);

  function reset() {
    setHandle(''); setFullName(''); setBusinessName('');
    setCity(''); setNiche(''); setSubNiche('');
    setIndustry(''); setSubIndustry('');
    setPhone(''); setEmail(''); setWhatsapp('');
    setWebsite(''); setNotes('');
    setResult(null); setConflict(null);
  }

  async function submit(force_action) {
    setSubmitting(true);
    const payload = {
      target_type: targetType,
      handle,
      full_name: fullName,
      business_name: businessName,
      city,
      niche, sub_niche: subNiche,
      industry, sub_industry: subIndustry,
      phone, email, whatsapp,
      website,
      notes,
    };
    if (force_action) payload.force_action = force_action;
    const res = await marketingApi.intakeLead(payload);
    setSubmitting(false);
    if (res.success) {
      if (res.data.action === 'requires_decision') {
        setConflict(res.data);
        setResult(null);
      } else {
        setResult(res.data);
        setConflict(null);
        if (res.data.action === 'created' || res.data.action === 'revived' || res.data.action === 'force_refresh') {
          // give the user a moment then offer to jump to the lead
        }
      }
    } else {
      setResult({ error: res.error?.message || 'Failed' });
    }
  }

  async function submitBulk() {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    const rows = [];
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      const [_type, _handle, _name, _city, _category, _subcategory, _phone, _email] = parts;
      const type = (_type || '').toLowerCase();
      if (!['influencer', 'brand'].includes(type)) continue;
      if (!_handle) continue;
      rows.push(type === 'brand' ? {
        target_type: 'brand',
        handle: _handle,
        business_name: _name || '',
        city: _city || '',
        industry: _category || '',
        sub_industry: _subcategory || '',
        phone: _phone || '',
        email: _email || '',
      } : {
        target_type: 'influencer',
        handle: _handle,
        full_name: _name || '',
        city: _city || '',
        niche: _category || '',
        sub_niche: _subcategory || '',
        phone: _phone || '',
        email: _email || '',
      });
    }
    if (rows.length === 0) {
      setBulkResult({ error: 'No valid rows parsed. Format: type,handle,name,city,category,subcategory,phone,email' });
      return;
    }
    setSubmitting(true);
    const res = await marketingApi.intakeLeadBulk(rows);
    setSubmitting(false);
    if (res.success) {
      setBulkResult(res.data);
    } else {
      setBulkResult({ error: res.error?.message || 'Failed' });
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="bg-white rounded-xl border border-border p-4">
        <h1 className="font-display text-lg font-bold text-t1 mb-1">Add Lead</h1>
        <p className="text-xs text-t3">Paste a handle to start enrichment. Inflx will scrape, score, and add it to your triage list within 2–3 minutes.</p>
        <div className="mt-3 flex bg-surface2 rounded-lg p-0.5 w-fit">
          <button onClick={() => setMode('single')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold ${mode === 'single' ? 'bg-white text-t1 shadow-sm' : 'text-t3'}`}>
            Single
          </button>
          <button onClick={() => setMode('bulk')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold ${mode === 'bulk' ? 'bg-white text-t1 shadow-sm' : 'text-t3'}`}>
            Bulk (CSV paste)
          </button>
        </div>
      </div>

      {mode === 'single' && (
        <div className="bg-white rounded-xl border border-border p-4 space-y-3">
          {/* Target type */}
          <div className="flex bg-surface2 rounded-lg p-0.5 w-fit">
            <button onClick={() => setTargetType('influencer')}
              className={`px-4 py-2 rounded-md text-xs font-semibold ${targetType === 'influencer' ? 'bg-orange text-white' : 'text-t3'}`}>
              ⭐ Influencer
            </button>
            <button onClick={() => setTargetType('brand')}
              className={`px-4 py-2 rounded-md text-xs font-semibold ${targetType === 'brand' ? 'bg-navy text-white' : 'text-t3'}`}>
              🏢 Brand
            </button>
          </div>

          {/* Form */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1 block">Instagram Handle <span className="text-red">*</span></label>
              <input type="text" value={handle} onChange={e => setHandle(e.target.value)}
                placeholder="@username, https://instagram.com/username, or username"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 font-mono" />
            </div>

            {targetType === 'influencer' ? (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1 block">Full Name</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2" />
              </div>
            ) : (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1 block">Business Name</label>
                <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2" />
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1 block">City</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)}
                placeholder="Hyderabad" className="w-full text-sm border border-border rounded-lg px-3 py-2" />
            </div>

            {targetType === 'influencer' ? (
              <>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1 block">Niche</label>
                  <input type="text" value={niche} onChange={e => setNiche(e.target.value)}
                    placeholder="food / fashion / fitness" className="w-full text-sm border border-border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1 block">Sub-niche</label>
                  <input type="text" value={subNiche} onChange={e => setSubNiche(e.target.value)}
                    placeholder="baking / streetwear" className="w-full text-sm border border-border rounded-lg px-3 py-2" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1 block">Industry</label>
                  <input type="text" value={industry} onChange={e => setIndustry(e.target.value)}
                    placeholder="restaurant / salon / clothing" className="w-full text-sm border border-border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1 block">Sub-industry</label>
                  <input type="text" value={subIndustry} onChange={e => setSubIndustry(e.target.value)}
                    placeholder="biryani / makeup studio" className="w-full text-sm border border-border rounded-lg px-3 py-2" />
                </div>
              </>
            )}

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1 block">Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="9876543210" className="w-full text-sm border border-border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1 block">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1 block">WhatsApp (if different)</label>
              <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2" />
            </div>
            {targetType === 'brand' && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1 block">Website</label>
                <input type="url" value={website} onChange={e => setWebsite(e.target.value)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2" />
              </div>
            )}
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1 block">Notes (internal)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Anything you want to remember about this lead"
                className="w-full text-sm border border-border rounded-lg px-3 py-2"></textarea>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={() => submit(null)} disabled={!handle || submitting}
              className="bg-orange text-white font-bold text-sm px-5 py-2.5 rounded-lg hover:bg-orange/90 disabled:opacity-40">
              {submitting ? 'Adding…' : 'Add & start scraping'}
            </button>
            <button onClick={reset} className="text-t3 text-sm px-4 py-2.5 hover:text-t1">
              Reset
            </button>
          </div>

          {/* Result */}
          {result && !result.error && (
            <div className="bg-teal-pale border border-teal-deep/30 rounded-lg p-3 text-sm text-teal-deep">
              <div className="font-bold">✓ {result.action === 'created' ? 'Added!' : 'Done.'}</div>
              <div className="text-xs mt-1">
                @{result.handle} ({result.target_type}) →
                {result.scrape_triggered ? ' Scraping started, full enrichment in ~3 minutes.' : ' Scrape NOT triggered (n8n not configured).'}
              </div>
              <button onClick={() => router.push(`/admin/marketing/leads/${result.target_type}/${result.target_id}`)}
                className="text-teal-deep font-semibold text-xs underline mt-2">
                Open detail page →
              </button>
            </div>
          )}
          {result?.error && (
            <div className="bg-red-pale border border-red/30 rounded-lg p-3 text-sm text-red">
              ✗ {result.error}
            </div>
          )}

          {/* Conflict modal-style */}
          {conflict && (
            <div className="bg-gold-pale border border-yellow-700/30 rounded-lg p-4 space-y-2">
              <div className="font-bold text-yellow-700">⚠ {conflict.message}</div>
              <div className="text-xs text-t2">
                Existing: {conflict.conflict.existing_type} · status {conflict.conflict.existing_status} · last scraped {conflict.conflict.last_scraped_at ? new Date(conflict.conflict.last_scraped_at).toLocaleString() : 'never'}
              </div>
              <div className="flex gap-2 flex-wrap pt-2">
                {conflict.conflict.options.includes('revive') && (
                  <button onClick={() => submit('revive')} disabled={submitting}
                    className="bg-teal-deep text-white text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-40">
                    Revive (re-scrape + mark not_contacted)
                  </button>
                )}
                {conflict.conflict.options.includes('force_refresh') && (
                  <button onClick={() => submit('force_refresh')} disabled={submitting}
                    className="bg-orange text-white text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-40">
                    Force refresh now
                  </button>
                )}
                {conflict.conflict.options.includes('update_manual_only') && (
                  <button onClick={() => submit('update_manual_only')} disabled={submitting}
                    className="bg-navy text-white text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-40">
                    Update manual fields only
                  </button>
                )}
                <button onClick={() => { setConflict(null); }}
                  className="text-t3 text-xs px-3 py-2 hover:text-t1">
                  Cancel
                </button>
                <button onClick={() => router.push(`/admin/marketing/leads/${conflict.conflict.existing_type}/${conflict.conflict.existing_id}`)}
                  className="text-orange text-xs font-bold underline px-3 py-2">
                  Open existing →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'bulk' && (
        <div className="bg-white rounded-xl border border-border p-4 space-y-3">
          <div className="text-xs text-t3">
            One row per line: <span className="font-mono bg-surface2 px-1.5 py-0.5 rounded">type,handle,name,city,category,subcategory,phone,email</span>
            <br />
            Where <span className="font-bold">type</span> is <span className="font-mono">influencer</span> or <span className="font-mono">brand</span>. Empty fields are allowed.
          </div>
          <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={12}
            placeholder={`influencer,aishbakes,Aish,Hyderabad,food,baking,9876543210,aish@bakes.com\nbrand,goldencafe,Golden Cafe,Bangalore,restaurant,cafe,9999999999,info@goldencafe.in`}
            className="w-full text-xs border border-border rounded-lg px-3 py-2 font-mono"></textarea>
          <button onClick={submitBulk} disabled={!bulkText || submitting}
            className="bg-orange text-white font-bold text-sm px-5 py-2.5 rounded-lg hover:bg-orange/90 disabled:opacity-40">
            {submitting ? 'Processing…' : `Add ${bulkText.split('\n').filter(l => l.trim()).length} rows`}
          </button>

          {bulkResult && !bulkResult.error && (
            <div className="bg-teal-pale border border-teal-deep/30 rounded-lg p-3 text-sm text-teal-deep">
              <div className="font-bold mb-2">Bulk intake complete</div>
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div><span className="text-t3">Total:</span> <span className="font-bold">{bulkResult.total}</span></div>
                <div><span className="text-t3">Created:</span> <span className="font-bold text-teal-deep">{bulkResult.created}</span></div>
                <div><span className="text-t3">Duplicates:</span> <span className="font-bold text-yellow-700">{bulkResult.duplicates_skipped}</span></div>
                <div><span className="text-t3">Invalid:</span> <span className="font-bold text-red">{bulkResult.invalid}</span></div>
              </div>
              {bulkResult.errors?.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer text-t2">View errors</summary>
                  <ul className="text-[11px] mt-1 space-y-0.5 text-t2 max-h-32 overflow-y-auto">
                    {bulkResult.errors.map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}
          {bulkResult?.error && (
            <div className="bg-red-pale border border-red/30 rounded-lg p-3 text-sm text-red">
              ✗ {bulkResult.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
