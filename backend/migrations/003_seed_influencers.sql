-- Migration 003: Seed 20 mock influencers for local dev / search testing
-- Safe to re-run: uses ON CONFLICT DO NOTHING

DO $$
DECLARE v uuid;
BEGIN

INSERT INTO users(phone,role,status,name) VALUES('+919000000001','influencer','approved','Priya Sharma')
  ON CONFLICT(phone) DO UPDATE SET name='Priya Sharma' RETURNING id INTO v;
IF v IS NULL THEN SELECT id INTO v FROM users WHERE phone='+919000000001'; END IF;
INSERT INTO influencers(user_id,instagram_handle,full_name,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language)
  VALUES(v,'priyacooks','Priya Sharma','micro',180000,6.2,ARRAY['Food'],ARRAY['Lifestyle'],'Vijayawada','Andhra Pradesh','female','Instagram',22000,11160,890,true,ARRAY['Telugu','English'])
  ON CONFLICT(user_id) DO NOTHING;

INSERT INTO users(phone,role,status,name) VALUES('+919000000002','influencer','approved','Arun Mehta')
  ON CONFLICT(phone) DO UPDATE SET name='Arun Mehta' RETURNING id INTO v;
IF v IS NULL THEN SELECT id INTO v FROM users WHERE phone='+919000000002'; END IF;
INSERT INTO influencers(user_id,instagram_handle,full_name,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language)
  VALUES(v,'arunfashion','Arun Mehta','macro',240000,4.8,ARRAY['Fashion'],ARRAY['Lifestyle'],'Mumbai','Maharashtra','male','Instagram',35000,11520,650,true,ARRAY['Hindi','English'])
  ON CONFLICT(user_id) DO NOTHING;

INSERT INTO users(phone,role,status,name) VALUES('+919000000003','influencer','approved','Sneha Reddy')
  ON CONFLICT(phone) DO UPDATE SET name='Sneha Reddy' RETURNING id INTO v;
IF v IS NULL THEN SELECT id INTO v FROM users WHERE phone='+919000000003'; END IF;
INSERT INTO influencers(user_id,instagram_handle,full_name,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language)
  VALUES(v,'snehastyle','Sneha Reddy','micro',95000,7.1,ARRAY['Fashion'],ARRAY['Beauty'],'Bengaluru','Karnataka','female','Instagram',14000,6745,420,false,ARRAY['Kannada','English'])
  ON CONFLICT(user_id) DO NOTHING;

INSERT INTO users(phone,role,status,name) VALUES('+919000000004','influencer','approved','Kiran Das')
  ON CONFLICT(phone) DO UPDATE SET name='Kiran Das' RETURNING id INTO v;
IF v IS NULL THEN SELECT id INTO v FROM users WHERE phone='+919000000004'; END IF;
INSERT INTO influencers(user_id,instagram_handle,full_name,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language)
  VALUES(v,'kiranlifestyle','Kiran Das','macro',210000,5.3,ARRAY['Lifestyle'],ARRAY['Travel'],'Hyderabad','Telangana','male','Instagram',31000,11130,720,true,ARRAY['Telugu','Hindi'])
  ON CONFLICT(user_id) DO NOTHING;

INSERT INTO users(phone,role,status,name) VALUES('+919000000005','influencer','approved','Meera Varma')
  ON CONFLICT(phone) DO UPDATE SET name='Meera Varma' RETURNING id INTO v;
IF v IS NULL THEN SELECT id INTO v FROM users WHERE phone='+919000000005'; END IF;
INSERT INTO influencers(user_id,instagram_handle,full_name,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language)
  VALUES(v,'meerabakes','Meera Varma','micro',140000,8.4,ARRAY['Food'],ARRAY['Lifestyle'],'Vijayawada','Andhra Pradesh','female','Instagram',18000,11760,980,true,ARRAY['Telugu','English'])
  ON CONFLICT(user_id) DO NOTHING;

INSERT INTO users(phone,role,status,name) VALUES('+919000000006','influencer','approved','Rahul Kumar')
  ON CONFLICT(phone) DO UPDATE SET name='Rahul Kumar' RETURNING id INTO v;
IF v IS NULL THEN SELECT id INTO v FROM users WHERE phone='+919000000006'; END IF;
INSERT INTO influencers(user_id,instagram_handle,full_name,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language)
  VALUES(v,'rahulfits','Rahul Kumar','nano',8000,11.2,ARRAY['Fitness'],ARRAY['Lifestyle'],'Delhi','Delhi','male','Instagram',1200,896,95,false,ARRAY['Hindi','English'])
  ON CONFLICT(user_id) DO NOTHING;

INSERT INTO users(phone,role,status,name) VALUES('+919000000007','influencer','approved','Nisha Kaur')
  ON CONFLICT(phone) DO UPDATE SET name='Nisha Kaur' RETURNING id INTO v;
