'use client';
import { useEffect, useState } from 'react';
import { notificationApi } from '../../../lib/api';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtRelative(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const sec = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (sec < 60)      return `${sec}s ago`;
  if (sec < 3600)    return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86_400)  return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604_800) return `${Math.floor(sec / 86_400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function notifAvatar(type) {
  const t = type || '';
  if (t.includes('offer')) return { em: '📩', cls: 'offer' };
  if (t.includes('campaign')) return { em: '📣', cls: 'campaign' };
  if (t.includes('contract')) return { em: '📝', cls: 'contract' };
  if (t.includes('content') || t.includes('deliverable')) return { em: '🎬', cls: 'content' };
  if (t.includes('refund') || t.includes('return') || t.includes('cancel')) return { em: '⚠', cls: 'danger' };
  if (t.includes('wallet') || t.includes('escrow') || t.includes('commission') || t.includes('payment')) return { em: '💰', cls: 'money' };
  return { em: '🔔', cls: '' };
}

// ─── Locked palette CSS scoped under .ntf ───────────────────────────────────
const CSS = `
.ntf *{box-sizing:border-box}
.ntf{
  --white:#FFFFFF; --bg:#FAFAFA; --bg2:#F4F4F5;
  --yellow:#FFC107; --yellow-hover:#E0A800; --yellow-pale:#FFF7CC; --yellow-50:#FFFDEB; --yellow-text:#6B5A00;
  --ink:#0A0A0A; --ink-2:#1F1F22;
  --muted:#52525B; --muted-2:#71717A; --muted-3:#A1A1AA; --muted-4:#D4D4D8;
  --border:#E4E4E7; --border-soft:#F4F4F5;
  --success:#10B981; --success-pale:#D1FAE5; --success-text:#047857;
  --danger:#E8401A; --danger-pale:#FDEEE9; --danger-text:#B91C1C;
  --conv:#7E22CE; --conv-pale:#F3E8FF;
  --eng:#0E7490; --eng-pale:#CFFAFE;
  --info:#1D4ED8; --info-pale:#DBEAFE;
  font-family:'Plus Jakarta Sans','Outfit',system-ui,sans-serif;
  color:var(--ink); font-size:13px; line-height:1.45;
  max-width:920px; margin:0 auto;
}
.ntf .mono{font-family:'JetBrains Mono','Menlo','Consolas',monospace}

.ntf .hdr{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:18px;flex-wrap:wrap}
.ntf .hdr-l h1{font-family:'Outfit',sans-serif;font-size:24px;font-weight:700;color:var(--ink);letter-spacing:-.4px}
.ntf .hdr-l .rule{width:42px;height:3px;background:var(--yellow);border-radius:2px;margin:6px 0}
.ntf .hdr-l .sub{font-size:12px;color:var(--muted-2);max-width:560px;line-height:1.5}
.ntf .cnt-chip{display:inline-flex;align-items:center;padding:5px 11px;border-radius:99px;background:var(--ink);color:var(--yellow);font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;margin-bottom:6px}
.ntf .cnt-chip.unread{background:var(--yellow);color:var(--ink)}
.ntf .btn-yel{padding:8px 14px;background:var(--yellow);color:var(--ink);border-radius:10px;font-size:12px;font-weight:700;border:0;cursor:pointer;font-family:inherit}
.ntf .btn-yel:hover:not(:disabled){background:var(--yellow-hover);color:var(--ink)}
.ntf .btn-yel:disabled{opacity:.4;cursor:not-allowed;background:var(--yellow);color:var(--ink)}

