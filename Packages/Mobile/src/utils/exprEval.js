'use strict';

/**
 * exprEval — minimal expression evaluator for visible_if / highlight_if rules.
 *
 * Per contracts-v1.3 §6.5 + chat handoff: shared evaluator covering both
 * BrandStoreScreen.visible_if (e.g. "brand_data.accepts_table_booking == true")
 * and BuyerCard.tags[].highlight_if (e.g. "value == 'Veg'", "value >= 7").
 *
 * Lives in shared (not mobile-only) because both mobile and brand-web
 * (wizard preview) need it. 40 LOC, no dependencies.
 *
 * Grammar:
 *   <expr>     := <path> <op> <literal_or_path>     // comparison
 *               | <path>                             // truthiness check
 *   <op>       := == | != | >= | <= | > | <
 *   <literal>  := <number> | <quoted_string> | true | false | null
 *   <path>     := dotted lookup against context (e.g. brand_data.foo)
 *
 * Returns boolean. Returns false on malformed input — callers MUST treat
 * false as "do not match / do not highlight" so a typo never silently
 * produces a positive match. Unknown operators short-circuit to false.
 *
 * Equality uses == / != intentionally (loose) so "5" == 5 matches — values
 * arrive from JSON where number-vs-string is sometimes ambiguous.
 */

export function evalExpr(expr, context) {
  if (typeof expr !== 'string' || expr.trim() === '') return false;
  const trimmed = expr.trim();

  // <path> <op> <rhs>
  const match = trimmed.match(/^(\S+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (!match) {
    // Bare path → truthiness check
    return Boolean(resolvePath(context, trimmed));
  }

  const [, lhsPath, op, rhsRaw] = match;
  const lhs = resolvePath(context, lhsPath);
  const rhs = parseRhs(rhsRaw.trim(), context);

  // eslint-disable-next-line eqeqeq
  switch (op) {
    case '==': return lhs == rhs;
    case '!=': return lhs != rhs;
    case '>=': return lhs >= rhs;
    case '<=': return lhs <= rhs;
    case '>':  return lhs >  rhs;
    case '<':  return lhs <  rhs;
    default:   return false;
  }
}

function resolvePath(obj, path) {
  if (obj == null || !path) return undefined;
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

function parseRhs(s, context) {
  if (s === 'true')  return true;
  if (s === 'false') return false;
  if (s === 'null')  return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (/^'[^']*'$/.test(s) || /^"[^"]*"$/.test(s)) return s.slice(1, -1);
  // Otherwise treat as a path against the same context (rare; supports
  // expressions like "value == other_value" within a single tag context).
  return resolvePath(context, s);
}
