'use client';

/**
 * WeeklyScheduleEditor — per-day open/close schedule editor.
 *
 * Two callers (PR-1):
 *   1. TeamMemberListEditor's stylist working-schedule sub-form (extracted
 *      from inline DAYS rendering — UX byte-identical, code dedupes).
 *   2. The new `weekly_schedule` FieldType in DynamicFieldRenderer (used by
 *      restaurant.json's hours_json field after the rework, replacing the
 *      free-text "string" type).
 *
 * Storage shape (preserved from TeamMemberListEditor's prior schedule_json
 * shape — byte-identical so existing salon team_members data needs no
 * migration):
 *
 *   {
 *     mon: { open: "09:00", close: "20:00" } | null,
 *     tue: ...,
 *     ...
 *     sun: { open, close } | null,
 *   }
 *
 * `null` for a day means "closed". Time values are HH:MM 24-hour strings.
 *
 * Props:
 *   - value:    object — the schedule_json shape above (or null/undefined for empty)
 *   - onChange: (next) => void — called with the full updated schedule object
 *   - accent:   optional color hex — defaults to purple to match TeamMemberListEditor
 *               historical accent. Restaurant uses red (#dc2626) per its card_config.
 */

const DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

export function defaultSchedule() {
  const open = '09:00';
  const close = '20:00';
  return {
    mon: { open, close }, tue: { open, close }, wed: { open, close },
    thu: { open, close }, fri: { open, close }, sat: { open, close },
    sun: null,
  };
}

export default function WeeklyScheduleEditor({ value, onChange, accent = '#a855f7' }) {
  const schedule = value || {};

  function setDayWorking(dayKey, working) {
    const next = { ...schedule };
    next[dayKey] = working ? { open: '09:00', close: '20:00' } : null;
    onChange(next);
  }

  function setDayTime(dayKey, slot, val) {
    const next = { ...schedule };
    next[dayKey] = { ...next[dayKey], [slot]: val };
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {DAYS.map(d => {
        const slot = schedule[d.key];
        const working = !!slot;
        return (
          <div key={d.key} className="flex items-center gap-3">
            <button type="button" onClick={() => setDayWorking(d.key, !working)}
              style={working ? { backgroundColor: accent } : undefined}
              className={`w-16 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0
                ${working ? 'text-white' : 'bg-gray-100 text-gray-400'}`}>
              {d.label}
            </button>
            {working ? (
              <div className="flex-1 flex items-center gap-2">
                <input type="time" value={slot.open}
                  onChange={e => setDayTime(d.key, 'open', e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-gray-400" />
                <span className="text-xs text-gray-400">to</span>
                <input type="time" value={slot.close}
                  onChange={e => setDayTime(d.key, 'close', e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-gray-400" />
              </div>
            ) : (
              <span className="flex-1 text-xs text-gray-400 italic">Closed</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
