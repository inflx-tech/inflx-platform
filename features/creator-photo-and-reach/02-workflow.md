# Workflow

## She adds a photo

1. Creator opens **My Profile**. The tile shows her initials and **Add photo** beneath it.
2. She taps it and picks an image. Cancelling changes nothing.
3. The tile shows a spinner while it uploads.
4. It comes back as her photo, labelled **Change photo**.
5. She appears with that photo everywhere a brand sees her — search results, the Talking
   list, her profile page.

## She replaces or removes it

* Tapping again and choosing a new image replaces it. The stored key carries a timestamp,
  so the phone cannot serve the old one from its cache.
* Clearing it returns her to initials. A creator must be able to remove a picture of
  herself, so an empty value is a deliberate instruction, not a no-op.

## A brand looks at her

1. Brand taps a creator anywhere.
2. Above the existing stats: **INFLX · Instagram · YouTube**, three tiles.
3. INFLX is bordered and first. If nobody follows her here it reads **0 · no followers yet** —
   true, and more useful than hiding the row.
4. YouTube reads **— · not connected**, or **not counted yet** if she gave a handle.

## Failure paths

* Upload link refused (wrong file type) → *"Choose a JPEG, PNG or WebP photo."* Nothing changes.
* File uploads but saving the key fails → *"Uploaded, but could not save it."* She stays on
  initials rather than being told it worked. An uploaded file nobody recorded is a file
  nobody can find.
* Presigned link expired on read → the tile falls back to initials, never a broken image.

## Expected end state

* A picture of a creator on this platform came from her and nowhere else.
* A brand can tell her buying audience from her watching audience at a glance.
