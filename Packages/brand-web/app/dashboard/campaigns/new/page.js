'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { campaignApi, walletApi, fmtMoney } from '../../../../lib/api';

const GOALS = ['engagement', 'conversion', 'hybrid'];
const MODES = ['handpick', 'open_group'];
const OFFER_TYPES = ['flat', 'percentage', 'bogo', 'bundle', 'volume', 'prebook'];
const AVAILING_MODES = ['pay_at_store', 'prebook', 'online_order', 'enquiry'];

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [campaignId, setCampaignId] = useState(null);

  // Step 1: Basic info
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState('');
  const [description, setDescription] = useState('');

  // Step 2: Sets
  const [sets, setSets] = useState([{ name: '', goal: 'engagement', assignment_mode: 'handpick', budget_split: 100 }]);
  const [setIds, setSetIds] = useState([]);

  // Step 3: Offers (per set)
  const [offers, setOffers] = useState([{ offer_type: 'flat', discount_value: '', availing_modes: ['pay_at_store'], title: '', description: '' }]);

  async function handleStep1(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const res = await campaignApi.create({
      name,
      start_date: startDate,
      end_date: endDate,
      total_budget: Math.round(parseFloat(budget) * 100), // rupees → paise
      description,
    });
    setSaving(false);
    if (!res.success) { setError(res.error?.message || 'Failed to create campaign'); return; }
    setCampaignId(res.data?.campaign?.id || res.data?.id);
    setStep(2);
  }

  async function handleStep2(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const ids = [];
    for (const set of sets) {
      const res = await campaignApi.createSet(campaignId, set);
      if (!res.success) { setError(`Failed to create set "${set.name}"`); setSaving(false); return; }
      ids.push(res.data?.set?.id || res.data?.id);
    }
    setSetIds(ids);
    setSaving(false);
    setStep(3);
  }

  async function handleStep3(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    for (let i = 0; i < offers.length; i++) {
      const sid = setIds[0]; // attach first offer to first set
      const offer = offers[i];
      const res = await campaignApi.createOffer(campaignId, sid, {
        ...offer,
        discount_value: parseInt(offer.discount_value) || 0,
      });
      if (!res.success) { setError(res.error?.message || 'Failed to create offer'); setSaving(false); return; }
    }
    setSaving(false);
    setStep(4);
  }

  async function handlePublish() {
    setSaving(true);
    // Check wallet first
    const walletRes = await walletApi.getBalance();
    const walletBal = walletRes.data?.wallet_balance || 0;
    const budgetPaise = Math.round(parseFloat(budget) * 100);
    if (walletBal < budgetPaise) {
      setError(`Insufficient wallet balance. You need ${fmtMoney(budgetPaise)} but have ${fmtMoney(walletBal)}. Please top up your wallet first.`);
      setSaving(false);
      return;
    }
    const res = await campaignApi.publish(campaignId);
    setSaving(false);
    if (res.success) router.push(`/dashboard/campaigns/${campaignId}`);
    else setError(res.error?.message || 'Failed to publish');
  }

  const stepLabels = ['Basic Info', 'Create Sets', 'Add Offers', 'Review & Publish'];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-5 text-xs">
        <a href="/dashboard/campaigns" className="text-t3 hover:text-t2">← Campaigns</a>
        <span className="text-t3">/</span>
        <span className="text-t2 font-medium">New Campaign</span>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-2 mb-6">
        {stepLabels.map((label, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${step > i + 1 ? 'bg-teal text-white' : step === i + 1 ? 'bg-navy text-white' : 'bg-surface2 text-t3'}`}>
              {step > i + 1 ? '✓' : i + 1}
            </div>
            <span className={`text-[10px] font-semibold ${step === i + 1 ? 'text-t1' : 'text-t3'}`}>{label}</span>
            {i < 3 && <div className={`flex-1 h-0.5 ${step > i + 1 ? 'bg-teal' : 'bg-border'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-border p-6">
        {/* Step 1 */}
        {step === 1 && (
          <form onSubmit={handleStep1}>
            <h2 className="font-display text-base font-bold text-t1 mb-4">Campaign Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1.5">Campaign Name</label>
                <input value={name} onChange={e=>setName(e.target.value)} required className="w-full border-2 border-border2 rounded-xl px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold" placeholder="e.g. Summer Monsoon Campaign 2026" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1.5">Start Date</label>
                  <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} required className="w-full border-2 border-border2 rounded-xl px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1.5">End Date</label>
                  <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} required className="w-full border-2 border-border2 rounded-xl px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1.5">Total Budget (₹)</label>
                <input type="number" value={budget} onChange={e=>setBudget(e.target.value)} min="1000" required className="w-full border-2 border-border2 rounded-xl px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold" placeholder="50000" />
                <div className="text-[10px] text-t3 mt-1">Full budget must be in your wallet before publishing</div>
              </div>
              <div>
                <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1.5">Description</label>
                <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} className="w-full border-2 border-border2 rounded-xl px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold resize-none" placeholder="Brief about the campaign goals..." />
              </div>
            </div>
            {error && <div className="mt-3 p-3 bg-red-pale rounded-xl text-xs text-red">{error}</div>}
            <button type="submit" disabled={saving} className="w-full mt-4 py-3 bg-gradient-to-r from-red to-orange text-white font-bold rounded-xl disabled:opacity-50">
              {saving ? 'Saving...' : 'Next: Create Sets →'}
            </button>
          </form>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <form onSubmit={handleStep2}>
            <h2 className="font-display text-base font-bold text-t1 mb-4">Campaign Sets</h2>
            {sets.map((set, i) => (
              <div key={i} className="border border-border rounded-xl p-4 mb-3">
                <div className="text-xs font-bold text-t3 uppercase tracking-wider mb-3">Set {i + 1}</div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1">Set Name</label>
                    <input value={set.name} onChange={e=>{const n=[...sets];n[i]={...n[i],name:e.target.value};setSets(n);}} required className="w-full border-2 border-border2 rounded-lg px-3 py-2 text-sm text-t1 outline-none focus:border-gold" placeholder="e.g. Instagram Reels Group" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1">Goal</label>
                      <select value={set.goal} onChange={e=>{const n=[...sets];n[i]={...n[i],goal:e.target.value};setSets(n);}} className="w-full border-2 border-border2 rounded-lg px-3 py-2 text-sm text-t1 outline-none focus:border-gold">
                        {GOALS.map(g => <option key={g}>{g}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1">Assignment</label>
                      <select value={set.assignment_mode} onChange={e=>{const n=[...sets];n[i]={...n[i],assignment_mode:e.target.value};setSets(n);}} className="w-full border-2 border-border2 rounded-lg px-3 py-2 text-sm text-t1 outline-none focus:border-gold">
                        {MODES.map(m => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button type="button" onClick={()=>setSets([...sets,{name:'',goal:'engagement',assignment_mode:'handpick',budget_split:0}])} className="w-full py-2 border-2 border-dashed border-border2 rounded-xl text-xs font-semibold text-t3 hover:border-navy hover:text-navy transition-colors mb-3">
              + Add Another Set
            </button>
            {error && <div className="mt-3 p-3 bg-red-pale rounded-xl text-xs text-red">{error}</div>}
            <button type="submit" disabled={saving} className="w-full py-3 bg-gradient-to-r from-red to-orange text-white font-bold rounded-xl disabled:opacity-50">
              {saving ? 'Saving...' : 'Next: Add Offers →'}
            </button>
          </form>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <form onSubmit={handleStep3}>
            <h2 className="font-display text-base font-bold text-t1 mb-4">Offers</h2>
            {offers.map((offer, i) => (
              <div key={i} className="border border-border rounded-xl p-4 mb-3">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1">Offer Title</label>
                    <input value={offer.title} onChange={e=>{const o=[...offers];o[i]={...o[i],title:e.target.value};setOffers(o);}} required className="w-full border-2 border-border2 rounded-lg px-3 py-2 text-sm text-t1 outline-none focus:border-gold" placeholder="e.g. 20% off on all items" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1">Type</label>
                      <select value={offer.offer_type} onChange={e=>{const o=[...offers];o[i]={...o[i],offer_type:e.target.value};setOffers(o);}} className="w-full border-2 border-border2 rounded-lg px-3 py-2 text-sm text-t1 outline-none">
                        {OFFER_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1">Discount Value</label>
                      <input type="number" value={offer.discount_value} onChange={e=>{const o=[...offers];o[i]={...o[i],discount_value:e.target.value};setOffers(o);}} className="w-full border-2 border-border2 rounded-lg px-3 py-2 text-sm text-t1 outline-none focus:border-gold" placeholder="20" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1">Availing Modes</label>
                    <div className="flex flex-wrap gap-2">
                      {AVAILING_MODES.map(m => (
                        <button key={m} type="button"
                          onClick={() => {
                            const o = [...offers];
                            const modes = o[i].availing_modes.includes(m) ? o[i].availing_modes.filter(x=>x!==m) : [...o[i].availing_modes, m];
                            o[i] = {...o[i], availing_modes: modes};
                            setOffers(o);
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${offer.availing_modes.includes(m) ? 'bg-navy text-white border-navy' : 'bg-white text-t2 border-border2 hover:border-navy'}`}>
                          {m.replace(/_/g,' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {error && <div className="mt-3 p-3 bg-red-pale rounded-xl text-xs text-red">{error}</div>}
            <button type="submit" disabled={saving} className="w-full py-3 bg-gradient-to-r from-red to-orange text-white font-bold rounded-xl disabled:opacity-50">
              {saving ? 'Saving...' : 'Next: Review →'}
            </button>
          </form>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div>
            <h2 className="font-display text-base font-bold text-t1 mb-4">Review & Publish</h2>
            <div className="space-y-3 mb-5">
              <div className="bg-surface2 rounded-xl p-4">
                <div className="text-xs font-bold text-t3 uppercase tracking-wider mb-2">Campaign</div>
                <div className="font-semibold text-t1">{name}</div>
                <div className="text-xs text-t3">{startDate} – {endDate} · Budget: {fmtMoney(Math.round(parseFloat(budget||0) * 100))}</div>
              </div>
              <div className="bg-surface2 rounded-xl p-4">
                <div className="text-xs font-bold text-t3 uppercase tracking-wider mb-2">{sets.length} Set{sets.length!==1?'s':''}</div>
                {sets.map((s,i) => <div key={i} className="text-xs text-t2">{s.name} · {s.goal} · {s.assignment_mode}</div>)}
              </div>
              <div className="bg-surface2 rounded-xl p-4">
                <div className="text-xs font-bold text-t3 uppercase tracking-wider mb-2">{offers.length} Offer{offers.length!==1?'s':''}</div>
                {offers.map((o,i) => <div key={i} className="text-xs text-t2">{o.title} · {o.offer_type}</div>)}
              </div>
            </div>
            <div className="bg-gold-pale border border-gold/20 rounded-xl p-3 mb-4 text-xs text-yellow-700">
              ⚠️ Publishing will lock the full budget ({fmtMoney(Math.round(parseFloat(budget||0)*100))}) in escrow. Make sure your wallet has sufficient funds.
            </div>
            {error && <div className="mb-3 p-3 bg-red-pale rounded-xl text-xs text-red">{error}</div>}
            <button onClick={handlePublish} disabled={saving} className="w-full py-3 bg-gradient-to-r from-red to-orange text-white font-bold rounded-xl disabled:opacity-50">
              {saving ? 'Publishing...' : '🚀 Publish Campaign'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
