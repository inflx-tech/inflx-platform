-- 188_registration_and_profile.sql
-- Contract: features/registration-and-profile (spec locked 18 Sep 2026, mockups locked 18 Sep 2026)
--
-- The lists: six southern states and their 146 district headquarters are the only rows OFFERED
-- in any picker (spec §1.2, §1.4). Nothing already in ref_states / ref_cities is deleted — rows
-- outside the six keep resolving so existing accounts keep showing their city. Expansion later
-- is a flag flip. Source: backend/seeds/south_cities_draft.csv (146 rows) and
-- backend/seeds/languages_draft.csv (30 rows, Sanskrit deliberately absent) — both approved by
-- the founder on 18 Sep 2026. Transcribed by a script from the CSVs, exactly as 168 and 170 were.
--
-- The profile: creator state, email, the 'Other' niche description, and when each account was
-- submitted for review; brand email, an encrypted bank account (one entry with its IFSC), and
-- the same submitted-at. Existing pending accounts are treated as submitted at registration so
-- the admin queue does not empty on deploy.

BEGIN;

-- ── 1. Offered flags ──────────────────────────────────────────────────────────
ALTER TABLE ref_states ADD COLUMN IF NOT EXISTS is_offered boolean NOT NULL DEFAULT false;
ALTER TABLE ref_cities ADD COLUMN IF NOT EXISTS is_offered boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN ref_states.is_offered IS 'Offered in the state picker (registration-and-profile §1.4). Unoffered rows stay valid for matching and display.';
COMMENT ON COLUMN ref_cities.is_offered IS 'Offered in the city picker under an offered state. Exactly the district headquarters from south_cities_draft.csv.';

UPDATE ref_states s SET is_offered = true, sort = v.sort
  FROM (VALUES ('Andhra Pradesh', 1), ('Telangana', 2), ('Karnataka', 3), ('Tamil Nadu', 4), ('Kerala', 5), ('Puducherry', 6)) AS v(name, sort)
 WHERE s.name = v.name;

-- The one spelling that differs between the 2026-09 seed and the founder's list: the East Godavari
-- headquarters. Renamed rather than duplicated so an account already on it keeps its row.
UPDATE ref_cities c SET name = 'Rajamahendravaram', name_norm = 'rajamahendravaram'
  FROM ref_states s
 WHERE s.id = c.state_id AND s.name = 'Andhra Pradesh' AND c.name_norm = 'rajahmundry'
   AND NOT EXISTS (SELECT 1 FROM ref_cities x WHERE x.state_id = c.state_id AND x.name_norm = 'rajamahendravaram');

