/**
 * mlClassifier.js
 * Real-time machine learning inference classifier for Seismic vs Disturbance vs Ambient.
 * Includes hazard level rating, structural damage index, and EEW P-wave detector.
 */

/**
 * Softmax normalization
 */
function softmax(arr) {
  const max = Math.max(...arr);
  const exps = arr.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => (sum > 0 ? e / sum : 1 / arr.length));
}

/**
 * Classify a sensor window feature vector into AMBIENT, DISTURBANCE, or SEISMIC_TREMOR.
 * @param {Object} feat - Extracted feature vector from mlFeatureExtractor.js
 * @returns {Object} Prediction result
 */
function classify(feat) {
  if (!feat || !feat.b1) {
    return {
      eventType: 'NORMAL',
      label: 0,
      confidence: 1.0,
      hazardLevel: 'SAFE',
      probabilities: { normal: 1.0, disturbance: 0.0, seismic: 0.0 },
      damageIndex: 0.0,
      statusMessage: 'Insufficient sensor data',
    };
  }

  const pga1 = feat.b1.peakDynamic;
  const pgaRaw1 = feat.b1.pga;
  const rms1 = feat.b1.rms;
  const crest1 = feat.b1.crestFactor;
  const sw1 = feat.b1.swActiveFraction;
  const seismicRatio = feat.b1.spectralEnergyRatio;
  const maxTilt1 = feat.b1.maxTilt;

  const zcr1 = feat.b1.zcr;
  const entropy1 = feat.b1.spectralEntropy;

  // Raw logits for 3 classes: [ambient, disturbance, seismic]
  let logitAmbient = 0.0;
  let logitDisturbance = 0.0;
  let logitSeismic = 0.0;

  // 1. Ambient evaluation
  if (rms1 < 0.008 && sw1 === 0) {
    logitAmbient += 8.0;
  } else if (rms1 < 0.02 && pga1 < 0.12 && sw1 === 0) {
    logitAmbient += 5.5;
  } else if (rms1 < 0.04 && sw1 === 0 && crest1 < 3.0) {
    logitAmbient += 3.0;
  }

  // 2. Transient Disturbance evaluation (Knocks, table bumps, footsteps, door slams)
  // Hallmarks of single impact:
  // - High crest factor (>= 5.0) where peak is high but continuous oscillation is absent
  // - Broadband flat impulse (spectral entropy >= 0.92)
  // - Very low zero-crossing rate (zcr < 0.08) because it's a single spike rather than sinusoidal cycles
  const isSingleImpulse = crest1 >= 5.0 || (crest1 >= 4.0 && zcr1 < 0.08);

  if (isSingleImpulse) {
    logitDisturbance += 8.0;
    if (entropy1 >= 0.90) logitDisturbance += 3.0;
    if (sw1 > 0 && sw1 <= 0.05) logitDisturbance += 3.0;
  } else if (sw1 > 0 && rms1 < 0.05) {
    logitDisturbance += 6.0;
  } else if (pga1 >= 0.12 && rms1 < 0.04) {
    logitDisturbance += 4.5;
  }

  // 3. Seismic Tremor evaluation (Simulated or real ground earthquake motion)
  // Hallmarks of earthquake:
  // - Sustained continuous harmonic oscillation (low/moderate crest factor < 4.8, zcr >= 0.10)
  // - Elevated RMS across window (rms >= 0.06)
  // - Concentrated resonance peak (spectral entropy < 0.90, seismicRatio >= 0.30)
  if (!isSingleImpulse && rms1 >= 0.05 && pga1 >= 0.18) {
    logitSeismic += 6.0;
    if (rms1 >= 0.12) logitSeismic += 4.0;
    if (rms1 >= 0.30) logitSeismic += 3.5;
    if (crest1 > 0 && crest1 < 4.5) logitSeismic += 3.0; // Harmonic sinusoidal wave train
    if (zcr1 >= 0.10) logitSeismic += 2.5; // Multiple oscillations crossing zero
    if (sw1 >= 0.05) logitSeismic += 2.5;
    if (seismicRatio >= 0.30) logitSeismic += 2.0;
    if (entropy1 < 0.85) logitSeismic += 2.0; // Clear dominant resonant peak
  }

  // Calculate probabilities
  const probs = softmax([logitAmbient, logitDisturbance, logitSeismic]);
  const pAmbient = parseFloat(probs[0].toFixed(3));
  const pDisturbance = parseFloat(probs[1].toFixed(3));
  const pSeismic = parseFloat(probs[2].toFixed(3));

  let eventType = 'NORMAL';
  let label = 0;
  let confidence = pAmbient;

  if (pSeismic >= 0.50 || (pSeismic > pDisturbance && pSeismic > pAmbient)) {
    eventType = 'SEISMIC_TREMOR';
    label = 2;
    confidence = pSeismic;
  } else if (pDisturbance >= 0.50 || (pDisturbance > pAmbient && pDisturbance >= pSeismic)) {
    eventType = 'DISTURBANCE';
    label = 1;
    confidence = pDisturbance;
  } else {
    eventType = 'NORMAL';
    label = 0;
    confidence = pAmbient;
  }

  // Hazard Level Assessment
  let hazardLevel = 'SAFE';
  let hazardColor = '#10b981'; // Green
  let statusMessage = 'Nominal ambient state. No seismic activity.';

  if (eventType === 'DISTURBANCE') {
    hazardLevel = 'SAFE';
    hazardColor = '#f59e0b'; // Amber
    statusMessage = 'Transient local bump / knock detected & rejected. Benign mechanical noise.';
  } else if (eventType === 'SEISMIC_TREMOR') {
    if (pgaRaw1 > 1.8 || maxTilt1 > 10.0 || rms1 > 0.50) {
      hazardLevel = 'STRUCTURAL_HAZARD';
      hazardColor = '#ef4444'; // Red
      statusMessage = 'CRITICAL SEISMIC COLLAPSE RISK — Plastic deformation and heavy structural shaking in Building 1!';
    } else if (pgaRaw1 > 1.3 || maxTilt1 > 5.0 || rms1 > 0.20) {
      hazardLevel = 'WARNING';
      hazardColor = '#f97316'; // Orange
      statusMessage = 'MODERATE SEISMIC TREMOR — Strong resonant shaking detected. Protective damping active.';
    } else {
      hazardLevel = 'MINOR';
      hazardColor = '#eab308'; // Yellow
      statusMessage = 'MINOR TREMOR — Low-intensity ground vibration detected.';
    }
  }

  // Real-time Structural Damage Index (0.00 = pristine, 1.00 = structural failure)
  let damageIndex = 0.0;
  if (eventType === 'SEISMIC_TREMOR') {
    const tiltPenalty = Math.min(0.40, (maxTilt1 / 15.0) * 0.40);
    const pgaPenalty = Math.min(0.35, (pgaRaw1 / 2.5) * 0.35);
    const energyPenalty = Math.min(0.25, (rms1 / 0.8) * 0.25);
    damageIndex = parseFloat(Math.min(1.0, tiltPenalty + pgaPenalty + energyPenalty).toFixed(3));
  } else if (eventType === 'DISTURBANCE') {
    damageIndex = 0.02; // Negligible
  }

  // Earthquake Early Warning (EEW) P-wave detector
  // P-waves: low-amplitude longitudinal wave onset with high frequency and low initial tilt
  const pWaveDetected = eventType === 'SEISMIC_TREMOR' && pga1 >= 0.15 && pga1 < 0.45 && rms1 < 0.18;
  const estimatedLeadTimeSec = pWaveDetected ? 2.5 : 0;

  return {
    eventType,
    label,
    confidence,
    hazardLevel,
    hazardColor,
    statusMessage,
    damageIndex,
    probabilities: {
      normal: pAmbient,
      disturbance: pDisturbance,
      seismic: pSeismic,
    },
    eew: {
      pWaveDetected,
      estimatedLeadTimeSec,
    },
    building1: {
      pga: feat.b1.pga,
      rms: feat.b1.rms,
      dominantFreq: feat.b1.dominantFreq,
      maxTilt: feat.b1.maxTilt,
      swActiveFraction: feat.b1.swActiveFraction,
    },
    building2: {
      pga: feat.b2.pga,
      rms: feat.b2.rms,
      dominantFreq: feat.b2.dominantFreq,
      maxTilt: feat.b2.maxTilt,
      swActiveFraction: feat.b2.swActiveFraction,
    },
    attenuation: {
      shockReductionPct: feat.comparative.shockReductionPct,
      energyDissipationPct: feat.comparative.energyDissipationPct,
      frequencyDelta: feat.comparative.frequencyDelta,
    },
    spectrum: {
      frequencies: feat.b1.spectrum.frequencies,
      power1: feat.b1.spectrum.power,
      power2: feat.b2.spectrum.power,
    },
  };
}

module.exports = {
  classify,
};
