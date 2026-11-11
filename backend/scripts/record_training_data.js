/**
 * record_training_data.js
 * Utility to extract labeled training datasets from database records or record live sessions.
 * 
 * Labels:
 *   0 = Ambient / Normal Quiet State
 *   1 = Local Transient Disturbance (knocking table, single bump, door slam)
 *   2 = Simulated Earthquake / Seismic Shake Table Tremor
 *
 * Usage:
 *   node backend/scripts/record_training_data.js --from-db
 */

const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const extractor = require('../services/mlFeatureExtractor');

async function extractFromDatabase() {
  console.log('Fetching sensor readings from database for training dataset generation...');
  const res = await db.query('SELECT * FROM sensor_readings ORDER BY timestamp ASC');
  const rows = res.rows;
  console.log(`Fetched ${rows.length} total raw sensor rows.`);

  if (rows.length < 64) {
    console.warn('Not enough rows in database to generate training windows (need at least 64).');
    process.exit(0);
  }

  const windowSize = 64;
  const step = 20; // 50% overlap (1 second step at 20 Hz)
  const dataset = [];

  for (let i = 0; i <= rows.length - windowSize; i += step) {
    const windowSlice = rows.slice(i, i + windowSize);
    const feat = extractor.extractFeatures(windowSlice);
    if (!feat) continue;

    // Ground truth automatic labeling logic based on physical properties
    // Label 0: Ambient (quiet, dynamic motion < 0.10g, no SW420 triggers)
    // Label 1: Transient Disturbance (single isolated spike with high crest factor > 4.5, active SW420 in <= 2 samples, but low continuous RMS)
    // Label 2: Seismic Tremor (sustained oscillation, RMS > 0.08g, dynamic peak > 0.25g, sustained SW420 or high seismic band energy)
    let label = 0;
    let labelName = 'AMBIENT';

    const pga1 = feat.b1.peakDynamic;
    const rms1 = feat.b1.rms;
    const crest1 = feat.b1.crestFactor;
    const sw1Fraction = feat.b1.swActiveFraction;
    const seismicRatio = feat.b1.spectralEnergyRatio;

    if (rms1 >= 0.09 || (pga1 >= 0.35 && sw1Fraction > 0.06) || (pga1 >= 0.20 && crest1 < 4.2 && seismicRatio > 0.35)) {
      label = 2;
      labelName = 'SEISMIC_TREMOR';
    } else if (pga1 >= 0.12 || sw1Fraction > 0 || crest1 >= 4.0) {
      label = 1;
      labelName = 'DISTURBANCE';
    } else {
      label = 0;
      labelName = 'AMBIENT';
    }

    dataset.push({
      label,
      labelName,
      features: {
        pga_1: feat.b1.pga,
        peakDynamic_1: feat.b1.peakDynamic,
        rms_1: feat.b1.rms,
        crestFactor_1: feat.b1.crestFactor,
        zcr_1: feat.b1.zcr,
        dominantFreq_1: feat.b1.dominantFreq,
        spectralEnergyRatio_1: feat.b1.spectralEnergyRatio,
        spectralEntropy_1: feat.b1.spectralEntropy,
        swActiveFraction_1: feat.b1.swActiveFraction,
        vibCountTotal_1: feat.b1.vibCountTotal,
        maxTilt_1: feat.b1.maxTilt,

        pga_2: feat.b2.pga,
        peakDynamic_2: feat.b2.peakDynamic,
        rms_2: feat.b2.rms,
        dominantFreq_2: feat.b2.dominantFreq,
        swActiveFraction_2: feat.b2.swActiveFraction,
        maxTilt_2: feat.b2.maxTilt,

        shockReductionPct: feat.comparative.shockReductionPct,
        energyDissipationPct: feat.comparative.energyDissipationPct,
        frequencyDelta: feat.comparative.frequencyDelta,
      },
    });
  }

  // Count class distribution
  const counts = { AMBIENT: 0, DISTURBANCE: 0, SEISMIC_TREMOR: 0 };
  dataset.forEach((d) => counts[d.labelName]++);
  console.log(`Extracted ${dataset.length} training windows:`, counts);

  const outDir = path.join(__dirname, '../data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outJson = path.join(outDir, 'training_dataset.json');
  fs.writeFileSync(outJson, JSON.stringify(dataset, null, 2));
  console.log(`Saved dataset to ${outJson}`);

  // Also write CSV for Python / scikit-learn training
  const csvHeaders = [
    'label',
    'pga_1', 'peakDynamic_1', 'rms_1', 'crestFactor_1', 'zcr_1',
    'dominantFreq_1', 'spectralEnergyRatio_1', 'spectralEntropy_1',
    'swActiveFraction_1', 'vibCountTotal_1', 'maxTilt_1',
    'pga_2', 'peakDynamic_2', 'rms_2', 'dominantFreq_2', 'swActiveFraction_2', 'maxTilt_2',
    'shockReductionPct', 'energyDissipationPct', 'frequencyDelta'
  ];

  const csvRows = dataset.map((d) => {
    const f = d.features;
    return [
      d.label,
      f.pga_1, f.peakDynamic_1, f.rms_1, f.crestFactor_1, f.zcr_1,
      f.dominantFreq_1, f.spectralEnergyRatio_1, f.spectralEntropy_1,
      f.swActiveFraction_1, f.vibCountTotal_1, f.maxTilt_1,
      f.pga_2, f.peakDynamic_2, f.rms_2, f.dominantFreq_2, f.swActiveFraction_2, f.maxTilt_2,
      f.shockReductionPct, f.energyDissipationPct, f.frequencyDelta
    ].join(',');
  });

  const outCsv = path.join(outDir, 'training_dataset.csv');
  fs.writeFileSync(outCsv, [csvHeaders.join(','), ...csvRows].join('\n'));
  console.log(`Saved CSV dataset to ${outCsv}`);
  process.exit(0);
}

extractFromDatabase().catch((err) => {
  console.error('Error generating training dataset:', err);
  process.exit(1);
});

