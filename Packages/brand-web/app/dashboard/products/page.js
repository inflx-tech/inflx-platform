'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// Drill-down verticals list products via the new tree+facets wizard
// (/dashboard/products/listing), NOT the legacy flat ListingWizard.
const DRILLDOWN_VERTICALS = new Set(['fashion', 'fashion_walkin', 'fashion_online', 'furniture']);
import { brandApi, fmtRupees } from '../../../lib/api';
import ListingWizard from './components/ListingWizard';
import { QuotaWallModal, useQuotaWall } from '../../../components/QuotaWallModal';
import OffersLibrary from './components/OffersLibrary';

// ─── Constants ──────────────────────────────────────────────────────────────

const SEGMENT_ICONS = {
  'Hatchback': '🚙', 'Sedan': '🚗', 'SUV': '🚐', 'MUV': '🚌',
  'Luxury': '🏎', 'Mini Bus': '🚌',
  'Hair Men': '💈', 'Hair Women': '💇', 'Skin': '✨', 'Nails': '💅', 'Makeup': '💄', 'Spa': '🧖',
};

// ─── Locked palette CSS scoped under .prd — day-1 discipline ────────────────
const CSS = `
.prd *{box-sizing:border-box}
.prd{
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
.prd .mono{font-family:'JetBrains Mono','Menlo','Consolas',monospace}

/* Sub-tabs (Products / Offers) — E-3 */
.prd .subtabs{display:flex;gap:4px;background:var(--bg2);padding:4px;border-radius:11px;margin-bottom:16px;width:fit-content}
.prd .subtab{border:0;background:transparent;padding:8px 18px;border-radius:8px;font-weight:700;font-size:12.5px;cursor:pointer;color:var(--muted);font-family:inherit}
.prd .subtab.act{background:var(--white);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.06)}

.prd .hdr{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:18px;flex-wrap:wrap}
.prd .hdr-l h1{font-family:'Outfit',sans-serif;font-size:24px;font-weight:700;color:var(--ink);letter-spacing:-.4px}
.prd .hdr-l .rule{width:42px;height:3px;background:var(--yellow);border-radius:2px;margin:6px 0}
.prd .hdr-l .sub{font-size:12px;color:var(--muted-2);max-width:600px;line-height:1.5}
.prd .cnt-chip{display:inline-flex;align-items:center;padding:5px 11px;border-radius:99px;background:var(--ink);color:var(--yellow);font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;margin-bottom:6px}
.prd .btn-ink{padding:8px 14px;background:var(--ink);color:var(--yellow);border-radius:10px;font-size:12px;font-weight:700;border:0;cursor:pointer;font-family:inherit}
.prd .btn-ink:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}
.prd .btn-ink:disabled{opacity:.4;cursor:not-allowed;background:var(--ink);color:var(--yellow)}
.prd .btn-yel{padding:8px 14px;background:var(--yellow);color:var(--ink);border-radius:10px;font-size:12px;font-weight:700;border:0;cursor:pointer;font-family:inherit}
.prd .btn-yel:hover:not(:disabled){background:var(--yellow-hover);color:var(--ink)}
.prd .btn-ghost{padding:8px 14px;background:var(--white);border:1px solid var(--border);border-radius:10px;font-size:12px;font-weight:700;color:var(--ink);cursor:pointer;font-family:inherit}
.prd .btn-ghost:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}

/* INK schema info bar */
.prd .info-bar{background:var(--ink);color:var(--white);border-radius:14px;padding:14px 18px;margin-bottom:14px;display:flex;align-items:center;gap:18px;flex-wrap:wrap;position:relative;overflow:hidden}
.prd .info-bar::before{content:'';position:absolute;top:-20px;right:-20px;width:120px;height:120px;background:var(--yellow);border-radius:50%;opacity:.06}
.prd .info-bar > *{position:relative;z-index:2}
.prd .info-bar .ti{display:flex;align-items:center;gap:10px;font-family:'Outfit',sans-serif;font-size:15px;font-weight:700}
.prd .info-bar .ti .em{font-size:22px}
.prd .info-bar .meta{display:flex;gap:14px;font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(255,255,255,.65);flex-wrap:wrap}
.prd .info-bar .meta b{color:var(--yellow);font-weight:700}
.prd .info-bar .badge{margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;padding:3px 9px;border-radius:99px;background:var(--yellow);color:var(--ink);text-transform:uppercase;letter-spacing:.3px}

/* Enquiry notice */
.prd .enq-notice{background:var(--info-pale);border:1px solid rgba(29,78,216,.2);border-radius:14px;padding:16px;margin-bottom:14px;display:flex;gap:14px;align-items:flex-start}
.prd .enq-notice .em{font-size:22px;flex-shrink:0}
.prd .enq-notice h4{font-family:'Outfit',sans-serif;font-size:13px;font-weight:700;color:var(--info);margin-bottom:4px}
.prd .enq-notice p{font-size:12px;color:var(--info);line-height:1.5}

/* Section heading */
.prd .sec-h{display:flex;align-items:center;gap:8px;margin:18px 0 12px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:700;color:var(--ink)}
.prd .sec-h .pip{width:6px;height:6px;border-radius:50%;background:var(--yellow)}
.prd .sec-h .ct{font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:800;color:var(--muted-2);background:var(--bg2);padding:2px 7px;border-radius:5px;margin-left:6px}
.prd .sec-h .right{margin-left:auto;font-size:11px;color:var(--muted-2);font-weight:600}

/* Chip rows */
.prd .chip-row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;overflow-x:auto;padding-bottom:2px}
.prd .chip{padding:6px 12px;border-radius:99px;background:var(--white);border:1px solid var(--border);font-size:11.5px;font-weight:700;color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;font-family:inherit}
.prd .chip:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}
.prd .chip.act{background:var(--ink);border-color:var(--ink);color:var(--yellow)}
.prd .chip.act:hover:not(:disabled){background:var(--ink);border-color:var(--ink);color:var(--yellow)}
.prd .chip .ct{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;opacity:.7}

/* Image card grid (master catalogue) */
.prd .pc-grid,.prd .pc-grid.cols3{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}
@media (max-width: 560px){.prd .pc-grid,.prd .pc-grid.cols3{grid-template-columns:repeat(2,1fr)}}
.prd .pc{background:var(--white);border:1px solid var(--border);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;transition:all .15s}
.prd .pc:hover{border-color:var(--muted-3)}
.prd .pc.act{border-color:var(--success);box-shadow:0 0 0 1px var(--success-pale)}
.prd .pc.dim{opacity:.7;border-style:dashed}
.prd .pc-img{height:190px;background:linear-gradient(135deg,var(--bg2) 0%,var(--bg) 100%);position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden}
.prd .pc-img.tall{height:210px}
.prd .pc-img img{width:100%;height:100%;object-fit:cover}
.prd .pc-img .em{font-size:40px;opacity:.4}
.prd .pc-img .overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.62) 0%,rgba(0,0,0,.15) 45%,transparent 65%)}
.prd .pc-img .label{position:absolute;bottom:9px;left:11px;right:11px;color:var(--white);font-family:'Outfit',sans-serif;font-size:15px;font-weight:700;line-height:1.25;text-shadow:0 1px 3px rgba(0,0,0,.6);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.prd .pc-img .topbadge{position:absolute;top:8px;left:8px;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:800;padding:2px 7px;border-radius:99px;background:rgba(0,0,0,.5);color:var(--white);text-transform:uppercase;letter-spacing:.3px}
.prd .pc-img .price{position:absolute;bottom:8px;right:10px;color:var(--yellow);font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:800;text-shadow:0 1px 2px rgba(0,0,0,.5)}
.prd .pc-img .live{position:absolute;top:8px;right:8px;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:800;padding:2px 7px;border-radius:99px;background:var(--success);color:var(--white);text-transform:uppercase;letter-spacing:.3px}
.prd .pc-img .live.hidden{background:var(--muted-3);color:var(--white)}
.prd .pc-body{padding:10px 12px;flex:1;display:flex;flex-direction:column;gap:4px}
.prd .pc-spec{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--muted);display:flex;gap:8px;flex-wrap:wrap}
.prd .pc-pkgs{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.prd .pc-actions{border-top:1px solid var(--border-soft);display:flex}
.prd .pc-actions button{flex:1;padding:7px;font-size:11px;font-weight:700;background:transparent;color:var(--ink);border:0;cursor:pointer;font-family:inherit}
.prd .pc-actions button:hover:not(:disabled){background:var(--bg);color:var(--ink)}
.prd .pc-actions button.del{color:var(--danger-text)}
.prd .pc-actions button.del:hover:not(:disabled){background:var(--danger-pale);color:var(--danger-text)}
.prd .pc-actions button + button{border-left:1px solid var(--border-soft)}
.prd .pc-cta{padding:8px 12px;background:var(--ink);color:var(--yellow);border:0;font-size:11px;font-weight:700;display:block;text-align:center;width:100%;cursor:pointer;font-family:inherit}
.prd .pc-cta:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}

/* Compact row card */
.prd .rc{background:var(--white);border:1px solid var(--border);border-radius:12px;padding:10px 14px;display:grid;grid-template-columns:40px 1fr auto auto auto;gap:12px;align-items:center;margin-bottom:6px;min-height:60px}
.prd .rc:hover{border-color:var(--ink)}
.prd .rc.dim{opacity:.6;border-style:dashed}
.prd .rc-av{width:36px;height:36px;border-radius:8px;background:var(--yellow-pale);color:var(--yellow-text);display:flex;align-items:center;justify-content:center;font-family:'Outfit',sans-serif;font-weight:800;font-size:14px;flex-shrink:0;overflow:hidden}
.prd .rc-av.veg{background:var(--success-pale);color:var(--success-text)}
.prd .rc-av.nonveg{background:var(--danger-pale);color:var(--danger-text)}
.prd .rc-av.na{background:var(--bg2);color:var(--muted)}
.prd .rc-mid{min-width:0;display:flex;flex-direction:column;gap:3px}
.prd .rc-top{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.prd .rc-name{font-family:'Outfit',sans-serif;font-size:13.5px;font-weight:700;color:var(--ink)}
.prd .rc-meta{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.prd .rc-meta b{color:var(--ink);font-weight:600}
.prd .rc-meta .sep{color:var(--muted-3)}
.prd .rc-tag{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:5px;background:var(--bg2);color:var(--muted);text-transform:capitalize}
.prd .rc-price{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:800;color:var(--ink);min-width:80px;text-align:right}
.prd .rc-price .l{font-family:'Outfit',sans-serif;font-size:9px;font-weight:700;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;margin-top:1px;display:block}
.prd .status-pill{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;padding:3px 9px;border-radius:99px;text-transform:uppercase;letter-spacing:.3px}
.prd .status-pill.live{background:var(--success-pale);color:var(--success-text)}
.prd .status-pill.hidden{background:var(--bg2);color:var(--muted-2)}
.prd .rc-action{display:flex;gap:4px}
.prd .rc-action button{padding:5px 9px;font-size:11px;font-weight:700;border-radius:6px;background:transparent;color:var(--muted);border:0;cursor:pointer;font-family:inherit}
.prd .rc-action button:hover:not(:disabled){color:var(--ink);background:var(--bg)}
.prd .rc-action button.danger{color:var(--danger-text)}
.prd .rc-action button.danger:hover:not(:disabled){color:var(--danger-text);background:var(--danger-pale)}

/* Add card (dashed) */
.prd .add-card{border:2px dashed var(--border);border-radius:12px;padding:24px;text-align:center;cursor:pointer;color:var(--muted-2);background:transparent;font-family:inherit;width:100%}
.prd .add-card:hover:not(:disabled){border-color:var(--yellow);color:var(--yellow-text);background:var(--yellow-50)}
.prd .add-card .em{font-size:22px;display:block;margin-bottom:4px}
.prd .add-card .t{font-size:11.5px;font-weight:700}

/* Empty state */
.prd .empty{background:linear-gradient(135deg,var(--yellow-50) 0%,var(--yellow-pale) 100%);border:1px solid rgba(255,193,7,.4);border-radius:18px;padding:48px 32px;text-align:center;margin-top:14px;position:relative;overflow:hidden}
.prd .empty::before{content:'';position:absolute;top:-50px;right:-50px;width:180px;height:180px;background:var(--yellow);border-radius:50%;opacity:.18}
.prd .empty > *{position:relative;z-index:2}
.prd .empty .em{font-size:48px;margin-bottom:10px}
.prd .empty .h{font-family:'Outfit',sans-serif;font-size:18px;font-weight:700;color:var(--ink);margin-bottom:6px}
.prd .empty .t{font-size:12px;color:var(--muted);line-height:1.55;max-width:480px;margin:0 auto 16px}

/* Spinner */
.prd .spinner{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--yellow);border-radius:50%;animation:prd-spin .8s linear infinite;margin:80px auto}
@keyframes prd-spin{to{transform:rotate(360deg)}}
.prd .skel-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
.prd .skel{height:200px;border-radius:14px;background:linear-gradient(90deg,var(--bg) 0%,var(--bg2) 50%,var(--bg) 100%);background-size:200% 100%;animation:prd-pulse 1.4s linear infinite}
@keyframes prd-pulse{0%{background-position:200% 0}100%{background-position:-200% 0}}

/* Modal */
.prd .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:50;display:flex;align-items:flex-end;justify-content:center;padding:0}
@media (min-width: 768px){.prd .modal-bg{align-items:center;padding:16px}}
.prd .modal{background:var(--white);border-radius:16px 16px 0 0;max-width:600px;width:100%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,.25)}
@media (min-width: 768px){.prd .modal{border-radius:16px}}
.prd .modal.sm{max-width:420px}
.prd .modal-h{padding:18px 22px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:14px;position:sticky;top:0;background:var(--white);z-index:5}
.prd .modal-h h3{font-family:'Outfit',sans-serif;font-size:16px;font-weight:700;color:var(--ink)}
.prd .modal-h .s{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2);margin-top:3px}
.prd .modal-x{width:30px;height:30px;border-radius:50%;color:var(--muted-2);font-size:20px;background:transparent;border:0;cursor:pointer;font-family:inherit}
.prd .modal-x:hover{background:var(--bg);color:var(--ink)}
.prd .modal-b{flex:1;overflow-y:auto;padding:18px 22px}
.prd .modal-hero{height:140px;background:linear-gradient(135deg,var(--ink) 0%,var(--ink-2) 100%);position:relative;display:flex;align-items:flex-end;padding:14px;overflow:hidden}
.prd .modal-hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.prd .modal-hero .em{font-size:48px;opacity:.4;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:var(--white)}
.prd .modal-hero .overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.7) 0%,rgba(0,0,0,.1) 100%)}
.prd .modal-hero .ti{position:relative;z-index:2;color:var(--white)}
.prd .modal-hero .ti .n{font-family:'Outfit',sans-serif;font-size:16px;font-weight:700;line-height:1.2}
.prd .modal-hero .ti .s{font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(255,255,255,.65);margin-top:4px}
.prd .modal-hero .x{position:absolute;top:10px;right:10px;width:30px;height:30px;border-radius:50%;background:rgba(0,0,0,.5);color:var(--white);font-size:20px;border:0;cursor:pointer;font-family:inherit;z-index:3}
.prd .modal-hero .x:hover{background:rgba(0,0,0,.7)}
.prd .modal-f{padding:14px 22px;border-top:1px solid var(--border);background:var(--bg);display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.prd .modal-f button{padding:9px 16px;font-size:12px;font-weight:700;border-radius:10px;border:0;cursor:pointer;font-family:inherit}
.prd .modal-f .cancel{background:var(--white);border:1px solid var(--border);color:var(--ink)}
.prd .modal-f .cancel:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}
.prd .modal-f .submit{background:var(--ink);color:var(--yellow)}
.prd .modal-f .submit:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}
.prd .modal-f .submit:disabled{opacity:.4;cursor:not-allowed;background:var(--ink);color:var(--yellow)}

/* Field */
.prd .field{margin-bottom:14px}
.prd .field-l{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;display:block}
.prd .field-l .req{color:var(--danger);margin-left:3px}
.prd .field-err{font-size:11px;color:var(--danger-text);margin-top:4px}
.prd .field input,.prd .field textarea,.prd .field select{width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:10px;font-size:13px;font-family:inherit;outline:none;color:var(--ink);background:var(--white);resize:vertical}
.prd .field input:focus,.prd .field textarea:focus,.prd .field select:focus{border-color:var(--yellow);box-shadow:0 0 0 3px var(--yellow-pale)}
.prd .field input.err,.prd .field textarea.err,.prd .field select.err{border-color:var(--danger);background:var(--danger-pale)}
.prd .field .veg-row{display:flex;gap:6px}
.prd .field .veg-row button{flex:1;padding:9px;border:1.5px solid var(--border);border-radius:10px;font-size:12px;font-weight:700;color:var(--muted);background:var(--white);cursor:pointer;font-family:inherit}
.prd .field .veg-row button:hover:not(:disabled){border-color:var(--muted-3);color:var(--ink);background:var(--white)}
.prd .field .veg-row button.act.veg{border-color:var(--success);background:var(--success-pale);color:var(--success-text)}
.prd .field .veg-row button.act.nonveg{border-color:var(--danger);background:var(--danger-pale);color:var(--danger-text)}
.prd .field .veg-row button.act.na{border-color:var(--muted-3);background:var(--bg2);color:var(--muted)}
.prd .field .dur-row{display:flex;flex-wrap:wrap;gap:6px}
.prd .field .dur-row button{padding:7px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:11px;font-weight:700;color:var(--muted);background:var(--white);cursor:pointer;font-family:inherit}
.prd .field .dur-row button:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}
.prd .field .dur-row button.act{border-color:var(--ink);background:var(--ink);color:var(--yellow)}
.prd .field .variant-row{display:flex;gap:6px;align-items:center;margin-bottom:6px}
.prd .field .variant-row input{flex:1}
.prd .field .variant-row input.price{width:90px;flex:0 0 auto;font-family:'JetBrains Mono',monospace}
.prd .field .variant-row button.del{width:30px;height:30px;border-radius:6px;background:transparent;color:var(--danger-text);border:0;cursor:pointer;font-size:18px;line-height:1;font-family:inherit}
.prd .field .variant-row button.del:hover:not(:disabled){background:var(--danger-pale);color:var(--danger-text)}
.prd .field .add-var{padding:6px 10px;font-size:11.5px;font-weight:700;color:var(--ink);background:transparent;border:0;cursor:pointer;font-family:inherit}
.prd .field .add-var:hover:not(:disabled){color:var(--yellow-text);background:transparent}
.prd .toggle{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-top:1px solid var(--border-soft)}
.prd .toggle-l{font-size:13px;font-weight:700;color:var(--ink)}
.prd .toggle-s{font-size:11px;color:var(--muted-2);margin-top:2px}
.prd .toggle-sw{width:44px;height:24px;background:var(--muted-3);border-radius:99px;position:relative;cursor:pointer;transition:background .15s;border:0;font-family:inherit}
.prd .toggle-sw.on{background:var(--success)}
.prd .toggle-sw .dot{position:absolute;top:2px;left:2px;width:20px;height:20px;background:var(--white);border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .15s}
.prd .toggle-sw.on .dot{transform:translateX(20px)}

/* Toast */
.prd .toast{position:fixed;top:24px;right:24px;background:var(--ink);color:var(--white);padding:12px 18px;border-radius:12px;font-size:13px;font-weight:600;z-index:100;box-shadow:0 10px 25px rgba(0,0,0,.15)}
.prd .toast.err{background:var(--danger);color:var(--white)}
`;

