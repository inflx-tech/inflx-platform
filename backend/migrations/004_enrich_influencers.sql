-- Migration 004: Enrich influencers table with detailed profile columns and mock data

-- 1. Add missing columns to influencers table (with IF NOT EXISTS guards)

ALTER TABLE influencers ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS price_per_post_min INTEGER;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS price_per_post_max INTEGER;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS total_posts INTEGER;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS avg_shares INTEGER;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS avg_saves INTEGER;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS past_brands_json JSONB DEFAULT '[]';
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS collaboration_types_json JSONB DEFAULT '[]';
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS age INTEGER;

-- 2. UPDATE all 20 mock influencers with rich realistic data

-- 1. priyacooks — Food/Lifestyle, micro 180K, Vijayawada, female
UPDATE influencers
SET
    bio = 'A passionate home cook and food storyteller from Vijayawada, Priya shares authentic Andhra recipes alongside modern fusion experiments that celebrate South Indian flavours. She documents her culinary journey with warm, personal storytelling that resonates deeply with home cooks and food lovers alike. When not cooking, she explores local eateries and hidden food gems across Andhra Pradesh.',
    website = 'instagram.com/priyacooks',
    price_per_post_min = 4000,
    price_per_post_max = 12000,
    total_posts = 320,
    avg_shares = 1800,
    avg_saves = 4200,
    past_brands_json = '["Swiggy", "MTR Foods", "Fresho", "BigBasket", "Godrej Food", "Zomato"]',
    collaboration_types_json = '["sponsored_post", "reel", "story", "review", "unboxing"]',
    profile_image_url = 'https://api.inflx.in/mock/avatars/priyacooks.jpg',
    age = 27
WHERE instagram_handle = 'priyacooks';

-- 2. arunfashion — Fashion/Lifestyle, macro 240K, Mumbai, male
UPDATE influencers
SET
    bio = 'Mumbai-based menswear stylist and fashion content creator, Arun curates effortlessly stylish looks for the modern Indian man — from boardroom fits to casual street style. With a sharp eye for trends and an affordable-luxe sensibility, he helps his audience dress confidently without breaking the bank. His reels regularly go viral across the metro fashion community.',
    website = 'instagram.com/arunfashion',
    price_per_post_min = 25000,
    price_per_post_max = 70000,
    total_posts = 410,
    avg_shares = 3200,
    avg_saves = 7500,
    past_brands_json = '["Myntra", "Ajio", "Manyavar", "Bewakoof", "Fabindia", "W for Woman"]',
    collaboration_types_json = '["sponsored_post", "reel", "story", "collab", "giveaway", "unboxing"]',
    profile_image_url = 'https://api.inflx.in/mock/avatars/arunfashion.jpg',
    age = 29
WHERE instagram_handle = 'arunfashion';

-- 3. snehastyle — Fashion/Beauty, micro 95K, Bengaluru, female
UPDATE influencers
SET
    bio = 'Bengaluru-based fashion and beauty creator, Sneha blends contemporary Indian aesthetics with Western trends to inspire everyday style for working women. She is known for her honest product reviews, budget-friendly outfit ideas, and detailed skincare breakdowns that her audience trusts completely. Her content is a go-to for the modern Bengaluru woman navigating work, weekends, and everything in between.',
    website = 'instagram.com/snehastyle',
    price_per_post_min = 5000,
    price_per_post_max = 18000,
    total_posts = 275,
    avg_shares = 1100,
    avg_saves = 3800,
    past_brands_json = '["Nykaa", "Sugar Cosmetics", "Ajio", "Mamaearth", "Plum", "mCaffeine"]',
    collaboration_types_json = '["sponsored_post", "reel", "story", "review", "collab"]',
    profile_image_url = 'https://api.inflx.in/mock/avatars/snehastyle.jpg',
    age = 25
WHERE instagram_handle = 'snehastyle';

-- 4. kiranlifestyle — Lifestyle/Travel, macro 210K, Hyderabad, male
UPDATE influencers
SET
    bio = 'Hyderabad-based lifestyle and travel creator, Kiran documents weekend escapes, luxury staycations, and offbeat destinations across India with cinematic flair. His content blends aspirational travel with practical tips, making him a trusted voice for the Indian millennial planning their next adventure. When in Hyderabad, he covers the city''s best dining experiences and lifestyle trends.',
    website = 'instagram.com/kiranlifestyle',
    price_per_post_min = 22000,
    price_per_post_max = 65000,
    total_posts = 380,
    avg_shares = 2900,
    avg_saves = 6100,
    past_brands_json = '["MakeMyTrip", "OYO", "Goibibo", "Airbnb India", "Pepperfry", "Wakefit"]',
    collaboration_types_json = '["sponsored_post", "reel", "story", "youtube_video", "collab"]',
    profile_image_url = 'https://api.inflx.in/mock/avatars/kiranlifestyle.jpg',
    age = 31
