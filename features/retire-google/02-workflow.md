# retire-google — workflow

## Actor
A brand registering on the website; a follower opening the live app; the server.

## Steps
1. Website registration: name, business name, sub-categories, street, pincode, State (select), Nearest major city (select, locked until a state) → Create → 201; the brand's main branch carries the picked city.
2. Website profile: the main-branch address shows the four parts pre-filled from the main branch; saving sends them; the branch updates.
3. Follower app cold start (GPS allowed): `GET /follower/reverse-geocode` answers "Vijayawada" for a Vijayawada coordinate, from our list.
4. Any client calling `/follower/places/*`, `/follower/geocode`, `/places/resolve` or `/internal/geocode-*` gets 404.

## Success definition
No module under `backend/src` requires a Google service or reads a Google key; the three
service/controller files are gone; the website builds and its auth spec passes; the
`retire-google` suite is green; full backend run shows no new failures.

## Build order
1. Server: `referenceLists.nearestCity` / `cityCentreForName`; follower controller and routes; index routes; delete the three files; test helpers lose the Google mock.
2. `backend/tests/retire-google.test.js`.
3. Website: login page, profile page, listing field, `lib/api.js`.
4. Deploy on the founder's go: commit → push (Render + Vercel). No migration, no OTA. Then the founder removes the two keys from Render.
