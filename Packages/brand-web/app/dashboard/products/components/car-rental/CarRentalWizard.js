'use client';
import { useState, useEffect, useCallback } from 'react';
import { brandApi } from '../../../../../lib/api';
import VehicleTypeSelector from './VehicleTypeSelector';
import MakeModelPicker from './MakeModelPicker';
import SpecConfirmation from './SpecConfirmation';
import CarPricingForm from './CarPricingForm';

/**
 * CarRentalWizard — complete car rental listing page with:
 * 1. My Fleet — shows all listed vehicles with edit/remove
 * 2. Add New — 5-step wizard (Vehicle type → Make & Model → Specs → Pricing → Done)
 * 3. Bulk Upload — download Excel template + upload filled sheet
 */

const STEPS = [
  { id: 'vehicle_type', label: 'Vehicle type', num: 1 },
  { id: 'make_model', label: 'Make & model', num: 2 },
  { id: 'confirm_specs', label: 'Confirm specs', num: 3 },
  { id: 'pricing', label: 'Your price', num: 4 },
  { id: 'done', label: 'Done', num: 5 },
];

const VEHICLE_OPTIONS = [
  { value: 'Hatchback', label: 'Hatchback', sub: '4–5 seats · Compact', icon: 'hatchback' },
  { value: 'Sedan', label: 'Sedan', sub: '5 seats · Mid-size', icon: 'sedan' },
  { value: 'SUV', label: 'SUV', sub: '5 seats · All-terrain', icon: 'suv' },
  { value: 'MPV / MUV', label: 'MPV / MUV', sub: '6–7 seats · Family', icon: 'mpv' },
  { value: 'Luxury', label: 'Luxury', sub: '4–5 seats · Premium', icon: 'luxury' },
  { value: 'Tempo Traveller', label: 'Tempo Traveller', sub: '9–17 seats · Group', icon: 'tempo' },
];