WHERE instagram_handle = 'kiranlifestyle';

-- 5. meerabakes — Food/Lifestyle, micro 140K, Vijayawada, female
UPDATE influencers
SET
    bio = 'Vijayawada''s favourite baking creator, Meera turns her compact kitchen into a wonderland of cakes, pastries, and innovative desserts that merge Indian flavours with global baking techniques. Her step-by-step tutorials are beginner-friendly yet inspire seasoned bakers to try something new. She also shares the joy of baking with her young daughter, making her content relatable to home bakers and parents alike.',
    website = 'instagram.com/meerabakes',
    price_per_post_min = 6000,
    price_per_post_max = 16000,
    total_posts = 290,
    avg_shares = 2100,
    avg_saves = 5500,
    past_brands_json = '["BigBasket", "Fresho", "Godrej Food", "Haldiram''s", "MTR Foods", "Swiggy"]',
    collaboration_types_json = '["sponsored_post", "reel", "story", "review", "unboxing"]',
    profile_image_url = 'https://api.inflx.in/mock/avatars/meerabakes.jpg',
    age = 30
WHERE instagram_handle = 'meerabakes';

-- 6. rahulfits — Fitness/Lifestyle, nano 8K, Delhi, male
UPDATE influencers
SET
    bio = 'Delhi-based fitness enthusiast and personal trainer, Rahul shares no-nonsense workout routines, nutrition tips, and supplement advice tailored for the busy urban professional. His authentic, unfiltered approach to fitness without expensive gym memberships has built him a fiercely loyal nano community. He documents his own transformation journey and challenges his followers to join weekly fitness streaks.',
    website = 'instagram.com/rahulfits',
    price_per_post_min = 600,
    price_per_post_max = 1800,
    total_posts = 120,
    avg_shares = 180,
    avg_saves = 420,
    past_brands_json = '["MuscleBlaze", "HealthKart", "Fast&Up", "Decathlon India"]',
    collaboration_types_json = '["sponsored_post", "reel", "story", "review"]',
    profile_image_url = 'https://api.inflx.in/mock/avatars/rahulfits.jpg',
    age = 24
WHERE instagram_handle = 'rahulfits';

-- 7. nishabeauty — Beauty/Fashion, micro 62K, Vijayawada, female
UPDATE influencers
SET
    bio = 'Vijayawada-based beauty creator and makeup artist, Nisha specialises in South Indian bridal looks, everyday glam, and affordable drugstore finds that deliver premium results. Her tutorials are celebrated for their clarity and inclusivity — she caters to all skin tones and budgets, with a special focus on Telugu brides and their unique traditions. She also reviews local boutiques and fashion finds around Andhra Pradesh.',
    website = 'instagram.com/nishabeauty',
    price_per_post_min = 3500,
    price_per_post_max = 10000,
    total_posts = 210,
    avg_shares = 850,
    avg_saves = 2900,
    past_brands_json = '["Sugar Cosmetics", "Nykaa", "Mamaearth", "Plum", "mCaffeine", "Biotique"]',
    collaboration_types_json = '["sponsored_post", "reel", "story", "review", "collab"]',
    profile_image_url = 'https://api.inflx.in/mock/avatars/nishabeauty.jpg',
    age = 26
WHERE instagram_handle = 'nishabeauty';

-- 8. vikramtech — Tech/Gaming, micro 88K, Bengaluru, male
UPDATE influencers
SET
    bio = 'Bengaluru-based tech reviewer and gadget enthusiast, Vikram delivers in-depth, unbiased reviews of smartphones, audio gear, and wearables with a sharp focus on value for money in the Indian market. His comparisons and buying guides have helped tens of thousands of followers make smarter purchase decisions. A software engineer by training, his technical depth sets him apart from typical unboxing channels.',
    website = 'instagram.com/vikramtech',
    price_per_post_min = 5000,
    price_per_post_max = 15000,
    total_posts = 185,
    avg_shares = 1400,
    avg_saves = 3200,
    past_brands_json = '["boAt", "Noise", "realme India", "JBL India", "OnePlus India", "Skullcandy"]',
    collaboration_types_json = '["sponsored_post", "reel", "story", "unboxing", "review", "youtube_video"]',
    profile_image_url = 'https://api.inflx.in/mock/avatars/vikramtech.jpg',
    age = 28
WHERE instagram_handle = 'vikramtech';

