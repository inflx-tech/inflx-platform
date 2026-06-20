'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '../../../lib/api';

const ROLE_STYLES = {
  superadmin: 'bg-red-100 text-red-700',
  finance:    'bg-purple-100 text-purple-700',
  reviewer:   'bg-blue-100 text-blue-700',
};

export default function AdminUsersPage() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toast, setToast]     = useState('');

  // Capability catalog (B-2) — drives the checkboxes for both create + edit.
  const [catalog, setCatalog]       = useState([]); // [{ key, label, group }]
  const [defaultsByRole, setDefaults] = useState({}); // { reviewer:[...], ... }

  // New user form
  const [phone, setPhone]     = useState('');
  const [name, setName]       = useState('');
  const [role, setRole]       = useState('reviewer');
  const [caps, setCaps]       = useState([]); // capability keys ticked

  // Inline edit state — id of the admin being edited, plus its draft.
  const [editId, setEditId]       = useState(null);
  const [editRole, setEditRole]   = useState('reviewer');
  const [editCaps, setEditCaps]   = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function load() {
    const res = await adminApi.getAdminUsers();
    setLoading(false);
    if (res.success) setUsers(res.data?.admin_users || []);
  }

  useEffect(() => {
    load();
    // Load the capability catalog so checkboxes never hardcode keys.
    adminApi.getCapabilityCatalog().then((res) => {
      if (res.success) {
        setCatalog(res.data?.capabilities || []);
        setDefaults(res.data?.defaults_by_role || {});
      }
    });
  }, []);

  // When the create-form role changes, default the ticked caps to that role's
  // defaults (the superadmin can then tweak individual sections).
  function onRoleChange(newRole) {
    setRole(newRole);
    setCaps(defaultsByRole[newRole] ? [...defaultsByRole[newRole]] : []);
  }

  function toggleCap(list, setList, key) {
    setList(list.includes(key) ? list.filter(k => k !== key) : [...list, key]);
  }

  async function create(e) {
    e.preventDefault();
    if (!phone.trim() || !name.trim()) { showToast('Phone and name are required'); return; }
    setCreating(true);
    const res = await adminApi.createAdminUser({
      phone: phone.trim(), name: name.trim(), admin_role: role, capabilities: caps,
    });
    setCreating(false);
    if (res.success) {
      showToast(`Admin user created: ${name}`);
      setPhone(''); setName(''); setRole('reviewer'); setCaps([]);
      setShowForm(false);
      load();
    } else {
      showToast(res.error?.message || 'Failed to create user');
    }
  }

  function startEdit(u) {
    setEditId(u.id);
    setEditRole(u.admin_role);
    setEditCaps(Array.isArray(u.capabilities) ? [...u.capabilities] : []);
  }

  async function saveEdit(u) {
    setSavingEdit(true);
    const res = await adminApi.updateAdminUser(u.id, {
      admin_role: editRole, capabilities: editCaps,
    });
    setSavingEdit(false);
    if (res.success) {
      showToast(`Updated ${u.name}`);
      setEditId(null);
      load();
    } else {
      showToast(res.error?.message || 'Failed to update');
    }
  }

  async function toggleActive(u) {
    const res = await adminApi.updateAdminUser(u.id, { active: !u.active });
    if (res.success) {
      showToast(u.active ? `${u.name} deactivated` : `${u.name} reactivated`);
      load();
    } else {
      showToast(res.error?.message || 'Failed to update');
    }
  }

  // Render checkboxes grouped by the catalog `group`.
  function CapabilityGrid({ selected, setSelected }) {
    const groups = catalog.reduce((acc, c) => {
      (acc[c.group] = acc[c.group] || []).push(c);
      return acc;
    }, {});
    return (
      <div className="space-y-3">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group}>
            <div className="text-[9px] font-bold text-t3 uppercase tracking-wider mb-1.5">{group}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {items.map(c => (
                <label key={c.key} className="flex items-center gap-2 text-xs text-t2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(c.key)}
                    onChange={() => toggleCap(selected, setSelected, c.key)}
                    className="accent-navy w-3.5 h-3.5"
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-xl font-bold text-t1">Admin Users</h1>
        <button
          onClick={() => { setShowForm(!showForm); if (!showForm) onRoleChange('reviewer'); }}
          className="px-4 py-2 bg-gradient-to-r from-red to-orange text-white font-bold text-xs rounded-xl hover:opacity-90 transition-opacity"
        >
          + Add Admin User
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-border p-5 mb-5">
          <h2 className="font-display text-sm font-bold text-t1 mb-4">New Admin User</h2>
          <form onSubmit={create} className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-t3 uppercase tracking-wider block mb-1">Phone (E.164)</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+919876543210"
                required
                className="w-full border-2 border-border2 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-navy"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-t3 uppercase tracking-wider block mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Admin Name"
                required
                className="w-full border-2 border-border2 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-navy"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-t3 uppercase tracking-wider block mb-1">Base Role</label>
              <select
                value={role}
                onChange={e => onRoleChange(e.target.value)}
                className="w-full border-2 border-border2 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-navy bg-white"
              >
                <option value="reviewer">Reviewer — Approval queue, read-only profiles</option>
                <option value="finance">Finance — Escrow, payout queue, financial reports</option>
                <option value="superadmin">Super Admin — Full platform access</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-t3 uppercase tracking-wider block mb-2">
                Section Access {role === 'superadmin' && <span className="text-t3 normal-case font-normal">(superadmin sees every section regardless)</span>}
              </label>
              <CapabilityGrid selected={caps} setSelected={setCaps} />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={creating}
                className="flex-1 py-2.5 bg-navy text-white font-bold text-xs rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity">
                {creating ? 'Creating…' : 'Create User'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2.5 bg-surface2 text-t2 font-bold text-xs rounded-xl hover:bg-border transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User list */}
      {loading ? (
        <div className="text-center py-12 text-t3 text-sm">Loading…</div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
          <div className="text-3xl mb-3">👥</div>
          <div className="font-bold text-t1 mb-1">No admin users yet</div>
          <div className="text-xs text-t3">Use the button above to create admin accounts</div>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u, i) => (
            <div key={u.id || i} className={`bg-white rounded-xl border border-border p-4 ${u.active === false ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-navy-pale flex items-center justify-center text-[10px] font-bold text-navy flex-shrink-0">
                  {(u.name || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-t1 truncate">{u.name}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ${ROLE_STYLES[u.admin_role] || 'bg-gray-100 text-gray-600'}`}>
                      {u.admin_role}
                    </span>
                    {u.active === false && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold bg-gray-200 text-gray-600">INACTIVE</span>
                    )}
                  </div>
                  <span className="text-xs text-t3 font-mono">{u.phone}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => (editId === u.id ? setEditId(null) : startEdit(u))}
                    className="text-[11px] font-bold text-navy hover:underline">
                    {editId === u.id ? 'Close' : 'Edit'}
                  </button>
                  <button onClick={() => toggleActive(u)}
                    className={`text-[11px] font-bold hover:underline ${u.active === false ? 'text-green-600' : 'text-red'}`}>
                    {u.active === false ? 'Reactivate' : 'Deactivate'}
                  </button>
                </div>
              </div>

              {/* Capability chips (read view) */}
              {editId !== u.id && (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {u.admin_role === 'superadmin' ? (
                    <span className="text-[10px] text-t3 italic">Full access — every section</span>
                  ) : (Array.isArray(u.capabilities) && u.capabilities.length) ? (
                    u.capabilities.map(k => (
                      <span key={k} className="inline-flex px-2 py-0.5 rounded-md text-[9px] font-medium bg-surface2 text-t2 border border-border">
                        {(catalog.find(c => c.key === k)?.label) || k}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-t3 italic">No section access</span>
                  )}
                </div>
              )}

              {/* Inline edit */}
              {editId === u.id && (
                <div className="mt-3 pt-3 border-t border-border space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-t3 uppercase tracking-wider block mb-1">Base Role</label>
                    <select
                      value={editRole}
                      onChange={e => setEditRole(e.target.value)}
                      className="w-full border-2 border-border2 rounded-xl px-3 py-2 text-sm outline-none focus:border-navy bg-white"
                    >
                      <option value="reviewer">Reviewer</option>
                      <option value="finance">Finance</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-t3 uppercase tracking-wider block mb-2">
                      Section Access {editRole === 'superadmin' && <span className="text-t3 normal-case font-normal">(superadmin sees every section regardless)</span>}
                    </label>
                    <CapabilityGrid selected={editCaps} setSelected={setEditCaps} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(u)} disabled={savingEdit}
                      className="py-2 px-4 bg-navy text-white font-bold text-xs rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity">
                      {savingEdit ? 'Saving…' : 'Save changes'}
                    </button>
                    <button onClick={() => setEditId(null)}
                      className="py-2 px-4 bg-surface2 text-t2 font-bold text-xs rounded-xl hover:bg-border transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
