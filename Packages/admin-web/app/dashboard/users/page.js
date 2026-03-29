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

  // New user form
  const [phone, setPhone]     = useState('');
  const [name, setName]       = useState('');
  const [role, setRole]       = useState('reviewer');

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function load() {
    const res = await adminApi.getAdminUsers();
    setLoading(false);
    if (res.success) setUsers(res.data?.admin_users || []);
  }

  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    if (!phone.trim() || !name.trim()) { showToast('Phone and name are required'); return; }
    setCreating(true);
    const res = await adminApi.createAdminUser({ phone: phone.trim(), name: name.trim(), admin_role: role });
    setCreating(false);
    if (res.success) {
      showToast(`Admin user created: ${name}`);
      setPhone(''); setName(''); setRole('reviewer');
      setShowForm(false);
      load();
    } else {
      showToast(res.error?.message || 'Failed to create user');
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-xl font-bold text-t1">Admin Users</h1>
        <button
          onClick={() => setShowForm(!showForm)}
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
              <label className="text-[10px] font-bold text-t3 uppercase tracking-wider block mb-1">Role</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full border-2 border-border2 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-navy bg-white"
              >
                <option value="reviewer">Reviewer — Approval queue, read-only profiles</option>
                <option value="finance">Finance — Escrow, payout queue, financial reports</option>
                <option value="superadmin">Super Admin — Full platform access</option>
              </select>
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
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3 bg-surface2 border-b border-border text-[10px] font-bold text-t3 uppercase tracking-wider grid grid-cols-4 gap-2">
            <span>Name</span><span>Phone</span><span>Role</span><span>Added</span>
          </div>
          {users.map((u, i) => (
            <div key={u.id || i} className="grid grid-cols-4 gap-2 px-5 py-3.5 border-b border-border/50 last:border-0 hover:bg-surface2 transition-colors items-center">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-navy-pale flex items-center justify-center text-[10px] font-bold text-navy flex-shrink-0">
                  {(u.name || '?').slice(0, 2).toUpperCase()}
                </div>
                <span className="font-semibold text-sm text-t1 truncate">{u.name}</span>
              </div>
              <span className="text-xs text-t2 font-mono">{u.phone}</span>
              <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold w-fit ${ROLE_STYLES[u.admin_role] || 'bg-gray-100 text-gray-600'}`}>
                {u.admin_role}
              </span>
              <span className="text-xs text-t3">{u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—'}</span>
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
