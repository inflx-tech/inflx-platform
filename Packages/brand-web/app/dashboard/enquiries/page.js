'use client';
import { useEffect, useState } from 'react';
import { brandApi } from '../../../lib/api';

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');

  async function load() {
    const res = await brandApi.getEnquiries();
    setLoading(false);
    if (res.success) setEnquiries(res.data?.enquiries || res.data || []);
  }

  useEffect(() => { load(); }, []);

  async function markConverted(id) {
    const dealValue = prompt('Enter deal value (₹):');
    if (!dealValue) return;
    const res = await brandApi.updateEnquiry(id, { status: 'converted', deal_value: parseInt(dealValue) * 100 });
    if (res.success) { showToast('Marked as converted!'); load(); setSelected(null); }
    else showToast(res.error?.message || 'Failed');
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  const statusColor = { new: 'bg-gold-pale text-yellow-700', contacted: 'bg-navy-pale text-navy', converted: 'bg-teal-pale text-teal-deep', closed: 'bg-surface2 text-t3' };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-display text-xl font-bold text-t1 mb-5">Enquiry Leads</h1>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_100px_120px_80px] gap-3 px-4 py-2.5 bg-surface2 border-b border-border text-[10px] font-bold uppercase tracking-wider text-t3">
          <div>Enquiry</div><div>Influencer</div><div>Date</div><div>Status</div><div>Action</div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-t3 text-sm">Loading...</div>
        ) : enquiries.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">💬</div>
            <div className="font-bold text-t1 mb-1">No enquiries yet</div>
            <div className="text-xs text-t3">Enquiries from followers will appear here</div>
          </div>
        ) : (
          enquiries.map(eq => (
            <div key={eq.id} className="grid grid-cols-[1fr_1fr_100px_120px_80px] gap-3 px-4 py-3 border-b border-border last:border-0 items-center text-sm hover:bg-surface2/50 cursor-pointer" onClick={() => setSelected(eq)}>
              <div>
                <div className="font-medium text-t1 text-xs truncate">{eq.form_data?.service_type || 'General enquiry'}</div>
                <div className="text-[10px] text-t3 truncate">{eq.form_data?.notes?.slice(0, 40) || '—'}</div>
              </div>
              <div className="text-xs text-t2 truncate">@{eq.influencer_handle || '—'}</div>
              <div className="text-[10px] text-t3">{eq.created_at ? new Date(eq.created_at).toLocaleDateString('en-IN') : '—'}</div>
              <div><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor[eq.status] || 'bg-surface2 text-t3'}`}>{eq.status}</span></div>
              <div><button onClick={e=>{e.stopPropagation();markConverted(eq.id);}} className="px-2 py-1 text-[10px] font-bold bg-teal-pale text-teal-deep rounded-lg hover:bg-teal hover:text-white transition-colors">Convert</button></div>
            </div>
          ))
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-96 max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base font-bold text-t1">Enquiry Detail</h3>
              <button onClick={() => setSelected(null)} className="text-t3 hover:text-t1">✕</button>
            </div>
            <div className="space-y-3">
              {Object.entries(selected.form_data || {}).map(([k, v]) => (
                <div key={k}>
                  <div className="text-[10px] font-bold text-t3 uppercase tracking-wider mb-1">{k.replace(/_/g,' ')}</div>
                  <div className="bg-surface2 rounded-lg px-3 py-2 text-xs text-t2">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
                </div>
              ))}
            </div>
            <button onClick={() => markConverted(selected.id)} className="w-full mt-4 py-2.5 bg-teal text-white font-bold text-sm rounded-xl">Mark as Converted</button>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-6 right-6 bg-t1 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50">{toast}</div>}
    </div>
  );
}
