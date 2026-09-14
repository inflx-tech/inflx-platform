'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../../../lib/api';

/**
 * Admin · INFLX standard terms — item 7.
 * Rules v1.20 §9: "INFLX's standard terms form part of every Agreement. Their
 * version is stamped on the Agreement, so updating the standard terms never
 * changes an Agreement already signed."
 * Contract: features/item7-agreement · gap report §9
 *
 * A version is never edited and never deleted. Publishing writes a NEW version
 * and makes it current; every agreement keeps the version it was generated
 * under, and that exact text is still served years later. Modelled on
 * settings/platform, beside it in the nav, on the same capability.
 */

function fmtWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function StandardTermsPage() {
  const [versions, setVersions] = useState([]);
  const [current, setCurrent] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({ version: '', body: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(async () => {
    setLoading(true); setLoadError(false);
    const res = await adminApi.getStandardTerms();
    setLoading(false);
    if (!res.success) { setLoadError(true); return; }
    setVersions(res.data.versions || []);
    setCurrent(res.data.current || null);
    setViewing(res.data.current || null);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function view(version) {
    const res = await adminApi.getStandardTermsVersion(version);
    if (res.success) setViewing(res.data.terms);
    else showToast(res.error?.message || 'Could not load that version', 'err');
  }

  function validate() {
    const e = {};
    if (!form.version.trim()) e.version = 'Give the new version a number.';
    else if (versions.some(v => v.version === form.version.trim())) e.version = `Version ${form.version.trim()} already exists. Give this one a new number.`;
    if (!form.body.trim()) e.body = 'The terms cannot be empty.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function publish() {
    if (!validate()) return;
    setSaving(true);
    const res = await adminApi.publishStandardTerms({ version: form.version.trim(), body: form.body });
    setSaving(false);
    if (!res.success) {
      if (res.error?.field) setErrors({ [res.error.field]: res.error.message });
      else showToast(res.error?.message || 'Could not publish', 'err');
      return;
    }
    showToast(`Version ${res.data.terms.version} is now current.`);
    setComposing(false);
    setForm({ version: '', body: '' });
    load();
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map(i => <div key={i} className="h-20 rounded-xl bg-[#F6F6F3] animate-pulse" />)}
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="rounded-xl border border-[#E5E4DE] p-6 text-center">
        <p className="text-sm text-[#5B5A53]">We couldn&rsquo;t load the standard terms.</p>
        <button onClick={load} className="mt-3 rounded-lg bg-[#1A1A17] px-4 py-2 text-sm text-white">Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="standard-terms-page">
      <div className="rounded-xl border border-[#E5E4DE] bg-white p-5">
        <h2 className="text-base font-semibold text-[#1A1A17]">INFLX standard terms</h2>
        <p className="mt-1 text-sm leading-relaxed text-[#5B5A53]">
          These form part of every agreement. Each agreement is stamped with the version that was
          current when it was generated, so publishing a new version never changes an agreement
          already sent or signed. A version is never edited and never removed.
        </p>
        {current && (
          <p className="mt-3 text-sm text-[#1A1A17]">
            <span className="font-mono text-xs uppercase tracking-wide text-[#77766E]">Current</span>{' '}
            <span className="font-semibold">Version {current.version}</span>
          </p>
        )}
      </div>

      <div className="rounded-xl border border-[#E5E4DE] bg-white">
        <div className="flex items-center justify-between border-b border-[#E5E4DE] px-5 py-3">
          <h3 className="text-sm font-semibold text-[#1A1A17]">Versions</h3>
          {!composing && (
            <button onClick={() => setComposing(true)} data-testid="new-version"
              className="rounded-lg bg-[#FFC700] px-3 py-1.5 text-sm font-semibold text-[#1A1A17]">
              Publish a new version
            </button>
          )}
        </div>
        <ul className="divide-y divide-[#E5E4DE]">
          {versions.map(v => (
            <li key={v.version} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-semibold text-[#1A1A17]">
                  Version {v.version}
                  {v.isCurrent && <span className="ml-2 rounded-full bg-[#E6F4EA] px-2 py-0.5 text-[11px] font-semibold text-[#137333]">CURRENT</span>}
                </p>
                <p className="text-xs text-[#77766E]">
                  Effective {fmtWhen(v.effectiveAt)}{v.createdBy ? ` · published by ${v.createdBy}` : ''}
                </p>
              </div>
              <button onClick={() => view(v.version)} className="text-sm text-[#5B5A53] underline">Read</button>
            </li>
          ))}
        </ul>
      </div>

      {composing && (
        <div className="rounded-xl border border-[#E5E4DE] bg-white p-5" data-testid="compose">
          <h3 className="text-sm font-semibold text-[#1A1A17]">Publish a new version</h3>
          <p className="mt-1 text-xs text-[#77766E]">
            Every agreement generated from now on carries this version. Agreements already out keep theirs.
          </p>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[#77766E]">Version</label>
          <input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
            placeholder="1.1" data-testid="version-input"
            className="mt-1 w-40 rounded-lg border border-[#E5E4DE] px-3 py-2 text-sm" />
          {errors.version && <p className="mt-1 text-xs text-[#B3261E]">{errors.version}</p>}

          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[#77766E]">The terms</label>
          <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            rows={14} data-testid="body-input"
            className="mt-1 w-full rounded-lg border border-[#E5E4DE] px-3 py-2 font-mono text-xs leading-relaxed" />
          {errors.body && <p className="mt-1 text-xs text-[#B3261E]">{errors.body}</p>}

          <div className="mt-4 flex gap-2">
            <button onClick={publish} disabled={saving} data-testid="publish"
              className="rounded-lg bg-[#FFC700] px-4 py-2 text-sm font-semibold text-[#1A1A17] disabled:opacity-50">
              {saving ? 'Publishing…' : 'Publish'}
            </button>
            <button onClick={() => { setComposing(false); setErrors({}); }}
              className="rounded-lg border border-[#E5E4DE] px-4 py-2 text-sm text-[#5B5A53]">Cancel</button>
          </div>
        </div>
      )}

      {viewing && (
        <div className="rounded-xl border border-[#E5E4DE] bg-[#F6F6F3] p-5" data-testid="terms-body">
          <p className="font-mono text-xs uppercase tracking-wide text-[#77766E]">Version {viewing.version}</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#1A1A17]">{viewing.body}</pre>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2 text-sm text-white ${toast.type === 'err' ? 'bg-[#B3261E]' : 'bg-[#1A1A17]'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
