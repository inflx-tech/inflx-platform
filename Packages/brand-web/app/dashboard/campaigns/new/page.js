'use client';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { campaignApi, brandApi, influencerApi, creatorInvitationApi, fmtNum } from '../../../../lib/api';
import GalleryPicker from '../../gallery/components/GalleryPicker';

// ─── Creator response mapper (preserved verbatim) ────────────────────────────
function mapCreator(c) {
  const isUnclaimed = c.source === 'scraped' && !c.linked_influencer_id;
  return {
    id:               c.linked_influencer_id || c.row_id,
    instagram_handle: c.ig_handle,
    full_name:        c.full_name,
    niche:            c.niche ? [c.niche] : [],
    secondary_niche:  c.sub_niche ? [c.sub_niche] : [],
    tier:             c.tier,
    city:             c.city,
    followers_count:  c.followers_count,
    engagement_rate:  c.view_based_er,
    profile_image_url: c.profile_pic_url,
    source:           c.source,
    row_id:           c.row_id,
    ig_handle:        c.ig_handle,
    linked_influencer_id: c.linked_influencer_id,
    is_inflx_verified: !!c.is_inflx_verified,
    is_unclaimed:     isUnclaimed,
  };
}

// ─── Constants (preserved verbatim) ──────────────────────────────────────────
const FORMATS = ['Instagram reel', 'Instagram stories', 'Instagram post', 'YouTube short', 'YouTube video'];
const NICHES   = ['Food','Fashion','Fitness','Travel','Lifestyle','Beauty','Tech','Gaming','Finance','Parenting'];
const CITIES   = ['Mumbai','Delhi','Bengaluru','Hyderabad','Chennai','Vijayawada','Pune','Kolkata','Jaipur','Ahmedabad'];
const TIERS    = [{key:'nano',label:'Nano',sub:'1K–10K'},{key:'micro',label:'Micro',sub:'10K–100K'},{key:'macro',label:'Macro',sub:'100K–1M'},{key:'mega',label:'Mega',sub:'1M+'}];
const OFFER_TYPES = ['Discount','Volume discount','BOGO','Bundle','Free gift'];
const LANGUAGES = ['English','Hindi','Telugu','Tamil','Kannada','Malayalam','Marathi','Bengali','Gujarati','Punjabi','Urdu'];
const GENDERS = [{key:'male',label:'Male'},{key:'female',label:'Female'},{key:'non_binary',label:'Non-binary'}];

// ─── Influencer groups localStorage (preserved verbatim) ────────────────────
const GROUPS_KEY = 'inflx_influencer_groups';
function loadGroups() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]'); } catch { return []; }
}
function saveGroups(groups) {
  if (typeof window !== 'undefined') localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
}

// ─── Helpers (preserved verbatim) ────────────────────────────────────────────
const needsBudget = g => g === 'engagement' || g === 'hybrid';
const needsCoupon = g => g === 'conversion' || g === 'hybrid';
const needsOffer  = g => g === 'conversion' || g === 'hybrid';
const fmtN = n => Number(n || 0).toLocaleString('en-IN');
const calcDeadline = dt => {
  if (!dt) return null;
  const d = new Date(dt + 'T00:00:00'); d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};
const autoCode = (prefix, name) => `${(prefix || 'CODE').toUpperCase()}_${(name || 'INF').split(' ')[0].toUpperCase()}`;
const mkInf = () => ({
  influencer_id: null, name: '', handle: '', init: '',
  post_date: '', influencer_budget: '', offer_type: '',
  d_sub: 'pct', d_val: '', d_prods: [], d_scope: 'store', d_category: '',
  v_prods: [], v_tiers: [{min_spend:'', pct_off:''}], v_scope: 'store', v_category: '',
  bogo_buy: null, bogo_get: null,
  bnd_prods: [], bnd_price: '',
  gift_offers: [{ main: null, gift: null }],
  commission_pct: '', physical_delivery: false,
  delivery_address: '', custom_code: '', edit_code: false,
  backendId: null,
});
const mkGroup = () => ({
  tiers: [], niches: [], cities: [], min_er: '', gender: '',
  max_cap: '10', per_influencer_budget: '',
  offer_type: '', d_sub: 'pct', d_val: '', d_prods: [], d_scope: 'store', d_category: '',
  v_prods: [], v_tiers: [{min_spend:'', pct_off:''}], v_scope: 'store', v_category: '',
  bogo_buy: null, bogo_get: null, bnd_prods: [], bnd_price: '',
  gift_offers: [{ main: null, gift: null }],
  commission_pct: '', physical_delivery: false,
});
const mkSet = (idx) => ({
  _id: Date.now() + idx,
  backendId: null,
  name: `Set ${String.fromCharCode(65 + idx)}`,
  goal: '', influencer_mode: 'handpick',
  window_start: '', window_end: '',
  set_budget: '', brief: '', coupon_prefix: '',
  formats: [], assets: [],
  influencers: [], group: mkGroup(),
  inf_query: '',
});

// ─── Locked wave2 palette CSS ────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700;800&display=swap');
.cc *,.cc *::before,.cc *::after{box-sizing:border-box}
.cc{
  --white:#FFFFFF; --bg:#FAFAFA; --bg2:#F4F4F5;
  --yellow:#FFC107; --yellow-hover:#E0A800; --yellow-pale:#FFF7CC; --yellow-50:#FFFDEB; --yellow-text:#6B5A00;
  --ink:#0A0A0A; --ink-2:#1F1F22;
  --muted:#52525B; --muted-2:#71717A; --muted-3:#A1A1AA; --muted-4:#D4D4D8;
  --border:#E4E4E7; --border-soft:#F4F4F5;
  --success:#10B981; --success-pale:#D1FAE5; --success-text:#047857;
  --danger:#E8401A; --danger-pale:#FDEEE9; --danger-text:#B91C1C;
  --conv:#7E22CE; --conv-pale:#F3E8FF;
  --eng:#0E7490; --eng-pale:#CFFAFE;
  --hyb:#6B5A00; --hyb-pale:#FFF7CC;
  font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:var(--bg);color:var(--ink);font-size:13px;line-height:1.45;-webkit-font-smoothing:antialiased;min-height:100vh;
}
.cc a{color:inherit;text-decoration:none}
.cc button{font:inherit;cursor:pointer;border:0;background:none;color:inherit}
.mono{font-family:'JetBrains Mono',monospace}
.display{font-family:'Outfit',sans-serif}
.hide{display:none !important}

/* topbar */
.tb{display:flex;align-items:center;justify-content:space-between;padding:14px 26px;background:var(--ink);color:var(--white)}
.tb-logo{display:inline-flex;align-items:center;justify-content:center;padding:6px 12px;border:1px dashed var(--yellow);border-radius:6px;font-family:'JetBrains Mono';font-size:10px;font-weight:800;color:var(--yellow);letter-spacing:.4px}
.tb-steps{display:flex;align-items:center;gap:8px}
.ms{display:flex;align-items:center;padding:6px 13px;border-radius:99px;font-size:11px;font-weight:700;color:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.12);letter-spacing:.2px}
.ms.done{color:var(--success);background:rgba(16,185,129,.12);border-color:rgba(16,185,129,.3)}
.ms.act{color:var(--ink);background:var(--yellow);border-color:var(--yellow)}
.ms-line{width:32px;height:1.5px;background:rgba(255,255,255,.15);border-radius:99px}
.ms-line.done{background:var(--success)}
.tb-exit{font-size:11.5px;font-weight:700;color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.15);border-radius:99px;padding:6px 14px}
.tb-exit:hover{color:var(--white);border-color:rgba(255,255,255,.3)}

/* shell */
.shell{display:grid;grid-template-columns:260px 1fr 340px;background:var(--bg);min-height:calc(100vh - 60px)}
.col{padding:24px 22px;overflow-y:auto}
.col-l{border-right:1px solid var(--border);background:var(--white)}
.col-r{border-left:1px solid var(--border);background:var(--white)}
.col-c{padding:32px 40px;background:var(--bg)}
@media (max-width:1200px){.shell{grid-template-columns:240px 1fr 300px}}
@media (max-width:1000px){.shell{grid-template-columns:1fr}.col-l,.col-r{border:0;border-top:1px solid var(--border)}}

/* rails */
.rl{font-family:'JetBrains Mono';font-size:10px;font-weight:800;color:var(--muted-2);letter-spacing:.5px;text-transform:uppercase;margin:0 0 12px 4px}
.rl:not(:first-child){margin-top:24px}
.sub{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;font-size:12.5px;font-weight:600;color:var(--muted-2);cursor:pointer;border:1px solid transparent;margin-bottom:3px;transition:all .15s}
.sub:hover{background:var(--bg);color:var(--ink)}
.sub.act{background:var(--yellow-50);border-color:var(--yellow);color:var(--ink);font-weight:700}
.sub.done{color:var(--success-text)}
.sub.locked{opacity:.45;cursor:not-allowed}
.sub-idx{width:22px;height:22px;border-radius:50%;background:var(--bg2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono';font-size:10.5px;font-weight:800;color:var(--muted);flex-shrink:0}
.sub.act .sub-idx{background:var(--ink);border-color:var(--ink);color:var(--yellow)}
.sub.done .sub-idx{background:var(--success);border-color:var(--success);color:var(--white)}
.sub.done .sub-idx::before{content:'✓';font-size:11px}
.sub.done .sub-idx-num{display:none}

.sc{border:1px solid var(--border);border-radius:12px;padding:11px 13px;background:var(--bg);margin-bottom:6px;cursor:pointer;transition:all .15s}
.sc.act{border-color:var(--ink);background:var(--yellow-50)}
.sc:hover:not(.act){border-color:var(--muted-3)}
.sc-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;gap:6px}
.sc-name{font-family:'Outfit';font-size:12.5px;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.sc-pill{font-size:9px;font-weight:800;padding:2px 7px;border-radius:99px;text-transform:uppercase;letter-spacing:.3px;flex-shrink:0}
.sc-pill.conv{background:var(--conv-pale);color:var(--conv)}
.sc-pill.eng{background:var(--eng-pale);color:var(--eng)}
.sc-pill.hyb{background:var(--hyb-pale);color:var(--hyb)}
.sc-pill.draft{background:var(--bg2);color:var(--muted-2)}
.sc-meta{font-size:10.5px;color:var(--muted-2);font-family:'JetBrains Mono'}
.sc-del{padding:2px 6px;color:var(--muted-3);font-weight:800;font-size:11px}
.sc-del:hover{color:var(--danger-text)}
.add-set{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:10px;border:1.5px dashed var(--border);border-radius:12px;color:var(--muted-2);font-size:11.5px;font-weight:700;background:transparent;margin-top:6px}
.add-set:hover{border-color:var(--ink);color:var(--ink);background:var(--yellow-50)}
.rn{font-size:10.5px;color:var(--muted-2);line-height:1.5;margin-top:10px;padding:0 4px}

/* center */
.cc h1{font-family:'Outfit';font-size:26px;font-weight:700;color:var(--ink);letter-spacing:-.5px;margin-bottom:6px}
.cc .subh{font-size:13px;color:var(--muted);line-height:1.65;margin-bottom:26px;max-width:680px}
.sh-tag{display:inline-block;font-family:'JetBrains Mono';font-size:10.5px;font-weight:800;color:var(--yellow-text);background:var(--yellow-pale);padding:3px 9px;border-radius:99px;letter-spacing:.4px;margin-bottom:10px;text-transform:uppercase}
.sh-tag.green{color:var(--success-text);background:var(--success-pale)}

/* cards / section */
.card{background:var(--white);border:1px solid var(--border);border-radius:16px;padding:20px 22px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.card h3{font-family:'Outfit';font-size:14px;font-weight:700;color:var(--ink);margin-bottom:3px}
.card .sh{font-size:11.5px;color:var(--muted-2);margin-bottom:16px;line-height:1.5}

/* forms */
.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px 18px;margin-bottom:4px}
.g1{display:grid;grid-template-columns:1fr;gap:14px;margin-bottom:4px}
.f{display:flex;flex-direction:column}
.flbl{font-size:11px;font-weight:700;color:var(--ink);margin-bottom:6px;letter-spacing:.1px}
.flbl .opt{color:var(--muted-2);font-weight:500;font-size:10.5px;margin-left:5px}
.fhint{font-size:10.5px;color:var(--muted-2);margin-top:5px;line-height:1.4}
.inp{width:100%;font-size:13px;font-family:inherit;padding:10px 13px;border:1px solid var(--border);border-radius:10px;background:var(--white);color:var(--ink);outline:none;transition:all .15s}
.inp:focus{border-color:var(--yellow);box-shadow:0 0 0 3px var(--yellow-pale)}
.inp::placeholder{color:var(--muted-3)}
.inp.mono{font-family:'JetBrains Mono';font-size:14px;font-weight:700}
.inp.err{border-color:var(--danger);background:var(--danger-pale)}
textarea.inp{resize:vertical;min-height:84px;line-height:1.55;font-size:12px}
.err-msg{font-size:11px;color:var(--danger-text);margin-top:6px;font-weight:600}
.field-err{font-size:10.5px;color:var(--danger-text);margin-top:5px;font-weight:600}

/* goal cards */
.gl{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px}
.gc{border:1.5px solid var(--border);border-radius:16px;padding:22px 20px;background:var(--white);cursor:pointer;transition:all .2s}
.gc:hover{border-color:var(--muted-3);transform:translateY(-2px);box-shadow:0 8px 24px -14px rgba(0,0,0,.08)}
.gc.sel{border-color:var(--ink);background:var(--yellow-50);box-shadow:0 0 0 3px var(--yellow-pale)}
.gc-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-family:'Outfit';font-weight:800;font-size:20px;margin-bottom:14px}
.gc-icon.conv{background:var(--conv-pale);color:var(--conv)}
.gc-icon.eng{background:var(--eng-pale);color:var(--eng)}
.gc-icon.hyb{background:var(--hyb-pale);color:var(--hyb)}
.gc-tag{font-family:'JetBrains Mono';font-size:10px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--muted-2);margin-bottom:6px}
.gc-title{font-family:'Outfit';font-size:17px;font-weight:700;color:var(--ink);margin-bottom:6px}
.gc-desc{font-size:12px;color:var(--muted);line-height:1.6;margin-bottom:14px}
.gc-ex{font-size:11px;color:var(--muted);line-height:1.55;padding:9px 12px;background:var(--bg);border-radius:8px;border-left:2px solid var(--muted-3)}
.gc-ex b{color:var(--ink);font-weight:700}
.gc-fields{margin-top:12px;font-size:10.5px;color:var(--muted-2);line-height:1.6}
.gc-fields b{color:var(--ink);font-weight:700}

/* format chips + counters */
.fmr{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px}
.fmt-chip{padding:7px 13px;border:1px solid var(--border);border-radius:99px;font-size:11px;font-weight:600;color:var(--muted);background:var(--white)}
.fmt-chip:hover{border-color:var(--ink);color:var(--ink)}
.fmt-chip.sel{background:var(--ink);color:var(--yellow);border-color:var(--ink);font-weight:700}
.fmc{display:flex;flex-direction:column;gap:6px}
.fmcr{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px}
.fmcn{font-size:12px;font-weight:600;color:var(--ink)}
.cnt{display:flex;align-items:center;gap:8px}
.cbtn{width:24px;height:24px;border-radius:50%;border:1px solid var(--border);background:var(--white);color:var(--muted);font-size:14px;font-weight:700;line-height:1}
.cbtn:hover{border-color:var(--ink);color:var(--ink)}
.cval{font-family:'JetBrains Mono';font-size:13px;font-weight:800;min-width:22px;text-align:center;color:var(--ink)}

/* dropzone / assets */
.dz{border:1.5px dashed var(--border);border-radius:12px;padding:22px;background:var(--bg);text-align:center;cursor:pointer}
.dz:hover{border-color:var(--ink);background:var(--yellow-50)}
.dzh{font-size:11px;color:var(--muted-2);margin-top:4px;line-height:1.5}
.dzb{font-size:11px;font-weight:700;color:var(--ink);background:var(--white);border:1px solid var(--border);border-radius:99px;padding:6px 14px;margin-top:10px}
.dzb:hover{border-color:var(--ink)}
.acs{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;justify-content:center}
.ac{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;background:var(--white);border:1px solid var(--border);border-radius:7px;font-size:11px;color:var(--ink)}
.ac .ax{color:var(--muted-3);cursor:pointer;font-weight:800}