-- 9. anjalistyle — Fashion/Beauty, nano 9.2K, Jaipur, female
UPDATE influencers
SET
    bio = 'Jaipur-based fashion and lifestyle creator, Anjali celebrates the rich textile heritage of Rajasthan through modern, wearable looks that blend ethnic craftsmanship with contemporary trends. Her content shines a light on local artisans and handloom fabrics while inspiring her audience to shop sustainably and support Indian weavers. She is also a passionate beauty content creator with a focus on Ayurvedic skincare.',
    website = 'instagram.com/anjalistyle',
    price_per_post_min = 700,
    price_per_post_max = 2000,
    total_posts = 95,
    avg_shares = 210,
    avg_saves = 580,
    past_brands_json = '["Fabindia", "Nykaa", "Ajio", "Sugar Cosmetics", "Biotique"]',
    collaboration_types_json = '["sponsored_post", "reel", "story", "review"]',
    profile_image_url = 'https://api.inflx.in/mock/avatars/anjalistyle.jpg',
    age = 23
WHERE instagram_handle = 'anjalistyle';

-- 10. devfoodie — Food/Travel, micro 55K, Pune, male
UPDATE influencers
SET
    bio = 'Pune-based food and travel creator, Dev documents the city''s thriving café culture, street food scene, and hidden restaurant gems while also exploring culinary traditions on his frequent travel expeditions across India. His content is a love letter to Indian food diversity — from Pune''s iconic misal pav to Rajasthani dal baati. He collaborates with local restaurants to spotlight homegrown Pune businesses.',
    website = 'instagram.com/devfoodie',
    price_per_post_min = 3000,
    price_per_post_max = 9000,
    total_posts = 240,
    avg_shares = 720,
    avg_saves = 1900,
    past_brands_json = '["Zomato", "Swiggy", "MakeMyTrip", "Goibibo", "Haldiram''s", "BigBasket"]',
    collaboration_types_json = '["sponsored_post", "reel", "story", "review", "collab"]',
    profile_image_url = 'https://api.inflx.in/mock/avatars/devfoodie.jpg',
    age = 27
WHERE instagram_handle = 'devfoodie';

-- 11. kavitafitness — Fitness/Lifestyle, micro 72K, Chennai, female
UPDATE influencers
SET
    bio = 'Chennai-based certified yoga instructor and fitness creator, Kavita promotes holistic wellness through yoga flows, mindful eating, and sustainable fitness habits rooted in South Indian traditions. Her calm, encouraging content style has made her a trusted wellness companion for women juggling busy professional and family lives. She also shares plant-based recipes and mental wellness tips regularly.',
    website = 'instagram.com/kavitafitness',
    price_per_post_min = 4000,
    price_per_post_max = 12000,
    total_posts = 300,
    avg_shares = 950,
    avg_saves = 3100,
    past_brands_json = '["Cultfit", "HealthKart", "Decathlon India", "Mamaearth", "Fast&Up", "Puma India"]',
    collaboration_types_json = '["sponsored_post", "reel", "story", "review", "youtube_video"]',
    profile_image_url = 'https://api.inflx.in/mock/avatars/kavitafitness.jpg',
    age = 32
WHERE instagram_handle = 'kavitafitness';

-- 12. sagartravel — Travel/Lifestyle, micro 120K, Mumbai, male
UPDATE influencers
SET
    bio = 'Mumbai-based solo travel creator, Sagar chronicles budget adventures and luxury escapes across India and Southeast Asia with stunning photography and practical travel guides. His content inspires the Indian millennial to travel more, negotiate smarter, and experience the world on their own terms. He is particularly known for his Himalayan trek diaries and detailed cost breakdowns that make travel feel accessible to everyone.',
    website = 'instagram.com/sagartravel',
    price_per_post_min = 6000,
    price_per_post_max = 18000,
    total_posts = 350,
    avg_shares = 2400,
    avg_saves = 5800,
    past_brands_json = '["MakeMyTrip", "Airbnb India", "OYO", "Goibibo", "Yatra", "Wakefit"]',
    collaboration_types_json = '["sponsored_post", "reel", "story", "youtube_video", "collab", "review"]',
    profile_image_url = 'https://api.inflx.in/mock/avatars/sagartravel.jpg',
    age = 30
WHERE instagram_handle = 'sagartravel';

