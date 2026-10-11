'use client';

/**
 * Drill-down listing wizard (Ship 2.3) — contract: listing-drilldown-taxonomy-engine.
 * Works for ANY drill-down vertical (fashion + furniture) — the vertical is derived
 * from the brand's category at runtime. Drill the tree ONCE to a leaf, then batch-add
 * products (photo + brand + price + typed facets + per-colour variant pics & per-
 * variant stock). Auto-SKU from the backend. One listing model (no Showcase/Sell).
 * Rides: listingApi.getTree / getNodeFacets / getBrands / batchCreate.
 */

import { useEffect, useState, useCallback } from 'react';
import { listingApi, uploadFileToGallery, API_BASE, brandApi } from '../../../../lib/api';
import OffersLibrary from '../components/OffersLibrary';
import ProductsWithoutOffers from '../components/ProductsWithoutOffers';
import GiftItems from '../components/GiftItems';
import PriceChangeDialog, { priceImpacts } from '../../../../components/offers/PriceChangeDialog';
import CategoryTree from '../components/CategoryTree';
import InventoryBrowser from '../components/InventoryBrowser';
import ImageCropModal from '../../../../components/ImageCropModal';
import { frameFor } from '../../../../lib/imageFrames';

const FREE = new Set(['free_size', 'one_size', 'unstitched']);
const COLOR_KEY = 'color_tone';   // the VISUAL variant → drives per-colour pics (both verticals)
const SIZE_KEY = 'size';

// Fashion size systems (clothing). Furniture has no size_system → its variant facets
// (Seater/Doors/Seats/Size) carry real allowed_values and render normally.
const SIZE_SYSTEMS = {
  alpha: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'],
  plus_alpha: ['XL', '2XL', '3XL', '4XL', '5XL', '6XL'],
  waist_in: ['26', '28', '30', '32', '34', '36', '38', '40', '42', '44'],
  waist_plus: ['38', '40', '42', '44', '46', '48', '50'],
  bra: ['30', '32', '34', '36', '38', '40', '42', '44'],
  age: ['0-3m', '3-6m', '6-12m', '12-18m', '18-24m', '2-3y', '3-4y', '4-5y', '5-6y', '6-7y', '7-8y', '8-9y', '9-10y', '10-11y', '11-12y', '13-14y', '15-16y'],
  uk_women: ['UK2', 'UK3', 'UK4', 'UK5', 'UK6', 'UK7', 'UK8', 'UK9'],
  uk_men: ['UK5', 'UK6', 'UK7', 'UK8', 'UK9', 'UK10', 'UK11', 'UK12'],
  kids_shoe: ['UK4', 'UK5', 'UK6', 'UK7', 'UK8', 'UK9', 'UK10', 'UK11', 'UK12', 'UK13'],
  ring: ['Adjustable', '6', '8', '10', '12', '14', '16', '18', '20', '22'],
  bangle: ['2.4', '2.6', '2.8', '2.10', 'Free'], sock_size: ['S', 'M', 'L', 'Free'],
  free_size: ['Free Size'], one_size: ['One Size'], unstitched: ['Unstitched'],
};
const sizeValues = (sys) => SIZE_SYSTEMS[sys] || ['Free Size'];
const tagFor = (f) => f.facet_role === 'variant' ? <span className="tag variant">variant</span>
  : f.facet_role === 'discovery' ? <span className="tag disc">discovery</span>
  : f.facet_role === 'listing_attr' || f.facet_role === 'attr' ? <span className="tag attr">listing</span> : null;
const arr = (v) => Array.isArray(v) ? v : (v ? [v] : []);
const blankDraft = () => ({ name: '', price: '', brand: '', sku: '', stock: '', description: '', images: [], facets: {}, variants: {}, tags: [] });
// stock-asked-once: a staged item's stock as the server will keep it — the total of its colours'
// and sizes' boxes when every one is counted, nothing when any is not. An item with no sizes
// keeps its own number.
const stagedStock = (it) => {
  const sizes = arr(it.variants).flatMap(v => arr(v.sizes));
  if (!sizes.length) return it.stock ?? null;
  const has = (v) => v != null && v !== '' && Number.isFinite(parseInt(v, 10));
  return sizes.every(s => has(s.stock)) ? sizes.reduce((t, s) => t + Math.max(0, parseInt(s.stock, 10)), 0) : null;
};

// Ancestor nodes from the root down to (but excluding) `id`; null when absent.
// Lets any node be selected directly instead of drilled to one level at a time.
function ancestorsOf(nodes, id, trail = []) {
  for (const n of (nodes || [])) {
    if (n.id === id) return trail;
    const hit = ancestorsOf(n.children, id, [...trail, n]);
    if (hit) return hit;
  }
  return null;
}

// Inventory browse now lives in components/InventoryBrowser.js (contract:
// listing-workspace-ux) — tree rail + product table + filters, same endpoints.

