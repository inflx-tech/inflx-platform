'use client';
import { useState, useEffect } from 'react';
import { brandApi } from '../../../../../lib/api';
import VehicleTypeSelector from './VehicleTypeSelector';
import MakeModelPicker from './MakeModelPicker';
import SpecConfirmation from './SpecConfirmation';
import CarPricingForm from './CarPricingForm';

/**
 * CarRentalWizard — 5-step listing wizard matching the HTML mockup exactly.
 *
 * Step 1: Vehicle type (Hatchback/Sedan/SUV/MPV/Luxury/Tempo)
 * Step 2: Make → Model (from master_vehicles DB)
 * Step 3: Confirm specs (auto-filled)
 * Step 4: Pricing + services + photos
 * Step 5: Done / Published
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
  const [step, setStep] = useState(0);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [selectedMake, setSelectedMake] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [pricing, setPricing] = useState({ day_rate: null, km_rate: null, security_deposit: 5000, extra_km_charge: 12 });
  const [services, setServices] = useState([]);

  // Load master vehicles
  useEffect(() => {
    async function load() {
      try {
        const res = await brandApi.get('/brands/me/master-catalogue');
        if (res.success && res.data?.items) {
          setVehicles(res.data.items);
        }
      } catch (e) {
        console.error('Failed to load vehicles:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Auto-set services when model is selected
  useEffect(() => {
    if (selectedModel?.services_json) {
      setServices(selectedModel.services_json);
    }
  }, [selectedModel]);

  function canProceed() {
    if (step === 0) return !!selectedSegment;
    if (step === 1) return !!selectedModel;
    if (step === 2) return true; // specs auto-filled
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
          day_rate: pricing.day_rate,
          km_rate: pricing.km_rate,
          security_deposit: pricing.security_deposit,
          extra_km_charge: pricing.extra_km_charge,
          variant: selectedVariant,
          services: services,
          specs: {
            seats: selectedModel.seats,
            fuel_type: selectedModel.fuel_type,
            engine_cc: selectedModel.engine_cc,
            transmission: selectedModel.transmission,
            kmpl: selectedModel.kmpl,
            ac: selectedModel.ac,
            sunroof: selectedModel.sunroof,
            features: selectedModel.features_json || [],
          },
        }),
      };

      const res = await brandApi.createProduct(payload);
      if (res.success) {
        setStep(4); // done step
      } else {
        alert(res.error?.message || 'Failed to create listing');
      }
    } catch (e) {
      alert('Failed to create listing: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  function resetWizard() {
    setStep(0);
    setSelectedSegment(null);
    setSelectedMake(null);
    setSelectedModel(null);
    setSelectedVariant(null);
    setPricing({ day_rate: null, km_rate: null, security_deposit: 5000, extra_km_charge: 12 });
    setServices([]);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="max-w-[680px] mx-auto">
      {/* Header */}
      <div className="text-center mb-7">
        <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-600 text-[11px] font-semibold px-3 py-1.5 rounded-full mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Quick listing — car rentals
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>
          List your vehicle in <span className="text-amber-500">3 minutes</span>
        </h1>
        <p className="text-sm text-gray-500 mt-1.5">We know most specs already. You just confirm and set your price.</p>
      </div>

      {/* Progress bar */}
      <div className="flex items-center mb-6">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex-1 flex flex-col items-center relative">
            {i < STEPS.length - 1 && (
              <div className={`absolute top-3 left-[calc(50%+14px)] right-[calc(-50%+14px)] h-0.5 ${i < step ? 'bg-amber-500' : 'bg-gray-300'}`} />
            )}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold z-10 transition-all
              ${i === step ? 'bg-amber-500 text-white ring-4 ring-amber-200' :
                i < step ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500'}`}>
              {i < step ? '✓' : s.num}
            </div>
            <div className={`text-[10px] mt-1 font-medium ${i === step ? 'text-amber-600 font-semibold' : i < step ? 'text-green-600' : 'text-gray-400'}`}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4">
        {step === 0 && (
          <>
            <div className="text-base font-bold text-gray-900 mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>What type of vehicle?</div>
            <div className="text-xs text-gray-500 mb-4">Pick your vehicle category — we pre-fill the right specs for each</div>
            <VehicleTypeSelector
              options={VEHICLE_OPTIONS}
              selected={selectedSegment}
              onSelect={v => { setSelectedSegment(v); setSelectedMake(null); setSelectedModel(null); }}
            />
          </>
        )}

        {step === 1 && (
          <MakeModelPicker
            vehicles={vehicles}
            selectedSegment={selectedSegment}
            selectedMake={selectedMake}
            selectedModel={selectedModel}
            onSelectMake={m => { setSelectedMake(m); setSelectedModel(null); }}
            onSelectModel={setSelectedModel}
          />
        )}

        {step === 2 && (
          <SpecConfirmation
            vehicle={selectedModel}
            selectedVariant={selectedVariant}
            onSelectVariant={setSelectedVariant}
          />
        )}

        {step === 3 && (
          <CarPricingForm
            vehicle={selectedModel}
            pricing={pricing}
            onPricingChange={setPricing}
            services={services}
            onServicesChange={setServices}
          />
        )}

        {step === 4 && (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-green-100 mx-auto mb-4 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div className="text-xl font-extrabold text-gray-900 mb-1.5" style={{ fontFamily: 'Syne, sans-serif' }}>Your vehicle is live!</div>
            <div className="text-sm text-gray-500 mb-5">Listing created in under 3 minutes. Followers can see and pre-book now.</div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>{selectedModel?.model || '—'}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Vehicle listed</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>₹{pricing?.day_rate || '—'}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Daily rate</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-lg font-bold text-green-600" style={{ fontFamily: 'Syne, sans-serif' }}>Live</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Status</div>
              </div>
            </div>

            {/* Boost tips */}
            <div className="bg-amber-50 rounded-xl p-3 text-left mb-5">
              <div className="text-[11px] font-semibold text-amber-600 mb-1.5">Boost your listing</div>
              <div className="text-xs text-amber-800 leading-relaxed">
                Add 3 more photos to reach Standard ranking · Upload vehicle RC to get verified badge · Set outstation rates to unlock 3 more booking types
              </div>
            </div>

            <button onClick={resetWizard} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition-colors">
              List another vehicle +
            </button>
          </div>
        )}
      </div>

      {/* Navigation footer */}
      {step < 4 && (
        <div className="flex items-center justify-between">
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border-[1.5px] border-gray-200 hover:border-amber-500 hover:text-amber-600 transition-all">
              ← Back
            </button>
          ) : (
            <div className="text-xs text-gray-400">Select to continue</div>
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all
                ${canProceed() ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
              {step === 2 ? 'Set my price →' : 'Next →'}
            </button>
          ) : (
            <button
              onClick={handlePublish}
              disabled={!canProceed() || saving}
              className={`px-8 py-3 rounded-xl text-sm font-semibold transition-all
                ${canProceed() && !saving ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
              {saving ? 'Publishing...' : 'Publish listing ✓'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
