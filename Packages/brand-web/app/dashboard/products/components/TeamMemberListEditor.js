'use client';

import { useState } from 'react';

/**
 * TeamMemberListEditor — sub-form renderer for the `team_member_list` FieldType.
 *
 * Used by salon's brand_team wizard step (and any future category that needs
 * a list of named team members — clinics for doctors, spas for therapists).
 *
 * Per spec section 7:
 *   - List view: photo + name + role + speciality chips per stylist; tap to edit;
 *     "Add Stylist" button appends.
 *   - Edit view: name (required), photo (optional, R2 deferred), role (select),
 *     speciality tags (multi_select), per-day working schedule.
 *
 * Persists value as TeamMember[] into wizardState (the wizard's brand_fields
 * step then routes it to brands.listing_data via publishDriver's brand-write
 * path on Publish). This component is pure-functional — no API calls.
 *
 * `id` is generated client-side via crypto.randomUUID() and is the value
 * referenced by services' available_stylist_ids on brand_products. Never reuse
 * or reorder. SlotPickerScreen filters dangling refs defensively (PR-B).
 */

const ROLE_OPTIONS = ['Stylist', 'Senior Stylist', 'Manager', 'Apprentice'];
const SPECIALITY_OPTIONS = ['Haircut', 'Color', 'Styling', 'Skin', 'Nails', 'Bridal', 'Spa', 'Massage'];
const DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

// Default schedule: 9am-8pm Mon-Sat, Sun off. brand.hours_json is a free-form
// string today (e.g., "Mon-Sat 9 AM - 8 PM"); not reliably parseable per-day,
// so we use sensible defaults the brand can override per stylist.
function defaultSchedule() {
  const open = '09:00';
  const close = '20:00';
  return {
    mon: { open, close }, tue: { open, close }, wed: { open, close },
    thu: { open, close }, fri: { open, close }, sat: { open, close },
    sun: null,
  };
}

function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'tm_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function emptyMember() {
  return {
    id: genId(),
    name: '',
    photo_url: '',
    role: 'Stylist',
    speciality_tags: [],
    schedule_json: defaultSchedule(),
  };
}

export default function TeamMemberListEditor({ value, onChange }) {
  const members = Array.isArray(value) ? value : [];
  const [editingIdx, setEditingIdx] = useState(null);   // null = list view; -1 = adding new; >=0 = editing existing
  const [draft, setDraft] = useState(null);

  function startAdd() {
    setDraft(emptyMember());
    setEditingIdx(-1);
  }

  function startEdit(idx) {
    setDraft({ ...members[idx] });
    setEditingIdx(idx);
  }

  function saveDraft() {
    if (!draft.name?.trim()) {
      alert('Stylist name is required.');
      return;
    }
    if (editingIdx === -1) {
      onChange([...members, draft]);
    } else {
      const next = [...members];
      next[editingIdx] = draft;
      onChange(next);
    }
    setEditingIdx(null);
    setDraft(null);
  }

  function cancelDraft() {
    setEditingIdx(null);
    setDraft(null);
  }

  function removeMember(idx) {
    if (!confirm(`Remove ${members[idx].name || 'this stylist'}? Services that reference them will need re-assignment.`)) return;
    onChange(members.filter((_, i) => i !== idx));
  }

  // ── Edit / Add view ────────────────────────────────────────────────────────

  if (editingIdx !== null && draft) {
    return <TeamMemberForm draft={draft} setDraft={setDraft} onSave={saveDraft} onCancel={cancelDraft} />;
  }

  // ── List view ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {members.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-3xl mb-2">💇</p>
          <p className="text-sm font-bold text-gray-700 mb-1">No stylists yet</p>
          <p className="text-xs text-gray-400 mb-3">Add your first stylist so you can assign them to services</p>
          <button type="button" onClick={startAdd}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold rounded-xl">
            + Add your first stylist
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {members.map((m, idx) => (
              <button key={m.id} type="button" onClick={() => startEdit(idx)}
                className="w-full bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3 hover:border-purple-300 transition-colors text-left">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl flex-shrink-0 overflow-hidden">
                  {m.photo_url
                    ? <img src={m.photo_url} alt={m.name} className="w-full h-full object-cover" />
                    : '💇'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">{m.name || 'Unnamed stylist'}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">{m.role}</span>
                  </div>
                  {m.speciality_tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {m.speciality_tags.slice(0, 4).map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{t}</span>
                      ))}
                      {m.speciality_tags.length > 4 && (
                        <span className="text-[10px] text-gray-400">+{m.speciality_tags.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); removeMember(idx); }}
                  className="text-red-400 hover:text-red-600 text-xs font-semibold ml-2">Remove</button>
              </button>
            ))}
          </div>
          <button type="button" onClick={startAdd}
            className="w-full py-2.5 border-2 border-dashed border-gray-300 hover:border-purple-400 text-gray-600 hover:text-purple-600 text-sm font-semibold rounded-xl transition-colors">
            + Add Stylist
          </button>
        </>
      )}
    </div>
  );
}