IF v IS NULL THEN SELECT id INTO v FROM users WHERE phone='+919000000007'; END IF;
INSERT INTO influencers(user_id,instagram_handle,full_name,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language)
  VALUES(v,'nishabeauty','Nisha Kaur','micro',62000,9.0,ARRAY['Beauty'],ARRAY['Fashion'],'Vijayawada','Andhra Pradesh','female','Instagram',9000,5580,450,true,ARRAY['Telugu','Hindi'])
  ON CONFLICT(user_id) DO NOTHING;

INSERT INTO users(phone,role,status,name) VALUES('+919000000008','influencer','approved','Vikram Shenoy')
  ON CONFLICT(phone) DO UPDATE SET name='Vikram Shenoy' RETURNING id INTO v;
IF v IS NULL THEN SELECT id INTO v FROM users WHERE phone='+919000000008'; END IF;
INSERT INTO influencers(user_id,instagram_handle,full_name,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language)
  VALUES(v,'vikramtech','Vikram Shenoy','micro',88000,5.7,ARRAY['Tech'],ARRAY['Gaming'],'Bengaluru','Karnataka','male','Instagram',13500,5016,310,false,ARRAY['Kannada','English'])
  ON CONFLICT(user_id) DO NOTHING;

INSERT INTO users(phone,role,status,name) VALUES('+919000000009','influencer','approved','Anjali Singh')
  ON CONFLICT(phone) DO UPDATE SET name='Anjali Singh' RETURNING id INTO v;
IF v IS NULL THEN SELECT id INTO v FROM users WHERE phone='+919000000009'; END IF;
INSERT INTO influencers(user_id,instagram_handle,full_name,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language)
  VALUES(v,'anjalistyle','Anjali Singh','nano',9200,12.1,ARRAY['Fashion'],ARRAY['Beauty'],'Jaipur','Rajasthan','female','Instagram',1400,1113,115,false,ARRAY['Hindi','English'])
  ON CONFLICT(user_id) DO NOTHING;

INSERT INTO users(phone,role,status,name) VALUES('+919000000010','influencer','approved','Dev Malhotra')
  ON CONFLICT(phone) DO UPDATE SET name='Dev Malhotra' RETURNING id INTO v;
IF v IS NULL THEN SELECT id INTO v FROM users WHERE phone='+919000000010'; END IF;
INSERT INTO influencers(user_id,instagram_handle,full_name,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language)
  VALUES(v,'devfoodie','Dev Malhotra','micro',55000,7.8,ARRAY['Food'],ARRAY['Travel'],'Pune','Maharashtra','male','Instagram',8000,4290,370,true,ARRAY['Hindi','English'])
  ON CONFLICT(user_id) DO NOTHING;

INSERT INTO users(phone,role,status,name) VALUES('+919000000011','influencer','approved','Kavita Pillai')
  ON CONFLICT(phone) DO UPDATE SET name='Kavita Pillai' RETURNING id INTO v;
IF v IS NULL THEN SELECT id INTO v FROM users WHERE phone='+919000000011'; END IF;
INSERT INTO influencers(user_id,instagram_handle,full_name,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language)
  VALUES(v,'kavitafitness','Kavita Pillai','micro',72000,8.9,ARRAY['Fitness'],ARRAY['Lifestyle'],'Chennai','Tamil Nadu','female','Instagram',10800,6408,520,true,ARRAY['Tamil','English'])
  ON CONFLICT(user_id) DO NOTHING;

INSERT INTO users(phone,role,status,name) VALUES('+919000000012','influencer','approved','Sagar Joshi')
  ON CONFLICT(phone) DO UPDATE SET name='Sagar Joshi' RETURNING id INTO v;
IF v IS NULL THEN SELECT id INTO v FROM users WHERE phone='+919000000012'; END IF;
INSERT INTO influencers(user_id,instagram_handle,full_name,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language)
  VALUES(v,'sagartravel','Sagar Joshi','micro',120000,6.5,ARRAY['Travel'],ARRAY['Lifestyle'],'Mumbai','Maharashtra','male','Both',18000,7800,630,true,ARRAY['Hindi','English'])
  ON CONFLICT(user_id) DO NOTHING;

INSERT INTO users(phone,role,status,name) VALUES('+919000000013','influencer','approved','Pooja Nair')
  ON CONFLICT(phone) DO UPDATE SET name='Pooja Nair' RETURNING id INTO v;
IF v IS NULL THEN SELECT id INTO v FROM users WHERE phone='+919000000013'; END IF;
INSERT INTO influencers(user_id,instagram_handle,full_name,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language)
  VALUES(v,'poojabeauty','Pooja Nair','micro',48000,10.2,ARRAY['Beauty'],ARRAY['Fashion'],'Hyderabad','Telangana','female','Instagram',7200,4896,420,false,ARRAY['Telugu','Malayalam'])
  ON CONFLICT(user_id) DO NOTHING;

INSERT INTO users(phone,role,status,name) VALUES('+919000000014','influencer','approved','Arjun Kapoor')
  ON CONFLICT(phone) DO UPDATE SET name='Arjun Kapoor' RETURNING id INTO v;