-- 13. poojabeauty — Beauty/Fashion, micro 48K, Hyderabad, female
UPDATE influencers
SET
    bio = 'Hyderabad-based beauty blogger and makeup artist, Pooja is renowned for her stunning Hyderabadi bridal tutorials and her expertise in mixing Indo-Western makeup aesthetics for festive occasions. She reviews both high-end and affordable products with equal enthusiasm, making premium beauty knowledge accessible to all. Her Instagram grid is a beautifully curated lookbook of Hyderabadi fashion and beauty.',
    website = 'instagram.com/poojabeauty',
    price_per_post_min = 3000,
    price_per_post_max = 9000,
    total_posts = 195,
    avg_shares = 680,
    avg_saves = 2200,
    past_brands_json = '["Nykaa", "Forest Essentials", "Sugar Cosmetics", "Plum", "Biotique", "Mamaearth"]',
    collaboration_types_json = '["sponsored_post", "reel", "story", "review", "unboxing"]',
    profile_image_url = 'https://api.inflx.in/mock/avatars/poojabeauty.jpg',
    age = 26
WHERE instagram_handle = 'poojabeauty';

-- 14. arjunfinance — Finance/Lifestyle, micro 35K, Delhi, male
UPDATE influencers
SET
    bio = 'Delhi-based personal finance creator and CA student, Arjun demystifies investing, tax planning, and financial independence for young Indians in plain, jargon-free language that anyone can understand. His content bridges the gap between complex financial concepts and everyday money decisions for Gen Z and millennial earners. He is especially popular for his breakdowns of mutual funds, SIPs, and the basics of wealth building in India.',
    website = 'instagram.com/arjunfinance',
    price_per_post_min = 3000,
    price_per_post_max = 8000,
    total_posts = 160,
    avg_shares = 1600,
    avg_saves = 4800,
    past_brands_json = '["Groww", "Zerodha", "CRED", "Fi Money", "PhonePe", "Paytm"]',
    collaboration_types_json = '["sponsored_post", "reel", "story", "review", "collab"]',
    profile_image_url = 'https://api.inflx.in/mock/avatars/arjunfinance.jpg',
    age = 25
WHERE instagram_handle = 'arjunfinance';

-- 15. lakshmicooks — Food/Parenting, nano 7.8K, Vijayawada, female
UPDATE influencers
SET
    bio = 'Vijayawada-based mother and home cook, Lakshmi shares wholesome, traditional Andhra recipes with a focus on nutritious meals for toddlers and school-age children. Her content is a warm celebration of grandmothers'' recipes passed down through generations, adapted for modern kitchens and busy mothers. She also shares honest parenting moments, making her a genuine, relatable voice for young mothers across Andhra Pradesh.',
    website = 'instagram.com/lakshmicooks',
    price_per_post_min = 500,
    price_per_post_max = 1500,
    total_posts = 88,
    avg_shares = 140,
    avg_saves = 390,
    past_brands_json = '["Mamaearth", "FirstCry", "Himalaya Baby", "MTR Foods", "Fresho"]',
    collaboration_types_json = '["sponsored_post", "reel", "story", "review"]',
    profile_image_url = 'https://api.inflx.in/mock/avatars/lakshmicooks.jpg',
    age = 31
WHERE instagram_handle = 'lakshmicooks';

-- 16. rohitgaming — Gaming/Tech, micro 95K, Kolkata, male (YouTube)
UPDATE influencers
SET
    bio = 'Kolkata-based gaming creator and tech reviewer, Rohit covers mobile and PC gaming with passionate, high-energy commentary that has built a dedicated community of Indian gamers. He is known for his live tournament coverage, game reviews, and tech setup tours that inspire aspiring streamers and gaming enthusiasts across India. His YouTube channel complements his Instagram with longer-form gaming content and esports analysis.',
    website = 'instagram.com/rohitgaming',
    price_per_post_min = 5000,
    price_per_post_max = 16000,
    total_posts = 220,
    avg_shares = 1700,
    avg_saves = 2900,
    past_brands_json = '["MPL", "WinZO", "Nodwin Gaming", "boAt", "Noise", "Garena Free Fire"]',
    collaboration_types_json = '["sponsored_post", "reel", "story", "youtube_video", "review", "giveaway"]',
    profile_image_url = 'https://api.inflx.in/mock/avatars/rohitgaming.jpg',
    age = 22
WHERE instagram_handle = 'rohitgaming';

