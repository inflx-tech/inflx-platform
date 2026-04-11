'use client';
import { useEffect, useState } from 'react';
import { walletApi, brandApi, fmtMoney } from '../../../lib/api';

const TX_TYPE_LABELS = {
  topup:            { label: 'Top-up',          icon: '\u2B06\uFE0F', color: 'text-teal' },
  escrow_lock:      { label: 'Escrow Lock',      icon: '\uD83D\uDD12', color: 'text-navy' },
  escrow_release:   { label: 'Escrow Release',   icon: '\uD83D\uDD13', color: 'text-teal' },
  payout:           { label: 'Payout',           icon: '\uD83D\uDCB8', color: 'text-red' },
  refund:           { label: 'Refund',           icon: '\u21A9\uFE0F', color: 'text-teal' },
  platform_fee:     { label: 'Platform Fee',     icon: '\uD83D\uDCCA', color: 'text-orange' },
};

const EMPTY_BANK = {
  account_holder_name: '',
  bank_name: '',
  account_number: '',
  ifsc_code: '',
  upi_id: '',
};

export default function WalletPage() {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [topupAmount, setTopupAmount] = useState('');
  const [toppingUp, setToppingUp] = useState(false);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState('success');
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);

  // Bank details state
  const [bankDetails, setBankDetails] = useState({ ...EMPTY_BANK });
  const [savingBank, setSavingBank] = useState(false);
  const [bankLoaded, setBankLoaded] = useState(false);

  async function load() {
    const res = await walletApi.getBalance();
    setLoading(false);
    if (res.success) setWallet(res.data?.wallet || res.data);
  }

  async function loadBrandData() {
    const res = await brandApi.getMe();
    if (res.success) {
      const b = res.data?.brand || res.data;
      const ld = b.listing_data || {};
      if (ld.bank_details) {
        setBankDetails({
          account_holder_name: ld.bank_details.account_holder_name || '',
          bank_name: ld.bank_details.bank_name || '',
          account_number: ld.bank_details.account_number || '',
          ifsc_code: ld.bank_details.ifsc_code || '',
          upi_id: ld.bank_details.upi_id || '',
        });
      }
      setBankLoaded(true);
      return b;
    }
    setBankLoaded(true);
    return null;
  }

  useEffect(() => {
    load();
    loadTransactions();
    loadBrandData();
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
    if (amountPaise < 100) { showToast('Minimum top-up is \u20B91'); return; }
    setToppingUp(true);

    const orderRes = await walletApi.createTopup(amountPaise);
    if (!orderRes.success) { showToast(orderRes.error?.message || 'Failed to create order', 'error'); setToppingUp(false); return; }

    const { order_id, amount, key_id } = orderRes.data;

    if (typeof window !== 'undefined' && window.Razorpay) {
      const options = {
        key: key_id || 'rzp_test_placeholder',
        amount,
        currency: 'INR',
        name: 'INFLX',
        description: 'Wallet Top-up',
        order_id: order_id,
        handler: async function(response) {
          const verifyRes = await walletApi.verifyTopup({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          setToppingUp(false);
          if (verifyRes.success) { showToast('Top-up successful!'); setTopupAmount(''); load(); }
          else showToast('Payment verification failed', 'error');
        },
        prefill: { contact: '' },
        theme: { color: '#F47920' },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } else {
      showToast('Razorpay not loaded \u2014 in dev use API directly', 'error');
      setToppingUp(false);
    }
  }

  function showToast(msg, type = 'success') {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 3000);
  }

  function handleBankChange(field, value) {
    setBankDetails(prev => ({ ...prev, [field]: value }));
  }

  function maskAccountNumber(num) {
    if (!num || num.length <= 4) return num;
    return '\u2022'.repeat(num.length - 4) + num.slice(-4);
  }

  async function handleSaveBank(e) {
    e.preventDefault();
    if (!bankDetails.account_holder_name.trim() || !bankDetails.account_number.trim() || !bankDetails.ifsc_code.trim()) {
      showToast('Account holder name, account number, and IFSC are required', 'error');
      return;
    }

    setSavingBank(true);

    // Fetch current listing_data to merge
    const brandRes = await brandApi.getMe();
    const currentBrand = brandRes.success ? (brandRes.data?.brand || brandRes.data) : null;
    const existingLd = currentBrand?.listing_data || {};

    const payload = {
      listing_data: {
        ...existingLd,
        bank_details: {
          account_holder_name: bankDetails.account_holder_name.trim(),
          bank_name: bankDetails.bank_name.trim(),
          account_number: bankDetails.account_number.trim(),
          ifsc_code: bankDetails.ifsc_code.trim().toUpperCase(),
          upi_id: bankDetails.upi_id.trim(),
        },
      },
    };

    const res = await brandApi.updateMe(payload);
    setSavingBank(false);

    if (res.success) {
      showToast('Bank details saved successfully');
    } else {
      showToast(res.error?.message || 'Failed to save bank details', 'error');
    }
  }

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
          Low wallet balance. Top up to publish campaigns.
        </div>
      )}

      {/* Top-up form */}
      <div className="bg-white rounded-xl border border-border p-5 mb-5">
        <h2 className="font-display text-sm font-bold text-t1 mb-4">Top Up Wallet</h2>
        <form onSubmit={handleTopup} className="flex gap-3">
          <div className="flex-1">
            <div className="flex items-center border-2 border-border2 rounded-xl overflow-hidden focus-within:border-gold">
              <span className="px-3 py-3 bg-surface2 text-t2 font-semibold border-r border-border2">{'\u20B9'}</span>
              <input type="number" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} placeholder="10000" min="1" className="flex-1 px-3 py-3 text-sm text-t1 outline-none" />
            </div>
          </div>
          <button type="submit" disabled={toppingUp || !topupAmount} className="px-6 py-3 bg-gradient-to-r from-red to-orange text-white font-bold text-sm rounded-xl disabled:opacity-50 whitespace-nowrap">
            {toppingUp ? 'Processing...' : 'Top Up'}
          </button>
        </form>
        <div className="flex gap-2 mt-3">
          {[5000, 10000, 25000, 50000].map(amt => (
            <button key={amt} onClick={() => setTopupAmount(String(amt))} className="flex-1 py-1.5 bg-surface2 text-t2 text-xs font-semibold rounded-lg hover:bg-navy-pale hover:text-navy transition-colors">{'\u20B9'}{(amt/1).toLocaleString('en-IN')}</button>
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
          <div className="py-8 text-center text-xs text-t3">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="py-8 text-center text-xs text-t3">No transactions yet</div>
        ) : (
          <div>
            {transactions.map((tx, i) => {
              const cfg = TX_TYPE_LABELS[tx.type] || { label: tx.type, icon: '\u2022', color: 'text-t1' };
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

      {/* Bank Account for Settlements */}
      <div className="bg-white rounded-xl border border-border p-5 mb-5">
        <h2 className="font-display text-sm font-bold text-t1 mb-1">Bank Account for Settlements</h2>
        <p className="text-xs text-t3 mb-4">Follower payments after commission deduction will be settled to this account.</p>

        {!bankLoaded ? (
          <div className="py-4 text-center text-xs text-t3">Loading bank details...</div>
        ) : (
          <form onSubmit={handleSaveBank} className="space-y-4">
            {/* Account holder name */}
            <div>
              <label className="block text-xs font-semibold text-t2 mb-1">Account Holder Name <span className="text-red">*</span></label>
              <input
                type="text"
                value={bankDetails.account_holder_name}
                onChange={e => handleBankChange('account_holder_name', e.target.value)}
                className="w-full border-2 border-border2 rounded-xl px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold transition-colors"
                placeholder="Name as on bank account"
              />
            </div>

            {/* Bank name */}
            <div>
              <label className="block text-xs font-semibold text-t2 mb-1">Bank Name</label>
              <input
                type="text"
                value={bankDetails.bank_name}
                onChange={e => handleBankChange('bank_name', e.target.value)}
                className="w-full border-2 border-border2 rounded-xl px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold transition-colors"
                placeholder="e.g. State Bank of India"
              />
            </div>

            {/* Account number + IFSC */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-t2 mb-1">Account Number <span className="text-red">*</span></label>
                <input
                  type="text"
                  value={bankDetails.account_number}
                  onChange={e => handleBankChange('account_number', e.target.value.replace(/\D/g, ''))}
                  className="w-full border-2 border-border2 rounded-xl px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold transition-colors font-mono"
                  placeholder="1234567890"
                />
                {bankDetails.account_number.length > 4 && (
                  <p className="text-[10px] text-t3 mt-0.5 font-mono">Display: {maskAccountNumber(bankDetails.account_number)}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-t2 mb-1">IFSC Code <span className="text-red">*</span></label>
                <input
                  type="text"
                  value={bankDetails.ifsc_code}
                  onChange={e => handleBankChange('ifsc_code', e.target.value.toUpperCase())}
                  maxLength={11}
                  className="w-full border-2 border-border2 rounded-xl px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold transition-colors font-mono"
                  placeholder="SBIN0001234"
                />
              </div>
            </div>

            {/* UPI ID */}
            <div>
              <label className="block text-xs font-semibold text-t2 mb-1">UPI ID</label>
              <input
                type="text"
                value={bankDetails.upi_id}
                onChange={e => handleBankChange('upi_id', e.target.value)}
                className="w-full border-2 border-border2 rounded-xl px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold transition-colors"
                placeholder="yourname@upi"
              />
              <p className="text-[10px] text-t3 mt-0.5">Optional. Enables faster settlements via UPI.</p>
            </div>

            {/* Save button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingBank}
                className="px-6 py-2.5 bg-gradient-to-r from-red to-orange text-white font-bold text-sm rounded-xl disabled:opacity-50 transition-opacity"
              >
                {savingBank ? 'Saving...' : 'Save Bank Details'}
              </button>
            </div>
          </form>
        )}
      </div>

      {toast && <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50 ${toastType === 'error' ? 'bg-red text-white' : 'bg-t1 text-white'}`}>{toast}</div>}
    </div>
  );
}