-- ── 2. The 146 cities ─────────────────────────────────────────────────────────
INSERT INTO ref_cities (state_id, name, name_norm, sort, source, is_offered)
SELECT s.id, v.city, lower(trim(v.city)), v.sort, 'seed', true
FROM (VALUES
  ('Andhra Pradesh', 'Visakhapatnam', 1),
  ('Andhra Pradesh', 'Vijayawada', 2),
  ('Andhra Pradesh', 'Guntur', 3),
  ('Andhra Pradesh', 'Nellore', 4),
  ('Andhra Pradesh', 'Tirupati', 5),
  ('Andhra Pradesh', 'Kurnool', 6),
  ('Andhra Pradesh', 'Rajamahendravaram', 7),
  ('Andhra Pradesh', 'Kakinada', 8),
  ('Andhra Pradesh', 'Kadapa', 9),
  ('Andhra Pradesh', 'Anantapur', 10),
  ('Andhra Pradesh', 'Ongole', 11),
  ('Andhra Pradesh', 'Anakapalli', 12),
  ('Andhra Pradesh', 'Paderu', 13),
  ('Andhra Pradesh', 'Rayachoti', 14),
  ('Andhra Pradesh', 'Bapatla', 15),
  ('Andhra Pradesh', 'Chittoor', 16),
  ('Andhra Pradesh', 'Amalapuram', 17),
  ('Andhra Pradesh', 'Eluru', 18),
  ('Andhra Pradesh', 'Machilipatnam', 19),
  ('Andhra Pradesh', 'Nandyal', 20),
  ('Andhra Pradesh', 'Narasaraopet', 21),
  ('Andhra Pradesh', 'Parvathipuram', 22),
  ('Andhra Pradesh', 'Puttaparthi', 23),
  ('Andhra Pradesh', 'Srikakulam', 24),
  ('Andhra Pradesh', 'Vizianagaram', 25),
  ('Andhra Pradesh', 'Bhimavaram', 26),
  ('Telangana', 'Hyderabad', 1),
  ('Telangana', 'Warangal', 2),
  ('Telangana', 'Karimnagar', 3),
  ('Telangana', 'Nizamabad', 4),
  ('Telangana', 'Khammam', 5),
  ('Telangana', 'Mahbubnagar', 6),
  ('Telangana', 'Hanumakonda', 7),
  ('Telangana', 'Medchal', 8),
  ('Telangana', 'Sangareddy', 9),
  ('Telangana', 'Siddipet', 10),
  ('Telangana', 'Nalgonda', 11),
  ('Telangana', 'Suryapet', 12),
  ('Telangana', 'Adilabad', 13),
  ('Telangana', 'Kothagudem', 14),
  ('Telangana', 'Jagtial', 15),
  ('Telangana', 'Jangaon', 16),
  ('Telangana', 'Bhupalpally', 17),
  ('Telangana', 'Gadwal', 18),
  ('Telangana', 'Kamareddy', 19),
  ('Telangana', 'Asifabad', 20),
  ('Telangana', 'Mahabubabad', 21),
  ('Telangana', 'Mancherial', 22),
  ('Telangana', 'Medak', 23),
  ('Telangana', 'Mulugu', 24),
  ('Telangana', 'Nagarkurnool', 25),
  ('Telangana', 'Narayanpet', 26),
  ('Telangana', 'Nirmal', 27),
  ('Telangana', 'Peddapalli', 28),
  ('Telangana', 'Sircilla', 29),
  ('Telangana', 'Shamshabad', 30),
  ('Telangana', 'Vikarabad', 31),
  ('Telangana', 'Wanaparthy', 32),
  ('Telangana', 'Bhongir', 33),
  ('Karnataka', 'Bengaluru', 1),
  ('Karnataka', 'Mysuru', 2),
  ('Karnataka', 'Mangaluru', 3),
  ('Karnataka', 'Hubballi', 4),
  ('Karnataka', 'Belagavi', 5),
  ('Karnataka', 'Kalaburagi', 6),
  ('Karnataka', 'Davanagere', 7),
  ('Karnataka', 'Ballari', 8),
  ('Karnataka', 'Vijayapura', 9),
  ('Karnataka', 'Shivamogga', 10),
  ('Karnataka', 'Tumakuru', 11),
  ('Karnataka', 'Udupi', 12),
  ('Karnataka', 'Bagalkot', 13),
  ('Karnataka', 'Bidar', 14),
  ('Karnataka', 'Chamarajanagar', 15),
  ('Karnataka', 'Chikkaballapur', 16),
  ('Karnataka', 'Chikkamagaluru', 17),
  ('Karnataka', 'Chitradurga', 18),
  ('Karnataka', 'Gadag', 19),
  ('Karnataka', 'Hassan', 20),
  ('Karnataka', 'Haveri', 21),
  ('Karnataka', 'Madikeri', 22),
  ('Karnataka', 'Kolar', 23),
  ('Karnataka', 'Koppal', 24),
  ('Karnataka', 'Mandya', 25),
  ('Karnataka', 'Raichur', 26),
  ('Karnataka', 'Ramanagara', 27),
  ('Karnataka', 'Karwar', 28),
  ('Karnataka', 'Hosapete', 29),
  ('Karnataka', 'Yadgir', 30),
  ('Karnataka', 'Devanahalli', 31),
  ('Tamil Nadu', 'Chennai', 1),
  ('Tamil Nadu', 'Coimbatore', 2),
  ('Tamil Nadu', 'Madurai', 3),
  ('Tamil Nadu', 'Tiruchirappalli', 4),
  ('Tamil Nadu', 'Salem', 5),
  ('Tamil Nadu', 'Tiruppur', 6),
  ('Tamil Nadu', 'Erode', 7),
  ('Tamil Nadu', 'Vellore', 8),
  ('Tamil Nadu', 'Thoothukudi', 9),
  ('Tamil Nadu', 'Tirunelveli', 10),
  ('Tamil Nadu', 'Thanjavur', 11),
  ('Tamil Nadu', 'Dindigul', 12),
  ('Tamil Nadu', 'Kancheepuram', 13),
  ('Tamil Nadu', 'Chengalpattu', 14),
  ('Tamil Nadu', 'Tiruvallur', 15),
  ('Tamil Nadu', 'Ariyalur', 16),
  ('Tamil Nadu', 'Cuddalore', 17),
  ('Tamil Nadu', 'Dharmapuri', 18),
  ('Tamil Nadu', 'Kallakurichi', 19),
  ('Tamil Nadu', 'Nagercoil', 20),
  ('Tamil Nadu', 'Karur', 21),
  ('Tamil Nadu', 'Krishnagiri', 22),
  ('Tamil Nadu', 'Mayiladuthurai', 23),
  ('Tamil Nadu', 'Nagapattinam', 24),
  ('Tamil Nadu', 'Namakkal', 25),
  ('Tamil Nadu', 'Udhagamandalam', 26),
  ('Tamil Nadu', 'Perambalur', 27),
  ('Tamil Nadu', 'Pudukkottai', 28),
  ('Tamil Nadu', 'Ramanathapuram', 29),
  ('Tamil Nadu', 'Ranipet', 30),
  ('Tamil Nadu', 'Sivaganga', 31),
  ('Tamil Nadu', 'Tenkasi', 32),
  ('Tamil Nadu', 'Theni', 33),
  ('Tamil Nadu', 'Tirupathur', 34),
  ('Tamil Nadu', 'Tiruvannamalai', 35),
  ('Tamil Nadu', 'Tiruvarur', 36),
  ('Tamil Nadu', 'Viluppuram', 37),
  ('Tamil Nadu', 'Virudhunagar', 38),
  ('Kerala', 'Kochi', 1),
  ('Kerala', 'Thiruvananthapuram', 2),
  ('Kerala', 'Kozhikode', 3),
  ('Kerala', 'Thrissur', 4),
  ('Kerala', 'Kollam', 5),
  ('Kerala', 'Kannur', 6),
  ('Kerala', 'Alappuzha', 7),
  ('Kerala', 'Kottayam', 8),
  ('Kerala', 'Palakkad', 9),
  ('Kerala', 'Malappuram', 10),
  ('Kerala', 'Kasaragod', 11),
  ('Kerala', 'Pathanamthitta', 12),
  ('Kerala', 'Painavu', 13),
  ('Kerala', 'Kalpetta', 14),
  ('Puducherry', 'Puducherry', 1),
  ('Puducherry', 'Karaikal', 2),
  ('Puducherry', 'Mahe', 3),
  ('Puducherry', 'Yanam', 4)
) AS v(state, city, sort)
JOIN ref_states s ON s.name = v.state
ON CONFLICT (state_id, name_norm) DO UPDATE SET is_offered = true, sort = EXCLUDED.sort;

