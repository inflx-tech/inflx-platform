// The offer screens' look — the locked board's web palette (ink + yellow, the Listings scope).
// Contract: features/offer-builder-v2 · mockup offer-builder-v2-mockups-v1.html (O1–O13).
// Scoped under .ofx so it never clashes with .lst / .prd / .ofl.
export const OFX_CSS = `
.ofx *{box-sizing:border-box}
.ofx{--white:#fff;--bg:#FAFAFA;--bg2:#F4F4F5;--ink:#0A0A0A;--ink2:#1F1F22;--muted:#52525B;--muted2:#71717A;--muted3:#A1A1AA;
  --border:#E4E4E7;--yellow:#FFC107;--yellow-pale:#FFF7CC;--yellow-text:#6B5A00;
  --ok-fg:#047857;--ok-bg:#D1FAE5;--warn-fg:#C2410C;--warn-bg:#FFF7ED;--no-fg:#C42B2B;--no-bg:#FDE8E8;
  --wait-fg:#1D5FBF;--wait-bg:#E6EFFC;--ended-fg:#55544D;--ended-bg:#EFEFEA;
  font-family:'Plus Jakarta Sans','Outfit',system-ui,sans-serif;color:var(--ink);font-size:13px;line-height:1.45}
.ofx h3{font-family:'Outfit',sans-serif;font-size:22px;font-weight:700;letter-spacing:-.4px;margin:0}
.ofx h4{margin:0;font-size:13.5px}
.ofx .sub{color:var(--muted);font-size:12.5px;margin-top:2px}
.ofx .page{display:grid;gap:14px;align-content:start;max-width:1180px}
.ofx .hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap}
.ofx .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 14px;border-radius:10px;font-size:12.5px;font-weight:700;border:0;font-family:inherit;white-space:nowrap;cursor:pointer;text-decoration:none}
.ofx .btn-ink{background:var(--ink);color:var(--yellow)}
.ofx .btn-yellow{background:var(--yellow);color:var(--ink)}
.ofx .btn-ghost{background:#fff;border:1px solid var(--border);color:var(--ink)}
.ofx .btn-danger{background:#fff;border:1px solid #F3C7C7;color:var(--no-fg)}
.ofx .btn-sm{padding:5px 10px;font-size:11.5px}
.ofx .btn:disabled{opacity:.45;cursor:not-allowed}
.ofx .link{background:none;border:0;padding:0;color:var(--muted);font:inherit;font-size:12.5px;cursor:pointer;text-decoration:none}
.ofx .toolbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.ofx .inp{border:1px solid var(--border);background:#fff;border-radius:9px;padding:7px 10px;font-size:12.5px;color:var(--ink);font-family:inherit;min-width:0}
.ofx .inp:focus{outline:none;border-color:var(--ink);box-shadow:0 0 0 3px var(--yellow-pale)}
.ofx .inp.w{flex:1;min-width:180px}
.ofx .inp.err{border-color:var(--no-fg)}
.ofx .chip{padding:5px 11px;border-radius:99px;background:#fff;border:1px solid var(--border);font-size:11.5px;font-weight:700;color:var(--muted);white-space:nowrap;display:inline-flex;gap:5px;align-items:center;cursor:pointer;font-family:inherit}
.ofx .chip.act{background:var(--ink);border-color:var(--ink);color:var(--yellow)}
.ofx .chip .n{font-family:'JetBrains Mono',monospace;font-size:10.5px;opacity:.8}
.ofx .tbl{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden}
.ofx .tbl th{font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted2);text-align:left;padding:8px 10px;background:var(--bg2);font-weight:700}
.ofx .tbl td{padding:9px 10px;border-top:1px solid var(--border);vertical-align:middle}
.ofx .tbl td b{font-size:12.5px}
.ofx .tbl .r{text-align:right}
.ofx .tblwrap{overflow-x:auto}
.ofx .st{display:inline-flex;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:99px;white-space:nowrap}
.ofx .st.live{background:var(--ok-bg);color:var(--ok-fg)}
.ofx .st.scheduled{background:var(--wait-bg);color:var(--wait-fg)}
.ofx .st.draft{background:var(--warn-bg);color:var(--warn-fg)}
.ofx .st.ended{background:var(--ended-bg);color:var(--ended-fg)}
.ofx .st.lock{background:var(--bg2);color:var(--muted)}
.ofx .mono{font-family:'JetBrains Mono',ui-monospace,monospace}
.ofx .mut{color:var(--muted)} .ofx .mut2{color:var(--muted2)}
.ofx .xs{font-size:11px} .ofx .sm{font-size:12px}
.ofx .row{display:flex;align-items:center;gap:8px}
.ofx .between{justify-content:space-between}
.ofx .wrapx{flex-wrap:wrap}
.ofx .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ofx .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.ofx .card{background:#fff;border:1px solid var(--border);border-radius:12px;padding:12px 14px;display:grid;gap:8px;align-content:start}
.ofx button.card{text-align:left;font:inherit;color:inherit;cursor:pointer}
.ofx .card.sel{border:2px solid var(--ink);padding:11px 13px}
.ofx .card.tint{background:var(--bg2);border-color:transparent}
.ofx .card.warnbox{background:var(--warn-bg);border-color:#FED7AA}
.ofx .card.nobox{background:var(--no-bg);border-color:#F3C7C7}
.ofx .card.okbox{background:#F0FDF4;border-color:#BBF7D0}
.ofx .lbl{font-weight:700;font-size:12px}
.ofx .hint{font-size:11.5px;color:var(--muted2)}
.ofx .err{font-size:11.5px;color:var(--no-fg);font-weight:700}
.ofx .okt{font-size:11.5px;color:var(--ok-fg);font-weight:700}
.ofx .wrn{font-size:11.5px;color:var(--warn-fg);font-weight:700}
.ofx .field{display:grid;gap:4px}
.ofx .big{font-family:'Outfit',sans-serif;font-size:20px;font-weight:800}
.ofx .ico{font-size:18px;width:34px;height:34px;border-radius:10px;background:var(--bg2);display:grid;place-items:center;flex:none}
.ofx .radio{width:14px;height:14px;border-radius:50%;border:2px solid var(--muted3);flex:none;display:inline-block}
.ofx .radio.on{border:4px solid var(--ink)}
.ofx input[type=checkbox]{accent-color:#0A0A0A;width:14px;height:14px}
.ofx .steps{display:flex;gap:4px;flex-wrap:wrap}
.ofx .steps button{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:var(--muted3);padding:5px 10px 5px 5px;border-radius:99px;background:#fff;border:1px solid var(--border);font-family:inherit;cursor:pointer}
.ofx .steps button:disabled{cursor:default}
.ofx .steps i{font-style:normal;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;background:var(--bg2);font-size:10.5px}
.ofx .steps .done{color:var(--muted)} .ofx .steps .done i{background:var(--ok-bg);color:var(--ok-fg)}
.ofx .steps .now{color:var(--ink);border-color:var(--ink)} .ofx .steps .now i{background:var(--ink);color:var(--yellow)}
.ofx .foot{display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border);padding-top:12px;gap:8px;flex-wrap:wrap}
.ofx .pool{display:grid;grid-template-columns:1.35fr 1fr;gap:14px;align-items:start}
.ofx .method{display:grid;gap:8px;min-width:0}
.ofx .mtabs{display:flex;gap:4px;background:var(--bg2);padding:3px;border-radius:10px;width:max-content;max-width:100%;flex-wrap:wrap}
.ofx .mtabs button{padding:5px 11px;border-radius:8px;font-size:11.5px;font-weight:700;color:var(--muted);border:0;background:none;font-family:inherit;cursor:pointer}
.ofx .mtabs button.act{background:#fff;color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.ofx .crumb{font-size:12px;color:var(--muted);display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.ofx .crumb button{background:none;border:0;padding:0;font:inherit;color:var(--muted);cursor:pointer}
.ofx .crumb b{color:var(--ink)}
.ofx .plist{background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden;max-height:420px;overflow-y:auto}
.ofx .prow{display:flex;align-items:center;gap:9px;padding:8px 10px;border-top:1px solid var(--border);font-size:12px}
.ofx .prow:first-child{border-top:0}
.ofx .prow .th{width:30px;height:30px;border-radius:7px;background:linear-gradient(135deg,#E4E4E7,#F4F4F5);flex:none;object-fit:cover}
.ofx .prow .t{flex:1;min-width:0;display:grid}
.ofx .prow .t b{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ofx .prow.locked{background:#FAFAFA}
.ofx .prow.locked b{color:var(--muted2)}
.ofx .prow.node{cursor:pointer}
.ofx .prow.node:hover{background:var(--bg)}
.ofx .tray{background:#fff;border:1px solid var(--border);border-radius:12px;padding:12px;display:grid;gap:10px;align-content:start}
.ofx .tray .n{font-family:'Outfit',sans-serif;font-size:28px;font-weight:800;line-height:1}
.ofx .srcrow{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;padding:8px 10px;background:var(--bg2);border-radius:9px;font-size:12px}
.ofx .srcrow .x{color:var(--muted3);font-weight:800;background:none;border:0;cursor:pointer;font-size:14px;line-height:1}
.ofx .or{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--muted2);text-align:center;letter-spacing:.1em}
.ofx .andpill{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;color:var(--muted2);padding:0 2px}
.ofx .tiers{display:grid;gap:6px}
.ofx .tier{display:grid;grid-template-columns:auto 1fr auto 1fr auto;gap:6px;align-items:center;font-size:12px}
.ofx .chk{display:grid;gap:5px;font-size:12px}
.ofx .chk div{display:flex;gap:7px;align-items:flex-start}
.ofx .chk .ok::before{content:"✓";color:var(--ok-fg);font-weight:800}
.ofx .chk .no::before{content:"✕";color:var(--no-fg);font-weight:800}
.ofx .dimbg{position:fixed;inset:0;background:rgba(10,10,10,.35);display:grid;place-items:center;padding:16px;z-index:60}
.ofx .dlg{background:#fff;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.18);border:1px solid var(--border);padding:16px 18px;display:grid;gap:10px;width:100%;max-width:560px;max-height:90vh;overflow:auto}
.ofx .dlg h4{font-size:16px}
.ofx .toast{position:fixed;right:18px;bottom:18px;z-index:70;background:var(--ink);color:#fff;border-radius:12px;padding:10px 14px;font-weight:700;font-size:12.5px;max-width:420px}
.ofx .toast.err{background:var(--no-fg);color:#fff}
.ofx .skel{background:linear-gradient(90deg,#EFEFEA 0%,#F7F7F4 50%,#EFEFEA 100%);background-size:200% 100%;border-radius:8px;animation:ofxsh 1.4s ease-in-out infinite;height:14px}
@keyframes ofxsh{0%{background-position:100% 0}100%{background-position:-100% 0}}
@media (prefers-reduced-motion: reduce){.ofx .skel{animation:none}}
.ofx .empty{border:1.5px dashed var(--border);border-radius:14px;padding:22px 14px;display:grid;gap:8px;justify-items:center;text-align:center;background:#fff}
/* Inside Listings (.lst) the page's own .hint / .err / .btn / .chip rules would win on order;
   these keep the offer screens looking like the board wherever they're mounted. */
.lst .ofx .hint{font-size:11.5px;color:var(--muted2);font-weight:400;text-align:left;margin-top:0}
.lst .ofx .err{background:none;border:0;padding:0;margin:0;font-size:11.5px;color:var(--no-fg);font-weight:700}
.lst .ofx .btn{padding:8px 14px;border-radius:10px;font-size:12.5px;font-weight:700}
.lst .ofx .btn-sm{padding:5px 10px;font-size:11.5px}
.lst .ofx .chip{padding:5px 11px;font-size:11.5px;font-weight:700;color:var(--muted)}
.lst .ofx .chip.act{color:var(--yellow)}
@media (max-width:860px){
  .ofx .pool,.ofx .grid2,.ofx .grid3{grid-template-columns:1fr}
  .ofx .tbl{display:block;overflow-x:auto}
}
`;
