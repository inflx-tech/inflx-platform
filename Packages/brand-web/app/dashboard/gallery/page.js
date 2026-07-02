'use client';
import { useEffect, useState, useRef, useMemo } from 'react';
import { mediaGalleryApi, referenceLinkApi, uploadFileToGallery, fmtRupees } from '../../../lib/api';

// ─── Constants ──────────────────────────────────────────────────────────────

const ACCEPT_FILE_TYPES = 'image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml,image/heic,image/heif,application/pdf,application/zip';

const TAG_OPTIONS = [
  { value: 'logo',         label: 'Logo' },
  { value: 'brand_kit',    label: 'Brand Kit' },
  { value: 'product_shot', label: 'Product Shot' },
  { value: 'video',        label: 'Video' },
  { value: 'document',     label: 'Document' },
  { value: 'other',        label: 'Other' },
];

// Palette-mapped tag colors (named per locked-palette accents)
const TAG_COLOR = {
  logo:         { bg: 'var(--yellow-pale)', fg: 'var(--yellow-text)' },
  brand_kit:    { bg: 'var(--yellow-pale)', fg: 'var(--yellow-text)' },
  product_shot: { bg: 'var(--conv-pale)',   fg: 'var(--conv)' },
  video:        { bg: 'var(--danger-pale)', fg: 'var(--danger-text)' },
  document:     { bg: 'var(--info-pale)',   fg: 'var(--info)' },
  other:        { bg: 'var(--bg2)',         fg: 'var(--muted)' },
};

const STATUS_PILL = {
  draft:              { cls: 'draft',     label: 'Draft' },
  pending_influencer: { cls: 'pending',   label: 'Pending Influencer' },
  pending_brand:      { cls: 'pending',   label: 'Pending Brand' },
  active:             { cls: 'active',    label: 'Active' },
  cancelled:          { cls: 'cancelled', label: 'Cancelled' },
};

// Auto-detect platform from URL → emoji + label + accent color
function platformFromUrl(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('youtube.') || u.includes('youtu.be')) return { em: '▶️', label: 'YouTube', bg: 'var(--danger-pale)', fg: 'var(--danger-text)', avbg: '#FF0000', avfg: '#FFFFFF' };
  if (u.includes('drive.google.') || u.includes('docs.google.')) return { em: '📄', label: 'Drive', bg: 'var(--info-pale)', fg: 'var(--info)', avbg: '#4285F4', avfg: '#FFFFFF' };
  if (u.includes('figma.com')) return { em: '🎨', label: 'Figma', bg: '#FFE5DB', fg: '#F24E1E', avbg: '#F24E1E', avfg: '#FFFFFF' };
  if (u.includes('notion.')) return { em: '📝', label: 'Notion', bg: 'var(--bg2)', fg: 'var(--ink)', avbg: '#0A0A0A', avfg: '#FFFFFF' };
  if (u.includes('instagram.')) return { em: '📷', label: 'Instagram', bg: '#FBE3EB', fg: '#E1306C', avbg: '#E1306C', avfg: '#FFFFFF' };
  if (u.includes('dropbox.')) return { em: '📦', label: 'Dropbox', bg: 'var(--info-pale)', fg: 'var(--info)', avbg: '#0061FF', avfg: '#FFFFFF' };
  return { em: '🔗', label: 'Link', bg: 'var(--bg2)', fg: 'var(--muted)', avbg: 'var(--info-pale)', avfg: 'var(--info)' };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sizeLabel(bytes) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

function fmtRelative(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const sec = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (sec < 60)      return `${sec}s ago`;
  if (sec < 3600)    return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86_400)  return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604_800) return `${Math.floor(sec / 86_400)}d ago`;
  return fmtDate(iso);
}

function fileTypeIcon(type) {
  if (!type) return '📄';
  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎬';
  if (type === 'application/pdf') return '📄';
  if (type.includes('zip')) return '📦';
  return '📄';
}