-- ── 3. The 30 languages (10 existing codes untouched, all re-sorted to the CSV order) ─
INSERT INTO ref_languages (code, label, sort) VALUES
  ('English', 'English', 1),
  ('Hindi', 'Hindi', 2),
  ('Telugu', 'Telugu', 3),
  ('Tamil', 'Tamil', 4),
  ('Kannada', 'Kannada', 5),
  ('Malayalam', 'Malayalam', 6),
  ('Tulu', 'Tulu', 7),
  ('Konkani', 'Konkani', 8),
  ('Kodava', 'Kodava', 9),
  ('Marathi', 'Marathi', 10),
  ('Bengali', 'Bengali', 11),
  ('Gujarati', 'Gujarati', 12),
  ('Punjabi', 'Punjabi', 13),
  ('Urdu', 'Urdu', 14),
  ('Odia', 'Odia', 15),
  ('Assamese', 'Assamese', 16),
  ('Maithili', 'Maithili', 17),
  ('Bhojpuri', 'Bhojpuri', 18),
  ('Rajasthani', 'Rajasthani', 19),
  ('Haryanvi', 'Haryanvi', 20),
  ('Chhattisgarhi', 'Chhattisgarhi', 21),
  ('Magahi', 'Magahi', 22),
  ('Awadhi', 'Awadhi', 23),
  ('Nepali', 'Nepali', 24),
  ('Manipuri', 'Manipuri', 25),
  ('Bodo', 'Bodo', 26),
  ('Santali', 'Santali', 27),
  ('Kashmiri', 'Kashmiri', 28),
  ('Dogri', 'Dogri', 29),
  ('Sindhi', 'Sindhi', 30)
ON CONFLICT (code) DO UPDATE SET sort = EXCLUDED.sort, active = true;

-- ── 4. The Other niche (spec §3.3) ────────────────────────────────────────────
INSERT INTO ref_creator_niches (code, label, sort) VALUES ('other', 'Other', 999)
ON CONFLICT (code) DO NOTHING;

-- ── 5. Creator columns ────────────────────────────────────────────────────────
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS state_id smallint REFERENCES ref_states(id);
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS niche_other text;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS niche_other_resolved_at timestamptz;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS submitted_for_review_at timestamptz;
COMMENT ON COLUMN influencers.niche_other IS 'What she typed when she chose the Other niche. Admin maps it to a niche (registration-and-profile §3.3, §9A.3).';
COMMENT ON COLUMN influencers.submitted_for_review_at IS 'When she pressed Submit for review with a complete profile. NULL = registered, not yet submitted.';
CREATE INDEX IF NOT EXISTS idx_influencers_niche_other_open ON influencers (created_at) WHERE niche_other IS NOT NULL AND niche_other_resolved_at IS NULL;

UPDATE influencers i SET state_id = c.state_id FROM ref_cities c WHERE c.id = i.city_id AND i.state_id IS NULL;

-- ── 6. Brand columns ──────────────────────────────────────────────────────────
ALTER TABLE brands ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS bank_account_no text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS bank_ifsc varchar(12);
ALTER TABLE brands ADD COLUMN IF NOT EXISTS submitted_for_review_at timestamptz;
COMMENT ON COLUMN brands.bank_account_no IS 'AES-256-GCM via utils/encrypt.js, the same helper as influencers.bank_account_no. One entry with bank_ifsc (registration-and-profile §5).';

-- ── 7. Everyone already waiting counts as submitted at registration ──────────
UPDATE influencers i SET submitted_for_review_at = i.created_at
  FROM users u WHERE u.id = i.user_id AND u.status = 'pending' AND i.submitted_for_review_at IS NULL;
UPDATE brands b SET submitted_for_review_at = b.created_at
  FROM users u WHERE u.id = b.user_id AND u.status = 'pending' AND b.submitted_for_review_at IS NULL;

COMMIT;
