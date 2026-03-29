'use client';

import { useState, useRef } from 'react';
import { adminApi } from '../../../lib/api';

const SAMPLE_CSV = `full_name,phone,instagram_handle,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language
Priya Sharma,+919000000001,priyacooks,micro,180000,6.2,Food,Lifestyle,Vijayawada,Andhra Pradesh,female,Instagram,22000,11160,890,true,Telugu;English
Arun Mehta,+919000000002,arunfashion,macro,240000,4.8,Fashion,Lifestyle,Mumbai,Maharashtra,male,Instagram,35000,11520,650,true,Hindi;English`;

function DownloadSampleBtn() {
  function download() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'influencer_upload_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button
      onClick={download}
      className="text-xs text-orange border border-orange/30 rounded-lg px-3 py-1.5 hover:bg-orange/10 transition-colors"
    >
      Download template CSV
    </button>
  );
}

export default function InfluencersPage() {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function handleFile(f) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError('Only CSV files are supported.');
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const res = await adminApi.bulkUploadInfluencers(file);
    setLoading(false);
    if (!res.success) {
      setError(res.error?.message || 'Upload failed');
    } else {
      setResult(res.data);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Influencers</h1>
          <p className="text-xs text-t3 mt-0.5">Bulk upload influencer profiles via CSV</p>
        </div>
        <DownloadSampleBtn />
      </div>

      {/* Column reference */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-t2 uppercase tracking-wider">CSV Column Reference</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-t3">
          {[
            ['full_name *', 'Display name'],
            ['phone *', 'E.164 format e.g. +919999999999'],
            ['instagram_handle *', 'Handle without @'],
            ['tier', 'nano / micro / macro / mega'],
            ['followers_count', 'Integer'],
            ['engagement_rate', 'Float e.g. 6.2'],
            ['niche', 'Comma-separated e.g. Food,Travel'],
            ['secondary_niche', 'Comma-separated'],
            ['city', 'City name'],
            ['state', 'State name'],
            ['gender', 'male / female / other'],
            ['platform', 'Instagram / YouTube / Both'],
            ['avg_views', 'Integer'],
            ['avg_likes', 'Integer'],
            ['avg_comments', 'Integer'],
            ['verified', 'true / false'],
            ['language', 'Comma-separated e.g. Hindi,English'],
          ].map(([col, desc]) => (
            <div key={col} className="flex gap-2">
              <span className="font-mono text-orange shrink-0">{col}</span>
              <span className="truncate">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          dragging ? 'border-orange bg-orange/5' : 'border-border hover:border-orange/50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
        <div className="text-3xl mb-2">📄</div>
        {file ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-t1">{file.name}</p>
            <p className="text-xs text-t3">{(file.size / 1024).toFixed(1)} KB — click to replace</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium text-t2">Drop CSV here or click to browse</p>
            <p className="text-xs text-t3">Max 5 MB · CSV only</p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Upload button */}
      {file && (
        <button
          onClick={handleUpload}
          disabled={loading}
          className="w-full bg-orange text-white rounded-xl py-3 text-sm font-semibold hover:bg-orange/90 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Uploading…' : `Upload ${file.name}`}
        </button>
      )}

      {/* Result */}
      {result && (
        <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-t1">Upload complete</p>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total rows', value: result.total, color: 'text-t1' },
              { label: 'Created', value: result.created, color: 'text-green-400' },
              { label: 'Updated', value: result.updated, color: 'text-blue-400' },
              { label: 'Failed', value: result.failed, color: result.failed > 0 ? 'text-red-400' : 'text-t3' },
            ].map((s) => (
              <div key={s.label} className="bg-bg rounded-lg p-3 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-t3 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {result.errors && result.errors.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-t2 uppercase tracking-wider">Row errors</p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {result.errors.map((e, i) => (
                  <div key={i} className="flex gap-2 text-xs bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
                    <span className="text-red-400 font-mono shrink-0">Row {e.row}</span>
                    {e.phone && <span className="text-t3 shrink-0">{e.phone}</span>}
                    <span className="text-red-300">{e.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tip */}
      <div className="bg-orange/5 border border-orange/20 rounded-xl p-4 text-xs text-orange-deep">
        💡 Existing influencers (matched by phone) will be updated, not duplicated. New influencers are auto-approved and immediately available in campaign search.
      </div>
    </div>
  );
}