// ─── DynamicField (preserved field types, locked palette restyle) ───────────

function DynamicField({ field, value, onChange, error }) {
  const cls = `${error ? 'err' : ''}`;

  if (field.type === 'text' || field.type === 'url') {
    return <input type={field.type === 'url' ? 'url' : 'text'} value={value || ''} onChange={(e) => onChange(field.key, e.target.value)} placeholder={field.placeholder || ''} className={cls} />;
  }
  if (field.type === 'number') {
    return <input type="number" value={value ?? ''} onChange={(e) => onChange(field.key, e.target.value === '' ? '' : Number(e.target.value))} placeholder={field.placeholder || '0'} min={0} className={cls} />;
  }
  if (field.type === 'textarea') {
    return <textarea value={value || ''} onChange={(e) => onChange(field.key, e.target.value)} placeholder={field.placeholder || ''} rows={3} className={cls} />;
  }
  if (field.type === 'select') {
    return (
      <select value={value || ''} onChange={(e) => onChange(field.key, e.target.value)} className={cls}>
        <option value="">— Select {field.label} —</option>
        {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }
  if (field.type === 'veg_toggle') {
    return (
      <div className="veg-row">
        {[
          { v: 'veg',     l: '🟢 Veg',     c: 'veg' },
          { v: 'non_veg', l: '🔴 Non-Veg', c: 'nonveg' },
          { v: 'na',      l: '⬜ N/A',      c: 'na' },
        ].map(opt => (
          <button key={opt.v} type="button" onClick={() => onChange(field.key, opt.v)} className={value === opt.v ? `act ${opt.c}` : ''}>
            {opt.l}
          </button>
        ))}
      </div>
    );
  }
  if (field.type === 'duration_select') {
    const opts = field.options || [15, 30, 45, 60, 90, 120, 180];
    return (
      <div className="dur-row">
        {opts.map(mins => (
          <button key={mins} type="button" onClick={() => onChange(field.key, mins)} className={value === mins ? 'act' : ''}>
            {mins >= 60 ? `${Math.floor(mins/60)}h${mins%60 ? ` ${mins%60}m` : ''}` : `${mins}m`}
          </button>
        ))}
      </div>
    );
  }
  if (field.type === 'variant_builder') {
    const variants = Array.isArray(value) ? value : [];
    return (
      <div>
        {variants.map((v, i) => (
          <div key={i} className="variant-row">
            <input value={v.label || ''} onChange={(e) => { const n = [...variants]; n[i] = { ...n[i], label: e.target.value }; onChange(field.key, n); }} placeholder="Package (e.g. Full day)" />
            <input type="number" className="price" value={v.price ?? ''} onChange={(e) => { const n = [...variants]; n[i] = { ...n[i], price: Number(e.target.value) }; onChange(field.key, n); }} placeholder="₹" />
            <button type="button" className="del" onClick={() => onChange(field.key, variants.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <button type="button" className="add-var" onClick={() => onChange(field.key, [...variants, { label: '', price: 0 }])}>+ Add Package</button>
      </div>
    );
  }
  return <input type="text" value={value || ''} onChange={(e) => onChange(field.key, e.target.value)} placeholder={field.placeholder || ''} className={cls} />;
}

// ─── Modals ─────────────────────────────────────────────────────────────────

// Per-product tag picker (contract: merch-engine-p1a-product-tags).
// Fixed tags come from the admin vocabulary for this brand's business
// (GET /brands/me/tag-options); the brand may also add free tags. Selection is
// a flat list of slugs on form.tags → POST/PATCH /brands/me/products reads it.
function ProductTagPicker({ value, onChange }) {
  const tags = Array.isArray(value) ? value : [];
  const [options, setOptions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [free, setFree] = useState('');

  useEffect(() => {
    let cancelled = false;
    brandApi.getTagOptions()
      .then(res => { if (!cancelled) { if (res.success) setOptions(res.data?.options || []); setLoaded(true); } })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const optionSlugs = new Set(options.map(o => o.slug));
  const freeTags = tags.filter(t => !optionSlugs.has(t));

  function toggle(slug) {
    onChange(tags.includes(slug) ? tags.filter(t => t !== slug) : [...tags, slug]);
  }
  function slugify(raw) {
    return String(raw || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  }
  function addFree() {
    const s = slugify(free);
    if (s && !tags.includes(s)) onChange([...tags, s]);
    setFree('');
  }

  return (
    <div className="field">
      <label className="field-l">Tags (optional)</label>
      {loaded && options.length > 0 && (
        <div className="chip-row" style={{ marginBottom: 8 }}>
          {options.map(o => (
            <button type="button" key={o.slug} className={`chip${tags.includes(o.slug) ? ' act' : ''}`} onClick={() => toggle(o.slug)}>
              {o.label}
            </button>
          ))}
        </div>
      )}
      {freeTags.length > 0 && (
        <div className="chip-row" style={{ marginBottom: 8 }}>
          {freeTags.map(t => (
            <button type="button" key={t} className="chip act" style={{ borderStyle: 'dashed' }} onClick={() => onChange(tags.filter(x => x !== t))}>
              {t} ×
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={free} onChange={(e) => setFree(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFree(); } }}
          placeholder="Add your own tag…" />
        <button type="button" className="btn-ghost" onClick={addFree}>+ Add</button>
      </div>
      {loaded && options.length === 0 && (
        <p className="field-err" style={{ color: 'var(--muted-2)' }}>No preset tags for your business yet — you can still add your own above.</p>
      )}
    </div>
  );
}

function ProductFormModal({ schema, product, onSave, onClose, saving }) {
  const noun = schema?.product_noun || 'Product';
  const [form, setForm] = useState(() => {
    if (product) return { ...product };
    const d = {};
    (schema?.fields || []).forEach(f => { d[f.key] = f.default ?? ''; });
    if (schema?.features?.veg_flag) d.veg_flag = 'veg';
    return d;
  });
  const [errors, setErrors] = useState({});

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  }
  function validate() {
    const errs = {};
    (schema?.fields || []).forEach(f => {
      if (f.required && (form[f.key] == null || form[f.key] === '')) errs[f.key] = `${f.label} is required`;
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div>
            <h3>{product ? `Edit ${noun}` : `Add ${noun}`}</h3>
            {schema && <div className="s">{schema.icon} {schema.label}</div>}
          </div>
          <button className="modal-x" onClick={onClose}>×</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (validate()) onSave(form); }}>
          <div className="modal-b">
            {(schema?.fields || []).map(field => (
              <div key={field.key} className="field">
                <label className="field-l">{field.label}{field.required && <span className="req">*</span>}</label>
                <DynamicField field={field} value={form[field.key]} onChange={setField} error={errors[field.key]} />
                {errors[field.key] && <p className="field-err">{errors[field.key]}</p>}
              </div>
            ))}
            <ProductTagPicker value={form.tags} onChange={(t) => setField('tags', t)} />
            <div className="toggle">
              <div>
                <div className="toggle-l">Active</div>
                <div className="toggle-s">Show to followers</div>
              </div>
              <button type="button" className={`toggle-sw${form.is_active !== false ? ' on' : ''}`} onClick={() => setField('is_active', !form.is_active)}><span className="dot" /></button>
            </div>
            <div className="toggle">
              <div>
                <div className="toggle-l">Show in store</div>
                <div className="toggle-s">Appears in your storefront</div>
              </div>
              <button type="button" className={`toggle-sw${form.pushed_to_store !== false ? ' on' : ''}`} onClick={() => setField('pushed_to_store', form.pushed_to_store === false)}><span className="dot" /></button>
            </div>
          </div>
          <div className="modal-f">
            <button type="button" className="cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="submit" disabled={saving}>{saving ? 'Saving…' : product ? 'Save Changes' : `Add ${noun}`}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ActivateModal({ item, category, onSave, onClose, saving }) {
  const isVehicle = category === 'car_rental';
  const [price, setPrice] = useState(item.activated_price || '');
  const [packages, setPackages] = useState(() => { try { return JSON.parse(item.variants_json || '[]'); } catch { return []; } });
  const [error, setError] = useState('');

  function submit(e) {
    e.preventDefault();
    if (!price || Number(price) <= 0) { setError('Enter a valid price'); return; }
    const payload = {
      name: item.display_name || item.name,
      section: item.segment || item.category,
      price: Number(price),
      image_url: item.image_url,
      is_bookable: true,
    };
    if (isVehicle) {
      payload.master_vehicle_id = item.id;
      if (packages.length) payload.variants_json = packages;
      payload.description = `${item.seats} Seats · ${item.fuel_type} · ${item.transmission}`;
    } else {
      payload.master_service_id = item.id;
      payload.duration_mins = item.duration_mins_default;
      payload.description = item.category;
    }
    onSave(payload);
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-hero">
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt={item.display_name || item.name} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <span className="em">{SEGMENT_ICONS[item.segment || item.category] || '🚗'}</span>
          )}
          <div className="overlay" />
          <div className="ti">
            <div className="n">{item.display_name || item.name}</div>
            <div className="s">
              {isVehicle
                ? `${item.segment} · ${item.seats} seats · ${item.fuel_type} · ${item.transmission}`
                : `${item.category} · ${item.duration_mins_default} min`}
            </div>
          </div>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-b">
            <div className="field">
              <label className="field-l">{isVehicle ? 'Price per Day (₹)' : 'Starting Price (₹)'}<span className="req">*</span></label>
              <input type="number" min={1} value={price} onChange={(e) => { setPrice(e.target.value); setError(''); }} placeholder={isVehicle ? '2500' : '499'} className={error ? 'err' : ''} />
              {error && <p className="field-err">{error}</p>}
            </div>
            {isVehicle && (
              <div className="field">
                <label className="field-l">Duration Packages (optional)</label>
                {packages.map((v, i) => (
                  <div key={i} className="variant-row">
                    <input value={v.label || ''} onChange={(e) => { const n = [...packages]; n[i] = { ...n[i], label: e.target.value }; setPackages(n); }} placeholder="e.g. Half Day, Full Day" />
                    <input type="number" className="price" value={v.price ?? ''} onChange={(e) => { const n = [...packages]; n[i] = { ...n[i], price: Number(e.target.value) }; setPackages(n); }} placeholder="₹" />
                    <button type="button" className="del" onClick={() => setPackages(packages.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
                <button type="button" className="add-var" onClick={() => setPackages([...packages, { label: '', price: 0 }])}>+ Add Package</button>
              </div>
            )}
          </div>
          <div className="modal-f">
            <button type="button" className="cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="submit" disabled={saving}>{saving ? 'Adding…' : `Add to My ${isVehicle ? 'Fleet' : 'Services'}`}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditPriceModal({ item, category, productId, onSave, onClose, saving }) {
  const isVehicle = category === 'car_rental';
  const [price, setPrice] = useState(item.activated_price || '');
  const [packages, setPackages] = useState(() => { try { return JSON.parse(item.variants_json || '[]'); } catch { return []; } });

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div>
            <h3>Update Pricing</h3>
            <div className="s">{item.display_name || item.name}</div>
          </div>
          <button className="modal-x" onClick={onClose}>×</button>
        </div>
        <div className="modal-b">
          <div className="field">
            <label className="field-l">{isVehicle ? 'Price per Day (₹)' : 'Price (₹)'}</label>
            <input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          {isVehicle && (
            <div className="field">
              <label className="field-l">Duration Packages</label>
              {packages.map((v, i) => (
                <div key={i} className="variant-row">
                  <input value={v.label || ''} onChange={(e) => { const n = [...packages]; n[i] = { ...n[i], label: e.target.value }; setPackages(n); }} placeholder="Package name" />
                  <input type="number" className="price" value={v.price ?? ''} onChange={(e) => { const n = [...packages]; n[i] = { ...n[i], price: Number(e.target.value) }; setPackages(n); }} placeholder="₹" />
                  <button type="button" className="del" onClick={() => setPackages(packages.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
              <button type="button" className="add-var" onClick={() => setPackages([...packages, { label: '', price: 0 }])}>+ Add</button>
            </div>
          )}
        </div>
        <div className="modal-f">
          <button type="button" className="cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="submit" disabled={saving} onClick={() => onSave(productId, { price: Number(price), ...(isVehicle && packages.length ? { variants_json: packages } : {}) })}>{saving ? 'Saving…' : 'Update'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Master Catalogue View ──────────────────────────────────────────────────

function MasterCatalogueView({ schema, items, category, onActivate, onUpdatePrice, onDeactivate, saving }) {
  const isVehicle = category === 'car_rental';
  const groups = [...new Set(items.map(i => isVehicle ? i.segment : i.category))].filter(Boolean);
  const [tab, setTab] = useState('');
  const [activateItem, setActivateItem] = useState(null);
  const [editPriceItem, setEditPriceItem] = useState(null);

  const activated = items.filter(i => i.is_activated);
  const available = items.filter(i => !i.is_activated);
  const filtered = tab ? available.filter(i => (isVehicle ? i.segment : i.category) === tab) : available;

  return (
    <div>
      {/* MY FLEET */}
      {activated.length > 0 && (
        <>
          <div className="sec-h">
            <span className="pip" />
            {isVehicle ? 'My Fleet' : 'My Services'}
            <span className="ct">{activated.length}</span>
            <span className="right">{activated.length} of {items.length} available {isVehicle ? 'models' : 'services'} added</span>
          </div>
          <div className="pc-grid cols3">
            {activated.map(item => {
              const pkgs = (() => { try { return JSON.parse(item.variants_json || '[]'); } catch { return []; } })();
              return (
                <div key={item.id} className={`pc act${item.is_active ? '' : ' dim'}`}>
                  <div className="pc-img">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt={item.display_name || item.name} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <span className="em">{SEGMENT_ICONS[item.segment || item.category] || '🚗'}</span>
                    )}
                    <div className="overlay" />
                    <span className="label">{item.display_name || item.name}</span>
                    <span className="price">{fmtRupees(item.activated_price)}{isVehicle ? '/d' : ''}</span>
                    <span className={`live${item.is_active ? '' : ' hidden'}`}>{item.is_active ? 'Live' : 'Hidden'}</span>
                  </div>
                  <div className="pc-body">
                    <div className="pc-spec">
                      {isVehicle
                        ? <><span>🪑 {item.seats} seats</span><span>⛽ {item.fuel_type}</span><span>⚙️ {item.transmission}</span></>
                        : <><span>⏱ {item.duration_mins_default} min</span><span className="capitalize">{item.gender === 'unisex' ? '👥 Unisex' : item.gender === 'men' ? '👨 Men' : '👩 Women'}</span></>
                      }
                    </div>
                    {pkgs.length > 0 && <div className="pc-pkgs">📦 {pkgs.map(p => p.label).filter(Boolean).join(' · ') || `${pkgs.length} packages`}</div>}
                  </div>
                  <div className="pc-actions">
                    <button onClick={() => setEditPriceItem(item)}>Edit price</button>
                    <button className="del" onClick={() => onDeactivate(item.product_id)}>Remove</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* BROWSE TO ADD */}
      <div className="sec-h" style={{ marginTop: 24 }}>
        <span className="pip" />
        Browse to Add
        <span className="ct">{available.length}</span>
        <span className="right">{available.length} available · filter by {isVehicle ? 'segment' : 'category'}</span>
      </div>

      {/* Segment chips */}
      <div className="chip-row">
        <button className={`chip${!tab ? ' act' : ''}`} onClick={() => setTab('')}>All <span className="ct">{available.length}</span></button>
        {groups.map(g => {
          const cnt = available.filter(i => (isVehicle ? i.segment : i.category) === g).length;
          if (!cnt) return null;
          return (
            <button key={g} className={`chip${tab === g ? ' act' : ''}`} onClick={() => setTab(g === tab ? '' : g)}>
              {SEGMENT_ICONS[g] || ''} {g} <span className="ct">{cnt}</span>
            </button>
          );
        })}
      </div>

      {/* Master grid */}
      <div className="pc-grid">
        {filtered.map(item => (
          <div key={item.id} className="pc">
            <div className="pc-img tall">
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image_url} alt={item.display_name || item.name} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <span className="em">{SEGMENT_ICONS[item.segment || item.category] || '🚗'}</span>
              )}
              <div className="overlay" />
              <span className="topbadge">{item.segment || item.category}</span>
              <span className="label">{item.display_name || item.name}</span>
            </div>
            <div className="pc-body">
              <div className="pc-spec">
                {isVehicle
                  ? <><span>🪑 {item.seats}</span><span>⛽ {item.fuel_type}</span><span>⚙️ {item.transmission}</span></>
                  : <><span>⏱ {item.duration_mins_default} min</span><span className="capitalize">{item.gender === 'unisex' ? '👥' : item.gender === 'men' ? '👨' : '👩'} {item.gender}</span></>
                }
              </div>
            </div>
            <button className="pc-cta" onClick={() => setActivateItem(item)}>+ Add to {isVehicle ? 'Fleet' : 'Services'}</button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1' }} className="empty">
            <div className="em">✅</div>
            <div className="h">All {tab || (isVehicle ? 'vehicle' : 'service')} options added</div>
            <div className="t">Switch tabs to see other categories</div>
          </div>
        )}
      </div>

      {activateItem && <ActivateModal item={activateItem} category={category} saving={saving} onClose={() => setActivateItem(null)} onSave={async (payload) => { await onActivate(payload); setActivateItem(null); }} />}
      {editPriceItem && <EditPriceModal item={editPriceItem} category={category} productId={editPriceItem.product_id} saving={saving} onClose={() => setEditPriceItem(null)} onSave={async (pid, data) => { await onUpdatePrice(pid, data); setEditPriceItem(null); }} />}
    </div>
  );
}

// ─── Standard product row card ──────────────────────────────────────────────

function ProductRow({ product, onEdit, onDelete, onToggle, schema }) {
  const VEG = { veg: { ic: '🟢', cls: 'veg' }, non_veg: { ic: '🔴', cls: 'nonveg' }, na: { ic: '⬜', cls: 'na' } };
  const vegInfo = VEG[product.veg_flag] || null;
  const hasVariants = (() => { try { return JSON.parse(product.variants_json || '[]').length > 0; } catch { return false; } })();
  const metaBits = [];
  if (product.description) metaBits.push(product.description);
  if (product.duration_mins > 0) metaBits.push(`⏱ ${product.duration_mins >= 60 ? `${product.duration_mins/60}h` : `${product.duration_mins}m`}`);
  if (product.stock > 0) metaBits.push(`📦 Stock: ${product.stock}`);
  if (hasVariants) metaBits.push('🎛 Variants');
  if (product.is_bookable) metaBits.push('📅 Bookable');
  // product-approval-switch (M4): where the product stands with INFLX while the switch is on.
  const waiting = product.approval_status === 'pending';
  const sentBack = product.approval_status === 'rejected';

  return (
    <div className={`rc${product.is_active ? '' : ' dim'}`}>
      <div className={`rc-av${vegInfo ? ` ${vegInfo.cls}` : ''}`}>{vegInfo ? vegInfo.ic : (schema?.icon || '🏪')}</div>
      <div className="rc-mid">
        <div className="rc-top">
          <span className="rc-name">{product.name}</span>
          {product.section && <span className="rc-tag">{product.section}</span>}
          {!product.is_active && <span className="rc-tag" style={{ background: 'var(--bg2)', color: 'var(--muted)' }}>Hidden</span>}
        </div>
        <div className="rc-meta">
          {sentBack
            ? <span style={{ color: '#C42B2B' }}>INFLX: {product.approval_note || 'not approved'} — fix it, then show it in your store to send it again.</span>
            : waiting ? 'It goes live in your store once INFLX approves it.' : (metaBits.join(' · ') || '—')}
        </div>
      </div>
      <div className="rc-price">{product.price != null ? fmtRupees(product.price) : '—'}<span className="l">price</span></div>
      {waiting ? (
        <span className="status-pill" style={{ background: '#E6EEFF', color: '#1B4FB3' }} data-testid="pill-waiting">● Waiting for INFLX approval</span>
      ) : sentBack ? (
        <span className="status-pill" style={{ background: '#FDE8E8', color: '#C42B2B' }} data-testid="pill-sent-back">● Sent back</span>
      ) : (
        <span className={`status-pill ${product.is_active ? 'live' : 'hidden'}`}>● {product.is_active ? 'Live' : 'Hidden'}</span>
      )}
      <div className="rc-action">
        <button onClick={() => onEdit(product)}>Edit</button>
        <button onClick={() => onToggle(product)}>{product.is_active ? 'Hide' : 'Show'}</button>
        <button className="danger" onClick={() => onDelete(product)}>Del</button>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const router = useRouter();
  const [useListingWizard, setUseListingWizard] = useState(null);
  const [schema,    setSchema]    = useState(null);
  const [products,  setProducts]  = useState([]);
  const [catalogue, setCatalogue] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [toast,     setToast]     = useState(null);
  const [section,   setSection]   = useState('');
  const { quota, showFromResponse, show: showQuota, close: closeQuota } = useQuotaWall();
  const [preflighting, setPreflighting] = useState(false);

  // Sub-tabs: Products (existing catalogue) + Offers (folded library, E-3).
  const [subTab, setSubTab] = useState('products'); // 'products' | 'offers'
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'offers') setSubTab('offers');
  }, []);

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  // Phase A12.1.5 — preflight on the "+ Add product" entry click so the
  // upgrade popup fires BEFORE the brand opens the add-product modal.
  const openCreateProduct = useCallback(async () => {
    if (preflighting) return;
    setPreflighting(true);
    try {
      const pf = await brandApi.quotaPreflight('createProduct');
      if (pf?.success !== false && pf?.data?.would_block) {
        showQuota({
          action:       pf.data.action,
          used:         pf.data.used,
          limit:        pf.data.limit,
          current_tier: pf.data.current_tier,
          upgrade_to:   pf.data.upgrade_to || [],
          message:      `You've listed ${pf.data.used} of ${pf.data.limit} products on the ${pf.data.current_tier?.toUpperCase()} plan. Upgrade to add more.`,
        });
        return;
      }
      setModal('add');
    } catch (e) {
      // Fail-open: open the modal so transient API hiccups don't block
      // the brand; the submit will hit the real gate.
      setModal('add');
    } finally {
      setPreflighting(false);
    }
  }, [preflighting, showQuota]);

  // Feature-flag check
  useEffect(() => {
    async function checkListingEngine() {
      try {
        const res = await brandApi.get('/brands/me/listing-config');
        setUseListingWizard(!!(res.success && res.data?.listing_engine_active));
      } catch { setUseListingWizard(false); }
    }
    checkListingEngine();
  }, []);

  // Drill-down verticals (fashion/furniture): the Listings HOME is the
  // drill-down page (Inventory · Add products · Offers) — ALWAYS, setup done
  // or not (contract: listing-home-consolidation). This page remains only the
  // store-setup surface, reached via "⚙ Store setup" (?setup=1) or the setup
  // banner on the listing page. Deliberately independent of the listing-engine
  // flag — a phase-gated schema (furniture was coming_soon) must not fall back
  // to the old flat products page.
  useEffect(() => {
    // ?setup=1 → always stay to show/edit store-setup.
    let wantOffers = false;
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('setup') === '1') return;
      wantOffers = sp.get('tab') === 'offers';   // forward legacy deep link
    }
    let cancelled = false;
    brandApi.get('/brands/me/listing-config').then((res) => {
      if (cancelled || !res?.success) return;
      const cat = res.data?.config?.category_key || res.data?.category;
      if (!cat || !DRILLDOWN_VERTICALS.has(cat)) return;
      router.replace(`/dashboard/products/listing${wantOffers ? '?tab=offers' : ''}`);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const isMasterCatalogue = schema?.features?.master_catalogue === true;
  const category = catalogue?.category || (schema?.category_key);

  async function load() {
    const [schemaRes, prodRes] = await Promise.all([brandApi.getSchema(), brandApi.getProducts()]);
    if (schemaRes.success) setSchema(schemaRes.data?.schema);
    if (prodRes.success)   setProducts(prodRes.data?.products || []);
    const sch = schemaRes.data?.schema;
    if (sch?.features?.master_catalogue) {
      const catRes = await brandApi.getMasterCatalogue();
      if (catRes.success) setCatalogue(catRes.data);
    }
    setLoading(false);
  }

  useEffect(() => { if (useListingWizard === false) load(); }, [useListingWizard]);

  // ── Listing engine pass-through (PRESERVED VERBATIM in spirit; lightly restyled wrapper) ──
  if (useListingWizard === true) {
    return (
      <div className="prd">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="hdr">
          <div className="hdr-l">
            <span className="cnt-chip">Listing setup</span>
            <h1>Complete Your Listing</h1>
            <div className="rule" />
            <div className="sub">Finish your store listing to attract followers and start showing up in influencer searches.</div>
          </div>
        </div>
        <ListingWizard />
      </div>
    );
  }
  if (useListingWizard === null) {
    return (
      <div className="prd">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="spinner" />
      </div>
    );
  }

  // ── Handlers (standard) ──
  async function handleSave(form) {
    setSaving(true);
    const isEdit = modal && modal !== 'add';
    const res = isEdit ? await brandApi.updateProduct(modal.id, form) : await brandApi.createProduct(form);
    setSaving(false);
    if (res.success) { showToast(isEdit ? 'Updated!' : 'Added!'); setModal(null); load(); return; }
    if (showFromResponse(res)) { setModal(null); return; }
    showToast(res.error?.message || 'Failed to save', 'err');
  }
  async function handleDelete(product) {
    if (!confirm(`Delete "${product.name}"?`)) return;
    const res = await brandApi.deleteProduct(product.id);
    if (res.success) { showToast('Deleted'); load(); }
    else showToast(res.error?.message || 'Delete failed', 'err');
  }
  async function handleToggle(product) {
    const res = await brandApi.updateProduct(product.id, { is_active: !product.is_active });
    if (res.success) load();
    else showToast('Failed to update', 'err');
  }
  async function handleActivate(payload) {
    setSaving(true);
    const res = await brandApi.createProduct(payload);
    setSaving(false);
    if (res.success) { showToast('Added to your listing!'); load(); return; }
    if (showFromResponse(res)) return;
    showToast(res.error?.message || 'Failed to add', 'err');
  }
  async function handleUpdatePrice(pid, data) {
    setSaving(true);
    const res = await brandApi.updateProduct(pid, data);
    setSaving(false);
    if (res.success) { showToast('Pricing updated!'); load(); }
    else showToast(res.error?.message || 'Failed to update', 'err');
  }
  async function handleDeactivate(pid) {
    if (!confirm('Remove this from your listing?')) return;
    const res = await brandApi.deleteProduct(pid);
    if (res.success) { showToast('Removed'); load(); }
    else showToast(res.error?.message || 'Failed to remove', 'err');
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="prd">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="skel-grid">
          {[1,2,3,4,5,6].map(i => <div key={i} className="skel" />)}
        </div>
      </div>
    );
  }

  const noun       = schema?.product_noun        || 'Product';
  const nounPlural = schema?.product_noun_plural || 'Products';
  const icon       = schema?.icon                || '🏪';
  const sections   = schema?.sections            || [];
  const isEnquiry  = schema?.features?.enquiry_only;

  const filtered    = section ? products.filter(p => p.section === section) : products;
  const activeCount = (isMasterCatalogue ? (catalogue?.items || []).filter(i => i.is_activated) : products.filter(p => p.is_active)).length;
  const totalCount  = isMasterCatalogue ? (catalogue?.items || []).filter(i => i.is_activated).length : products.length;

  const cntChip = isMasterCatalogue
    ? `${activeCount} active in ${category === 'car_rental' ? 'fleet' : 'services'}`
    : `${activeCount} active of ${totalCount}`;

  return (
    <div className="prd">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Toast */}
      {toast && <div className={`toast${toast.type === 'err' ? ' err' : ''}`}>{toast.type === 'err' ? '✗' : '✓'} {toast.msg}</div>}

      {/* Sub-tabs: Products (catalogue) / Offers (folded library, E-3) */}
      <div className="subtabs">
        <button className={`subtab${subTab === 'products' ? ' act' : ''}`} onClick={() => setSubTab('products')}>Products</button>
        <button className={`subtab${subTab === 'offers' ? ' act' : ''}`} onClick={() => setSubTab('offers')}>Offers</button>
      </div>

      {subTab === 'offers' ? (
        <OffersLibrary />
      ) : (
      <>
      {/* Header */}
      <div className="hdr">
        <div className="hdr-l">
          <span className="cnt-chip">{cntChip}</span>
          <h1>{icon} {nounPlural}</h1>
          <div className="rule" />
          <div className="sub">{isMasterCatalogue
            ? `Add ${category === 'car_rental' ? 'vehicles' : 'services'} from the master catalogue to your bookable listing. Pricing per ${category === 'car_rental' ? 'day' : 'service'}.`
            : `Items shown to followers when they tap your store link from an influencer's recommendation.`}</div>
        </div>
        {!isMasterCatalogue && !isEnquiry && (
          <button className="btn-ink" onClick={openCreateProduct} disabled={preflighting}>{preflighting ? 'Checking…' : `+ Add ${noun}`}</button>
        )}
      </div>

      {/* INK schema info bar */}
      {schema && (
        <div className="info-bar">
          <div className="ti"><span className="em">{icon}</span>{schema.label}</div>
          <div className="meta">
            {schema.availing_modes?.length > 0 && (
              <span>🛒 {schema.availing_modes.flatMap((m, i) => i === 0 ? [<b key={m}>{m}</b>] : [' · ', <b key={m}>{m}</b>])}</span>
            )}
            {schema.features?.booking && <span>📅 <b>{schema.booking_type}</b> booking</span>}
          </div>
          {isMasterCatalogue && <span className="badge">✦ Professional catalogue</span>}
        </div>
      )}

      {/* Enquiry-only notice */}
      {isEnquiry && (
        <div className="enq-notice">
          <span className="em">📋</span>
          <div>
            <h4>This category uses enquiry forms only</h4>
            <p>Followers see a structured enquiry form. Leads appear in your Enquiries tab. You can still add packages below.</p>
          </div>
        </div>
      )}

      {/* MASTER CATALOGUE */}
      {isMasterCatalogue && catalogue && (
        <MasterCatalogueView
          schema={schema}
          items={catalogue.items || []}
          category={catalogue.category}
          saving={saving}
          onActivate={handleActivate}
          onUpdatePrice={handleUpdatePrice}
          onDeactivate={handleDeactivate}
        />
      )}

      {/* STANDARD VIEW */}
      {!isMasterCatalogue && (
        <>
          {/* Section chips */}
          {sections.length > 0 && (
            <div className="chip-row">
              <button className={`chip${!section ? ' act' : ''}`} onClick={() => setSection('')}>All <span className="ct">{products.length}</span></button>
              {sections.map(s => {
                const cnt = products.filter(p => p.section === s).length;
                return (
                  <button key={s} className={`chip${section === s ? ' act' : ''}`} onClick={() => setSection(s === section ? '' : s)}>
                    {s} {cnt > 0 && <span className="ct">{cnt}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="empty">
              <div className="em">{icon}</div>
              <div className="h">No {nounPlural.toLowerCase()} yet</div>
              <div className="t">Add your first {noun.toLowerCase()} to show it on your store.</div>
              {!isEnquiry && <button className="btn-ink" onClick={openCreateProduct} disabled={preflighting}>{preflighting ? 'Checking…' : `+ Add ${noun}`}</button>}
            </div>
          ) : (
            <div>
              {filtered.map(product => (
                <ProductRow key={product.id} product={product} schema={schema} onEdit={setModal} onDelete={handleDelete} onToggle={handleToggle} />
              ))}
              {!isEnquiry && (
                <button className="add-card" onClick={openCreateProduct} disabled={preflighting}>
                  <span className="em">+</span>
                  <span className="t">{preflighting ? 'Checking…' : `Add ${noun}`}</span>
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ProductFormModal (standard view) */}
      {modal && !isMasterCatalogue && (
        <ProductFormModal
          schema={schema}
          product={modal !== 'add' ? modal : null}
          saving={saving}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
      </>
      )}

      <QuotaWallModal quota={quota} onClose={closeQuota} />
    </div>
  );
}
