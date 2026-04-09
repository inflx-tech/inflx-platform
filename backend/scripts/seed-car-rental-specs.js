'use strict';
/**
 * Seed enhanced car rental specs into master_vehicles table.
 * Data matches the Car Rental HTML mockup exactly.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');

const VEHICLE_DB = {
  'Maruti Suzuki': {
    'Swift':  { segment:'Hatchback', segLabel:'4–5 seats · Compact', seats:5, fuel:'Petrol', eng:'1197cc', tx:'Manual / AMT', kmpl:'21.5', ac:true, sunroof:false, features:['Bluetooth','Rear cam','Touchscreen'], dayMin:800, dayMax:1200, kmMin:10, kmMax:14, services:['Self drive','With driver','City trips'] },
    'Baleno': { segment:'Hatchback', segLabel:'4–5 seats · Compact', seats:5, fuel:'Petrol', eng:'1197cc', tx:'Manual / AMT / CVT', kmpl:'22.4', ac:true, sunroof:false, features:['Bluetooth','USB','Touchscreen','Apple CarPlay'], dayMin:900, dayMax:1300, kmMin:11, kmMax:15, services:['Self drive','With driver'] },
    'Ertiga': { segment:'MPV / MUV', segLabel:'6–7 seats · Family', seats:7, fuel:'Petrol / CNG', eng:'1462cc', tx:'Manual / AT', kmpl:'20.3', ac:true, sunroof:false, features:['Rear AC vents','Bluetooth','USB','7 seats'], dayMin:1400, dayMax:1900, kmMin:13, kmMax:18, services:['Self drive','With driver','Outstation','Airport'] },
    'Brezza': { segment:'SUV', segLabel:'5 seats · All-terrain', seats:5, fuel:'Petrol', eng:'1462cc', tx:'Manual / AT', kmpl:'19.8', ac:true, sunroof:true, features:['Sunroof','Bluetooth','Rear cam','Apple CarPlay'], dayMin:1200, dayMax:1700, kmMin:13, kmMax:17, services:['Self drive','With driver','Outstation'] },
  },
  'Hyundai': {
    'Creta':  { segment:'SUV', segLabel:'5 seats · All-terrain', seats:5, fuel:'Petrol / Diesel', eng:'1497cc', tx:'Manual / DCT / IVT', kmpl:'17.4', ac:true, sunroof:true, features:['Panoramic sunroof','ADAS','Bluetooth','Wireless charger'], dayMin:1400, dayMax:2000, kmMin:14, kmMax:18, services:['Self drive','With driver','Outstation','Airport'] },
    'i20':    { segment:'Hatchback', segLabel:'4–5 seats · Compact', seats:5, fuel:'Petrol / Diesel', eng:'1197cc', tx:'Manual / IVT / DCT', kmpl:'20.6', ac:true, sunroof:false, features:['Bluetooth','Rear cam','Touchscreen'], dayMin:900, dayMax:1300, kmMin:11, kmMax:15, services:['Self drive','With driver'] },
    'Verna':  { segment:'Sedan', segLabel:'5 seats · Mid-size', seats:5, fuel:'Petrol', eng:'1497cc', tx:'Manual / IVT / DCT', kmpl:'20.6', ac:true, sunroof:true, features:['Sunroof','Bluetooth','Wireless charger','ADAS'], dayMin:1200, dayMax:1800, kmMin:13, kmMax:17, services:['Self drive','With driver','Outstation'] },
  },
  'Toyota': {
    'Innova Crysta': { segment:'MPV / MUV', segLabel:'6–7 seats · Family', seats:7, fuel:'Diesel', eng:'2393cc', tx:'Manual / AT', kmpl:'15.1', ac:true, sunroof:false, features:['7 seats','Rear AC','Push start','Rear cam'], dayMin:1800, dayMax:2600, kmMin:16, kmMax:22, services:['With driver','Outstation','Airport','Wedding / events'] },
    'Fortuner':      { segment:'SUV', segLabel:'5 seats · All-terrain', seats:7, fuel:'Diesel', eng:'2755cc', tx:'Manual / AT', kmpl:'12.3', ac:true, sunroof:false, features:['7 seats','4WD','Rear cam','Rear AC','JBL audio'], dayMin:2800, dayMax:4000, kmMin:18, kmMax:28, services:['With driver','Outstation','Airport','Wedding / events'] },
    'Camry':         { segment:'Luxury', segLabel:'4–5 seats · Premium', seats:5, fuel:'Petrol Hybrid', eng:'2487cc', tx:'Automatic (eCVT)', kmpl:'19.2', ac:true, sunroof:true, features:['Hybrid','JBL audio','Leather seats','9" touchscreen','Sunroof'], dayMin:4000, dayMax:6000, kmMin:25, kmMax:40, services:['With driver','Airport','Corporate','Wedding / events'] },
    'Glanza':        { segment:'Hatchback', segLabel:'4–5 seats · Compact', seats:5, fuel:'Petrol', eng:'1197cc', tx:'Manual / AMT', kmpl:'22.4', ac:true, sunroof:false, features:['Bluetooth','USB','Touchscreen'], dayMin:800, dayMax:1200, kmMin:10, kmMax:14, services:['Self drive','With driver'] },
  },
  'Mahindra': {
    'XUV700':    { segment:'SUV', segLabel:'5 seats · All-terrain', seats:7, fuel:'Petrol / Diesel', eng:'1999cc', tx:'Manual / AT', kmpl:'16.0', ac:true, sunroof:true, features:['ADAS','Panoramic sunroof','7 seats','Sony 3D audio'], dayMin:2200, dayMax:3200, kmMin:18, kmMax:25, services:['Self drive','With driver','Outstation'] },
    'Thar':      { segment:'SUV', segLabel:'4 seats · Off-road', seats:4, fuel:'Diesel / Petrol', eng:'2184cc', tx:'Manual / AT', kmpl:'15.2', ac:true, sunroof:false, features:['4x4','Off-road','Convertible roof','Adventure ready'], dayMin:2000, dayMax:3000, kmMin:18, kmMax:25, services:['Self drive','Outstation','Adventure trips'] },
    'Scorpio-N': { segment:'SUV', segLabel:'7 seats · All-terrain', seats:7, fuel:'Petrol / Diesel', eng:'2184cc', tx:'Manual / AT', kmpl:'14.0', ac:true, sunroof:false, features:['7 seats','4WD option','Rear AC','Meridian audio'], dayMin:1800, dayMax:2600, kmMin:16, kmMax:22, services:['With driver','Outstation','Airport'] },
  },
  'Tata': {
    'Nexon':   { segment:'SUV', segLabel:'5 seats · All-terrain', seats:5, fuel:'Petrol / Diesel / EV', eng:'1497cc / Electric', tx:'Manual / AMT / AT', kmpl:'17.4', ac:true, sunroof:true, features:['Sunroof','Harman audio','Rear cam','Wireless charger'], dayMin:1300, dayMax:1900, kmMin:13, kmMax:17, services:['Self drive','With driver','Outstation'] },
    'Harrier': { segment:'SUV', segLabel:'5 seats · All-terrain', seats:5, fuel:'Diesel', eng:'1956cc', tx:'Manual / AT', kmpl:'16.8', ac:true, sunroof:true, features:['Panoramic sunroof','Meridian audio','ADAS','Rear cam'], dayMin:2000, dayMax:2800, kmMin:17, kmMax:24, services:['Self drive','With driver','Outstation','Airport'] },
    'Safari':  { segment:'SUV', segLabel:'7 seats · All-terrain', seats:7, fuel:'Diesel', eng:'1956cc', tx:'Manual / AT', kmpl:'16.3', ac:true, sunroof:true, features:['7 seats','Panoramic sunroof','Meridian audio','ADAS'], dayMin:2200, dayMax:3000, kmMin:18, kmMax:25, services:['With driver','Outstation','Airport','Wedding / events'] },
  },
  'Honda': {
    'City':    { segment:'Sedan', segLabel:'5 seats · Mid-size', seats:5, fuel:'Petrol / Hybrid', eng:'1498cc', tx:'Manual / CVT', kmpl:'17.8', ac:true, sunroof:false, features:['Honda Sensing','Rear cam','Wireless charger','8" touchscreen'], dayMin:1200, dayMax:1700, kmMin:13, kmMax:17, services:['Self drive','With driver','Outstation'] },
    'Elevate': { segment:'SUV', segLabel:'5 seats · All-terrain', seats:5, fuel:'Petrol', eng:'1498cc', tx:'Manual / CVT', kmpl:'15.3', ac:true, sunroof:true, features:['Sunroof','Honda Sensing','Wireless charger','Rear cam'], dayMin:1400, dayMax:2000, kmMin:14, kmMax:18, services:['Self drive','With driver','Outstation'] },
  },
  'Kia': {
    'Carens':  { segment:'MPV / MUV', segLabel:'6–7 seats · Family', seats:7, fuel:'Petrol / Diesel', eng:'1497cc', tx:'Manual / DCT / AT', kmpl:'18.0', ac:true, sunroof:true, features:['7 seats','Panoramic sunroof','Bose audio','ADAS'], dayMin:1600, dayMax:2200, kmMin:15, kmMax:20, services:['Self drive','With driver','Outstation','Airport'] },
    'Seltos':  { segment:'SUV', segLabel:'5 seats · All-terrain', seats:5, fuel:'Petrol / Diesel', eng:'1497cc', tx:'Manual / DCT / IVT', kmpl:'16.5', ac:true, sunroof:true, features:['Sunroof','Bose audio','ADAS','Panoramic roof'], dayMin:1400, dayMax:2000, kmMin:14, kmMax:19, services:['Self drive','With driver','Outstation'] },
  },
  'Mercedes': {
    'E-Class': { segment:'Luxury', segLabel:'4–5 seats · Premium', seats:5, fuel:'Petrol', eng:'1991cc', tx:'Automatic (9G-Tronic)', kmpl:'11.7', ac:true, sunroof:true, features:['Burmester audio','Ambient light','Massage seats','MBUX','Sunroof'], dayMin:7000, dayMax:12000, kmMin:40, kmMax:70, services:['With driver','Airport','Corporate','Wedding / events'] },
    'S-Class': { segment:'Luxury', segLabel:'4–5 seats · Premium', seats:5, fuel:'Petrol / Hybrid', eng:'2999cc', tx:'Automatic (9G-Tronic)', kmpl:'10.1', ac:true, sunroof:true, features:['Burmester 4D audio','Air suspension','Massage seats','MBUX AR','Executive rear'], dayMin:12000, dayMax:20000, kmMin:60, kmMax:100, services:['With driver','Airport','Corporate','Wedding / events'] },
  },
};

async function seed() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let updated = 0;
  let inserted = 0;

  for (const [make, models] of Object.entries(VEHICLE_DB)) {
    for (const [model, specs] of Object.entries(models)) {
      // Check if exists
      const existing = await client.query(
        'SELECT id FROM master_vehicles WHERE make = $1 AND model = $2',
        [make, model]
      );

      const params = {
        make, model,
        display_name: `${make} ${model}`,
        segment: specs.segment,
        segment_label: specs.segLabel,
        seats: specs.seats,
        fuel_type: specs.fuel,
        transmission: specs.tx,
        engine_cc: specs.eng,
        kmpl: specs.kmpl,
        ac: specs.ac,
        sunroof: specs.sunroof,
        features_json: JSON.stringify(specs.features),
        variants_json: JSON.stringify(specs.tx.split(' / ').map(v => ({ label: v, type: 'transmission' }))),
        day_rate_min: specs.dayMin,
        day_rate_max: specs.dayMax,
        km_rate_min: specs.kmMin,
        km_rate_max: specs.kmMax,
        services_json: JSON.stringify(specs.services),
      };

      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE master_vehicles SET
            segment=$1, segment_label=$2, seats=$3, fuel_type=$4, transmission=$5,
            engine_cc=$6, kmpl=$7, ac=$8, sunroof=$9, features_json=$10,
            variants_json=$11, day_rate_min=$12, day_rate_max=$13, km_rate_min=$14,
            km_rate_max=$15, services_json=$16
          WHERE id=$17`,
          [params.segment, params.segment_label, params.seats, params.fuel_type, params.transmission,
           params.engine_cc, params.kmpl, params.ac, params.sunroof, params.features_json,
           params.variants_json, params.day_rate_min, params.day_rate_max, params.km_rate_min,
           params.km_rate_max, params.services_json, existing.rows[0].id]
        );
        updated++;
      } else {
        await client.query(
          `INSERT INTO master_vehicles (make, model, segment, segment_label, seats, fuel_type, transmission,
            engine_cc, kmpl, ac, sunroof, features_json, variants_json, day_rate_min, day_rate_max,
            km_rate_min, km_rate_max, services_json, sort_order)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
          [params.make, params.model, params.segment, params.segment_label,
           params.seats, params.fuel_type, params.transmission, params.engine_cc, params.kmpl,
           params.ac, params.sunroof, params.features_json, params.variants_json,
           params.day_rate_min, params.day_rate_max, params.km_rate_min, params.km_rate_max,
           params.services_json, 99]
        );
        inserted++;
      }
    }
  }

  // Verify
  const total = await client.query('SELECT COUNT(*) FROM master_vehicles');
  const makes = await client.query('SELECT DISTINCT make FROM master_vehicles ORDER BY make');

  console.log(`\nDone! Updated: ${updated}, Inserted: ${inserted}`);
  console.log(`Total vehicles: ${total.rows[0].count}`);
  console.log(`Makes: ${makes.rows.map(r => r.make).join(', ')}`);

  await client.end();
}

seed().catch(e => { console.error('Error:', e.message); process.exit(1); });
