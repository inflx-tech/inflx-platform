'use client';
import { useEffect, useState, useCallback } from 'react';
import { brandApi, fmtRupees } from '../../../lib/api';

// ─── Dynamic Field Renderer (for non-catalogue categories) ───────────────────

function DynamicField({ field, value, onChange, error }) {
  const base = 'w-full border-2 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none transition-colors focus:border-orange-400';
  const borderCls = error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white';

  if (field.type === 'text' || field.type === 'url') {
    return (
      <input type={field.type === 'url' ? 'url' : 'text'} value={value || ''} onChange={e => onChange(field.key, e.target.value)}
        placeholder={field.placeholder || ''} className={`${base} ${borderCls}`} />
    );
  }
  if (field.type === 'number') {
    return (
      <input type="number" value={value ?? ''} onChange={e => onChange(field.key, e.target.value === '' ? '' : Number(e.target.value))}
        placeholder={field.placeholder || '0'} min={0} className={`${base} ${borderCls}`} />
    );
  }
  if (field.type === 'textarea') {
    return (
      <textarea value={value || ''} onChange={e => onChange(field.key, e.target.value)} placeholder={field.placeholder || ''}
        rows={3} className={`${base} ${borderCls} resize-none`} />
    );
  }
  if (field.type === 'select') {
    return (
      <select value={value || ''} onChange={e => onChange(field.key, e.target.value)} className={`${base} ${borderCls}`}>
        <option value="">— Select {field.label} —</option>
        {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }
  if (field.type === 'veg_toggle') {
    return (
      <div className="flex gap-2">
        {[{ value:'veg', label:'🟢 Veg', color:'border-green-500 bg-green-50 text-green-700' },
          { value:'non_veg', label:'🔴 Non-Veg', color:'border-red-400 bg-red-50 text-red-700' },
          { value:'na', label:'⬜ N/A', color:'border-gray-300 bg-gray-50 text-gray-600' }].map(opt => (
          <button key={opt.value} type="button" onClick={() => onChange(field.key, opt.value)}
            className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold transition-all ${value === opt.value ? opt.color : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'}`}>
            {opt.label}
          </button>
        ))}
      </div>
    );
  }
  if (field.type === 'duration_select') {
    const opts = field.options || [15, 30, 45, 60, 90, 120, 180];
    return (
      <div className="flex flex-wrap gap-2">
        {opts.map(mins => (
          <button key={mins} type="button" onClick={() => onChange(field.key, mins)}
            className={`px-3 py-1.5 rounded-lg border-2 text-xs font-bold transition-all ${value === mins ? 'border-navy bg-navy/10 text-navy' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            {mins >= 60 ? `${Math.floor(mins/60)}h${mins%60 ? ` ${mins%60}m` : ''}` : `${mins}m`}
          </button>
        ))}
      </div>
    );
  }
  if (field.type === 'variant_builder') {
    const variants = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        {variants.map((v, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input value={v.label||''} onChange={e => { const n=[...variants]; n[i]={...n[i],label:e.target.value}; onChange(field.key,n); }}
              placeholder="Package (e.g. Full day)" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-orange-400" />
            <input type="number" value={v.price??''} onChange={e => { const n=[...variants]; n[i]={...n[i],price:Number(e.target.value)}; onChange(field.key,n); }}
              placeholder="₹" className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-orange-400" />
            <button type="button" onClick={() => onChange(field.key, variants.filter((_,j)=>j!==i))} className="text-red-400 hover:text-red-600 text-lg px-1">×</button>
          </div>
        ))}
        <button type="button" onClick={() => onChange(field.key, [...variants, {label:'',price:0}])}
          className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1">+ Add Package</button>
      </div>
    );
  }
  return <input type="text" value={value||''} onChange={e => onChange(field.key, e.target.value)} placeholder={field.placeholder||''} className={`${base} ${borderCls}`} />;
}

// ─── Standard Product Form Modal (non-catalogue categories) ──────────────────

function ProductFormModal({ schema, product, onSave, onClose, saving }) {
  const [form, setForm] = useState(() => {
    if (product) return { ...product };
    const d = {};
    (schema?.fields || []).forEach(f => { d[f.key] = f.default ?? ''; });
    if (schema?.features?.veg_flag) d.veg_flag = 'veg';
    return d;
  });
  const [errors, setErrors] = useState({});
  const noun = schema?.product_noun || 'Product';

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => { const n={...e}; delete n[key]; return n; });
  }
  function validate() {
    const errs = {};
    (schema?.fields || []).forEach(f => {
      if (f.required && (form[f.key] == null || form[f.key] === '')) errs[f.key] = `${f.label} is required`;
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full md:max-w-xl rounded-t-2xl md:rounded-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <div className="font-bold text-gray-900">{product ? `Edit ${noun}` : `Add ${noun}`}</div>
            {schema && <div className="text-[11px] text-gray-400 mt-0.5">{schema.icon} {schema.label}</div>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 text-lg">×</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); if (validate()) onSave(form); }} className="p-5 space-y-4">
          {(schema?.fields || []).map(field => (
            <div key={field.key}>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">
                {field.label}{field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <DynamicField field={field} value={form[field.key]} onChange={setField} error={errors[field.key]} />
              {errors[field.key] && <p className="text-[11px] text-red-500 mt-1">{errors[field.key]}</p>}
            </div>
          ))}
          <div className="flex items-center justify-between py-3 border-t border-gray-100">
            <div>
              <div className="text-sm font-semibold text-gray-700">Active</div>
              <div className="text-[11px] text-gray-400">Show to followers</div>
            </div>
            <button type="button" onClick={() => setField('is_active', !form.is_active)}
              className={`w-11 h-6 rounded-full transition-colors relative ${form.is_active !== false ? 'bg-teal-500' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_active !== false ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 border-2 border-gray-200 text-gray-600 font-bold text-sm rounded-xl hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-sm rounded-xl disabled:opacity-50 hover:shadow-md">
              {saving ? 'Saving…' : product ? 'Save Changes' : `Add ${noun}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Activate Modal (master catalogue — vehicle or service) ──────────────────

function ActivateModal({ item, category, onSave, onClose, saving }) {
  const isVehicle = category === 'car_rental';
  const [price, setPrice] = useState(item.activated_price || '');
  const [packages, setPackages] = useState(() => {
    try { return JSON.parse(item.variants_json || '[]'); } catch { return []; }
  });
  const [error, setError] = useState('');

  function submit(e) {
    e.preventDefault();
    if (!price || Number(price) <= 0) { setError('Enter a valid price'); return; }
    const payload = {
      name: item.display_name || item.name,
      section: item.segment || item.category,
      price: Number(price),
      image_url: item.image_url,
      is_bookable: true,
    };
    if (isVehicle) {
      payload.master_vehicle_id = item.id;
      if (packages.length) payload.variants_json = packages;
      payload.description = `${item.seats} Seats · ${item.fuel_type} · ${item.transmission}`;
    } else {
      payload.master_service_id = item.id;
      payload.duration_mins = item.duration_mins_default;
      payload.description = item.category;
    }
    onSave(payload);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden">
        {/* Vehicle/Service preview */}
        <div className="relative h-44 overflow-hidden">
          {item.image_url
            ? <img src={item.image_url} alt={item.display_name||item.name} className="w-full h-full object-cover" onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
            : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/10" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="text-white font-bold text-lg leading-tight">{item.display_name || item.name}</div>
            {isVehicle
              ? <div className="text-white/75 text-xs mt-1">{item.segment} · {item.seats} seats · {item.fuel_type} · {item.transmission}</div>
              : <div className="text-white/75 text-xs mt-1">{item.category} · {item.duration_mins_default} min</div>}
          </div>
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60">×</button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">
              {isVehicle ? 'Price per Day (₹)' : 'Starting Price (₹)'} <span className="text-red-500">*</span>
            </label>
            <input type="number" min={1} value={price} onChange={e => { setPrice(e.target.value); setError(''); }}
              placeholder={isVehicle ? '2500' : '499'}
              className={`w-full border-2 rounded-xl px-3 py-2.5 text-sm outline-none transition-colors focus:border-orange-400 ${error ? 'border-red-400 bg-red-50' : 'border-gray-200'}`} />
            {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
          </div>

          {isVehicle && (
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Duration Packages (optional)</label>
              <div className="space-y-2">
                {packages.map((v, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input value={v.label||''} onChange={e => { const n=[...packages]; n[i]={...n[i],label:e.target.value}; setPackages(n); }}
                      placeholder="e.g. Half Day, Full Day" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-orange-400" />
                    <input type="number" value={v.price??''} onChange={e => { const n=[...packages]; n[i]={...n[i],price:Number(e.target.value)}; setPackages(n); }}
                      placeholder="₹" className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-orange-400" />
                    <button type="button" onClick={() => setPackages(packages.filter((_,j)=>j!==i))} className="text-red-400 hover:text-red-600 text-lg px-1">×</button>
                  </div>
                ))}
                <button type="button" onClick={() => setPackages([...packages,{label:'',price:0}])}
                  className="text-xs font-semibold text-orange-600 hover:text-orange-700">+ Add Package</button>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-3 border-2 border-gray-200 text-gray-600 font-bold text-sm rounded-xl hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-sm rounded-xl disabled:opacity-50 hover:shadow-md transition-shadow">
              {saving ? 'Adding…' : `Add to My ${isVehicle ? 'Fleet' : 'Services'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Price Modal (already activated items) ───────────────────────────────

function EditPriceModal({ item, category, productId, onSave, onClose, saving }) {
  const isVehicle = category === 'car_rental';
  const [price, setPrice] = useState(item.activated_price || '');
  const [packages, setPackages] = useState(() => {
    try { return JSON.parse(item.variants_json || '[]'); } catch { return []; }
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full md:max-w-sm rounded-t-2xl md:rounded-2xl shadow-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-gray-900">Update Pricing</div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200">×</button>
        </div>
        <div className="text-sm font-semibold text-gray-700 mb-4">{item.display_name || item.name}</div>
        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-600 mb-1.5">{isVehicle ? 'Price per Day (₹)' : 'Price (₹)'}</label>
          <input type="number" min={1} value={price} onChange={e => setPrice(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400" />
        </div>
        {isVehicle && (
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-600 mb-1.5">Duration Packages</label>
            <div className="space-y-2">
              {packages.map((v, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={v.label||''} onChange={e => { const n=[...packages]; n[i]={...n[i],label:e.target.value}; setPackages(n); }}
                    placeholder="Package name" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-orange-400" />
                  <input type="number" value={v.price??''} onChange={e => { const n=[...packages]; n[i]={...n[i],price:Number(e.target.value)}; setPackages(n); }}
                    placeholder="₹" className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-orange-400" />
                  <button type="button" onClick={() => setPackages(packages.filter((_,j)=>j!==i))} className="text-red-400 text-lg px-1">×</button>
                </div>
              ))}
              <button type="button" onClick={() => setPackages([...packages,{label:'',price:0}])} className="text-xs font-semibold text-orange-600">+ Add</button>
            </div>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 border-2 border-gray-200 text-gray-600 font-bold text-sm rounded-xl hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave(productId, { price: Number(price), ...(isVehicle && packages.length ? { variants_json: packages } : {}) })}
            disabled={saving} className="flex-1 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-sm rounded-xl disabled:opacity-50">
            {saving ? 'Saving…' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Master Catalogue UI (car_rental + salon) ─────────────────────────────────

const SEGMENT_ICONS = {
  'Hatchback': '🚙', 'Sedan': '🚗', 'SUV': '🚐', 'MUV': '🚌',
  'Luxury': '🏎', 'Mini Bus': '🚌',
  'Hair Men': '💈', 'Hair Women': '💇', 'Skin': '✨', 'Nails': '💅', 'Makeup': '💄', 'Spa': '🧖',
};

function MasterCatalogueView({ schema, items, category, onActivate, onUpdatePrice, onDeactivate, saving }) {
  const isVehicle  = category === 'car_rental';
  const groups     = [...new Set(items.map(i => isVehicle ? i.segment : i.category))];
  const [tab, setTab] = useState('');
  const [activateItem,  setActivateItem]  = useState(null);
  const [editPriceItem, setEditPriceItem] = useState(null);

  const filtered = tab ? items.filter(i => (isVehicle ? i.segment : i.category) === tab) : items;
  const activated = items.filter(i => i.is_activated);

  return (
    <div>
      {/* ── Activated / My Fleet ── */}
      {activated.length > 0 && (
        <div className="mb-8">
          <h2 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-500 inline-block" />
            {isVehicle ? `My Fleet (${activated.length})` : `My Services (${activated.length})`}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activated.map(item => (
              <div key={item.id} className={`bg-white rounded-2xl border overflow-hidden flex flex-col ${item.is_active ? 'border-teal-200 shadow-sm' : 'border-dashed border-gray-200 opacity-70'}`}>
                <div className="relative h-32 overflow-hidden bg-gray-100">
                  {item.image_url && (
                    <img src={item.image_url} alt={item.display_name||item.name} className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                    <span className="text-white font-bold text-sm leading-tight drop-shadow-sm truncate">{item.display_name||item.name}</span>
                    <span className="text-white font-extrabold text-sm drop-shadow-sm flex-shrink-0 ml-2">{fmtRupees(item.activated_price)}</span>
                  </div>
                  <div className="absolute top-2 right-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.is_active ? 'bg-teal-500 text-white' : 'bg-gray-400 text-white'}`}>
                      {item.is_active ? 'Live' : 'Hidden'}
                    </span>
                  </div>
                </div>
                <div className="p-3 flex-1">
                  <div className="text-[11px] text-gray-400">
                    {isVehicle
                      ? `${item.seats} seats · ${item.fuel_type} · ${item.transmission}`
                      : `${item.category} · ${item.duration_mins_default} min`}
                  </div>
                  {isVehicle && item.variants_json && (() => {
                    try {
                      const pkgs = JSON.parse(item.variants_json);
                      return pkgs.length > 0
                        ? <div className="text-[11px] text-gray-500 mt-1">📦 {pkgs.map(p => p.label).join(' · ')}</div>
                        : null;
                    } catch { return null; }
                  })()}
                </div>
                <div className="border-t border-gray-100 flex">
                  <button onClick={() => setEditPriceItem(item)} className="flex-1 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors">Edit Price</button>
                  <button onClick={() => onDeactivate(item.product_id)} className="flex-1 py-2 text-xs font-semibold text-red-400 hover:bg-red-50 border-l border-gray-100 transition-colors">Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Browse Catalogue ── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-bold text-gray-800 text-sm">
          {isVehicle ? '🔍 Browse Vehicles to Add' : '🔍 Browse Services to Add'}
        </h2>
        <span className="text-xs text-gray-400">{items.filter(i => !i.is_activated).length} available</span>
      </div>

      {/* Segment/category tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none">
        <button onClick={() => setTab('')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap flex-shrink-0 transition-colors ${tab === '' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
          All ({items.filter(i=>!i.is_activated).length})
        </button>
        {groups.map(g => {
          const cnt = items.filter(i => (isVehicle ? i.segment : i.category) === g && !i.is_activated).length;
          return (
            <button key={g} onClick={() => setTab(g === tab ? '' : g)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap flex-shrink-0 transition-colors ${tab === g ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              {SEGMENT_ICONS[g] || ''} {g} {cnt > 0 ? `(${cnt})` : ''}
            </button>
          );
        })}
      </div>

      {/* Master item grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.filter(i => !i.is_activated).map(item => (
          <div key={item.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-gray-300 hover:shadow-md transition-all flex flex-col group">
            <div className="relative h-40 overflow-hidden bg-gray-100">
              {item.image_url
                ? <img src={item.image_url} alt={item.display_name||item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={e => { e.target.style.display='none'; }} />
                : <div className="w-full h-full flex items-center justify-center text-4xl">{SEGMENT_ICONS[item.segment||item.category]||'🚗'}</div>}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-2 left-3 right-3">
                <div className="text-white font-bold text-sm leading-tight drop-shadow-sm">{item.display_name || item.name}</div>
              </div>
              <div className="absolute top-2 left-2">
                <span className="text-[10px] bg-black/40 text-white px-2 py-0.5 rounded-full font-semibold">{item.segment || item.category}</span>
              </div>
            </div>
            <div className="p-3 flex-1">
              {isVehicle
                ? (
                  <div className="flex items-center gap-3 text-[11px] text-gray-500">
                    <span>🪑 {item.seats} seats</span>
                    <span>⛽ {item.fuel_type}</span>
                    <span>⚙️ {item.transmission}</span>
                  </div>
                )
                : (
                  <div className="flex items-center gap-3 text-[11px] text-gray-500">
                    <span>⏱ {item.duration_mins_default} min</span>
                    <span className="capitalize">{item.gender === 'unisex' ? '👥 Unisex' : item.gender === 'men' ? '👨 Men' : '👩 Women'}</span>
                  </div>
                )}
            </div>
            <div className="px-3 pb-3">
              <button onClick={() => setActivateItem(item)}
                className="w-full py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-xs rounded-xl hover:shadow-md transition-shadow">
                + Add to {isVehicle ? 'Fleet' : 'Services'}
              </button>
            </div>
          </div>
        ))}

        {filtered.filter(i => !i.is_activated).length === 0 && (
          <div className="col-span-full py-12 flex flex-col items-center text-gray-400">
            <div className="text-4xl mb-3">✅</div>
            <div className="font-semibold text-sm">All {tab || (isVehicle ? 'vehicle' : 'service')} options added!</div>
            <div className="text-xs mt-1">Switch tabs to see other categories</div>
          </div>
        )}
      </div>

      {/* Activate Modal */}
      {activateItem && (
        <ActivateModal
          item={activateItem}
          category={category}
          saving={saving}
          onClose={() => setActivateItem(null)}
          onSave={async (payload) => {
            await onActivate(payload);
            setActivateItem(null);
          }}
        />
      )}

      {/* Edit Price Modal */}
      {editPriceItem && (
        <EditPriceModal
          item={editPriceItem}
          category={category}
          productId={editPriceItem.product_id}
          saving={saving}
          onClose={() => setEditPriceItem(null)}
          onSave={async (pid, data) => {
            await onUpdatePrice(pid, data);
            setEditPriceItem(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Standard product card (non-catalogue) ────────────────────────────────────

function ProductCard({ product, onEdit, onDelete, onToggle }) {
  const VEG = { veg: '🟢', non_veg: '🔴', na: null };
  const hasVariants = product.variants_json && (() => { try { return JSON.parse(product.variants_json)?.length > 0; } catch { return false; } })();

  return (
    <div className={`bg-white rounded-xl border transition-all ${product.is_active ? 'border-gray-200 hover:border-gray-300 hover:shadow-sm' : 'border-dashed border-gray-200 opacity-60'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {VEG[product.veg_flag] && <span className="text-xs">{VEG[product.veg_flag]}</span>}
              <span className="font-semibold text-sm text-gray-900 truncate">{product.name}</span>
              {!product.is_active && <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Hidden</span>}
            </div>
            {product.section && <span className="text-[11px] text-gray-400 mt-0.5 block">{product.section}</span>}
          </div>
          {product.price != null && <div className="text-sm font-extrabold text-gray-900 flex-shrink-0">{fmtRupees(product.price)}</div>}
        </div>
        {product.description && <p className="text-xs text-gray-500 line-clamp-2 mb-2">{product.description}</p>}
        <div className="flex items-center gap-3 flex-wrap text-[11px] text-gray-400">
          {product.duration_mins > 0 && <span>⏱ {product.duration_mins >= 60 ? `${product.duration_mins/60}h` : `${product.duration_mins}m`}</span>}
          {product.stock > 0 && <span>📦 Stock: {product.stock}</span>}
          {hasVariants && <span>🎛 Variants</span>}
          {product.is_bookable && <span>📅 Bookable</span>}
        </div>
      </div>
      <div className="border-t border-gray-100 flex">
        <button onClick={() => onEdit(product)} className="flex-1 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors">Edit</button>
        <button onClick={() => onToggle(product)} className="flex-1 py-2 text-xs font-semibold border-x border-gray-100 text-gray-500 hover:bg-gray-50 transition-colors">{product.is_active ? 'Hide' : 'Show'}</button>
        <button onClick={() => onDelete(product)} className="flex-1 py-2 text-xs font-semibold text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">Delete</button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [schema,    setSchema]    = useState(null);
  const [products,  setProducts]  = useState([]);
  const [catalogue, setCatalogue] = useState(null); // master catalogue items
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [toast,     setToast]     = useState('');
  const [section,   setSection]   = useState('');

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(''), 3200);
  }, []);

  const isMasterCatalogue = schema?.features?.master_catalogue === true;
  const category = catalogue?.category || (schema?.category_key);

  async function load() {
    const [schemaRes, prodRes] = await Promise.all([brandApi.getSchema(), brandApi.getProducts()]);
    if (schemaRes.success) setSchema(schemaRes.data?.schema);
    if (prodRes.success)   setProducts(prodRes.data?.products || []);

    // If master catalogue category, also fetch catalogue items
    const sch = schemaRes.data?.schema;
    if (sch?.features?.master_catalogue) {
      const catRes = await brandApi.getMasterCatalogue();
      if (catRes.success) setCatalogue(catRes.data);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // ── Handlers (standard) ──
  async function handleSave(form) {
    setSaving(true);
    const isEdit = modal && modal !== 'add';
    const res = isEdit ? await brandApi.updateProduct(modal.id, form) : await brandApi.createProduct(form);
    setSaving(false);
    if (res.success) { showToast(isEdit ? 'Updated!' : 'Added!'); setModal(null); load(); }
    else showToast(res.error?.message || 'Failed to save', 'err');
  }
  async function handleDelete(product) {
    if (!confirm(`Delete "${product.name}"?`)) return;
    const res = await brandApi.deleteProduct(product.id);
    if (res.success) { showToast('Deleted'); load(); }
    else showToast(res.error?.message || 'Delete failed', 'err');
  }
  async function handleToggle(product) {
    const res = await brandApi.updateProduct(product.id, { is_active: !product.is_active });
    if (res.success) load();
    else showToast('Failed to update', 'err');
  }

  // ── Handlers (master catalogue) ──
  async function handleActivate(payload) {
    setSaving(true);
    const res = await brandApi.createProduct(payload);
    setSaving(false);
    if (res.success) { showToast('Added to your listing!'); load(); }
    else showToast(res.error?.message || 'Failed to add', 'err');
  }
  async function handleUpdatePrice(pid, data) {
    setSaving(true);
    const res = await brandApi.updateProduct(pid, data);
    setSaving(false);
    if (res.success) { showToast('Pricing updated!'); load(); }
    else showToast(res.error?.message || 'Failed to update', 'err');
  }
  async function handleDeactivate(pid) {
    if (!confirm('Remove this from your listing?')) return;
    const res = await brandApi.deleteProduct(pid);
    if (res.success) { showToast('Removed'); load(); }
    else showToast(res.error?.message || 'Failed to remove', 'err');
  }

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="h-8 bg-gray-100 rounded-xl w-64 mb-5 animate-pulse" />
        <div className="flex gap-2 mb-5">
          {[1,2,3,4].map(i => <div key={i} className="h-8 w-24 bg-gray-100 rounded-full animate-pulse" />)}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-52 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const noun       = schema?.product_noun        || 'Product';
  const nounPlural = schema?.product_noun_plural  || 'Products';
  const icon       = schema?.icon                || '🏪';
  const sections   = schema?.sections            || [];
  const isEnquiry  = schema?.features?.enquiry_only;

  // For non-catalogue: filter by section
  const filtered   = section ? products.filter(p => p.section === section) : products;
  const activeCount = (isMasterCatalogue ? (catalogue?.items||[]).filter(i=>i.is_activated) : products.filter(p => p.is_active)).length;
  const totalCount  = isMasterCatalogue ? (catalogue?.items||[]).filter(i=>i.is_activated).length : products.length;

  return (
    <div className="max-w-6xl mx-auto pb-16">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[100] px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold transition-all ${toast.type === 'err' ? 'bg-red-500 text-white' : 'bg-teal-600 text-white'}`}>
          {toast.type === 'err' ? '✗' : '✓'} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-bold text-2xl text-gray-900">{icon} {nounPlural}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {schema?.label} ·{' '}
            {isMasterCatalogue
              ? `${activeCount} active in your listing`
              : `${products.filter(p=>p.is_active).length} active of ${products.length} total`}
          </p>
        </div>
        {!isMasterCatalogue && !isEnquiry && (
          <button onClick={() => setModal('add')}
            className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-sm rounded-xl hover:shadow-md transition-shadow">
            + Add {noun}
          </button>
        )}
      </div>

      {/* Enquiry-only notice */}
      {isEnquiry && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-5 flex gap-4 items-start">
          <div className="text-2xl">📋</div>
          <div>
            <div className="font-bold text-blue-800 mb-1">This category uses enquiry forms only</div>
            <div className="text-sm text-blue-700">Followers see a structured enquiry form. Leads appear in your Enquiries tab. You can still add packages below.</div>
          </div>
        </div>
      )}

      {/* Schema info bar */}
      {schema && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 flex items-center gap-4 flex-wrap text-xs text-gray-500">
          <span className="font-semibold text-gray-700 text-sm">{icon} {schema.label}</span>
          {schema.availing_modes?.length > 0 && (
            <span>🛒 {schema.availing_modes.map(m => m.replace(/_/g,'  ')).join(' · ')}</span>
          )}
          {schema.features?.booking && <span>📅 {schema.booking_type} booking</span>}
          {isMasterCatalogue && <span className="text-teal-600 font-semibold">✦ Professional catalogue</span>}
        </div>
      )}

      {/* ── MASTER CATALOGUE VIEW ── */}
      {isMasterCatalogue && catalogue && (
        <MasterCatalogueView
          schema={schema}
          items={catalogue.items || []}
          category={catalogue.category}
          saving={saving}
          onActivate={handleActivate}
          onUpdatePrice={handleUpdatePrice}
          onDeactivate={handleDeactivate}
        />
      )}

      {/* ── STANDARD VIEW (non-catalogue) ── */}
      {!isMasterCatalogue && (
        <>
          {/* Section filter tabs */}
          {sections.length > 0 && (
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none">
              <button onClick={() => setSection('')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap flex-shrink-0 transition-colors ${section === '' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                All ({products.length})
              </button>
              {sections.map(s => {
                const cnt = products.filter(p => p.section === s).length;
                return (
                  <button key={s} onClick={() => setSection(s === section ? '' : s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap flex-shrink-0 transition-colors ${section === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {s} {cnt > 0 && `(${cnt})`}
                  </button>
                );
              })}
            </div>
          )}

          {/* Product grid */}
          {filtered.length === 0 ? (
            <div className="py-20 flex flex-col items-center text-gray-400">
              <div className="text-5xl mb-4">{icon}</div>
              <div className="font-semibold text-sm mb-1">No {nounPlural.toLowerCase()} yet</div>
              <div className="text-xs mb-4">Add your first {noun.toLowerCase()} to show it on your store</div>
              {!isEnquiry && (
                <button onClick={() => setModal('add')} className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-sm rounded-xl hover:shadow-md transition-shadow">
                  + Add {noun}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(product => (
                <ProductCard key={product.id} product={product} onEdit={setModal} onDelete={handleDelete} onToggle={handleToggle} />
              ))}
              {!isEnquiry && (
                <button onClick={() => setModal('add')}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400 hover:border-orange-300 hover:text-orange-400 transition-colors flex flex-col items-center justify-center gap-2 min-h-[120px]">
                  <span className="text-2xl">+</span>
                  <span className="text-xs font-semibold">Add {noun}</span>
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Standard Product Modal */}
      {modal && !isMasterCatalogue && (
        <ProductFormModal
          schema={schema}
          product={modal !== 'add' ? modal : null}
          saving={saving}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
