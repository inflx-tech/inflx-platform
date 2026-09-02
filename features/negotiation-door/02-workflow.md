# Workflow — the negotiation door

## The workflow this completes

**A creator is invited, does not accept the money, and says what she would want instead.**

### Before

1. Brand invites her into a set at ₹5,000.
2. She opens the invitation. Three actions offered: accept, decline, negotiate.
3. She taps **Negotiate**.
4. She reaches a screen saying *"tap Negotiate on an offer to start a conversation."*
5. **Dead end.** Her only real options were accept or decline.

### After

1. Brand invites her at ₹5,000.
2. She taps **Negotiate**.
3. She gets a form asking what she wants — a fee, a commission, or both, **depending on
   what kind of collaboration it is** — plus an optional note.
4. She sends it. The brand is notified and can accept, counter, or step away.
5. The existing thread view takes over from there, as it always did.

## The end state

- A creator can counter an offer from her phone.
- The brand's reply notification opens the conversation.
- The "contract ready to sign" notification opens the contract.
- She can sign.

## Where it can go wrong

| Risk | How it is handled |
|---|---|
| Asking a commission-only creator for a fee | The collaboration's goal is passed through from the collab screen, because before a thread exists there is nothing to read it from. Covered by a test. |
| A style or token that does not exist | The form reuses the *same* controls as the counter form below it. Every style name and palette token verified to exist before commit. |
| The server refusing for a real reason | It refuses when terms were already settled, when the brand fixed them, or when a thread exists. Its message is written for her and is shown, not replaced. Covered by a test. |
| An old notification going dead | Type matching is kept as a fallback and accepts both naming conventions. |