.ntf .rc{background:var(--white);border:1px solid var(--border);border-radius:12px;padding:10px 14px;display:grid;grid-template-columns:40px 1fr auto auto;gap:12px;align-items:center;margin-bottom:6px;min-height:60px}
.ntf .rc:hover{border-color:var(--muted-3)}
.ntf .rc.unread{background:var(--yellow-50);border-color:var(--yellow-pale)}
.ntf .rc-av{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;background:var(--yellow-pale);color:var(--yellow-text)}
.ntf .rc-av.offer{background:var(--info-pale);color:var(--info)}
.ntf .rc-av.campaign{background:var(--conv-pale);color:var(--conv)}
.ntf .rc-av.contract{background:var(--eng-pale);color:var(--eng)}
.ntf .rc-av.content{background:var(--success-pale);color:var(--success-text)}
.ntf .rc-av.money{background:var(--yellow-pale);color:var(--yellow-text)}
.ntf .rc-av.danger{background:var(--danger-pale);color:var(--danger-text)}
.ntf .rc-mid{min-width:0;display:flex;flex-direction:column;gap:3px}
.ntf .rc-name{font-family:'Outfit',sans-serif;font-size:13.5px;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ntf .rc-body{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ntf .rc-dt{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted-2);text-align:right;min-width:74px;flex-shrink:0}
.ntf .rc-unread-dot{width:8px;height:8px;border-radius:50%;background:var(--yellow);flex-shrink:0}
.ntf .rc-spacer{width:8px;flex-shrink:0}

.ntf .empty{background:linear-gradient(135deg,var(--yellow-50) 0%,var(--yellow-pale) 100%);border:1px solid rgba(255,193,7,.4);border-radius:18px;padding:48px 32px;text-align:center;margin-top:14px;position:relative;overflow:hidden}
.ntf .empty::before{content:'';position:absolute;top:-50px;right:-50px;width:180px;height:180px;background:var(--yellow);border-radius:50%;opacity:.18}
.ntf .empty > *{position:relative;z-index:2}
.ntf .empty .em{font-size:48px;margin-bottom:10px}
.ntf .empty .h{font-family:'Outfit',sans-serif;font-size:18px;font-weight:700;color:var(--ink);margin-bottom:6px}
.ntf .empty .t{font-size:12px;color:var(--muted);max-width:480px;margin:0 auto;line-height:1.55}

.ntf .spinner{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--yellow);border-radius:50%;animation:ntf-spin .8s linear infinite;margin:80px auto;display:block}
@keyframes ntf-spin{to{transform:rotate(360deg)}}
`;

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [unread, setUnread]               = useState(0);

  async function load() {
    const res = await notificationApi.list();
    setLoading(false);
    if (res.success) {
      setNotifications(res.data?.notifications || []);
      setUnread(res.data?.unread_count || 0);
    }
  }

  useEffect(() => { load(); }, []);

  async function markAllRead() {
    await notificationApi.markAllRead();
    load();
  }

  const total = notifications.length;
  const chipLabel = unread > 0 ? `${unread} unread · ${total} total` : `${total} total`;

  return (
    <div className="ntf">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="hdr">
        <div className="hdr-l">
          <span className={`cnt-chip${unread > 0 ? ' unread' : ''}`}>{chipLabel}</span>
          <h1>Notifications</h1>
          <div className="rule" />
          <div className="sub">Campaign updates, offer responses, content reviews, wallet activity, and more.</div>
        </div>
        {unread > 0 && <button className="btn-yel" onClick={markAllRead}>✓ Mark all read</button>}
      </div>

      {loading ? (
        <div className="spinner" />
      ) : notifications.length === 0 ? (
        <div className="empty">
          <div className="em">🔔</div>
          <div className="h">No notifications yet</div>
          <div className="t">You'll see campaign updates, offer responses, content reviews, and wallet activity here as they happen.</div>
        </div>
      ) : (
        <div>
          {notifications.map(n => {
            const av = notifAvatar(n.type);
            return (
              <div key={n.id} className={`rc${!n.is_read ? ' unread' : ''}`}>
                <div className={`rc-av ${av.cls}`}>{av.em}</div>
                <div className="rc-mid">
                  <div className="rc-name">{n.title}</div>
                  <div className="rc-body">{n.body}</div>
                </div>
                <div className="rc-dt">{fmtRelative(n.created_at)}</div>
                {!n.is_read ? <div className="rc-unread-dot" /> : <div className="rc-spacer" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
