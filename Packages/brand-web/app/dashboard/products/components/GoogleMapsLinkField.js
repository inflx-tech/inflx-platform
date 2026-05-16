'use client';

import { useState } from 'react';
import { brandApi } from '../../../../lib/api';

/**
 * GoogleMapsLinkField — Wave 1 Dining, restaurant.json's google_maps_url field.
 *
 * Brand pastes a Google Maps share URL → click Verify → backend calls
 * /v1/internal/geocode-maps-url → returns { verified, lat, lng, locality,
 * formatted_address, place_id, city }. On success we surface a "verified
 * card" with the parsed bits and call onVerified() so the wizard state
 * picks up the derived fields.
 *
 * In dev (GEOCODING_MOCK=true on backend), Verify returns fixed Vijayawada
 * coords regardless of input — lets the wizard work end-to-end without a
 * paid Google API key.
 *
 * Props:
 *   - field:       schema field def
 *   - value:       current URL string
 *   - onChange:    (url) => void
 *   - onVerified:  (geo) => void   — fired on successful verify with the
 *                  full geo response. Wizard layout writes lat/lng/locality
 *                  into wizardState via onMultiChange.
 *   - error:       optional outer error string
 */
export default function GoogleMapsLinkField({ field, value, onChange, onVerified, error }) {
  const [verifying, setVerifying] = useState(false);
  const [geo,       setGeo]       = useState(null);
  const [verifyErr, setVerifyErr] = useState('');

  async function handleVerify() {
    if (!value || !value.trim()) {
      setVerifyErr('Paste a Google Maps URL first');
      return;
    }
    setVerifying(true);
    setVerifyErr('');
    try {
      const res = await brandApi.post('/internal/geocode-maps-url', { google_maps_url: value.trim() });
      const data = res.data || res;
      if (data?.verified) {
        setGeo(data);
        if (typeof onVerified === 'function') onVerified(data);
      } else {
        setVerifyErr(data?.reason || 'Could not verify this URL. Check the link or fill locality manually.');
        setGeo(null);
      }
    } catch (err) {
      setVerifyErr(err.message || 'Verify failed — try again');
      setGeo(null);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="url"
          value={value || ''}
          onChange={(e) => { onChange(e.target.value); setVerifyErr(''); }}
          placeholder="https://maps.google.com/?q=..."
          className={`flex-1 border-2 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none transition-colors focus:border-orange-400 ${
            error || verifyErr ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
          }`}
        />
        <button
          type="button"
          onClick={handleVerify}
          disabled={verifying || !value?.trim()}
          className="px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#EAB308', color: '#1F2328' }}
        >
          {verifying ? 'Verifying…' : 'Verify'}
        </button>
      </div>

      {verifyErr && (
        <div className="px-3 py-2 rounded-lg text-xs border"
             style={{ backgroundColor: 'rgba(255,184,0,0.08)', borderColor: 'rgba(255,184,0,0.3)', color: '#92400E' }}>
          ⚠ {verifyErr}
        </div>
      )}

      {geo && geo.verified && (
        <VerifiedCard geo={geo} />
      )}
    </div>
  );
}

function VerifiedCard({ geo }) {
  return (
    <div className="rounded-xl border bg-white p-3 space-y-2"
         style={{ borderColor: 'rgba(0,184,148,0.3)' }}>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide"
              style={{ backgroundColor: 'rgba(0,184,148,0.12)', color: '#007A63', fontFamily: 'monospace' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#00B894' }} />
          Verified
        </span>
        {geo.source && geo.source !== 'mock' && (
          <span className="text-[10px] text-gray-400 uppercase tracking-wide font-mono">via {geo.source}</span>
        )}
        {geo.source === 'mock' && (
          <span className="text-[10px] text-gray-400 uppercase tracking-wide font-mono">mock mode</span>
        )}
      </div>

      {geo.formatted_address && (
        <div className="text-xs text-gray-600 leading-relaxed">
          {geo.formatted_address}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {geo.locality && (
          <span className="px-2 py-1 rounded-md text-[11px] bg-gray-50 border border-gray-200 text-gray-700">
            📍 {geo.locality}
          </span>
        )}
        {geo.city && (
          <span className="px-2 py-1 rounded-md text-[11px] bg-gray-50 border border-gray-200 text-gray-700">
            {geo.city}{geo.state ? `, ${geo.state}` : ''}
          </span>
        )}
        {geo.lat != null && geo.lng != null && (
          <span className="px-2 py-1 rounded-md text-[11px] bg-gray-100 border border-gray-200 text-gray-600"
                style={{ fontFamily: 'ui-monospace, monospace' }}>
            {Number(geo.lat).toFixed(4)}, {Number(geo.lng).toFixed(4)}
          </span>
        )}
      </div>
    </div>
  );
}
