'use client';

import TeamMemberListEditor from './TeamMemberListEditor';
import WeeklyScheduleEditor from './WeeklyScheduleEditor';

/**
 * DynamicFieldRenderer — renders any field type from a business type config.
 *
 * Legacy types: text, url, number, textarea, select, veg_toggle,
 *   duration_select, variant_builder, chip_group, toggle
 *
 * v1.3 contract types (PR-B step 3.1):
 *   - string         (alias for text)
 *   - boolean        (alias for toggle)
 *   - multi_select   (alias for chip_group)
 *   - team_member_list (sub-form via TeamMemberListEditor)
 *
 * v1.4 contract types (restaurant rework PR-1):
 *   - weekly_schedule (per-day open/close editor via WeeklyScheduleEditor —
 *     used by restaurant.json's hours_json after the rework, replacing the
 *     free-text "string" type that DynamicFieldRenderer was aliasing to text)
 *
 * Image / image[] / phone / email / date / time fall through to text-input
 * fallback for now — wired when their consumers land.
 */

export default function DynamicFieldRenderer({ field, value, onChange, error }) {
  const base = 'w-full border-2 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none transition-colors focus:border-orange-400';
  const borderCls = error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white';

  // ── team_member_list (v1.3 — sub-form) ─────────────────────────────────────
  if (field.type === 'team_member_list') {
    return (
      <TeamMemberListEditor
        value={value}
        onChange={(next) => onChange(field.key, next)}
      />
    );
  }

  // ── weekly_schedule (v1.4 — per-day open/close editor) ─────────────────────
  if (field.type === 'weekly_schedule') {
    return (
      <WeeklyScheduleEditor
        value={value}
        onChange={(next) => onChange(field.key, next)}
      />
    );
  }

  // ── v1.3 type aliases — collapse to existing renderers below ───────────────
  // Schemas authored against contracts-v1.3 use snake_case type names that
  // map to the legacy renderers. Aliasing here (vs. duplicating the cases)
  // keeps one rendering source per UX pattern.
  const effectiveType =
    field.type === 'string'       ? 'text' :
    field.type === 'boolean'      ? 'toggle' :
    field.type === 'multi_select' ? 'chip_group' :
    field.type;
  // Re-derive `field` with the aliased type for the legacy switch below.
  if (effectiveType !== field.type) {
    field = { ...field, type: effectiveType };
  }

  // ── Text / URL ─────────────────────────────────────────────────────────────
  if (field.type === 'text' || field.type === 'url') {
    return (
      <input type={field.type === 'url' ? 'url' : 'text'} value={value || ''} onChange={e => onChange(field.key, e.target.value)}
        placeholder={field.placeholder || ''} className={`${base} ${borderCls}`} />
    );
  }

  // ── Number ─────────────────────────────────────────────────────────────────
  if (field.type === 'number') {
    return (
      <input type="number" value={value ?? ''} onChange={e => onChange(field.key, e.target.value === '' ? '' : Number(e.target.value))}
        placeholder={field.placeholder || '0'} min={0} className={`${base} ${borderCls}`} />
    );
  }

  // ── Textarea ───────────────────────────────────────────────────────────────
  if (field.type === 'textarea') {
    return (
      <textarea value={value || ''} onChange={e => onChange(field.key, e.target.value)} placeholder={field.placeholder || ''}
        rows={3} className={`${base} ${borderCls} resize-none`} />
    );
  }

  // ── Select ─────────────────────────────────────────────────────────────────
  if (field.type === 'select') {
    return (
      <select value={value || ''} onChange={e => onChange(field.key, e.target.value)} className={`${base} ${borderCls}`}>
        <option value="">— Select {field.label} —</option>
        {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }

  // ── Veg Toggle ─────────────────────────────────────────────────────────────
  if (field.type === 'veg_toggle') {
    return (
      <div className="flex gap-2">
        {[{ value: 'veg', label: '🟢 Veg', color: 'border-green-500 bg-green-50 text-green-700' },
          { value: 'non_veg', label: '🔴 Non-Veg', color: 'border-red-400 bg-red-50 text-red-700' },
          { value: 'na', label: '⬜ N/A', color: 'border-gray-300 bg-gray-50 text-gray-600' }].map(opt => (
          <button key={opt.value} type="button" onClick={() => onChange(field.key, opt.value)}
            className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold transition-all ${value === opt.value ? opt.color : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'}`}>
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  // ── Duration Select ────────────────────────────────────────────────────────
  if (field.type === 'duration_select') {
    const opts = field.options || [15, 30, 45, 60, 90, 120, 180];
    return (
      <div className="flex flex-wrap gap-2">
        {opts.map(mins => (
          <button key={mins} type="button" onClick={() => onChange(field.key, mins)}
            className={`px-3 py-1.5 rounded-lg border-2 text-xs font-bold transition-all ${value === mins ? 'border-navy bg-navy/10 text-navy' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            {mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`}
          </button>
        ))}
      </div>
    );
  }

  // ── Variant Builder ────────────────────────────────────────────────────────
  if (field.type === 'variant_builder') {
    const variants = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        {variants.map((v, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input value={v.label || ''} onChange={e => { const n = [...variants]; n[i] = { ...n[i], label: e.target.value }; onChange(field.key, n); }}
              placeholder="Package (e.g. Full day)" className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-orange-400" />
            <input type="number" value={v.price ?? ''} onChange={e => { const n = [...variants]; n[i] = { ...n[i], price: Number(e.target.value) }; onChange(field.key, n); }}
              placeholder="₹" className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-orange-400" />
            <button type="button" onClick={() => onChange(field.key, variants.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-lg px-1">×</button>
          </div>
        ))}
        <button type="button" onClick={() => onChange(field.key, [...variants, { label: '', price: 0 }])}
          className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1">+ Add Package</button>
      </div>
    );
  }

  // ── Chip Group (NEW — multi-select pills) ──────────────────────────────────
  if (field.type === 'chip_group') {
    const selected = Array.isArray(value) ? value : [];
    const isMulti = field.multi !== false;
    return (
      <div className="flex flex-wrap gap-2">
        {(field.options || []).map(opt => {
          const isActive = selected.includes(opt);
          return (
            <button key={opt} type="button"
              onClick={() => {
                if (isMulti) {
                  onChange(field.key, isActive ? selected.filter(s => s !== opt) : [...selected, opt]);
                } else {
                  onChange(field.key, [opt]);
                }
              }}
              className={`px-3 py-1.5 rounded-full border-2 text-xs font-semibold transition-all
                ${isActive ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  // ── Toggle (NEW — boolean switch) ──────────────────────────────────────────
  if (field.type === 'toggle') {
    const isOn = !!value;
    return (
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onChange(field.key, !isOn)}
          className={`w-11 h-6 rounded-full relative transition-colors ${isOn ? 'bg-orange-500' : 'bg-gray-300'}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isOn ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
        <span className="text-sm text-gray-600">{field.label}</span>
        {field.follower_sync && isOn && (
          <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">
            {field.follower_sync.text}
          </span>
        )}
      </div>
    );
  }

  // ── Fallback ───────────────────────────────────────────────────────────────
  return (
    <input type="text" value={value || ''} onChange={e => onChange(field.key, e.target.value)}
      placeholder={field.placeholder || ''} className={`${base} ${borderCls}`} />
  );
}