/* fork cards */
.fk{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
.fkc{border:1.5px solid var(--border);border-radius:16px;padding:22px;background:var(--white);cursor:pointer;transition:all .2s}
.fkc:hover{border-color:var(--muted-3);transform:translateY(-2px);box-shadow:0 8px 24px -14px rgba(0,0,0,.08)}
.fkc.sel{border-color:var(--ink);background:var(--yellow-50);box-shadow:0 0 0 3px var(--yellow-pale)}
.fkh{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.fki{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-family:'Outfit';font-weight:800;font-size:18px}
.fki.hp{background:var(--yellow-pale);color:var(--yellow-text)}
.fki.grp{background:var(--success-pale);color:var(--success-text)}
.fkt{font-family:'Outfit';font-size:16px;font-weight:700;color:var(--ink)}
.fks{font-size:11px;color:var(--muted-2);margin-top:2px}
.fkb{font-size:12px;color:var(--muted);line-height:1.65;margin-bottom:16px}
.fkp{font-size:11.5px;color:var(--muted);line-height:1.85}
.fkp li{list-style:none;padding-left:20px;position:relative}
.fkp li::before{content:'✓';position:absolute;left:0;color:var(--success);font-weight:800}
.fkp b{color:var(--ink);font-weight:700}

/* browse */
.bh{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.bs{flex:1;min-width:240px;font-size:13px;padding:10px 13px;border:1px solid var(--border);border-radius:10px;background:var(--white);outline:none;color:var(--ink)}
.bs:focus{border-color:var(--yellow);box-shadow:0 0 0 3px var(--yellow-pale)}
.fc{font-size:11px;font-weight:700;color:var(--muted);background:var(--white);border:1px solid var(--border);border-radius:99px;padding:7px 13px;display:inline-flex;align-items:center;gap:5px}
.fc:hover{border-color:var(--ink);color:var(--ink)}
.fc.act{background:var(--yellow);border-color:var(--yellow);color:var(--ink)}
.fc-cnt{background:var(--bg2);color:var(--muted-2);font-family:'JetBrains Mono';font-size:9.5px;font-weight:800;padding:1px 6px;border-radius:99px;margin-left:3px}
.fc.act .fc-cnt{background:rgba(0,0,0,.15);color:var(--ink)}
.fc.clear{color:var(--muted-2);background:transparent;border-color:transparent;text-decoration:underline}
.bf{display:flex;gap:8px;flex-wrap:wrap;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:10px;margin-bottom:12px}
.bff{display:flex;flex-direction:column;gap:4px;min-width:90px}
.bff label{font-size:9.5px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px}
.bff input,.bff select{font-size:11.5px;padding:6px 9px;border:1px solid var(--border);border-radius:7px;background:var(--white);font-family:inherit;outline:none;color:var(--ink)}
.bff input:focus,.bff select:focus{border-color:var(--yellow)}

.bg-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}
.bgc{display:flex;align-items:flex-start;gap:10px;padding:12px;border:1.5px solid var(--border);border-radius:12px;background:var(--white);cursor:pointer;transition:all .15s;position:relative}
.bgc:hover{border-color:var(--muted-3)}
.bgc.sel{border-color:var(--ink);background:var(--yellow-50)}
.bgc.already{opacity:.5;cursor:not-allowed}
.bgc-chk{width:18px;height:18px;border-radius:5px;border:1.5px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:transparent;font-size:11px;font-weight:800;margin-top:2px}
.bgc.sel .bgc-chk{background:var(--ink);border-color:var(--ink);color:var(--yellow)}
.bgc.already .bgc-chk{background:var(--success);border-color:var(--success);color:var(--white)}
.bav{width:38px;height:38px;border-radius:10px;background:var(--yellow-pale);color:var(--yellow-text);display:flex;align-items:center;justify-content:center;font-family:'Outfit';font-weight:800;font-size:11px;flex-shrink:0;overflow:hidden}
.bav img{width:100%;height:100%;object-fit:cover}
.bgi{flex:1;min-width:0}
.bgn{font-size:12px;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bgm{font-family:'JetBrains Mono';font-size:10px;color:var(--muted-2);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bst{display:flex;gap:5px;margin-top:6px;flex-wrap:wrap}
.bst-i{font-family:'JetBrains Mono';font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:99px;background:var(--bg2);color:var(--ink)}
.bst-i.er-high{background:var(--success-pale);color:var(--success-text)}
.bv{font-size:8.5px;font-weight:800;padding:1.5px 5px;border-radius:4px;background:var(--eng-pale);color:var(--eng);margin-left:4px}
.bi{font-size:8.5px;font-weight:800;padding:1.5px 5px;border-radius:4px;background:var(--conv-pale);color:var(--conv);margin-left:4px}
.bpr{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;background:var(--white);border:1px solid var(--border);border-radius:12px;margin-bottom:12px;font-size:11px}
.bpr-l{color:var(--muted-2)}
.bpr-sc{font-weight:800;color:var(--ink);margin-right:8px;font-family:'JetBrains Mono'}

/* group panel */
.gp{background:var(--white);border:1px solid var(--border);border-radius:16px;padding:22px 24px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.gpr{margin-bottom:16px}
.gpr:last-child{margin-bottom:0}
.gprh{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.gprt{font-size:11.5px;font-weight:700;color:var(--ink)}
.gprs{font-size:10.5px;color:var(--muted-2)}
.gpc{display:flex;flex-wrap:wrap;gap:6px}
.mp{background:linear-gradient(135deg,var(--yellow-50) 0%,var(--yellow-pale) 100%);border:1px solid rgba(255,193,7,.4);border-radius:14px;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:14px;position:relative;overflow:hidden}
.mp::before{content:'';position:absolute;top:-40px;right:-40px;width:140px;height:140px;background:var(--yellow);border-radius:50%;opacity:.18}
.mp>*{position:relative;z-index:2}
.mp-n{font-family:'JetBrains Mono';font-size:38px;font-weight:800;color:var(--ink);line-height:1;letter-spacing:-.6px}
.mp-l{font-size:11.5px;color:var(--muted);margin-top:4px;font-weight:600}
.mp-av{display:flex}
.mp-av .bav{margin-left:-8px;border:2px solid var(--white);width:34px;height:34px}

/* terms editor split */
.tw{display:grid;grid-template-columns:240px 1fr;gap:18px}
.tlh{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.tlh-ct{font-family:'JetBrains Mono';font-size:10.5px;font-weight:800;color:var(--muted-2);letter-spacing:.4px;text-transform:uppercase}
.bulk{font-size:11px;font-weight:700;color:var(--ink);background:var(--white);border:1px solid var(--border);border-radius:99px;padding:5px 11px}
.bulk:hover{border-color:var(--ink);background:var(--yellow-pale)}
.tl{display:flex;flex-direction:column;gap:6px}
.ti{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--white);cursor:pointer;transition:all .15s}
.ti:hover{border-color:var(--muted-3)}
.ti.act{border-color:var(--ink);background:var(--yellow-50)}
.ti.incomplete{border-left:3px solid var(--yellow)}
.ti-m{flex:1;min-width:0}
.ti-n{font-size:12px;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ti-h{font-family:'JetBrains Mono';font-size:10px;color:var(--muted-2);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ti-s{font-size:10px;font-weight:800;color:var(--yellow-text);text-align:right;white-space:nowrap}
.ti-s.ok{color:var(--success-text)}
.te{background:var(--white);border:1px solid var(--border);border-radius:16px;padding:18px 22px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.te h4{font-family:'Outfit';font-size:14px;font-weight:700;color:var(--ink);margin-bottom:3px}
.te .sh{font-size:11px;color:var(--muted-2);margin-bottom:14px}

/* nav footer */
.cc .nf{display:flex;align-items:center;justify-content:space-between;padding-top:22px;margin-top:8px;border-top:1px solid var(--border)}
/* Buttons — scoped under .cc so brand-web global Tailwind / dashboard layout
   styles can't override them (specificity 0,2,0 vs global 0,1,0). Each :hover
   rule re-asserts color explicitly so a wins-by-cascade rule from elsewhere
   can't accidentally drop text colour and leave us with ink-on-ink. */
.cc .btn{padding:10px 22px;border-radius:11px;font-size:12px;font-weight:700;font-family:inherit;transition:all .15s;display:inline-flex;align-items:center;gap:8px;border:0;cursor:pointer}
.cc .btn-prim{background:var(--ink);color:var(--yellow)}
.cc .btn-prim:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}
.cc .btn-prim:disabled{opacity:.4;cursor:not-allowed;background:var(--ink);color:var(--yellow)}
.cc .btn-back{background:var(--white);border:1px solid var(--border);color:var(--ink)}
.cc .btn-back:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}
.cc .btn-draft{background:var(--white);border:1px solid var(--border);color:var(--muted)}
.cc .btn-draft:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}
.cc .btn-pub{background:var(--yellow);color:var(--ink)}
.cc .btn-pub:hover:not(:disabled){background:var(--yellow-hover);color:var(--ink)}
.cc .btn-pub:disabled{opacity:.4;cursor:not-allowed;background:var(--yellow);color:var(--ink)}
.cc .btn-sm{padding:7px 12px;font-size:11px;border-radius:8px}
.cc .btn-danger{background:var(--danger-pale);color:var(--danger-text)}
.cc .btn-danger:hover:not(:disabled){background:#FBCBC4;color:var(--danger-text)}
.cc .btn-ghost{background:transparent;color:var(--muted-2);font-weight:600;border:0}
.cc .btn-ghost:hover:not(:disabled){color:var(--ink);background:transparent}
.cc .step-ctr{font-family:'JetBrains Mono';font-size:11px;color:var(--muted-2);font-weight:800;letter-spacing:.3px}

/* right rail cards */
.rc{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:16px 18px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.rc h4{font-family:'Outfit';font-size:13px;font-weight:700;color:var(--ink);margin-bottom:3px;display:flex;align-items:center;gap:8px}
.rc-h{font-size:10.5px;color:var(--muted-2);margin-bottom:12px}
.bsr{display:flex;align-items:baseline;justify-content:space-between}
.bsv{font-family:'JetBrains Mono';font-size:18px;font-weight:800;color:var(--ink)}
.bsv.ok{color:var(--success-text)}
.bsv.warn{color:var(--yellow-text)}
.bsv.over{color:var(--danger-text)}
.bsof{font-size:10px;color:var(--muted-2);font-family:'JetBrains Mono'}
.bb{height:6px;border-radius:99px;background:var(--bg2);overflow:hidden;margin:8px 0}
.bf{height:100%;background:var(--ink);border-radius:99px}
.bf.warn{background:var(--yellow)}
.bf.over{background:var(--danger)}
.bsn{font-size:10px;color:var(--muted-2);font-family:'JetBrains Mono'}

/* preview card */
.pw{background:var(--white);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.pwh{padding:10px 14px;background:var(--bg2);border-bottom:1px solid var(--border);font-family:'JetBrains Mono';font-size:10px;color:var(--muted-2);font-weight:800;letter-spacing:.4px;text-transform:uppercase}
.pwb{padding:14px 16px}
.pbr{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.pbl{width:34px;height:34px;border-radius:9px;background:var(--ink);color:var(--yellow);display:flex;align-items:center;justify-content:center;font-family:'Outfit';font-weight:800;font-size:13px}
.pbn{font-size:12.5px;font-weight:700;color:var(--ink)}
.pbc{font-size:10.5px;color:var(--muted-2);font-family:'JetBrains Mono'}
.pm{font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:10px}
.pm b{color:var(--ink);font-weight:700}
.po{background:var(--yellow-50);border:1px dashed var(--yellow);border-radius:10px;padding:11px 12px;margin:10px 0;font-size:11.5px;color:var(--ink);line-height:1.6}
.po b{color:var(--yellow-text);font-weight:800}
.pr{display:flex;justify-content:space-between;padding:5px 0;font-size:11px;border-bottom:1px solid var(--border-soft)}
.pr:last-child{border:0}
.pr-k{color:var(--muted-2)}
.pr-v{color:var(--ink);font-weight:700}
.pct{display:flex;gap:6px;margin-top:12px}
.pct .b{flex:1;padding:8px;text-align:center;font-size:11px;font-weight:700;border-radius:9px;border:1px solid var(--border);color:var(--muted-2)}
.pct .b.prim{background:var(--ink);color:var(--yellow);border-color:var(--ink)}

/* checklist */
.chr{display:flex;align-items:flex-start;gap:10px;padding:5px 0;font-size:11.5px}
.chd{width:15px;height:15px;border-radius:50%;flex-shrink:0;margin-top:1px;background:var(--bg2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:800}
.chd.done{background:var(--success);border-color:var(--success);color:var(--white)}
.chd.done::before{content:'✓'}
.chd.warn{background:var(--yellow-pale);border-color:var(--yellow);color:var(--yellow-text)}
.chd.warn::before{content:'!'}
.cht{color:var(--muted);line-height:1.5}
.cht.done{color:var(--muted-2);text-decoration:line-through}

/* wallet card step 3 */
.wal{background:var(--ink);color:var(--white);border-radius:14px;padding:16px 18px;margin-bottom:14px}
.wal h4{font-family:'Outfit';font-size:12.5px;font-weight:700;color:var(--white);margin-bottom:14px;display:flex;align-items:center;gap:8px}
.wr{display:flex;justify-content:space-between;align-items:baseline;padding:6px 0;border-top:1px solid rgba(255,255,255,.1)}
.wr:first-of-type{border:0;padding-top:0}
.wr-k{font-size:11px;color:rgba(255,255,255,.65)}
.wr-v{font-family:'JetBrains Mono';font-size:14px;font-weight:800;color:var(--white)}
.wr-v.yellow{color:var(--yellow)}
.wpl{margin-top:10px;padding:6px 11px;background:rgba(16,185,129,.18);color:var(--success);border-radius:99px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:5px}

/* review */
.rh{padding:24px;background:linear-gradient(135deg,var(--yellow-50) 0%,var(--yellow-pale) 100%);border:1px solid rgba(255,193,7,.4);border-radius:18px;position:relative;overflow:hidden;margin-bottom:14px}
.rh::before{content:'';position:absolute;top:-50px;right:-50px;width:180px;height:180px;background:var(--yellow);border-radius:50%;opacity:.22}
.rh::after{content:'';position:absolute;top:-20px;right:50px;width:80px;height:80px;background:var(--yellow);border-radius:50%;opacity:.14}
.rh>*{position:relative;z-index:2}
.rh h2{font-family:'Outfit';font-size:24px;font-weight:700;color:var(--ink);letter-spacing:-.4px;margin-bottom:4px}
.rh-d{font-family:'JetBrains Mono';font-size:12px;color:var(--muted);margin-bottom:18px;font-weight:600}
.rs{background:var(--white);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.rsh{padding:14px 18px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border-soft);flex-wrap:wrap}
.rsn{font-family:'Outfit';font-size:14px;font-weight:700;color:var(--ink);margin-right:auto}
.rvr{display:flex;justify-content:space-between;padding:8px 18px;font-size:12px}
.rvr + .rvr{border-top:1px solid var(--border-soft)}
.rvr .k{color:var(--muted-2);font-weight:500}
.rvr .v{color:var(--ink);font-weight:700}
.rvr .v.mono{font-family:'JetBrains Mono'}

/* groups (saved) */
.grpch{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.grpc{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;background:var(--yellow-pale);border:1px solid var(--yellow);border-radius:99px;font-size:11px;font-weight:700;color:var(--yellow-text);cursor:pointer}
.grpc .ct{font-family:'JetBrains Mono';background:var(--white);padding:1px 7px;border-radius:99px;font-size:10px}
.grpc .x{color:var(--muted);font-weight:800}

/* modals */
.mo{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:50;display:flex;align-items:center;justify-content:center;padding:16px}
.mod{background:var(--white);border-radius:18px;max-width:780px;width:100%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,.25)}
.mod-h{padding:18px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.mod-t{font-family:'Outfit';font-size:15px;font-weight:700;color:var(--ink)}
.mod-x{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--muted-2);font-size:16px}
.mod-x:hover{background:var(--bg)}
.mod-b{flex:1;overflow-y:auto;padding:18px 22px}
.mod-f{padding:14px 22px;border-top:1px solid var(--border);background:var(--bg);display:flex;justify-content:space-between;align-items:center}
.cat-f{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.cat-c{padding:5px 11px;border-radius:99px;border:1px solid var(--border);background:var(--white);font-size:11px;font-weight:700;color:var(--muted)}
.cat-c.sel{background:var(--ink);color:var(--yellow);border-color:var(--ink)}
.pg{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.pc{padding:12px;border:1.5px solid var(--border);border-radius:12px;background:var(--white);cursor:pointer;text-align:center;transition:all .15s}
.pc:hover{border-color:var(--muted-3)}
.pc.sel{border-color:var(--ink);background:var(--yellow-50)}
.pc-img{width:60px;height:60px;border-radius:10px;background:var(--bg);display:flex;align-items:center;justify-content:center;margin:0 auto 8px;font-size:24px;overflow:hidden}
.pc-img img{width:100%;height:100%;object-fit:cover}
.pc-n{font-size:12px;font-weight:700;color:var(--ink);margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pc-p{font-family:'JetBrains Mono';font-size:13px;font-weight:700;color:var(--ink)}
.pc-m{font-size:10px;color:var(--muted-2);margin-top:3px}

/* loading + blocked screens */
.boot{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);font-family:'Plus Jakarta Sans',system-ui,sans-serif}
.boot-c{text-align:center;color:var(--muted)}
.boot-h{font-family:'Outfit';font-size:20px;font-weight:700;color:var(--ink);margin-bottom:8px}
.boot-t{font-size:13px;color:var(--muted);line-height:1.55;max-width:420px}

/* offer config (terms substep) */
.oc-types{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px}
.oc-types .fmt-chip.sel{background:var(--ink);color:var(--yellow);border-color:var(--ink)}
.oc-sec{padding:16px;background:var(--bg);border-radius:12px;margin-bottom:14px}
.oc-sec h5{font-family:'Outfit';font-size:12px;font-weight:700;color:var(--ink);margin-bottom:10px;text-transform:uppercase;letter-spacing:.4px}
.oc-row{display:grid;grid-template-columns:90px 1fr;gap:8px;align-items:center;margin-bottom:10px}
.tog{display:flex;background:var(--white);border:1px solid var(--border);border-radius:9px;overflow:hidden}
.tog button{flex:1;padding:7px;font-size:11px;font-weight:700;color:var(--muted-2)}
.tog button.act{background:var(--ink);color:var(--yellow)}
.prod-sel{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.psc{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border:1px solid var(--border);border-radius:99px;font-size:11px;color:var(--ink);background:var(--white)}
.psc .px{color:var(--muted-3);font-weight:800;cursor:pointer}
.spb{padding:6px 12px;font-size:11px;font-weight:700;color:var(--ink);background:var(--white);border:1px dashed var(--border);border-radius:99px}
.spb:hover{border-color:var(--ink)}

/* toast */
.toast{position:fixed;top:80px;right:24px;background:var(--success-pale);border:1px solid var(--success);color:var(--success-text);padding:12px 18px;border-radius:12px;font-size:12px;font-weight:700;z-index:60;box-shadow:0 8px 24px -12px rgba(0,0,0,.15)}

/* set foot actions */
.sfa{display:flex;justify-content:space-between;margin-top:14px;gap:8px;flex-wrap:wrap}
`;

// ─── Main inner component ────────────────────────────────────────────────────
function NewCampaignPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [brandStatus, setBrandStatus] = useState(null);
  const [brandCategory, setBrandCategory] = useState(null);
  const [step, setStep] = useState(0);
  const [substep, setSubstep] = useState('goal'); // Step 2: goal | basics | fork | pick | terms
  const [activeTermsInf, setActiveTermsInf] = useState(0);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [error, setError] = useState('');
  const [campaignId, setCampaignId] = useState(null);

  useEffect(() => {
    brandApi.getMe().then(res => {
      if (res.success) {
        const b = res.data?.brand || res.data;
        setBrandStatus(b?.user_status || b?.status || 'pending');
        setBrandCategory(b?.category || b?.business_category || null);
      } else { setBrandStatus('pending'); }
    });
  }, []);

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [allowNegotiation, setAllowNegotiation] = useState(true);
  const [sets, setSets] = useState([mkSet(0)]);
  const [activeSet, setActiveSet] = useState(0);
  const [galleryPickerSetIdx, setGalleryPickerSetIdx] = useState(null);
  const [duplicateToast, setDuplicateToast] = useState(null);
  const [products, setProducts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCtx, setModalCtx] = useState(null);
  const [modalTempSel, setModalTempSel] = useState([]);
  const [modalSearch, setModalSearch] = useState('');
  const [modalCat, setModalCat] = useState('All');
  const [infResults, setInfResults] = useState([]);
  const infSearchTimer = useRef(null);
  const [browseResults, setBrowseResults] = useState([]);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [browsePage, setBrowsePage] = useState(1);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseQuery, setBrowseQuery] = useState('');
  const [browseNiche, setBrowseNiche] = useState('');
  const [browseCity, setBrowseCity] = useState('');
  const [browseTier, setBrowseTier] = useState('');
  const [browseGender, setBrowseGender] = useState('');
  const [browseMinFollowers, setBrowseMinFollowers] = useState('');
  const [browseMaxFollowers, setBrowseMaxFollowers] = useState('');
  const [browseMinEr, setBrowseMinEr] = useState('');
  const [browseFiltersOpen, setBrowseFiltersOpen] = useState(false);
  const [browseSelected, setBrowseSelected] = useState([]);
  const browseTimer = useRef(null);
  const [infGroups, setInfGroups] = useState(() => loadGroups());
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupSearchQ, setGroupSearchQ] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState([]);
  const [groupSelectedIds, setGroupSelectedIds] = useState([]);
  const [groupSearchLoading, setGroupSearchLoading] = useState(false);
  const groupSearchTimer = useRef(null);
  const [matchResult, setMatchResult] = useState({ count: 0, influencers: [] });
  const matchTimer = useRef(null);

  useEffect(() => {
    brandApi.getProducts().then(res => { if (res.ok) setProducts(res.data?.products || []); }).catch(() => {});
  }, []);

  // Draft hydration (verbatim from OLD — adapts ?id=<campaignId>)
  useEffect(() => {
    const editId = searchParams.get('id');
    if (!editId) return;
    setLoadingDraft(true);
    campaignApi.get(editId).then(res => {
      if (!res.success && !res.ok) { setError('Could not load draft campaign.'); setLoadingDraft(false); return; }
      const c = res.data.campaign;
      if (c.status !== 'draft') { setError('Only draft campaigns can be edited.'); setLoadingDraft(false); return; }
      setCampaignId(c.id);
      setName(c.name || '');
      setStartDate(c.start_date ? c.start_date.split('T')[0] : '');
      setEndDate(c.end_date ? c.end_date.split('T')[0] : '');
      setTotalBudget(c.total_budget != null ? String(c.total_budget) : '');
      setAllowNegotiation(c.allow_negotiation !== false);
      if (c.sets && c.sets.length > 0) {
        const hydratedSets = c.sets.map((s, idx) => {
          const filters = s.open_group_filters || {};
          const group = {
            ...mkGroup(),
            tiers: filters.tiers || [], niches: filters.niches || [], cities: filters.cities || [],
            min_er: filters.min_er != null ? String(filters.min_er) : '',
            gender: filters.gender || '',
            max_cap: s.max_cap != null ? String(s.max_cap) : '10',
            per_influencer_budget: s.per_influencer_budget != null ? String(s.per_influencer_budget) : '',
          };
          const influencers = (s.influencers || []).map(ci => {
            const cfg = ci.offer_config_json || {};
            return {
              ...mkInf(),
              backendId: ci.id, influencer_id: ci.influencer_id,
              name: ci.influencer_name || '', handle: ci.instagram_handle || '',
              init: (ci.influencer_name || '?')[0].toUpperCase(),
              post_date: ci.posting_date ? ci.posting_date.split('T')[0] : '',
              influencer_budget: ci.influencer_budget != null ? String(ci.influencer_budget) : '',
              offer_type: ci.offer_type || '',
              commission_pct: ci.commission_pct != null ? String(ci.commission_pct) : '',
              physical_delivery: ci.physical_delivery || false,
              delivery_address: ci.delivery_address || '',
              custom_code: ci.coupon_code || '',
              ...((ci.offer_type || '').toLowerCase().includes('discount') && { d_sub: cfg.sub_type || 'pct', d_val: String(cfg.value || ''), d_prods: cfg.products || [], d_scope: cfg.scope || (cfg.products?.length ? 'products' : 'store'), d_category: cfg.category || '' }),
              ...((ci.offer_type || '').toLowerCase().includes('volume') && { v_tiers: cfg.tiers || [{min_spend:'',pct_off:''}], v_prods: cfg.products || [], v_scope: cfg.scope || (cfg.products?.length ? 'products' : 'store'), v_category: cfg.category || '' }),
              ...((ci.offer_type || '').toLowerCase() === 'bogo' && { bogo_buy: cfg.buy_product || null, bogo_get: cfg.get_product || null }),
              ...((ci.offer_type || '').toLowerCase().includes('bundle') && { bnd_prods: cfg.products || [], bnd_price: String(cfg.bundle_price || '') }),
              ...((ci.offer_type || '').toLowerCase().includes('gift') && { gift_offers: cfg.offers || [{main:null,gift:null}] }),
            };
          });
          return {
            ...mkSet(idx), _id: Date.now() + idx, backendId: s.id,
            name: s.name || `Set ${String.fromCharCode(65 + idx)}`,
            goal: s.goal || '', influencer_mode: s.influencer_mode || 'handpick',
            window_start: s.window_start ? s.window_start.split('T')[0] : '',
            window_end: s.window_end ? s.window_end.split('T')[0] : '',
            set_budget: s.set_budget != null ? String(s.set_budget) : '',
            brief: s.brief || '', coupon_prefix: s.coupon_prefix || '',
            formats: s.formats_json || [],
            assets: (s.assets_json || []).map(a => ({
              asset_id: a.asset_id || null, title: a.title || a.file_name,
              file_r2_key: a.file_r2_key, file_name: a.file_name,
              file_type: a.file_type, file_size_bytes: a.file_size_bytes,
              name: a.title || a.file_name,
              icon: (a.file_type || '').startsWith('video') ? '🎬' : (a.file_type || '').startsWith('image') ? '🖼️' : '📄',
              size: a.file_size_bytes ? `${(a.file_size_bytes / 1024).toFixed(0)} KB` : '',
            })),
            influencers, group,
          };
        });
        setSets(hydratedSets);
        setStep(1);
        setSubstep('terms');
      }
      setLoadingDraft(false);
    }).catch(() => { setError('Could not load draft campaign.'); setLoadingDraft(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Budget helpers
  const totalSetBudget = () => sets.reduce((t, s) => {
    if (!needsBudget(s.goal)) return t;
    if (s.influencer_mode === 'handpick') return t + Number(s.set_budget || 0);
    return t + (Number(s.group.per_influencer_budget || 0) * Number(s.group.max_cap || 0));
  }, 0);
  const campRem = () => Number(totalBudget || 0) - totalSetBudget();
  const setInfSpent = si => sets[si].influencers.reduce((t, i) => t + Number(i.influencer_budget || 0), 0);
  const setRem = si => Number(sets[si].set_budget || 0) - setInfSpent(si);
  const isBudgetOver = () => sets.some(s => needsBudget(s.goal)) && campRem() < 0;

  // Validation (verbatim from OLD)
  const validation = (() => {
    const v = {
      campaign: {},
      sets: sets.map(() => ({ fields: {}, warnings: {}, group: {}, influencers: [] })),
      step1Errors: 0, step2Errors: 0,
    };
    if (!name.trim()) v.campaign.name = 'Campaign name is required';
    if (!startDate) v.campaign.startDate = 'Start date is required';
    if (!endDate) v.campaign.endDate = 'End date is required';
    else if (startDate && endDate < startDate) v.campaign.endDate = 'End date must be on or after start date';
    const anyPaidSet = sets.some(s => needsBudget(s.goal));
    if (anyPaidSet) {
      const tb = Number(totalBudget);
      if (totalBudget === '' || totalBudget == null) v.campaign.totalBudget = 'Required when any set is engagement or hybrid';
      else if (!Number.isFinite(tb)) v.campaign.totalBudget = 'Must be a valid number';
      else if (tb <= 0) v.campaign.totalBudget = 'Must be greater than 0';
    }
    v.step1Errors = Object.keys(v.campaign).length;

    sets.forEach((s, si) => {
      const sv = v.sets[si];
      if (!s.name || !s.name.trim()) sv.fields.name = 'Set name is required';
      if (!s.goal) sv.fields.goal = 'Pick a goal (engagement / conversion / hybrid)';
      if (!s.window_start) sv.fields.window_start = 'Required';
      if (!s.window_end) sv.fields.window_end = 'Required';
      if (s.window_start && s.window_end && s.window_end < s.window_start) sv.fields.window_end = 'Window end must be on or after window start';
      if (s.window_start && startDate && s.window_start < startDate) sv.fields.window_start = `Cannot be before campaign start (${startDate})`;
      if (s.window_end && endDate && s.window_end > endDate) sv.fields.window_end = `Cannot be after campaign end (${endDate})`;
      if (!Array.isArray(s.formats) || s.formats.length === 0) sv.fields.formats = 'Pick at least one content format';
      if (needsCoupon(s.goal)) {
        if (!s.coupon_prefix || !s.coupon_prefix.trim()) sv.fields.coupon_prefix = 'Required for conversion / hybrid';
        else if (!/^[A-Z0-9]{3,15}$/.test(s.coupon_prefix.trim())) sv.fields.coupon_prefix = '3-15 letters/digits, uppercase only';
      }
      if (needsBudget(s.goal) && s.influencer_mode === 'handpick') {
        const sb = Number(s.set_budget);
        if (s.set_budget === '' || s.set_budget == null) sv.fields.set_budget = 'Required for engagement / hybrid';
        else if (!Number.isFinite(sb)) sv.fields.set_budget = 'Must be a valid number';
        else if (sb <= 0) sv.fields.set_budget = 'Must be greater than 0';
        else if (Number(totalBudget) > 0 && totalSetBudget() > Number(totalBudget)) sv.fields.set_budget = `Total set budgets exceed campaign budget by ₹${fmtN(totalSetBudget() - Number(totalBudget))}`;
        if (sb > 0 && setInfSpent(si) > sb) sv.fields.set_budget_overspent = `Influencers allocated ₹${fmtN(setInfSpent(si))} — exceeds set budget by ₹${fmtN(setInfSpent(si) - sb)}`;
      }
      if (s.influencer_mode === 'open_group') {
        const cap = Number(s.group?.max_cap);
        if (!s.group?.max_cap || !Number.isFinite(cap)) sv.group.max_cap = 'Required';
        else if (cap <= 0) sv.group.max_cap = 'Must be greater than 0';
        else if (!Number.isInteger(cap)) sv.group.max_cap = 'Must be a whole number';
        else if (cap > 1000) sv.group.max_cap = 'Max 1000 influencers per group';
        if (needsBudget(s.goal)) {
          const pib = Number(s.group?.per_influencer_budget);
          if (s.group?.per_influencer_budget === '' || s.group?.per_influencer_budget == null) sv.group.per_influencer_budget = 'Required for engagement / hybrid';
          else if (!Number.isFinite(pib)) sv.group.per_influencer_budget = 'Must be a valid number';
          else if (pib <= 0) sv.group.per_influencer_budget = 'Must be greater than 0';
          if (pib > 0 && cap > 0) {
            const projected = pib * cap;
            const tb = Number(totalBudget) || 0;
            if (tb > 0 && totalSetBudget() > tb) sv.group.projected = `Group could spend up to ₹${fmtN(projected)} — campaign budget over by ₹${fmtN(totalSetBudget() - tb)}`;
          }
        }
        if (needsOffer(s.goal)) {
          const cp = Number(s.group?.commission_pct);
          if (s.group?.commission_pct === '' || s.group?.commission_pct == null) sv.group.commission_pct = 'Required for conversion / hybrid';
          else if (!Number.isFinite(cp) || cp <= 0 || cp > 100) sv.group.commission_pct = 'Must be between 0 and 100';
          else if (cp > 25) sv.warnings.group_commission_pct = 'Commission above 25% is unusually high';
        }
      }
      s.influencers.forEach((inf, ii) => {
        const errs = {};
        if (!inf.post_date) errs.post_date = 'Required';
        else if (s.window_start && inf.post_date < s.window_start) errs.post_date = `Must be on or after ${s.window_start}`;
        else if (s.window_end && inf.post_date > s.window_end) errs.post_date = `Must be on or before ${s.window_end}`;
        if (needsBudget(s.goal)) {
          const ib = Number(inf.influencer_budget);
          if (inf.influencer_budget === '' || inf.influencer_budget == null) errs.influencer_budget = 'Required';
          else if (!Number.isFinite(ib)) errs.influencer_budget = 'Invalid number';
          else if (ib <= 0) errs.influencer_budget = 'Must be greater than 0';
        }
        if (needsOffer(s.goal)) {
          const cp = Number(inf.commission_pct);
          if (inf.commission_pct === '' || inf.commission_pct == null) errs.commission_pct = 'Required';
          else if (!Number.isFinite(cp) || cp <= 0 || cp > 100) errs.commission_pct = 'Must be between 0 and 100';
          if (!inf.offer_type) errs.offer_type = 'Pick an offer type';
        }
        sv.influencers[ii] = errs;
      });
      v.step2Errors += Object.keys(sv.fields).length;
      v.step2Errors += Object.keys(sv.group).length;
      sv.influencers.forEach(e => { v.step2Errors += Object.keys(e).length; });
    });
    return v;
  })();

  const [touched, setTouched] = useState({});
  const [forceShowErrors, setForceShowErrors] = useState(false);
  const markTouched = (key) => setTouched(prev => prev[key] ? prev : { ...prev, [key]: true });
  const showErr = (key, msg) => msg && (forceShowErrors || touched[key]) ? msg : null;

  // Mutators
  const updateSet = (idx, patch) => setSets(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  const updateInf = (si, ii, patch) => setSets(prev => prev.map((s, i) => i !== si ? s : { ...s, influencers: s.influencers.map((inf, j) => j === ii ? { ...inf, ...patch } : inf) }));
  const updateGroup = (si, patch) => setSets(prev => prev.map((s, i) => i === si ? { ...s, group: { ...s.group, ...patch } } : s));
  const allUsedIds = () => sets.filter(s => s.influencer_mode === 'handpick').flatMap(s => s.influencers.map(i => i.influencer_id));

  const toggleFormat = (si, fmt) => {
    const s = sets[si];
    const exists = s.formats.find(f => f.name === fmt);
    if (exists) updateSet(si, { formats: s.formats.filter(f => f.name !== fmt) });
    else updateSet(si, { formats: [...s.formats, { name: fmt, count: 1 }] });
  };
  const setFormatCount = (si, fmtName, delta) => updateSet(si, {
    formats: sets[si].formats.map(f => f.name === fmtName ? { ...f, count: Math.max(1, f.count + delta) } : f)
  });

  const removeInfluencer = (si, ii) => updateSet(si, { influencers: sets[si].influencers.filter((_, j) => j !== ii) });

  // Browse panel (verbatim)
  const doBrowseSearch = useCallback(async (page = 1) => {
    setBrowseLoading(true); setBrowsePage(page);
    const params = { page: String(page), limit: '20' };
    if (browseQuery.trim()) params.q = browseQuery.trim();
    if (browseNiche) params.niche = browseNiche;
    if (browseCity.trim()) params.city = browseCity.trim();
    if (browseTier) params.tier = browseTier;
    if (browseMinFollowers) params.min_followers = browseMinFollowers;
    if (browseMaxFollowers) params.max_followers = browseMaxFollowers;
    if (browseMinEr) params.min_view_er = browseMinEr;
    try {
      const res = await influencerApi.search(params);
      if (res.success || res.ok) {
        const raw = res.data?.creators || res.data?.influencers || [];
        setBrowseResults(raw.map(mapCreator));
        setBrowseTotal(res.meta?.total || raw.length || 0);
      }
    } catch {}
    setBrowseLoading(false);
  }, [browseQuery, browseNiche, browseCity, browseTier, browseGender, browseMinFollowers, browseMaxFollowers, browseMinEr]);

  useEffect(() => {
    clearTimeout(browseTimer.current);
    browseTimer.current = setTimeout(() => doBrowseSearch(1), 350);
    return () => clearTimeout(browseTimer.current);
  }, [doBrowseSearch]);

  const clearBrowseFilters = () => {
    setBrowseQuery(''); setBrowseNiche(''); setBrowseCity(''); setBrowseTier('');
    setBrowseGender(''); setBrowseMinFollowers(''); setBrowseMaxFollowers(''); setBrowseMinEr('');
  };

  const toggleBrowseSelect = (inf) => {
    setBrowseSelected(prev => {
      const exists = prev.find(s => s.id === inf.id);
      if (exists) return prev.filter(s => s.id !== inf.id);
      return [...prev, inf];
    });
  };

  const addBrowseSelectedToSet = async (si) => {
    const usedIds = allUsedIds();
    const onboardedNew = browseSelected.filter(inf => !inf.is_unclaimed && inf.id && !usedIds.includes(inf.id));
    const scrapedToInvite = browseSelected.filter(inf => inf.is_unclaimed);
    if (onboardedNew.length > 0) {
      const newInfs = onboardedNew.map(inf => ({
        ...mkInf(), influencer_id: inf.id,
        name: inf.full_name || '',
        handle: inf.instagram_handle ? `@${inf.instagram_handle}` : '',
        init: (inf.full_name || 'X').slice(0, 2).toUpperCase(),
      }));
      updateSet(si, { influencers: [...sets[si].influencers, ...newInfs] });
    }
    if (scrapedToInvite.length > 0) {
      const results = await Promise.allSettled(scrapedToInvite.map(inf =>
        creatorInvitationApi.create({
          ig_handle: inf.ig_handle,
          campaign_id: campaignId || undefined,
          set_id: sets[si]?.id || undefined,
        })
      ));
      const ok = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
      const dup = results.filter(r => r.status === 'fulfilled' && r.value?.error?.code === 'CONFLICT').length;
      const err = results.length - ok - dup;
      if (typeof window !== 'undefined') {
        const lines = [];
        if (ok) lines.push(`✉ ${ok} invitation${ok === 1 ? '' : 's'} queued for Inflx admin outreach`);
        if (dup) lines.push(`${dup} already invited (skipped)`);
        if (err) lines.push(`${err} failed`);
        alert(lines.join('\n'));
      }
    }
    setBrowseSelected([]);
  };

  // Groups
  const updateGroupsState = (newGroups) => { setInfGroups(newGroups); saveGroups(newGroups); };
  const openGroupModal = () => {
    setGroupName(''); setGroupSearchQ(''); setGroupSearchResults([]); setGroupSelectedIds([]);
    setGroupModalOpen(true);
  };
  const doGroupSearch = (q) => {
    setGroupSearchQ(q);
    clearTimeout(groupSearchTimer.current);
    if (!q.trim()) { setGroupSearchResults([]); return; }
    setGroupSearchLoading(true);
    groupSearchTimer.current = setTimeout(async () => {
      try {
        const res = await influencerApi.search({ q, limit: '30' });
        if (res.success || res.ok) {
          const raw = res.data?.creators || res.data?.influencers || [];
          setGroupSearchResults(raw.map(mapCreator).filter(c => !c.is_unclaimed));
        }
      } catch {}
      setGroupSearchLoading(false);
    }, 300);
  };
  const toggleGroupSelect = (id) => setGroupSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const saveNewGroup = () => {
    if (!groupName.trim() || groupSelectedIds.length === 0) return;
    const newGroup = {
      id: Date.now().toString(),
      name: groupName.trim(),
      influencer_ids: groupSelectedIds,
      influencers: groupSearchResults.filter(r => groupSelectedIds.includes(r.id)).map(r => ({
        id: r.id, full_name: r.full_name, instagram_handle: r.instagram_handle,
      })),
    };
    updateGroupsState([...infGroups, newGroup]);
    setGroupModalOpen(false);
  };
  const deleteGroup = (groupId) => updateGroupsState(infGroups.filter(g => g.id !== groupId));
  const addGroupToSet = (si, groupId) => {
    const group = infGroups.find(g => g.id === groupId);
    if (!group) return;
    const usedIds = allUsedIds();
    const newInfs = group.influencers.filter(inf => !usedIds.includes(inf.id)).map(inf => ({
      ...mkInf(), influencer_id: inf.id,
      name: inf.full_name || '',
      handle: inf.instagram_handle ? `@${inf.instagram_handle}` : '',
      init: (inf.full_name || 'X').slice(0, 2).toUpperCase(),
    }));
    if (newInfs.length > 0) updateSet(si, { influencers: [...sets[si].influencers, ...newInfs] });
  };

  // Open group matches
  const fetchMatches = (si, groupOverride) => {
    if (!campaignId) return;
    clearTimeout(matchTimer.current);
    matchTimer.current = setTimeout(async () => {
      const g = groupOverride || sets[si].group;
      try {
        const params = new URLSearchParams();
        if (g.tiers?.length) g.tiers.forEach(t => params.append('tiers', t));
        if (g.niches?.length) g.niches.forEach(n => params.append('niches', n));
        if (g.cities?.length) g.cities.forEach(c => params.append('cities', c));
        if (g.min_er) params.set('min_er', g.min_er);
        if (g.gender) params.set('gender', g.gender);
        const res = await campaignApi.getOpenGroupMatches(campaignId, si, params);
        if (res.ok) setMatchResult(res.data);
      } catch {}
    }, 400);
  };

  // Set CRUD
  const addSet = () => {
    const idx = sets.length;
    setSets(prev => [...prev, mkSet(idx)]);
    setActiveSet(idx);
    setSubstep('goal');
  };
  const deleteSet = (si) => {
    if (sets.length <= 1) return;
    setSets(prev => prev.filter((_, i) => i !== si));
    setActiveSet(Math.max(0, si - 1));
  };
  const duplicateSet = (si) => {
    const idx = sets.length;
    const source = sets[si];
    const clone = JSON.parse(JSON.stringify(source));
    const dup = {
      ...clone, _id: Date.now(), backendId: null,
      name: `${source.name} (copy)`,
      influencers: (source.influencers || []).map((inf, ii) => ({
        ...JSON.parse(JSON.stringify(inf)),
        backendId: null, _id: Date.now() + ii + 1,
        custom_code: '', edit_code: false,
      })),
    };
    setSets(prev => [...prev, dup]);
    setActiveSet(idx);
    setError('');
    setDuplicateToast(`Duplicated "${source.name}" → "${dup.name}". Edit the fields below to differ.`);
    setTimeout(() => setDuplicateToast(null), 3500);
  };

  // Save
  const saveDraft = async () => {
    if (!name.trim()) { setError('Campaign name is required'); return null; }
    if (!startDate) { setError('Start date is required'); return null; }
    if (!endDate) { setError('End date is required'); return null; }
    setSaving(true); setError('');
    try {
      let cid = campaignId;
      if (!cid) {
        const res = await campaignApi.create({ name, start_date: startDate, end_date: endDate, total_budget: totalBudget || null, allow_negotiation: allowNegotiation });
        if (!res.ok) { setError(res.error?.message || 'Failed to save campaign'); return null; }
        cid = res.data.campaign.id; setCampaignId(cid);
      } else {
        await campaignApi.update(cid, { name, start_date: startDate, end_date: endDate, total_budget: totalBudget || null, allow_negotiation: allowNegotiation });
      }
      return cid;
    } catch (e) { setError(e.message); return null; } finally { setSaving(false); }
  };

  const goToStep2 = async () => {
    if (validation.step1Errors > 0) {
      setForceShowErrors(true);
      setError(`Please fix ${validation.step1Errors} field${validation.step1Errors !== 1 ? 's' : ''} before continuing.`);
      return;
    }
    const cid = await saveDraft();
    if (cid) { setStep(1); setSubstep(sets[activeSet].goal ? 'basics' : 'goal'); setForceShowErrors(false); }
  };
  const goBack = () => { setStep(s => s - 1); setError(''); setForceShowErrors(false); };

  const buildOfferConfig = (item) => {
    const t = (item.offer_type || '').toLowerCase().trim();
    switch (t) {
      case 'discount': return { sub_type: item.d_sub, value: Number(item.d_val) || 0, scope: item.d_scope || 'store', category: item.d_scope === 'category' ? (item.d_category || null) : null, products: item.d_scope === 'products' ? (item.d_prods || []) : [] };
      case 'volume discount':
      case 'volume': return { tiers: item.v_tiers, scope: item.v_scope || 'store', category: item.v_scope === 'category' ? (item.v_category || null) : null, products: item.v_scope === 'products' ? (item.v_prods || []) : [] };
      case 'bogo': return { buy_product: item.bogo_buy, get_product: item.bogo_get };
      case 'bundle': return { products: item.bnd_prods, bundle_price: Number(item.bnd_price) || 0 };
      case 'free gift':
      case 'free_gift': return { offers: item.gift_offers };
      default: return {};
    }
  };

  const saveSets = async (cid) => {
    const updatedSets = sets.map(s => ({ ...s, influencers: s.influencers.map(i => ({ ...i })) }));
    for (let si = 0; si < updatedSets.length; si++) {
      const s = updatedSets[si];
      if (!s.goal) { throw new Error(`Set "${s.name}" needs a goal before saving`); }
      const setPayload = {
        name: s.name, goal: s.goal, brief: s.brief || null,
        formats_json: s.formats,
        assets_json: (s.assets || []).map(a => ({
          asset_id: a.asset_id || a.id || null, title: a.title || a.name || a.file_name || null,
          file_r2_key: a.file_r2_key || null, file_name: a.file_name || a.name || null,
          file_type: a.file_type || null, file_size_bytes: a.file_size_bytes || null,
        })).filter(a => a.file_r2_key),
        influencer_mode: s.influencer_mode,
        window_start: s.window_start || null, window_end: s.window_end || null,
        ...(needsBudget(s.goal) && { set_budget: Number(s.set_budget) || null }),
        ...(needsCoupon(s.goal) && { coupon_prefix: s.coupon_prefix || null }),
        ...(s.influencer_mode === 'open_group' && {
          open_group_filters: {
            tiers: s.group.tiers, niches: s.group.niches, cities: s.group.cities,
            min_er: s.group.min_er ? Number(s.group.min_er) : null,
            gender: s.group.gender || null,
          },
          max_cap: Number(s.group.max_cap) || null,
          per_influencer_budget: needsBudget(s.goal) ? (Number(s.group.per_influencer_budget) || null) : null,
        }),
      };
      let setBackendId = s.backendId;
      if (!setBackendId) {
        const res = await campaignApi.createSet(cid, setPayload);
        if (!res.success && !res.ok) throw new Error(res.error?.message || `Failed to save set "${s.name}"`);
        setBackendId = res.data.set.id;
        updatedSets[si] = { ...updatedSets[si], backendId: setBackendId };
      } else {
        await campaignApi.updateSet(cid, setBackendId, setPayload);
      }
      if (s.influencer_mode === 'handpick') {
        for (let ii = 0; ii < updatedSets[si].influencers.length; ii++) {
          const inf = updatedSets[si].influencers[ii];
          if (!inf.influencer_id) continue;
          const infPayload = {
            influencer_id: inf.influencer_id,
            posting_date: inf.post_date || null,
            offer_type: needsOffer(s.goal) ? (inf.offer_type || null) : null,
            offer_config_json: inf.offer_type ? buildOfferConfig(inf) : null,
            influencer_budget: needsBudget(s.goal) ? (Number(inf.influencer_budget) || null) : null,
            commission_pct: needsCoupon(s.goal) ? (Number(inf.commission_pct) || null) : null,
            physical_delivery: inf.physical_delivery || false,
            delivery_address: inf.delivery_address || null,
            coupon_code: inf.custom_code || null,
          };
          if (inf.backendId) {
            await campaignApi.updateInfluencer(cid, setBackendId, inf.backendId, infPayload);
          } else {
            const res = await campaignApi.inviteInfluencer(cid, setBackendId, infPayload);
            if (res.success || res.ok) updatedSets[si].influencers[ii] = { ...inf, backendId: res.data?.campaign_influencer?.id || true };
          }
        }
      }
    }
    setSets(updatedSets);
  };

  const goToStep3 = async () => {
    if (validation.step1Errors > 0 || validation.step2Errors > 0) {
      setForceShowErrors(true);
      const total = validation.step1Errors + validation.step2Errors;
      setError(`Please fix ${total} field${total !== 1 ? 's' : ''} before reviewing.`);
      return;
    }
    let cid = campaignId;
    if (!cid) { cid = await saveDraft(); if (!cid) return; }
    setSaving(true); setError('');
    try { await saveSets(cid); setStep(2); setForceShowErrors(false); }
    catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handlePublish = async () => {
    if (validation.step1Errors > 0 || validation.step2Errors > 0) {
      setForceShowErrors(true);
      setStep(validation.step1Errors > 0 ? 0 : 1);
      const total = validation.step1Errors + validation.step2Errors;
      setError(`Cannot publish — fix ${total} field${total !== 1 ? 's' : ''} first.`);
      return;
    }
    let cid = campaignId;
    if (!cid) { cid = await saveDraft(); if (!cid) return; }
    setPublishing(true); setError('');
    try {
      await saveSets(cid);
      const res = await campaignApi.publish(cid);
      if (!res.success && !res.ok) { setError(res.error?.message || 'Publish failed'); return; }
      router.push('/dashboard/campaigns');
    } catch (e) { setError(e.message); } finally { setPublishing(false); }
  };

  // Product modal
  const openModal = (ctx) => {
    setModalCtx(ctx);
    setModalTempSel([...(ctx.currentSel || [])]);
    setModalSearch(''); setModalCat('All');
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setModalCtx(null); };
  const toggleModalProd = (prod) => {
    if (!modalCtx?.multi) setModalTempSel(prev => prev.some(p => p.id === prod.id) ? [] : [prod]);
    else setModalTempSel(prev => prev.some(p => p.id === prod.id) ? prev.filter(p => p.id !== prod.id) : [...prev, prod]);
  };
  const confirmModal = () => {
    if (!modalCtx) return;
    const { si, ii, field, isGroup, giIdx } = modalCtx;
    const val = modalTempSel;
    if (isGroup) {
      if (field === 'bogoBuy') updateGroup(si, { bogo_buy: val[0] || null });
      else if (field === 'bogoGet') updateGroup(si, { bogo_get: val[0] || null });
      else if (field === 'giftMain') { const gos = [...sets[si].group.gift_offers]; gos[giIdx] = { ...gos[giIdx], main: val[0] || null }; updateGroup(si, { gift_offers: gos }); }
      else if (field === 'giftItem') { const gos = [...sets[si].group.gift_offers]; gos[giIdx] = { ...gos[giIdx], gift: val[0] || null }; updateGroup(si, { gift_offers: gos }); }
      else updateGroup(si, { [field]: val });
    } else {
      if (field === 'bogoBuy') updateInf(si, ii, { bogo_buy: val[0] || null });
      else if (field === 'bogoGet') updateInf(si, ii, { bogo_get: val[0] || null });
      else if (field === 'giftMain') setSets(prev => prev.map((s, si2) => si2 !== si ? s : { ...s, influencers: s.influencers.map((inf, ii2) => ii2 !== ii ? inf : { ...inf, gift_offers: inf.gift_offers.map((go, gi) => gi !== giIdx ? go : { ...go, main: val[0] || null }) }) }));
      else if (field === 'giftItem') setSets(prev => prev.map((s, si2) => si2 !== si ? s : { ...s, influencers: s.influencers.map((inf, ii2) => ii2 !== ii ? inf : { ...inf, gift_offers: inf.gift_offers.map((go, gi) => gi !== giIdx ? go : { ...go, gift: val[0] || null }) }) }));
      else updateInf(si, ii, { [field]: val });
    }
    closeModal();
  };

  const filteredProds = products.filter(p => {
    if (modalSearch && !p.name.toLowerCase().includes(modalSearch.toLowerCase())) return false;
    if (modalCat !== 'All' && p.category !== modalCat) return false;
    return true;
  });
  const prodCategories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];

  const offerSummary = (o) => {
    if (!o.offer_type) return '—';
    if (o.offer_type === 'Discount') {
      const base = o.d_sub === 'flat' ? `₹${o.d_val || '?'} off` : `${o.d_val || '?'}% off`;
      const scope = o.d_scope === 'category' ? ` on ${o.d_category || '?'}` : o.d_scope === 'products' ? ` on ${(o.d_prods || []).length} product(s)` : ' on entire store';
      return base + scope;
    }
    if (o.offer_type === 'Volume discount') {
      const base = `Volume: ${(o.v_tiers || []).length} tier(s)`;
      const scope = o.v_scope === 'category' ? ` · ${o.v_category || '?'}` : o.v_scope === 'products' ? ` · ${(o.v_prods || []).length} product(s)` : ' · entire store';
      return base + scope;
    }
    if (o.offer_type === 'BOGO') return `Buy ${o.bogo_buy?.name || '?'} → get ${o.bogo_get?.name || '?'} free`;
    if (o.offer_type === 'Bundle') return `Bundle ${(o.bnd_prods || []).length} products @ ₹${o.bnd_price || '?'}`;
    if (o.offer_type === 'Free gift') return `Free gift — ${(o.gift_offers || []).length} offer(s)`;
    return o.offer_type;
  };

  const brandSections = [...new Set((products || []).map(p => p.section).filter(Boolean))].sort();

  // ─── Sub-step helpers ──────────────────────────────────────────────────────
  const substepIdx = ['goal','basics','fork','pick','terms'].indexOf(substep);
  const setComplete = (s) => {
    if (!s.goal || !s.name || !s.window_start || !s.window_end || !s.formats?.length) return false;
    if (needsCoupon(s.goal) && !s.coupon_prefix) return false;
    if (s.influencer_mode === 'handpick') {
      if (s.influencers.length === 0) return false;
      return s.influencers.every(inf => {
        if (!inf.post_date) return false;
        if (needsBudget(s.goal) && !(Number(inf.influencer_budget) > 0)) return false;
        if (needsOffer(s.goal) && (!(Number(inf.commission_pct) > 0) || !inf.offer_type)) return false;
        return true;
      });
    }
    if (!s.group?.max_cap) return false;
    if (needsBudget(s.goal) && !(Number(s.group.per_influencer_budget) > 0)) return false;
    if (needsOffer(s.goal) && !(Number(s.group.commission_pct) > 0)) return false;
    return true;
  };
  const setSubstepFor = (s) => {
    if (!s.goal) return 'goal';
    if (!s.window_start || !s.window_end || !s.formats?.length) return 'basics';
    if (s.influencer_mode === 'handpick' && s.influencers.length === 0) return 'pick';
    if (s.influencer_mode === 'open_group' && !s.group?.max_cap) return 'pick';
    return 'terms';
  };
  const jumpToSet = (si) => {
    setActiveSet(si);
    setSubstep(setSubstepFor(sets[si]));
    setActiveTermsInf(0);
  };

  // ─── Loading / blocked guards ──────────────────────────────────────────────
  if (loadingDraft) return (
    <div className="cc boot"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="boot-c"><div className="boot-h">Loading your draft campaign…</div><div className="boot-t">Hydrating sets, influencers and offers from the server.</div></div></div>
  );
  if (brandStatus === null) return (
    <div className="cc boot"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="boot-c"><div className="boot-h">Checking your account…</div></div></div>
  );
  if (brandStatus !== 'approved') return (
    <div className="cc boot"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="boot-c" style={{ maxWidth: 480 }}><div className="boot-h">Account under review</div><p className="boot-t">Your account is pending admin approval. Campaign creation will be available once approved — usually within 24 hours.</p><button onClick={() => router.push('/dashboard')} className="btn btn-prim" style={{ marginTop: 20 }}>← Back to dashboard</button></div></div>
  );

  // ─── Derived values for current set ────────────────────────────────────────
  const cur = sets[activeSet];
  const curMode = cur.influencer_mode;
  const used = totalSetBudget();
  const rem = campRem();
  const pct = totalBudget ? Math.min(100, used / Number(totalBudget) * 100) : 0;
  const sv = validation.sets[activeSet] || { fields: {}, group: {}, influencers: [] };

  // ─── Topbar ────────────────────────────────────────────────────────────────
  const Topbar = () => (
    <div className="tb">
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div className="tb-logo">[LOGO]</div>
      </div>
      <div className="tb-steps">
        <div className={`ms ${step > 0 ? 'done' : step === 0 ? 'act' : ''}`}>Campaign</div>
        <div className={`ms-line ${step > 0 ? 'done' : ''}`}></div>
        <div className={`ms ${step > 1 ? 'done' : step === 1 ? 'act' : ''}`}>Build sets</div>
        <div className={`ms-line ${step > 1 ? 'done' : ''}`}></div>
        <div className={`ms ${step === 2 ? 'act' : ''}`}>Review</div>
      </div>
      <button className="tb-exit" onClick={() => router.push('/dashboard/campaigns')}>✕ Exit</button>
    </div>
  );

  // ─── Left rail ─────────────────────────────────────────────────────────────
  const LeftRail = () => {
    if (step === 0) return (
      <>
        <div className="rl">Campaign creation</div>
        <div className="sub act"><div className="sub-idx"><span className="sub-idx-num">1</span></div>Campaign basics</div>
        <div className="sub locked"><div className="sub-idx"><span className="sub-idx-num">2</span></div>Build deliverable sets</div>
        <div className="sub locked"><div className="sub-idx"><span className="sub-idx-num">3</span></div>Review & publish</div>
        <div className="rn">Top-level basics first. Then we build one or more sets — each set is a chunk of work with its own goal, influencers, and terms.</div>
      </>
    );
    if (step === 2) return (
      <>
        <div className="rl">Campaign creation</div>
        <div className="sub done"><div className="sub-idx"><span className="sub-idx-num">1</span></div>Campaign basics</div>
        <div className="sub done"><div className="sub-idx"><span className="sub-idx-num">2</span></div>Build deliverable sets</div>
        <div className="sub act"><div className="sub-idx"><span className="sub-idx-num">3</span></div>Review & publish</div>
        <div className="rl">Final check</div>
        <div className="rn">All sets locked. Wallet balance verified. Publish triggers T1 escrow lock + invitation fan-out.</div>
      </>
    );
    const labels = ['Pick a goal','Set basics','Who posts?','Pick influencers','Set their terms'];
    return (
      <>
        <div className="rl">Build this set</div>
        {labels.map((lbl, i) => {
          const key = ['goal','basics','fork','pick','terms'][i];
          const cls = `sub ${substepIdx === i ? 'act' : substepIdx > i ? 'done' : ''}`;
          return (
            <div key={key} className={cls} onClick={() => setSubstep(key)}>
              <div className="sub-idx"><span className="sub-idx-num">{i + 1}</span></div>{lbl}
            </div>
          );
        })}
        <div className="rl">Sets in this campaign</div>
        {sets.map((s, si) => {
          const goalPill = s.goal ? `sc-pill ${s.goal === 'hybrid' ? 'hyb' : s.goal === 'engagement' ? 'eng' : 'conv'}` : 'sc-pill draft';
          const goalLbl = s.goal ? s.goal.charAt(0).toUpperCase() + s.goal.slice(1) : 'Draft';
          const ssIdx = ['goal','basics','fork','pick','terms'].indexOf(setSubstepFor(s));
          return (
            <div key={s._id || si} className={`sc ${si === activeSet ? 'act' : ''}`} onClick={() => jumpToSet(si)}>
              <div className="sc-top">
                <span className="sc-name">{s.name}</span>
                <span className={goalPill}>{goalLbl}</span>
              </div>
              <div className="sc-meta">{setComplete(s) ? '✓ Complete' : `${ssIdx + 1} of 5${s.influencer_mode === 'open_group' ? ' · open group' : ''}`}</div>
              {sets.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <button className="sc-del" onClick={(e) => { e.stopPropagation(); deleteSet(si); }} title="Remove set">× delete</button>
                </div>
              )}
            </div>
          );
        })}
        <button className="add-set" onClick={addSet}>+ Add another set</button>
        <div className="rn">Most campaigns need 1–2 sets. Add more to split by format or audience.</div>
      </>
    );
  };

  // ─── Right rail ────────────────────────────────────────────────────────────
  const RightRail = () => {
    if (step === 0) return (
      <>
        <div className="rc"><h4>💰 Wallet status</h4><div className="bsr"><div className="bsv">₹{fmtN(totalBudget || 250000)}</div><div className="bsof">covers this campaign</div></div><div className="rc-h" style={{ marginTop: 10, marginBottom: 0 }}>You need wallet ≥ total escrow lock (set budget + 8% platform fee) to publish.</div></div>
        <div className="rc"><h4>📋 Onboarding tips</h4>
          <div className="chr"><div className="chd done"></div><div className="cht done">Wallet topped up</div></div>
          <div className="chr"><div className="chd"></div><div className="cht">Products listed in catalogue (for conversion offers)</div></div>
          <div className="chr"><div className="chd"></div><div className="cht">Brand logo + brief assets uploaded</div></div>
        </div>
      </>
    );
    if (step === 2) {
      const totalAllocated = (() => {
        let t = 0;
        sets.forEach(s => {
          if (!needsBudget(s.goal)) return;
          if (s.influencer_mode === 'handpick') t += s.influencers.reduce((a, i) => a + (Number(i.influencer_budget) || 0), 0);
          else t += (Number(s.group.per_influencer_budget) || 0) * (Number(s.group.max_cap) || 0);
        });
        return t;
      })();
      const fee = totalAllocated * 0.08;
      const lock = totalAllocated + fee;
      return (
        <>
          <div className="wal"><h4>💰 Wallet & escrow</h4>
            <div className="wr"><span className="wr-k">Allocated</span><span className="wr-v">₹{fmtN(totalAllocated)}</span></div>
            <div className="wr"><span className="wr-k">+ 8% platform fee</span><span className="wr-v">₹{fmtN(fee.toFixed(2))}</span></div>
            <div className="wr"><span className="wr-k">Escrow lock</span><span className="wr-v yellow">₹{fmtN(lock.toFixed(2))}</span></div>
            <div className="wpl">● Server checks wallet at publish</div>
          </div>
          <div className="rc"><h4>📋 Final checks</h4>
            {sets.map((s, si) => (
              <div key={si} className="chr">
                <div className={`chd ${setComplete(s) ? 'done' : 'warn'}`}></div>
                <div className={`cht ${setComplete(s) ? 'done' : ''}`}>{s.name} — {setComplete(s) ? 'ready' : 'incomplete'}</div>
              </div>
            ))}
          </div>
          <div className="rc"><h4>📣 On publish</h4><div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>Locks T1 (25%) for each handpick influencer + the open-group cap · fires invitations · campaign flips <span className="mono">draft → published</span> · invited creators get a notification immediately.</div></div>
        </>
      );
    }
    // Step 2 right rail: budget + What X will see preview + checklist
    const previewInf = curMode === 'handpick' && cur.influencers[activeTermsInf || 0];
    const previewName = previewInf?.name || previewInf?.handle || 'first influencer';
    const previewBudget = previewInf?.influencer_budget || (cur.group?.per_influencer_budget || '?');
    const previewComm = previewInf?.commission_pct || cur.group?.commission_pct || '?';
    const previewCode = previewInf?.custom_code || autoCode(cur.coupon_prefix, previewInf?.name || 'Priya');
    return (
      <>
        <div className="rc"><h4>💰 Campaign budget</h4>
          <div className="bsr"><div className={`bsv ${rem < 0 ? 'over' : pct > 80 ? 'warn' : 'ok'}`}>₹{fmtN(rem)}</div><div className="bsof">of ₹{fmtN(totalBudget || 0)}</div></div>
          <div className="bb"><div className={`bf ${rem < 0 ? 'over' : pct > 80 ? 'warn' : ''}`} style={{ width: `${pct}%` }} /></div>
          <div className="bsn">₹{fmtN(used)} allocated · {sets.filter(s => needsBudget(s.goal)).length} paid set(s)</div>
        </div>
        <div className="pw">
          <div className="pwh">👁  What {previewName} will see</div>
          <div className="pwb">
            <div className="pbr"><div className="pbl">{(name || 'B')[0].toUpperCase()}</div><div><div className="pbn">{name || 'Your brand'}</div><div className="pbc">{cur.goal || 'goal pending'} · {brandCategory || 'brand'}</div></div></div>
            <div className="pm">Invited to <b>{name || 'this campaign'}</b> — <b>{cur.name}</b></div>
            <div className="po">
              Post {cur.formats?.length ? cur.formats.map(f => `${f.count} ${f.name.replace('Instagram ', '')}`).join(' + ') : '—'} between {cur.window_start || '—'} – {cur.window_end || '—'}<br />
              {needsBudget(cur.goal) && <>Earn <span className="mono">₹{fmtN(previewBudget)}</span> base{needsOffer(cur.goal) ? <> + <b>{previewComm}% commission</b></> : ''}</>}
              {!needsBudget(cur.goal) && needsOffer(cur.goal) && <>Earn <b>{previewComm}% commission</b> per sale</>}
              {needsCoupon(cur.goal) && cur.coupon_prefix && <> via code <span className="mono">{previewCode}</span></>}
            </div>
            <div className="pr"><span className="pr-k">Window</span><span className="pr-v">{cur.window_start || '—'} → {cur.window_end || '—'}</span></div>
            <div className="pr"><span className="pr-k">Your pay</span><span className="pr-v">{needsBudget(cur.goal) ? `₹${fmtN(previewBudget)}` : 'Commission only'}{needsOffer(cur.goal) ? ` + ${previewComm}%` : ''}</span></div>
            <div className="pr"><span className="pr-k">Negotiation</span><span className="pr-v">{allowNegotiation ? 'Allowed' : 'Fixed terms'}</span></div>
            <div className="pct"><div className="b">Decline</div>{allowNegotiation && <div className="b">Negotiate</div>}<div className="b prim">Accept</div></div>
          </div>
        </div>
        <div className="rc"><h4>📋 {cur.name} checklist</h4><div className="rc-h">What's still needed for this set.</div>
          <div className="chr"><div className={`chd ${cur.goal ? 'done' : ''}`}></div><div className={`cht ${cur.goal ? 'done' : ''}`}>Goal picked{cur.goal ? ` — ${cur.goal}` : ''}</div></div>
          <div className="chr"><div className={`chd ${cur.name && cur.window_start && cur.window_end ? 'done' : ''}`}></div><div className={`cht ${cur.name && cur.window_start && cur.window_end ? 'done' : ''}`}>Name & window</div></div>
          <div className="chr"><div className={`chd ${cur.formats?.length ? 'done' : ''}`}></div><div className={`cht ${cur.formats?.length ? 'done' : ''}`}>Formats selected</div></div>
          {needsCoupon(cur.goal) && <div className="chr"><div className={`chd ${cur.coupon_prefix ? 'done' : 'warn'}`}></div><div className={`cht ${cur.coupon_prefix ? 'done' : ''}`}>Coupon prefix</div></div>}
          {needsBudget(cur.goal) && curMode === 'handpick' && <div className="chr"><div className={`chd ${Number(cur.set_budget) > 0 ? 'done' : 'warn'}`}></div><div className={`cht ${Number(cur.set_budget) > 0 ? 'done' : ''}`}>Set budget</div></div>}
          <div className="chr"><div className={`chd ${cur.influencer_mode ? 'done' : ''}`}></div><div className={`cht ${cur.influencer_mode ? 'done' : ''}`}>Assignment mode picked</div></div>
          {curMode === 'handpick' && <div className="chr"><div className={`chd ${cur.influencers.length > 0 ? 'done' : ''}`}></div><div className={`cht ${cur.influencers.length > 0 ? 'done' : ''}`}>{cur.influencers.length || 'No'} influencer{cur.influencers.length !== 1 ? 's' : ''} added</div></div>}
          {curMode === 'handpick' && cur.influencers.length > 0 && <div className="chr"><div className={`chd ${setComplete(cur) ? 'done' : 'warn'}`}></div><div className={`cht ${setComplete(cur) ? 'done' : ''}`}>{setComplete(cur) ? 'All terms set' : `${sv.influencers.filter(e => Object.keys(e).length).length} need terms`}</div></div>}
        </div>
      </>
    );
  };

  // ─── Step 1 (basics) ───────────────────────────────────────────────────────
  const renderStep1 = () => (
    <>
      <div className="sh-tag">Step 1 of 3</div>
      <h1>Campaign basics</h1>
      <div className="subh">Set the top-level details. Budget covers engagement & hybrid sets only — conversion sets run on commission, no upfront budget needed.</div>

      <div className="card">
        <h3>Name & dates</h3>
        <div className="sh">A clear internal name + the campaign's run window. Influencers can only post inside this window.</div>
        <div className="g1">
          <div className="f">
            <label className="flbl">Campaign name</label>
            <input className={`inp ${showErr('name', validation.campaign.name) ? 'err' : ''}`} value={name} placeholder="e.g. Monsoon Glow 2026" onChange={e => { setName(e.target.value); markTouched('name'); }} onBlur={() => markTouched('name')} />
            {showErr('name', validation.campaign.name) && <div className="field-err">{validation.campaign.name}</div>}
          </div>
        </div>
        <div className="g2">
          <div className="f">
            <label className="flbl">Start date</label>
            <input className={`inp mono ${showErr('startDate', validation.campaign.startDate) ? 'err' : ''}`} type="date" value={startDate}
              min={(() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0]; })()}
              onChange={e => { setStartDate(e.target.value); markTouched('startDate'); }} onBlur={() => markTouched('startDate')} />
            <div className="fhint">Must start at least 7 days from today.</div>
            {showErr('startDate', validation.campaign.startDate) && <div className="field-err">{validation.campaign.startDate}</div>}
          </div>
          <div className="f">
            <label className="flbl">End date</label>
            <input className={`inp mono ${showErr('endDate', validation.campaign.endDate) ? 'err' : ''}`} type="date" value={endDate} min={startDate || undefined}
              onChange={e => { setEndDate(e.target.value); markTouched('endDate'); }} onBlur={() => markTouched('endDate')} />
            {showErr('endDate', validation.campaign.endDate) && <div className="field-err">{validation.campaign.endDate}</div>}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Budget & negotiation</h3>
        <div className="sh">Total budget covers engagement + hybrid sets. Conversion-only campaigns can leave it at zero.</div>
        <div className="g2">
          <div className="f">
            <label className="flbl">Total campaign budget (₹)</label>
            <input className={`inp mono ${showErr('totalBudget', validation.campaign.totalBudget) ? 'err' : ''}`} type="number" value={totalBudget} placeholder="0"
              onChange={e => { setTotalBudget(e.target.value); markTouched('totalBudget'); }} onBlur={() => markTouched('totalBudget')} />
            <div className="fhint">Allocated across paid sets in Step 2.</div>
            {showErr('totalBudget', validation.campaign.totalBudget) && <div className="field-err">{validation.campaign.totalBudget}</div>}
          </div>
          <div className="f">
            <label className="flbl">Allow negotiation?</label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 11, border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', background: 'var(--white)' }}>
              <input type="checkbox" checked={allowNegotiation} onChange={e => setAllowNegotiation(e.target.checked)} style={{ marginTop: 2, accentColor: 'var(--yellow)', width: 16, height: 16 }} />
              <span style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 12.5 }}>Allow Accept · Decline · Negotiate</div>
                <div style={{ fontSize: 10.5, color: 'var(--muted-2)', marginTop: 2 }}>{allowNegotiation ? 'Best for individual deals.' : 'Best for fixed-terms-only large rosters.'}</div>
              </span>
            </label>
          </div>
        </div>
      </div>

      {error && <div className="err-msg">{error}</div>}
      <div className="nf">
        <button className="btn btn-back" onClick={() => router.push('/dashboard/campaigns')}>← Back to campaigns</button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="step-ctr">Step 1 / 3</span>
          <button className="btn btn-prim" onClick={goToStep2} disabled={saving}>{saving ? 'Saving…' : 'Build deliverable sets →'}</button>
        </div>
      </div>
    </>
  );

  // ─── Step 3 (review) ───────────────────────────────────────────────────────
  const renderStep3 = () => {
    const allInfs = [];
    sets.forEach(s => {
      if (needsBudget(s.goal) && s.influencer_mode === 'handpick') {
        s.influencers.forEach(inf => {
          if (inf.name && inf.influencer_budget) allInfs.push({ name: inf.name, handle: inf.handle, budget: Number(inf.influencer_budget || 0), set: s.name });
        });
      }
      if (needsBudget(s.goal) && s.influencer_mode === 'open_group' && s.group.per_influencer_budget && s.group.max_cap) {
        allInfs.push({ name: `Open group (${s.name})`, handle: `up to ${s.group.max_cap} influencers`, budget: Number(s.group.per_influencer_budget) * Number(s.group.max_cap), set: s.name });
      }
    });
    const totalAllocated = allInfs.reduce((t, i) => t + i.budget, 0);
    return (
      <>
        <div className="sh-tag">Step 3 of 3</div>
        <h1>Review & publish</h1>
        <div className="subh">Everything looks good? Publishing locks T1 escrow per influencer and fires invitations immediately.</div>

        <div className="rh">
          <h2>{name || 'Campaign'}</h2>
          <div className="rh-d">{startDate} → {endDate} · {sets.length} set{sets.length !== 1 ? 's' : ''}</div>
          {totalBudget && (
            <div style={{ background: 'rgba(255,255,255,.65)', borderRadius: 10, padding: 12 }}>
              <div className="bsr"><span style={{ fontFamily: "'JetBrains Mono'", fontSize: 10.5, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.3px' }}>Campaign budget</span><span className={`bsv ${rem < 0 ? 'over' : pct > 80 ? 'warn' : 'ok'}`} style={{ fontSize: 13 }}>₹{fmtN(rem)} of ₹{fmtN(totalBudget)} remaining</span></div>
              <div className="bb" style={{ background: 'rgba(0,0,0,.08)', margin: '8px 0 4px' }}><div className={`bf ${rem < 0 ? 'over' : pct > 80 ? 'warn' : ''}`} style={{ width: `${pct}%` }} /></div>
              <div className="bsn">{rem < 0 ? <span style={{ color: 'var(--danger-text)' }}>Over by ₹{fmtN(Math.abs(rem))}</span> : `₹${fmtN(used)} allocated`}</div>
            </div>
          )}
        </div>

        {allInfs.length > 0 && (
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, fontWeight: 800, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>₹{fmtN(totalAllocated)} allocated for {allInfs.length} influencer slot(s)</div>
            {allInfs.map((inf, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i > 0 ? '1px solid var(--border-soft)' : 'none' }}>
                <div><div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{inf.name}</div><div style={{ fontFamily: "'JetBrains Mono'", fontSize: 10.5, color: 'var(--muted-2)' }}>{inf.handle}{inf.set ? ` · ${inf.set}` : ''}</div></div>
                <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' }}>₹{fmtN(inf.budget)}</div>
              </div>
            ))}
          </div>
        )}

        {sets.map((s, si) => (
          <div key={si} className="rs">
            <div className="rsh">
              <span className="rsn">{s.name}</span>
              {s.goal && <span className={`sc-pill ${s.goal === 'hybrid' ? 'hyb' : s.goal === 'engagement' ? 'eng' : 'conv'}`}>{s.goal}</span>}
              <span className={`sc-pill ${s.influencer_mode === 'open_group' ? '' : 'draft'}`} style={s.influencer_mode === 'open_group' ? { background: 'var(--success-pale)', color: 'var(--success-text)' } : {}}>{s.influencer_mode === 'handpick' ? `Handpick · ${s.influencers.length}` : `Open group · up to ${s.group.max_cap || '?'}`}</span>
            </div>
            {s.formats.length > 0 && <div className="rvr"><span className="k">Formats</span><span className="v">{s.formats.map(f => `${f.name} ×${f.count}`).join(', ')}</span></div>}
            {s.window_start && <div className="rvr"><span className="k">Window</span><span className="v mono">{s.window_start} → {s.window_end}</span></div>}
            {needsBudget(s.goal) && s.set_budget && <div className="rvr"><span className="k">Set budget</span><span className="v mono">₹{fmtN(s.set_budget)}</span></div>}
            {s.coupon_prefix && <div className="rvr"><span className="k">Coupon prefix</span><span className="v mono">{s.coupon_prefix}</span></div>}
            {s.assets.length > 0 && <div className="rvr"><span className="k">Brand assets</span><span className="v">{s.assets.length} file(s)</span></div>}
            {s.influencer_mode === 'open_group' && s.group.tiers.length > 0 && <div className="rvr"><span className="k">Tiers</span><span className="v">{s.group.tiers.join(', ')}</span></div>}
            {s.influencer_mode === 'open_group' && s.group.niches.length > 0 && <div className="rvr"><span className="k">Niches</span><span className="v">{s.group.niches.join(', ')}</span></div>}
            {s.influencer_mode === 'open_group' && s.group.cities.length > 0 && <div className="rvr"><span className="k">Cities</span><span className="v">{s.group.cities.join(', ')}</span></div>}
          </div>
        ))}

        {isBudgetOver() && <div className="err-msg" style={{ padding: 12, background: 'var(--danger-pale)', borderRadius: 10, border: '1px solid #FBCBC4' }}>Budget exceeded — reduce set budgets before publishing.</div>}
        {error && <div className="err-msg">{error}</div>}

        <div className="nf">
          <button className="btn btn-back" onClick={goBack}>← Back</button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-draft" onClick={saveDraft}>Save draft</button>
            <button className="btn btn-pub" onClick={handlePublish} disabled={isBudgetOver() || publishing}>{publishing ? 'Publishing…' : '🚀 Publish campaign'}</button>
          </div>
        </div>
      </>
    );
  };

  // ─── Step 2 sub-step renders ───────────────────────────────────────────────
  const goNext = () => {
    const order = ['goal','basics','fork','pick','terms'];
    const i = order.indexOf(substep);
    if (i < order.length - 1) setSubstep(order[i + 1]);
    else goToStep3();
  };
  const goPrev = () => {
    const order = ['goal','basics','fork','pick','terms'];
    const i = order.indexOf(substep);
    if (i > 0) setSubstep(order[i - 1]);
    else goBack();
  };

  const NavFoot = ({ nextLbl, nextDisabled, idx, total = 5 }) => (
    <div className="nf">
      <button className="btn btn-back" onClick={goPrev}>← Back</button>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn btn-draft" onClick={saveDraft} disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</button>
        <span className="step-ctr">{idx} / {total}</span>
        <button className="btn btn-prim" onClick={goNext} disabled={nextDisabled || saving}>{saving ? 'Saving…' : nextLbl}</button>
      </div>
    </div>
  );

  // ─── 2.1 Goal ──────────────────────────────────────────────────────────────
  const renderGoal = () => (
    <>
      <div className="sh-tag">Step 2 · Sub-step 1 of 5</div>
      <h1>What should this set achieve?</h1>
      <div className="subh">Your choice here decides how you pay influencers and what info we collect next. You can add more sets with different goals later.</div>
      <div className="gl">
        {[
          { key: 'conversion', icon: '%', cls: 'conv', tag: 'Commission only', title: 'Drive sales', desc: 'Pay only when customers buy. Each influencer gets a unique coupon — you pay a % of every sale they bring.', ex: 'restaurants, salons, retail — anyone wanting no upfront cost.', fields: 'coupon prefix · commission %' },
          { key: 'engagement', icon: '♦', cls: 'eng', tag: 'Flat fee', title: 'Boost awareness', desc: 'Pay a fixed fee for content creation. No coupons, no sales tracking — just great posts.', ex: 'new launches, event promos, anyone buying reach not sales.', fields: 'total budget · per-influencer pay' },
          { key: 'hybrid', icon: '~', cls: 'hyb', tag: 'Fee + commission', title: 'Both — content & sales', desc: 'Pay a base fee to guarantee posting + commission on tracked sales. Most predictable for both sides.', ex: 'considered purchases — fashion, electronics, services.', fields: 'budget · coupon · commission %' },
        ].map(g => (
          <div key={g.key} className={`gc ${cur.goal === g.key ? 'sel' : ''}`} onClick={() => updateSet(activeSet, { goal: g.key })}>
            <div className={`gc-icon ${g.cls}`}>{g.icon}</div>
            <div className="gc-tag">{g.tag}</div>
            <div className="gc-title">{g.title}</div>
            <div className="gc-desc">{g.desc}</div>
            <div className="gc-ex"><b>Best for:</b> {g.ex}</div>
            <div className="gc-fields"><b>You'll configure:</b> {g.fields}</div>
          </div>
        ))}
      </div>
      {error && <div className="err-msg">{error}</div>}
      <NavFoot nextLbl="Continue →" nextDisabled={!cur.goal} idx={1} />
    </>
  );

  // ─── 2.2 Basics ────────────────────────────────────────────────────────────
  const renderBasics = () => {
    const sr = setRem(activeSet);
    const sp = cur.set_budget ? Math.min(100, setInfSpent(activeSet) / Number(cur.set_budget) * 100) : 0;
    return (
      <>
        <div className="sh-tag">Step 2 · Sub-step 2 of 5</div>
        <h1>Set basics</h1>
        <div className="subh">Name it, pick the posting window, choose the content format. Fields adapt to your goal ({cur.goal ? <b>{cur.goal}</b> : 'pick a goal first'}{needsCoupon(cur.goal) ? ' — so we ask for a coupon prefix' : ''}).</div>

        <div className="card">
          <h3>Identity & timing</h3>
          <div className="sh">A clear name helps you spot this set later. Dates control when influencers can post.</div>
          <div className="g2">
            <div className="f">
              <label className="flbl">Set name</label>
              <input className={`inp ${showErr(`set_${activeSet}_name`, sv.fields.name) ? 'err' : ''}`} value={cur.name} onChange={e => { updateSet(activeSet, { name: e.target.value }); markTouched(`set_${activeSet}_name`); }} />
              {showErr(`set_${activeSet}_name`, sv.fields.name) && <div className="field-err">{sv.fields.name}</div>}
            </div>
            {needsCoupon(cur.goal) && (
              <div className="f">
                <label className="flbl">Coupon prefix <span className="opt">we append the influencer's first name</span></label>
                <input className={`inp mono ${showErr(`set_${activeSet}_cp`, sv.fields.coupon_prefix) ? 'err' : ''}`} value={cur.coupon_prefix || ''} placeholder="e.g. SUMMER → SUMMER_PRIYA"
                  onChange={e => { updateSet(activeSet, { coupon_prefix: e.target.value.toUpperCase() }); markTouched(`set_${activeSet}_cp`); }} />
                <div className="fhint">Example: {cur.coupon_prefix ? `${cur.coupon_prefix}_PRIYA` : 'CODE_PRIYA'}</div>
                {showErr(`set_${activeSet}_cp`, sv.fields.coupon_prefix) && <div className="field-err">{sv.fields.coupon_prefix}</div>}
              </div>
            )}
            <div className="f">
              <label className="flbl">Window starts</label>
              <input className={`inp mono ${showErr(`set_${activeSet}_ws`, sv.fields.window_start) ? 'err' : ''}`} type="date" value={cur.window_start || ''} min={startDate || undefined} max={endDate || undefined}
                onChange={e => { updateSet(activeSet, { window_start: e.target.value }); markTouched(`set_${activeSet}_ws`); }} />
              {showErr(`set_${activeSet}_ws`, sv.fields.window_start) && <div className="field-err">{sv.fields.window_start}</div>}
            </div>
            <div className="f">
              <label className="flbl">Window ends</label>
              <input className={`inp mono ${showErr(`set_${activeSet}_we`, sv.fields.window_end) ? 'err' : ''}`} type="date" value={cur.window_end || ''} min={cur.window_start || startDate || undefined} max={endDate || undefined}
                onChange={e => { updateSet(activeSet, { window_end: e.target.value }); markTouched(`set_${activeSet}_we`); }} />
              {showErr(`set_${activeSet}_we`, sv.fields.window_end) && <div className="field-err">{sv.fields.window_end}</div>}
            </div>
            {needsBudget(cur.goal) && curMode === 'handpick' && (
              <div className="f" style={{ gridColumn: 'span 2' }}>
                <label className="flbl">Set budget (₹){cur.goal === 'hybrid' ? ' — engagement portion only' : ''}</label>
                <input className={`inp mono ${showErr(`set_${activeSet}_sb`, sv.fields.set_budget) ? 'err' : ''}`} type="number" value={cur.set_budget || ''} placeholder="e.g. 80000"
                  onChange={e => { updateSet(activeSet, { set_budget: e.target.value }); markTouched(`set_${activeSet}_sb`); }} />
                {showErr(`set_${activeSet}_sb`, sv.fields.set_budget) && <div className="field-err">{sv.fields.set_budget}</div>}
                {sv.fields.set_budget_overspent && <div className="field-err">{sv.fields.set_budget_overspent}</div>}
                {cur.set_budget && (
                  <div className="bb" style={{ marginTop: 8 }}><div className={`bf ${sr < 0 ? 'over' : sp > 80 ? 'warn' : ''}`} style={{ width: `${sp}%` }} /></div>
                )}
                {cur.set_budget && <div className="bsn" style={{ marginTop: 4 }}>₹{fmtN(setInfSpent(activeSet))} across {cur.influencers.length} influencer(s) · ₹{fmtN(sr)} remaining</div>}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h3>Content format</h3>
          <div className="sh">Pick which formats this set needs. Use + / − to set how many of each.</div>
          <div className="fmr">
            {FORMATS.map(f => (
              <div key={f} className={`fmt-chip ${cur.formats.some(x => x.name === f) ? 'sel' : ''}`} onClick={() => { toggleFormat(activeSet, f); markTouched(`set_${activeSet}_fmt`); }}>{f}</div>
            ))}
          </div>
          {showErr(`set_${activeSet}_fmt`, sv.fields.formats) && <div className="field-err" style={{ marginBottom: 10 }}>{sv.fields.formats}</div>}
          {cur.formats.length > 0 && (
            <div className="fmc">
              {cur.formats.map(f => (
                <div key={f.name} className="fmcr">
                  <span className="fmcn">{f.name}</span>
                  <div className="cnt"><button className="cbtn" onClick={() => setFormatCount(activeSet, f.name, -1)}>−</button><span className="cval">{f.count}</span><button className="cbtn" onClick={() => setFormatCount(activeSet, f.name, 1)}>+</button></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Brief & brand assets <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--muted-2)', marginLeft: 6 }}>— optional, editable later</span></h3>
          <div className="g1">
            <div className="f">
              <label className="flbl">Content brief <span className="opt">tone, do's & don'ts</span></label>
              <textarea className="inp" placeholder="e.g. Show the monsoon look — natural lighting, no filters. Mention 'rainy-day glow' once." value={cur.brief || ''} onChange={e => updateSet(activeSet, { brief: e.target.value })} />
            </div>
            <div className="dz" onClick={() => setGalleryPickerSetIdx(activeSet)}>
              <div style={{ fontSize: 22, color: 'var(--muted-2)', marginBottom: 6 }}>📎</div>
              <div className="dzh">Logos, raw footage, reference images, brand guidelines</div>
              <button className="dzb">+ Add from Gallery</button>
              {cur.assets.length > 0 && (
                <div className="acs">
                  {cur.assets.map((a, ai) => (
                    <div key={a.asset_id || a.id || ai} className="ac" onClick={e => e.stopPropagation()}>
                      <span>{a.icon || '📄'}</span><span>{a.title || a.name || a.file_name}</span>
                      {a.size && <span style={{ fontSize: 10, color: 'var(--muted-2)' }}>{a.size}</span>}
                      <span className="ax" onClick={() => updateSet(activeSet, { assets: cur.assets.filter((_, j) => j !== ai) })}>✕</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {error && <div className="err-msg">{error}</div>}
        <NavFoot nextLbl="Continue →" nextDisabled={!cur.goal} idx={2} />
      </>
    );
  };

  // ─── 2.3 Fork (handpick vs open group) ─────────────────────────────────────
  const renderFork = () => (
    <>
      <div className="sh-tag">Step 2 · Sub-step 3 of 5</div>
      <h1>Who will post this?</h1>
      <div className="subh">Two ways to find influencers for this set. Pick whichever feels right — you can change before publishing.</div>
      <div className="fk">
        <div className={`fkc ${curMode === 'handpick' ? 'sel' : ''}`} onClick={() => updateSet(activeSet, { influencer_mode: 'handpick' })}>
          <div className="fkh"><div className="fki hp">★</div><div><div className="fkt">Handpick influencers</div><div className="fks">You choose each person yourself</div></div></div>
          <div className="fkb">Browse our roster, filter by niche / city / followers / ER, pick the exact people you want. You'll set individual terms for each.</div>
          <ul className="fkp">
            <li><b>Precise control</b> over who represents your brand</li>
            <li>Set different pay for different influencers</li>
            <li>Best if you already know your audience</li>
          </ul>
        </div>
        <div className={`fkc ${curMode === 'open_group' ? 'sel' : ''}`} onClick={() => updateSet(activeSet, { influencer_mode: 'open_group' })}>
          <div className="fkh"><div className="fki grp">⊞</div><div><div className="fkt">Open group (broadcast)</div><div className="fks">Influencers matching your filters apply</div></div></div>
          <div className="fkb">Set criteria (tier · niche · city · engagement). We invite everyone who matches — first N to accept get the slots. Same terms for all.</div>
          <ul className="fkp">
            <li><b>Fast</b> — no manual picking needed</li>
            <li>Great for bulk campaigns with a fixed cap</li>
            <li>Best when you don't care who, as long as they fit</li>
          </ul>
        </div>
      </div>
      {error && <div className="err-msg">{error}</div>}
      <NavFoot nextLbl={`Continue with ${curMode === 'open_group' ? 'Open group' : 'Handpick'} →`} nextDisabled={!curMode} idx={3} />
    </>
  );

  // ─── 2.4a Handpick browse ──────────────────────────────────────────────────
  const renderHandpickPick = () => {
    const totalPages = Math.max(1, Math.ceil(browseTotal / 20));
    return (
      <>
        <div className="sh-tag">Step 2 · Sub-step 4 of 5 · Handpick</div>
        <h1>Pick your influencers</h1>
        <div className="subh">Search + filter to narrow down. Tap a card to add. You'll configure individual terms in the next sub-step.</div>

        {infGroups.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>Add from saved group</div>
            <div className="grpch">
              {infGroups.map(g => (
                <div key={g.id} className="grpc" onClick={() => addGroupToSet(activeSet, g.id)}>
                  {g.name} <span className="ct">{g.influencer_ids.length}</span>
                  <span className="x" onClick={e => { e.stopPropagation(); deleteGroup(g.id); }}>×</span>
                </div>
              ))}
              <button className="btn btn-back btn-sm" onClick={openGroupModal}>+ New group</button>
            </div>
          </div>
        )}
        {infGroups.length === 0 && <div style={{ marginBottom: 14 }}><button className="btn btn-back btn-sm" onClick={openGroupModal}>+ Create influencer group</button></div>}

        <div className="bh">
          <input className="bs" placeholder="Search by name or @handle…" value={browseQuery} onChange={e => setBrowseQuery(e.target.value)} />
          <button className={`fc ${browseFiltersOpen ? 'act' : ''}`} onClick={() => setBrowseFiltersOpen(p => !p)}>{browseFiltersOpen ? 'Hide filters' : 'Filters'}</button>
          {(browseNiche || browseTier || browseCity || browseMinFollowers || browseMaxFollowers || browseMinEr) && <button className="fc clear" onClick={clearBrowseFilters}>Clear all</button>}
        </div>

        {browseFiltersOpen && (
          <div className="bf">
            <div className="bff"><label>Niche</label><select value={browseNiche} onChange={e => setBrowseNiche(e.target.value)}><option value="">All</option>{NICHES.map(n => <option key={n} value={n}>{n}</option>)}</select></div>
            <div className="bff"><label>Tier</label><select value={browseTier} onChange={e => setBrowseTier(e.target.value)}><option value="">All</option>{TIERS.map(t => <option key={t.key} value={t.key}>{t.label} ({t.sub})</option>)}</select></div>
            <div className="bff"><label>City</label><input placeholder="e.g. Mumbai" value={browseCity} onChange={e => setBrowseCity(e.target.value)} /></div>
            <div className="bff"><label>Min followers</label><input type="number" placeholder="5000" value={browseMinFollowers} onChange={e => setBrowseMinFollowers(e.target.value)} /></div>
            <div className="bff"><label>Max followers</label><input type="number" placeholder="100000" value={browseMaxFollowers} onChange={e => setBrowseMaxFollowers(e.target.value)} /></div>
            <div className="bff"><label>Min ER %</label><input type="number" step="0.1" placeholder="3" value={browseMinEr} onChange={e => setBrowseMinEr(e.target.value)} /></div>
          </div>
        )}

        {browseLoading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-2)' }}>Searching…</div> :
         browseResults.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-2)' }}>No influencers match these filters.</div> :
         (
           <div className="bg-grid">
             {browseResults.map(inf => {
               const usedIds = allUsedIds();
               const alreadyInSet = !inf.is_unclaimed && usedIds.includes(inf.id);
               const selKey = inf.is_unclaimed ? `u:${inf.row_id}` : `o:${inf.id}`;
               const isSelected = browseSelected.some(s => (s.is_unclaimed ? `u:${s.row_id}` : `o:${s.id}`) === selKey);
               const initials = (inf.full_name || inf.instagram_handle || 'XX').slice(0, 2).toUpperCase();
               const er = Number(inf.engagement_rate || 0);
               const niches = [...(inf.niche || []), ...(inf.secondary_niche || [])].slice(0, 2);
               return (
                 <div key={selKey} className={`bgc ${isSelected ? 'sel' : ''} ${alreadyInSet ? 'already' : ''}`} onClick={() => !alreadyInSet && toggleBrowseSelect(inf)} title={inf.is_unclaimed ? 'Not on Inflx yet — selecting creates an admin outreach invite' : alreadyInSet ? 'Already added to this set' : ''}>
                   <div className="bgc-chk">{alreadyInSet ? '✓' : isSelected ? '✓' : ''}</div>
                   {inf.profile_image_url ? <div className="bav"><img src={inf.profile_image_url} alt={inf.instagram_handle} onError={e => { e.currentTarget.style.display = 'none'; }} /></div> : <div className="bav">{initials}</div>}
                   <div className="bgi">
                     <div className="bgn">{inf.full_name || inf.instagram_handle}
                       {inf.is_inflx_verified && <span className="bv">✓ VRF</span>}
                       {inf.is_unclaimed && <span className="bi">✉ INV</span>}
                     </div>
                     <div className="bgm">@{inf.instagram_handle}{inf.city ? ` · ${inf.city}` : ''}{inf.tier ? ` · ${inf.tier}` : ''}</div>
                     <div className="bst">
                       <span className="bst-i">{fmtNum(inf.followers_count)}</span>
                       <span className={`bst-i ${er >= 5 ? 'er-high' : ''}`}>{er.toFixed(2)}% ER</span>
                       {niches.map(n => <span key={n} className="bst-i">{n}</span>)}
                     </div>
                   </div>
                 </div>
               );
             })}
           </div>
         )
        }

        <div className="bpr">
          <div className="bpr-l">Page <b style={{ color: 'var(--ink)', fontFamily: "'JetBrains Mono'" }}>{browsePage}</b> of {totalPages} · {browseTotal} total</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {browseSelected.length > 0 && <span className="bpr-sc">{browseSelected.length} selected</span>}
            <button className="btn btn-back btn-sm" disabled={browsePage <= 1} onClick={() => doBrowseSearch(browsePage - 1)}>‹ Prev</button>
            <button className="btn btn-back btn-sm" disabled={browsePage >= totalPages} onClick={() => doBrowseSearch(browsePage + 1)}>Next ›</button>
            <button className="btn btn-prim btn-sm" disabled={browseSelected.length === 0} onClick={() => addBrowseSelectedToSet(activeSet)}>
              {(() => {
                const u = browseSelected.filter(s => s.is_unclaimed).length;
                const o = browseSelected.length - u;
                if (browseSelected.length === 0) return 'Add selected';
                if (u && o) return `Add ${o} · Invite ${u}`;
                if (u) return `Invite ${u}`;
                return `Add ${o} selected`;
              })()}
            </button>
          </div>
        </div>

        {cur.influencers.length > 0 && (
          <div style={{ marginTop: 14, padding: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>{cur.influencers.length} added to this set</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {cur.influencers.map((inf, ii) => (
                <div key={ii} className="ac">
                  <div className="bav" style={{ width: 22, height: 22, fontSize: 9, borderRadius: 6 }}>{inf.init}</div>
                  <span>{inf.name || inf.handle}</span>
                  <span className="ax" onClick={() => removeInfluencer(activeSet, ii)}>✕</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div className="err-msg">{error}</div>}
        <NavFoot nextLbl="Set their terms →" nextDisabled={cur.influencers.length === 0} idx={4} />
      </>
    );
  };

  // ─── 2.4b Open group ───────────────────────────────────────────────────────
  const toggleChip = (field, val) => {
    const cur = sets[activeSet].group[field] || [];
    const next = cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val];
    updateGroup(activeSet, { [field]: next });
    fetchMatches(activeSet, { ...sets[activeSet].group, [field]: next });
  };
  const renderOpenGroupPick = () => (
    <>
      <div className="sh-tag green">Step 2 · Sub-step 4 of 5 · Open group</div>
      <h1>Who can apply?</h1>
      <div className="subh">Set the filters — we'll invite everyone who matches. First to accept wins the slot. You'll set shared terms in the next sub-step.</div>

      <div className="gp">
        <div className="gpr">
          <div className="gprh"><div className="gprt">Influencer tier</div><div className="gprs">Pick one or more</div></div>
          <div className="gpc">{TIERS.map(t => <div key={t.key} className={`fc ${cur.group.tiers.includes(t.key) ? 'act' : ''}`} onClick={() => toggleChip('tiers', t.key)}>{t.label} <span className="fc-cnt">{t.sub}</span></div>)}</div>
        </div>
        <div className="gpr">
          <div className="gprh"><div className="gprt">Niche</div></div>
          <div className="gpc">{NICHES.map(n => <div key={n} className={`fc ${cur.group.niches.includes(n) ? 'act' : ''}`} onClick={() => toggleChip('niches', n)}>{n}</div>)}</div>
        </div>
        <div className="gpr">
          <div className="gprh"><div className="gprt">City</div></div>
          <div className="gpc">{CITIES.map(c => <div key={c} className={`fc ${cur.group.cities.includes(c) ? 'act' : ''}`} onClick={() => toggleChip('cities', c)}>{c}</div>)}</div>
        </div>
        <div className="g2" style={{ marginTop: 14 }}>
          <div className="f"><label className="flbl">Min engagement rate (%)</label><input className="inp mono" value={cur.group.min_er || ''} onChange={e => { updateGroup(activeSet, { min_er: e.target.value }); fetchMatches(activeSet, { ...cur.group, min_er: e.target.value }); }} /></div>
          <div className="f"><label className="flbl">Gender <span className="opt">optional</span></label><select className="inp" value={cur.group.gender || ''} onChange={e => { updateGroup(activeSet, { gender: e.target.value }); fetchMatches(activeSet, { ...cur.group, gender: e.target.value }); }}><option value="">Any</option>{GENDERS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}</select></div>
          <div className="f">
            <label className="flbl">Max influencers to invite</label>
            <input className={`inp mono ${showErr(`set_${activeSet}_cap`, sv.group?.max_cap) ? 'err' : ''}`} type="number" value={cur.group.max_cap || ''} onChange={e => { updateGroup(activeSet, { max_cap: e.target.value }); markTouched(`set_${activeSet}_cap`); }} />
            <div className="fhint">First N to accept fill the slots.</div>
            {showErr(`set_${activeSet}_cap`, sv.group?.max_cap) && <div className="field-err">{sv.group.max_cap}</div>}
          </div>
          {needsBudget(cur.goal) && (
            <div className="f">
              <label className="flbl">Per-influencer fee cap (₹)</label>
              <input className={`inp mono ${showErr(`set_${activeSet}_pib`, sv.group?.per_influencer_budget) ? 'err' : ''}`} type="number" value={cur.group.per_influencer_budget || ''}
                onChange={e => { updateGroup(activeSet, { per_influencer_budget: e.target.value }); markTouched(`set_${activeSet}_pib`); }} />
              <div className="fhint">Total escrow lock: ₹{fmtN((Number(cur.group.per_influencer_budget) || 0) * (Number(cur.group.max_cap) || 0))}</div>
              {showErr(`set_${activeSet}_pib`, sv.group?.per_influencer_budget) && <div className="field-err">{sv.group.per_influencer_budget}</div>}
            </div>
          )}
        </div>

        <div className="mp">
          <div>
            <div className="mp-n">{matchResult.count || 0}</div>
            <div className="mp-l">influencers match these filters right now</div>
          </div>
          <div className="mp-av">
            {(matchResult.influencers || []).slice(0, 4).map((m, i) => <div key={i} className="bav">{(m.full_name || m.instagram_handle || 'X').slice(0, 2).toUpperCase()}</div>)}
            {matchResult.count > 4 && <div className="bav" style={{ background: 'var(--ink)', color: 'var(--yellow)' }}>+{matchResult.count - 4}</div>}
          </div>
        </div>
      </div>

      {error && <div className="err-msg">{error}</div>}
      <NavFoot nextLbl="Set shared terms →" nextDisabled={!cur.group.max_cap || cur.group.tiers.length === 0} idx={4} />
    </>
  );

  // ─── Offer config sub-form (shared between handpick + open_group) ──────────
  const renderOfferConfig = (o, isGroup) => {
    if (!o.offer_type) return <div style={{ fontSize: 11.5, color: 'var(--muted-2)', textAlign: 'center', padding: 14, background: 'var(--bg)', borderRadius: 10 }}>Pick an offer type above to configure</div>;
    const si = activeSet;
    const ii = isGroup ? null : activeTermsInf;
    const onChg = (field, value) => isGroup ? updateGroup(si, { [field]: value }) : updateInf(si, ii, { [field]: value });
    const prodChips = (arr, field) => (
      <div className="prod-sel">
        {(arr || []).map(p => <div key={p.id} className="psc">{p.name} <span className="px" onClick={() => onChg(field, (arr || []).filter(x => x.id !== p.id))}>✕</span></div>)}
        <button className="spb" onClick={() => openModal({ si, ii, field, currentSel: arr || [], multi: true, isGroup })}>+ Select products</button>
      </div>
    );
    const singleChip = (p, field, label) => (
      <button className="spb" style={{ width: '100%', textAlign: 'left' }} onClick={() => openModal({ si, ii, field, currentSel: p ? [p] : [], multi: false, isGroup })}>
        {p ? p.name : `+ Pick ${label}`}
      </button>
    );
    const scopeToggle = (scopeField, catField, valScope, valCat) => (
      <>
        <div className="tog">
          {['store','category','products'].map(s => (
            <button key={s} className={valScope === s ? 'act' : ''} onClick={() => onChg(scopeField, s)}>{s === 'store' ? 'Whole store' : s === 'category' ? 'Category' : 'Products'}</button>
          ))}
        </div>
        {valScope === 'category' && (
          brandSections.length > 0 ? (
            <select className="inp" style={{ marginTop: 8 }} value={valCat || ''} onChange={e => onChg(catField, e.target.value)}>
              <option value="">Pick a section</option>
              {brandSections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : <div style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 8 }}>Add products to your catalogue to enable section filtering.</div>
        )}
      </>
    );
    return (
      <>
        {o.offer_type === 'Discount' && (
          <div className="oc-sec">
            <h5>Discount value</h5>
            <div className="oc-row">
              <div className="tog"><button className={o.d_sub === 'pct' ? 'act' : ''} onClick={() => onChg('d_sub', 'pct')}>%</button><button className={o.d_sub === 'flat' ? 'act' : ''} onClick={() => onChg('d_sub', 'flat')}>₹</button></div>
              <input className="inp mono" value={o.d_val || ''} onChange={e => onChg('d_val', e.target.value)} />
            </div>
            <h5 style={{ marginTop: 14 }}>Applies to</h5>
            {scopeToggle('d_scope', 'd_category', o.d_scope, o.d_category)}
            {o.d_scope === 'products' && prodChips(o.d_prods, 'd_prods')}
          </div>
        )}
        {o.offer_type === 'Volume discount' && (
          <div className="oc-sec">
            <h5>Spend tiers</h5>
            {(o.v_tiers || []).map((t, ti) => (
              <div key={ti} className="g2" style={{ marginBottom: 6 }}>
                <div className="f"><label className="flbl">Min spend (₹)</label><input className="inp mono" value={t.min_spend || ''} onChange={e => { const next = [...o.v_tiers]; next[ti] = { ...t, min_spend: e.target.value }; onChg('v_tiers', next); }} /></div>
                <div className="f"><label className="flbl">% off</label><div style={{ display: 'flex', gap: 6 }}><input className="inp mono" value={t.pct_off || ''} onChange={e => { const next = [...o.v_tiers]; next[ti] = { ...t, pct_off: e.target.value }; onChg('v_tiers', next); }} />{(o.v_tiers || []).length > 1 && <button className="btn btn-back btn-sm" onClick={() => onChg('v_tiers', o.v_tiers.filter((_, i) => i !== ti))}>✕</button>}</div></div>
              </div>
            ))}
            <button className="btn btn-back btn-sm" onClick={() => onChg('v_tiers', [...(o.v_tiers || []), { min_spend: '', pct_off: '' }])}>+ Add tier</button>
            <h5 style={{ marginTop: 14 }}>Applies to</h5>
            {scopeToggle('v_scope', 'v_category', o.v_scope, o.v_category)}
            {o.v_scope === 'products' && prodChips(o.v_prods, 'v_prods')}
          </div>
        )}
        {o.offer_type === 'BOGO' && (
          <div className="oc-sec">
            <h5>Buy 1 get 1</h5>
            <div className="g2"><div className="f"><label className="flbl">Buy this</label>{singleChip(o.bogo_buy, 'bogoBuy', 'buy product')}</div><div className="f"><label className="flbl">Get this free</label>{singleChip(o.bogo_get, 'bogoGet', 'free product')}</div></div>
          </div>
        )}
        {o.offer_type === 'Bundle' && (
          <div className="oc-sec">
            <h5>Bundle</h5>
            <div className="f"><label className="flbl">Products in bundle</label>{prodChips(o.bnd_prods, 'bnd_prods')}</div>
            <div className="f" style={{ marginTop: 10 }}><label className="flbl">Bundle price (₹)</label><input className="inp mono" value={o.bnd_price || ''} onChange={e => onChg('bnd_price', e.target.value)} /></div>
          </div>
        )}
        {o.offer_type === 'Free gift' && (
          <div className="oc-sec">
            <h5>Free gift offers</h5>
            {(o.gift_offers || []).map((go, gi) => (
              <div key={gi} className="g2" style={{ marginBottom: 8 }}>
                <div className="f"><label className="flbl">Main product</label>{singleChip(go.main, 'giftMain', 'main product')}</div>
                <div className="f"><label className="flbl">Free gift</label><div style={{ display: 'flex', gap: 6 }}><button className="spb" style={{ flex: 1, textAlign: 'left' }} onClick={() => openModal({ si, ii, field: 'giftItem', currentSel: go.gift ? [go.gift] : [], multi: false, isGroup, giIdx: gi })}>{go.gift ? go.gift.name : '+ Pick gift'}</button>{(o.gift_offers || []).length > 1 && <button className="btn btn-back btn-sm" onClick={() => onChg('gift_offers', o.gift_offers.filter((_, i) => i !== gi))}>✕</button>}</div></div>
              </div>
            ))}
            <button className="btn btn-back btn-sm" onClick={() => onChg('gift_offers', [...(o.gift_offers || []), { main: null, gift: null }])}>+ Add gift offer</button>
          </div>
        )}
      </>
    );
  };

  // ─── 2.5 Terms ─────────────────────────────────────────────────────────────
  const renderTerms = () => {
    if (curMode === 'open_group') {
      const g = cur.group;
      const onGroupChg = (field, value) => updateGroup(activeSet, { [field]: value });
      return (
        <>
          <div className="sh-tag">Step 2 · Sub-step 5 of 5</div>
          <h1>Set shared terms</h1>
          <div className="subh">Everyone who applies and is accepted gets these same terms.</div>

          <div className="te">
            <h4>Pay & commission</h4>
            <div className="sh">Applies to every influencer who fills a slot.</div>
            <div className="g2">
              {needsBudget(cur.goal) && (
                <div className="f"><label className="flbl">Per-influencer fee (₹)</label><input className="inp mono" value={g.per_influencer_budget || ''} onChange={e => onGroupChg('per_influencer_budget', e.target.value)} /></div>
              )}
              {needsOffer(cur.goal) && (
                <div className="f">
                  <label className="flbl">Commission % per sale</label>
                  <input className={`inp mono ${showErr(`set_${activeSet}_gcp`, sv.group?.commission_pct) ? 'err' : ''}`} value={g.commission_pct || ''} onChange={e => { onGroupChg('commission_pct', e.target.value); markTouched(`set_${activeSet}_gcp`); }} />
                  {showErr(`set_${activeSet}_gcp`, sv.group?.commission_pct) && <div className="field-err">{sv.group.commission_pct}</div>}
                </div>
              )}
            </div>
          </div>

          {needsOffer(cur.goal) && (
            <div className="te">
              <h4>Offer for the audience</h4>
              <div className="sh">What followers get when they use the coupon.</div>
              <div className="oc-types">
                {OFFER_TYPES.map(ot => <div key={ot} className={`fmt-chip ${g.offer_type === ot ? 'sel' : ''}`} onClick={() => onGroupChg('offer_type', ot)}>{ot}</div>)}
              </div>
              {renderOfferConfig(g, true)}
            </div>
          )}

          {error && <div className="err-msg">{error}</div>}
          <NavFoot nextLbl="Finish set → Review" nextDisabled={false} idx={5} />
        </>
      );
    }
    // handpick — split list+editor
    const infs = cur.influencers;
    if (infs.length === 0) {
      return (
        <>
          <div className="sh-tag">Step 2 · Sub-step 5 of 5</div>
          <h1>Set their terms</h1>
          <div className="subh">No influencers added yet. Go back to step 4 to pick some.</div>
          <NavFoot nextLbl="Finish set → Review" nextDisabled={true} idx={5} />
        </>
      );
    }
    const ai = Math.min(activeTermsInf, infs.length - 1);
    const inf = infs[ai];
    const infErr = sv.influencers[ai] || {};
    const onInfChg = (field, value) => updateInf(activeSet, ai, { [field]: value });
    const applyAll = () => {
      const patch = {
        post_date: inf.post_date,
        influencer_budget: inf.influencer_budget,
        commission_pct: inf.commission_pct,
        offer_type: inf.offer_type,
        physical_delivery: inf.physical_delivery,
        d_sub: inf.d_sub, d_val: inf.d_val, d_prods: inf.d_prods, d_scope: inf.d_scope, d_category: inf.d_category,
        v_tiers: inf.v_tiers, v_prods: inf.v_prods, v_scope: inf.v_scope, v_category: inf.v_category,
        bogo_buy: inf.bogo_buy, bogo_get: inf.bogo_get,
        bnd_prods: inf.bnd_prods, bnd_price: inf.bnd_price,
        gift_offers: inf.gift_offers,
      };
      setSets(prev => prev.map((s, si) => si !== activeSet ? s : { ...s, influencers: s.influencers.map(i => ({ ...i, ...patch })) }));
    };
    return (
      <>
        <div className="sh-tag">Step 2 · Sub-step 5 of 5</div>
        <h1>Set their terms</h1>
        <div className="subh">Pick an influencer from the left to configure their pay, post date, and offer. Use <b>Apply to all</b> to copy across everyone.</div>

        <div className="tw">
          <div>
            <div className="tlh">
              <span className="tlh-ct">{infs.length} added</span>
              <button className="bulk" onClick={applyAll}>Apply to all</button>
            </div>
            <div className="tl">
              {infs.map((i, idx) => {
                const errs = sv.influencers[idx] || {};
                const missing = Object.keys(errs).length;
                return (
                  <div key={idx} className={`ti ${ai === idx ? 'act' : ''} ${missing > 0 ? 'incomplete' : ''}`} onClick={() => setActiveTermsInf(idx)}>
                    <div className="bav">{i.init}</div>
                    <div className="ti-m">
                      <div className="ti-n">{i.name || i.handle}</div>
                      <div className="ti-h">{i.handle}</div>
                    </div>
                    <span className={`ti-s ${missing === 0 ? 'ok' : ''}`}>{missing === 0 ? '✓' : `${missing} missing`}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="te">
              <h4>{inf.name || inf.handle} · pay & post</h4>
              <div className="sh">What you agree to pay them and when they should post.</div>
              <div className="g2">
                {needsBudget(cur.goal) && (
                  <div className="f">
                    <label className="flbl">Engagement fee (₹)</label>
                    <input className={`inp mono ${showErr(`inf_${activeSet}_${ai}_b`, infErr.influencer_budget) ? 'err' : ''}`} value={inf.influencer_budget || ''} onChange={e => { onInfChg('influencer_budget', e.target.value); markTouched(`inf_${activeSet}_${ai}_b`); }} />
                    {showErr(`inf_${activeSet}_${ai}_b`, infErr.influencer_budget) && <div className="field-err">{infErr.influencer_budget}</div>}
                  </div>
                )}
                {needsOffer(cur.goal) && (
                  <div className="f">
                    <label className="flbl">Commission % per sale</label>
                    <input className={`inp mono ${showErr(`inf_${activeSet}_${ai}_c`, infErr.commission_pct) ? 'err' : ''}`} value={inf.commission_pct || ''} onChange={e => { onInfChg('commission_pct', e.target.value); markTouched(`inf_${activeSet}_${ai}_c`); }} />
                    {showErr(`inf_${activeSet}_${ai}_c`, infErr.commission_pct) && <div className="field-err">{infErr.commission_pct}</div>}
                  </div>
                )}
                <div className="f">
                  <label className="flbl">Post date</label>
                  <input className={`inp mono ${showErr(`inf_${activeSet}_${ai}_p`, infErr.post_date) ? 'err' : ''}`} type="date" value={inf.post_date || ''} min={cur.window_start || undefined} max={cur.window_end || undefined}
                    onChange={e => { onInfChg('post_date', e.target.value); markTouched(`inf_${activeSet}_${ai}_p`); }} />
                  <div className="fhint">Submits by {calcDeadline(inf.post_date) || '—'} (auto: posting − 1)</div>
                  {showErr(`inf_${activeSet}_${ai}_p`, infErr.post_date) && <div className="field-err">{infErr.post_date}</div>}
                </div>
                {needsCoupon(cur.goal) && (
                  <div className="f">
                    <label className="flbl">Coupon code <span className="opt">default: {autoCode(cur.coupon_prefix, inf.name)}</span></label>
                    <input className="inp mono" value={inf.custom_code || ''} placeholder={autoCode(cur.coupon_prefix, inf.name)} onChange={e => onInfChg('custom_code', e.target.value.toUpperCase())} />
                  </div>
                )}
                <div className="f" style={{ gridColumn: 'span 2' }}>
                  <label className="flbl">Physical product delivery?</label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 11, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--white)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!inf.physical_delivery} onChange={e => onInfChg('physical_delivery', e.target.checked)} style={{ marginTop: 2, accentColor: 'var(--yellow)', width: 16, height: 16 }} />
                    <span>
                      <div style={{ fontWeight: 700, fontSize: 12.5 }}>Send product samples</div>
                      <div style={{ fontSize: 10.5, color: 'var(--muted-2)', marginTop: 2 }}>Set up visit / shipment after both parties sign.</div>
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {needsOffer(cur.goal) && (
              <div className="te">
                <h4>Offer for {inf.name || inf.handle}'s audience</h4>
                <div className="sh">What their followers get when they use the coupon.</div>
                <div className="oc-types">
                  {OFFER_TYPES.map(ot => <div key={ot} className={`fmt-chip ${inf.offer_type === ot ? 'sel' : ''}`} onClick={() => { onInfChg('offer_type', ot); markTouched(`inf_${activeSet}_${ai}_ot`); }}>{ot}</div>)}
                </div>
                {showErr(`inf_${activeSet}_${ai}_ot`, infErr.offer_type) && <div className="field-err" style={{ marginBottom: 10 }}>{infErr.offer_type}</div>}
                {renderOfferConfig(inf, false)}
              </div>
            )}

            <div className="sfa">
              <button className="btn btn-back btn-sm" onClick={() => duplicateSet(activeSet)}>⧉ Duplicate set</button>
              {sets.length > 1 && <button className="btn btn-danger btn-sm" onClick={() => deleteSet(activeSet)}>Delete set</button>}
            </div>
          </div>
        </div>

        {error && <div className="err-msg">{error}</div>}
        <NavFoot nextLbl="Finish set → Review" nextDisabled={false} idx={5} />
      </>
    );
  };

  // ─── Sub-step router ───────────────────────────────────────────────────────
  const renderSubstep = () => {
    switch (substep) {
      case 'goal':   return renderGoal();
      case 'basics': return renderBasics();
      case 'fork':   return renderFork();
      case 'pick':   return curMode === 'open_group' ? renderOpenGroupPick() : renderHandpickPick();
      case 'terms':  return renderTerms();
      default:       return renderGoal();
    }
  };

  return (
    <div className="cc">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Topbar />
      <div className="shell">
        <aside className="col col-l"><LeftRail /></aside>
        <section className="col col-c">
          {step === 0 && renderStep1()}
          {step === 1 && renderSubstep()}
          {step === 2 && renderStep3()}
        </section>
        <aside className="col col-r"><RightRail /></aside>
      </div>

      {/* Product modal */}
      {modalOpen && (
        <div className="mo" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="mod">
            <div className="mod-h"><div><div className="mod-t">Select products</div><div style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 2 }}>Choose from your product catalogue</div></div><button className="mod-x" onClick={closeModal}>✕</button></div>
            <div className="mod-b">
              <input className="inp" placeholder="Search products…" value={modalSearch} onChange={e => setModalSearch(e.target.value)} style={{ marginBottom: 12 }} />
              <div className="cat-f">{prodCategories.map(c => <div key={c} className={`cat-c ${modalCat === c ? 'sel' : ''}`} onClick={() => setModalCat(c)}>{c}</div>)}</div>
              <div className="pg">
                {filteredProds.map(p => {
                  const sel = modalTempSel.some(s => s.id === p.id);
                  return (
                    <div key={p.id} className={`pc ${sel ? 'sel' : ''}`} onClick={() => toggleModalProd(p)}>
                      <div className="pc-img">{p.image_url ? <img src={p.image_url} alt={p.name} /> : '📦'}</div>
                      <div className="pc-n">{p.name}</div>
                      <div className="pc-p">₹{fmtN(p.price)}</div>
                      <div className="pc-m">{p.category}{p.sku ? ` · ${p.sku}` : ''}</div>
                    </div>
                  );
                })}
                {filteredProds.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: 'var(--muted-2)', fontSize: 12 }}>{products.length === 0 ? 'No products in your catalogue yet.' : 'No products match your search.'}</div>}
              </div>
            </div>
            <div className="mod-f">
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>{modalTempSel.length === 0 ? 'None selected' : `${modalTempSel.length} selected`}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-back btn-sm" onClick={closeModal}>Cancel</button>
                <button className="btn btn-prim btn-sm" onClick={confirmModal} disabled={modalTempSel.length === 0}>Confirm selection</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Group creation modal */}
      {groupModalOpen && (
        <div className="mo" onClick={e => e.target === e.currentTarget && setGroupModalOpen(false)}>
          <div className="mod" style={{ maxWidth: 560 }}>
            <div className="mod-h"><div className="mod-t">Create influencer group</div><button className="mod-x" onClick={() => setGroupModalOpen(false)}>✕</button></div>
            <div className="mod-b">
              <div className="f" style={{ marginBottom: 12 }}><label className="flbl">Group name</label><input className="inp" placeholder="e.g. Food bloggers Hyderabad" value={groupName} onChange={e => setGroupName(e.target.value)} /></div>
              <div className="f" style={{ marginBottom: 12 }}><label className="flbl">Search and select influencers</label><input className="inp" placeholder="Search by name or @handle…" value={groupSearchQ} onChange={e => doGroupSearch(e.target.value)} /></div>
              {groupSearchLoading && <div style={{ fontSize: 11, color: 'var(--muted-2)' }}>Searching…</div>}
              {groupSearchResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {groupSearchResults.map(inf => {
                    const selected = groupSelectedIds.includes(inf.id);
                    return (
                      <div key={inf.id} className={`bgc ${selected ? 'sel' : ''}`} onClick={() => toggleGroupSelect(inf.id)} style={{ padding: 10 }}>
                        <div className="bgc-chk">{selected ? '✓' : ''}</div>
                        <div className="bav" style={{ width: 28, height: 28, fontSize: 10 }}>{(inf.full_name || 'X').slice(0, 2).toUpperCase()}</div>
                        <div className="bgi"><div className="bgn">{inf.full_name || inf.instagram_handle}</div><div className="bgm">@{inf.instagram_handle}{inf.city ? ` · ${inf.city}` : ''}{inf.tier ? ` · ${inf.tier}` : ''}</div></div>
                        <div style={{ fontSize: 10, color: 'var(--muted-2)', fontFamily: "'JetBrains Mono'" }}>{fmtNum(inf.followers_count)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {groupSelectedIds.length > 0 && <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>{groupSelectedIds.length} influencer{groupSelectedIds.length !== 1 ? 's' : ''} selected</div>}
            </div>
            <div className="mod-f">
              <button className="btn btn-back btn-sm" onClick={() => setGroupModalOpen(false)}>Cancel</button>
              <button className="btn btn-prim btn-sm" onClick={saveNewGroup} disabled={!groupName.trim() || groupSelectedIds.length === 0}>Save group</button>
            </div>
          </div>
        </div>
      )}

      {/* Gallery picker */}
      <GalleryPicker
        open={galleryPickerSetIdx !== null}
        onClose={() => setGalleryPickerSetIdx(null)}
        initialSelectedIds={galleryPickerSetIdx !== null ? (sets[galleryPickerSetIdx]?.assets || []).map(a => a.asset_id || a.id).filter(Boolean) : []}
        onSelect={(picked) => {
          if (galleryPickerSetIdx === null) return;
          const si = galleryPickerSetIdx;
          const current = sets[si]?.assets || [];
          const existingKeys = new Set(current.map(a => a.file_r2_key).filter(Boolean));
          const additions = picked.filter(a => !existingKeys.has(a.file_r2_key)).map(a => ({
            asset_id: a.id, title: a.title, file_r2_key: a.file_r2_key,
            file_name: a.file_name, file_type: a.file_type, file_size_bytes: a.file_size_bytes,
            download_url: a.download_url,
            name: a.title,
            icon: (a.file_type || '').startsWith('video') ? '🎬' : (a.file_type || '').startsWith('image') ? '🖼️' : '📄',
            size: a.file_size_bytes ? `${(a.file_size_bytes / 1024).toFixed(0)} KB` : '',
          }));
          updateSet(si, { assets: [...current, ...additions] });
        }}
      />

      {duplicateToast && <div className="toast">{duplicateToast}</div>}
    </div>
  );
}

export default function NewCampaignPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>}>
      <NewCampaignPageInner />
    </Suspense>
  );
}