IF v IS NULL THEN SELECT id INTO v FROM users WHERE phone='+919000000014'; END IF;
INSERT INTO influencers(user_id,instagram_handle,full_name,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language)
  VALUES(v,'arjunfinance','Arjun Kapoor','micro',35000,5.4,ARRAY['Finance'],ARRAY['Lifestyle'],'Delhi','Delhi','male','Instagram',5000,1890,210,false,ARRAY['Hindi','English'])
  ON CONFLICT(user_id) DO NOTHING;

INSERT INTO users(phone,role,status,name) VALUES('+919000000015','influencer','approved','Lakshmi Devi')
  ON CONFLICT(phone) DO UPDATE SET name='Lakshmi Devi' RETURNING id INTO v;
IF v IS NULL THEN SELECT id INTO v FROM users WHERE phone='+919000000015'; END IF;
INSERT INTO influencers(user_id,instagram_handle,full_name,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language)
  VALUES(v,'lakshmicooks','Lakshmi Devi','nano',7800,13.5,ARRAY['Food'],ARRAY['Parenting'],'Vijayawada','Andhra Pradesh','female','Instagram',1200,1053,110,false,ARRAY['Telugu'])
  ON CONFLICT(user_id) DO NOTHING;

INSERT INTO users(phone,role,status,name) VALUES('+919000000016','influencer','approved','Rohit Banerjee')
  ON CONFLICT(phone) DO UPDATE SET name='Rohit Banerjee' RETURNING id INTO v;
IF v IS NULL THEN SELECT id INTO v FROM users WHERE phone='+919000000016'; END IF;
INSERT INTO influencers(user_id,instagram_handle,full_name,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language)
  VALUES(v,'rohitgaming','Rohit Banerjee','micro',95000,6.8,ARRAY['Gaming'],ARRAY['Tech'],'Kolkata','West Bengal','male','YouTube',14000,6460,580,true,ARRAY['Bengali','Hindi'])
  ON CONFLICT(user_id) DO NOTHING;

INSERT INTO users(phone,role,status,name) VALUES('+919000000017','influencer','approved','Divya Menon')
  ON CONFLICT(phone) DO UPDATE SET name='Divya Menon' RETURNING id INTO v;
IF v IS NULL THEN SELECT id INTO v FROM users WHERE phone='+919000000017'; END IF;
INSERT INTO influencers(user_id,instagram_handle,full_name,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language)
  VALUES(v,'divyaparenting','Divya Menon','micro',42000,9.3,ARRAY['Parenting'],ARRAY['Lifestyle'],'Chennai','Tamil Nadu','female','Instagram',6300,3906,390,false,ARRAY['Tamil','English'])
  ON CONFLICT(user_id) DO NOTHING;

INSERT INTO users(phone,role,status,name) VALUES('+919000000018','influencer','approved','Nikhil Bansal')
  ON CONFLICT(phone) DO UPDATE SET name='Nikhil Bansal' RETURNING id INTO v;
IF v IS NULL THEN SELECT id INTO v FROM users WHERE phone='+919000000018'; END IF;
INSERT INTO influencers(user_id,instagram_handle,full_name,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language)
  VALUES(v,'nikhilfit','Nikhil Bansal','nano',6500,14.2,ARRAY['Fitness'],ARRAY['Food'],'Ahmedabad','Gujarat','male','Instagram',1000,923,85,false,ARRAY['Gujarati','Hindi'])
  ON CONFLICT(user_id) DO NOTHING;

INSERT INTO users(phone,role,status,name) VALUES('+919000000019','influencer','approved','Ritika Gupta')
  ON CONFLICT(phone) DO UPDATE SET name='Ritika Gupta' RETURNING id INTO v;
IF v IS NULL THEN SELECT id INTO v FROM users WHERE phone='+919000000019'; END IF;
INSERT INTO influencers(user_id,instagram_handle,full_name,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language)
  VALUES(v,'rikitafashion','Ritika Gupta','macro',320000,3.9,ARRAY['Fashion'],ARRAY['Beauty'],'Delhi','Delhi','female','Instagram',48000,12480,890,true,ARRAY['Hindi','English'])
  ON CONFLICT(user_id) DO NOTHING;

INSERT INTO users(phone,role,status,name) VALUES('+919000000020','influencer','approved','Suresh Babu')
  ON CONFLICT(phone) DO UPDATE SET name='Suresh Babu' RETURNING id INTO v;
IF v IS NULL THEN SELECT id INTO v FROM users WHERE phone='+919000000020'; END IF;
INSERT INTO influencers(user_id,instagram_handle,full_name,tier,followers_count,engagement_rate,niche,secondary_niche,city,state,gender,platform,avg_views,avg_likes,avg_comments,verified,language)
  VALUES(v,'sureshlifestyle','Suresh Babu','macro',180000,4.5,ARRAY['Lifestyle'],ARRAY['Travel'],'Hyderabad','Telangana','male','Instagram',27000,8100,640,true,ARRAY['Telugu','Hindi'])
  ON CONFLICT(user_id) DO NOTHING;

END $$;
