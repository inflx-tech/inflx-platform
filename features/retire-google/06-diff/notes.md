# retire-google — before/after notes

**Before (server):** two Google services (Places, Geocoding) behind seven routes; the website's
registration and profile pages, the restaurant listing wizard and the follower app's location
sheet called them; a Google key in Render's environment.

**After (server):** the two services and their controller deleted; the seven routes gone; the
one route the live follower app calls (`/follower/reverse-geocode`) answers from our own city
coordinates (`referenceLists.nearestCity`); follower home sections and stored location use the
same; a follower address typed without a pin takes the typed city's centre
(`cityCentreForName`) instead of a Google lookup. The reference service no longer adds cities at
runtime. Test helpers lose the Google mock.

**After (website, W1/W2):** registration takes street, pincode, State and Nearest major city
from the offered list and sends ids; the search / Maps-link / manual pills, the search box, the
Maps-link box, coordinate capture and the referral box are gone. The profile's main-branch
address is the same four parts, pre-filled from the main branch, saved through `PATCH /brands/me`.
The listing wizard's Maps-link field renders as a plain text box.

_Website details from the build report — see the build summary in `lock.json`._
