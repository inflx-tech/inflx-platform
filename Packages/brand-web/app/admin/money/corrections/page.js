'use client';
/**
 * Admin · Money · Disputes and corrections (AM11) — the three things done by hand.
 * Contract: features/item17-wallet · master rules v1.31 §17A
 *
 * Not part of the daily work. After both have signed nothing is cancelled; if one side stops,
 * INFLX settles it, and these are the tools:
 *   · release a locked payment   → into the CREATOR's wallet (she posted, the brand never confirmed)
 *   · return locked money        → into the BRAND's wallet (she took the first payment and stopped)
 *   · correct a balance          → add to or take from one wallet, to fix a mistake
 * Each needs a written reason, is recorded with who did it, and only ever moves money INTO OR OUT
 * OF A WALLET — never to a bank. The person still withdraws by request.
 */
import { useEffect, useState } from 'react';
import { moneyApi } from '../../../../lib/api';
import { useLoad, useToast, inr, dayMon, Head, Tile, Table, Btn, Modal, Field, GreyBox, LoadFailed, inputCls } from '../ui';

const PAY = { 1: 'first 25%', 2: 'second 25%', 3: 'final 50%' };
const KIND_WORD = { release_payment: 'Released a locked payment', return_locked: 'Returned locked money', correct_balance: 'Corrected a balance', credit_topup: 'Credited a payment that was not credited' };

/** Choose one collaboration that still has money locked. */
function PickCollab({ value, onChange }) {
  const [list, setList] = useState(null);
  useEffect(() => { moneyApi.collaborations('locked').then((r) => setList(r.success ? r.data.rows : [])); }, []);
  return (
    <Field label="Collaboration" required>
      <select className={inputCls} value={value?.ciId || ''} onChange={(e) => onChange((list || []).find((c) => c.ciId === e.target.value) || null)}>
        <option value="">{list == null ? 'Loading…' : list.length ? 'Choose a collaboration' : 'Nothing is locked'}</option>
        {(list || []).map((c) => <option key={c.ciId} value={c.ciId}>{c.brandName} → {c.creatorName} · {c.campaignName} · {inr(c.locked)} locked</option>)}
      </select>
    </Field>
  );
}

/** Choose one brand or creator by name. */
function PickPerson({ kind, value, onChange }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  useEffect(() => {
    if (q.trim().length < 2) { setList([]); return undefined; }
    const t = setTimeout(() => moneyApi.balances(kind === 'brand' ? 'brands' : 'creators', q.trim()).then((r) => setList(r.success ? r.data.rows.slice(0, 8) : [])), 300);
    return () => clearTimeout(t);
  }, [q, kind]);
  if (value) {
    return (
      <Field label={kind === 'brand' ? 'Brand' : 'Creator'} required>
        <div className="flex items-center justify-between border border-border rounded-lg px-3 py-2 text-sm"><span><b>{value.name}</b> · {inr(value.available)} available</span><button className="text-[11px] underline font-bold" onClick={() => onChange(null)}>Change</button></div>
      </Field>
    );
  }
  return (
    <Field label={kind === 'brand' ? 'Brand' : 'Creator'} required>
      <input className={inputCls} placeholder="Type a name" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length ? (
        <div className="border border-border rounded-lg mt-1 overflow-hidden">
          {list.map((x) => <button key={x.id} className="block w-full text-left px-3 py-2 text-xs hover:bg-surface2 border-b border-border last:border-0" onClick={() => { onChange(x); setQ(''); }}><b>{x.name}</b> · {inr(x.available)} available</button>)}
        </div>
      ) : null}
    </Field>
  );
}

