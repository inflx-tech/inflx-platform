# Workflow Definition — "Done" on a post that is with INFLX

## Actor
A creator, signed in and approved, in the INFLX Creator app.

## Preconditions
A collaboration she can post for; a draft post ready on the Review step.

## Workflow steps (user-observable)
1. On Review she taps "Send to INFLX for review" → "With INFLX" opens: the post's title, "In review
   since {day}", "Who checks it", "Goes live", and at the bottom one yellow button, **Done**.
2. She taps **Done** → the Home tab is in front, with its bottom tabs.
3. She taps the Create tab → its main page (her posts), not "With INFLX" and not a builder step.
4. Later she opens the same post from her posts list → "With INFLX" with the same **Done** button;
   the back arrow goes back to the list.
5. A post that is sent back, approved, live or removed → no "Done" button; its own buttons as today.

## Success definition
From "With INFLX", one tap reaches Home, and no builder step is left waiting behind the Create tab.

## Failure / edge workflows
- "With INFLX" opened with no screen under it → Done opens Home; nothing else is attempted.
- The back arrow → one screen back, unchanged.
