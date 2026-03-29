'use client';
import { useEffect, useState } from 'react';
import { walletApi, brandApi, fmtMoney } from '../../../lib/api';

const TX_TYPE_LABELS = {
  topup:            { label: 'Top-up',          icon: '⬆️', color: 'text-teal' },
  escrow_lock:      { label: 'Escrow Lock',      icon: '🔒', color: 'text-navy' },
  escrow_release:   { label: 'Escrow Release',   icon: '🔓', color: 'text-teal' },
  payout:           { label: 'Payout',           icon: '💸', color: 'text-red' },
  refund:           { label: 'Refund',           icon: '↩️', color: 'text-teal' },
  platform_fee:     { label: 'Platform Fee',     icon: '📊', color: 'text-orange' },
};

export default function WalletPage() {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [topupAmount, setTopupAmount] = useState('');
  const [toppingUp, setToppingUp] = useState(false);
  const [toast, setToast] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);

  async function load() {
    const res = await walletApi.getBalance();
    setLoading(false);
    if (res.success) setWallet(res.data?.wallet || res.data);
  }

  useEffect(() => {
    load();
    loadTransactions();
  }, []);

  async function loadTransactions() {
    setTxLoading(true);
    const res = await walletApi.getTransactions({ limit: 20 });
    setTxLoading(false);
    if (res.success) setTransactions(res.data?.transactions || []);
  }

  async function handleTopup(e) {
    e.preventDefault();
    const amountPaise = Math.round(parseFloat(topupAmount) * 100);
    if (amountPaise < 100) { showToast('Minimum top-up is ₹1'); return; }
    setToppingUp(true);

    const orderRes = await walletApi.createTopup(amountPaise);
    if (!orderRes.success) { showToast(orderRes.error?.message || 'Failed to create order'); setToppingUp(false); return; }

    const { razorpay_order_id, amount, key_id } = orderRes.data;

    if (typeof window !== 'undefined' && window.Razorpay) {
      const options = {
        key: key_id || 'rzp_test_placeholder',
        amount,
        currency: 'INR',
        name: 'INFLX',
        description: 'Wallet Top-up',
        order_id: razorpay_order_id,
        handler: async function(response) {
          const verifyRes = await walletApi.verifyTopup({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          setToppingUp(false);
          if (verifyRes.success) { showToast('Top-up successful!'); setTopupAmount(''); load(); }
          else showToast('Payment verification failed');
        },
        prefill: { contact: '' },
        theme: { color: '#F47920' },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } else {
      // Dev mode: simulate successful topup
      showToast('Razorpay not loaded — in dev use API directly');
      setToppingUp(false);
    }
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  const balance = wallet?.wallet_balance || 0;
  const escrowLocked = wallet?.escrow_locked || 0;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Razorpay script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />

      <h1 className="font-display text-xl font-bold text-t1 mb-5">Wallet</h1>

      {/* Balance cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Available Balance', value: fmtMoney(balance), color: 'text-teal', bg: 'bg-teal-pale' },
          { label: 'Locked in Escrow', value: fmtMoney(escrowLocked), color: 'text-navy', bg: 'bg-navy-pale' },
          { label: 'Total Deposited', value: fmtMoney((wallet?.total_deposited) || 0), color: 'text-t1', bg: 'bg-surface2' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-xl p-4`}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1">{c.label}</div>
            <div className={`font-display text-xl font-extrabold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Low balance warning — balance is in paise; 10000 paise = ₹100 */}
      {balance < 1000000 && (
        <div className="mb-4 p-3 bg-red-pale border border-red/20 rounded-xl text-xs text-red font-medium">
          ⚠️ Low wallet balance. Top up to publish campaigns.
        </div>
      )}

      {/* Top-up form */}
      <div className="bg-white rounded-xl border border-border p-5 mb-5">
        <h2 className="font-display text-sm font-bold text-t1 mb-4">Top Up Wallet</h2>
        <form onSubmit={handleTopup} className="flex gap-3">
          <div className="flex-1">
            <div className="flex items-center border-2 border-border2 rounded-xl overflow-hidden focus-within:border-gold">
              <span className="px-3 py-3 bg-surface2 text-t2 font-semibold border-r border-border2">₹</span>
              <input type="number" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} placeholder="10000" min="1" className="flex-1 px-3 py-3 text-sm text-t1 outline-none" />
            </div>
          </div>
          <button type="submit" disabled={toppingUp || !topupAmount} className="px-6 py-3 bg-gradient-to-r from-red to-orange text-white font-bold text-sm rounded-xl disabled:opacity-50 whitespace-nowrap">
            {toppingUp ? 'Processing...' : 'Top Up'}
          </button>
        </form>
        <div className="flex gap-2 mt-3">
          {[5000, 10000, 25000, 50000].map(amt => (
            <button key={amt} onClick={() => setTopupAmount(String(amt))} className="flex-1 py-1.5 bg-surface2 text-t2 text-xs font-semibold rounded-lg hover:bg-navy-pale hover:text-navy transition-colors">₹{(amt/1).toLocaleString('en-IN')}</button>
          ))}
        </div>
      </div>

      {/* Transaction history */}
      <div className="bg-white rounded-xl border border-border overflow-hidden mb-5">
        <div className="px-5 py-3 border-b border-border bg-surface2 flex items-center justify-between">
          <h2 className="font-display text-sm font-bold text-t1">Transaction History</h2>
          <span className="text-xs text-t3">{transactions.length} transactions</span>
        </div>
        {txLoading ? (
          <div className="py-8 text-center text-xs text-t3">Loading…</div>
        ) : transactions.length === 0 ? (
          <div className="py-8 text-center text-xs text-t3">No transactions yet</div>
        ) : (
          <div>
            {transactions.map((tx, i) => {
              const cfg = TX_TYPE_LABELS[tx.type] || { label: tx.type, icon: '•', color: 'text-t1' };
              const isCredit = ['topup', 'escrow_release', 'refund'].includes(tx.type);
              return (
                <div key={tx.id || i} className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-surface2 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{cfg.icon}</span>
                    <div>
                      <div className="font-semibold text-sm text-t1">{cfg.label}</div>
                      {tx.description && <div className="text-xs text-t3 mt-0.5 truncate max-w-xs">{tx.description}</div>}
                      <div className="text-[10px] text-t3 mt-0.5">{tx.created_at ? new Date(tx.created_at).toLocaleString('en-IN') : ''}</div>
                    </div>
                  </div>
                  <div className={`font-bold text-sm ${isCredit ? 'text-teal' : 'text-red'}`}>
                    {isCredit ? '+' : '-'}{fmtMoney(Math.abs(tx.amount || 0))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && <div className="fixed bottom-6 right-6 bg-t1 text-white px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50">{toast}</div>}
    </div>
  );
}