export default function MoneyCorrectionsPage() {
  const { data, loading, error, reload } = useLoad(() => moneyApi.corrections());
  const { show, node: toast } = useToast();
  const [tool, setTool] = useState(null);                 // 'release' | 'return' | 'correct'
  const [collab, setCollab] = useState(null);
  const [kind, setKind] = useState('brand');
  const [person, setPerson] = useState(null);
  const [direction, setDirection] = useState('credit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [pickKey, setPickKey] = useState(0);     // remounts the collaboration picker so it reloads its list

  function open(t) { setTool(t); setCollab(null); setPerson(null); setKind('brand'); setDirection('credit'); setAmount(''); setReason(''); setFormError(''); }

  async function go() {
    if (reason.trim().length < 5) { setFormError('Give a reason of at least 5 characters.'); return; }
    let r;
    setFormError('');
    if (tool === 'correct') {
      const amt = parseFloat(amount);
      if (!person) { setFormError('Choose who.'); return; }
      if (!amt || amt <= 0) { setFormError('Enter an amount.'); return; }
      setBusy(true);
      r = await moneyApi.correctBalance({ kind, id: person.id, amount: amt, direction, reason: reason.trim() });
    } else {
      if (!collab) { setFormError('Choose a collaboration.'); return; }
      setBusy(true);
      // The server is told which payment (or how much) this screen showed. If that has changed —
      // a second click, another admin, the brand confirming meanwhile — nothing moves.
      r = tool === 'release'
        ? await moneyApi.releasePayment({ ciId: collab.ciId, tranche: collab.next?.n, standIn: collab.next?.n === 2 ? !!(collab.postedAt && !collab.reported) : undefined, reason: reason.trim() })
        : await moneyApi.returnLocked({ ciId: collab.ciId, expected: collab.locked, reason: reason.trim() });
    }
    setBusy(false);
    if (!r.success) {
      setFormError(r.error?.message || 'That did not work. Try again.');
      if (r.error?.code === 'PAYMENT_CHANGED' || r.error?.code === 'NOTHING_LOCKED') { setCollab(null); setPickKey((k) => k + 1); reload(); }
      return;
    }
    show(tool === 'release' ? `${inr(r.data.released)} released to ${r.data.to}'s wallet.${r.data.stoodIn ? ' Her content is confirmed live; the final 50% is paid on its date.' : r.data.tranche === 2 ? ' The final 50% stays locked.' : ''}`
      : tool === 'return' ? `${inr(r.data.returned)} returned to ${collab.brandName}'s wallet.`
        : `${person.name}'s Available is now ${inr(r.data.available)}.`);
    setTool(null); reload();
  }

  const rows = (data?.rows || []).map((x) => ({ key: x.id, cells: [
    dayMon(x.at),
    <div key="w"><b>{KIND_WORD[x.kind] || x.kind}</b><div className="text-[10.5px] text-t3">{[x.creatorName, x.brandName].filter(Boolean).join(' · ')}</div></div>,
    `${x.kind === 'correct_balance' ? (x.direction === 'credit' ? '+ ' : '− ') : ''}${inr(x.amount)}`,
    <div key="r" className="max-w-sm">{x.reason}</div>, x.by,
  ] }));

  const nextPay = collab && collab.next ? `${PAY[collab.next.n]} · ${inr(collab.next.amount)}` : null;

  return (
    <div className="max-w-5xl">
      <Head title="Disputes and corrections" sub="Used when INFLX settles a dispute or fixes a mistake. Money only ever moves into or out of a wallet here — never to a bank." />
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <Tile label="Release a locked payment" note="To the creator's wallet — for example, she posted and the brand never confirmed."><div className="mt-2"><Btn kind="sec" onClick={() => open('release')}>Choose a collaboration</Btn></div></Tile>
        <Tile label="Return locked money" note="To the brand's wallet — for example, the creator took the first payment and stopped."><div className="mt-2"><Btn kind="sec" onClick={() => open('return')}>Choose a collaboration</Btn></div></Tile>
        <Tile label="Correct a balance" note="Add to or take from one wallet, to fix a mistake."><div className="mt-2"><Btn kind="sec" onClick={() => open('correct')}>Choose a person</Btn></div></Tile>
      </div>

      <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-2">Done so far</div>
      {error ? <LoadFailed onRetry={reload} what="the list" /> : (
        <Table loading={loading} empty="Nothing has been done by hand." heads={[['When'], ['What'], ['Amount', 1], ['Reason'], ['By']]} rows={rows} />
      )}

      {tool === 'release' && (
        <Modal title="Release a locked payment" sub="The next locked payment of one collaboration goes into the creator's wallet." onClose={() => setTool(null)}>
          <PickCollab key={pickKey} value={collab} onChange={setCollab} />
          {collab ? <GreyBox>This releases the <b>{nextPay}</b> to <b>{collab.creatorName}</b>&apos;s wallet. {collab.brandName}&apos;s Available does not change — the money was already locked. {collab.next?.n === 2 ? (collab.postedAt && !collab.reported
              ? 'She has posted and the brand has not answered, so this counts as the confirmation that her content is live: the final 50% then gets its date and is paid by itself. '
              : `${collab.reported ? 'The brand reported this collaboration' : 'She has not posted yet'}, so this is the payment only: the final 50% stays locked until you release or return it here. `) : ''}It can&apos;t be undone here.</GreyBox> : null}
          <Field label="Reason" required><textarea className={`${inputCls} resize-none`} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. She posted on 15 Sep; the brand did not answer for 13 days and agreed by phone." /></Field>
          {formError ? <div className="text-[11px] text-red font-semibold mb-2">{formError}</div> : null}
          <div className="flex gap-2 justify-end"><Btn kind="sec" small={false} onClick={() => setTool(null)}>Back</Btn><Btn small={false} onClick={go} disabled={busy || !collab}>{busy ? 'Releasing…' : 'Release the payment'}</Btn></div>
        </Modal>
      )}

      {tool === 'return' && (
        <Modal title="Return locked money" sub="Everything still locked for one collaboration goes back to the brand's wallet." onClose={() => setTool(null)}>
          <PickCollab key={pickKey} value={collab} onChange={setCollab} />
          {collab ? <GreyBox>This returns <b>{inr(collab.locked)}</b> to <b>{collab.brandName}</b>&apos;s wallet. What {collab.creatorName} has already been paid ({inr(collab.paid)}) stays hers, and the INFLX campaign fee is not returned. The locked payments can never be released afterwards.</GreyBox> : null}
          <Field label="Reason" required><textarea className={`${inputCls} resize-none`} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. She took the first payment and has not answered for three weeks." /></Field>
          {formError ? <div className="text-[11px] text-red font-semibold mb-2">{formError}</div> : null}
          <div className="flex gap-2 justify-end"><Btn kind="sec" small={false} onClick={() => setTool(null)}>Back</Btn><Btn kind="dan" small={false} onClick={go} disabled={busy || !collab}>{busy ? 'Returning…' : 'Return the locked money'}</Btn></div>
        </Modal>
      )}

      {tool === 'correct' && (
        <Modal title="Correct a balance" sub="Add to or take from one wallet's Available, to fix a mistake." onClose={() => setTool(null)}>
          <div className="flex gap-1.5 mb-3">
            {[['brand', 'A brand'], ['creator', 'A creator']].map(([k, l]) => <Btn key={k} kind={kind === k ? 'pri' : 'sec'} onClick={() => { setKind(k); setPerson(null); }}>{l}</Btn>)}
          </div>
          <PickPerson kind={kind} value={person} onChange={setPerson} />
          <div className="flex gap-2">
            <div className="flex gap-1.5 mt-6">
              {[['credit', 'Add'], ['debit', 'Take']].map(([k, l]) => <Btn key={k} kind={direction === k ? 'pri' : 'sec'} onClick={() => setDirection(k)}>{l}</Btn>)}
            </div>
            <div className="flex-1"><Field label="Amount (₹)" required><input type="number" min="1" max="10000000" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field></div>
          </div>
          <Field label="Reason" required><textarea className={`${inputCls} resize-none`} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Courier charged twice for one parcel." /></Field>
          {formError ? <div className="text-[11px] text-red font-semibold mb-2">{formError}</div> : null}
          <GreyBox>The person sees this in their History as &quot;Correction by INFLX&quot;, with your reason. A balance can never go below zero.</GreyBox>
          <div className="flex gap-2 justify-end"><Btn kind="sec" small={false} onClick={() => setTool(null)}>Back</Btn><Btn small={false} onClick={go} disabled={busy || !person}>{busy ? 'Saving…' : direction === 'credit' ? 'Add to the wallet' : 'Take from the wallet'}</Btn></div>
        </Modal>
      )}
      {toast}
    </div>
  );
}
