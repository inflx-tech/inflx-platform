# Before / after

**Before:** a creator's Create tab could show what a post CONTAINS
(slides, products) but nothing about how it PERFORMED. The like/save data
had been accumulating in post_likes / post_saves since migration 141 and
was never read back on the creator side — collected but invisible.

**After:** the same single call returns like_count + save_count per post.

**The honest boundary:** this is the half of 'post analytics' that real
data exists for. Views were requested but there is NO view counter in the
schema and no code writing one — verified by grep, not assumed. Rather
than ship a views field hardcoded to 0 (which would read as 'nobody
watched' rather than 'not measured'), views are left out and called out.

**Unconsumed by design:** no frontend reads these fields yet. Shipped this
way on purpose — the founder begins a manual end-to-end pass next, and a
backend-only additive change cannot pollute those findings.
