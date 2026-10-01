'use client';
/**
 * Admin · Money · Withdrawals (AM2, AM3, AM4) — one queue for brands and creators.
 * Contract: features/item17-wallet · master rules v1.31 §17A
 *
 * There is no approve or reject. INFLX checks the request, PAYS IT FROM INFLX'S BANK, then comes
 * back and marks it processed with the bank reference — that is the moment the person's money has
 * left INFLX. If it can't be paid, "Could not process" with a reason frees the money; the reason
 * is what the person reads. The full account is shown only inside "Mark processed", to pay from.
 */
import { useState } from 'react';
import { moneyApi } from '../../../../lib/api';
import { useLoad, useToast, inr, dayMon, dayTime, waited, Head, Tabs, Table, Chip, Who, Btn, Modal, Field, GreyBox, Copy, LoadFailed, TestModeBanner, inputCls } from '../ui';

const REASONS = [
  ['not_active', "The UPI ID or account isn't active", "That UPI ID or account isn't active. Update it and request again."],
  ['name_mismatch', "The name doesn't match the account", "The account number didn't match the name. Check your bank details and request again."],
  ['other', 'Something else', ''],
];
const today = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);

export default function MoneyWithdrawalsPage() {
  const [tab, setTab] = useState('requested');
  const { data, loading, error, reload } = useLoad(() => moneyApi.withdrawals(tab), [tab]);
  const { show, node: toast } = useToast();

  const [pay, setPay] = useState(null);          // the request being marked processed, with its full account
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(today());
  const [stop, setStop] = useState(null);        // the request that could not be processed
  const [kind, setKind] = useState(REASONS[0][0]);
  const [told, setTold] = useState(REASONS[0][2]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  async function openPay(w) {
    setFormError(''); setReference(''); setPaidOn(today());
    const r = await moneyApi.withdrawal(w.id);          // the full account, to pay from
    if (!r.success) { show(r.error?.message || 'Could not open that request.', true); return; }
    setPay(r.data);
  }
  function openStop(w) {
    setFormError(''); setKind(REASONS[0][0]); setTold(REASONS[0][2]); setStop(w);
  }

  async function doProcessed() {
    if (!reference.trim()) { setFormError('Enter the bank reference.'); return; }
    setBusy(true);
    const r = await moneyApi.markProcessed(pay.id, { reference: reference.trim(), paidOn });
    setBusy(false);
    if (!r.success) { setFormError(r.error?.message || 'That did not save. Try again.'); return; }
    show(`${inr(pay.amount)} to ${pay.ownerName} marked processed.`);
    setPay(null); reload();
  }
  async function doStop() {
    if (!told.trim()) { setFormError('Say why it could not be processed.'); return; }
    setBusy(true);
    const r = await moneyApi.couldNotProcess(stop.id, { reason: told.trim(), reasonKind: kind });
    setBusy(false);
    if (!r.success) { setFormError(r.error?.message || 'That did not save. Try again.'); return; }
    show(`${stop.ownerName}'s ${inr(stop.amount)} is back in Available.`);
    setStop(null); reload();
  }

  const c = data?.counts || {};
  const n = (k) => (c[k]?.n ? ` · ${c[k].n}` : '');
  const rows = (data?.rows || []).map((w) => ({
    key: w.id,
    cells: [
      <Who key="w" name={w.ownerName} kind={w.ownerKind === 'brand' ? 'Brand' : 'Creator'} />,
      <b key="a">{inr(w.amount)}</b>,
      <div key="r">{dayTime(w.requestedAt)}{w.status === 'requested' ? <div className={`text-[10.5px] ${w.late ? 'text-orange-deep font-bold' : 'text-t3'}`}>{waited(w.waitingMinutes)}</div> : null}</div>,
      <div key="s">{w.method === 'upi' ? `UPI · ${w.sendTo}` : w.sendTo}<div className="text-[10.5px] text-t3">{w.payeeName}</div></div>,
      ...(tab === 'requested' ? [
        <Chip key="h" tone={w.holdCovers ? 'ok' : 'no'}>{w.holdCovers ? `Yes · ${inr(w.amount)}` : `No · ${inr(w.onHold)} on hold`}</Chip>,
        <div key="x" className="flex gap-1.5 justify-end"><Btn onClick={() => openPay(w)} disabled={!w.holdCovers}>Mark processed</Btn><Btn kind="sec" onClick={() => openStop(w)}>Could not process</Btn></div>,
      ] : tab === 'processed' ? [
        <div key="p">Paid {dayMon(w.paidOn || w.processedAt)}<div className="text-[10.5px] text-t3">Reference {w.reference}</div></div>,
      ] : [
        <div key="p" className="max-w-xs">{w.reason}<div className="text-[10.5px] text-t3">{dayTime(w.processedAt)}</div></div>,
      ]),
    ],
  }));
  const heads = [['Who'], ['Amount', 1], ['Requested'], ['Send to'],
    ...(tab === 'requested' ? [['On hold'], ['']] : tab === 'processed' ? [['Paid']] : [['What they were told']])];

  return (
    <div className="max-w-6xl">
      <Head title="Withdrawals" sub="Requests are paid from INFLX's bank, then marked here." />
      <TestModeBanner show={data?.testMode} />
      <Tabs value={tab} onChange={setTab} options={[['requested', `Waiting${n('requested')}`], ['processed', 'Processed'], ['could_not_process', 'Could not process']]} />
      {error ? <LoadFailed onRetry={reload} what="the withdrawals" />
        : <Table heads={heads} rows={rows} loading={loading} empty={tab === 'requested' ? 'No withdrawals are waiting.' : 'None yet.'} />}

      {pay && (
        <Modal title="Mark processed" sub="Pay it from INFLX's bank first. Then record it here." onClose={() => setPay(null)}>
          <TestModeBanner show={pay.testMode} />
          <div className="bg-surface2 rounded-lg p-3 mb-3 grid gap-1.5 text-xs" style={{ gridTemplateColumns: 'auto 1fr' }}>
            <span className="text-t3">Pay</span><b className="text-right">{inr(pay.amount)}</b>
            <span className="text-t3">To</span><b className="text-right">{pay.payeeName}</b>
            {pay.method === 'bank' ? (
              <>
                <span className="text-t3">Account</span><b className="text-right">{pay.account}<Copy value={pay.account} /></b>
                <span className="text-t3">IFSC</span><b className="text-right">{pay.ifsc}<Copy value={pay.ifsc} /></b>
              </>
            ) : (
              <><span className="text-t3">UPI ID</span><b className="text-right">{pay.upi}<Copy value={pay.upi} /></b></>
            )}
          </div>
          <Field label="Bank reference" required><input className={inputCls} value={reference} onChange={(e) => { setReference(e.target.value); setFormError(''); }} placeholder="e.g. N27510284611" maxLength={80} /></Field>
          <Field label="Paid on"><input type="date" className={inputCls} value={paidOn} max={today()} onChange={(e) => setPaidOn(e.target.value)} /></Field>
          {formError ? <div className="text-[11px] text-red font-semibold mb-2">{formError}</div> : null}
          <GreyBox>Marking this takes {inr(pay.amount)} off {pay.ownerName}&apos;s hold and tells them it is paid. It can&apos;t be undone here.</GreyBox>
          <div className="flex gap-2 justify-end"><Btn kind="sec" small={false} onClick={() => setPay(null)}>Back</Btn><Btn small={false} onClick={doProcessed} disabled={busy}>{busy ? 'Saving…' : 'Mark processed'}</Btn></div>
        </Modal>
      )}

      {stop && (
        <Modal title="Could not process" sub={`${stop.ownerName} · ${inr(stop.amount)} · ${stop.method === 'upi' ? `UPI ${stop.sendTo}` : stop.sendTo}`} onClose={() => setStop(null)}>
          <div className="grid gap-1.5 mb-3">
            {REASONS.map(([k, l, text]) => (
              <label key={k} className={`flex items-center gap-2.5 border rounded-lg px-3 py-2 text-xs font-bold cursor-pointer ${kind === k ? 'border-t1' : 'border-border'}`}>
                <input type="radio" name="why" checked={kind === k} onChange={() => { setKind(k); setTold(text); setFormError(''); }} />{l}
              </label>
            ))}
          </div>
          <Field label="What they are told" required>
            <textarea className={`${inputCls} resize-none`} rows={3} maxLength={500} value={told} onChange={(e) => { setTold(e.target.value); setFormError(''); }} placeholder="In plain words: what was wrong, and what to do next." />
          </Field>
          {formError ? <div className="text-[11px] text-red font-semibold mb-2">{formError}</div> : null}
          <GreyBox>Their {inr(stop.amount)} goes back to Available and they are told why. Nothing was paid.</GreyBox>
          <div className="flex gap-2 justify-end"><Btn kind="sec" small={false} onClick={() => setStop(null)}>Back</Btn><Btn kind="dan" small={false} onClick={doStop} disabled={busy}>{busy ? 'Saving…' : 'Could not process'}</Btn></div>
        </Modal>
      )}
      {toast}
    </div>
  );
}
