# Workflow prediction — parity pack (6 screens)

Mockup `parity-pack.html` shows all six panels at phone width. Predicted
flows: Home quick-action tap → screen loads via the listed GET on focus →
filters/tabs re-query → actions (confirm/reject booking, deliver meal order,
activate/archive/publish offer, connect payout) POST/PATCH then reload.
Plan-change and complex-offer creation deliberately exit to the web dashboard.
Meals tile hidden for non-restaurant brands; Meals screen itself also
self-gates. All money values displayed via fmtMoney (rupees).