export default function DrilldownListingPage() {
  const [view, setView] = useState(() => {
    if (typeof window === 'undefined') return 'browse';
    const sp = new URLSearchParams(window.location.search);
    if (sp.has('edit')) return 'add';
    if (sp.get('tab') === 'add') return 'add';
    if (sp.get('tab') === 'offers') return 'offers';
    if (sp.get('tab') === 'free') return 'free';
    if (sp.get('tab') === 'gifts') return 'gifts';
    return 'browse';
  });   // 'browse' (My listings) | 'add' (wizard) | 'offers' | 'free' (products without offers) | 'gifts' (gift items)
  const [vertical, setVertical] = useState('fashion');
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [crumb, setCrumb] = useState([]);
  const [level, setLevel] = useState([]);
  const [leaf, setLeaf] = useState(null);
  const [facets, setFacets] = useState([]);
  const [draft, setDraft] = useState(blankDraft());
  const [step, setStep] = useState(1);          // 1 Basics · 2 Variants · 3 Details · 4 Review
  const [moreOpen, setMoreOpen] = useState(false); // step-3 optional facets (collapsed by default)
  const [mode, setMode] = useState('one');      // 'one' = stepper · 'bulk' = Excel (contract: listing-excel-bulk)
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState(null);  // per-product row errors
  const [importFileErr, setImportFileErr] = useState('');  // file-level (stale template etc.)
  const [imported, setImported] = useState([]);            // just-created products → photo tray
  const [importWarnings, setImportWarnings] = useState(null); // {images:[], values:[]} non-blocking
  const [trayUploading, setTrayUploading] = useState('');
  const [urlText, setUrlText] = useState({});              // paste-image-URL inputs, keyed by target
  const [ingesting, setIngesting] = useState('');          // target currently ingesting
  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState('');
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState('');
  const [brandOpts, setBrandOpts] = useState([]);
  const [counts, setCounts] = useState({});
  const [search, setSearch] = useState('');     // header search — drives Inventory
  const [selId, setSelId] = useState(null);     // node highlighted in the tree rail
  // Edit mode (contract: listing-product-edit) — ?edit=<id> loads one product into
  // the stepper; the final action saves via PATCH instead of batching.
  const [editMode] = useState(() => (typeof window !== 'undefined') && new URLSearchParams(window.location.search).has('edit'));
  const [editingId, setEditingId] = useState(null);
  const [origPrice, setOrigPrice] = useState(null);   // offer-builder-v2 O12: the price before this edit
  const [priceWarn, setPriceWarn] = useState(null);   // what a new price touches, before saving
  const [tabCounts, setTabCounts] = useState({});     // Products without offers · Gift items
  const setFreeCount = useCallback((n) => setTabCounts((c) => ({ ...c, free: n })), []);
  const setGiftCount = useCallback((n) => setTabCounts((c) => ({ ...c, gifts: n })), []);
  useEffect(() => {
    if (editMode) return;
    brandApi.productsWithoutOffers().then((r) => { if (r?.success) setFreeCount((r.data.products || []).length); }).catch(() => {});
    brandApi.getGiftItems().then((r) => { if (r?.success) setGiftCount((r.data.gift_items || []).length); }).catch(() => {});
  }, [editMode, setFreeCount, setGiftCount]);

  useEffect(() => {
    (async () => {
      let v = 'fashion';
      try {
        const s = await brandApi.getSchema();
        const cat = String(s?.data?.schema?.category_key || '');
        if (cat.startsWith('furniture')) v = 'furniture';
      } catch { /* default fashion */ }
      setVertical(v);
      const r = await listingApi.getTree(v);
      setLoading(false);
      if (r.ok) { setTree(r.data.tree); setLevel(r.data.tree); } else setErr(r.error?.message || 'Failed to load categories');
      loadBrands(v, '');
    })();
  }, []);

  async function loadBrands(v, q) {
    const r = await listingApi.getBrands(v, q);
    if (r.ok) setBrandOpts(r.data.brands || []);
  }

  // Store-setup nudge (contract listing-home-consolidation): this page is now
  // the Listings home even before setup — show a banner instead of the old
  // "Complete Your Listing" interstitial.
  const [setupNeeded, setSetupNeeded] = useState(false);
  useEffect(() => {
    brandApi.get('/brands/me/listing-config')
      .then((r) => {
        if (!r?.success) return;
        const done = r.data?.listing_data && Object.keys(r.data.listing_data).length > 0;
        setSetupNeeded(!done);
      })
      .catch(() => {});
  }, []);

  // Curated world tags (contract listing-tags-at-add) — admin vocabulary for
  // this brand's world; empty list = no Tags row shown.
  const [tagOpts, setTagOpts] = useState([]);
  useEffect(() => {
    brandApi.getTagOptions?.()
      .then((r) => { if (r?.success) setTagOpts(r.data?.options || []); })
      .catch(() => {});
  }, []);
  const toggleTag = (slug) => setDraft(d => ({
    ...d, tags: d.tags.includes(slug) ? d.tags.filter(t => t !== slug) : [...d.tags, slug],
  }));

  // Load the product being edited into the stepper's own state (leaf + facets +
  // pre-filled draft), so the whole add form is reused verbatim for editing.
  useEffect(() => {
    if (!editMode) return;
    const id = new URLSearchParams(window.location.search).get('edit');
    if (!id) return;
    (async () => {
      const r = await brandApi.get(`/brands/me/listing-products/${id}`);
      if (!r.success) { setErr(r.error?.message || 'Failed to load product'); return; }
      const { product, node, facets: fdefs } = r.data;
      let vj = {};
      try { vj = typeof product.variants_json === 'string' ? JSON.parse(product.variants_json || '{}') : (product.variants_json || {}); } catch { vj = {}; }
      const variantsMap = {};
      // stock-asked-once: on a one-size product type each colour has one stock box, kept under the
      // type's one size. A colour saved before this with no size at all had only the product's own
      // number: with one colour that number is its stock.
      const one = FREE.has(node?.size_system) && (fdefs || []).some(f => f.facet_key === SIZE_KEY && f.facet_role === 'variant')
        ? sizeValues(node.size_system)[0] : null;
      const onlyColour = (vj.colors || []).length === 1;
      for (const cv of (vj.colors || [])) {
        if (one) {
          const sz = arr(cv.sizes);
          const have = sz.filter(s => s && s.stock != null && s.stock !== '');
          const val = sz.length === 0 ? (onlyColour ? (product.stock ?? '') : '')
            : have.length === sz.length ? have.reduce((n, s) => n + Number(s.stock), 0) : '';
          variantsMap[cv.color] = { images: arr(cv.images), stock: { [one]: val } };
          continue;
        }
        // `sizes` is this colour's OWN list — it may legitimately differ from
        // another colour's, so restore it rather than re-deriving from facets.
        variantsMap[cv.color] = {
          images: arr(cv.images),
          sizes: arr(cv.sizes).map(s => s.size).filter(Boolean),
          stock: Object.fromEntries(arr(cv.sizes).map(s => [s.size, s.stock ?? ''])),
        };
      }
      const pf = (product.facets && typeof product.facets === 'object') ? { ...product.facets } : {};
      const brandVal = pf.brand || '';
      const coverImgs = arr(pf._images).length ? arr(pf._images)
        : (arr(vj.cover_images).length ? arr(vj.cover_images) : (product.image_url ? [product.image_url] : []));
      delete pf.brand; delete pf._images;
      setView('add');
      setLeaf(node);
      setFacets(fdefs || []);
      setDraft({
        name: product.name || '', price: product.price ?? '',
        brand: brandVal, sku: product.sku || '', stock: product.stock ?? '',
        description: product.description || '',
        images: coverImgs, facets: pf, variants: variantsMap,
        tags: Array.isArray(product.tags) ? product.tags : [],
      });
      setStep(1); setMode('one'); setEditingId(id);
      setOrigPrice(product.price ?? null);
    })();
  }, [editMode]);

  // Select any node from ANYWHERE — the tree rail, a card, or the breadcrumb
  // (contract listing-workspace-ux). The crumb/level pair is rebuilt from the
  // node's real ancestors instead of being pushed one drill at a time, so a
  // sideways jump across the tree lands in a consistent state.
  const selectNode = useCallback(async (node) => {
    if (!tree) return;
    if (node.is_leaf && leaf && node.id !== leaf.id && items.length > 0
      && !window.confirm(`${items.length} product(s) are staged under ${leaf.name} and not saved yet. Leave and discard them?`)) return;

    const anc = ancestorsOf(tree, node.id) || [];
    const levelOf = anc.length ? (anc[anc.length - 1].children || []) : tree;
    const crumbs = anc.map((a, i) => ({ name: a.name, children: i === 0 ? tree : (anc[i - 1].children || []) }));
    crumbs.push({ name: node.name, children: levelOf });

    setOk(''); setSelId(node.id);
    if (node.is_leaf) {
      const r = await listingApi.getNodeFacets(node.id);
      if (!r.ok) { setErr(r.error?.message || 'Failed to load specs'); return; }
      setErr('');
      setLeaf({ ...node, size_system: r.data.node.size_system, size_required: r.data.node.size_required });
      setFacets((r.data.facets || []).filter(f => f.facet_key !== 'images' && f.facet_key !== 'price'));
      setItems([]); setDraft(blankDraft()); setStep(1); setMoreOpen(false);
      setMode('one'); setImported([]); setImportErrors(null); setImportFileErr(''); setImportWarnings(null);
      setCrumb(crumbs); setLevel(levelOf);
    } else {
      setErr(''); setLeaf(null);
      setCrumb(crumbs); setLevel(node.children || []);
    }
  }, [tree, leaf, items.length]);

  const jumpTo = (i) => {
    setLeaf(null); setErr(''); setOk('');
    if (i < 0) { setLevel(tree); setCrumb([]); setSelId(null); return; }
    setLevel(crumb[i].children); setCrumb(crumb.slice(0, i)); setSelId(null);
  };

  const setFacet = (key, val) => setDraft(d => ({ ...d, facets: { ...d.facets, [key]: val } }));
  const toggleMulti = (key, opt) => setDraft(d => {
    const cur = arr(d.facets[key]);
    return { ...d, facets: { ...d.facets, [key]: cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt] } };
  });
  const setColorImages = (color, urls) => setDraft(d => {
    const v = { ...(d.variants || {}) };
    v[color] = { ...(v[color] || { images: [], stock: {} }), images: [...arr(v[color]?.images), ...urls].slice(0, 6) };
    return { ...d, variants: v };
  });
  const setColorVariantStock = (color, val, stock) => setDraft(d => {
    const v = { ...(d.variants || {}) };
    const cv = { ...(v[color] || { images: [], stock: {} }) };
    cv.stock = { ...cv.stock, [val]: stock };
    v[color] = cv;
    return { ...d, variants: v };
  });
  // Turn one size on/off FOR THIS COLOUR ONLY (contract listing-per-colour-sizes).
  // An absent `sizes` means "all of the master list" — that is what keeps the
  // common case (every colour shares sizes) at zero extra clicks. The master is
  // re-read from `d` inside the updater so a stale render closure can't shrink it.
  const toggleColorSize = (color, val) => setDraft(d => {
    const master = stockKey ? arr(d.facets?.[stockKey]) : [];
    const v = { ...(d.variants || {}) };
    const cv = { ...(v[color] || { images: [], stock: {} }) };
    const cur = Array.isArray(cv.sizes) ? cv.sizes.filter(s => master.includes(s)) : master;
    const next = cur.includes(val) ? cur.filter(s => s !== val) : [...cur, val];
    cv.sizes = master.filter(s => next.includes(s));   // keep the master's order
    if (!next.includes(val)) { const st = { ...cv.stock }; delete st[val]; cv.stock = st; }
    v[color] = cv;
    return { ...d, variants: v };
  });

  // Crop-to-frame (image-crop-uploader): each picked photo is cropped to the
  // product-card aspect (4:5) before upload, so it displays clean on the phone.
  // Multiple files queue through the modal one at a time.
  const [cropQueue, setCropQueue] = useState(null);   // { files:[], target, i }
  const pickImages = (fileList, target) => {
    const files = Array.from(fileList || []); if (!files.length) return;
    setCropQueue({ files, target, i: 0 });
  };
  const addUrlTo = (target, url) => {
    if (target === 'cover') setDraft(d => ({ ...d, images: [...d.images, url].slice(0, 6) }));
    else setColorImages(target, [url]);
  };
  const advanceCrop = () => setCropQueue(q => (q && q.i + 1 < q.files.length ? { ...q, i: q.i + 1 } : null));
  const onCropDone = async (croppedFile) => {
    const target = cropQueue?.target;
    setUploading(target);
    const r = await uploadFileToGallery(croppedFile, { title: croppedFile.name, tags: ['listing'] });
    setUploading('');
    if (r.asset?.id) addUrlTo(target, `${API_BASE}/media/assets/${r.asset.id}`);
    advanceCrop();
  };

  // Paste image URL(s) → ingest each into our R2 → same image list as uploads
  // (contract: listing-image-urls). target = 'cover' or a colour name.
  async function addImagesFromUrls(target) {
    const raw = String(urlText[target] || '').split(/[\n,]/).map(s => s.trim()).filter(Boolean);
    if (!raw.length) return;
    setIngesting(target); setErr('');
    const urls = [];
    for (const u of raw) {
      const r = await listingApi.ingestImage(u);
      if (r.ok && r.data?.url) urls.push(r.data.url);
      else setErr(`Couldn't add ${u} — ${r.error?.message || 'failed'}`);
    }
    if (urls.length) {
      if (target === 'cover') setDraft(d => ({ ...d, images: [...d.images, ...urls].slice(0, 6) }));
      else setColorImages(target, urls);
    }
    setUrlText(t => ({ ...t, [target]: '' }));
    setIngesting('');
  }

  // Visual variant (colour) drives pics; the OTHER variant facet (size/seater/doors/
  // seats) is the per-unit STOCK axis.
  const stockFacet = facets.find(f => f.facet_role === 'variant' && f.facet_key !== COLOR_KEY) || null;
  const stockKey = stockFacet?.facet_key || null;
  // stock-asked-once: a product type with no real size (sunglasses, a watch, a saree) files each
  // colour's stock under ONE stand-in size ("Free Size"). The brand is never shown it: there is
  // no Size row, and each colour has one stock box.
  const oneSize = stockKey === SIZE_KEY && leaf && FREE.has(leaf.size_system) ? sizeValues(leaf.size_system)[0] : null;
  const selectedColors = arr(draft.facets[COLOR_KEY]);
  // The MASTER list — every size this product comes in, across all colours.
  // It is what feeds facets[stockKey] and, downstream, the follower size filter.
  const selectedVariants = oneSize ? [oneSize] : (stockKey ? arr(draft.facets[stockKey]) : []);
  // …and this colour's own subset of it (contract listing-per-colour-sizes).
  // Absent `sizes` = "all of them", so a brand whose colours share sizes does
  // nothing extra. Always filtered through the master, so shrinking the top row
  // can never leave an orphan chip behind in a colour card.
  const sizesFor = (color) => {
    if (oneSize) return [oneSize];
    const cv = draft.variants[color];
    return Array.isArray(cv?.sizes) ? selectedVariants.filter(s => cv.sizes.includes(s)) : selectedVariants;
  };
  // stock-asked-once: stock is typed in ONE place — these boxes. What they add up to is the
  // product's stock (the server keeps that number itself; none is sent). A box left empty is not
  // counted: that colour or size never shows as sold out.
  const counted = (v) => v != null && v !== '' && Number.isFinite(parseInt(v, 10));
  const colourTotal = (color) => {
    const vals = sizesFor(color).map(s => draft.variants[color]?.stock?.[s]).filter(counted);
    return vals.length ? vals.reduce((n, v) => n + Math.max(0, parseInt(v, 10)), 0) : null;
  };
  const stockSum = (() => {
    let total = 0; let any = false; const open = [];
    for (const c of selectedColors) for (const s of sizesFor(c)) {
      const v = draft.variants[c]?.stock?.[s];
      if (counted(v)) { total += Math.max(0, parseInt(v, 10)); any = true; } else open.push(oneSize ? c : `${c} ${s}`);
    }
    return { total, any, open };
  })();
  const stockTotalText = !stockSum.any ? 'Not counted'
    : stockSum.open.length === 0 ? String(stockSum.total)
      : `${stockSum.total}, and ${stockSum.open.length <= 2 ? stockSum.open.join(' and ') : `${stockSum.open.length} boxes`} not counted`;
  // Union of what the colours actually stock — narrower than the master whenever
  // a size was turned off everywhere. Saved to facets so the app never advertises
  // a size no colour carries.
  const sizeUnion = () => (selectedColors.length && stockKey
    ? selectedVariants.filter(s => selectedColors.some(c => sizesFor(c).includes(s)))
    : selectedVariants);

  // Steps fall straight out of facet_role (contract listing-add-stepper):
  //   ② Variants  = role 'variant'   ③ Details = everything else.
  // 'brand' is handled by its own field in ① so it never doubles up in ③.
  const variantFacets = facets.filter(f => f.facet_role === 'variant');
  const detailFacets  = facets.filter(f => f.facet_role !== 'variant' && f.facet_key !== 'brand');
  // Required ones lead Step ③; the rest hide under "More details".
  const facetRequired = (f) => {
    if (f.facet_key === SIZE_KEY && leaf?.size_system) return !FREE.has(leaf.size_system);
    return f.required === 'required';
  };
  const facetEmpty = (f) => {
    const v = draft.facets[f.facet_key];
    return v == null || v === '' || (Array.isArray(v) && v.length === 0);
  };
  const requiredDetails = detailFacets.filter(facetRequired);
  const optionalDetails = detailFacets.filter(f => !facetRequired(f));

  // Photos now live in Step ② — per-colour when colours are chosen, else a single
  // product-photo set. At least one photo (either source) is required there.
  const anyVariantPhoto = selectedColors.some(c => arr(draft.variants[c]?.images).length > 0);
  const hasAnyPhoto = draft.images.length > 0 || anyVariantPhoto;
  const reviewImg = draft.images[0] || selectedColors.map(c => arr(draft.variants[c]?.images)[0]).find(Boolean) || null;

  // Per-step validation — STRICTER-or-equal to taxonomy.validateItem, so a step
  // that passes can never fail server-side. Step ① is product info only; the photo
  // requirement moved to Step ② alongside the variants the photos describe.
  const stepErrors = (s) => {
    const e = [];
    if (s === 1) {
      if (!draft.name.trim()) e.push('product name');
      if (draft.price === '' || Number(draft.price) < 0) e.push('price');
    }
    if (s === 2) {
      variantFacets.filter(f => facetRequired(f) && facetEmpty(f)).forEach(f => e.push(f.label));
      if (!hasAnyPhoto) e.push('at least one photo');
      // A colour with every size switched off is unsellable — block before it
      // can be saved as a colour with an empty sizes[] (listing-per-colour-sizes).
      if (selectedVariants.length > 0) {
        const bare = selectedColors.filter(c => sizesFor(c).length === 0);
        bare.forEach(c => e.push(`at least one ${(stockFacet?.label || 'size').toLowerCase()} for ${c}`));
      }
    }
    if (s === 3) requiredDetails.filter(f => facetEmpty(f)).forEach(f => e.push(f.label));
    return e;
  };
  const stepBlocked = stepErrors(step);

  const goNext = () => {
    if (stepBlocked.length) return;          // Next is disabled; the inline hint explains
    setErr('');
    setStep(step + 1);
  };
  const goBack = () => {
    setErr('');
    setStep(step - 1);
  };

  // Step ② always shows now — it hosts photos (per-colour or a single product set)
  // for EVERY product, not only ones with variant facets.
  const STEP_DEFS = [
    { n: 1, label: 'Basics' },
    { n: 2, label: variantFacets.length > 0 ? 'Variants' : 'Photos' },
    { n: 3, label: 'Details' },
    { n: 4, label: 'Review' },
  ];

  // One facet's input — shared by Step ② (variant facets) and Step ③ (details).
  const renderFacet = (f) => {
    const isSize = f.facet_key === SIZE_KEY && !!leaf?.size_system;
    const allowed = isSize ? sizeValues(leaf.size_system) : (Array.isArray(f.allowed_values) ? f.allowed_values : []);
    const enumerated = allowed.length > 1;
    const req = (f.required === 'required') || (isSize && leaf.size_required);
    const v = draft.facets[f.facet_key];
    return (
      <div key={f.facet_key}>
        <label className="fl">{f.label}{req && <span className="req"> *</span>} {tagFor(f)}</label>
        {isSize && (
          <div className="chips">{allowed.map(o => (
            <span key={o} className={'chip' + ((Array.isArray(v) && v.includes(o)) ? ' on v' : '')} onClick={() => toggleMulti(SIZE_KEY, o)}>{o}</span>
          ))}</div>
        )}
        {!isSize && f.input_type === 'multi_select' && enumerated && (
          <div className="chips">{allowed.map(o => (
            <span key={o} className={'chip' + ((Array.isArray(v) && v.includes(o)) ? ' on' + (f.facet_role === 'variant' ? ' v' : '') : '')} onClick={() => toggleMulti(f.facet_key, o)}>{o}</span>
          ))}</div>
        )}
        {!isSize && f.input_type === 'single_select' && enumerated && (
          <select className="t" value={v || ''} onChange={e => setFacet(f.facet_key, e.target.value)}>
            <option value="">Select…</option>{allowed.map(o => <option key={o}>{o}</option>)}
          </select>
        )}
        {f.input_type === 'boolean' && (
          <div className="tog">
            <button className={v === 'No' || !v ? 'on' : ''} onClick={() => setFacet(f.facet_key, 'No')}>No</button>
            <button className={v === 'Yes' ? 'on' : ''} onClick={() => setFacet(f.facet_key, 'Yes')}>Yes</button>
          </div>
        )}
        {f.input_type === 'number' && <input className="t" style={{ maxWidth: 180 }} type="number" value={v || ''} onChange={e => setFacet(f.facet_key, e.target.value)} placeholder={f.allowed_values?.[0] || ''} />}
        {f.input_type === 'dimension' && (
          <div className="row" style={{ gap: 6 }}>
            {['l', 'w', 'h'].map(d => <input key={d} className="t" style={{ width: 70 }} type="number" placeholder={d.toUpperCase()} value={v?.[d] || ''} onChange={e => setFacet(f.facet_key, { ...(v || {}), [d]: e.target.value })} />)}
            <span className="muted2" style={{ alignSelf: 'center' }}>cm</span>
          </div>
        )}
        {!isSize && (f.input_type === 'text' || (!enumerated && (f.input_type === 'single_select' || f.input_type === 'multi_select'))) &&
          <input className="t" value={v || ''} onChange={e => setFacet(f.facet_key, e.target.value)} placeholder="optional" />}
      </div>
    );
  };

  const draftErrors = () => {
    const e = [];
    if (!draft.name.trim()) e.push('name');
    if (draft.price === '' || Number(draft.price) < 0) e.push('price');
    if (!hasAnyPhoto) e.push('at least one photo');
    for (const f of facets) {
      let req = f.required === 'required';
      if (f.facet_key === SIZE_KEY && leaf.size_system) req = !FREE.has(leaf.size_system);
      const v = draft.facets[f.facet_key];
      const empty = v == null || v === '' || (Array.isArray(v) && v.length === 0);
      if (req && empty) e.push(f.label);
    }
    return e;
  };

  const addItem = () => {
    const e = draftErrors();
    if (e.length) { setErr('Required: ' + e.join(', ')); return; }
    setErr('');
    const variants = selectedColors.map(color => ({
      color,
      images: arr(draft.variants[color]?.images),
      // This colour's OWN sizes, not the master list (listing-per-colour-sizes).
      sizes: sizesFor(color).map(val => ({ size: val, stock: draft.variants[color]?.stock?.[val] ?? null })),
    }));
    // facets carries the UNION, so the size filter never offers a size that no
    // colour stocks. Always a subset of the master, so it stays in-vocabulary
    // for taxonomy.validateItem's locked-dropdown check.
    const outFacets = stockKey ? { ...draft.facets, [stockKey]: sizeUnion() } : draft.facets;
    setItems(list => [...list, {
      name: draft.name.trim(), price: Number(draft.price),
      brand: draft.brand.trim() || null, sku: draft.sku.trim() || null,
      // stock-asked-once: sent only for a product type with nothing to count per colour or size.
      stock: !stockKey && draft.stock !== '' ? Number(draft.stock) : null,
      description: draft.description.trim() || null,
      images: draft.images, facets: outFacets,
      variants: variants.length ? variants : undefined,
      tags: draft.tags.length ? draft.tags : undefined,
    }]);
    // Carry brand + the descriptive/discovery facet values to the next item so
    // adding many similar products is fast; clear identity, photos and variants.
    const carry = blankDraft();
    carry.brand = draft.brand;
    carry.tags = draft.tags;
    detailFacets.forEach(f => { if (!facetEmpty(f)) carry.facets[f.facet_key] = draft.facets[f.facet_key]; });
    setDraft(carry);
    setStep(1); setMoreOpen(false);
  };

  const saveBatch = async () => {
    if (!items.length) return;
    setSaving(true); setErr(''); setOk('');
    const r = await listingApi.batchCreate({ category_node_id: leaf.id, items });
    setSaving(false);
    if (r.ok) {
      const skus = (r.data.products || []).map(p => p.sku).filter(Boolean);
      setOk(`✓ ${r.data.created_count} product(s) live under ${leaf.name}. SKUs: ${skus.slice(0, 4).join(', ')}${skus.length > 4 ? '…' : ''}`);
      setCounts(c => ({ ...c, [leaf.id]: (c[leaf.id] || 0) + r.data.created_count }));
      setItems([]);
    } else setErr(r.error?.message || 'Save failed');
  };

  // Edit-mode save — same validated item shape, PATCHed to the one product.
  // offer-builder-v2 (O12, rules 1.11): a new price on a product in a live or scheduled offer is
  // warned about first. Nothing is blocked; the server tells the creators after the save.
  const saveEdit = async ({ confirmed = false } = {}) => {
    const e = draftErrors();
    if (e.length) { setErr('Required: ' + e.join(', ')); return; }
    setErr('');
    if (!confirmed && origPrice != null && Number(draft.price) !== Number(origPrice)) {
      setSaving(true);
      const hits = await priceImpacts([{ id: editingId, price: Number(draft.price), old: origPrice }]);
      setSaving(false);
      if (hits.length) { setPriceWarn(hits); return; }
    }
    setPriceWarn(null);
    setSaving(true);
    const variants = selectedColors.map(color => ({
      color,
      images: arr(draft.variants[color]?.images),
      // Per-colour sizes on edit too, else re-saving would flatten them back
      // to the master list (listing-per-colour-sizes).
      sizes: sizesFor(color).map(val => ({ size: val, stock: draft.variants[color]?.stock?.[val] ?? null })),
    }));
    const outFacets = stockKey ? { ...draft.facets, [stockKey]: sizeUnion() } : draft.facets;
    const payload = {
      name: draft.name.trim(), price: Number(draft.price),
      brand: draft.brand.trim() || null,
      stock: !stockKey && draft.stock !== '' ? Number(draft.stock) : null,
      description: draft.description.trim() || null,
      images: draft.images, facets: outFacets,
      variants: variants.length ? variants : undefined,
      tags: draft.tags,
    };
    const r = await brandApi.patch(`/brands/me/listing-products/${editingId}`, payload);
    setSaving(false);
    if (r.success) { window.location.href = '/dashboard/products/listing'; }
    else setErr(r.error?.message || 'Save failed');
  };

  // ── Excel bulk add ──────────────────────────────────────────────────────
  async function handleImport(file) {
    if (!file) return;
    setImporting(true); setImportErrors(null); setImportFileErr(''); setImportWarnings(null); setImported([]); setErr(''); setOk('');
    const r = await listingApi.importProducts(leaf.id, file);
    setImporting(false);
    if (r.ok) {
      const created = r.data?.products || [];
      const skipped = r.data?.skipped || [];
      setImported(created);
      setImportWarnings({ images: r.data?.image_warnings || [], values: r.data?.value_warnings || [], skipped });
      setCounts(c => ({ ...c, [leaf.id]: (c[leaf.id] || 0) + (r.data?.created_count || 0) }));
    } else {
      let parsed = null;
      try { parsed = r.error?.field ? JSON.parse(r.error.field) : null; } catch { /* not json */ }
      if (parsed?.row_errors) setImportErrors(parsed.row_errors);
      else if (parsed?.file_errors) setImportFileErr(parsed.file_errors.join(' '));
      else setImportFileErr(r.error?.message || 'Import failed');
    }
  }

  async function addTrayPhoto(productId, fileList) {
    const files = Array.from(fileList || []); if (!files.length) return;
    setTrayUploading(productId);
    const urls = [];
    for (const f of files) {
      const r = await uploadFileToGallery(f, { title: f.name, tags: ['listing'] });
      if (r.asset?.id) urls.push(`${API_BASE}/media/assets/${r.asset.id}`);
    }
    if (urls.length) {
      const res = await listingApi.setCoverPhotos(productId, urls);
      const cover = res.data?.image_url || urls[0];
      const count = res.data?.cover_images?.length || urls.length;
      setImported(list => list.map(p => p.id === productId ? { ...p, image_url: cover, photo_count: count } : p));
    }
    setTrayUploading('');
  }

  const vlabel = vertical[0].toUpperCase() + vertical.slice(1);
  if (loading) return <div className="lst" style={{ padding: 24 }}><style>{CSS}</style>Loading {vlabel} categories…</div>;

  return (
    <div className="lst">
      <style>{CSS}</style>
      {cropQueue && cropQueue.files[cropQueue.i] && (() => { const fr = frameFor('product_photo'); return (
        <ImageCropModal
          file={cropQueue.files[cropQueue.i]} aspect={fr.aspect} outW={fr.w} outH={fr.h} title={fr.label}
          onCancel={advanceCrop} onDone={onCropDone} />
      ); })()}

      <div className="page">
      {setupNeeded && !editMode && (
        <div className="setupnudge">
          <span>⚙</span>
          <span>Your store setup isn&apos;t finished — followers see your store profile once it&apos;s complete.</span>
          <a href="/dashboard/products?setup=1">Finish store setup →</a>
        </div>
      )}

      <div className="hdr">
        <div>
          <h1>{editingId ? `Edit ${vlabel} product` : 'Listings'}
            {!editingId && <span className="vert">{vertical.toUpperCase()}</span>}</h1>
          <div className="sub">{editingId
            ? 'Update photos, price, description, colours/sizes and other details — then save.'
            : view === 'browse'
            ? 'Everything you have listed, organised by the categories you listed under.'
            : view === 'offers'
            ? 'Offers built on your products. You give them to creators when you set their terms.'
            : view === 'free'
            ? 'Products that are free to use: not in any offer on the day you pick.'
            : view === 'gifts'
            ? 'Gift items you give away with a free gift offer.'
            : 'Pick the exact item-type from the tree, then add every product of that type. SKU is generated automatically.'}</div>
        </div>
        <div className="grow" />
        {!editMode && view === 'browse' && (
          <div className="omni">
            <span className="ic">⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search your products by name or SKU…" />
            {search && <button className="clr" onClick={() => setSearch('')}>×</button>}
          </div>
        )}
        <div className="hactions">
          <a href="/dashboard/products?setup=1" className="btn ghost">⚙ Store setup</a>
          {!editMode && view !== 'add' && (
            <button className="btn ink" onClick={() => setView('add')}>+ Add products</button>
          )}
        </div>
      </div>

      {!editMode && (
        <div className="tabrail">
          <button className={'tab' + (view === 'browse' ? ' on' : '')} onClick={() => setView('browse')}>Inventory</button>
          <button className={'tab' + (view === 'add' ? ' on' : '')} onClick={() => setView('add')}>Add products</button>
          <button className={'tab' + (view === 'offers' ? ' on' : '')} onClick={() => setView('offers')}>Offers</button>
          <button className={'tab' + (view === 'free' ? ' on' : '')} onClick={() => setView('free')}>Products without offers{tabCounts.free != null ? <span className="muted2"> {tabCounts.free}</span> : null}</button>
          <button className={'tab' + (view === 'gifts' ? ' on' : '')} onClick={() => setView('gifts')}>Gift items{tabCounts.gifts != null ? <span className="muted2"> {tabCounts.gifts}</span> : null}</button>
        </div>
      )}

      {!editMode && view === 'offers' && (
        <div className="ws solo"><div className="card"><div className="body"><OffersLibrary /></div></div></div>
      )}
      {!editMode && view === 'free' && (
        <div className="ws solo"><div className="card"><div className="body"><ProductsWithoutOffers onCount={setFreeCount} /></div></div></div>
      )}
      {!editMode && view === 'gifts' && (
        <div className="ws solo"><div className="card"><div className="body"><GiftItems onCount={setGiftCount} /></div></div></div>
      )}
      {priceWarn && (
        <PriceChangeDialog impacts={priceWarn} busy={saving}
          onCancel={() => setPriceWarn(null)} onConfirm={() => saveEdit({ confirmed: true })} />
      )}

      {!editMode && view === 'browse' && (
        <InventoryBrowser
          vlabel={vlabel} search={search}
          onAdd={() => setView('add')}
          onEditCategory={(node) => { setView('add'); if (node) selectNode(node); }} />
      )}

      {view === 'add' && (
      <div className={'ws' + (editMode ? ' solo' : (leaf && !editingId ? '' : ' norail'))}>
        {!editMode && (
          <CategoryTree
            nodes={tree} title={`${vlabel} catalogue`}
            selectedId={selId} onSelect={selectNode}
            countOf={(n) => counts[n.id] || 0} />
        )}

        <div className="card">
          {!editMode && (
            <div className="crumbbar">
              <span className="cr">
                <a onClick={() => jumpTo(-1)}>{vlabel}</a>
                {crumb.map((c, i) => <span key={i}><span className="sep">›</span>{i === crumb.length - 1 && leaf ? <b>{c.name}</b> : <a onClick={() => jumpTo(i)}>{c.name}</a>}</span>)}
              </span>
              {!leaf && <span className="right"><span className="hintq">Pick the exact item type once, then batch-add</span></span>}
            </div>
          )}

          <div className="body">
          {editMode && !leaf && !err && <div className="sub">Loading product…</div>}

          {err && <div className="err">{err}</div>}
          {ok && <div className="ok">{ok}</div>}

          {!editMode && !leaf && (
            <div className="grid">
              {level.map(n => (
                <div key={n.id} className={'node' + (n.is_leaf ? ' leaf' : '')} onClick={() => selectNode(n)}>
                  <div style={{ minWidth: 0 }}>
                    <div className="nm">{n.name}</div>
                    <div className="mt">
                      {n.is_leaf ? (counts[n.id] ? `✓ ${counts[n.id]} added` : 'item type')
                        : `${(n.children || []).length} ${n.depth === 0 ? 'categories' : 'items'}`}
                    </div>
                  </div>
                  <div className="a">{n.is_leaf && counts[n.id] ? '✓' : '›'}</div>
                </div>
              ))}
            </div>
          )}

      {leaf && (
        <div className="panel">
          <div className="phead">{editingId ? 'Edit' : 'Add'} {leaf.name}{!editingId && counts[leaf.id] ? <span className="done">· {counts[leaf.id]} already added</span> : null}</div>
          <div className="sub" style={{ marginBottom: 4 }}>{leaf.segment}{leaf.category && leaf.category !== leaf.segment ? ` › ${leaf.category}` : ''} › {leaf.name}</div>

          {/* Entry mode — one-by-one (stepper) or bulk Excel. Hidden in edit mode. */}
          {!editingId && (
            <div className="bulktabs">
              <span className={'btab' + (mode === 'one' ? ' on' : '')} onClick={() => setMode('one')}>Add one-by-one</span>
              <span className={'btab' + (mode === 'bulk' ? ' on' : '')} onClick={() => setMode('bulk')}>Bulk add (Excel)</span>
            </div>
          )}

          {mode === 'one' && (<>
          {/* Progress header — steps derive from facet_role (② hidden when no variants) */}
          <div className="steps">
            {STEP_DEFS.map((sd, i) => (
              <div key={sd.n} className="stwrap">
                {i > 0 && <span className="bar" />}
                <span className={'st' + (step === sd.n ? ' on' : step > sd.n ? ' done' : '')}>
                  <span className="n">{step > sd.n ? '✓' : sd.n}</span>{step >= sd.n ? sd.label : ''}
                </span>
              </div>
            ))}
          </div>

          {/* ① Basics — product info only; photos moved to Step ② */}
          {step === 1 && (
            <div className="stepbody">
              <div className="row">
                <div style={{ flex: 1, minWidth: 170 }}>
                  <label className="fl">Product name <span className="req">*</span></label>
                  <input className="t" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Oakwood 3-Seater Sofa" />
                </div>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label className="fl">Brand</label>
                  <input className="t" list="brandlist" value={draft.brand}
                    onChange={e => { const v = e.target.value; setDraft(d => ({ ...d, brand: v })); loadBrands(vertical, v); }}
                    placeholder="Search or type your brand" />
                  <datalist id="brandlist">{brandOpts.map(b => <option key={b} value={b} />)}</datalist>
                </div>
              </div>
              <div className="row">
                <div style={{ width: 120 }}>
                  <label className="fl">Price ₹ <span className="req">*</span></label>
                  <input className="t" type="number" value={draft.price} onChange={e => setDraft(d => ({ ...d, price: e.target.value }))} placeholder="0" />
                </div>
                {/* stock-asked-once: only a product type with nothing to count per colour or size
                    is asked its stock here. Every other is asked once, in step ②. */}
                {!stockKey && (
                  <div style={{ width: 100 }}>
                    <label className="fl">Stock</label>
                    <input className="t" type="number" value={draft.stock} onChange={e => setDraft(d => ({ ...d, stock: e.target.value }))} placeholder="—" />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label className="fl">SKU <span className="muted2">(auto — leave blank)</span></label>
                  <input className="t" value={draft.sku} onChange={e => setDraft(d => ({ ...d, sku: e.target.value }))} placeholder="auto-generated" />
                </div>
              </div>
              <div>
                <label className="fl">Description <span className="muted2">(optional)</span></label>
                <textarea className="t" rows={3} value={draft.description}
                  onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                  placeholder="Fabric feel, fit, styling tips, care — anything that helps a shopper decide." />
              </div>
              {tagOpts.length > 0 && (
                <div>
                  <label className="fl">Tags <span className="muted2">(optional — INFLX features tagged products in curated collections)</span></label>
                  <select className="t" value=""
                    onChange={e => { if (e.target.value) toggleTag(e.target.value); }}>
                    <option value="">Add a tag…</option>
                    {tagOpts.filter(t => !draft.tags.includes(t.slug)).map(t => (
                      <option key={t.slug} value={t.slug}>{t.label}</option>
                    ))}
                  </select>
                  {draft.tags.length > 0 && (
                    <div className="tagchips">
                      {draft.tags.map(slug => {
                        const opt = tagOpts.find(t => t.slug === slug);
                        return (
                          <span key={slug} className="tgc on">
                            {opt ? opt.label : slug}
                            <button type="button" className="tgx" aria-label={`Remove ${opt ? opt.label : slug}`}
                              onClick={() => toggleTag(slug)}>×</button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ② Variants + photos — variant facets, then per-colour pics & stock, OR
                a single product-photo set when the item has no colour variant. */}
          {step === 2 && (
            <div className="stepbody">
              {variantFacets.filter(f => !(oneSize && f.facet_key === SIZE_KEY)).map(renderFacet)}
              {selectedColors.length > 0 && selectedVariants.length > 0 && !oneSize && (
                <div className="sub">Every {(stockFacet?.label || 'size').toLowerCase()} this product comes in. Turn one off inside a colour below if that colour doesn&rsquo;t stock it.</div>
              )}
              {selectedColors.length > 0 ? (
                <>
                  <div className="sec">{oneSize ? 'Photos & stock — per colour' : 'Variant photos & stock — per colour'}</div>
                  {selectedColors.map(color => {
                    const cv = draft.variants[color] || { images: [], stock: {} };
                    return (
                      <div key={color} className="vcard">
                        <div className="vhead"><span className="dot" />{color}</div>
                        <label className="fl">Photos for {color}</label>
                        <input className="t" type="file" accept="image/*" multiple onChange={e => { pickImages(e.target.files, color); e.target.value = ''; }} />
                        <div className="urlrow">
                          <input className="t" placeholder="or paste URL(s)" value={urlText[color] || ''}
                            onChange={e => setUrlText(t => ({ ...t, [color]: e.target.value }))} />
                          <button className="btn ghost" disabled={ingesting === color} onClick={() => addImagesFromUrls(color)}>
                            {ingesting === color ? 'Adding…' : 'Add URL'}
                          </button>
                        </div>
                        {uploading === color && <div className="sub">Uploading…</div>}
                        {arr(cv.images).length > 0 && <div className="imgs">{cv.images.map((u, i) => <img key={i} className="thumb" src={u} alt="" />)}</div>}
                        {/* stock-asked-once (board W2): a one-size product has one stock box per colour. */}
                        {oneSize && (
                          <>
                            <label className="fl">Stock for {color}</label>
                            <input className="t stockone" type="number" min="0" placeholder="—" aria-label={`Stock for ${color}`}
                              value={cv.stock?.[oneSize] ?? ''} onChange={e => setColorVariantStock(color, oneSize, e.target.value)} />
                          </>
                        )}
                        {!oneSize && selectedVariants.length > 0 && (() => {
                          // Every master size is offered, ON by default; tapping one
                          // drops it FOR THIS COLOUR ONLY (listing-per-colour-sizes).
                          const on = sizesFor(color);
                          const unit = (stockFacet?.label || 'size').toLowerCase();
                          return (
                            <>
                              <label className="fl">{stockFacet?.label || 'Variant'} &amp; stock for {color}</label>
                              <div className="vstock">{selectedVariants.map(val => {
                                const has = on.includes(val);
                                return (
                                  <div key={val} className={'vsize' + (has ? '' : ' off')}>
                                    <button type="button" className="vsz" aria-pressed={has}
                                      title={has ? `${color} does not come in ${val}? Tap to remove` : `Add ${val} to ${color}`}
                                      onClick={() => toggleColorSize(color, val)}>{val}</button>
                                    {has
                                      ? <input type="number" min="0" placeholder="—" value={cv.stock?.[val] ?? ''} onChange={e => setColorVariantStock(color, val, e.target.value)} />
                                      : <span className="na" aria-label={`${val} not available in ${color}`}>—</span>}
                                  </div>
                                );
                              })}</div>
                              {on.length === 0
                                ? <div className="hintq warn">Pick at least one {unit} for {color}.</div>
                                : on.length < selectedVariants.length
                                  ? <div className="sub">{color} is not sold in {selectedVariants.filter(v => !on.includes(v)).join(', ')}.</div>
                                  : null}
                            </>
                          );
                        })()}
                      </div>
                    );
                  })}
                  {/* stock-asked-once (board W2, W3): what the boxes add up to, and what an empty one means. */}
                  {selectedVariants.length > 0 && (
                    <>
                      <div className="stot"><span>Total stock</span><span>{stockTotalText}</span></div>
                      <div className="sub">Leave a box empty if you do not count stock for that {oneSize ? 'colour' : (stockFacet?.label || 'size').toLowerCase()}: it then never shows as sold out. 0 means sold out.</div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="sec">Product photos</div>
                  <label className="fl">Photos (up to 6) — the first is the main image <span className="req">*</span></label>
                  <input className="t" type="file" accept="image/*" multiple onChange={e => { pickImages(e.target.files, 'cover'); e.target.value = ''; }} />
                  <div className="urlrow">
                    <input className="t" placeholder="or paste image URL(s) — comma-separated" value={urlText.cover || ''}
                      onChange={e => setUrlText(t => ({ ...t, cover: e.target.value }))} />
                    <button className="btn ghost" disabled={ingesting === 'cover'} onClick={() => addImagesFromUrls('cover')}>
                      {ingesting === 'cover' ? 'Adding…' : 'Add URL'}
                    </button>
                  </div>
                  {uploading === 'cover' && <div className="sub">Uploading…</div>}
                  {draft.images.length > 0 && <div className="imgs">{draft.images.map((u, i) => <img key={i} className="thumb" src={u} alt="" />)}</div>}
                </>
              )}
            </div>
          )}

          {/* ③ Details — required attrs lead, the rest under "More details" */}
          {step === 3 && (
            <div className="stepbody">
              {requiredDetails.map(renderFacet)}
              {optionalDetails.length > 0 && (
                <>
                  <div className="more" onClick={() => setMoreOpen(o => !o)}>
                    {moreOpen ? '▾' : '▸'} More details (optional) — {optionalDetails.length} field{optionalDetails.length > 1 ? 's' : ''}
                  </div>
                  {moreOpen && optionalDetails.map(renderFacet)}
                </>
              )}
              {requiredDetails.length === 0 && optionalDetails.length === 0 &&
                <div className="sub" style={{ marginTop: 10 }}>No extra details for this item type — continue to review.</div>}
            </div>
          )}

          {/* ④ Review */}
          {step === 4 && (
            <div className="stepbody review">
              {reviewImg && <img className="revimg" src={reviewImg} alt="" />}
              <div className="revname">{draft.name || '(unnamed)'}</div>
              <div className="revmeta">₹{draft.price || '0'}{draft.brand ? ` · ${draft.brand}` : ''}</div>
              {draft.description && <div className="sub" style={{ marginTop: 6 }}>{draft.description}</div>}
              {selectedColors.length > 0 && (
                <div className="revrow">{selectedColors.map(c => {
                  const tot = stockKey ? colourTotal(c) : null;
                  return <span key={c} className="pill v">{c}{tot != null ? ` ·${tot}` : ''}</span>;
                })}</div>
              )}
              {selectedColors.length > 0 && selectedVariants.length > 0 && <div className="revtot">Total stock: {stockTotalText}</div>}
              <div className="revrow">{detailFacets.map(f => {
                const v = draft.facets[f.facet_key]; const txt = Array.isArray(v) ? v.join(', ') : v;
                return txt ? <span key={f.facet_key} className="pill">{txt}</span> : null;
              })}</div>
            </div>
          )}

          {/* Step navigation */}
          <div className="nav">
            {step > 1
              ? <button className="btn ghost" onClick={goBack}>‹ Back</button>
              : (editingId
                  ? <button className="btn ghost" onClick={() => { window.location.href = '/dashboard/products/listing'; }}>‹ Cancel</button>
                  : <button className="btn ghost" onClick={() => jumpTo(crumb.length - 1)}>‹ Pick another type</button>)}
            {step < 4
              ? <button className={'btn ink' + (stepBlocked.length ? ' dis' : '')} onClick={goNext}>Next ›</button>
              : (editingId
                  ? <button className="btn yellow" disabled={saving} onClick={() => saveEdit()}>{saving ? 'Saving…' : 'Save changes'}</button>
                  : <button className="btn yellow" onClick={addItem}>+ Add this item</button>)}
          </div>
          {step < 4 && stepBlocked.length > 0 && <div className="hint">Still needed: {stepBlocked.join(', ')}</div>}
          </>)}

          {mode === 'bulk' && (
            <div className="bulkwrap">
              <div className="brow">
                <div className="bcard">
                  <div className="bcn">1 · Download template</div>
                  <div className="bcd">An Excel built for <b>this item type's current specs</b> — with dropdowns where options are fixed.</div>
                  <a className="btn yellow" href={listingApi.templateUrl(leaf.id)}>⬇ {leaf.name}-template.xlsx</a>
                </div>
                <div className="bcard">
                  <div className="bcn">2 · Upload filled file</div>
                  <div className="bcd">{oneSize ? 'One row per colour.' : 'One row per colour+size.'} We check every row, then create them all — or show what to fix.</div>
                  <label className={'btn ink' + (importing ? ' dis' : '')} style={{ display: 'inline-block', cursor: 'pointer' }}>
                    {importing ? 'Checking…' : '⬆ Choose .xlsx / .csv'}
                    <input type="file" accept=".xlsx,.csv" style={{ display: 'none' }} disabled={importing}
                      onChange={e => handleImport(e.target.files?.[0])} />
                  </label>
                </div>
              </div>
              <div className="bnote"><b>Auto-updating:</b> change a spec for this item type and the template here changes too — the sheet is always today's specs (stamped on the Instructions tab).</div>

              {/* File-level problem (e.g. out-of-date template) */}
              {importFileErr && (
                <div className="err">
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>Couldn't read that file</div>
                  <div>{importFileErr}</div>
                  {/* The old-template refusal (stock-asked-once) already says what to do. */}
                  {!/Download the template again/.test(importFileErr) && (
                    <div style={{ marginTop: 6 }}>Download a fresh template above, paste your rows into it, and upload again.</div>
                  )}
                </div>
              )}

              {/* Per-row problems — fix and re-upload (nothing was saved) */}
              {importErrors && (
                <div className="err">
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>{importErrors.length} product(s) need a fix — nothing was saved</div>
                  {importErrors.slice(0, 25).map((p, i) => (
                    <div key={i} className="erow"><b>{p.name}</b>{p.rows?.length ? ` (row ${p.rows.join(', ')})` : ''} — {p.errors.join('; ')}</div>
                  ))}
                  {importErrors.length > 25 && <div className="erow">…and {importErrors.length - 25} more</div>}
                  <div style={{ marginTop: 8, fontWeight: 700 }}>Fix these cells in your sheet, then press “⬆ Choose .xlsx / .csv” again.</div>
                </div>
              )}

              {/* All duplicates — nothing new created */}
              {imported.length === 0 && importWarnings?.skipped?.length > 0 && (
                <div className="warnbox">All {importWarnings.skipped.length} product{importWarnings.skipped.length > 1 ? 's were' : ' was'} already in your {leaf.name} listing — nothing new was added (no duplicates created).</div>
              )}

              {/* Success — created products + non-blocking warnings + photo tray */}
              {imported.length > 0 && (
                <>
                  <div className="ok">✓ {imported.length} product{imported.length > 1 ? 's' : ''} added under {leaf.name}. Add photos below — then they're live.</div>
                  {importWarnings && (importWarnings.values?.length > 0 || importWarnings.images?.length > 0 || importWarnings.skipped?.length > 0) && (
                    <div className="warnbox">
                      {importWarnings.skipped?.length > 0 && (
                        <div>{importWarnings.skipped.length} already in your listing — skipped (no duplicates): {importWarnings.skipped.slice(0, 5).join(', ')}{importWarnings.skipped.length > 5 ? '…' : ''}.</div>
                      )}
                      {importWarnings.values?.length > 0 && (
                        <div style={{ marginTop: importWarnings.skipped?.length ? 4 : 0 }}>Skipped {importWarnings.values.length} unrecognised tag{importWarnings.values.length > 1 ? 's' : ''}: {importWarnings.values.slice(0, 6).map(w => `${w.facet} “${w.dropped}”`).join(', ')}{importWarnings.values.length > 6 ? '…' : ''}. Everything else imported fine.</div>
                      )}
                      {importWarnings.images?.length > 0 && (
                        <div style={{ marginTop: (importWarnings.values?.length || importWarnings.skipped?.length) ? 4 : 0 }}>{importWarnings.images.length} image link{importWarnings.images.length > 1 ? 's' : ''} couldn't be fetched (the source blocks it) — add those photos below.</div>
                      )}
                    </div>
                  )}
                  <div className="sec">Add photos — {imported.length} just imported</div>
                  {imported.map(p => (
                    <div key={p.id} className="trow">
                      {p.image_url ? <img className="tph" src={p.image_url} alt="" /> : <span className="tph ph">＋</span>}
                      <div>
                        <div style={{ fontWeight: 700 }}>{p.name}</div>
                        <div className="sub">{p.sku}{p.photo_count ? ` · ${p.photo_count} photo${p.photo_count > 1 ? 's' : ''}` : (p.image_url ? ' · photo added' : ' · needs photos')}</div>
                      </div>
                      <label className="btn ghost" style={{ marginLeft: 'auto', cursor: 'pointer' }}>
                        {trayUploading === p.id ? 'Uploading…' : (p.photo_count || p.image_url ? '＋ More photos' : '＋ Add photos')}
                        <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                          onChange={e => addTrayPhoto(p.id, e.target.files)} />
                      </label>
                    </div>
                  ))}
                  <button className="btn ghost" style={{ marginTop: 8 }}
                    onClick={() => { setImported([]); setImportWarnings(null); }}>Upload another file</button>
                </>
              )}
            </div>
          )}
        </div>
      )}
          </div>{/* .body */}
        </div>{/* .card */}

        {/* Staging tray — the batch stays visible while you add the next product
            (contract listing-workspace-ux; it used to sit below the fold). */}
        {leaf && !editingId && (
          <div className="card rail">
            <div className="railhd">
              <span className="t">This batch</span>
              <span className="cnt">{items.length}</span>
            </div>
            {items.length === 0 ? (
              <div className="emptytray">
                <div className="big">▤</div>
                Nothing staged yet.<br />Fill the steps and press<br /><b>+ Add this item</b>.
              </div>
            ) : (
              <div className="tray">
                {items.map((it, i) => (
                  <div key={i} className="tcard">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="nm">{it.name}{it.brand ? <span className="brandtag">{it.brand}</span> : null}</div>
                      <div className="mt">{it.variants?.length ? `${it.variants.length} colour(s)` : ''}{stagedStock(it) != null ? `${it.variants?.length ? ' · ' : ''}stock ${stagedStock(it)}` : ''}</div>
                    </div>
                    <span className="pr">₹{Number(it.price).toLocaleString('en-IN')}</span>
                    <button className="x" aria-label={`Remove ${it.name}`}
                      onClick={() => setItems(list => list.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="railfoot">
              <button className="btn yellow" disabled={saving || items.length === 0} onClick={saveBatch}>
                {saving ? 'Saving…' : `Save ${items.length} product${items.length === 1 ? '' : 's'} →`}
              </button>
              <div className="fine">SKUs are generated on save.<br />Brand + details carry to the next item.</div>
            </div>
          </div>
        )}
      </div>
      )}
      </div>{/* .page */}
    </div>
  );
}

const CSS = `
.lst *{box-sizing:border-box}
.lst{--white:#fff;--bg:#FAFAFA;--bg2:#F4F4F5;--yellow:#FFC107;--yellow-pale:#FFF7CC;--yellow-text:#6B5A00;
  --ink:#0A0A0A;--ink2:#1F1F22;--muted:#52525B;--muted2:#71717A;--muted3:#A1A1AA;--border:#E4E4E7;
  --success:#10B981;--success-pale:#D1FAE5;--success-text:#047857;--danger:#E8401A;--danger-pale:#FDEEE9;
  --variant:#7E22CE;--variant-pale:#F3E8FF;--disc:#0E7490;--disc-pale:#CFFAFE;--info:#1D4ED8;--info-pale:#DBEAFE;
  font-family:'Plus Jakarta Sans','Outfit',system-ui,sans-serif;color:var(--ink);font-size:13px;line-height:1.45}
.lst h1{font-family:'Outfit',sans-serif;font-size:22px;font-weight:700;letter-spacing:-.3px;margin:0}
.lst .sub{font-size:12px;color:var(--muted2);max-width:680px}
.lst .muted2{color:var(--muted3);font-weight:500}
.lst .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
.lst .node{display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--white);border:1px solid var(--border);
  border-radius:12px;padding:13px 14px;cursor:pointer;transition:.12s}
.lst .node:hover{border-color:var(--yellow);transform:translateY(-1px)}
.lst .node.leaf{border-left:3px solid var(--yellow)}
.lst .node .nm{font-weight:700;font-size:13px} .lst .node .mt{font-size:10px;color:var(--muted3);margin-top:2px}
.lst .node .a{color:var(--muted3);font-size:16px}
.lst .panel{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:16px;margin-top:10px}
.lst .phead{font-family:'Outfit';font-weight:800;font-size:16px} .lst .phead .done{font-size:11px;font-weight:700;color:var(--success-text);margin-left:6px}
.lst .fl{display:block;font-size:11px;font-weight:700;color:var(--ink2);margin:12px 0 5px}
.lst .fl .req{color:var(--danger)} .lst .fl .tag{font-size:9px;font-weight:800;padding:1px 6px;border-radius:5px;margin-left:5px}
.lst .tag.variant{background:var(--variant-pale);color:var(--variant)} .lst .tag.disc{background:var(--disc-pale);color:var(--disc)} .lst .tag.attr{background:var(--info-pale);color:var(--info)}
.lst input.t,.lst select.t,.lst textarea.t{width:100%;background:var(--white);border:1px solid var(--border);border-radius:9px;padding:10px;font-size:13px;font-family:inherit;color:var(--ink)}
.lst textarea.t{resize:vertical;min-height:72px;line-height:1.5}
.lst input.t:focus,.lst select.t:focus,.lst textarea.t:focus{outline:none;border-color:var(--yellow)}
.lst .chips{display:flex;flex-wrap:wrap;gap:6px}
.lst .chip{padding:7px 12px;border-radius:99px;border:1px solid var(--border);background:var(--white);font-size:12px;font-weight:600;cursor:pointer;user-select:none}
.lst .chip.on{background:var(--ink);border-color:var(--ink);color:#fff} .lst .chip.on.v{background:var(--variant);border-color:var(--variant)}
.lst .tog{display:inline-flex;border:1px solid var(--border);border-radius:9px;overflow:hidden}
.lst .tog button{border:0;background:var(--white);padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;color:var(--muted2)}
.lst .tog button.on{background:var(--ink);color:var(--yellow)}
.lst .btn{padding:11px 16px;border:0;border-radius:11px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit}
.lst .btn.yellow{background:var(--yellow);color:var(--ink)} .lst .btn.ink{background:var(--ink);color:var(--yellow)} .lst .btn.ghost{background:var(--white);border:1px solid var(--border);color:var(--ink2)}
.lst .btn:disabled{opacity:.5;cursor:not-allowed}
.lst .row{display:flex;gap:10px;flex-wrap:wrap}
.lst .imgs{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.lst .thumb{width:62px;height:62px;border-radius:9px;object-fit:cover;border:1px solid var(--border)}
.lst .vcard{border:1px solid var(--border);border-radius:12px;padding:12px;margin-top:8px;background:var(--bg)}
.lst .vhead{font-weight:800;font-size:13px;display:flex;align-items:center;gap:7px}
.lst .vhead .dot{width:12px;height:12px;border-radius:50%;border:1px solid var(--border);background:var(--variant-pale)}
.lst .vstock{display:flex;flex-wrap:wrap;gap:8px}
.lst .vsize{display:flex;align-items:center;gap:6px;background:var(--white);border:1px solid var(--border);border-radius:9px;padding:5px 8px}
.lst .vsize span{font-size:11px;font-weight:700;min-width:24px} .lst .vsize input{width:60px;border:0;border-bottom:1px solid var(--border);font-size:12px;padding:2px;font-family:inherit}
/* listing-per-colour-sizes: the size label is a toggle, so a colour can drop a
   size the rest of the product still carries. Off = dashed + struck through. */
.lst .vsize .vsz{border:0;background:var(--yellow-pale);color:var(--yellow-text);font:inherit;font-size:11px;font-weight:800;border-radius:6px;padding:5px 9px;min-width:34px;cursor:pointer}
.lst .vsize .vsz:hover{filter:brightness(.96)}
.lst .vsize.off{background:var(--bg2);border-style:dashed;opacity:.72}
.lst .vsize.off .vsz{background:transparent;color:var(--muted);text-decoration:line-through}
.lst .vsize .na{width:60px;text-align:center;color:var(--muted);font-size:12px;min-width:0}
.lst .stockone{max-width:120px;font-weight:700}
.lst .stot{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--white);font-size:12px;font-weight:800}
.lst .stot + .sub{margin-top:6px}
.lst .revtot{margin-top:6px;font-size:12px;font-weight:800}
.lst .brandtag{font-size:10px;font-weight:700;background:var(--info-pale);color:var(--info);padding:1px 7px;border-radius:6px;margin-left:7px}
.lst .err{background:var(--danger-pale);border:1px solid #f3c0b0;color:#9a2a12;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:600;margin:10px 0}
.lst .ok{background:var(--success-pale);border:1px solid #9be3c4;color:var(--success-text);border-radius:10px;padding:9px 12px;font-size:12px;font-weight:700;margin:10px 0}
.lst .setupnudge{background:var(--yellow-pale);border:1px solid var(--yellow);border-radius:12px;padding:11px 16px;font-weight:700;color:var(--yellow-text);margin-bottom:14px}
.lst .setupnudge a{color:var(--ink);text-decoration:underline;margin-left:6px}
.lst .tagchips{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.lst .tgc{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);background:#fff;border-radius:99px;padding:5px 12px;font-weight:700;font-size:12px;color:var(--muted)}
.lst .tgc.on{background:var(--yellow-pale);border-color:var(--yellow);color:var(--yellow-text)}
.lst .tgx{background:0;border:0;color:var(--yellow-text);font-size:14px;font-weight:800;cursor:pointer;padding:0;line-height:1}
.lst .warnbox{background:var(--yellow-pale);border:1px solid #f0e1a8;color:var(--yellow-text);border-radius:10px;padding:9px 12px;font-size:12px;font-weight:600;margin:0 0 10px}
.lst .sec{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2);font-weight:800;margin:16px 0 8px}
.lst .steps{display:flex;align-items:center;gap:4px;margin-bottom:14px;flex-wrap:wrap}
.lst .stwrap{display:flex;align-items:center;gap:4px}
.lst .st{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:var(--muted3)}
.lst .st .n{width:20px;height:20px;border-radius:50%;background:var(--bg2);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--muted2);border:1px solid var(--border)}
.lst .st.on{color:var(--ink)} .lst .st.on .n{background:var(--ink);color:var(--yellow);border-color:var(--ink)}
.lst .st.done .n{background:var(--success);color:#fff;border-color:var(--success)}
.lst .bar{width:18px;height:2px;background:var(--border)}
.lst .stepbody{min-height:120px}
.lst .nav{display:flex;justify-content:space-between;gap:10px;margin-top:16px;border-top:1px solid var(--border);padding-top:14px}
.lst .hint{font-size:11px;color:var(--danger);font-weight:700;margin-top:6px;text-align:right}
.lst .more{margin-top:12px;border:1px dashed var(--border);border-radius:9px;padding:9px 11px;font-size:12px;font-weight:700;color:var(--muted2);background:var(--bg);cursor:pointer;user-select:none}
.lst .more:hover{border-color:var(--yellow);color:var(--ink2)}
.lst .review{text-align:left}
.lst .revimg{width:80px;height:80px;border-radius:11px;object-fit:cover;border:1px solid var(--border);margin-bottom:8px}
.lst .revname{font-family:'Outfit';font-weight:800;font-size:16px}
.lst .revmeta{font-size:13px;color:var(--muted);font-weight:600;margin-top:2px}
.lst .revrow{margin-top:8px}
.lst .pill{display:inline-block;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;margin:0 4px 4px 0}
.lst .pill.v{background:var(--variant-pale);color:var(--variant);border-color:#e7d3fb}
.lst .bulktabs{display:flex;gap:6px;margin:8px 0 14px}
.lst .btab{padding:8px 15px;border-radius:9px;font-size:12px;font-weight:800;border:1px solid var(--border);background:var(--bg);color:var(--muted2);cursor:pointer;user-select:none}
.lst .btab.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.lst .bulkwrap{margin-top:4px}
.lst .brow{display:flex;gap:12px;flex-wrap:wrap}
.lst .bcard{flex:1;min-width:230px;border:1px solid var(--border);border-radius:12px;padding:14px;background:var(--bg)}
.lst .bcn{font-family:'Outfit';font-weight:800;font-size:14px;margin-bottom:3px}
.lst .bcd{font-size:11px;color:var(--muted2);line-height:1.5;margin-bottom:11px}
.lst .bnote{margin-top:12px;font-size:11px;color:var(--yellow-text);background:var(--yellow-pale);border:1px solid #f0e1a8;border-radius:9px;padding:10px 12px;line-height:1.5}
.lst .erow{font-size:12px;color:#7a2410;padding:3px 0;border-bottom:1px dashed #f0c4b4}
.lst .erow:last-child{border-bottom:0}
.lst .trow{display:flex;align-items:center;gap:11px;background:var(--white);border:1px solid var(--border);border-radius:11px;padding:9px 11px;margin-bottom:8px}
.lst .tph{width:42px;height:42px;border-radius:9px;object-fit:cover;border:1px solid var(--border)}
.lst .tph.ph{display:flex;align-items:center;justify-content:center;border:1.5px dashed var(--border);color:var(--muted3);font-size:17px}
.lst .urlrow{display:flex;gap:8px;margin-top:6px}
.lst .urlrow .t{flex:1}
/* Row actions — shared by the inventory table (contract: listing-workspace-ux) */
.lst .pact{display:flex;gap:4px}
.lst .pact button{padding:5px 9px;font-size:11px;font-weight:700;border-radius:6px;background:transparent;color:var(--muted);border:0;cursor:pointer;font-family:inherit}
.lst .pact button:hover:not(:disabled){color:var(--ink);background:var(--bg)}
.lst .pact button.danger{color:var(--danger-text)}
.lst .pact button:disabled{opacity:.4;cursor:not-allowed}
.lst .empty2{background:#FFFDEB;border:1px solid #f0e1a8;border-radius:14px;padding:28px;text-align:center;margin-top:12px}

/* ── Listing workspace (contract: listing-workspace-ux) ──────────────────────
   Full-width three-pane shell. Replaces the maxWidth:960 centred column and
   the drill-and-swap navigation. Rules below intentionally come last so they
   win over the single-column styling above. */
.lst{--rail-l:264px;--rail-r:320px}
.lst .page{max-width:1720px;margin:0 auto;padding:18px 24px 60px}

/* header */
.lst .hdr{display:flex;align-items:flex-end;gap:18px;flex-wrap:wrap}
.lst .hdr h1{font-size:23px}
.lst .hdr .grow{flex:1}
.lst .vert{display:inline-flex;align-items:center;background:var(--ink);color:var(--yellow);border-radius:99px;
  padding:4px 12px;font-size:11px;font-weight:800;letter-spacing:.3px;margin-left:10px;vertical-align:3px}
.lst .omni{flex:0 1 420px;min-width:240px;position:relative}
.lst .omni input{width:100%;background:#fff;border:1px solid var(--border);border-radius:10px;
  padding:10px 30px 10px 34px;font-size:13px;font-family:inherit;color:var(--ink)}
.lst .omni input:focus{outline:none;border-color:var(--yellow)}
.lst .omni .ic{position:absolute;left:12px;top:10px;color:var(--muted3);font-size:13px}
.lst .omni .clr{position:absolute;right:8px;top:7px;background:0;border:0;color:var(--muted2);font-size:16px;cursor:pointer;line-height:1}
.lst .hactions{display:flex;gap:8px;align-items:center}
.lst a.btn{text-decoration:none;display:inline-flex;align-items:center}
.lst .setupnudge{display:flex;align-items:center;gap:10px;padding:8px 14px;font-size:12px;margin-bottom:14px}
.lst .setupnudge a{margin-left:auto;white-space:nowrap}

/* tab rail */
.lst .tabrail{display:flex;align-items:center;gap:2px;border-bottom:1px solid var(--border);margin:16px 0}
.lst .tabrail .tab{padding:11px 16px;font-size:13px;font-weight:800;color:var(--muted2);background:0;
  border:0;border-bottom:2.5px solid transparent;cursor:pointer;font-family:inherit;border-radius:0}
.lst .tabrail .tab.on{color:var(--ink);border-bottom-color:var(--yellow);background:0}

/* three-pane grid */
.lst .ws{display:grid;grid-template-columns:var(--rail-l) minmax(0,1fr) var(--rail-r);gap:16px;align-items:start}
.lst .ws.norail{grid-template-columns:var(--rail-l) minmax(0,1fr)}
.lst .ws.solo{grid-template-columns:minmax(0,1fr)}
.lst .card{background:#fff;border:1px solid var(--border);border-radius:14px;min-width:0}
.lst .rail{position:sticky;top:14px;max-height:calc(100vh - 40px);display:flex;flex-direction:column;overflow:hidden}
.lst .railhd{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--border)}
.lst .railhd .t{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--muted2)}
.lst .railhd .a{margin-left:auto;font-size:11px;font-weight:700;color:var(--muted3);background:0;border:0;cursor:pointer;font-family:inherit}
.lst .railhd .a:hover{color:var(--ink)}
.lst .railhd .cnt{margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;
  background:var(--yellow-pale);color:var(--yellow-text);border-radius:99px;padding:2px 9px}
.lst .railbody{overflow-y:auto;padding:8px}
.lst .railnote{font-size:11.5px;color:var(--muted3);font-weight:700;padding:10px}

/* tree */
.lst .tnode{display:flex;align-items:center;gap:7px;width:100%;text-align:left;border:0;border-left:3px solid transparent;
  border-radius:9px;padding:7px 9px;font-size:12.5px;font-weight:700;color:var(--ink2);background:0;cursor:pointer;font-family:inherit}
.lst .tnode:hover{background:var(--bg)}
.lst .tnode .cv{width:12px;color:var(--muted3);font-size:9px;flex:none;transition:.15s}
.lst .tnode.open .cv{transform:rotate(90deg)}
.lst .tnode .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lst .tnode .n{font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:800;color:var(--muted3)}
.lst .tnode.on{background:var(--yellow-pale);border-left-color:var(--yellow);color:var(--ink)}
.lst .tnode.on .n{color:var(--yellow-text)}
.lst .tnode.leaf .nm:before{content:"▪";color:var(--muted3);margin-right:6px;font-size:9px}
.lst .tnode.on.leaf .nm:before{color:var(--yellow-text)}
.lst .tkids{margin-left:14px;border-left:1px dashed var(--border);padding-left:4px}

/* centre */
.lst .crumbbar{display:flex;align-items:center;gap:8px;padding:11px 16px;border-bottom:1px solid var(--border);flex-wrap:wrap}
.lst .crumbbar .cr{font-size:12px;font-weight:700;color:var(--muted2)}
.lst .crumbbar .cr a{color:var(--muted2);cursor:pointer}
.lst .crumbbar .cr a:hover{color:var(--ink)}
.lst .crumbbar .cr b{color:var(--ink)}
.lst .crumbbar .sep{color:var(--muted3);margin:0 5px}
.lst .crumbbar .right{margin-left:auto;display:flex;align-items:center;gap:8px}
.lst .hintq{font-size:11px;font-weight:700;color:var(--muted3)}
.lst .hintq.warn{color:#B4531A}
.lst .body{padding:16px}
.lst .btn.sm{padding:7px 11px;font-size:11.5px;border-radius:8px}
.lst .btn.danger{color:var(--danger)}

/* category cards spread the full centre column */
.lst .grid{grid-template-columns:repeat(auto-fill,minmax(212px,1fr))}
.lst .node:hover{box-shadow:0 4px 14px rgba(0,0,0,.05)}
.lst .panel{border:0;border-radius:0;padding:0;margin-top:0;background:transparent}

/* inventory table */
.lst .tblwrap{overflow-x:auto}
.lst .tbl{width:100%;border-collapse:collapse}
.lst .tbl th{text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;
  color:var(--muted2);padding:9px 10px;border-bottom:1px solid var(--border);white-space:nowrap;background:var(--bg)}
.lst .tbl td{padding:9px 10px;border-bottom:1px solid var(--border);vertical-align:middle}
.lst .tbl tr:last-child td{border-bottom:0}
.lst .tbl tr:hover td{background:#FCFCFD}
.lst .tbl tr.hid td{opacity:.6}
.lst .tbl .pimg{width:40px;height:40px;border-radius:8px;object-fit:cover;border:1px solid var(--border);background:var(--bg2)}
.lst .tbl .pimg.ph{display:flex;align-items:center;justify-content:center;color:var(--muted3);font-size:16px;border-style:dashed}
.lst .tbl .pn{font-weight:800;font-size:12.5px}
.lst .tbl .pm{font-size:10.5px;color:var(--muted2);margin-top:1px}
.lst .tbl .tdbrand{font-size:12px;font-weight:700;white-space:nowrap}
.lst .tbl .tdsku{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted2);white-space:nowrap}
.lst .tbl .tdprice{font-family:'JetBrains Mono',monospace;font-weight:800;text-align:right;white-space:nowrap}
.lst .tbl .tdstock{font-family:'JetBrains Mono',monospace;font-weight:800;text-align:right}
.lst .tbl .tdstock.warn{color:#9a2a12}
.lst .tbl .pill{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;
  padding:3px 9px;border-radius:99px;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap}
.lst .tbl .pill.live{background:var(--success-pale);color:var(--success-text)}
.lst .tbl .pill.hid{background:var(--bg2);color:var(--muted2)}
.lst .tbl .pill.low{background:var(--danger-pale);color:#9a2a12}
.lst .vchips{display:flex;gap:3px;align-items:center}
.lst .vch{width:15px;height:15px;border-radius:50%;border:1px solid var(--border);flex:none}
.lst .vmore{font-size:10px;font-weight:800;color:var(--muted3);margin-left:3px;white-space:nowrap}
.lst .pact{display:flex;gap:2px;justify-content:flex-end}
.lst .bulkbar{display:flex;align-items:center;gap:8px;background:var(--ink);color:#fff;border-radius:11px;
  padding:9px 14px;font-size:12px;font-weight:800;flex-wrap:wrap}
.lst .bulkbar .btn.sm{background:#2a2a2a;color:#fff}
.lst .bulkbar .btn.sm:hover:not(:disabled){background:#3a3a3a}
.lst .bulkbar .btn.sm.danger{color:#ff9b7d}
.lst .bulkbar .x{margin-left:auto;background:0;border:0;color:#888;font-size:16px;cursor:pointer}

/* filter / stats rail */
.lst .tiles{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px}
.lst .tile{background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px;min-width:0}
.lst .tile b{font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:800;display:block;overflow:hidden;text-overflow:ellipsis}
.lst .tile span{font-size:10px;font-weight:800;color:var(--muted3);text-transform:uppercase;letter-spacing:.4px}
.lst .tile.warn{background:var(--danger-pale);border-color:#f3c0b0}
.lst .tile.warn b{color:#9a2a12}
.lst .frow{padding:12px 14px;border-top:1px solid var(--border)}
.lst .frow .ft{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--muted2);margin-bottom:9px}
.lst .fopt{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--ink2);padding:4px 0;cursor:pointer}
.lst .fopt .n{margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--muted3);font-weight:800}

/* staging tray */
.lst .tray{overflow-y:auto;padding:10px}
.lst .tcard{display:flex;align-items:center;gap:9px;background:#fff;border:1px solid var(--border);
  border-radius:10px;padding:8px 9px;margin-bottom:7px}
.lst .tcard .nm{font-weight:800;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lst .tcard .mt{font-size:10.5px;color:var(--muted2)}
.lst .tcard .pr{font-family:'JetBrains Mono',monospace;font-weight:800;font-size:12.5px;white-space:nowrap}
.lst .tcard .x{background:0;border:0;color:var(--danger);font-size:16px;font-weight:800;line-height:1;cursor:pointer}
.lst .railfoot{border-top:1px solid var(--border);padding:12px;background:#fff;margin-top:auto}
.lst .railfoot .btn{width:100%}
.lst .railfoot .fine{font-size:10.5px;color:var(--muted3);font-weight:700;text-align:center;margin-top:8px;line-height:1.5}
.lst .emptytray{text-align:center;padding:26px 14px;color:var(--muted3);font-size:11.5px;font-weight:700;line-height:1.6}
.lst .emptytray .big{font-size:24px;margin-bottom:6px}
.lst .emptytray b{color:var(--ink2)}

/* bulk move / attach modals (contract: listing-bulk-move-and-offer) */
.lst .modalwrap{position:fixed;inset:0;background:rgba(10,10,10,.45);z-index:60;display:flex;
  align-items:center;justify-content:center;padding:24px}
.lst .modal{background:#fff;border-radius:16px;width:100%;max-width:520px;max-height:calc(100vh - 60px);
  display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.28)}
.lst .mhd{display:flex;align-items:center;gap:10px;padding:15px 18px 0}
.lst .mhd b{font-family:'Outfit',sans-serif;font-size:16px;font-weight:800}
.lst .mhd .x{margin-left:auto;background:0;border:0;font-size:20px;color:var(--muted3);cursor:pointer;line-height:1}
.lst .msub{padding:5px 18px 12px;font-size:12px;color:var(--muted2)}
.lst .mbody{flex:1;overflow-y:auto;padding:0 18px 8px;min-height:120px}
.lst .mbody .rail{position:static;max-height:none;border:1px solid var(--border)}
.lst .mbody .railbody{max-height:290px}
.lst .mfoot{display:flex;align-items:center;gap:9px;padding:13px 18px;border-top:1px solid var(--border);
  background:var(--bg);flex-wrap:wrap}
.lst .mfoot .pickd{flex:1;min-width:150px;font-size:11.5px;font-weight:700;color:var(--muted2)}
.lst .mfoot .pickd b{color:var(--ink)}
/* offer-builder-v2 (O9): the Offer column and the product's offer panel. The bulk "Attach offer"
 picker that used .offrow is retired (rules 1.13). */
.lst .offcell{background:0;border:0;padding:0;font:inherit;cursor:pointer;text-align:left;display:grid;gap:2px}
.lst .offcell{min-width:120px}
.lst .offcell .pill{max-width:160px;white-space:normal;text-align:left;line-height:1.3;margin:0}
.lst .tbl .pill.sched{background:var(--info-pale);color:var(--info)}
.lst .offpanel{border-bottom:1px solid var(--border);background:var(--yellow-pale)}
.lst .offpanel .railhd .t{color:var(--ink);text-transform:none;font-size:12.5px;letter-spacing:0}
.lst .offpanel .x{margin-left:auto;background:0;border:0;font-size:16px;cursor:pointer;color:var(--muted2)}
.lst .offbox{padding:10px 14px;display:grid;gap:5px;font-size:12px;border-top:1px solid var(--border)}
.lst .offbox .btn{justify-self:start;text-decoration:none}

@media (max-width:1400px){ .lst{--rail-l:236px;--rail-r:290px} }
@media (max-width:1150px){
  .lst .ws,.lst .ws.norail{grid-template-columns:minmax(0,1fr)}
  .lst .rail{position:static;max-height:none}
  .lst .railbody{max-height:320px}
}
`;
