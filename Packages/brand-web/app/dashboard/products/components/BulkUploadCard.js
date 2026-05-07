'use client';

/**
 * BulkUploadCard — shared Excel upload UI.
 *
 * Two callers (PR-2):
 *   1. ListingTemplateLayout's Upload tab (the layout-level path, used by
 *      salon, car_rental, and any future template that doesn't handle bulk
 *      internally in its wizard).
 *   2. RestaurantDishPicker's Bulk path (restaurant's wizard handles the
 *      path choice inside step 4 — the layout-tab Upload is hidden for
 *      restaurant via tmpl.hideUploadTab=true).
 *
 * Pure UI — caller owns the upload handlers and result state. Two-step
 * pattern (Download Template → Upload Filled Sheet). Result banner renders
 * in green when created>0, red when errors[] populated.
 *
 * Props:
 *   - labelPlural:  string — used in the description copy ("upload your menu/services/fleet")
 *   - uploading:    boolean — disables the file input and changes button label
 *   - uploadResult: { created?, errors? } | null — result banner data
 *   - onDownload:   () => void — fires when "Download Excel Template" tapped
 *   - onUpload:     (e) => void — fires on file input change; e.target.files[0] is the file
 */

export default function BulkUploadCard({ labelPlural, uploading, uploadResult, onDownload, onUpload }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
      <div>
        <div className="text-base font-bold text-gray-900">Bulk Upload via Excel</div>
        <p className="text-xs text-gray-500 mt-1">
          Download our template, fill in your {labelPlural.toLowerCase()}, and upload to list them at once.
        </p>
      </div>

      <div className="bg-orange-50 rounded-xl p-4">
        <div className="text-sm font-bold text-orange-800 mb-1">Step 1: Download Template</div>
        <p className="text-xs text-orange-700 mb-3">
          Auto-generated for your category with the right columns.
        </p>
        <button onClick={onDownload}
          className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-colors">
          📥 Download Excel Template
        </button>
      </div>

      <div className="bg-blue-50 rounded-xl p-4">
        <div className="text-sm font-bold text-blue-800 mb-1">Step 2: Upload Filled Sheet</div>
        <p className="text-xs text-blue-700 mb-3">
          Fill in the template. Delete the example rows first. Upload the .xlsx file below.
        </p>
        <label className="inline-block px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-xl cursor-pointer transition-colors">
          {uploading ? 'Uploading...' : '📤 Upload Excel File'}
          <input type="file" accept=".xlsx,.xls" onChange={onUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      {uploadResult && (
        <div className={`rounded-xl p-4 ${uploadResult.created > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          {uploadResult.created > 0 && (
            <div className="text-sm font-bold text-green-700">
              ✅ {uploadResult.created} item{uploadResult.created !== 1 ? 's' : ''} added!
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
  );
}
