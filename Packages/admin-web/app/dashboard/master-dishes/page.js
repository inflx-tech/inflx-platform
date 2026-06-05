'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { adminApi } from '../../../lib/api';

/**
 * Master Dishes admin CRUD page.
 *
 * Curated restaurant dish catalogue (master_dishes table, shipped in
 * migration 035). Admin owns content forever; engineering ships the
 * plumbing. Cuisine + section taxonomy is admin-defined — no validation
 * against restaurant.json's brand_config.fields.cuisines.options here.
 * If admin creates a dish in a cuisine that no brand has selected,
 * brands won't see it in the picker — that's a discoverability concern,
 * not a data integrity one.
 *
 * activated_count column is critical signal before delete: shows how
 * many brand_products rows reference this master_dish_id. Deletion
 * cascades via ON DELETE SET NULL — brand rows survive but lose the
 * master reference.
 */

function StatusBadge({ count, color = 'navy' }) {
  if (!count) return <span className="text-[10px] text-t3">—</span>;
  const colors = { navy: 'bg-navy-pale text-navy', red: 'bg-red-pale text-red', orange: 'bg-orange-pale text-orange' };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colors[color] || colors.navy}`}>
      {count}
    </span>
  );
}

function PriceRange({ min, max }) {
  if (min == null && max == null) return <span className="text-[11px] text-t3">—</span>;
  if (min == null) return <span className="text-[11px] text-t2">≤ ₹{max}</span>;
  if (max == null) return <span className="text-[11px] text-t2">≥ ₹{min}</span>;
  return <span className="text-[11px] text-t2">₹{min}–{max}</span>;
}

const EMPTY_FORM = {
  cuisine: '', section: '', name: '',
  default_image_url: '', suggested_price_min: '', suggested_price_max: '',
  default_description: '', sort_order: '',
};

export default function MasterDishesPage() {
  const [items, setItems] = useState([]);
  const [cuisines, setCuisines] = useState([]);   // [{ cuisine, dish_count, sections[] }]
  const [loading, setLoading] = useState(true);

  const [cuisineFilter, setCuisineFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Edit/create modal
  const [editing, setEditing] = useState(null);   // null | 'new' | <dish object>
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // Delete confirm
  const [deleting, setDeleting] = useState(null);   // null | <dish object>
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [toast, setToast] = useState('');

  // Catalogue | Review Queue tab
  const [view, setView] = useState('catalogue');
  const [queueCount, setQueueCount] = useState(0);

  const sectionOptions = useMemo(() => {
    if (!cuisineFilter) return [];
    const c = cuisines.find(x => x.cuisine === cuisineFilter);
    return c?.sections || [];
  }, [cuisineFilter, cuisines]);

  const loadCuisines = useCallback(async () => {
    const res = await adminApi.listCuisines();
    if (res.success) setCuisines(res.data?.cuisines || []);
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    const res = await adminApi.listMasterDishes(cuisineFilter, sectionFilter, search, page);
    setLoading(false);
    if (res.success) {
      setItems(res.data?.items || []);
      const t = res.meta?.total || 0;
      const limit = res.meta?.limit || 50;
      setTotal(t);
      setTotalPages(Math.max(1, Math.ceil(t / limit)));
    }
  }, [cuisineFilter, sectionFilter, search, page]);

  useEffect(() => { loadCuisines(); }, [loadCuisines]);
  useEffect(() => { loadList(); }, [loadList]);

  // Reset section filter when cuisine changes (avoid stale section from prior cuisine)
  useEffect(() => { setSectionFilter(''); setPage(1); }, [cuisineFilter]);
  useEffect(() => { setPage(1); }, [sectionFilter, search]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  function openCreate() {
    setForm({
      ...EMPTY_FORM,
      cuisine: cuisineFilter || '',     // pre-fill if filtered
      section: sectionFilter || '',
    });
    setFormError(null);
    setEditing('new');
  }

  function openEdit(dish) {
    setForm({
      cuisine: dish.cuisine || '',
      section: dish.section || '',
      name: dish.name || '',
      default_image_url: dish.default_image_url || '',
      suggested_price_min: dish.suggested_price_min ?? '',
      suggested_price_max: dish.suggested_price_max ?? '',
      default_description: dish.default_description || '',
      sort_order: dish.sort_order ?? '',
    });
    setFormError(null);
    setEditing(dish);
  }

  async function handleSave() {
    setFormError(null);
    if (!form.cuisine.trim() || !form.section.trim() || !form.name.trim()) {
      setFormError('Cuisine, section, and name are required.');
      return;
    }
    const min = form.suggested_price_min === '' ? null : Number(form.suggested_price_min);
    const max = form.suggested_price_max === '' ? null : Number(form.suggested_price_max);
    if (min != null && max != null && min > max) {
      setFormError('Min price cannot exceed max price.');
      return;
    }

    const payload = {
      cuisine: form.cuisine.trim(),
      section: form.section.trim(),
      name: form.name.trim(),
      default_image_url: form.default_image_url.trim() || null,
      suggested_price_min: min,
      suggested_price_max: max,
      default_description: form.default_description.trim() || null,
      sort_order: form.sort_order === '' ? null : Number(form.sort_order),
    };

    setSaving(true);
    const res = editing === 'new'
      ? await adminApi.createMasterDish(payload)
      : await adminApi.updateMasterDish(editing.id, payload);
    setSaving(false);

    if (res.success) {
      setEditing(null);
      showToast(editing === 'new' ? 'Dish created.' : 'Dish updated.');
      await Promise.all([loadList(), loadCuisines()]);
    } else {
      setFormError(res.error?.message || 'Save failed.');
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    const res = await adminApi.deleteMasterDish(deleting.id);
    setDeleteBusy(false);
    if (res.success) {
      setDeleting(null);
      showToast('Dish deleted.');
      await Promise.all([loadList(), loadCuisines()]);
    } else {
      alert(res.error?.message || 'Delete failed.');
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Master Dishes</h1>
          <p className="text-xs text-t3 mt-0.5">
            Curated restaurant catalogue · {total} {total === 1 ? 'dish' : 'dishes'} across {cuisines.length} cuisines
          </p>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 bg-navy hover:bg-navy/90 text-white text-xs font-bold rounded-xl">
          + Add Dish
        </button>
      </div>

      {/* Tabs: Catalogue | Review Queue */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {[['catalogue', 'Catalogue'], ['queue', 'Review Queue']].map(([key, label]) => (
          <button key={key} onClick={() => setView(key)}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg -mb-px border-b-2 ${view === key ? 'border-navy text-navy' : 'border-transparent text-t3 hover:text-t2'}`}>
            {label}{key === 'queue' && queueCount > 0 ? ` (${queueCount})` : ''}
          </button>
        ))}
      </div>

      {view === 'queue' && <DishReviewQueue onCountChange={setQueueCount} />}

      {view === 'catalogue' && (<>
      {/* Filters */}
      <div className="bg-white rounded-2xl border border-border p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[150px]">
          <label className="block text-[10px] font-bold text-t3 uppercase tracking-wider mb-1">Cuisine</label>
          <select value={cuisineFilter} onChange={e => setCuisineFilter(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-xs">
            <option value="">All ({cuisines.reduce((s, c) => s + c.dish_count, 0)})</option>
            {cuisines.map(c => (
              <option key={c.cuisine} value={c.cuisine}>{c.cuisine} ({c.dish_count})</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="block text-[10px] font-bold text-t3 uppercase tracking-wider mb-1">Section</label>
          <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}
            disabled={!cuisineFilter}
            className="w-full border border-border rounded-lg px-3 py-2 text-xs disabled:bg-surface2 disabled:text-t3">
            <option value="">All sections</option>
            {sectionOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold text-t3 uppercase tracking-wider mb-1">Search by name</label>
          <div className="flex gap-2">
            <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput); }}
              placeholder="e.g. Idli, Biryani"
              className="flex-1 border border-border rounded-lg px-3 py-2 text-xs" />
            <button onClick={() => setSearch(searchInput)}
              className="px-3 py-2 bg-surface2 hover:bg-navy-pale text-t2 text-xs font-bold rounded-lg">Go</button>
            {(search || searchInput) && (
              <button onClick={() => { setSearchInput(''); setSearch(''); }}
                className="px-3 py-2 text-t3 hover:text-t1 text-xs">Clear</button>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-t3">Loading dishes…</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-3xl mb-2">🍽️</p>
            <p className="text-sm font-bold text-t2 mb-1">No dishes match the filters</p>
            <p className="text-xs text-t3 mb-3">Adjust filters or add a new one</p>
            <button onClick={openCreate} className="px-4 py-2 bg-navy text-white text-xs font-bold rounded-xl">
              + Add Dish
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface2 text-[10px] font-bold uppercase tracking-wider text-t3">
              <tr>
                <th className="px-4 py-2 text-left">Photo</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Cuisine · Section</th>
                <th className="px-4 py-2 text-left">Suggested Price</th>
                <th className="px-4 py-2 text-left">Activations</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(d => (
                <tr key={d.id} className="border-t border-border hover:bg-surface2/30">
                  <td className="px-4 py-2.5">
                    <div className="w-12 h-12 rounded-lg bg-surface2 overflow-hidden flex items-center justify-center">
                      {d.default_image_url
                        ? <img src={d.default_image_url} alt={d.name} className="w-full h-full object-cover" />
                        : <span className="text-lg">🍽️</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-sm font-bold text-t1">{d.name}</div>
                    {d.default_description && (
                      <div className="text-[10px] text-t3 mt-0.5 max-w-md truncate">{d.default_description}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-xs font-semibold text-t2">{d.cuisine}</div>
                    <div className="text-[10px] text-t3 mt-0.5">{d.section}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <PriceRange min={d.suggested_price_min} max={d.suggested_price_max} />
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge count={d.activated_count} color={d.activated_count >= 5 ? 'orange' : 'navy'} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => openEdit(d)}
                      className="px-2.5 py-1 text-navy hover:bg-navy-pale text-xs font-semibold rounded mr-1">
                      Edit
                    </button>
                    <button onClick={() => setDeleting(d)}
                      className="px-2.5 py-1 text-red hover:bg-red-pale text-xs font-semibold rounded">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-t3">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 bg-white border border-border rounded-lg text-xs font-semibold disabled:opacity-40">
              ← Prev
            </button>
            <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 bg-white border border-border rounded-lg text-xs font-semibold disabled:opacity-40">
              Next →
            </button>
          </div>
        </div>
      )}
      </>)}

      {/* ═══ Edit / Create modal ═══ */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && setEditing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="font-display text-base font-bold text-t1">
                {editing === 'new' ? 'Add Dish' : `Edit: ${editing.name}`}
              </div>
              <button onClick={() => !saving && setEditing(null)} className="text-t3 hover:text-t1 text-xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {formError && (
                <div className="bg-red-pale border border-red/20 text-red text-xs rounded-lg px-3 py-2">{formError}</div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Cuisine" required>
                  <input list="cuisine-suggestions" value={form.cuisine}
                    onChange={e => setForm({ ...form, cuisine: e.target.value })}
                    placeholder="e.g. South Indian"
                    className="w-full border border-border rounded-lg px-3 py-2 text-xs" />
                  <datalist id="cuisine-suggestions">
                    {cuisines.map(c => <option key={c.cuisine} value={c.cuisine} />)}
                  </datalist>
                </FormField>
                <FormField label="Section" required>
                  <input list="section-suggestions" value={form.section}
                    onChange={e => setForm({ ...form, section: e.target.value })}
                    placeholder="e.g. Tiffins"
                    className="w-full border border-border rounded-lg px-3 py-2 text-xs" />
                  <datalist id="section-suggestions">
                    {(cuisines.find(c => c.cuisine === form.cuisine)?.sections || []).map(s => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </FormField>
              </div>

              <FormField label="Name" required>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Masala Dosa"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm font-semibold" />
              </FormField>

              <FormField label="Default image URL"
                hint="Brands can swap to their own. Use a stable URL (Unsplash IDs work well).">
                <input type="url" value={form.default_image_url}
                  onChange={e => setForm({ ...form, default_image_url: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full border border-border rounded-lg px-3 py-2 text-xs" />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Suggested price min (₹)">
                  <input type="number" value={form.suggested_price_min}
                    onChange={e => setForm({ ...form, suggested_price_min: e.target.value })}
                    placeholder="60"
                    className="w-full border border-border rounded-lg px-3 py-2 text-xs" />
                </FormField>
                <FormField label="Suggested price max (₹)">
                  <input type="number" value={form.suggested_price_max}
                    onChange={e => setForm({ ...form, suggested_price_max: e.target.value })}
                    placeholder="120"
                    className="w-full border border-border rounded-lg px-3 py-2 text-xs" />
                </FormField>
              </div>

              <FormField label="Default description"
                hint="Brand-facing — brands see this in the picker. Max 280 chars.">
                <textarea value={form.default_description}
                  onChange={e => setForm({ ...form, default_description: e.target.value })}
                  rows={2} maxLength={280}
                  placeholder="Steamed rice cakes served with sambar and coconut chutney"
                  className="w-full border border-border rounded-lg px-3 py-2 text-xs resize-none" />
              </FormField>

              <FormField label="Sort order"
                hint="Lower = shown first. Leave blank to auto-append at end of section.">
                <input type="number" value={form.sort_order}
                  onChange={e => setForm({ ...form, sort_order: e.target.value })}
                  placeholder="(auto)"
                  className="w-32 border border-border rounded-lg px-3 py-2 text-xs" />
              </FormField>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <button onClick={() => !saving && setEditing(null)} disabled={saving}
                className="px-4 py-2 bg-surface2 text-t2 text-xs font-semibold rounded-xl hover:bg-navy-pale disabled:opacity-40">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 bg-navy text-white text-xs font-bold rounded-xl disabled:opacity-50">
                {saving ? 'Saving…' : (editing === 'new' ? 'Create dish' : 'Save changes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Delete confirm modal ═══ */}
      {deleting && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !deleteBusy && setDeleting(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4">
              <div className="font-display text-base font-bold text-t1 mb-2">Delete this dish?</div>
              <p className="text-xs text-t2">
                <strong>{deleting.name}</strong> ({deleting.cuisine} · {deleting.section}) will be removed from the catalogue.
              </p>
              {deleting.activated_count > 0 && (
                <div className="mt-3 bg-orange-pale border border-orange/30 rounded-lg p-3 text-xs text-t2">
                  ⚠ <strong>{deleting.activated_count}</strong> brand{deleting.activated_count === 1 ? '' : 's'} {deleting.activated_count === 1 ? 'has' : 'have'} this on their menu. Their listings will survive but lose the master reference (master_dish_id → NULL). They'll still appear on the brand's fleet but won't show as &quot;activated&quot; if you re-create the same dish later.
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <button onClick={() => !deleteBusy && setDeleting(null)} disabled={deleteBusy}
                className="px-4 py-2 bg-surface2 text-t2 text-xs font-semibold rounded-xl">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleteBusy}
                className="px-5 py-2 bg-red text-white text-xs font-bold rounded-xl disabled:opacity-50">
                {deleteBusy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-t1 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

function FormField({ label, required, hint, children }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-t2 mb-1">
        {label} {required && <span className="text-red">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-t3 mt-1 italic">{hint}</p>}
    </div>
  );
}

/**
 * DishReviewQueue — the flywheel inbound surface. Lists custom dish names
 * sellers typed (grouped by normalized name) and lets admin resolve each as
 * alias / promote / reject. Promote reuses the master_dishes create path.
 */
function DishReviewQueue({ onCountChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminApi.listDishQueue();
    setLoading(false);
    if (res.success) {
      const list = res.data?.items || [];
      setItems(list);
      onCountChange?.(list.length);
    }
  }, [onCountChange]);

  useEffect(() => { load(); }, [load]);

  function flash(m) { setToast(m); setTimeout(() => setToast(''), 2800); }

  async function resolve(item, action) {
    const body = { action };
    if (action === 'alias') {
      if (!item.suggested) return;
      body.master_dish_id = item.suggested.master_dish_id;
    }
    if (action === 'promote') {
      const cuisine = window.prompt(`Promote "${item.raw_name}" — which cuisine?`, '');
      if (!cuisine) return;
      const section = window.prompt('Section?', item.section || '');
      if (!section) return;
      body.cuisine = cuisine;
      body.section = section;
    }
    setBusyId(item.id);
    const res = await adminApi.resolveDishQueue(item.id, body);
    setBusyId(null);
    if (res.success) {
      flash(
        action === 'alias'
          ? `Linked — ${res.data?.linked_listings || 0} listings now point to ${item.suggested?.name}`
          : action === 'promote'
            ? `Promoted "${item.raw_name}" to the catalogue`
            : `Rejected "${item.raw_name}"`
      );
      await load();
    } else {
      flash(res.error?.message || 'Action failed');
    }
  }

  if (loading) return <div className="p-12 text-center text-sm text-t3">Loading queue…</div>;
  if (!items.length) {
    return (
      <div className="bg-white rounded-2xl border border-border p-12 text-center">
        <p className="text-3xl mb-2">✅</p>
        <p className="text-sm font-bold text-t2 mb-1">Queue is clear</p>
        <p className="text-xs text-t3">Custom dish names sellers type will appear here for review.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      <div className="grid grid-cols-12 px-5 py-2.5 bg-surface2 text-[10px] font-bold uppercase tracking-wider text-t3">
        <div className="col-span-3">Custom name</div>
        <div className="col-span-2">Reach</div>
        <div className="col-span-3">Suggested match</div>
        <div className="col-span-4 text-right">Action</div>
      </div>
      {items.map(item => (
        <div key={item.id}
          className={`grid grid-cols-12 items-center px-5 py-4 border-t border-border ${item.auto_promote_candidate ? 'bg-orange-pale/40' : ''}`}>
          <div className="col-span-3">
            <div className="text-sm font-bold text-t1 flex items-center gap-2">
              {item.raw_name}
              {item.auto_promote_candidate && (
                <span className="text-[9px] font-bold text-orange px-1.5 py-0.5 rounded-full bg-orange-pale">auto-promote candidate</span>
              )}
            </div>
            <div className="text-[10px] text-t3">{item.section || '—'}</div>
          </div>
          <div className="col-span-2">
            <span className="text-[10px] font-bold text-navy bg-navy-pale px-2 py-1 rounded-full">
              seen at {item.restaurant_count} restaurant{item.restaurant_count === 1 ? '' : 's'}
            </span>
          </div>
          <div className="col-span-3">
            {item.suggested
              ? <div className="text-sm text-t2">{item.suggested.name}{' '}
                  <span className="text-[10px] font-bold text-green bg-green-pale px-1.5 py-0.5 rounded-full">{Math.round(item.suggested.score * 100)}%</span>
                </div>
              : <span className="text-sm text-t3 italic">no close match</span>}
          </div>
          <div className="col-span-4 flex justify-end gap-2">
            {item.suggested && (
              <button disabled={busyId === item.id} onClick={() => resolve(item, 'alias')}
                className="text-xs font-bold text-white bg-navy rounded-lg px-3 py-1.5 disabled:opacity-50">Link as alias</button>
            )}
            <button disabled={busyId === item.id} onClick={() => resolve(item, 'promote')}
              className="text-xs font-bold text-navy border border-navy/30 rounded-lg px-3 py-1.5 disabled:opacity-50">Promote</button>
            <button disabled={busyId === item.id} onClick={() => resolve(item, 'reject')}
              className="text-xs font-semibold text-t3 border border-border rounded-lg px-3 py-1.5 disabled:opacity-50">Reject</button>
          </div>
        </div>
      ))}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-t1 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg z-50">{toast}</div>
      )}
    </div>
  );
}
