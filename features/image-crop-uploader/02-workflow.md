# Workflow — image-crop-uploader

## Banner (App Builder)
1. Admin adds a Full-width banner → My images → picks a file.
2. Crop modal opens at 3:2, photo auto-centred. Looks good → "Use this crop".
   Something clipped → drag/zoom, then "Use this crop".
3. The cropped JPEG uploads (section presign) → tile + preview show it.

## Product photo (dashboard listing)
4. Add product → Photos → picks 1+ files.
5. Each file opens the crop modal at 4:5 in turn; admin confirms/adjusts each.
6. Cropped photos upload to the gallery and appear in the cover/variant list.

## Skip
7. "Cancel" on a queued photo skips just that one and advances to the next.