-- 17. divyaparenting — Parenting/Lifestyle, micro 42K, Chennai, female
UPDATE influencers
SET
    bio = 'Chennai-based parenting blogger and child development enthusiast, Divya shares practical, research-backed parenting advice alongside heartwarming slices of family life with her two young children. Her content covers everything from age-appropriate learning activities and screen time management to self-care for exhausted parents, delivered with warmth, humour, and zero judgement. She is a trusted voice for new and expecting mothers in Tamil Nadu and beyond.',
    website = 'instagram.com/divyaparenting',
    price_per_post_min = 3000,
    price_per_post_max = 8000,
    total_posts = 175,
    avg_shares = 820,
    avg_saves = 2600,
    past_brands_json = '["FirstCry", "Himalaya Baby", "Mamaearth", "Mee Mee", "BigBasket"]',
    collaboration_types_json = '["sponsored_post", "reel", "story", "review", "unboxing"]',
    profile_image_url = 'https://api.inflx.in/mock/avatars/divyaparenting.jpg',
    age = 33
WHERE instagram_handle = 'divyaparenting';

-- 18. nikhilfit — Fitness/Food, nano 6.5K, Ahmedabad, male
UPDATE influencers
SET
    bio = 'Ahmedabad-based fitness trainer and nutrition enthusiast, Nikhil documents his plant-based fitness journey with practical workout routines and high-protein vegetarian meal preps tailored for the Gujarati lifestyle. His honest, grounded approach to fitness without shortcuts has earned him a tight-knit nano community that trusts his supplement and meal-plan recommendations. He regularly runs free fitness challenges for his followers.',
    website = 'instagram.com/nikhilfit',
    price_per_post_min = 500,
    price_per_post_max = 1500,
    total_posts = 105,
    avg_shares = 160,
    avg_saves = 370,
    past_brands_json = '["MuscleBlaze", "HealthKart", "Fast&Up", "Decathlon India"]',
    collaboration_types_json = '["sponsored_post", "reel", "story", "review"]',
    profile_image_url = 'https://api.inflx.in/mock/avatars/nikhilfit.jpg',
    age = 24
WHERE instagram_handle = 'nikhilfit';

-- 19. rikitafashion — Fashion/Beauty, macro 320K, Delhi, female
UPDATE influencers
SET
    bio = 'Delhi-based fashion and beauty powerhouse, Rikita is one of North India''s most recognised style influencers, known for her boundary-pushing fashion editorials, brand collaborations, and aspirational yet attainable beauty content. She seamlessly moves between high-street and luxury fashion, giving her audience a window into the best of both worlds. Her fashion weeks coverage and brand campaign work with top Indian labels have cemented her as a macro-tier creator to watch.',
    website = 'instagram.com/rikitafashion',
    price_per_post_min = 35000,
    price_per_post_max = 80000,
    total_posts = 490,
    avg_shares = 5100,
    avg_saves = 11200,
    past_brands_json = '["Myntra", "Nykaa Fashion", "Ajio", "Nykaa", "Sugar Cosmetics", "Forest Essentials"]',
    collaboration_types_json = '["sponsored_post", "reel", "story", "collab", "giveaway", "review", "unboxing"]',
    profile_image_url = 'https://api.inflx.in/mock/avatars/rikitafashion.jpg',
    age = 27
WHERE instagram_handle = 'rikitafashion';

-- 20. sureshlifestyle — Lifestyle/Travel, macro 180K, Hyderabad, male
UPDATE influencers
SET
    bio = 'Hyderabad-based lifestyle creator and travel enthusiast, Suresh covers everything from luxury staycations and fine dining in Hyderabad to road trip adventures across Telangana and beyond. His content is defined by its warm, inclusive tone and his genuine passion for showcasing the very best of South Indian lifestyle, culture, and hospitality. He is a go-to voice for brands targeting the aspirational Hyderabadi consumer.',
    website = 'instagram.com/sureshlifestyle',
    price_per_post_min = 20000,
    price_per_post_max = 60000,
    total_posts = 360,
    avg_shares = 2700,
    avg_saves = 5400,
    past_brands_json = '["OYO", "MakeMyTrip", "Pepperfry", "Urban Ladder", "IKEA India", "Livspace"]',
    collaboration_types_json = '["sponsored_post", "reel", "story", "youtube_video", "collab", "review"]',
    profile_image_url = 'https://api.inflx.in/mock/avatars/sureshlifestyle.jpg',
    age = 34
WHERE instagram_handle = 'sureshlifestyle';

-- 3. Reset mock influencer users to pending status for admin approval queue
UPDATE users
SET status = 'pending'
WHERE phone IN (
    '+919000000001',
    '+919000000002',
    '+919000000003',
    '+919000000004',
    '+919000000005',
    '+919000000006',
    '+919000000007',
    '+919000000008',
    '+919000000009',
    '+919000000010',
    '+919000000011',
    '+919000000012',
    '+919000000013',
    '+919000000014',
    '+919000000015',
    '+919000000016',
    '+919000000017',
    '+919000000018',
    '+919000000019',
    '+919000000020'
);
