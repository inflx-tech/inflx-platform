'use client';

/**
 * QualityScore — completeness score with SVG ring, tier badge, and a
 * "Path to next tier" checklist.
 *
 * Reads:
 *   - scoreData.score        — 0–100 from /brands/me/quality-score
 *   - scoreData.breakdown[]  — [{ label, points, earned }]
 *   - scoreData.suggestions  — free-form tips (optional)
 *   - template.quality_tiers — [{ key, min_points, label, color }]
 *
 * Tier resolution: pick the highest tier whose min_points <= score.
 * Below the lowest tier, fall back to a generic "Starting out" pill.
 */

const RING_SIZE = 96;
const RING_STROKE = 8;
const RADIUS = (RING_SIZE - RING_STROKE) / 2;
const CIRC   = 2 * Math.PI * RADIUS;

export default function QualityScore({ scoreData, template }) {
  if (!scoreData) return null;

  const score      = Math.max(0, Math.min(100, Number(scoreData.score) || 0));
  const breakdown  = Array.isArray(scoreData.breakdown) ? scoreData.breakdown : [];
  const tiers      = Array.isArray(template?.quality_tiers) ? template.quality_tiers : DEFAULT_TIERS;

  const sorted     = [...tiers].sort((a, b) => a.min_points - b.min_points);
  const earned     = [...sorted].reverse().find(t => score >= (t.min_points || 0));
  const next       = sorted.find(t => (t.min_points || 0) > score);

  const ringColor  = earned?.color || '#8C959F';
  const ringDash   = CIRC * (score / 100);
  const dashArray  = `${ringDash} ${CIRC - ringDash}`;

  const pointsToNext = next ? Math.max(0, (next.min_points || 0) - score) : 0;
  const missing      = breakdown.filter(b => !b.earned);

  return (
    <div className="bg-paper border border-line-soft rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center gap-4">
        {/* SVG ring */}
        <div className="relative flex-shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
          <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
            <circle
              cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
              stroke="#DEE2E6" strokeWidth={RING_STROKE} fill="none"
            />
            <circle
              cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
              stroke={ringColor} strokeWidth={RING_STROKE} fill="none"
              strokeDasharray={dashArray} strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-display text-[28px] leading-none font-extrabold text-ink-1">{score}</div>
            <div className="font-mono text-[8px] uppercase tracking-wider text-ink-3 mt-0.5">/ 100</div>
          </div>
        </div>

        {/* Tier badge + headline */}
        <div className="flex-1 min-w-0">
          <div className="font-display text-sm font-bold text-ink-1">Listing Quality</div>
          {earned ? (
            <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full font-mono text-[10px] uppercase tracking-wider font-bold"
              style={{ backgroundColor: hexAlpha(earned.color, 0.15), color: earned.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: earned.color }} />
              {earned.label}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full font-mono text-[10px] uppercase tracking-wider font-bold bg-paper-deep text-ink-2">
              <span className="w-1.5 h-1.5 rounded-full bg-ink-3" />
              Starting out
            </span>
          )}
          {next && (
            <p className="text-xs text-ink-3 mt-1.5">
              <span className="font-mono text-ink-2">+{pointsToNext} pts</span> to {next.label}
            </p>
          )}
          {!next && (
            <p className="text-xs text-teal-deep mt-1.5">Top tier reached 🎉</p>
          )}
        </div>
      </div>

      {/* Path to next tier checklist */}
      {next && missing.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="font-mono text-[10px] uppercase tracking-wider font-bold text-ink-3">
            Path to {next.label}
          </div>
          {missing.slice(0, 6).map((b, i) => (
            <div key={i} className="flex items-center gap-2 text-xs bg-paper-surface rounded-lg px-2.5 py-1.5 border border-paper-deep">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-line-soft flex-shrink-0" />
              <span className="text-ink-2 flex-1 truncate">{b.label}</span>
              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-pale text-yellow-deep flex-shrink-0">
                +{b.points}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Earned breakdown (collapsed view — last 3 wins) */}
      {breakdown.filter(b => b.earned).length > 0 && (
        <details className="pt-1">
          <summary className="font-mono text-[10px] uppercase tracking-wider font-bold text-ink-3 cursor-pointer hover:text-ink-2">
            ✓ {breakdown.filter(b => b.earned).length} criteria earned
          </summary>
          <div className="space-y-1.5 mt-2">
            {breakdown.filter(b => b.earned).map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-teal">✓</span>
                <span className="text-ink-2 flex-1 truncate">{b.label}</span>
                <span className="font-mono text-[10px] font-bold text-teal-deep">+{b.points}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// Default tier ladder — used when template.quality_tiers isn't present
// (e.g. older category schemas that haven't been migrated yet).
const DEFAULT_TIERS = [
  { key: 'bronze',   min_points: 40, label: 'Bronze',   color: '#CD7F32' },
  { key: 'silver',   min_points: 60, label: 'Silver',   color: '#A8A29E' },
  { key: 'gold',     min_points: 80, label: 'Gold',     color: '#FFB800' },
  { key: 'platinum', min_points: 95, label: 'Platinum', color: '#EAB308' },
];

// hex like "#EAB308" → "rgba(234,179,8,0.15)" for tinted backgrounds.
function hexAlpha(hex, alpha) {
  const clean = (hex || '#000000').replace('#', '');
  const bigint = parseInt(clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
