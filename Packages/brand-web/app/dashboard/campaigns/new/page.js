'use client';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { campaignApi, brandApi, influencerApi, creatorInvitationApi, fmtNum } from '../../../../lib/api';
import GalleryPicker from '../../gallery/components/GalleryPicker';

// ─── Creator response mapper ────────────────────────────────────────────────
// The new GET /influencers/search returns rows from v_searchable_creators
// with field names different from the legacy influencers row. This mapper
// shapes them into the legacy form the wizard already understands, while
// preserving the new flags (source, is_inflx_verified, is_unclaimed) on
// the same object so card render + add-to-set logic can branch on them.
function mapCreator(c) {
  const isUnclaimed = c.source === 'scraped' && !c.linked_influencer_id;
  return {
    // Legacy-shape fields the existing UI reads
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
    // New flags carried through for badge + branching
    source:           c.source,
    row_id:           c.row_id,
    ig_handle:        c.ig_handle,
    linked_influencer_id: c.linked_influencer_id,
    is_inflx_verified: !!c.is_inflx_verified,
    is_unclaimed:     isUnclaimed,
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const FORMATS = ['Instagram reel', 'Instagram stories', 'Instagram post', 'YouTube short', 'YouTube video'];
const NICHES   = ['Food','Fashion','Fitness','Travel','Lifestyle','Beauty','Tech','Gaming','Finance','Parenting'];
const CITIES   = ['Mumbai','Delhi','Bengaluru','Hyderabad','Chennai','Vijayawada','Pune','Kolkata','Jaipur','Ahmedabad'];
const TIERS    = [{key:'nano',label:'Nano',sub:'1K–10K'},{key:'micro',label:'Micro',sub:'10K–100K'},{key:'macro',label:'Macro',sub:'100K–1M'},{key:'mega',label:'Mega',sub:'1M+'}];
const OFFER_TYPES = ['Discount','Volume discount','BOGO','Bundle','Free gift'];
const LANGUAGES = ['English','Hindi','Telugu','Tamil','Kannada','Malayalam','Marathi','Bengali','Gujarati','Punjabi','Urdu'];
const GENDERS = [{key:'male',label:'Male'},{key:'female',label:'Female'},{key:'non_binary',label:'Non-binary'}];
const PHYSICAL_GOODS_CATEGORIES = ['fashion_walkin', 'fashion_online', 'electronics', 'jewellery', 'footwear', 'furniture', 'pet_shop', 'flowers_gifting', 'grocery', 'hardware', 'bakery', 'packaged_food', 'optical'];

// ─── Influencer Groups (localStorage) ────────────────────────────────────────
const GROUPS_KEY = 'inflx_influencer_groups';
function loadGroups() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]'); } catch { return []; }
}
function saveGroups(groups) {
  if (typeof window !== 'undefined') localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
.cc-root *{box-sizing:border-box}
.cc-root{
  --bg:#0D1117;--s1:#161B22;--s2:#1C2128;--s3:#22272E;--s4:#2D333B;
  --border:#30363D;--border2:#444C56;
  --t1:#E6EDF3;--t2:#8B949E;--t3:#484F58;
  --orange:#F47920;--orange-l:rgba(244,121,32,.15);--orange-d:#D4601A;
  --gold:#FFB800;--gold-l:rgba(255,184,0,.12);
  --teal:#00B894;--teal-l:rgba(0,184,148,.12);--teal-d:#007A63;
  --red:#E8401A;--red-l:rgba(232,64,26,.12);
  --conv:#F47920;--conv-l:rgba(244,121,32,.12);
  --eng:#00B894;--eng-l:rgba(0,184,148,.10);
  --hyb:#FFB800;--hyb-l:rgba(255,184,0,.10);
  --group:#68D391;--group-l:rgba(104,211,145,.10);
  font-family:'Plus Jakarta Sans',sans-serif;
  background:var(--bg);color:var(--t1);min-height:100vh;padding:2rem 1rem;
  -webkit-font-smoothing:antialiased;
}
.cc-page{max-width:720px;margin:0 auto}
.cc-topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:2.5rem}
.cc-logo{font-family:'Outfit',sans-serif;font-size:22px;font-weight:800}
.cc-logo .x{background:linear-gradient(135deg,#E8401A,#F47920,#FFB800);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.cc-exit{font-size:11px;font-weight:600;color:var(--t3);border:1px solid var(--border);border-radius:20px;padding:5px 14px;background:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif}
.cc-exit:hover{color:var(--t2);border-color:var(--border2)}
.cc-prog{display:flex;align-items:center;margin-bottom:2.5rem;padding:0 4px}
.cc-step-wrap{display:flex;flex-direction:column;align-items:center;gap:7px;flex-shrink:0}
.cc-sdot{width:34px;height:34px;border-radius:50%;border:1.5px solid var(--border2);background:var(--s2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--t3);font-family:'JetBrains Mono',monospace;transition:all .3s}
.cc-sdot.done{background:var(--teal-l);border-color:var(--teal);color:var(--teal)}
.cc-sdot.act{background:var(--orange);border-color:var(--orange);color:#fff;box-shadow:0 0 0 4px var(--orange-l)}
.cc-slbl{font-size:10px;font-weight:700;color:var(--t3);letter-spacing:.5px;text-transform:uppercase;white-space:nowrap}
.cc-slbl.done{color:var(--teal)}.cc-slbl.act{color:var(--orange)}
.cc-pline{flex:1;height:1px;background:var(--border);margin:0 6px;margin-bottom:22px}
.cc-pline.done{background:var(--teal)}
.cc-card{background:var(--s1);border:1px solid var(--border);border-radius:24px;padding:2rem;position:relative;overflow:hidden}
.cc-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--border2),transparent)}
.cc-ct{font-family:'Outfit',sans-serif;font-size:20px;font-weight:700;letter-spacing:-.3px;margin-bottom:5px}
.cc-cs{font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:1.75rem}
.f{margin-bottom:1rem}
.flbl{display:block;font-size:10px;font-weight:700;color:var(--t3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px}
.flbl .note{font-size:10px;font-weight:400;text-transform:none;letter-spacing:0;color:var(--t3);margin-left:4px}
.inp{width:100%;font-size:13px;font-family:'Plus Jakarta Sans',sans-serif;padding:10px 13px;border:1px solid var(--border2);border-radius:10px;background:var(--s2);color:var(--t1);outline:none}
.inp:focus{border-color:var(--orange);box-shadow:0 0 0 3px var(--orange-l)}
.inp::placeholder{color:var(--t3)}
.inp-mono{font-size:16px;font-weight:700;font-family:'JetBrains Mono',monospace}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.bstrip{background:var(--s2);border:1px solid var(--border);border-radius:16px;padding:13px 15px;margin-bottom:1.1rem}
.bstrip-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px}
.bstrip-lbl{font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.5px}
.bstrip-val{font-size:13px;font-weight:700;font-family:'JetBrains Mono',monospace}
.bv-ok{color:var(--teal)}.bv-warn{color:var(--gold)}.bv-over{color:var(--red)}
.bbar{height:4px;border-radius:2px;background:var(--s4);overflow:hidden;margin-bottom:6px}
.bfill{height:100%;border-radius:2px;background:var(--orange);transition:width .4s}
.bfill.warn{background:var(--gold)}.bfill.over{background:var(--red)}
.bstrip-note{font-size:10px;color:var(--t3)}
.goal-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:1rem}
.gc{border:1.5px solid var(--border);border-radius:16px;padding:14px 12px;cursor:pointer;background:var(--s2);transition:all .18s}
.gc:hover{border-color:var(--border2);background:var(--s3)}
.gc.sel-conv{border-color:var(--conv);background:var(--conv-l)}
.gc.sel-eng{border-color:var(--eng);background:var(--eng-l)}
.gc.sel-hyb{border-color:var(--hyb);background:var(--hyb-l)}
.gc-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;margin-bottom:9px}
.gc-name{font-family:'Outfit',sans-serif;font-size:13px;font-weight:700;margin-bottom:4px}
.gc-desc{font-size:10px;color:var(--t2);line-height:1.55}
.set-tabs{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:1rem}
.set-tab{padding:6px 14px;border:1px solid var(--border2);border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;color:var(--t2);background:none;font-family:'Plus Jakarta Sans',sans-serif}
.set-tab:hover{border-color:var(--orange);color:var(--orange)}
.set-tab.act{background:var(--orange);border-color:var(--orange);color:#fff}
.set-tab .mdot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-left:6px;vertical-align:middle}
.add-set-btn{padding:6px 13px;border:1.5px dashed var(--border2);border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;color:var(--t3);background:none;font-family:'Plus Jakarta Sans',sans-serif}
.add-set-btn:hover{border-color:var(--orange);color:var(--orange)}
.set-body{background:var(--s2);border:1px solid var(--border);border-radius:16px 16px 0 0;padding:1.25rem}
.sec{margin-bottom:1.25rem}
.sec-lbl{font-size:10px;font-weight:700;color:var(--t3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px}
.fmt-chips{display:flex;flex-wrap:wrap;gap:6px}
.fmt-chip{padding:6px 13px;border:1px solid var(--border2);border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;color:var(--t2);background:var(--s3);transition:all .15s}
.fmt-chip.sel{background:var(--orange);border-color:var(--orange);color:#fff;font-weight:700}
.fmt-chip:hover:not(.sel){border-color:var(--orange);color:var(--orange)}
.cnt-row{display:flex;align-items:center;justify-content:space-between;background:var(--s3);border:1px solid var(--border);border-radius:10px;padding:8px 12px;margin-top:5px}
.cnt-name{font-size:12px;font-weight:600}
.counter{display:flex;align-items:center;gap:9px}
.cbtn{width:24px;height:24px;border-radius:50%;border:1px solid var(--border2);background:none;cursor:pointer;font-size:16px;color:var(--t2);display:flex;align-items:center;justify-content:center;transition:all .15s}
.cbtn:hover{border-color:var(--orange);color:var(--orange)}
.cval{font-size:14px;font-weight:700;min-width:20px;text-align:center;font-family:'JetBrains Mono',monospace;color:var(--orange)}
.assets-zone{border:1.5px dashed var(--border2);border-radius:12px;padding:14px;background:var(--s3);transition:all .15s}
.assets-zone:hover{border-color:var(--orange)}
.assets-hint{font-size:11px;color:var(--t3);text-align:center;line-height:1.5;margin-bottom:8px}
.assets-btn{font-size:11px;font-weight:700;color:var(--orange);border:1px solid rgba(244,121,32,.3);border-radius:20px;padding:5px 14px;background:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif}
.assets-btn:hover{background:var(--orange-l)}
.asset-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.asset-chip{display:flex;align-items:center;gap:6px;padding:5px 10px;background:var(--s2);border:1px solid var(--border2);border-radius:8px;font-size:11px;font-weight:500;color:var(--t2)}
.asset-chip .ax{cursor:pointer;color:var(--t3);font-size:12px;line-height:1}
.asset-chip .ax:hover{color:var(--red)}
.inf-search{width:100%;font-size:12px;font-family:'Plus Jakarta Sans',sans-serif;padding:9px 12px;border:1px solid var(--border2);border-radius:10px;background:var(--s3);color:var(--t1);outline:none}
.inf-search:focus{border-color:var(--orange)}
.inf-search::placeholder{color:var(--t3)}
.inf-list{display:flex;flex-direction:column;gap:5px;max-height:190px;overflow-y:auto;margin-top:7px}
.inf-item{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border:1px solid var(--border);border-radius:10px;background:var(--s3);transition:all .15s}
.inf-item.added{border-color:rgba(244,121,32,.4);background:var(--orange-l)}
.iav{width:30px;height:30px;border-radius:50%;background:var(--s4);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--t2);flex-shrink:0;font-family:'JetBrains Mono',monospace}
.iname{font-size:12px;font-weight:700}
.imeta{font-size:10px;color:var(--t3);margin-top:1px}
.iadd-btn{font-size:10px;font-weight:700;border:1px solid var(--border2);border-radius:20px;padding:4px 11px;background:none;cursor:pointer;color:var(--t2);font-family:'Plus Jakarta Sans',sans-serif;transition:all .15s}
.iadd-btn:hover{border-color:var(--orange);color:var(--orange)}
.iadd-btn.added{background:var(--orange);border-color:var(--orange);color:#fff}
.ic{border:1px solid var(--border);border-radius:16px;overflow:hidden;background:var(--s3);margin-top:10px}
.ic-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--s4);border-bottom:1px solid var(--border)}
.ic-name{font-size:12px;font-weight:700}
.ic-handle{font-size:10px;color:var(--t3)}
.ic-rm{font-size:11px;font-weight:700;color:var(--red);background:none;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif}
.ic-body{padding:13px 14px;display:flex;flex-direction:column;gap:11px}
.ie-lbl{font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px}
.ie-inp{width:100%;font-size:12px;font-family:'Plus Jakarta Sans',sans-serif;padding:8px 11px;border:1px solid var(--border2);border-radius:10px;background:var(--s2);color:var(--t1);outline:none}
.ie-inp:focus{border-color:var(--orange)}
.ie-inp::placeholder{color:var(--t3)}
.ie-sel{width:100%;font-size:12px;font-family:'Plus Jakarta Sans',sans-serif;padding:8px 11px;border:1px solid var(--border2);border-radius:10px;background:var(--s2);color:var(--t1);outline:none;cursor:pointer}
.post-date-row{background:rgba(244,121,32,.07);border:1px solid rgba(244,121,32,.2);border-radius:10px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.post-date-lbl{font-size:11px;color:#F4A060;font-weight:600}
.post-date-lbl small{display:block;font-size:10px;font-weight:400;color:var(--t3);margin-top:2px}
.post-date-inp{font-size:12px;font-family:'JetBrains Mono',monospace;font-weight:500;padding:7px 10px;border:1px solid rgba(244,121,32,.3);border-radius:8px;background:var(--s2);color:var(--orange);outline:none}
.post-date-inp:focus{border-color:var(--orange)}
.dl-chip{font-size:10px;font-weight:700;font-family:'JetBrains Mono',monospace;color:var(--t3);background:var(--s4);border:1px solid var(--border);border-radius:20px;padding:3px 9px;white-space:nowrap}
.ot-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}
.ot{padding:8px 11px;border:1px solid var(--border);border-radius:10px;cursor:pointer;font-size:11px;font-weight:700;color:var(--t2);background:var(--s2);transition:all .15s;font-family:'Plus Jakarta Sans',sans-serif}
.ot:hover{border-color:var(--orange);color:var(--orange)}
.ot.sel{border-color:var(--orange);background:var(--orange-l);color:var(--orange)}
.offer-cfg{background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-top:8px;display:flex;flex-direction:column;gap:10px}
.sub-tog{display:flex;border:1px solid var(--border2);border-radius:10px;overflow:hidden}
.sub-tog button{flex:1;padding:7px;font-size:11px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;background:none;border:none;cursor:pointer;color:var(--t2);transition:all .15s}
.sub-tog button.act{background:var(--orange);color:#fff}
.prod-selected{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.prod-chip-sel{display:flex;align-items:center;gap:5px;padding:4px 10px;background:var(--orange-l);border:1px solid rgba(244,121,32,.3);border-radius:20px;font-size:11px;font-weight:600;color:var(--orange)}
.prod-chip-sel .px{cursor:pointer;opacity:.7;font-size:13px;line-height:1}
.prod-chip-sel .px:hover{opacity:1}
.select-prod-btn{display:flex;align-items:center;gap:6px;padding:8px 14px;border:1.5px dashed rgba(244,121,32,.35);border-radius:10px;background:none;cursor:pointer;font-size:12px;font-weight:700;color:var(--orange);font-family:'Plus Jakarta Sans',sans-serif;width:100%;justify-content:center}
.select-prod-btn:hover{background:var(--orange-l);border-color:var(--orange)}
.vt-row{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--t2);margin-bottom:6px}
.vt-i{font-size:11px;font-family:'Plus Jakarta Sans',sans-serif;padding:6px 8px;border:1px solid var(--border2);border-radius:8px;background:var(--s3);color:var(--t1);width:72px;outline:none}
.vt-i:focus{border-color:var(--orange)}
.add-sm{font-size:11px;font-weight:700;color:var(--orange);background:none;border:1px solid rgba(244,121,32,.25);border-radius:20px;padding:5px 12px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif}
.add-sm:hover{background:var(--orange-l);border-color:var(--orange)}
.gift-block{border:1px solid var(--border);border-radius:10px;padding:10px;background:var(--s3);margin-bottom:7px}
.gift-rm{font-size:10px;font-weight:700;color:var(--red);background:none;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif}
.cpn-row{display:flex;align-items:center;gap:8px}
.cpn-pill{flex:1;padding:8px 12px;background:rgba(244,121,32,.1);border:1px solid rgba(244,121,32,.25);border-radius:10px;font-size:12px;font-weight:700;color:var(--orange);font-family:'JetBrains Mono',monospace;letter-spacing:.5px}
.cpn-edit{font-size:11px;font-weight:700;color:var(--orange);background:none;border:1px solid rgba(244,121,32,.2);border-radius:20px;padding:5px 12px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif}
.cpn-edit:hover{background:var(--orange-l)}
.phys-check{display:flex;align-items:flex-start;gap:9px;padding:9px 12px;border:1px solid var(--border);border-radius:10px;background:var(--s2);cursor:pointer;transition:all .15s}
.phys-check:hover{border-color:var(--border2)}
.phys-lbl{font-size:12px;font-weight:600}
.phys-sub{font-size:10px;color:var(--t3);margin-top:2px}
.mode-toggle{display:flex;background:var(--s3);border:1px solid var(--border2);border-radius:16px;padding:4px;gap:4px;margin-bottom:1.1rem}
.mode-btn{flex:1;padding:10px 12px;border:none;border-radius:12px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:700;background:none;color:var(--t3);transition:all .2s;display:flex;align-items:center;justify-content:center;gap:7px}
.mode-btn:hover{color:var(--t2)}
.mode-btn.act-hp{background:var(--s1);color:var(--orange);box-shadow:0 1px 3px rgba(0,0,0,.3)}
.mode-btn.act-grp{background:var(--s1);color:var(--group);box-shadow:0 1px 3px rgba(0,0,0,.3)}
.group-panel{background:var(--s3);border:1px solid rgba(104,211,145,.2);border-radius:16px;overflow:hidden}
.group-panel-head{padding:12px 15px;background:rgba(104,211,145,.06);border-bottom:1px solid rgba(104,211,145,.15)}
.group-panel-title{font-size:12px;font-weight:700;color:var(--group);font-family:'Outfit',sans-serif}
.group-panel-body{padding:14px 15px;display:flex;flex-direction:column;gap:14px}
.filter-title{font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
.filter-chips{display:flex;flex-wrap:wrap;gap:6px}
.fchip{padding:6px 13px;border:1px solid var(--border2);border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;color:var(--t2);background:var(--s4);transition:all .15s}
.fchip:hover{border-color:var(--group);color:var(--group)}
.fchip.sel{background:rgba(104,211,145,.12);border-color:var(--group);color:var(--group)}
.filter-row{display:flex;gap:10px;flex-wrap:wrap}
.filter-field{flex:1;min-width:120px}
.filter-inp{width:100%;font-size:12px;font-family:'Plus Jakarta Sans',sans-serif;padding:8px 11px;border:1px solid var(--border2);border-radius:10px;background:var(--s2);color:var(--t1);outline:none}
.filter-inp:focus{border-color:var(--group)}
.filter-sel{width:100%;font-size:12px;font-family:'Plus Jakarta Sans',sans-serif;padding:8px 11px;border:1px solid var(--border2);border-radius:10px;background:var(--s2);color:var(--t1);outline:none;cursor:pointer}
.match-preview{background:rgba(104,211,145,.06);border:1px solid rgba(104,211,145,.2);border-radius:10px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.match-count{font-size:24px;font-weight:800;color:var(--group);font-family:'JetBrains Mono',monospace}
.match-label{font-size:11px;color:var(--t2);margin-top:2px}
.match-avs{display:flex}
.match-av{width:26px;height:26px;border-radius:50%;background:var(--s4);border:2px solid var(--s3);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:var(--t2);font-family:'JetBrains Mono',monospace;margin-left:-6px}
.match-av:first-child{margin-left:0}
.cap-inp{width:80px;font-size:14px;font-weight:700;font-family:'JetBrains Mono',monospace;padding:7px 10px;border:1px solid var(--border2);border-radius:10px;background:var(--s2);color:var(--orange);outline:none;text-align:center}
.cap-inp:focus{border-color:var(--orange)}
.grp-est{background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:11px 13px}
.set-actions{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border:1px solid var(--border);border-top:none;background:var(--s2);border-radius:0 0 16px 16px}
.dup-btn{font-size:11px;font-weight:700;color:var(--t2);background:none;border:1px solid var(--border2);border-radius:20px;padding:5px 13px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:all .15s}
.dup-btn:hover{border-color:var(--orange);color:var(--orange)}
.del-set-btn{font-size:11px;font-weight:700;color:var(--t3);background:none;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:color .15s}
.del-set-btn:hover:not(:disabled){color:var(--red)}
.del-set-btn:disabled{opacity:.4;cursor:default}
.ib{padding:10px 13px;border-radius:10px;font-size:12px;line-height:1.6;margin-bottom:12px}
.ib.teal{background:var(--teal-l);color:var(--teal);border:1px solid rgba(0,184,148,.25)}
.ib.orange{background:var(--orange-l);color:var(--orange);border:1px solid rgba(244,121,32,.25)}
.ib.amber{background:var(--gold-l);color:var(--gold);border:1px solid rgba(255,184,0,.25)}
.ro{padding:10px 13px;background:var(--s3);border:1px solid var(--border);border-radius:10px;font-size:12px;color:var(--t3)}
.rv-set{border:1px solid var(--border);border-radius:16px;overflow:hidden;margin-bottom:10px}
.rv-sh{padding:11px 16px;background:var(--s2);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}
.rv-sn{font-family:'Outfit',sans-serif;font-size:13px;font-weight:700}
.gp{padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700}
.gp.conv{background:var(--conv-l);color:var(--conv);border:1px solid rgba(244,121,32,.2)}
.gp.eng{background:var(--eng-l);color:var(--eng);border:1px solid rgba(0,184,148,.2)}
.gp.hyb{background:var(--hyb-l);color:var(--hyb);border:1px solid rgba(255,184,0,.2)}
.rr{display:flex;justify-content:space-between;padding:7px 16px;font-size:12px;border-bottom:1px solid var(--border)}
.rr:last-child{border:none}
.rr-k{color:var(--t2)}.rr-v{font-weight:600;text-align:right;max-width:60%}
.rv-inf-hd{font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:7px}
.rv-ir{display:flex;justify-content:space-between;padding:3px 0;font-size:11px}
.rv-ir-k{color:var(--t2)}.rv-ir-v{font-weight:700;color:var(--orange);font-family:'JetBrains Mono',monospace}
.cc-actions{display:flex;justify-content:space-between;align-items:center;margin-top:2rem;padding-top:1.25rem;border-top:1px solid var(--border)}
.btn-back{background:none;border:1px solid var(--border2);border-radius:12px;padding:10px 20px;font-size:12px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;color:var(--t2);transition:all .15s}
.btn-back:hover{border-color:var(--orange);color:var(--orange)}
.btn-next{background:var(--orange);border:none;border-radius:12px;padding:10px 26px;font-size:12px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;color:#fff;transition:all .15s}
.btn-next:hover{background:var(--orange-d)}
.btn-next:disabled{opacity:.4;cursor:not-allowed}
.btn-draft{background:none;border:1px solid var(--border2);border-radius:12px;padding:10px 18px;font-size:12px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;color:var(--t2)}
.btn-pub{background:var(--teal);border:none;border-radius:12px;padding:10px 24px;font-size:12px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;color:#fff;transition:all .15s}
.btn-pub:hover{background:var(--teal-d)}
.btn-pub:disabled{opacity:.35;cursor:not-allowed}
.step-ctr{font-size:11px;color:var(--t3);font-weight:700;letter-spacing:.3px}
.err-msg{color:var(--red);font-size:12px;margin-top:8px}
.field-err{color:var(--red);font-size:11px;margin-top:5px;line-height:1.4;font-weight:600}
.field-warn{color:var(--gold);font-size:11px;margin-top:5px;line-height:1.4;font-weight:600}
.inp-err{border-color:var(--red) !important;background:rgba(232,64,26,.04) !important}
.inp-err:focus{border-color:var(--red) !important}
.cc-error-summary{background:var(--red-l);border:1px solid var(--red);border-radius:10px;padding:10px 14px;margin-top:10px;color:var(--red);font-size:12px;font-weight:700}
.hint{font-size:10px;color:var(--t3);margin-top:5px;line-height:1.6}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:1000;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px)}
.prod-modal{background:var(--s1);border:1px solid var(--border2);border-radius:24px 24px 0 0;width:100%;max-width:700px;max-height:88vh;display:flex;flex-direction:column;overflow:hidden}
.prod-modal-head{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.prod-modal-title{font-family:'Outfit',sans-serif;font-size:16px;font-weight:700}
.modal-close{width:32px;height:32px;border-radius:50%;border:1px solid var(--border2);background:var(--s3);cursor:pointer;font-size:16px;color:var(--t2);display:flex;align-items:center;justify-content:center;transition:all .15s}
.modal-close:hover{background:var(--red-l);border-color:var(--red);color:var(--red)}
.prod-modal-search{padding:12px 20px;border-bottom:1px solid var(--border);flex-shrink:0}
.prod-modal-search input{width:100%;font-size:13px;font-family:'Plus Jakarta Sans',sans-serif;padding:9px 13px;border:1px solid var(--border2);border-radius:10px;background:var(--s2);color:var(--t1);outline:none}
.prod-modal-search input:focus{border-color:var(--orange)}
.prod-modal-search input::placeholder{color:var(--t3)}
.prod-modal-body{flex:1;overflow-y:auto;padding:16px 20px}
.prod-modal-body::-webkit-scrollbar{width:4px}
.prod-modal-body::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px}
.prod-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.prod-card{border:1.5px solid var(--border);border-radius:12px;padding:12px;cursor:pointer;background:var(--s2);transition:all .15s;display:flex;flex-direction:column;gap:8px}
.prod-card:hover{border-color:var(--orange);background:var(--s3)}
.prod-card.sel{border-color:var(--orange);background:var(--orange-l)}
.prod-card-img{width:100%;height:80px;border-radius:8px;background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:32px}
.prod-card-name{font-size:12px;font-weight:700;color:var(--t1);line-height:1.3}
.prod-card-price{font-size:13px;font-weight:700;color:var(--orange);font-family:'JetBrains Mono',monospace}
.prod-card-meta{font-size:10px;color:var(--t3)}
.prod-modal-foot{padding:14px 20px;border-top:1px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:12px}
.prod-sel-count{font-size:12px;font-weight:700;color:var(--orange)}
.prod-confirm-btn{background:var(--orange);border:none;border-radius:12px;padding:10px 24px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;color:#fff;transition:all .15s}
.prod-confirm-btn:hover{background:var(--orange-d)}
.prod-confirm-btn:disabled{opacity:.4;cursor:not-allowed}
.prod-cancel-btn{background:none;border:1px solid var(--border2);border-radius:12px;padding:10px 18px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;color:var(--t2)}
.cat-filter{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.cat-chip{padding:4px 11px;border:1px solid var(--border2);border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;color:var(--t2);background:var(--s3);transition:all .15s}
.cat-chip.sel{background:var(--orange);border-color:var(--orange);color:#fff}
.browse-panel{background:var(--s3);border:1px solid var(--border);border-radius:16px;overflow:hidden;margin-top:10px}
.browse-head{padding:12px 15px;background:var(--s2);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.browse-head-left{display:flex;align-items:center;gap:10px;flex:1;min-width:0}
.browse-title{font-size:12px;font-weight:700;color:var(--orange);font-family:'Outfit',sans-serif;white-space:nowrap}
.browse-search{flex:1;min-width:120px;font-size:12px;font-family:'Plus Jakarta Sans',sans-serif;padding:7px 11px;border:1px solid var(--border2);border-radius:10px;background:var(--s3);color:var(--t1);outline:none}
.browse-search:focus{border-color:var(--orange)}
.browse-search::placeholder{color:var(--t3)}
.browse-sel-count{font-size:11px;font-weight:700;color:var(--orange);white-space:nowrap}
.browse-filters{padding:12px 15px;border-bottom:1px solid var(--border);display:flex;flex-wrap:wrap;gap:8px;align-items:end}
.browse-ff{min-width:100px}
.browse-ff label{display:block;font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}
.browse-ff select,.browse-ff input{width:100%;font-size:11px;font-family:'Plus Jakarta Sans',sans-serif;padding:6px 8px;border:1px solid var(--border2);border-radius:8px;background:var(--s2);color:var(--t1);outline:none}
.browse-ff select:focus,.browse-ff input:focus{border-color:var(--orange)}
.browse-clear{font-size:10px;font-weight:700;color:var(--t3);background:none;border:1px solid var(--border2);border-radius:20px;padding:5px 10px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;white-space:nowrap;align-self:end}
.browse-clear:hover{color:var(--red);border-color:var(--red)}
.browse-toggle-filters{font-size:10px;font-weight:700;color:var(--orange);background:none;border:1px solid rgba(244,121,32,.25);border-radius:20px;padding:5px 11px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;white-space:nowrap}
.browse-toggle-filters:hover{background:var(--orange-l)}
.browse-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px 15px;max-height:380px;overflow-y:auto}
.browse-grid::-webkit-scrollbar{width:4px}
.browse-grid::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px}
.browse-card{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid var(--border);border-radius:12px;background:var(--s2);cursor:pointer;transition:all .15s;position:relative}
.browse-card:hover{border-color:var(--border2);background:var(--s3)}
.browse-card.sel{border-color:var(--orange);background:var(--orange-l)}
.browse-card.already{border-color:var(--teal);background:var(--teal-l);opacity:.6;cursor:default}
.browse-check{width:18px;height:18px;border-radius:5px;border:1.5px solid var(--border2);background:var(--s3);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:transparent;transition:all .15s}
.browse-card.sel .browse-check{background:var(--orange);border-color:var(--orange);color:#fff}
.browse-card.already .browse-check{background:var(--teal);border-color:var(--teal);color:#fff}
.browse-av{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--s4),var(--s3));border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--t2);flex-shrink:0;font-family:'JetBrains Mono',monospace}
.browse-info{flex:1;min-width:0}
.browse-name{font-size:11px;font-weight:700;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.browse-meta{font-size:9px;color:var(--t3);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.browse-stats{display:flex;gap:6px;margin-top:3px;flex-wrap:wrap}
.browse-stat{font-size:9px;font-weight:700;padding:1px 6px;border-radius:10px;background:var(--s4);color:var(--t2)}
.browse-stat.er-high{background:rgba(0,184,148,.12);color:var(--teal)}
.browse-foot{padding:10px 15px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.browse-page-info{font-size:10px;color:var(--t3)}
.browse-page-btns{display:flex;gap:4px}
.browse-page-btn{font-size:10px;font-weight:700;color:var(--t2);background:none;border:1px solid var(--border2);border-radius:8px;padding:4px 10px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif}
.browse-page-btn:hover:not(:disabled){border-color:var(--orange);color:var(--orange)}
.browse-page-btn:disabled{opacity:.35;cursor:default}
.browse-add-btn{font-size:11px;font-weight:700;color:#fff;background:var(--orange);border:none;border-radius:10px;padding:7px 16px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:all .15s}
.browse-add-btn:hover{background:var(--orange-d)}
.browse-add-btn:disabled{opacity:.4;cursor:not-allowed}
.browse-empty{padding:30px 15px;text-align:center}
.browse-empty-icon{font-size:28px;margin-bottom:6px}
.browse-empty-text{font-size:12px;color:var(--t3)}
.browse-loading{padding:30px 15px;text-align:center;font-size:12px;color:var(--t3)}
.grp-section{margin-top:10px;background:var(--s3);border:1px solid var(--border);border-radius:12px;padding:10px 13px}
.grp-section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.grp-section-title{font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px}
.grp-create-btn{font-size:10px;font-weight:700;color:var(--orange);background:none;border:1px solid rgba(244,121,32,.25);border-radius:20px;padding:4px 10px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif}
.grp-create-btn:hover{background:var(--orange-l)}
.grp-list{display:flex;flex-wrap:wrap;gap:5px}
.grp-chip{display:flex;align-items:center;gap:5px;padding:5px 10px;border:1px solid var(--border2);border-radius:20px;font-size:11px;font-weight:600;color:var(--t2);cursor:pointer;background:var(--s4);transition:all .15s}
.grp-chip:hover{border-color:var(--orange);color:var(--orange)}
.grp-chip .grp-count{font-size:9px;font-weight:700;color:var(--t3);background:var(--s2);padding:1px 5px;border-radius:10px}
.grp-chip .grp-del{font-size:10px;color:var(--t3);cursor:pointer;margin-left:2px}
.grp-chip .grp-del:hover{color:var(--red)}
.grp-modal{background:var(--s1);border:1px solid var(--border2);border-radius:24px;width:100%;max-width:600px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;margin:auto}
.grp-modal-head{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.grp-modal-title{font-family:'Outfit',sans-serif;font-size:16px;font-weight:700}
.grp-modal-body{flex:1;overflow-y:auto;padding:16px 20px}
.grp-modal-body::-webkit-scrollbar{width:4px}
.grp-modal-body::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px}
.grp-modal-foot{padding:14px 20px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px}
.grp-inf-list{display:flex;flex-direction:column;gap:5px;max-height:280px;overflow-y:auto;margin-top:8px}
.grp-inf-item{display:flex;align-items:center;gap:9px;padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:var(--s3);cursor:pointer;transition:all .15s}
.grp-inf-item:hover{border-color:var(--border2)}
.grp-inf-item.sel{border-color:var(--orange);background:var(--orange-l)}
`;

function NewCampaignPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [brandStatus, setBrandStatus] = useState(null); // null=loading
  const [brandCategory, setBrandCategory] = useState(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [error, setError] = useState('');
  const [campaignId, setCampaignId] = useState(null);

  // Check brand approval status
  useEffect(() => {
    brandApi.getMe().then(res => {
      if (res.success) {
        const b = res.data?.brand || res.data;
        setBrandStatus(b?.user_status || b?.status || 'pending');
        setBrandCategory(b?.category || b?.business_category || null);
      } else {
        setBrandStatus('pending');
      }
    });
  }, []);

  // Campaign basics — ALL hooks must be declared before any conditional return
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [allowNegotiation, setAllowNegotiation] = useState(true);

  // Sets
  const [sets, setSets] = useState([mkSet(0)]);
  const [activeSet, setActiveSet] = useState(0);

  // Gallery picker — set-index this instance targets (null = closed)
  const [galleryPickerSetIdx, setGalleryPickerSetIdx] = useState(null);

  // Transient toast shown after duplicating a set
  const [duplicateToast, setDuplicateToast] = useState(null);

  // Products from API
  const [products, setProducts] = useState([]);

  // Product modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCtx, setModalCtx] = useState(null);
  const [modalTempSel, setModalTempSel] = useState([]);
  const [modalSearch, setModalSearch] = useState('');
  const [modalCat, setModalCat] = useState('All');

  // Influencer search
  const [infResults, setInfResults] = useState([]);
  const infSearchTimer = useRef(null);

  // Browse panel state
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
  const [browseSelected, setBrowseSelected] = useState([]); // [{id, full_name, instagram_handle, ...}]
  const browseTimer = useRef(null);

  // Influencer groups
  const [infGroups, setInfGroups] = useState(() => loadGroups());
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupSearchQ, setGroupSearchQ] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState([]);
  const [groupSelectedIds, setGroupSelectedIds] = useState([]);
  const [groupSearchLoading, setGroupSearchLoading] = useState(false);
  const groupSearchTimer = useRef(null);

  // Open group matches
  const [matchResult, setMatchResult] = useState({ count: 0, influencers: [] });
  const matchTimer = useRef(null);

  useEffect(() => {
    brandApi.getProducts().then(res => {
      if (res.ok) setProducts(res.data?.products || []);
    }).catch(() => {});
  }, []);

  // ── Load existing draft when ?id=<campaignId> is in URL ───────────────────────
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
            tiers: filters.tiers || [],
            niches: filters.niches || [],
            cities: filters.cities || [],
            min_er: filters.min_er != null ? String(filters.min_er) : '',
            gender: filters.gender || '',
            max_cap: s.max_cap != null ? String(s.max_cap) : '10',
            per_influencer_budget: s.per_influencer_budget != null ? String(s.per_influencer_budget) : '',
          };

          const influencers = (s.influencers || []).map(ci => {
            const cfg = ci.offer_config_json || {};
            return {
              ...mkInf(),
              backendId: ci.id,
              influencer_id: ci.influencer_id,
              name: ci.influencer_name || '',
              handle: ci.instagram_handle || '',
              init: (ci.influencer_name || '?')[0].toUpperCase(),
              post_date: ci.posting_date ? ci.posting_date.split('T')[0] : '',
              influencer_budget: ci.influencer_budget != null ? String(ci.influencer_budget) : '',
              offer_type: ci.offer_type || '',
              commission_pct: ci.commission_pct != null ? String(ci.commission_pct) : '',
              physical_delivery: ci.physical_delivery || false,
              delivery_address: ci.delivery_address || '',
              custom_code: ci.coupon_code || '',
              ...((ci.offer_type || '').toLowerCase().includes('discount') && { d_sub: cfg.sub_type || 'pct', d_val: String(cfg.value || ''), d_prods: cfg.products || [], d_scope: cfg.scope || (cfg.products?.length ? 'products' : 'store'), d_category: cfg.category || '' }),
              ...((ci.offer_type || '').toLowerCase().includes('volume')   && { v_tiers: cfg.tiers || [{min_spend:'',pct_off:''}], v_prods: cfg.products || [], v_scope: cfg.scope || (cfg.products?.length ? 'products' : 'store'), v_category: cfg.category || '' }),
              ...((ci.offer_type || '').toLowerCase() === 'bogo'           && { bogo_buy: cfg.buy_product || null, bogo_get: cfg.get_product || null }),
              ...((ci.offer_type || '').toLowerCase().includes('bundle')   && { bnd_prods: cfg.products || [], bnd_price: String(cfg.bundle_price || '') }),
              ...((ci.offer_type || '').toLowerCase().includes('gift')     && { gift_offers: cfg.offers || [{main:null,gift:null}] }),
            };
          });

          return {
            ...mkSet(idx),
            _id: Date.now() + idx,
            backendId: s.id,
            name: s.name || `Set ${String.fromCharCode(65 + idx)}`,
            goal: s.goal || '',
            influencer_mode: s.influencer_mode || 'handpick',
            window_start: s.window_start ? s.window_start.split('T')[0] : '',
            window_end: s.window_end ? s.window_end.split('T')[0] : '',
            set_budget: s.set_budget != null ? String(s.set_budget) : '',
            brief: s.brief || '',
            coupon_prefix: s.coupon_prefix || '',
            formats: s.formats_json || [],
            assets: (s.assets_json || []).map(a => ({
              asset_id: a.asset_id || null,
              title: a.title || a.file_name,
              file_r2_key: a.file_r2_key,
              file_name: a.file_name,
              file_type: a.file_type,
              file_size_bytes: a.file_size_bytes,
              name: a.title || a.file_name,
              icon: (a.file_type || '').startsWith('video') ? '🎬' : (a.file_type || '').startsWith('image') ? '🖼️' : '📄',
              size: a.file_size_bytes ? `${(a.file_size_bytes / 1024).toFixed(0)} KB` : '',
            })),
            influencers,
            group,
          };
        });
        setSets(hydratedSets);
        setStep(1); // resume at sets step
      }
      setLoadingDraft(false);
    }).catch(() => { setError('Could not load draft campaign.'); setLoadingDraft(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Budget helpers ────────────────────────────────────────────────────────────
  const totalSetBudget = () => sets.reduce((t, s) => {
    if (!needsBudget(s.goal)) return t;
    if (s.influencer_mode === 'handpick') return t + Number(s.set_budget || 0);
    return t + (Number(s.group.per_influencer_budget || 0) * Number(s.group.max_cap || 0));
  }, 0);
  const campRem = () => Number(totalBudget || 0) - totalSetBudget();
  const setInfSpent = si => sets[si].influencers.reduce((t, i) => t + Number(i.influencer_budget || 0), 0);
  const setRem = si => Number(sets[si].set_budget || 0) - setInfSpent(si);
  const isBudgetOver = () => sets.some(s => needsBudget(s.goal)) && campRem() < 0;

  // ── Validation ────────────────────────────────────────────────────────────────
  // Inline, on-input. Returns a structured object the render code consults to
  // decide whether to flash red on a specific field. Compute fresh each render
  // (cheap) so we don't have to thread invalidation logic through every state
  // setter.
  //
  // The user types freely — we don't intercept onChange. Bad values (negative,
  // empty when required, sum > set_budget, commission > 100) are flagged
  // visually as the user types, AND we block the Next button until clean.
  const validation = (() => {
    const v = {
      campaign: {},                       // top-level field errors
      sets: sets.map(() => ({              // per-set
        fields: {},                       // { set_budget, name, goal, ... }
        warnings: {},                     // soft warnings (e.g. commission > 25%)
        group: {},                        // open-group-only
        influencers: [],                  // [{ field: msg, ... }, ...]
      })),
      step1Errors: 0,
      step2Errors: 0,
    };

    // Step 1 — campaign basics
    if (!name.trim()) v.campaign.name = 'Campaign name is required';
    if (!startDate) v.campaign.startDate = 'Start date is required';
    if (!endDate)   v.campaign.endDate   = 'End date is required';
    else if (startDate && endDate < startDate) v.campaign.endDate = 'End date must be on or after start date';

    // Total budget required only if there's at least one engagement/hybrid set
    const anyPaidSet = sets.some(s => needsBudget(s.goal));
    if (anyPaidSet) {
      const tb = Number(totalBudget);
      if (totalBudget === '' || totalBudget == null) {
        v.campaign.totalBudget = 'Required when any set is engagement or hybrid';
      } else if (!Number.isFinite(tb)) {
        v.campaign.totalBudget = 'Must be a valid number';
      } else if (tb <= 0) {
        v.campaign.totalBudget = 'Must be greater than 0';
      }
    }
    v.step1Errors = Object.keys(v.campaign).length;

    // Step 2 — per-set + per-influencer
    sets.forEach((s, si) => {
      const sv = v.sets[si];

      if (!s.name || !s.name.trim()) sv.fields.name = 'Set name is required';
      if (!s.goal) sv.fields.goal = 'Pick a goal (engagement / conversion / hybrid)';

      // Window dates — required and inside campaign range
      if (!s.window_start) sv.fields.window_start = 'Required';
      if (!s.window_end)   sv.fields.window_end   = 'Required';
      if (s.window_start && s.window_end && s.window_end < s.window_start) {
        sv.fields.window_end = 'Window end must be on or after window start';
      }
      if (s.window_start && startDate && s.window_start < startDate) {
        sv.fields.window_start = `Cannot be before campaign start (${startDate})`;
      }
      if (s.window_end && endDate && s.window_end > endDate) {
        sv.fields.window_end = `Cannot be after campaign end (${endDate})`;
      }

      // Formats — at least one selected; counts must be ≥ 1 (toggleFormat
      // already keeps count ≥ 1 but we double-check)
      if (!Array.isArray(s.formats) || s.formats.length === 0) {
        sv.fields.formats = 'Pick at least one content format';
      }

      // Coupon prefix — required for conversion + hybrid; allow alphanumeric only
      if (needsCoupon(s.goal)) {
        if (!s.coupon_prefix || !s.coupon_prefix.trim()) {
          sv.fields.coupon_prefix = 'Required for conversion / hybrid';
        } else if (!/^[A-Z0-9]{3,15}$/.test(s.coupon_prefix.trim())) {
          sv.fields.coupon_prefix = '3-15 letters/digits, uppercase only';
        }
      }

      // Set budget — required + > 0 + ≤ campaign remaining
      if (needsBudget(s.goal) && s.influencer_mode === 'handpick') {
        const sb = Number(s.set_budget);
        if (s.set_budget === '' || s.set_budget == null) {
          sv.fields.set_budget = 'Required for engagement / hybrid';
        } else if (!Number.isFinite(sb)) {
          sv.fields.set_budget = 'Must be a valid number';
        } else if (sb <= 0) {
          sv.fields.set_budget = 'Must be greater than 0';
        } else if (Number(totalBudget) > 0 && totalSetBudget() > Number(totalBudget)) {
          sv.fields.set_budget = `Total set budgets exceed campaign budget by ₹${fmtN(totalSetBudget() - Number(totalBudget))}`;
        }
        // Sum of handpick influencer budgets must not exceed set_budget
        if (sb > 0 && setInfSpent(si) > sb) {
          sv.fields.set_budget_overspent = `Influencers allocated ₹${fmtN(setInfSpent(si))} — exceeds set budget by ₹${fmtN(setInfSpent(si) - sb)}`;
        }
      }

      // Open-group validation
      if (s.influencer_mode === 'open_group') {
        const cap = Number(s.group?.max_cap);
        if (!s.group?.max_cap || !Number.isFinite(cap)) {
          sv.group.max_cap = 'Required';
        } else if (cap <= 0) {
          sv.group.max_cap = 'Must be greater than 0';
        } else if (!Number.isInteger(cap)) {
          sv.group.max_cap = 'Must be a whole number';
        } else if (cap > 1000) {
          sv.group.max_cap = 'Max 1000 influencers per group';
        }
        if (needsBudget(s.goal)) {
          const pib = Number(s.group?.per_influencer_budget);
          if (s.group?.per_influencer_budget === '' || s.group?.per_influencer_budget == null) {
            sv.group.per_influencer_budget = 'Required for engagement / hybrid';
          } else if (!Number.isFinite(pib)) {
            sv.group.per_influencer_budget = 'Must be a valid number';
          } else if (pib <= 0) {
            sv.group.per_influencer_budget = 'Must be greater than 0';
          }
          // Projected total (per × cap) must not exceed campaign remaining
          if (pib > 0 && cap > 0) {
            const projected = pib * cap;
            const tb = Number(totalBudget) || 0;
            if (tb > 0 && totalSetBudget() > tb) {
              sv.group.projected = `Group could spend up to ₹${fmtN(projected)} — campaign budget over by ₹${fmtN(totalSetBudget() - tb)}`;
            }
          }
        }
        // For conversion + hybrid, group needs a commission_pct
        if (needsOffer(s.goal)) {
          const cp = Number(s.group?.commission_pct);
          if (s.group?.commission_pct === '' || s.group?.commission_pct == null) {
            sv.group.commission_pct = 'Required for conversion / hybrid';
          } else if (!Number.isFinite(cp) || cp <= 0 || cp > 100) {
            sv.group.commission_pct = 'Must be between 0 and 100';
          } else if (cp > 25) {
            sv.warnings.group_commission_pct = 'Commission above 25% is unusually high';
          }
        }
      }

      // Per-influencer rows (handpick only)
      s.influencers.forEach((inf, ii) => {
        const errs = {};
        if (!inf.post_date) {
          errs.post_date = 'Required';
        } else if (s.window_start && inf.post_date < s.window_start) {
          errs.post_date = `Must be on or after ${s.window_start}`;
        } else if (s.window_end && inf.post_date > s.window_end) {
          errs.post_date = `Must be on or before ${s.window_end}`;
        }
        if (needsBudget(s.goal)) {
          const ib = Number(inf.influencer_budget);
          if (inf.influencer_budget === '' || inf.influencer_budget == null) {
            errs.influencer_budget = 'Required';
          } else if (!Number.isFinite(ib)) {
            errs.influencer_budget = 'Invalid number';
          } else if (ib <= 0) {
            errs.influencer_budget = 'Must be greater than 0';
          }
        }
        if (needsOffer(s.goal)) {
          const cp = Number(inf.commission_pct);
          if (inf.commission_pct === '' || inf.commission_pct == null) {
            errs.commission_pct = 'Required';
          } else if (!Number.isFinite(cp) || cp <= 0 || cp > 100) {
            errs.commission_pct = 'Must be between 0 and 100';
          }
          // D9 fix: the backend invite requires offer_type for conversion/
          // hybrid (campaign.controller.js:654 → 422). Without it the invite
          // is silently dropped on publish (active campaign, 0 influencers).
          // Mirror the rule client-side so Review stays blocked until set.
          if (!inf.offer_type) {
            errs.offer_type = 'Pick an offer type';
          }
        }
        sv.influencers[ii] = errs;
      });

      // Roll set errors into step 2 count
      v.step2Errors += Object.keys(sv.fields).length;
      v.step2Errors += Object.keys(sv.group).length;
      sv.influencers.forEach(e => { v.step2Errors += Object.keys(e).length; });
    });

    return v;
  })();

  // ── Touched-fields tracker ─────────────────────────────────────────────────────
  // We don't want every required-field error to flash red on first render. Only
  // show errors on a field once the user has either edited it OR the user has
  // clicked Next/Publish (forceShowErrors flips on). Touched is accumulated
  // automatically by every input via the markTouched helper.
  const [touched, setTouched] = useState({});
  const [forceShowErrors, setForceShowErrors] = useState(false);
  const markTouched = (key) => setTouched(prev => prev[key] ? prev : { ...prev, [key]: true });
  const showErr = (key, msg) => msg && (forceShowErrors || touched[key]) ? msg : null;

  // ── Set mutators ──────────────────────────────────────────────────────────────
  const updateSet = (idx, patch) => setSets(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  const updateInf = (si, ii, patch) => setSets(prev => prev.map((s, i) => {
    if (i !== si) return s;
    return { ...s, influencers: s.influencers.map((inf, j) => j === ii ? { ...inf, ...patch } : inf) };
  }));
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

  // ── Influencer search (legacy — kept for compatibility) ────────────────────────
  const handleInfSearch = (si, q) => {
    updateSet(si, { inf_query: q });
    clearTimeout(infSearchTimer.current);
    if (!q.trim()) { setInfResults([]); return; }
    infSearchTimer.current = setTimeout(async () => {
      if (!campaignId) return;
      try {
        const res = await campaignApi.searchInfluencers(campaignId, { q });
        if (res.ok) setInfResults(res.data?.influencers || []);
      } catch {}
    }, 300);
  };
  const addInfluencer = (si, inf) => {
    if (allUsedIds().includes(inf.id)) return;
    updateSet(si, {
      influencers: [...sets[si].influencers, {
        ...mkInf(),
        influencer_id: inf.id,
        name: inf.full_name || '',
        handle: inf.instagram_handle ? `@${inf.instagram_handle}` : '',
        init: (inf.full_name || 'X').slice(0, 2).toUpperCase(),
      }],
      inf_query: '',
    });
    setInfResults([]);
  };
  const removeInfluencer = (si, ii) => updateSet(si, { influencers: sets[si].influencers.filter((_, j) => j !== ii) });

  // ── Browse panel search ──────────────────────────────────────────────────────
  const doBrowseSearch = useCallback(async (page = 1) => {
    setBrowseLoading(true);
    setBrowsePage(page);
    const params = { page: String(page), limit: '20' };
    if (browseQuery.trim()) params.q = browseQuery.trim();
    if (browseNiche) params.niche = browseNiche;
    if (browseCity.trim()) params.city = browseCity.trim();
    if (browseTier) params.tier = browseTier;
    // gender no longer supported — dropped from new search backend
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

  // Auto-search on filter change with debounce
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

    // Split: scraped (unclaimed) creators can't be added directly to handpick
    // (campaign_influencers FK requires influencers.id). Route them to the
    // creator_invitations table so an admin can run outreach.
    const onboardedNew = browseSelected
      .filter(inf => !inf.is_unclaimed && inf.id && !usedIds.includes(inf.id));
    const scrapedToInvite = browseSelected.filter(inf => inf.is_unclaimed);

    if (onboardedNew.length > 0) {
      const newInfs = onboardedNew.map(inf => ({
        ...mkInf(),
        influencer_id: inf.id,
        name: inf.full_name || '',
        handle: inf.instagram_handle ? `@${inf.instagram_handle}` : '',
        init: (inf.full_name || 'X').slice(0, 2).toUpperCase(),
      }));
      updateSet(si, { influencers: [...sets[si].influencers, ...newInfs] });
    }

    if (scrapedToInvite.length > 0) {
      // Create invitations linked to this draft campaign + set. They
      // auto-convert into campaign_influencers when the creator signs up.
      const results = await Promise.allSettled(scrapedToInvite.map(inf =>
        creatorInvitationApi.create({
          ig_handle:    inf.ig_handle,
          campaign_id:  campaignId || undefined,
          set_id:       sets[si]?.id || undefined,
        })
      ));
      const ok  = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
      const dup = results.filter(r => r.status === 'fulfilled' && r.value?.error?.code === 'CONFLICT').length;
      const err = results.length - ok - dup;
      if (typeof window !== 'undefined') {
        const lines = [];
        if (ok)  lines.push(`✉ ${ok} invitation${ok === 1 ? '' : 's'} queued for Inflx admin outreach`);
        if (dup) lines.push(`${dup} already invited (skipped)`);
        if (err) lines.push(`${err} failed`);
        alert(lines.join('\n'));
      }
    }

    setBrowseSelected([]);
  };

  // ── Influencer groups ────────────────────────────────────────────────────────
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
          // Groups can only contain onboarded influencers (need real influencers.id
          // for the campaign_influencers FK). Filter scraped creators out.
          setGroupSearchResults(raw.map(mapCreator).filter(c => !c.is_unclaimed));
        }
      } catch {}
      setGroupSearchLoading(false);
    }, 300);
  };

  const toggleGroupSelect = (id) => {
    setGroupSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

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

  const deleteGroup = (groupId) => { updateGroupsState(infGroups.filter(g => g.id !== groupId)); };

  const addGroupToSet = (si, groupId) => {
    const group = infGroups.find(g => g.id === groupId);
    if (!group) return;
    const usedIds = allUsedIds();
    const newInfs = group.influencers.filter(inf => !usedIds.includes(inf.id)).map(inf => ({
      ...mkInf(),
      influencer_id: inf.id,
      name: inf.full_name || '',
      handle: inf.instagram_handle ? `@${inf.instagram_handle}` : '',
      init: (inf.full_name || 'X').slice(0, 2).toUpperCase(),
    }));
    if (newInfs.length > 0) {
      updateSet(si, { influencers: [...sets[si].influencers, ...newInfs] });
    }
  };

  // ── Open group matches ────────────────────────────────────────────────────────
  // Optionally accept the group inline. Without it the closure reads
  // sets[si].group, which can be stale when fetchMatches is invoked from
  // an onClick that has just queued (but not yet flushed) a setState. The
  // chip-toggle handlers pass the post-toggle group directly so the count
  // refreshes against the user's latest selection.
  const fetchMatches = (si, groupOverride) => {
    if (!campaignId) return;
    clearTimeout(matchTimer.current);
    matchTimer.current = setTimeout(async () => {
      const g = groupOverride || sets[si].group;
      try {
        const params = new URLSearchParams();
        if (g.tiers?.length)  g.tiers.forEach(t => params.append('tiers', t));
        if (g.niches?.length) g.niches.forEach(n => params.append('niches', n));
        if (g.cities?.length) g.cities.forEach(c => params.append('cities', c));
        if (g.min_er) params.set('min_er', g.min_er);
        if (g.gender) params.set('gender', g.gender);
        const res = await campaignApi.getOpenGroupMatches(campaignId, si, params);
        if (res.ok) setMatchResult(res.data);
      } catch {}
    }, 400);
  };

  // ── Add/delete/duplicate sets ─────────────────────────────────────────────────
  const addSet = () => {
    const idx = sets.length;
    setSets(prev => [...prev, mkSet(idx)]);
    setActiveSet(idx);
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
    // Strip every backend id so the save path inserts fresh rows for the
    // new set + its influencers, instead of overwriting the original.
    // Also reset per-influencer codes/flags that shouldn't carry over.
    const dup = {
      ...clone,
      _id: Date.now(),
      backendId: null,
      name: `${source.name} (copy)`,
      influencers: (source.influencers || []).map((inf, ii) => ({
        ...JSON.parse(JSON.stringify(inf)),
        backendId: null,
        _id: Date.now() + ii + 1,
        custom_code: '',
        edit_code: false,
      })),
    };
    setSets(prev => [...prev, dup]);
    setActiveSet(idx);
    // Visible confirmation — brief banner so the click feels like it did
    // something. Without this, the cloned form body looks identical to
    // the original and users think the button is dead.
    setError('');
    setDuplicateToast(`Duplicated "${source.name}" → "${dup.name}". Edit the fields below to differ.`);
    setTimeout(() => setDuplicateToast(null), 3500);
  };

  // ── Save draft ────────────────────────────────────────────────────────────────
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
        cid = res.data.campaign.id;
        setCampaignId(cid);
      } else {
        await campaignApi.update(cid, { name, start_date: startDate, end_date: endDate, total_budget: totalBudget || null, allow_negotiation: allowNegotiation });
      }
      return cid;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const goToStep2 = async () => {
    if (validation.step1Errors > 0) {
      setForceShowErrors(true);
      setError(`Please fix ${validation.step1Errors} field${validation.step1Errors !== 1 ? 's' : ''} before continuing.`);
      return;
    }
    const cid = await saveDraft();
    if (cid) {
      setStep(1);
      setForceShowErrors(false);
    }
  };
  const goBack = () => { setStep(s => s - 1); setError(''); setForceShowErrors(false); };

  // ── Build offer_config from a row (inf slot or group) ────────────────────────
  const buildOfferConfig = (item) => {
    const t = (item.offer_type || '').toLowerCase().trim();
    switch (t) {
      case 'discount':          return {
        sub_type: item.d_sub,
        value: Number(item.d_val) || 0,
        scope: item.d_scope || 'store',
        category: item.d_scope === 'category' ? (item.d_category || null) : null,
        products: item.d_scope === 'products' ? (item.d_prods || []) : [],
      };
      case 'volume discount':
      case 'volume':            return {
        tiers: item.v_tiers,
        scope: item.v_scope || 'store',
        category: item.v_scope === 'category' ? (item.v_category || null) : null,
        products: item.v_scope === 'products' ? (item.v_prods || []) : [],
      };
      case 'bogo':              return { buy_product: item.bogo_buy, get_product: item.bogo_get };
      case 'bundle':            return { products: item.bnd_prods, bundle_price: Number(item.bnd_price) || 0 };
      case 'free gift':         return { offers: item.gift_offers };
      case 'free_gift':         return { offers: item.gift_offers };
      default:                  return {};
    }
  };

  // ── Sync all sets (and their influencers) to backend ─────────────────────────
  const saveSets = async (cid) => {
    const updatedSets = sets.map(s => ({ ...s, influencers: s.influencers.map(i => ({ ...i })) }));

    for (let si = 0; si < updatedSets.length; si++) {
      const s = updatedSets[si];
      if (!s.goal) { throw new Error(`Set "${s.name}" needs a goal before saving`); }

      const setPayload = {
        name: s.name,
        goal: s.goal,
        brief: s.brief || null,
        formats_json: s.formats,
        assets_json: (s.assets || []).map(a => ({
          asset_id: a.asset_id || a.id || null,
          title: a.title || a.name || a.file_name || null,
          file_r2_key: a.file_r2_key || null,
          file_name: a.file_name || a.name || null,
          file_type: a.file_type || null,
          file_size_bytes: a.file_size_bytes || null,
        })).filter(a => a.file_r2_key),
        influencer_mode: s.influencer_mode,
        window_start: s.window_start || null,
        window_end: s.window_end || null,
        ...(needsBudget(s.goal) && { set_budget: Number(s.set_budget) || null }),
        ...(needsCoupon(s.goal) && { coupon_prefix: s.coupon_prefix || null }),
        ...(s.influencer_mode === 'open_group' && {
          open_group_filters: {
            tiers: s.group.tiers,
            niches: s.group.niches,
            cities: s.group.cities,
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

      // Save handpick influencers
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
            // Update existing influencer assignment (e.g. post date changed on re-edit)
            await campaignApi.updateInfluencer(cid, setBackendId, inf.backendId, infPayload);
          } else {
            const res = await campaignApi.inviteInfluencer(cid, setBackendId, infPayload);
            if (res.success || res.ok) {
              updatedSets[si].influencers[ii] = { ...inf, backendId: res.data?.campaign_influencer?.id || true };
            }
          }
        }
      }
    }

    setSets(updatedSets);
  };

  // ── Navigate to Step 3 (save sets first) ─────────────────────────────────────
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
    try {
      await saveSets(cid);
      setStep(2);
      setForceShowErrors(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Publish ───────────────────────────────────────────────────────────────────
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
    } catch (e) {
      setError(e.message);
    } finally {
      setPublishing(false);
    }
  };

  // ── Product modal ─────────────────────────────────────────────────────────────
  const openModal = (ctx) => {
    setModalCtx(ctx);
    setModalTempSel([...(ctx.currentSel || [])]);
    setModalSearch(''); setModalCat('All');
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setModalCtx(null); };
  const toggleModalProd = (prod) => {
    if (!modalCtx?.multi) {
      setModalTempSel(prev => prev.some(p => p.id === prod.id) ? [] : [prod]);
    } else {
      setModalTempSel(prev => prev.some(p => p.id === prod.id) ? prev.filter(p => p.id !== prod.id) : [...prev, prod]);
    }
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
      else if (field === 'giftMain') {
        setSets(prev => prev.map((s, si2) => si2 !== si ? s : { ...s, influencers: s.influencers.map((inf, ii2) => ii2 !== ii ? inf : { ...inf, gift_offers: inf.gift_offers.map((go, gi) => gi !== giIdx ? go : { ...go, main: val[0] || null }) }) }));
      } else if (field === 'giftItem') {
        setSets(prev => prev.map((s, si2) => si2 !== si ? s : { ...s, influencers: s.influencers.map((inf, ii2) => ii2 !== ii ? inf : { ...inf, gift_offers: inf.gift_offers.map((go, gi) => gi !== giIdx ? go : { ...go, gift: val[0] || null }) }) }));
      } else updateInf(si, ii, { [field]: val });
    }
    closeModal();
  };

  const filteredProds = products.filter(p => {
    if (modalSearch && !p.name.toLowerCase().includes(modalSearch.toLowerCase())) return false;
    if (modalCat !== 'All' && p.category !== modalCat) return false;
    return true;
  });
  const prodCategories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];

  // ── Offer config renderer ─────────────────────────────────────────────────────
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

  // Brand's sections — derived from the products already added by the brand.
  // Used for the "Specific category" scope option in Discount + Volume offers.
  // Empty when brand hasn't added products yet; UI will surface a gentle hint.
  const brandSections = [...new Set((products || []).map(p => p.section).filter(Boolean))].sort();

  const renderOfferConfig = (o, onChg, si, ii, isGroup) => {
    if (!o.offer_type) return null;
    const ctx = (field, currentSel, multi = true, giIdx = 0) => ({ si, ii, field, currentSel: currentSel || [], multi, isGroup, giIdx });
    const prodChips = (arr, field) => (
      <div className="prod-selected">
        {(arr || []).map(p => (
          <div key={p.id} className="prod-chip-sel">{p.name} <span className="px" onClick={() => onChg(field, (arr || []).filter(x => x.id !== p.id))}>×</span></div>
        ))}
        <button className="select-prod-btn" onClick={() => openModal(ctx(field, arr, true))}>+ Select products</button>
      </div>
    );
    const singleChip = (prod, field, giIdx = 0) => (
      <div className="prod-selected">
        {prod && <div className="prod-chip-sel">{prod.name} <span className="px" onClick={() => onChg(field, null)}>×</span></div>}
        <button className="select-prod-btn" onClick={() => openModal(ctx(field, prod ? [prod] : [], false, giIdx))}>{prod ? '↻ Change' : '+ Select product'}</button>
      </div>
    );
    return (
      <div className="offer-cfg">
        {o.offer_type === 'Discount' && <>
          <div><div className="ie-lbl">Type</div><div className="sub-tog"><button className={o.d_sub === 'pct' ? 'act' : ''} onClick={() => onChg('d_sub', 'pct')}>% Off</button><button className={o.d_sub === 'flat' ? 'act' : ''} onClick={() => onChg('d_sub', 'flat')}>₹ Flat</button></div></div>
          <div><div className="ie-lbl">Value</div><input className="ie-inp" type="number" placeholder={o.d_sub === 'pct' ? 'e.g. 20' : 'e.g. 200'} value={o.d_val || ''} onChange={e => onChg('d_val', e.target.value)} /></div>
          {/* 3-tier scope picker */}
          <div>
            <div className="ie-lbl">Apply to</div>
            <div className="sub-tog">
              <button className={o.d_scope === 'store' ? 'act' : ''} onClick={() => onChg('d_scope', 'store')}>Entire store</button>
              <button className={o.d_scope === 'category' ? 'act' : ''} onClick={() => onChg('d_scope', 'category')}>Specific category</button>
              <button className={o.d_scope === 'products' ? 'act' : ''} onClick={() => onChg('d_scope', 'products')}>Specific products</button>
            </div>
          </div>
          {o.d_scope === 'category' && (
            <div>
              <div className="ie-lbl">Category</div>
              {brandSections.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--t3)', fontStyle: 'italic' }}>Add products to your catalogue first — categories show here once you have items.</div>
              ) : (
                <select className="ie-inp" value={o.d_category || ''} onChange={e => onChg('d_category', e.target.value)}>
                  <option value="">— pick a category —</option>
                  {brandSections.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>
          )}
          {o.d_scope === 'products' && (
            <div><div className="ie-lbl">Products</div>{prodChips(o.d_prods, 'd_prods')}</div>
          )}
        </>}
        {o.offer_type === 'Volume discount' && <>
          {/* 3-tier scope picker */}
          <div>
            <div className="ie-lbl">Apply to</div>
            <div className="sub-tog">
              <button className={o.v_scope === 'store' ? 'act' : ''} onClick={() => onChg('v_scope', 'store')}>Entire store</button>
              <button className={o.v_scope === 'category' ? 'act' : ''} onClick={() => onChg('v_scope', 'category')}>Specific category</button>
              <button className={o.v_scope === 'products' ? 'act' : ''} onClick={() => onChg('v_scope', 'products')}>Specific products</button>
            </div>
          </div>
          {o.v_scope === 'category' && (
            <div>
              <div className="ie-lbl">Category</div>
              {brandSections.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--t3)', fontStyle: 'italic' }}>Add products to your catalogue first — categories show here once you have items.</div>
              ) : (
                <select className="ie-inp" value={o.v_category || ''} onChange={e => onChg('v_category', e.target.value)}>
                  <option value="">— pick a category —</option>
                  {brandSections.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>
          )}
          {o.v_scope === 'products' && (
            <div><div className="ie-lbl">Products</div>{prodChips(o.v_prods, 'v_prods')}</div>
          )}
          <div><div className="ie-lbl">Spend tiers</div>
            {(o.v_tiers || []).map((t, ti) => (
              <div key={ti} className="vt-row">
                <span>Min ₹</span>
                <input className="vt-i" type="number" placeholder="500" value={t.min_spend || ''} onChange={e => { const ts = [...o.v_tiers]; ts[ti] = { ...ts[ti], min_spend: e.target.value }; onChg('v_tiers', ts); }} />
                <span>→</span>
                <input className="vt-i" type="number" placeholder="10" value={t.pct_off || ''} onChange={e => { const ts = [...o.v_tiers]; ts[ti] = { ...ts[ti], pct_off: e.target.value }; onChg('v_tiers', ts); }} />
                <span>% off</span>
                {(o.v_tiers || []).length > 1 && <button className="gift-rm" onClick={() => onChg('v_tiers', (o.v_tiers || []).filter((_, i) => i !== ti))}>✕</button>}
              </div>
            ))}
            <button className="add-sm" onClick={() => onChg('v_tiers', [...(o.v_tiers || []), { min_spend: '', pct_off: '' }])}>+ Add tier</button>
          </div>
        </>}
        {o.offer_type === 'BOGO' && <>
          <div><div className="ie-lbl">Buy product</div>{singleChip(o.bogo_buy, 'bogoBuy')}</div>
          <div><div className="ie-lbl">Get product (free)</div>{singleChip(o.bogo_get, 'bogoGet')}</div>
        </>}
        {o.offer_type === 'Bundle' && <>
          <div><div className="ie-lbl">Bundle products</div>{prodChips(o.bnd_prods, 'bnd_prods')}</div>
          <div><div className="ie-lbl">Bundle price (₹)</div><input className="ie-inp" type="number" placeholder="e.g. 1899" value={o.bnd_price || ''} onChange={e => onChg('bnd_price', e.target.value)} /></div>
        </>}
        {o.offer_type === 'Free gift' && <>
          {(o.gift_offers || []).map((go, gi) => (
            <div key={gi} className="gift-block">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)' }}>Gift offer {gi + 1}</span>
                {(o.gift_offers || []).length > 1 && <button className="gift-rm" onClick={() => onChg('gift_offers', (o.gift_offers || []).filter((_, i) => i !== gi))}>Remove</button>}
              </div>
              <div style={{ marginBottom: 8 }}><div className="ie-lbl">Main product</div>{singleChip(go.main, 'giftMain', gi)}</div>
              <div><div className="ie-lbl">Free gift item</div>{singleChip(go.gift, 'giftItem', gi)}</div>
            </div>
          ))}
          <button className="add-sm" onClick={() => onChg('gift_offers', [...(o.gift_offers || []), { main: null, gift: null }])}>+ Add gift offer</button>
        </>}
      </div>
    );
  };

  // ── Per-influencer config ─────────────────────────────────────────────────────
  const renderInfluencerConfig = (si, ii) => {
    const set = sets[si];
    const inf = set.influencers[ii];
    const dl = calcDeadline(inf.post_date);
    const code = inf.custom_code || autoCode(set.coupon_prefix, inf.name);
    const infErrs = validation.sets[si]?.influencers[ii] || {};
    const onChg = (f, v) => updateInf(si, ii, { [f]: v });
    const infTouchKey = (f) => `inf_${si}_${ii}_${f}`;
    const infErr = (f) => showErr(infTouchKey(f), infErrs[f]);
    return (
      <div key={ii} className="ic">
        <div className="ic-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div className="iav">{inf.init}</div>
            <div><div className="ic-name">{inf.name}</div><div className="ic-handle">{inf.handle}</div></div>
          </div>
          <button className="ic-rm" onClick={() => removeInfluencer(si, ii)}>Remove</button>
        </div>
        <div className="ic-body">
          <div>
            <div className="ie-lbl">Posting date</div>
            <div className="post-date-row">
              <div className="post-date-lbl">Post date<small>Submission deadline: 24h before</small></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  className={`post-date-inp${infErr('post_date') ? ' inp-err' : ''}`}
                  type="date"
                  min={set.window_start || undefined}
                  max={set.window_end || endDate || undefined}
                  value={inf.post_date || ''}
                  onChange={e => { onChg('post_date', e.target.value); markTouched(infTouchKey('post_date')); }}
                  onBlur={() => markTouched(infTouchKey('post_date'))}
                />
                {dl && <span className="dl-chip">Submit by {dl}</span>}
              </div>
              {infErr('post_date') && <div className="field-err">{infErrs.post_date}</div>}
            </div>
          </div>
          {needsBudget(set.goal) && (
            <div>
              <div className="ie-lbl">Budget (₹)</div>
              <input
                className={`ie-inp${infErr('influencer_budget') ? ' inp-err' : ''}`}
                type="number"
                placeholder="e.g. 15000"
                value={inf.influencer_budget || ''}
                onChange={e => { onChg('influencer_budget', e.target.value); markTouched(infTouchKey('influencer_budget')); }}
                onBlur={() => markTouched(infTouchKey('influencer_budget'))}
              />
              {infErr('influencer_budget') && <div className="field-err">{infErrs.influencer_budget}</div>}
              {set.set_budget && !infErr('influencer_budget') && <div className="hint">Set remaining: ₹{fmtN(setRem(si))}</div>}
            </div>
          )}
          {needsOffer(set.goal) && <>
            <div>
              <div className="ie-lbl">Commission %</div>
              <input
                className={`ie-inp${infErr('commission_pct') ? ' inp-err' : ''}`}
                type="number"
                placeholder="e.g. 10"
                value={inf.commission_pct || ''}
                onChange={e => { onChg('commission_pct', e.target.value); markTouched(infTouchKey('commission_pct')); }}
                onBlur={() => markTouched(infTouchKey('commission_pct'))}
              />
              {infErr('commission_pct') && <div className="field-err">{infErrs.commission_pct}</div>}
              {!infErr('commission_pct') && Number(inf.commission_pct) > 25 && (
                <div className="field-warn">Commission above 25% is unusually high</div>
              )}
            </div>
            <div>
              <div className="ie-lbl">Offer type</div>
              <div className="ot-grid">
                {OFFER_TYPES.map(ot => <button key={ot} className={`ot${inf.offer_type === ot ? ' sel' : ''}${infErr('offer_type') ? ' ot-err' : ''}`} onClick={() => { onChg('offer_type', inf.offer_type === ot ? '' : ot); markTouched(infTouchKey('offer_type')); }}>{ot}</button>)}
              </div>
              {infErr('offer_type') && <div className="field-err">{infErrs.offer_type}</div>}
              {renderOfferConfig(inf, onChg, si, ii, false)}
            </div>
          </>}
          {needsCoupon(set.goal) && (
            <div>
              <div className="ie-lbl">Coupon code</div>
              {inf.edit_code ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="ie-inp" placeholder="Custom code" value={inf.custom_code || ''} onChange={e => onChg('custom_code', e.target.value)} />
                  <button style={{ padding: '8px 12px', background: 'var(--orange)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }} onClick={() => onChg('edit_code', false)}>Save</button>
                </div>
              ) : (
                <div className="cpn-row">
                  <div className="cpn-pill">{code}</div>
                  <button className="cpn-edit" onClick={() => onChg('edit_code', true)}>Edit</button>
                </div>
              )}
            </div>
          )}
          {PHYSICAL_GOODS_CATEGORIES.includes(brandCategory) && (
            <label className="phys-check">
              <input type="checkbox" checked={inf.physical_delivery || false} onChange={e => onChg('physical_delivery', e.target.checked)} style={{ width: 14, height: 14, accentColor: 'var(--orange)', flexShrink: 0, marginTop: 2 }} />
              <div><div className="phys-lbl">Physical product delivery</div><div className="phys-sub">Send product samples for content creation</div></div>
            </label>
          )}
          {inf.physical_delivery && PHYSICAL_GOODS_CATEGORIES.includes(brandCategory) && <input className="ie-inp" placeholder="Delivery address" value={inf.delivery_address || ''} onChange={e => onChg('delivery_address', e.target.value)} />}
        </div>
      </div>
    );
  };

  // ── Group config ──────────────────────────────────────────────────────────────
  const renderGroupConfig = (si) => {
    const set = sets[si];
    const g = set.group;
    const onChg = (f, v) => updateGroup(si, { [f]: v });
    const toggleArr = (field, val) => {
      const arr = g[field] || [];
      const nextArr = arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
      onChg(field, nextArr);
      // Refresh the live match count so the brand sees how many influencers
      // their selection matches. Pass the new group directly because the
      // setState hasn't flushed by the time fetchMatches reads its closure.
      fetchMatches(si, { ...g, [field]: nextArr });
    };
    const estMax = Number(g.per_influencer_budget || 0) * Number(g.max_cap || 0);
    const groupErrs = validation.sets[si]?.group || {};
    const groupWarns = validation.sets[si]?.warnings || {};
    const grpTouchKey = (f) => `group_${si}_${f}`;
    const grpErr = (f) => showErr(grpTouchKey(f), groupErrs[f]);
    return (
      <div className="group-panel">
        <div className="group-panel-head"><div className="group-panel-title">🌐 Open group — broadcast to matched influencers</div></div>
        <div className="group-panel-body">
          <div>
            <div className="filter-title">Tier</div>
            <div className="filter-chips">
              {TIERS.map(t => <div key={t.key} className={`fchip${g.tiers.includes(t.key) ? ' sel' : ''}`} onClick={() => toggleArr('tiers', t.key)}>{t.label} <span style={{ opacity: .6, fontSize: 9 }}>{t.sub}</span></div>)}
            </div>
          </div>
          <div>
            <div className="filter-title">Niche</div>
            <div className="filter-chips">{NICHES.map(n => <div key={n} className={`fchip${g.niches.includes(n) ? ' sel' : ''}`} onClick={() => toggleArr('niches', n)}>{n}</div>)}</div>
          </div>
          <div>
            <div className="filter-title">City</div>
            <div className="filter-chips">{CITIES.map(c => <div key={c} className={`fchip${g.cities.includes(c) ? ' sel' : ''}`} onClick={() => toggleArr('cities', c)}>{c}</div>)}</div>
          </div>
          <div className="filter-row">
            <div className="filter-field">
              <div className="filter-title">Min engagement rate (%)</div>
              <input className="filter-inp" type="number" placeholder="e.g. 4.0" value={g.min_er || ''} onChange={e => { onChg('min_er', e.target.value); fetchMatches(si); }} />
            </div>
            <div className="filter-field">
              <div className="filter-title">Gender</div>
              <select className="filter-sel" value={g.gender || ''} onChange={e => { onChg('gender', e.target.value); fetchMatches(si); }}>
                <option value="">Any</option><option value="female">Female</option><option value="male">Male</option>
              </select>
            </div>
          </div>
          <div className="match-preview">
            <div><div className="match-count">{matchResult.count}</div><div className="match-label">influencers matched</div></div>
            {matchResult.influencers?.length > 0 && (
              <div className="match-avs">{matchResult.influencers.slice(0, 5).map((inf, i) => <div key={i} className="match-av">{(inf.full_name || 'X').slice(0, 2).toUpperCase()}</div>)}</div>
            )}
          </div>
          <div>
            <div className="filter-title">Max influencers to invite</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                className={`cap-inp${grpErr('max_cap') ? ' inp-err' : ''}`}
                type="number"
                min="1"
                value={g.max_cap || ''}
                onChange={e => { onChg('max_cap', e.target.value); markTouched(grpTouchKey('max_cap')); }}
                onBlur={() => markTouched(grpTouchKey('max_cap'))}
              />
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>First to accept get the slot</span>
            </div>
            {grpErr('max_cap') && <div className="field-err">{groupErrs.max_cap}</div>}
          </div>
          {needsBudget(set.goal) && (
            <div>
              <div className="filter-title">Budget per influencer (₹)</div>
              <input
                className={`filter-inp${grpErr('per_influencer_budget') ? ' inp-err' : ''}`}
                type="number"
                placeholder="e.g. 5000"
                value={g.per_influencer_budget || ''}
                onChange={e => { onChg('per_influencer_budget', e.target.value); markTouched(grpTouchKey('per_influencer_budget')); }}
                onBlur={() => markTouched(grpTouchKey('per_influencer_budget'))}
              />
              {grpErr('per_influencer_budget') && <div className="field-err">{groupErrs.per_influencer_budget}</div>}
              {grpErr('projected') && <div className="field-err">{groupErrs.projected}</div>}
              {g.per_influencer_budget && g.max_cap && !grpErr('projected') && (
                <div className="grp-est" style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase' }}>Est. max spend</span>
                    <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--gold)' }}>₹{fmtN(estMax)}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--t3)' }}>Actual spend depends on acceptance count</div>
                </div>
              )}
            </div>
          )}
          {needsOffer(set.goal) && <>
            <div>
              <div className="filter-title">Commission %</div>
              <input
                className={`filter-inp${grpErr('commission_pct') ? ' inp-err' : ''}`}
                type="number"
                placeholder="e.g. 10"
                value={g.commission_pct || ''}
                onChange={e => { onChg('commission_pct', e.target.value); markTouched(grpTouchKey('commission_pct')); }}
                onBlur={() => markTouched(grpTouchKey('commission_pct'))}
              />
              {grpErr('commission_pct') && <div className="field-err">{groupErrs.commission_pct}</div>}
              {!grpErr('commission_pct') && groupWarns.group_commission_pct && (
                <div className="field-warn">{groupWarns.group_commission_pct}</div>
              )}
            </div>
            <div>
              <div className="filter-title">Offer type</div>
              <div className="ot-grid">{OFFER_TYPES.map(ot => <button key={ot} className={`ot${g.offer_type === ot ? ' sel' : ''}`} onClick={() => onChg('offer_type', g.offer_type === ot ? '' : ot)}>{ot}</button>)}</div>
              {renderOfferConfig(g, onChg, si, null, true)}
            </div>
          </>}
          {needsCoupon(set.goal) && set.coupon_prefix && (
            <div className="ib amber">Coupon codes auto-generated as <strong>{set.coupon_prefix}_FIRSTNAME</strong> when each influencer accepts.</div>
          )}
          {PHYSICAL_GOODS_CATEGORIES.includes(brandCategory) && (
            <label className="phys-check">
              <input type="checkbox" checked={g.physical_delivery || false} onChange={e => onChg('physical_delivery', e.target.checked)} style={{ width: 14, height: 14, accentColor: 'var(--orange)', flexShrink: 0, marginTop: 2 }} />
              <div><div className="phys-lbl">Physical product delivery</div><div className="phys-sub">Address collected from each influencer on acceptance</div></div>
            </label>
          )}
        </div>
      </div>
    );
  };

  // ── Set body ──────────────────────────────────────────────────────────────────
  const renderSetBody = (si) => {
    const set = sets[si];
    const sr = setRem(si), su = setInfSpent(si);
    const sp = set.set_budget ? Math.min(100, su / Number(set.set_budget) * 100) : 0;
    return (
      <>
        <div className="set-body">
          {/* Set name */}
          <div className="sec">
            <div className="sec-lbl">Set name</div>
            {(() => {
              const errKey = `set_${si}_name`;
              const errMsg = showErr(errKey, validation.sets[si]?.fields.name);
              return <>
                <input
                  className={`inp${errMsg ? ' inp-err' : ''}`}
                  type="text"
                  value={set.name}
                  placeholder="e.g. Set A"
                  onChange={e => { updateSet(si, { name: e.target.value }); markTouched(errKey); }}
                  onBlur={() => markTouched(errKey)}
                />
                {errMsg && <div className="field-err">{errMsg}</div>}
              </>;
            })()}
          </div>
          {/* Goal */}
          <div className="sec">
            <div className="sec-lbl">Goal — defines payout model for all influencers in this set</div>
            <div className="goal-grid">
              {[
                { key: 'conversion', cls: 'sel-conv', icon: '%', color: 'var(--conv)', bg: 'var(--conv-l)', desc: 'Commission only. No budget. Coupon codes track all sales.' },
                { key: 'engagement', cls: 'sel-eng', icon: '♦', color: 'var(--eng)', bg: 'var(--eng-l)', desc: 'Fixed pay for content only. No sales tracking or coupon codes.' },
                { key: 'hybrid', cls: 'sel-hyb', icon: '~', color: 'var(--hyb)', bg: 'var(--hyb-l)', desc: 'Fixed engagement fee + commission on tracked sales.' },
              ].map(g => (
                <div key={g.key} className={`gc${set.goal === g.key ? ` ${g.cls}` : ''}`} onClick={() => updateSet(si, { goal: g.key })}>
                  <div className="gc-icon" style={{ background: g.bg }}>{g.icon}</div>
                  <div className="gc-name" style={set.goal === g.key ? { color: g.color } : {}}>{g.key.charAt(0).toUpperCase() + g.key.slice(1)}</div>
                  <div className="gc-desc">{g.desc}</div>
                </div>
              ))}
            </div>
            {set.goal === 'engagement' && <div className="ib teal">Engagement campaigns pay a fixed fee for content creation only. No product promotion, no coupon codes.</div>}
            {set.goal === 'conversion' && <div className="ib orange">Conversion campaigns are commission-only. All sales tracked per influencer.</div>}
          </div>
          {set.goal && <>
            {/* Set budget */}
            {needsBudget(set.goal) && set.influencer_mode === 'handpick' && (() => {
              const errKey = `set_${si}_set_budget`;
              const errMsg = showErr(errKey, validation.sets[si]?.fields.set_budget);
              const overspentMsg = validation.sets[si]?.fields.set_budget_overspent;
              return (
                <div className="sec">
                  <div className="sec-lbl">Set budget (₹){set.goal === 'hybrid' ? ' — engagement portion only' : ''}</div>
                  <input
                    className={`inp inp-mono${errMsg ? ' inp-err' : ''}`}
                    type="number"
                    placeholder="e.g. 80000"
                    value={set.set_budget || ''}
                    onChange={e => { updateSet(si, { set_budget: e.target.value }); markTouched(errKey); }}
                    onBlur={() => markTouched(errKey)}
                  />
                  {errMsg && <div className="field-err">{errMsg}</div>}
                  {overspentMsg && <div className="field-err">{overspentMsg}</div>}
                  {set.set_budget && (
                    <div className="bstrip" style={{ marginTop: 8, marginBottom: 0 }}>
                      <div className="bstrip-top">
                        <span className="bstrip-lbl">Set allocation</span>
                        <span className={`bstrip-val ${sr < 0 ? 'bv-over' : sp > 80 ? 'bv-warn' : 'bv-ok'}`}>₹{fmtN(sr)} remaining</span>
                      </div>
                      <div className="bbar"><div className={`bfill ${sr < 0 ? 'over' : sp > 80 ? 'warn' : ''}`} style={{ width: `${sp}%` }} /></div>
                      <div className="bstrip-note">₹{fmtN(su)} across {set.influencers.length} influencer(s)</div>
                    </div>
                  )}
                </div>
              );
            })()}
            {/* Window */}
            <div className="sec">
              <div className="sec-lbl">Content window — influencers pick their posting date within this range</div>
              <div className="g2">
                <div className="f">
                  <label className="flbl">Window start</label>
                  <input
                    className={`inp${showErr(`set_${si}_window_start`, validation.sets[si]?.fields.window_start) ? ' inp-err' : ''}`}
                    type="date"
                    value={set.window_start || ''}
                    min={startDate || undefined}
                    max={endDate || undefined}
                    onBlur={() => markTouched(`set_${si}_window_start`)}
                    onChange={e => {
                    markTouched(`set_${si}_window_start`);
                    const v = e.target.value;
                    if (startDate && v < startDate) { updateSet(si, { window_start: startDate }); return; }
                    if (endDate && v > endDate) { updateSet(si, { window_start: endDate }); return; }
                    updateSet(si, { window_start: v });
                  }} />
                  {showErr(`set_${si}_window_start`, validation.sets[si]?.fields.window_start) && (
                    <div className="field-err">{validation.sets[si].fields.window_start}</div>
                  )}
                </div>
                <div className="f">
                  <label className="flbl">Window end{set.goal === 'hybrid' ? ' (offer expiry)' : ''}</label>
                  <input
                    className={`inp${showErr(`set_${si}_window_end`, validation.sets[si]?.fields.window_end) ? ' inp-err' : ''}`}
                    type="date"
                    value={set.window_end || ''}
                    min={set.window_start || startDate || undefined}
                    max={endDate || undefined}
                    onBlur={() => markTouched(`set_${si}_window_end`)}
                    onChange={e => {
                      markTouched(`set_${si}_window_end`);
                      const v = e.target.value;
                      if (startDate && v < startDate) { updateSet(si, { window_end: startDate }); return; }
                      if (endDate && v > endDate) { updateSet(si, { window_end: endDate }); return; }
                      updateSet(si, { window_end: v });
                    }}
                  />
                  {showErr(`set_${si}_window_end`, validation.sets[si]?.fields.window_end) && (
                    <div className="field-err">{validation.sets[si].fields.window_end}</div>
                  )}
                </div>
              </div>
            </div>
            {/* Formats */}
            <div className="sec">
              <div className="sec-lbl">Content formats</div>
              <div className="fmt-chips">{FORMATS.map(f => <div key={f} className={`fmt-chip${set.formats.some(x => x.name === f) ? ' sel' : ''}`} onClick={() => { toggleFormat(si, f); markTouched(`set_${si}_formats`); }}>{f}</div>)}</div>
              {set.formats.length > 0 && set.formats.map(f => (
                <div key={f.name} className="cnt-row">
                  <span className="cnt-name">{f.name}</span>
                  <div className="counter">
                    <button className="cbtn" onClick={() => setFormatCount(si, f.name, -1)}>−</button>
                    <span className="cval">{f.count}</span>
                    <button className="cbtn" onClick={() => setFormatCount(si, f.name, 1)}>+</button>
                  </div>
                </div>
              ))}
              {showErr(`set_${si}_formats`, validation.sets[si]?.fields.formats) && (
                <div className="field-err">{validation.sets[si].fields.formats}</div>
              )}
            </div>
            {/* Brief */}
            <div className="sec">
              <div className="sec-lbl">Content brief</div>
              <textarea className="inp" rows={3} style={{ resize: 'vertical', lineHeight: 1.6 }} placeholder="Creative direction, tone, key messages, do's and don'ts…" value={set.brief || ''} onChange={e => updateSet(si, { brief: e.target.value })} />
            </div>
            {/* Assets */}
            <div className="sec">
              <div className="sec-lbl">Brand assets <span style={{ textTransform: 'none', letterSpacing: 0, fontSize: 9, fontWeight: 400, color: 'var(--t3)', marginLeft: 4 }}>— delivered to influencer when contract signed</span></div>
              <div className="assets-zone">
                <div className="assets-hint">Logos, raw footage, brand guidelines, reference images</div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <span className="assets-btn" onClick={() => setGalleryPickerSetIdx(si)} style={{ cursor: 'pointer' }}>
                    + Add from Gallery
                  </span>
                </div>
                {set.assets.length > 0 && (
                  <div className="asset-chips">
                    {set.assets.map((a, ai) => {
                      const mime = a.file_type || '';
                      const icon = a.icon || (mime.startsWith('video') ? '🎬' : mime.startsWith('image') ? '🖼️' : '📄');
                      const name = a.title || a.name || a.file_name;
                      const size = a.size || (a.file_size_bytes ? `${(a.file_size_bytes / 1024).toFixed(0)} KB` : '');
                      return (
                        <div key={a.asset_id || a.id || ai} className="asset-chip">
                          <span>{icon}</span><span>{name}</span>
                          {size && <span style={{ fontSize: 10, color: 'var(--t3)' }}>{size}</span>}
                          <span className="ax" onClick={() => updateSet(si, { assets: set.assets.filter((_, j) => j !== ai) })}>✕</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            {/* Coupon prefix */}
            {needsCoupon(set.goal) && (() => {
              const errKey = `set_${si}_coupon_prefix`;
              const errMsg = showErr(errKey, validation.sets[si]?.fields.coupon_prefix);
              return (
                <div className="sec">
                  <div className="sec-lbl">Coupon prefix</div>
                  <input
                    className={`inp${errMsg ? ' inp-err' : ''}`}
                    placeholder="e.g. SALE25 → SALE25_PRIYA"
                    value={set.coupon_prefix || ''}
                    onChange={e => { updateSet(si, { coupon_prefix: e.target.value.toUpperCase() }); markTouched(errKey); }}
                    onBlur={() => markTouched(errKey)}
                  />
                  {errMsg && <div className="field-err">{errMsg}</div>}
                  <div className="hint">System appends influencer's first name: {set.coupon_prefix ? `${set.coupon_prefix}_PRIYA` : 'CODE_PRIYA'}</div>
                </div>
              );
            })()}
            {/* Mode toggle */}
            <div className="sec">
              <div className="sec-lbl">Influencer assignment mode</div>
              <div className="mode-toggle">
                <button className={`mode-btn${set.influencer_mode === 'handpick' ? ' act-hp' : ''}`} onClick={() => updateSet(si, { influencer_mode: 'handpick' })}>🎯 Handpick</button>
                <button className={`mode-btn${set.influencer_mode === 'open_group' ? ' act-grp' : ''}`} onClick={() => updateSet(si, { influencer_mode: 'open_group' })}>🌐 Open group</button>
              </div>
              {set.influencer_mode === 'handpick' && (
                <>
                  {/* ── Groups section ── */}
                  {infGroups.length > 0 && (
                    <div className="grp-section" style={{ marginBottom: 10 }}>
                      <div className="grp-section-head">
                        <div className="grp-section-title">Add from saved group</div>
                        <button className="grp-create-btn" onClick={openGroupModal}>+ New group</button>
                      </div>
                      <div className="grp-list">
                        {infGroups.map(g => (
                          <div key={g.id} className="grp-chip" onClick={() => addGroupToSet(si, g.id)}>
                            {g.name} <span className="grp-count">{g.influencer_ids.length}</span>
                            <span className="grp-del" onClick={e => { e.stopPropagation(); deleteGroup(g.id); }}>x</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {infGroups.length === 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <button className="grp-create-btn" onClick={openGroupModal}>+ Create influencer group</button>
                    </div>
                  )}

                  {/* ── Browse panel ── */}
                  <div className="browse-panel">
                    <div className="browse-head">
                      <div className="browse-head-left">
                        <span className="browse-title">Browse Influencers</span>
                        <input className="browse-search" placeholder="Search by name or @handle..." value={browseQuery} onChange={e => setBrowseQuery(e.target.value)} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {browseSelected.length > 0 && <span className="browse-sel-count">{browseSelected.length} selected</span>}
                        <button className="browse-toggle-filters" onClick={() => setBrowseFiltersOpen(p => !p)}>
                          {browseFiltersOpen ? 'Hide filters' : 'Filters'}
                        </button>
                      </div>
                    </div>

                    {browseFiltersOpen && (
                      <div className="browse-filters">
                        <div className="browse-ff">
                          <label>Niche</label>
                          <select value={browseNiche} onChange={e => setBrowseNiche(e.target.value)}>
                            <option value="">All</option>
                            {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                        <div className="browse-ff">
                          <label>Tier</label>
                          <select value={browseTier} onChange={e => setBrowseTier(e.target.value)}>
                            <option value="">All</option>
                            {TIERS.map(t => <option key={t.key} value={t.key}>{t.label} ({t.sub})</option>)}
                          </select>
                        </div>
                        {/* Gender filter removed — not supported by the unified search backend.
                            browseGender state is retained so existing references stay valid. */}
                        <div className="browse-ff">
                          <label>City</label>
                          <input placeholder="e.g. Mumbai" value={browseCity} onChange={e => setBrowseCity(e.target.value)} />
                        </div>
                        <div className="browse-ff" style={{ minWidth: 80 }}>
                          <label>Min Followers</label>
                          <input type="number" placeholder="e.g. 5000" value={browseMinFollowers} onChange={e => setBrowseMinFollowers(e.target.value)} />
                        </div>
                        <div className="browse-ff" style={{ minWidth: 80 }}>
                          <label>Max Followers</label>
                          <input type="number" placeholder="e.g. 100000" value={browseMaxFollowers} onChange={e => setBrowseMaxFollowers(e.target.value)} />
                        </div>
                        <div className="browse-ff" style={{ minWidth: 70 }}>
                          <label>Min ER %</label>
                          <input type="number" step="0.1" placeholder="e.g. 3" value={browseMinEr} onChange={e => setBrowseMinEr(e.target.value)} />
                        </div>
                        {(browseNiche || browseTier || browseGender || browseCity || browseMinFollowers || browseMaxFollowers || browseMinEr) && (
                          <button className="browse-clear" onClick={clearBrowseFilters}>Clear all</button>
                        )}
                      </div>
                    )}

                    {browseLoading ? (
                      <div className="browse-loading">Searching influencers...</div>
                    ) : browseResults.length === 0 ? (
                      <div className="browse-empty">
                        <div className="browse-empty-icon">🔍</div>
                        <div className="browse-empty-text">No influencers found. Try different filters.</div>
                      </div>
                    ) : (
                      <div className="browse-grid">
                        {browseResults.map(inf => {
                          const usedIds = allUsedIds();
                          // 'already in set' only applies to onboarded creators tracked by influencers.id
                          const alreadyInSet = !inf.is_unclaimed && usedIds.includes(inf.id);
                          const selKey = inf.is_unclaimed ? `u:${inf.row_id}` : `o:${inf.id}`;
                          const isSelected = browseSelected.some(s => (s.is_unclaimed ? `u:${s.row_id}` : `o:${s.id}`) === selKey);
                          const niches = [...(inf.niche || []), ...(inf.secondary_niche || [])].slice(0, 2);
                          const initials = (inf.full_name || inf.instagram_handle || 'XX').slice(0, 2).toUpperCase();
                          const er = Number(inf.engagement_rate || 0);
                          return (
                            <div
                              key={selKey}
                              className={`browse-card${isSelected ? ' sel' : ''}${alreadyInSet ? ' already' : ''}`}
                              onClick={() => !alreadyInSet && toggleBrowseSelect(inf)}
                              title={inf.is_unclaimed ? 'Not on Inflx yet — selecting this creates an admin outreach invite' : ''}
                            >
                              <div className={`browse-check`}>{alreadyInSet ? '✓' : isSelected ? '✓' : ''}</div>
                              {inf.profile_image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={inf.profile_image_url} alt={inf.instagram_handle}
                                  className="browse-av" style={{ objectFit: 'cover' }}
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                              ) : (
                                <div className="browse-av">{initials}</div>
                              )}
                              <div className="browse-info">
                                <div className="browse-name" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {inf.full_name || inf.instagram_handle}
                                  </span>
                                  {inf.is_inflx_verified && (
                                    <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 4px', borderRadius: 3, background: '#dbeafe', color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                                      ✓ VERIFIED
                                    </span>
                                  )}
                                  {inf.is_unclaimed && (
                                    <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: 'rgba(168,85,247,.12)', color: '#7e22ce', whiteSpace: 'nowrap' }}>
                                      ✉ INVITE
                                    </span>
                                  )}
                                </div>
                                <div className="browse-meta">@{inf.instagram_handle}{inf.city ? ` · ${inf.city}` : ''}{inf.tier ? ` · ${inf.tier}` : ''}</div>
                                <div className="browse-stats">
                                  <span className="browse-stat">{fmtNum(inf.followers_count)}</span>
                                  <span className={`browse-stat${er >= 5 ? ' er-high' : ''}`}>{er.toFixed(2)}% ER</span>
                                  {niches.map(n => <span key={n} className="browse-stat">{n}</span>)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="browse-foot">
                      <div className="browse-page-info">
                        Page {browsePage} of {Math.max(1, Math.ceil(browseTotal / 20))} ({browseTotal} total)
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="browse-page-btns">
                          <button className="browse-page-btn" disabled={browsePage <= 1} onClick={() => doBrowseSearch(browsePage - 1)}>Prev</button>
                          <button className="browse-page-btn" disabled={browsePage >= Math.ceil(browseTotal / 20)} onClick={() => doBrowseSearch(browsePage + 1)}>Next</button>
                        </div>
                        <button
                          className="browse-add-btn"
                          disabled={browseSelected.length === 0}
                          onClick={() => addBrowseSelectedToSet(si)}
                          title={(() => {
                            const u = browseSelected.filter(s => s.is_unclaimed).length;
                            const o = browseSelected.length - u;
                            if (u && o) return `${o} added directly · ${u} sent to Inflx admin for outreach`;
                            if (u)      return `${u} sent to Inflx admin for outreach`;
                            return `${o} added to set`;
                          })()}
                        >
                          {(() => {
                            const u = browseSelected.filter(s => s.is_unclaimed).length;
                            const o = browseSelected.length - u;
                            if (browseSelected.length === 0) return 'Add selected';
                            if (u && o) return `Add ${o} · Invite ${u}`;
                            if (u)      return `Invite ${u}`;
                            return `Add ${o} selected`;
                          })()}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── Added influencers config cards ── */}
                  {set.influencers.length > 0 && (
                    <div style={{ marginTop: 12, fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                      {set.influencers.length} influencer{set.influencers.length !== 1 ? 's' : ''} added
                    </div>
                  )}
                  {set.influencers.map((_, ii) => renderInfluencerConfig(si, ii))}
                </>
              )}
              {set.influencer_mode === 'open_group' && renderGroupConfig(si)}
            </div>
          </>}
        </div>
        <div className="set-actions">
          <button className="dup-btn" onClick={() => duplicateSet(si)}>⧉ Duplicate set</button>
          <button className="del-set-btn" onClick={() => deleteSet(si)} disabled={sets.length <= 1}>{sets.length <= 1 ? 'Min 1 set' : 'Delete set'}</button>
        </div>
      </>
    );
  };

  // ── Review ────────────────────────────────────────────────────────────────────
  const renderReview = () => {
    const used = totalSetBudget(), rem = campRem();
    const pct = totalBudget ? Math.min(100, used / Number(totalBudget) * 100) : 0;
    return (
      <div>
        <div className="cc-ct">Review & publish</div>
        <div className="cc-cs">Everything looks good? Invites fire immediately on publish.</div>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Outfit', marginBottom: 4 }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>{startDate} → {endDate}</div>
          {totalBudget && (
            <div className="bstrip" style={{ marginTop: 12 }}>
              <div className="bstrip-top"><span className="bstrip-lbl">Campaign budget</span><span className={`bstrip-val ${rem < 0 ? 'bv-over' : pct > 80 ? 'bv-warn' : 'bv-ok'}`}>₹{fmtN(rem)} remaining</span></div>
              <div className="bbar"><div className={`bfill ${rem < 0 ? 'over' : pct > 80 ? 'warn' : ''}`} style={{ width: `${pct}%` }} /></div>
              <div className="bstrip-note">{rem < 0 ? <span style={{ color: 'var(--red)' }}>Over budget by ₹{fmtN(Math.abs(rem))}</span> : `₹${fmtN(used)} allocated`}</div>
            </div>
          )}
          {/* Per-influencer budget breakdown */}
          {(() => {
            const allInfs = [];
            sets.forEach(s => {
              if (needsBudget(s.goal) && s.influencer_mode === 'handpick') {
                s.influencers.forEach(inf => {
                  if (inf.name && inf.influencer_budget) {
                    allInfs.push({ name: inf.name, handle: inf.handle, budget: Number(inf.influencer_budget || 0), set: s.name });
                  }
                });
              }
              if (needsBudget(s.goal) && s.influencer_mode === 'open_group' && s.group.per_influencer_budget && s.group.max_cap) {
                allInfs.push({ name: `Open group (${s.name})`, handle: `up to ${s.group.max_cap} influencers`, budget: Number(s.group.per_influencer_budget || 0) * Number(s.group.max_cap || 0), set: s.name });
              }
            });
            if (allInfs.length === 0) return null;
            const totalAllocated = allInfs.reduce((t, i) => t + i.budget, 0);
            return (
              <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  ₹{fmtN(totalAllocated)} allocated for {allInfs.length} influencer{allInfs.length !== 1 ? 's' : ''}
                </div>
                {allInfs.map((inf, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{inf.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--t3)' }}>{inf.handle}{inf.set ? ` · ${inf.set}` : ''}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--orange)' }}>₹{fmtN(inf.budget)}</div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
        {sets.map((set, si) => (
          <div key={si} className="rv-set">
            <div className="rv-sh">
              <span className="rv-sn">{set.name}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {set.goal && <span className={`gp ${set.goal === 'hybrid' ? 'hyb' : set.goal === 'engagement' ? 'eng' : 'conv'}`}>{set.goal}</span>}
                {set.influencer_mode === 'open_group' && <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'var(--group-l)', color: 'var(--group)', border: '1px solid rgba(104,211,145,.2)' }}>open group</span>}
              </div>
            </div>
            {set.formats.length > 0 && <div className="rr"><span className="rr-k">Formats</span><span className="rr-v">{set.formats.map(f => `${f.name} ×${f.count}`).join(', ')}</span></div>}
            {set.window_start && <div className="rr"><span className="rr-k">Window</span><span className="rr-v">{set.window_start} → {set.window_end || endDate}</span></div>}
            {needsBudget(set.goal) && set.set_budget && <div className="rr"><span className="rr-k">Set budget</span><span className="rr-v">₹{fmtN(set.set_budget)}</span></div>}
            {set.coupon_prefix && <div className="rr"><span className="rr-k">Coupon prefix</span><span className="rr-v" style={{ color: 'var(--orange)', fontFamily: 'JetBrains Mono' }}>{set.coupon_prefix}</span></div>}
            {set.assets.length > 0 && <div className="rr"><span className="rr-k">Brand assets</span><span className="rr-v">{set.assets.length} file(s)</span></div>}
            {set.influencer_mode === 'handpick' && set.influencers.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px' }}>
                <div className="rv-inf-hd">Handpicked influencers ({set.influencers.length})</div>
                {set.influencers.map((inf, ii) => (
                  <div key={ii} style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><div className="iav">{inf.init}</div><div><div style={{ fontSize: 12, fontWeight: 700 }}>{inf.name}</div><div style={{ fontSize: 10, color: 'var(--t3)' }}>{inf.handle}</div></div></div>
                    {inf.post_date && <><div className="rv-ir"><span className="rv-ir-k">Post date</span><span className="rv-ir-v">{inf.post_date}</span></div><div className="rv-ir"><span className="rv-ir-k">Submit by</span><span className="rv-ir-v">{calcDeadline(inf.post_date)}</span></div></>}
                    {needsBudget(set.goal) && inf.influencer_budget && <div className="rv-ir"><span className="rv-ir-k">Budget</span><span className="rv-ir-v">₹{fmtN(inf.influencer_budget)}</span></div>}
                    {needsOffer(set.goal) && inf.commission_pct && <div className="rv-ir"><span className="rv-ir-k">Commission</span><span className="rv-ir-v">{inf.commission_pct}%</span></div>}
                    {needsOffer(set.goal) && inf.offer_type && <div className="rv-ir"><span className="rv-ir-k">Offer</span><span className="rv-ir-v">{offerSummary(inf)}</span></div>}
                    {needsCoupon(set.goal) && <div className="rv-ir"><span className="rv-ir-k">Coupon</span><span className="rv-ir-v">{inf.custom_code || autoCode(set.coupon_prefix, inf.name)}</span></div>}
                    {inf.physical_delivery && <div className="rv-ir"><span className="rv-ir-k">Physical delivery</span><span className="rv-ir-v">Yes</span></div>}
                    {(() => {
                      const prods = [...(inf.d_prods || []), ...(inf.v_prods || []), ...(inf.bnd_prods || [])].filter(Boolean);
                      const giftProds = (inf.gift_offers || []).flatMap(go => [go.main, go.gift]).filter(Boolean);
                      const bogoProds = [inf.bogo_buy, inf.bogo_get].filter(Boolean);
                      const allProds = [...prods, ...giftProds, ...bogoProds];
                      const uniqueNames = [...new Set(allProds.map(p => typeof p === 'string' ? p : p?.name || p?.id).filter(Boolean))];
                      if (uniqueNames.length > 0) {
                        return <div className="rv-ir"><span className="rv-ir-k">Products</span><span className="rv-ir-v">{uniqueNames.join(', ')}</span></div>;
                      }
                      return <div className="rv-ir"><span className="rv-ir-k">Products</span><span className="rv-ir-v" style={{ color: 'var(--t3)', fontWeight: 400 }}>No specific products assigned (all products available)</span></div>;
                    })()}
                  </div>
                ))}
              </div>
            )}
            {set.influencer_mode === 'open_group' && (
              <div style={{ borderTop: '1px solid rgba(104,211,145,.15)', background: 'rgba(104,211,145,.04)', padding: '12px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--group)', marginBottom: 8 }}>Open group</div>
                {set.group.tiers.length > 0 && <div className="rv-ir"><span className="rv-ir-k">Tiers</span><span className="rv-ir-v">{set.group.tiers.join(', ')}</span></div>}
                {set.group.niches.length > 0 && <div className="rv-ir"><span className="rv-ir-k">Niches</span><span className="rv-ir-v">{set.group.niches.join(', ')}</span></div>}
                {set.group.cities.length > 0 && <div className="rv-ir"><span className="rv-ir-k">Cities</span><span className="rv-ir-v">{set.group.cities.join(', ')}</span></div>}
                <div className="rv-ir"><span className="rv-ir-k">Cap</span><span className="rv-ir-v">{set.group.max_cap}</span></div>
                {needsOffer(set.goal) && set.group.offer_type && <div className="rv-ir"><span className="rv-ir-k">Offer</span><span className="rv-ir-v">{offerSummary(set.group)}</span></div>}
                {needsCoupon(set.goal) && set.coupon_prefix && <div className="rv-ir"><span className="rv-ir-k">Coupon pattern</span><span className="rv-ir-v">{set.coupon_prefix}_FIRSTNAME</span></div>}
              </div>
            )}
          </div>
        ))}
        {isBudgetOver() && <div className="ib" style={{ background: 'var(--red-l)', color: 'var(--red)', border: '1px solid rgba(232,64,26,.3)', marginTop: 12 }}>Budget exceeded — reduce set budgets before publishing.</div>}
      </div>
    );
  };

  // ── Step variables ────────────────────────────────────────────────────────────
  const steps = ['Campaign', 'Deliverable sets', 'Review'];
  const used = totalSetBudget(), rem = campRem();
  const pct = totalBudget ? Math.min(100, used / Number(totalBudget) * 100) : 0;

  if (loadingDraft) {
    return (
      <div className="cc-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ color: 'var(--t2)', fontSize: 14 }}>Loading your draft campaign…</div>
        </div>
      </div>
    );
  }

  // Block unapproved brands (AFTER all hooks)
  if (brandStatus === null) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-3 border-orange border-t-transparent rounded-full" /></div>;
  }
  if (brandStatus !== 'approved') {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Account Under Review</h2>
        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24, lineHeight: 1.6 }}>
          Your account is pending admin approval. Campaign creation will be available once approved — usually within 24 hours.
        </p>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '10px 24px', background: '#1B2D5E', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="cc-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="cc-page">
        <div className="cc-topbar">
          <div className="cc-logo">infl<span className="x">x</span></div>
          <button className="cc-exit" onClick={() => router.push('/dashboard/campaigns')}>✕ Exit</button>
        </div>
        <div className="cc-prog">
          {steps.map((s, i) => (
            <div key={s} style={{ display: 'contents' }}>
              <div className="cc-step-wrap">
                <div className={`cc-sdot${i < step ? ' done' : i === step ? ' act' : ''}`}>{i < step ? '✓' : i + 1}</div>
                <span className={`cc-slbl${i < step ? ' done' : i === step ? ' act' : ''}`}>{s}</span>
              </div>
              {i < steps.length - 1 && <div className={`cc-pline${i < step ? ' done' : ''}`} />}
            </div>
          ))}
        </div>
        <div className="cc-card">
          {/* ── Step 1 ── */}
          {step === 0 && (
            <>
              <div className="cc-ct">Campaign basics</div>
              <div className="cc-cs">Set the top-level details. Budget covers engagement and hybrid sets only. Conversion sets run on commission — no budget needed.</div>
              <div className="f">
                <label className="flbl">Campaign name</label>
                <input
                  className={`inp${showErr('name', validation.campaign.name) ? ' inp-err' : ''}`}
                  type="text"
                  placeholder="e.g. Summer Collection 2025"
                  value={name}
                  onChange={e => { setName(e.target.value); markTouched('name'); }}
                  onBlur={() => markTouched('name')}
                />
                {showErr('name', validation.campaign.name) && <div className="field-err">{validation.campaign.name}</div>}
              </div>
              <div className="g2">
                <div className="f">
                  <label className="flbl">Start date</label>
                  <input
                    className={`inp${showErr('startDate', validation.campaign.startDate) ? ' inp-err' : ''}`}
                    type="date"
                    value={startDate}
                    min={(() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0]; })()}
                    onChange={e => { setStartDate(e.target.value); markTouched('startDate'); }}
                    onBlur={() => markTouched('startDate')}
                  />
                  <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>Campaign must start at least 7 days from today</div>
                  {showErr('startDate', validation.campaign.startDate) && <div className="field-err">{validation.campaign.startDate}</div>}
                </div>
                <div className="f">
                  <label className="flbl">End date</label>
                  <input
                    className={`inp${showErr('endDate', validation.campaign.endDate) ? ' inp-err' : ''}`}
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={e => { setEndDate(e.target.value); markTouched('endDate'); }}
                    onBlur={() => markTouched('endDate')}
                  />
                  {showErr('endDate', validation.campaign.endDate) && <div className="field-err">{validation.campaign.endDate}</div>}
                </div>
              </div>
              <div className="f">
                <label className="flbl">Total campaign budget (₹) <span className="note">— engagement + hybrid sets only</span></label>
                <input
                  className={`inp inp-mono${showErr('totalBudget', validation.campaign.totalBudget) ? ' inp-err' : ''}`}
                  type="number"
                  placeholder="0"
                  value={totalBudget}
                  onChange={e => { setTotalBudget(e.target.value); markTouched('totalBudget'); }}
                  onBlur={() => markTouched('totalBudget')}
                />
                {showErr('totalBudget', validation.campaign.totalBudget) && <div className="field-err">{validation.campaign.totalBudget}</div>}
                {totalBudget && Number(totalBudget) > 0 && (
                  <div className="bstrip" style={{ marginTop: 10, marginBottom: 0 }}>
                    <div className="bstrip-top"><span className="bstrip-lbl">Allocated to sets</span><span className={`bstrip-val ${rem < 0 ? 'bv-over' : pct > 80 ? 'bv-warn' : 'bv-ok'}`}>₹{fmtN(rem)} remaining</span></div>
                    <div className="bbar"><div className={`bfill ${rem < 0 ? 'over' : pct > 80 ? 'warn' : ''}`} style={{ width: `${pct}%` }} /></div>
                    <div className="bstrip-note">₹{fmtN(used)} across {sets.filter(s => needsBudget(s.goal)).length} paid set(s)</div>
                  </div>
                )}
              </div>
              <div className="f">
                <label className="flbl">Negotiation</label>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={allowNegotiation}
                    onChange={e => setAllowNegotiation(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Allow influencers to negotiate fee/terms</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
                      {allowNegotiation
                        ? 'Influencers can Accept, Decline, or Negotiate. Best for individual deals.'
                        : 'Influencers can only Accept or Decline — fixed terms. Best for large rosters where you want consistent pricing.'}
                    </div>
                  </span>
                </label>
              </div>
              {error && <div className="err-msg">{error}</div>}
              {forceShowErrors && validation.step1Errors > 0 && (
                <div className="cc-error-summary">
                  {validation.step1Errors} field{validation.step1Errors !== 1 ? 's' : ''} need{validation.step1Errors === 1 ? 's' : ''} attention. Highlighted in red above.
                </div>
              )}
              <div className="cc-actions">
                <span className="step-ctr">STEP 1 / 3</span>
                <button className="btn-next" onClick={goToStep2} disabled={saving}>{saving ? 'Saving…' : 'Build deliverable sets →'}</button>
              </div>
            </>
          )}
          {/* ── Step 2 ── */}
          {step === 1 && (
            <>
              <div className="cc-ct">Deliverable sets</div>
              <div className="cc-cs">Each set groups one theme. Goal drives payout model. Assign influencers as <strong>handpicked</strong> individuals or an <strong>open group</strong> — one mode per set.</div>
              {totalBudget && Number(totalBudget) > 0 && (
                <div className="bstrip">
                  <div className="bstrip-top"><span className="bstrip-lbl">Campaign budget</span><span className={`bstrip-val ${rem < 0 ? 'bv-over' : pct > 80 ? 'bv-warn' : 'bv-ok'}`}>₹{fmtN(rem)} of ₹{fmtN(totalBudget)} remaining</span></div>
                  <div className="bbar"><div className={`bfill ${rem < 0 ? 'over' : pct > 80 ? 'warn' : ''}`} style={{ width: `${pct}%` }} /></div>
                  <div className="bstrip-note">{rem < 0 ? <span style={{ color: 'var(--red)' }}>Over by ₹{fmtN(Math.abs(rem))}</span> : 'Distributed across engagement & hybrid sets'}</div>
                </div>
              )}
              {duplicateToast && (
                <div style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--teal-l)', border: '1px solid var(--teal)', borderRadius: 10, fontSize: 12, fontWeight: 600, color: 'var(--teal)' }}>
                  ✓ {duplicateToast}
                </div>
              )}
              <div className="set-tabs">
                {sets.map((s, i) => (
                  <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
                    <button className={`set-tab${activeSet === i ? ' act' : ''}`} onClick={() => setActiveSet(i)} style={{ borderRadius: sets.length > 1 ? '20px 0 0 20px' : '20px', paddingRight: sets.length > 1 ? 8 : 14 }}>
                      {s.name}<span className="mdot" style={{ background: s.influencer_mode === 'open_group' ? 'var(--group)' : 'var(--orange)' }} />
                    </button>
                    {sets.length > 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSet(i); }}
                        style={{ padding: '6px 10px 6px 6px', border: '1px solid var(--border2)', borderLeft: 'none', borderRadius: '0 20px 20px 0', fontSize: 10, fontWeight: 700, cursor: 'pointer', color: 'var(--t3)', background: activeSet === i ? 'var(--orange)' : 'none', fontFamily: "'Plus Jakarta Sans',sans-serif", transition: 'all .15s' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = activeSet === i ? 'rgba(255,255,255,.7)' : 'var(--t3)'; }}
                        title="Remove set"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button className="add-set-btn" onClick={addSet}>+ Add set</button>
              </div>
              {renderSetBody(activeSet)}
              {error && <div className="err-msg">{error}</div>}
              {forceShowErrors && (validation.step1Errors + validation.step2Errors) > 0 && (
                <div className="cc-error-summary">
                  {validation.step1Errors + validation.step2Errors} field{(validation.step1Errors + validation.step2Errors) !== 1 ? 's' : ''} need{(validation.step1Errors + validation.step2Errors) === 1 ? 's' : ''} attention.
                  {validation.step1Errors > 0 && ` ${validation.step1Errors} on Step 1.`}
                  {validation.step2Errors > 0 && ` ${validation.step2Errors} across the sets below.`}
                </div>
              )}
              <div className="cc-actions">
                <button className="btn-back" onClick={goBack}>← Back</button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-draft" onClick={saveDraft} disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</button>
                  <button className="btn-next" onClick={goToStep3} disabled={saving}>{saving ? 'Saving sets…' : 'Review →'}</button>
                </div>
              </div>
            </>
          )}
          {/* ── Step 3 ── */}
          {step === 2 && (
            <>
              {renderReview()}
              {error && <div className="err-msg">{error}</div>}
              <div className="cc-actions">
                <button className="btn-back" onClick={goBack}>← Back</button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-draft" onClick={saveDraft}>Save draft</button>
                  <button className="btn-pub" onClick={handlePublish} disabled={isBudgetOver() || publishing}>{publishing ? 'Publishing…' : '🚀 Publish campaign'}</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {/* Product Catalogue Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="prod-modal">
            <div className="prod-modal-head">
              <div>
                <div className="prod-modal-title">Select products</div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>Choose from your product catalogue</div>
              </div>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="prod-modal-search"><input type="text" placeholder="Search products…" value={modalSearch} onChange={e => setModalSearch(e.target.value)} /></div>
            <div className="prod-modal-body">
              <div className="cat-filter">{prodCategories.map(c => <div key={c} className={`cat-chip${modalCat === c ? ' sel' : ''}`} onClick={() => setModalCat(c)}>{c}</div>)}</div>
              <div className="prod-grid">
                {filteredProds.map(p => {
                  const sel = modalTempSel.some(s => s.id === p.id);
                  return (
                    <div key={p.id} className={`prod-card${sel ? ' sel' : ''}`} onClick={() => toggleModalProd(p)}>
                      <div className="prod-card-img">{p.image_url ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} /> : '🛍️'}</div>
                      <div className="prod-card-name">{p.name}</div>
                      <div className="prod-card-price">₹{fmtN(p.price)}</div>
                      <div className="prod-card-meta">{p.category}{p.sku ? ` · ${p.sku}` : ''}</div>
                    </div>
                  );
                })}
                {filteredProds.length === 0 && (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: 'var(--t3)', fontSize: 12 }}>
                    {products.length === 0 ? 'No products in your catalogue yet.' : 'No products match your search.'}
                  </div>
                )}
              </div>
            </div>
            <div className="prod-modal-foot">
              <span className="prod-sel-count">{modalTempSel.length === 0 ? 'None selected' : `${modalTempSel.length} selected`}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="prod-cancel-btn" onClick={closeModal}>Cancel</button>
                <button className="prod-confirm-btn" onClick={confirmModal} disabled={modalTempSel.length === 0}>Confirm selection</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Group creation modal ── */}
      {groupModalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setGroupModalOpen(false)}>
          <div className="grp-modal">
            <div className="grp-modal-head">
              <div className="grp-modal-title">Create Influencer Group</div>
              <button className="modal-close" onClick={() => setGroupModalOpen(false)}>x</button>
            </div>
            <div className="grp-modal-body">
              <div className="f">
                <label className="flbl">Group name</label>
                <input className="inp" placeholder="e.g. Food bloggers Hyderabad" value={groupName} onChange={e => setGroupName(e.target.value)} />
              </div>
              <div className="f">
                <label className="flbl">Search and select influencers</label>
                <input
                  className="inp"
                  placeholder="Search by name or @handle..."
                  value={groupSearchQ}
                  onChange={e => doGroupSearch(e.target.value)}
                />
              </div>
              {groupSearchLoading && <div style={{ fontSize: 11, color: 'var(--t3)', padding: '8px 0' }}>Searching...</div>}
              {groupSearchResults.length > 0 && (
                <div className="grp-inf-list">
                  {groupSearchResults.map(inf => {
                    const selected = groupSelectedIds.includes(inf.id);
                    return (
                      <div key={inf.id} className={`grp-inf-item${selected ? ' sel' : ''}`} onClick={() => toggleGroupSelect(inf.id)}>
                        <div className="browse-check" style={{ width: 16, height: 16, borderRadius: 4, fontSize: 10 }}>
                          {selected ? '✓' : ''}
                        </div>
                        <div className="browse-av" style={{ width: 28, height: 28, fontSize: 9 }}>
                          {(inf.full_name || 'X').slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{inf.full_name || inf.instagram_handle}</div>
                          <div style={{ fontSize: 10, color: 'var(--t3)' }}>
                            @{inf.instagram_handle}{inf.city ? ` · ${inf.city}` : ''}{inf.tier ? ` · ${inf.tier}` : ''}
                          </div>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--t3)' }}>{fmtNum(inf.followers_count)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {groupSelectedIds.length > 0 && (
                <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: 'var(--orange)' }}>
                  {groupSelectedIds.length} influencer{groupSelectedIds.length !== 1 ? 's' : ''} selected
                </div>
              )}
            </div>
            <div className="grp-modal-foot">
              <button className="prod-cancel-btn" onClick={() => setGroupModalOpen(false)}>Cancel</button>
              <button className="prod-confirm-btn" onClick={saveNewGroup} disabled={!groupName.trim() || groupSelectedIds.length === 0}>
                Save group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gallery picker for brand-assets section */}
      <GalleryPicker
        open={galleryPickerSetIdx !== null}
        onClose={() => setGalleryPickerSetIdx(null)}
        initialSelectedIds={galleryPickerSetIdx !== null ? (sets[galleryPickerSetIdx]?.assets || []).map(a => a.asset_id || a.id).filter(Boolean) : []}
        onSelect={(picked) => {
          if (galleryPickerSetIdx === null) return;
          const si = galleryPickerSetIdx;
          const current = sets[si]?.assets || [];
          const existingKeys = new Set(current.map(a => a.file_r2_key).filter(Boolean));
          const additions = picked
            .filter(a => !existingKeys.has(a.file_r2_key))
            .map(a => ({
              asset_id: a.id,
              title: a.title,
              file_r2_key: a.file_r2_key,
              file_name: a.file_name,
              file_type: a.file_type,
              file_size_bytes: a.file_size_bytes,
              download_url: a.download_url,
              // Legacy display fields so existing chip render keeps working
              name: a.title,
              icon: (a.file_type || '').startsWith('video') ? '🎬' : (a.file_type || '').startsWith('image') ? '🖼️' : '📄',
              size: a.file_size_bytes ? `${(a.file_size_bytes / 1024).toFixed(0)} KB` : '',
            }));
          updateSet(si, { assets: [...current, ...additions] });
        }}
      />
    </div>
  );
}

export default function NewCampaignPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>}>
      <NewCampaignPageInner />
    </Suspense>
  );
}
