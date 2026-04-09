'use client';

/**
 * QualityScore — displays listing completeness score with breakdown.
 */

export default function QualityScore({ scoreData }) {
  if (!scoreData) return null;

  const { score, breakdown, suggestions } = scoreData;

  const getColor = (s) => {
    if (s >= 80) return { ring: 'text-green-500', bg: 'bg-green-50', label: 'Excellent' };
    if (s >= 60) return { ring: 'text-orange-500', bg: 'bg-orange-50', label: 'Good' };
    if (s >= 40) return { ring: 'text-yellow-500', bg: 'bg-yellow-50', label: 'Fair' };
    return { ring: 'text-red-400', bg: 'bg-red-50', label: 'Needs Work' };
  };

  const colors = getColor(score);

  return (
    <div className="bg-white border-2 border-gray-100 rounded-2xl p-5 space-y-4">
      {/* Score circle */}
      <div className="flex items-center gap-4">
        <div className={`w-16 h-16 rounded-full ${colors.bg} flex items-center justify-center`}>
          <span className={`text-2xl font-black ${colors.ring}`}>{score}</span>
        </div>
        <div>
          <div className="text-sm font-bold text-gray-800">Listing Quality</div>
          <div className={`text-xs font-semibold ${colors.ring}`}>{colors.label}</div>
          <div className="text-xs text-gray-400 mt-0.5">Higher score = better visibility to followers</div>
        </div>
      </div>

      {/* Breakdown */}
      {breakdown && breakdown.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Breakdown</div>
          {breakdown.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={item.earned ? 'text-green-500' : 'text-gray-300'}>
                {item.earned ? '✓' : '○'}
              </span>
              <span className={item.earned ? 'text-gray-700' : 'text-gray-400'}>{item.label}</span>
              <span className="ml-auto text-gray-400 font-medium">+{item.points}</span>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <div className="bg-orange-50 rounded-xl p-3 space-y-1">
          <div className="text-xs font-bold text-orange-700">💡 Suggestions</div>
          {suggestions.map((s, i) => (
            <p key={i} className="text-xs text-orange-600">• {s}</p>
          ))}
        </div>
      )}
    </div>
  );
}