function initials(name) {
  const src = (name || '??').replace(/^@/, '').trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

// ─── Locked palette CSS scoped under .gal — day-1 discipline ────────────────
const CSS = `
.gal *{box-sizing:border-box}
.gal{
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
}
.gal .mono{font-family:'JetBrains Mono','Menlo','Consolas',monospace}

.gal .hdr{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:18px;flex-wrap:wrap}
.gal .hdr-l h1{font-family:'Outfit',sans-serif;font-size:24px;font-weight:700;color:var(--ink);letter-spacing:-.4px}
.gal .hdr-l .rule{width:42px;height:3px;background:var(--yellow);border-radius:2px;margin:6px 0}
.gal .hdr-l .sub{font-size:12px;color:var(--muted-2);max-width:600px;line-height:1.5}
.gal .cnt-chip{display:inline-flex;align-items:center;padding:5px 11px;border-radius:99px;background:var(--ink);color:var(--yellow);font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;margin-bottom:6px}
.gal .btn-ink{padding:8px 14px;background:var(--ink);color:var(--yellow);border-radius:10px;font-size:12px;font-weight:700;border:0;cursor:pointer;font-family:inherit}
.gal .btn-ink:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}
.gal .btn-ink:disabled{opacity:.4;cursor:not-allowed;background:var(--ink);color:var(--yellow)}
.gal .btn-ghost{padding:8px 14px;background:var(--white);border:1px solid var(--border);border-radius:10px;font-size:12px;font-weight:700;color:var(--ink);cursor:pointer;font-family:inherit}
.gal .btn-ghost:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}

/* Sub-tab pills */
.gal .subtabs{display:inline-flex;gap:2px;background:var(--bg2);border-radius:12px;padding:4px;margin-bottom:14px}
.gal .subtab{padding:8px 18px;border-radius:9px;font-size:12.5px;font-weight:700;color:var(--muted);background:transparent;display:inline-flex;align-items:center;gap:7px;border:0;cursor:pointer;font-family:inherit}
.gal .subtab:hover:not(.act):not(:disabled){color:var(--ink);background:transparent}
.gal .subtab.act{background:var(--ink);color:var(--yellow)}
.gal .subtab.act:hover:not(:disabled){background:var(--ink);color:var(--yellow)}
.gal .subtab .ct{font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:800;background:rgba(255,255,255,.12);color:inherit;padding:2px 7px;border-radius:99px}
.gal .subtab:not(.act) .ct{background:var(--white);color:var(--muted-2)}

/* INK usage bar */
.gal .usage{background:var(--ink);color:var(--white);border-radius:12px;padding:14px 18px;margin-bottom:14px;display:flex;align-items:center;gap:18px;flex-wrap:wrap}
.gal .usage-l{display:flex;flex-direction:column;gap:2px}
.gal .usage-v{font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:800;color:var(--white)}
.gal .usage-v .yel{color:var(--yellow)}
.gal .usage-s{font-family:'Outfit',sans-serif;font-size:9.5px;font-weight:700;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.4px}
.gal .usage-bar{flex:1;height:8px;background:rgba(255,255,255,.1);border-radius:99px;overflow:hidden;min-width:240px}
.gal .usage-bar-f{height:100%;background:var(--yellow);border-radius:99px;transition:width .15s}
.gal .usage-bar-f.warn{background:var(--danger)}
.gal .usage-bar-f.mid{background:#FFA500}
.gal .usage-r{font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(255,255,255,.65)}
.gal .usage-warn{flex:1 1 100%;font-family:'JetBrains Mono',monospace;font-size:11px;color:#FCA5A5;margin-top:6px}

/* Tag chips */
.gal .chip-row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;overflow-x:auto;padding-bottom:2px;align-items:center}
.gal .chip-row .lbl{font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.5px;margin-right:6px}
.gal .chip{padding:6px 12px;border-radius:99px;background:var(--white);border:1px solid var(--border);font-size:11.5px;font-weight:700;color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;font-family:inherit}
.gal .chip:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}
.gal .chip.act{background:var(--ink);border-color:var(--ink);color:var(--yellow)}
.gal .chip.act:hover:not(:disabled){background:var(--ink);border-color:var(--ink);color:var(--yellow)}
.gal .chip .ct{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;opacity:.7}

/* Yellow-pale upload dropzone */
.gal .dz{background:linear-gradient(135deg,var(--yellow-50) 0%,var(--yellow-pale) 100%);border:2px dashed var(--yellow);border-radius:14px;padding:24px;text-align:center;margin-bottom:14px;cursor:pointer;transition:all .15s}
.gal .dz:hover{background:linear-gradient(135deg,var(--yellow-pale) 0%,var(--yellow-50) 100%);border-color:var(--yellow-hover)}
.gal .dz .em{font-size:28px;margin-bottom:6px}
.gal .dz .t{font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;color:var(--ink);margin-bottom:3px}
.gal .dz .s{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--yellow-text)}

/* Asset card grid */
.gal .ac-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
@media (max-width: 1100px){.gal .ac-grid{grid-template-columns:repeat(3,1fr)}}
@media (max-width: 880px){.gal .ac-grid{grid-template-columns:repeat(2,1fr)}}
.gal .ac{background:var(--white);border:1px solid var(--border);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;transition:all .15s}
.gal .ac:hover{border-color:var(--muted-3)}
.gal .ac-img{height:140px;background:linear-gradient(135deg,var(--bg2) 0%,var(--bg) 100%);position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden}
.gal .ac-img img,.gal .ac-img video{width:100%;height:100%;object-fit:contain}
.gal .ac-img .em{font-size:40px;opacity:.5}
.gal .ac-body{padding:10px 12px;flex:1;display:flex;flex-direction:column;gap:4px}
.gal .ac-title{font-family:'Outfit',sans-serif;font-size:12px;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gal .ac-meta{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted-2)}
.gal .ac-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.gal .ac-tag{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;padding:2px 6px;border-radius:5px;text-transform:capitalize}
.gal .ac-actions{border-top:1px solid var(--border-soft);display:flex}
.gal .ac-actions button,.gal .ac-actions a{flex:1;padding:7px;font-size:11px;font-weight:700;background:transparent;color:var(--ink);border:0;cursor:pointer;text-align:center;text-decoration:none;font-family:inherit}
.gal .ac-actions button:hover:not(:disabled),.gal .ac-actions a:hover{background:var(--bg);color:var(--ink)}
.gal .ac-actions button.del{color:var(--danger-text)}
.gal .ac-actions button.del:hover:not(:disabled){background:var(--danger-pale);color:var(--danger-text)}
.gal .ac-actions > * + *{border-left:1px solid var(--border-soft)}

/* Selected card + corner checkbox */
.gal .ac.sel{border-color:var(--yellow);box-shadow:0 0 0 2px var(--yellow-pale)}
.gal .ac-check{position:absolute;top:8px;left:8px;width:22px;height:22px;border-radius:6px;border:1.5px solid var(--border);background:rgba(255,255,255,.9);color:var(--ink);font-size:13px;font-weight:800;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2;font-family:inherit;padding:0;transition:all .12s}
.gal .ac-check:hover{border-color:var(--ink)}
.gal .ac-check.on{background:var(--ink);border-color:var(--ink);color:var(--yellow)}

/* Bulk-assign action bar */
.gal .bulk-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--yellow-50);border:1px solid var(--yellow);border-radius:12px;padding:10px 14px;margin-bottom:14px}
.gal .bulk-bar .bulk-n{font-family:'JetBrains Mono',monospace;font-size:11.5px;font-weight:800;color:var(--yellow-text);text-transform:uppercase;letter-spacing:.4px;margin-right:2px}
.gal .bulk-bar .bulk-sel{padding:8px 12px;border:1px solid var(--border);border-radius:10px;font-size:12.5px;font-weight:600;font-family:inherit;outline:none;color:var(--ink);background:var(--white);min-width:170px}
.gal .bulk-bar .bulk-sel:focus{border-color:var(--yellow);box-shadow:0 0 0 3px var(--yellow-pale)}
.gal .bulk-bar .bulk-sel:disabled{opacity:.5;cursor:not-allowed}

/* Compact row card (links + contracts) */
.gal .rc{background:var(--white);border:1px solid var(--border);border-radius:12px;padding:10px 14px;display:grid;grid-template-columns:40px 1fr auto auto auto;gap:12px;align-items:center;margin-bottom:6px;min-height:60px}
.gal .rc:hover{border-color:var(--ink)}
.gal .rc.dim{opacity:.6;border-style:dashed}
.gal .rc-av{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:'Outfit',sans-serif;font-weight:800;font-size:14px;flex-shrink:0;background:var(--yellow-pale);color:var(--yellow-text)}
.gal .rc-mid{min-width:0;display:flex;flex-direction:column;gap:3px}
.gal .rc-top{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.gal .rc-name{font-family:'Outfit',sans-serif;font-size:13.5px;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gal .rc-meta{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gal .rc-meta b{color:var(--ink);font-weight:600}
.gal .rc-meta .sep{color:var(--muted-3)}
.gal .rc-tag{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:5px;background:var(--bg2);color:var(--muted)}
.gal .rc-price{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:800;color:var(--ink);min-width:80px;text-align:right}
.gal .rc-price .l{font-family:'Outfit',sans-serif;font-size:9px;font-weight:700;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;margin-top:1px;display:block}
.gal .status-pill{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;padding:3px 9px;border-radius:99px;text-transform:uppercase;letter-spacing:.3px}
.gal .status-pill.draft{background:var(--bg2);color:var(--muted)}
.gal .status-pill.pending{background:var(--yellow-pale);color:var(--yellow-text)}
.gal .status-pill.active{background:var(--success-pale);color:var(--success-text)}
.gal .status-pill.cancelled{background:var(--danger-pale);color:var(--danger-text)}
.gal .rc-action{display:flex;gap:4px;align-items:center}
.gal .rc-action button,.gal .rc-action a{padding:5px 9px;font-size:11px;font-weight:700;border-radius:6px;background:transparent;color:var(--muted);text-decoration:none;border:0;cursor:pointer;font-family:inherit}
.gal .rc-action button:hover:not(:disabled),.gal .rc-action a:hover{color:var(--ink);background:var(--bg)}
.gal .rc-action button.danger{color:var(--danger-text)}
.gal .rc-action button.danger:hover:not(:disabled){color:var(--danger-text);background:var(--danger-pale)}
.gal .rc-action a.pri{background:var(--ink);color:var(--yellow);padding:5px 11px}
.gal .rc-action a.pri:hover{background:var(--ink-2);color:var(--yellow)}
.gal .rc-action .no-pdf{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted-2);padding:5px 9px}

/* Search + filter bar */
.gal .filter-bar{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center}
.gal .filter-bar input,.gal .filter-bar select{padding:9px 12px;border:1px solid var(--border);border-radius:10px;font-size:13px;font-family:inherit;outline:none;color:var(--ink);background:var(--white)}
.gal .filter-bar input:focus,.gal .filter-bar select:focus{border-color:var(--yellow);box-shadow:0 0 0 3px var(--yellow-pale)}
.gal .filter-bar input{flex:1;min-width:240px}
.gal .filter-bar select{min-width:160px;font-weight:600}

/* Helper text */
.gal .helper{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2);margin-bottom:12px}

/* Empty */
.gal .empty{background:linear-gradient(135deg,var(--yellow-50) 0%,var(--yellow-pale) 100%);border:1px solid rgba(255,193,7,.4);border-radius:18px;padding:48px 32px;text-align:center;margin-top:14px;position:relative;overflow:hidden}
.gal .empty::before{content:'';position:absolute;top:-50px;right:-50px;width:180px;height:180px;background:var(--yellow);border-radius:50%;opacity:.18}
.gal .empty > *{position:relative;z-index:2}
.gal .empty .em{font-size:48px;margin-bottom:10px}
.gal .empty .h{font-family:'Outfit',sans-serif;font-size:18px;font-weight:700;color:var(--ink);margin-bottom:6px}
.gal .empty .t{font-size:12px;color:var(--muted);line-height:1.55;max-width:480px;margin:0 auto}

/* Spinner */
.gal .spinner{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--yellow);border-radius:50%;animation:gal-spin .8s linear infinite;margin:80px auto}
@keyframes gal-spin{to{transform:rotate(360deg)}}

/* Error band */
.gal .err{padding:10px 14px;background:var(--danger-pale);border:1px solid #FBCBC4;border-radius:10px;font-size:11.5px;color:var(--danger-text);margin-bottom:12px}

/* Modal */
.gal .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:50;display:flex;align-items:center;justify-content:center;padding:16px}
.gal .modal{background:var(--white);border-radius:16px;max-width:440px;width:100%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,.25)}
.gal .modal.lg{max-width:820px;height:560px}
.gal .modal-h{padding:18px 22px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
.gal .modal-h h3{font-family:'Outfit',sans-serif;font-size:16px;font-weight:700;color:var(--ink)}
.gal .modal-h .s{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2);margin-top:3px}
.gal .modal-h-r{display:flex;gap:8px;align-items:center}
.gal .modal-x{width:30px;height:30px;border-radius:50%;color:var(--muted-2);font-size:20px;background:transparent;border:0;cursor:pointer;font-family:inherit}
.gal .modal-x:hover{background:var(--bg);color:var(--ink)}
.gal .modal-b{flex:1;overflow-y:auto;padding:18px 22px}
.gal .modal-f{padding:14px 22px;border-top:1px solid var(--border);background:var(--bg);display:flex;justify-content:flex-end;gap:8px}
.gal .modal-f button{padding:9px 16px;font-size:12px;font-weight:700;border-radius:10px;border:0;cursor:pointer;font-family:inherit}
.gal .modal-f .cancel{background:var(--white);border:1px solid var(--border);color:var(--ink)}
.gal .modal-f .cancel:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}
.gal .modal-f .submit{background:var(--ink);color:var(--yellow)}
.gal .modal-f .submit:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}
.gal .modal-f .submit:disabled{opacity:.4;cursor:not-allowed;background:var(--ink);color:var(--yellow)}
.gal .pdf-frame{flex:1;background:var(--bg2);width:100%;border:0;display:block}

/* Field */
.gal .field{margin-bottom:14px}
.gal .field-l{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;display:block}
.gal .field input,.gal .field textarea{width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:10px;font-size:13px;font-family:inherit;outline:none;color:var(--ink);background:var(--white);resize:vertical}
.gal .field input:focus,.gal .field textarea:focus{border-color:var(--yellow);box-shadow:0 0 0 3px var(--yellow-pale)}
.gal .field .tags{display:flex;flex-wrap:wrap;gap:6px}
.gal .field .tag{padding:5px 11px;border-radius:99px;background:var(--bg);border:1px solid var(--border);font-size:11.5px;font-weight:600;color:var(--muted);cursor:pointer;font-family:inherit}
.gal .field .tag:hover:not(:disabled){border-color:var(--ink);color:var(--ink)}
.gal .field .tag.act{background:var(--ink);border-color:var(--ink);color:var(--yellow)}
`;

// ─── Usage Bar ──────────────────────────────────────────────────────────────

function UsageBar({ usage }) {
  if (!usage) return null;
  const pct = usage.used_pct || 0;
  const usedMb = (usage.used_bytes / (1024 * 1024)).toFixed(1);
  const quotaMb = Math.floor(usage.quota_bytes / (1024 * 1024));
  const remainingMb = Math.max(0, (usage.remaining_bytes / (1024 * 1024))).toFixed(0);
  const cls = pct >= 90 ? 'warn' : pct >= 75 ? 'mid' : '';
  return (
    <div className="usage">
      <div className="usage-l">
        <div className="usage-v"><span className="yel">{usedMb}</span> / {quotaMb} MB</div>
        <div className="usage-s">Storage used</div>
      </div>
      <div className="usage-bar"><div className={`usage-bar-f ${cls}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
      <div className="usage-r">{remainingMb} MB free</div>
      {pct >= 90 && <div className="usage-warn">You're near the limit. Delete unused assets, or contact support to increase your quota.</div>}
    </div>
  );
}

// ─── Assets Panel ───────────────────────────────────────────────────────────

function AssetsPanel() {
  const [assets, setAssets]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [tagFilter, setTagFilter]     = useState('');
  const [uploading, setUploading]     = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [editingAsset, setEditingAsset] = useState(null);
  const [usage, setUsage]             = useState(null);
  const [selected, setSelected]       = useState(() => new Set());
  const [assignTag, setAssignTag]     = useState('');
  const [assigning, setAssigning]     = useState(false);
  const [assignError, setAssignError] = useState(null);
  const fileInputRef                  = useRef(null);

  async function load() {
    setLoading(true);
    const [assetsRes, usageRes] = await Promise.all([
      mediaGalleryApi.list(tagFilter ? { tag: tagFilter } : null),
      mediaGalleryApi.getUsage(),
    ]);
    setLoading(false);
    if (assetsRes.success) setAssets(assetsRes.data?.assets || []);
    if (usageRes.success)  setUsage(usageRes.data);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tagFilter]);

  // Reset selection whenever the tag filter changes, so we never keep stale
  // selected ids that aren't currently visible.
  useEffect(() => { setSelected(new Set()); setAssignError(null); }, [tagFilter]);

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = assets.length > 0 && selected.size === assets.length;

  function toggleSelectAll() {
    setSelected(prev => (prev.size === assets.length ? new Set() : new Set(assets.map(a => a.id))));
  }

  function clearSelection() { setSelected(new Set()); setAssignError(null); }

  async function handleAssign() {
    if (!assignTag || selected.size === 0) return;
    setAssigning(true);
    setAssignError(null);
    const targets = assets.filter(a => selected.has(a.id));
    try {
      const results = await Promise.all(targets.map(a => {
        const union = Array.from(new Set([...(a.tags || []), assignTag]));
        return mediaGalleryApi.update(a.id, { tags: union });
      }));
      const failed = results.find(r => r && r.success === false);
      if (failed) {
        setAssignError(failed.error?.message || 'Some assets could not be updated.');
      } else {
        setSelected(new Set());
        setAssignTag('');
      }
    } catch (e) {
      setAssignError(e?.message || 'Assign failed. Please try again.');
    }
    setAssigning(false);
    await load();
  }

  async function handleFiles(files) {
    if (!files || !files.length) return;
    setUploading(true);
    setUploadError(null);
    for (const file of files) {
      const { error } = await uploadFileToGallery(file, { title: file.name });
      if (error) { setUploadError(error.message || 'Upload failed'); break; }
    }
    setUploading(false);
    load();
  }

  async function handleDelete(id) {
    if (!confirm('Delete this asset? This cannot be undone.')) return;
    const res = await mediaGalleryApi.delete(id);
    if (res.success || res.ok || res.status === 204) load();
  }

  // Tag chip counts (derived from already-loaded assets when filter is empty;
  // otherwise show '—' since the filtered set doesn't include other tags).
  const tagCounts = useMemo(() => {
    if (tagFilter) return null;
    const c = { '': assets.length };
    TAG_OPTIONS.forEach(t => { c[t.value] = 0; });
    for (const a of assets) for (const t of (a.tags || [])) if (c[t] !== undefined) c[t] += 1;
    return c;
  }, [assets, tagFilter]);

  return (
    <div>
      <UsageBar usage={usage} />

      <div className="chip-row">
        <span className="lbl">FILTER</span>
        <button className={`chip${!tagFilter ? ' act' : ''}`} onClick={() => setTagFilter('')}>
          All {tagCounts && <span className="ct">{tagCounts[''] || 0}</span>}
        </button>
        {TAG_OPTIONS.map(opt => (
          <button key={opt.value} className={`chip${tagFilter === opt.value ? ' act' : ''}`} onClick={() => setTagFilter(opt.value)}>
            {opt.label} {tagCounts && <span className="ct">{tagCounts[opt.value] || 0}</span>}
          </button>
        ))}
        {assets.length > 0 && (
          <button className="chip" onClick={toggleSelectAll} style={{ marginLeft: 'auto' }}>
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-n">{selected.size} selected</span>
          <select
            className="bulk-sel"
            value={assignTag}
            onChange={(e) => setAssignTag(e.target.value)}
            disabled={assigning}
          >
            <option value="">Choose category…</option>
            {TAG_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button className="btn-ink" onClick={handleAssign} disabled={assigning || !assignTag}>
            {assigning ? 'Assigning…' : 'Assign'}
          </button>
          <button className="btn-ghost" onClick={clearSelection} disabled={assigning}>Clear</button>
        </div>
      )}

      {assignError && <div className="err">{assignError}</div>}
      {uploadError && <div className="err">{uploadError}</div>}

      <div
        className="dz"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(Array.from(e.dataTransfer.files || [])); }}
      >
        <div className="em">☁️</div>
        <div className="t">{uploading ? 'Uploading…' : 'Click or drag files here to upload'}</div>
        <div className="s">Images · PDF · ZIP · max 25 MB each · for videos add a Reference Link</div>
        <input ref={fileInputRef} type="file" multiple accept={ACCEPT_FILE_TYPES} style={{ display: 'none' }}
          onChange={(e) => handleFiles(Array.from(e.target.files || []))} />
      </div>

      {loading ? (
        <div className="spinner" />
      ) : assets.length === 0 ? (
        <div className="empty">
          <div className="em">🖼️</div>
          <div className="h">No assets yet</div>
          <div className="t">Upload logos, brand kits, videos, and reference material to share with influencers.</div>
        </div>
      ) : (
        <div className="ac-grid">
          {assets.map(a => (
            <AssetCard
              key={a.id}
              asset={a}
              selected={selected.has(a.id)}
              onToggleSelect={() => toggleSelect(a.id)}
              onEdit={() => setEditingAsset(a)}
              onDelete={() => handleDelete(a.id)}
            />
          ))}
        </div>
      )}

      {editingAsset && (
        <EditAssetModal asset={editingAsset} onClose={() => setEditingAsset(null)} onSaved={() => { setEditingAsset(null); load(); }} />
      )}
    </div>
  );
}

function AssetCard({ asset, selected, onToggleSelect, onEdit, onDelete }) {
  const isImage = (asset.file_type || '').startsWith('image/');
  const isVideo = (asset.file_type || '').startsWith('video/');
  const tags = asset.tags || [];
  return (
    <div className={`ac${selected ? ' sel' : ''}`}>
      <div className="ac-img">
        <button
          type="button"
          className={`ac-check${selected ? ' on' : ''}`}
          aria-label={selected ? 'Deselect asset' : 'Select asset'}
          aria-pressed={selected}
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        >
          {selected ? '✓' : ''}
        </button>
        {isImage && asset.download_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.download_url} alt={asset.title} />
        ) : isVideo && asset.download_url ? (
          <video src={asset.download_url} muted />
        ) : (
          <span className="em">{fileTypeIcon(asset.file_type)}</span>
        )}
      </div>
      <div className="ac-body">
        <div className="ac-title" title={asset.title}>{asset.title}</div>
        <div className="ac-meta">{sizeLabel(asset.file_size_bytes)} · {fmtRelative(asset.created_at)}</div>
        {tags.length > 0 && (
          <div className="ac-tags">
            {tags.slice(0, 3).map(t => {
              const c = TAG_COLOR[t] || TAG_COLOR.other;
              return <span key={t} className="ac-tag" style={{ background: c.bg, color: c.fg }}>{t.replace(/_/g, ' ')}</span>;
            })}
            {tags.length > 3 && <span className="ac-tag" style={{ background: 'var(--ink)', color: 'var(--yellow)' }}>+{tags.length - 3}</span>}
          </div>
        )}
      </div>
      <div className="ac-actions">
        {asset.download_url && <a href={asset.download_url} target="_blank" rel="noreferrer">Open</a>}
        <button onClick={onEdit}>Edit</button>
        <button className="del" onClick={onDelete}>Del</button>
      </div>
    </div>
  );
}

function EditAssetModal({ asset, onClose, onSaved }) {
  const [title, setTitle]             = useState(asset.title || '');
  const [description, setDescription] = useState(asset.description || '');
  const [tags, setTags]               = useState(new Set(asset.tags || []));
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);

  function toggleTag(value) {
    const next = new Set(tags);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setTags(next);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await mediaGalleryApi.update(asset.id, {
      title, description, tags: Array.from(tags),
    });
    setSaving(false);
    if (res.success) onSaved();
    else setError(res.error?.message || 'Save failed');
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h3>Edit Asset</h3>
          <button className="modal-x" onClick={onClose}>×</button>
        </div>
        <div className="modal-b">
          <div className="field">
            <label className="field-l">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-l">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="field">
            <label className="field-l">Tags</label>
            <div className="tags">
              {TAG_OPTIONS.map(opt => (
                <button key={opt.value} className={`tag${tags.has(opt.value) ? ' act' : ''}`} onClick={() => toggleTag(opt.value)}>{opt.label}</button>
              ))}
            </div>
          </div>
          {error && <div className="err">{error}</div>}
        </div>
        <div className="modal-f">
          <button className="cancel" onClick={onClose}>Cancel</button>
          <button className="submit" onClick={save} disabled={saving || !title.trim()}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Links Panel ────────────────────────────────────────────────────────────

function LinksPanel() {
  const [links, setLinks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    const res = await referenceLinkApi.list();
    setLoading(false);
    if (res.success) setLinks(res.data?.links || []);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!confirm('Delete this link?')) return;
    const res = await referenceLinkApi.delete(id);
    if (res.success || res.ok || res.status === 204) load();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 14, flexWrap: 'wrap' }}>
        <div className="helper">URLs to YouTube · Drive · Figma · Notion · etc. Zero storage cost — only the link is saved.</div>
        <button className="btn-ink" onClick={() => setEditing({})}>+ Add Link</button>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : links.length === 0 ? (
        <div className="empty">
          <div className="em">🔗</div>
          <div className="h">No reference links yet</div>
          <div className="t">Add YouTube reels, Drive folders, Figma files, Notion briefs — anything you'd normally share by link.</div>
        </div>
      ) : (
        <div>
          {links.map(l => {
            const p = platformFromUrl(l.url);
            return (
              <div key={l.id} className="rc">
                <div className="rc-av" style={{ background: p.avbg, color: p.avfg, fontSize: 14 }}>{p.em}</div>
                <div className="rc-mid">
                  <div className="rc-top">
                    <span className="rc-name">{l.title}</span>
                  </div>
                  <div className="rc-meta">
                    {l.url}
                    {l.description && <><span className="sep"> · </span>{l.description}</>}
                  </div>
                </div>
                <span className="rc-tag" style={{ background: p.bg, color: p.fg }}>{p.label}</span>
                <span /> {/* spacer for status-pill column */}
                <div className="rc-action">
                  <a className="pri" href={l.url} target="_blank" rel="noreferrer">Open ↗</a>
                  <button onClick={() => setEditing(l)}>Edit</button>
                  <button className="danger" onClick={() => handleDelete(l.id)}>Del</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <LinkModal link={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

function LinkModal({ link, onClose, onSaved }) {
  const [title, setTitle]             = useState(link?.title || '');
  const [url, setUrl]                 = useState(link?.url || '');
  const [description, setDescription] = useState(link?.description || '');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);

  async function save() {
    setSaving(true);
    setError(null);
    const payload = { url, title, description: description || null };
    const res = link?.id ? await referenceLinkApi.update(link.id, payload) : await referenceLinkApi.create(payload);
    setSaving(false);
    if (res.success) onSaved();
    else setError(res.error?.message || 'Save failed');
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h3>{link?.id ? 'Edit Link' : 'Add Reference Link'}</h3>
          <button className="modal-x" onClick={onClose}>×</button>
        </div>
        <div className="modal-b">
          <div className="field">
            <label className="field-l">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Product launch hero video" />
          </div>
          <div className="field">
            <label className="field-l">URL</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="field">
            <label className="field-l">Description (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          {error && <div className="err">{error}</div>}
        </div>
        <div className="modal-f">
          <button className="cancel" onClick={onClose}>Cancel</button>
          <button className="submit" onClick={save} disabled={saving || !title.trim() || !url.trim()}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Contracts Panel ────────────────────────────────────────────────────────

function ContractsPanel() {
  const [contracts, setContracts]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [previewContract, setPreviewContract] = useState(null);

  useEffect(() => {
    mediaGalleryApi.listContracts().then(res => {
      setLoading(false);
      if (res.success) setContracts(res.data?.contracts || []);
    });
  }, []);

  const filtered = contracts.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (c.campaign_name || '').toLowerCase().includes(s)
        || (c.influencer_name || '').toLowerCase().includes(s)
        || (c.influencer_handle || '').toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div>
      <div className="filter-bar">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by campaign or influencer…" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_influencer">Pending Influencer</option>
          <option value="pending_brand">Pending Brand</option>
          <option value="active">Active</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : filtered.length === 0 ? (
        <div className="empty">
          <div className="em">📝</div>
          <div className="h">No contracts match</div>
          <div className="t">Sign a contract with an influencer to see it here.</div>
        </div>
      ) : (
        <div>
          {filtered.map(c => {
            const pill = STATUS_PILL[c.status] || { cls: 'draft', label: String(c.status || '—').replace(/_/g, ' ') };
            const fee = (Number(c.influencer_fee) || 0) + (Number(c.bonus_amount) || 0);
            return (
              <div key={c.id} className={`rc${c.status === 'cancelled' ? ' dim' : ''}`}>
                <div className="rc-av">{initials(c.influencer_name)}</div>
                <div className="rc-mid">
                  <div className="rc-top">
                    <span className="rc-name">{c.campaign_name || '—'}</span>
                    {c.campaign_goal && <span className="rc-tag">{c.campaign_goal}</span>}
                  </div>
                  <div className="rc-meta">
                    @{c.influencer_handle || c.influencer_name || '—'}
                    {c.brand_signed_at && <><span className="sep"> · </span>signed {fmtRelative(c.brand_signed_at)}</>}
                    {!c.brand_signed_at && c.created_at && <><span className="sep"> · </span>created {fmtRelative(c.created_at)}</>}
                  </div>
                </div>
                <div className="rc-price">{fmtRupees(fee)}<span className="l">fee</span></div>
                <span className={`status-pill ${pill.cls}`}>● {pill.label}</span>
                <div className="rc-action">
                  {c.pdf_url
                    ? <a className="pri" onClick={() => setPreviewContract(c)} style={{ cursor: 'pointer' }}>View PDF</a>
                    : <span className="no-pdf">No PDF yet</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {previewContract && <ContractPreviewModal contract={previewContract} onClose={() => setPreviewContract(null)} />}
    </div>
  );
}

function ContractPreviewModal({ contract, onClose }) {
  const [url, setUrl]       = useState(null);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    mediaGalleryApi.contractPdfUrl(contract.id).then(res => {
      setLoad(false);
      if (res.success) setUrl(res.data?.url);
      else setError(res.error?.message || 'Could not load PDF');
    });
  }, [contract.id]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div>
            <h3>{contract.campaign_name}</h3>
            <div className="s">{contract.influencer_name}{contract.influencer_handle ? ` · @${contract.influencer_handle}` : ''}</div>
          </div>
          <div className="modal-h-r">
            {url && <a className="btn-ink" href={url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Download</a>}
            <button className="modal-x" onClick={onClose}>×</button>
          </div>
        </div>
        {loading ? (
          <div className="pdf-frame" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted-2)' }}>Loading PDF…</div>
        ) : error ? (
          <div className="pdf-frame" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger-text)', fontSize: 13 }}>{error}</div>
        ) : url ? (
          <iframe className="pdf-frame" src={url} title="Contract PDF" />
        ) : (
          <div className="pdf-frame" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--muted-2)' }}>No PDF available</div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function GalleryPage() {
  const [tab, setTab] = useState('assets');
  // We don't have counts at this level (each panel loads its own data) — show '—'
  // until panel-mounted; this matches OLD behaviour (counts only inside panels).

  return (
    <div className="gal">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="hdr">
        <div className="hdr-l">
          <span className="cnt-chip">Media Gallery</span>
          <h1>Media Gallery</h1>
          <div className="rule" />
          <div className="sub">Brand assets to share with influencers · external reference links · signed contracts archive.</div>
        </div>
      </div>

      <div className="subtabs" role="tablist">
        <button role="tab" aria-selected={tab === 'assets'} className={`subtab${tab === 'assets' ? ' act' : ''}`} onClick={() => setTab('assets')}>Brand Assets</button>
        <button role="tab" aria-selected={tab === 'links'} className={`subtab${tab === 'links' ? ' act' : ''}`} onClick={() => setTab('links')}>Reference Links</button>
        <button role="tab" aria-selected={tab === 'contracts'} className={`subtab${tab === 'contracts' ? ' act' : ''}`} onClick={() => setTab('contracts')}>Contracts</button>
      </div>

      {tab === 'assets' && <AssetsPanel />}
      {tab === 'links' && <LinksPanel />}
      {tab === 'contracts' && <ContractsPanel />}
    </div>
  );
}
