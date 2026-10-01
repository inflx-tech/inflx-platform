'use client';
/**
 * Admin · Money · Money added (AM9) — every payment a brand made, and whether the wallet got it.
 * A payment the bank received but the wallet did not get can be credited here — ONCE, with a
 * reason. The server credits a payment one time only, however often it is asked; the button goes
 * once it is in the wallet.
 * Contract: features/item17-wallet · master rules v1.31 §17A
 */
import { useState } from 'react';
import { moneyApi } from '../../../../lib/api';
import { useLoad, useToast, inr, dayTime, Head, Tiles, Tile, Table, Chip, Btn, Modal, Field, GreyBox, LoadFailed, inputCls } from '../ui';

export default function MoneyAddedPage() {
  const { data, loading, error, reload } = useLoad(() => moneyApi.added());
  const { show, node: toast } = useToast();
  const [credit, setCredit] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  async function doCredit() {
    if (reason.trim().length < 5) { setFormError('Give a reason of at least 5 characters.'); return; }
    setBusy(true);
    const r = await moneyApi.creditTopup(credit.orderId, { reason: reason.trim() });
    setBusy(false);
    if (!r.success) { setFormError(r.error?.message || 'That did not work. Try again.'); return; }
    show(`${inr(credit.amount)} credited to ${credit.brandName}.`);
    setCredit(null); setReason(''); reload();
  }

  const t = data?.totals;
  const rows = (data?.rows || []).map((o) => ({ key: o.orderId, cells: [
    dayTime(o.at), <b key="b">{o.brandName}</b>, inr(o.amount),
    <span key="p" className="font-mono text-[11px]">{o.paymentId || o.orderId}</span>,
    o.credited ? <Chip key="c" tone="ok">Credited{o.creditedHow === 'admin' ? ' by INFLX' : ''}</Chip> : <Chip key="c" tone="ended">Not finished</Chip>,
    o.canCredit ? <Btn key="x" kind="sec" onClick={() => { setCredit(o); setReason(''); setFormError(''); }}>{data?.checksPayment ? 'Check and credit' : 'Credit this payment'}</Btn> : '',
  ] }));

  return (
    <div className="max-w-5xl">
      <Head title="Money added" sub="Payments brands made to add money to their wallet." />
      {t ? (
        <Tiles>
          <Tile label="Today" value={inr(t.today)} note={`${t.todayCount} payment${t.todayCount === 1 ? '' : 's'}`} />
          <Tile label="This month" value={inr(t.thisMonth)} note={`${t.thisMonthCount} payment${t.thisMonthCount === 1 ? '' : 's'}`} />
          <Tile label="Started, not finished · 7 days" value={String(t.notCredited)} note="most are simply abandoned" />
        </Tiles>
      ) : null}
      {error ? <LoadFailed onRetry={reload} what="the payments" /> : (
        <Table loading={loading} empty="No payments yet." heads={[['When'], ['Brand'], ['Amount', 1], ['Payment'], ['Wallet'], ['']]} rows={rows} />
      )}

      {credit && (
        <Modal title="Credit this payment" sub={`${credit.brandName} · ${inr(credit.amount)}`} onClose={() => setCredit(null)}>
          <GreyBox>
            Use this only when the brand paid and the wallet did not get it. A payment can be credited only once.{' '}
            {data?.checksPayment
              ? 'INFLX asks Razorpay whether this order was paid, and refuses if it was not.'
              : 'Payments are in test mode, so this cannot be checked: it credits the wallet on your word.'}
          </GreyBox>
          <Field label="Reason" required error={formError}>
            <textarea className={`${inputCls} resize-none`} rows={3} maxLength={500} value={reason} onChange={(e) => { setReason(e.target.value); setFormError(''); }} placeholder="e.g. Paid by UPI; the app closed before it finished." />
          </Field>
          <div className="flex gap-2 justify-end"><Btn kind="sec" small={false} onClick={() => setCredit(null)}>Back</Btn><Btn small={false} onClick={doCredit} disabled={busy}>{busy ? 'Crediting…' : `Credit ${inr(credit.amount)}`}</Btn></div>
        </Modal>
      )}
      {toast}
    </div>
  );
}