export default function CarRentalWizard() {
  const [view, setView] = useState('fleet'); // 'fleet' | 'add' | 'upload'
  const [step, setStep] = useState(0);
  const [masterVehicles, setMasterVehicles] = useState([]);
  const [myProducts, setMyProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Form state
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [selectedMake, setSelectedMake] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [pricing, setPricing] = useState({ day_rate: null, km_rate: null, security_deposit: 5000, extra_km_charge: 12 });
  const [services, setServices] = useState([]);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [catalogueRes, productsRes] = await Promise.all([
        brandApi.get('/brands/me/master-catalogue'),
        brandApi.getProducts(),
      ]);
      if (catalogueRes.success && catalogueRes.data?.items) setMasterVehicles(catalogueRes.data.items);
      if (productsRes.success && productsRes.data?.products) setMyProducts(productsRes.data.products);
    } catch (e) {
      console.error('Failed to load:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (selectedModel?.services_json) setServices(selectedModel.services_json);
  }, [selectedModel]);

  // ── Wizard logic ──────────────────────────────────────────────────────────
  function canProceed() {
    if (step === 0) return !!selectedSegment;
    if (step === 1) return !!selectedModel;
    if (step === 2) return true;
    if (step === 3) return pricing?.day_rate > 0;
    return false;
  }

  async function handlePublish() {
    setSaving(true);
    try {
      const payload = {
        name: `${selectedModel.make} ${selectedModel.model}`,
        price: pricing.day_rate,
        section: selectedModel.segment,
        description: `${selectedModel.seats} seats · ${selectedModel.fuel_type} · ${selectedModel.transmission}`,
        master_vehicle_id: selectedModel.id,
        is_bookable: true,
        variants_json: JSON.stringify({
          day_rate: pricing.day_rate, km_rate: pricing.km_rate,
          security_deposit: pricing.security_deposit, extra_km_charge: pricing.extra_km_charge,
          variant: selectedVariant, services,
          specs: {
            seats: selectedModel.seats, fuel_type: selectedModel.fuel_type,
            engine_cc: selectedModel.engine_cc, transmission: selectedModel.transmission,
            kmpl: selectedModel.kmpl, ac: selectedModel.ac, sunroof: selectedModel.sunroof,
            features: selectedModel.features_json || [],
          },
        }),
      };
      const res = await brandApi.createProduct(payload);
      if (res.success) {
        setStep(4);
        loadData(); // refresh fleet
      } else {
        alert(res.error?.message || 'Failed to create listing');
      }
    } catch (e) { alert('Failed: ' + e.message); }
    finally { setSaving(false); }
  }

  function resetWizard() {
    setStep(0); setSelectedSegment(null); setSelectedMake(null);
    setSelectedModel(null); setSelectedVariant(null);
    setPricing({ day_rate: null, km_rate: null, security_deposit: 5000, extra_km_charge: 12 });
    setServices([]);
  }

  // ── Excel handlers ────────────────────────────────────────────────────────
  async function handleDownloadTemplate() {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('inflx_token') : null;
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1').replace(/\/+$/, '');
      const res = await fetch(`${apiBase}/brands/me/listing-template/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = 'INFLX_Car_Rental_Template.xlsx'; a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) { alert('Download failed: ' + e.message); }
  }

  async function handleUploadExcel(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadResult(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('inflx_token') : null;
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1').replace(/\/+$/, '');
      const formData = new FormData(); formData.append('file', file);
      const res = await fetch(`${apiBase}/brands/me/products/bulk-upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      const json = await res.json();
      setUploadResult(json.data || json);
      if (json.success || json.data?.created > 0) loadData();
    } catch (e) { setUploadResult({ errors: [e.message] }); }
    finally { setUploading(false); }
  }

  async function handleRemoveProduct(productId) {
    if (!confirm('Remove this vehicle from your fleet?')) return;
    const res = await brandApi.deleteProduct(productId);
    if (res.success) loadData();
    else alert(res.error?.message || 'Failed to remove');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="max-w-[780px] mx-auto">
      {/* Header */}
      <div className="text-center mb-5">
        <h1 className="text-2xl font-extrabold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>
          🚗 Your Fleet
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {myProducts.length} vehicle{myProducts.length !== 1 ? 's' : ''} in your listing
        </p>
      </div>

      {/* View tabs */}
      <div className="flex gap-2 mb-6 justify-center">
        {[
          { key: 'fleet', label: `My Fleet (${myProducts.length})`, icon: '🚗' },
          { key: 'add', label: 'Add Vehicle', icon: '➕' },
          { key: 'upload', label: 'Bulk Upload', icon: '📤' },
        ].map(t => (
          <button key={t.key} onClick={() => { setView(t.key); if (t.key === 'add') resetWizard(); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5
              ${view === t.key ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ═══════ FLEET VIEW ═══════ */}
      {view === 'fleet' && (
        <div>
          {myProducts.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
              <p className="text-4xl mb-3">🚗</p>
              <p className="text-base font-bold text-gray-700 mb-1">No vehicles listed yet</p>
              <p className="text-sm text-gray-400 mb-4">Add your first vehicle or upload an Excel sheet</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => { setView('add'); resetWizard(); }}
                  className="px-5 py-2.5 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600">
                  ➕ Add Vehicle
                </button>
                <button onClick={() => setView('upload')}
                  className="px-5 py-2.5 bg-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-300">
                  📤 Bulk Upload
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {myProducts.map(product => {
                let specs = {};
                try { specs = JSON.parse(product.variants_json || '{}')?.specs || {}; } catch {}
                let pricingData = {};
                try { pricingData = JSON.parse(product.variants_json || '{}'); } catch {}
                return (
                  <div key={product.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-20 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">🚗</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">{product.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {product.is_active ? 'Live' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{product.description || product.section}</p>
                      <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
                        {specs.seats && <span>🪑 {specs.seats} seats</span>}
                        {specs.fuel_type && <span>⛽ {specs.fuel_type.split(' / ')[0]}</span>}
                        {pricingData.km_rate && <span>🛣️ ₹{pricingData.km_rate}/km</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-extrabold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>
                        ₹{product.price?.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-gray-400">/day</div>
                    </div>
                    <button onClick={() => handleRemoveProduct(product.id)}
                      className="text-red-400 hover:text-red-600 text-xs font-semibold ml-2">Remove</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════ UPLOAD VIEW ═══════ */}
      {view === 'upload' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
          <div>
            <div className="text-base font-bold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>Bulk Upload via Excel</div>
            <p className="text-xs text-gray-500 mt-1">Download our template, fill in your vehicles, and upload to list them all at once.</p>
          </div>

          {/* Step 1: Download */}
          <div className="bg-amber-50 rounded-xl p-4">
            <div className="text-sm font-bold text-amber-800 mb-1">Step 1: Download Template</div>
            <p className="text-xs text-amber-700 mb-3">
              Template auto-generated for car rentals with the right columns: Vehicle Name, Type, Price/Day, KM Rate, Security Deposit, Services, etc.
            </p>
            <button onClick={handleDownloadTemplate}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition-colors">
              📥 Download Excel Template
            </button>
          </div>

          {/* Step 2: Upload */}
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="text-sm font-bold text-blue-800 mb-1">Step 2: Upload Filled Sheet</div>
            <p className="text-xs text-blue-700 mb-3">
              Fill in the template with your fleet details. Delete the example rows first. Upload the .xlsx file below.
            </p>
            <label className="inline-block px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-xl cursor-pointer transition-colors">
              {uploading ? 'Uploading...' : '📤 Upload Excel File'}
              <input type="file" accept=".xlsx,.xls" onChange={handleUploadExcel} className="hidden" disabled={uploading} />
            </label>
          </div>

          {/* Upload result */}
          {uploadResult && (
            <div className={`rounded-xl p-4 ${uploadResult.created > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              {uploadResult.created > 0 && (
                <div className="text-sm font-bold text-green-700">
                  ✅ {uploadResult.created} vehicle{uploadResult.created !== 1 ? 's' : ''} added to your fleet!
                </div>
              )}
              {uploadResult.errors?.length > 0 && (
                <div className="mt-2">
                  <div className="text-sm font-bold text-red-700">Issues found:</div>
                  {uploadResult.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-600 mt-0.5">• {err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════ ADD VEHICLE VIEW (5-step wizard) ═══════ */}
      {view === 'add' && (
        <>
          {/* Wizard header */}
          <div className="text-center mb-5">
            <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-600 text-[11px] font-semibold px-3 py-1.5 rounded-full mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />Quick listing — car rentals
            </div>
            <h2 className="text-xl font-extrabold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>
              List your vehicle in <span className="text-amber-500">3 minutes</span>
            </h2>
            <p className="text-sm text-gray-500 mt-1">We know most specs already. You just confirm and set your price.</p>
          </div>

          {/* Progress bar */}
          <div className="flex items-center mb-6">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex-1 flex flex-col items-center relative">
                {i < STEPS.length - 1 && (
                  <div className={`absolute top-3 left-[calc(50%+14px)] right-[calc(-50%+14px)] h-0.5 ${i < step ? 'bg-amber-500' : 'bg-gray-300'}`} />
                )}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold z-10 transition-all
                  ${i === step ? 'bg-amber-500 text-white ring-4 ring-amber-200' : i < step ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500'}`}>
                  {i < step ? '✓' : s.num}
                </div>
                <div className={`text-[10px] mt-1 font-medium ${i === step ? 'text-amber-600 font-semibold' : i < step ? 'text-green-600' : 'text-gray-400'}`}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Step content */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4">
            {step === 0 && (
              <>
                <div className="text-base font-bold text-gray-900 mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>What type of vehicle?</div>
                <div className="text-xs text-gray-500 mb-4">Pick your vehicle category — we pre-fill the right specs for each</div>
                <VehicleTypeSelector options={VEHICLE_OPTIONS} selected={selectedSegment}
                  onSelect={v => { setSelectedSegment(v); setSelectedMake(null); setSelectedModel(null); }} />
              </>
            )}
            {step === 1 && (
              <MakeModelPicker vehicles={masterVehicles} selectedSegment={selectedSegment}
                selectedMake={selectedMake} selectedModel={selectedModel}
                onSelectMake={m => { setSelectedMake(m); setSelectedModel(null); }}
                onSelectModel={setSelectedModel} />
            )}
            {step === 2 && (
              <SpecConfirmation vehicle={selectedModel} selectedVariant={selectedVariant} onSelectVariant={setSelectedVariant} />
            )}
            {step === 3 && (
              <CarPricingForm vehicle={selectedModel} pricing={pricing} onPricingChange={setPricing}
                services={services} onServicesChange={setServices} />
            )}
            {step === 4 && (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-green-100 mx-auto mb-4 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div className="text-xl font-extrabold text-gray-900 mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>Your vehicle is live!</div>
                <div className="text-sm text-gray-500 mb-5">Followers can see and pre-book now.</div>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>{selectedModel?.model || '—'}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">Vehicle</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>₹{pricing?.day_rate || '—'}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">Per day</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-lg font-bold text-green-600" style={{ fontFamily: 'Syne, sans-serif' }}>Live</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">Status</div>
                  </div>
                </div>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => { resetWizard(); }} className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl">
                    + List another vehicle
                  </button>
                  <button onClick={() => setView('fleet')} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-xl">
                    View My Fleet
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          {step < 4 && (
            <div className="flex items-center justify-between">
              {step > 0 ? (
                <button onClick={() => setStep(s => s - 1)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border-[1.5px] border-gray-200 hover:border-amber-500 hover:text-amber-600">← Back</button>
              ) : <div />}
              {step < 3 ? (
                <button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}
                  className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${canProceed() ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                  {step === 2 ? 'Set my price →' : 'Next →'}
                </button>
              ) : (
                <button onClick={handlePublish} disabled={!canProceed() || saving}
                  className={`px-8 py-3 rounded-xl text-sm font-semibold transition-all ${canProceed() && !saving ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                  {saving ? 'Publishing...' : 'Publish listing ✓'}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