// ── Edit / Add form ──────────────────────────────────────────────────────────

function TeamMemberForm({ draft, setDraft, onSave, onCancel }) {
  function setField(key, val) {
    setDraft(prev => ({ ...prev, [key]: val }));
  }
  function toggleSpeciality(tag) {
    const current = draft.speciality_tags || [];
    const next = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
    setField('speciality_tags', next);
  }
  function setDayWorking(dayKey, working) {
    const next = { ...draft.schedule_json };
    next[dayKey] = working ? { open: '09:00', close: '20:00' } : null;
    setField('schedule_json', next);
  }
  function setDayTime(dayKey, slot, value) {
    const next = { ...draft.schedule_json };
    next[dayKey] = { ...next[dayKey], [slot]: value };
    setField('schedule_json', next);
  }

  return (
    <div className="space-y-4">
      <div className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">
        {draft.name ? `Edit ${draft.name}` : 'Add Stylist'}
      </div>

      {/* Name */}
      <Field label="Name" required>
        <input type="text" value={draft.name} onChange={e => setField('name', e.target.value)}
          placeholder="e.g. Priya Sharma"
          className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-400" />
      </Field>

      {/* Photo URL — R2 upload not wired (per contracts-v1.3 §9 deferred); URL paste for now */}
      <Field label="Photo URL" hint="Photo upload coming soon — paste an image URL for now">
        <input type="url" value={draft.photo_url || ''} onChange={e => setField('photo_url', e.target.value)}
          placeholder="https://..."
          className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-400" />
      </Field>

      {/* Role */}
      <Field label="Role">
        <div className="grid grid-cols-2 gap-2">
          {ROLE_OPTIONS.map(role => (
            <button key={role} type="button" onClick={() => setField('role', role)}
              className={`py-2 rounded-xl border-2 text-xs font-bold transition-all
                ${draft.role === role
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              {role}
            </button>
          ))}
        </div>
      </Field>

      {/* Specialities */}
      <Field label="Specialities" hint="Tap to toggle">
        <div className="flex flex-wrap gap-2">
          {SPECIALITY_OPTIONS.map(tag => {
            const active = draft.speciality_tags?.includes(tag);
            return (
              <button key={tag} type="button" onClick={() => toggleSpeciality(tag)}
                className={`px-3 py-1.5 rounded-full border-2 text-xs font-semibold transition-all
                  ${active
                    ? 'border-purple-400 bg-purple-50 text-purple-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                {tag}
              </button>
            );
          })}
        </div>
      </Field>

      {/* Schedule */}
      <Field label="Working schedule" hint="Default 9 AM – 8 PM. Toggle off any days they don't work.">
        <div className="space-y-2">
          {DAYS.map(d => {
            const slot = draft.schedule_json?.[d.key];
            const working = !!slot;
            return (
              <div key={d.key} className="flex items-center gap-3">
                <button type="button" onClick={() => setDayWorking(d.key, !working)}
                  className={`w-16 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0
                    ${working
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 text-gray-400'}`}>
                  {d.label}
                </button>
                {working ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input type="time" value={slot.open} onChange={e => setDayTime(d.key, 'open', e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-purple-400" />
                    <span className="text-xs text-gray-400">to</span>
                    <input type="time" value={slot.close} onChange={e => setDayTime(d.key, 'close', e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-purple-400" />
                  </div>
                ) : (
                  <span className="flex-1 text-xs text-gray-400 italic">Off</span>
                )}
              </div>
            );
          })}
        </div>
      </Field>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700">
          Cancel
        </button>
        <button type="button" onClick={onSave}
          className="px-5 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-bold rounded-xl">
          Save stylist
        </button>
      </div>
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-gray-400 mt-1 italic">{hint}</p>}
    </div>
  );
}
