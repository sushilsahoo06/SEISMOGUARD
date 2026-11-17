/**
 * mlFeatureExtractor.js
 * High-performance real-time feature extraction for Dual ADXL345 & SW-420 sensors.
 * Computes time-domain statistics, FFT spectral analysis, and inter-building attenuation.
 */

const SAMPLING_RATE = 20; // 20 Hz (50ms interval)

/**
 * Radix-2 Cooley-Tukey Fast Fourier Transform (In-Place)
 * Requires n to be a power of 2.
 */
function fftRadix2(re, im) {
  const n = re.length;
  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      let temp = re[i]; re[i] = re[j]; re[j] = temp;
      temp = im[i]; im[i] = im[j]; im[j] = temp;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Cooley-Tukey decimation in time
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wStepRe = Math.cos(angle);
    const wStepIm = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let wRe = 1.0;
      let wIm = 0.0;
      for (let k = 0; k < halfLen; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + halfLen] * wRe - im[i + k + halfLen] * wIm;
        const vIm = re[i + k + halfLen] * wIm + im[i + k + halfLen] * wRe;

        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + halfLen] = uRe - vRe;
        im[i + k + halfLen] = uIm - vIm;

        const nextWRe = wRe * wStepRe - wIm * wStepIm;
        const nextWIm = wRe * wStepIm + wIm * wStepRe;
        wRe = nextWRe;
        wIm = nextWIm;
      }
    }
  }
}

/**
 * Compute power spectrum using Radix-2 FFT with Hanning window
 * @param {number[]} signal - Time series array
 * @param {number} fs - Sampling rate in Hz
 * @returns {{ frequencies: number[], power: number[], dominantFreq: number, spectralEnergyRatio: number, spectralEntropy: number, spectralCentroid: number }}
 */
function computeSpectrum(signal, fs = SAMPLING_RATE) {
  // Use closest power of 2 <= signal.length (e.g. 64 or 32)
  let n = 64;
  if (signal.length < 64) {
    n = signal.length >= 32 ? 32 : 16;
  }
  const slice = signal.slice(-n);

  // Remove DC bias (mean)
  const mean = slice.reduce((a, b) => a + b, 0) / n;
  const re = new Float64Array(n);
  const im = new Float64Array(n);

  // Apply Hanning Window
  for (let i = 0; i < n; i++) {
    const hanning = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    re[i] = (slice[i] - mean) * hanning;
    im[i] = 0;
  }

  fftRadix2(re, im);

  const halfN = n / 2;
  const df = fs / n;
  const frequencies = new Array(halfN);
  const power = new Array(halfN);

  let totalPower = 0;
  let seismicPower = 0; // 0.5 Hz - 8 Hz
  let maxPower = -1;
  let dominantFreq = 0;
  let weightedFreqSum = 0;

  for (let i = 0; i < halfN; i++) {
    const f = i * df;
    frequencies[i] = parseFloat(f.toFixed(2));
    const p = (re[i] * re[i] + im[i] * im[i]) / (n * n);
    power[i] = parseFloat(p.toFixed(6));
    totalPower += p;
    weightedFreqSum += f * p;

    // Seismic earthquake tremor frequency band: 0.5 Hz to 8.0 Hz
    if (f >= 0.5 && f <= 8.0) {
      seismicPower += p;
      if (p > maxPower) {
        maxPower = p;
        dominantFreq = f;
      }
    }
  }

  // 🛡️ Physical Dead Sensor / Rest Guard:
  // If peak power is negligible (< 0.00005 g²/Hz) or sensor is dead/offline,
  // there is NO active resonance peak. Keep dominant frequency strictly at 0.0 Hz!
  if (maxPower < 0.00005) {
    dominantFreq = 0;
  }

  // Spectral Centroid
  const spectralCentroid = totalPower > 0 ? parseFloat((weightedFreqSum / totalPower).toFixed(2)) : 0;

  // Spectral Energy Ratio in Seismic Band
  const spectralEnergyRatio = totalPower > 0 ? parseFloat((seismicPower / totalPower).toFixed(3)) : 0;

  // Spectral Entropy (measure of energy spread / peakiness)
  let entropy = 0;
  if (totalPower > 0 && halfN > 1) {
    for (let i = 0; i < halfN; i++) {
      const prob = power[i] / totalPower;
      if (prob > 1e-9) {
        entropy -= prob * Math.log2(prob);
      }
    }
    // Normalized entropy: 0 = pure single sine tone, 1 = white noise
    entropy = parseFloat((entropy / Math.log2(halfN)).toFixed(3));
  }

  return {
    frequencies,
    power,
    dominantFreq: parseFloat(dominantFreq.toFixed(2)),
    spectralEnergyRatio,
    spectralEntropy: entropy,
    spectralCentroid,
  };
}

/**
 * Compute time-domain features for a scalar series
 * @param {number[]} series
 * @param {number|null} baseline - Expected resting baseline (e.g., 1.0 for magnitude, 0.0 for horizontal axes). If null, uses mean.
 */
function computeTimeDomain(series, baseline = null) {
  const n = series.length;
  if (n === 0) {
    return { mean: 0, std: 0, rms: 0, pga: 0, peakDynamic: 0, peakToPeak: 0, crestFactor: 0, zcr: 0 };
  }

  let sum = 0;
  let maxVal = -Infinity;
  let minVal = Infinity;

  for (let i = 0; i < n; i++) {
    const val = series[i];
    sum += val;
    if (val > maxVal) maxVal = val;
    if (val < minVal) minVal = val;
  }

  const mean = sum / n;
  const refBaseline = baseline !== null ? baseline : mean;

  let maxDynamic = 0;
  let sumSqDiff = 0;
  let zeroCrossings = 0;

  for (let i = 0; i < n; i++) {
    const diff = series[i] - mean;
    sumSqDiff += diff * diff;

    const dyn = Math.abs(series[i] - refBaseline);
    if (dyn > maxDynamic) maxDynamic = dyn;

    if (i > 0) {
      const prevDiff = series[i - 1] - mean;
      if ((diff >= 0 && prevDiff < 0) || (diff < 0 && prevDiff >= 0)) {
        zeroCrossings++;
      }
    }
  }

  const variance = sumSqDiff / n;
  const std = Math.sqrt(variance);
  const rms = std; // AC-coupled RMS (dynamic vibration intensity)
  const peakToPeak = maxVal - minVal;
  // Crest Factor = Peak Dynamic / RMS. If RMS is very small (ambient), avoid division by near-zero.
  const crestFactor = rms > 0.005 ? parseFloat((maxDynamic / rms).toFixed(2)) : 0;
  const zcr = parseFloat((zeroCrossings / Math.max(1, n - 1)).toFixed(3));

  return {
    mean: parseFloat(mean.toFixed(4)),
    std: parseFloat(std.toFixed(4)),
    rms: parseFloat(rms.toFixed(4)),
    pga: parseFloat(maxVal.toFixed(4)),
    peakDynamic: parseFloat(maxDynamic.toFixed(4)),
    peakToPeak: parseFloat(peakToPeak.toFixed(4)),
    crestFactor,
    zcr,
  };
}

/**
 * Extract full feature vector from a window of dual-sensor records.
 * @param {Array<Object>} windowRecords - Array of sensor readings (e.g., 32 - 100 samples)
 * @returns {Object} Extracted feature vector ready for ML inference
 */
function extractFeatures(windowRecords) {
  const n = windowRecords.length;
  if (n < 16) {
    return null; // Need minimum window size for meaningful statistical & frequency inference
  }

  // Extract series arrays
  const mag1Series = new Array(n);
  const mag2Series = new Array(n);
  const ax1Series = new Array(n);
  const ax2Series = new Array(n);
  const sw1Series = new Array(n);
  const sw2Series = new Array(n);
  const vib1Series = new Array(n);
  const vib2Series = new Array(n);

  let sw1ActiveCount = 0;
  let sw2ActiveCount = 0;
  let vibCount1Total = 0;
  let vibCount2Total = 0;
  let maxTilt1 = 0;
  let maxTilt2 = 0;

  for (let i = 0; i < n; i++) {
    const r = windowRecords[i];
    const m1 = r.magnitude_1 ?? r.magnitude ?? 1.0;
    const m2 = r.magnitude_2 ?? 1.0;
    const a1 = r.accel_x_1 ?? r.accel_x ?? 0;
    const a2 = r.accel_x_2 ?? 0;
    const s1 = parseInt(r.sw420_1 ?? 0);
    const s2 = parseInt(r.sw420_2 ?? 0);
    const v1 = parseInt(r.vib_count_1 ?? 0);
    const v2 = parseInt(r.vib_count_2 ?? 0);

    mag1Series[i] = m1;
    mag2Series[i] = m2;
    ax1Series[i] = a1;
    ax2Series[i] = a2;
    sw1Series[i] = s1;
    sw2Series[i] = s2;
    vib1Series[i] = v1;
    vib2Series[i] = v2;

    if (s1 === 1) sw1ActiveCount++;
    if (s2 === 1) sw2ActiveCount++;
    vibCount1Total += v1;
    vibCount2Total += v2;

    const tilt1 = Math.max(Math.abs(r.roll_1 ?? r.roll ?? 0), Math.abs(r.pitch_1 ?? r.pitch ?? 0));
    const tilt2 = Math.max(Math.abs(r.roll_2 ?? 0), Math.abs(r.pitch_2 ?? 0));
    if (tilt1 > maxTilt1) maxTilt1 = tilt1;
    if (tilt2 > maxTilt2) maxTilt2 = tilt2;
  }

  // Time-domain features (1.0 baseline for magnitudes, 0.0 for horizontal axis)
  const td1 = computeTimeDomain(mag1Series, 1.0);
  const td2 = computeTimeDomain(mag2Series, 1.0);
  const tdAx1 = computeTimeDomain(ax1Series, 0.0);
  const tdAx2 = computeTimeDomain(ax2Series, 0.0);

  // Frequency-domain features (FFT)
  const spec1 = computeSpectrum(mag1Series, SAMPLING_RATE);
  const spec2 = computeSpectrum(mag2Series, SAMPLING_RATE);

  // Vibration switch pulse metrics
  const sw1Fraction = parseFloat((sw1ActiveCount / n).toFixed(3));
  const sw2Fraction = parseFloat((sw2ActiveCount / n).toFixed(3));

  // Comparative Attenuation & Structural Health Metrics
  // Shock reduction %: how much Building 2 reduced the dynamic peak compared to Building 1
  const peakDynamic1 = Math.max(td1.peakDynamic, tdAx1.peakDynamic);
  const peakDynamic2 = Math.max(td2.peakDynamic, tdAx2.peakDynamic);
  const shockReductionPct = peakDynamic1 > 0.05
    ? Math.max(0, parseFloat(((1 - (peakDynamic2 / peakDynamic1)) * 100).toFixed(1)))
    : 0;

  // Energy dissipation % based on RMS vibration power
  const energyDissipationPct = td1.rms > 0.02
    ? Math.max(0, parseFloat(((1 - (td2.rms / td1.rms)) * 100).toFixed(1)))
    : 0;

  // Frequency shift between Building 1 and Building 2
  const frequencyDelta = parseFloat(Math.abs(spec1.dominantFreq - spec2.dominantFreq).toFixed(2));

  return {
    windowSize: n,
    samplingRate: SAMPLING_RATE,
    b1: {
      pga: td1.pga,
      peakDynamic: td1.peakDynamic,
      rms: td1.rms,
      crestFactor: td1.crestFactor,
      zcr: td1.zcr,
      dominantFreq: spec1.dominantFreq,
      spectralEnergyRatio: spec1.spectralEnergyRatio,
      spectralEntropy: spec1.spectralEntropy,
      spectralCentroid: spec1.spectralCentroid,
      swActiveFraction: sw1Fraction,
      vibCountTotal: vibCount1Total,
      maxTilt: parseFloat(maxTilt1.toFixed(2)),
      spectrum: spec1,
    },
    b2: {
      pga: td2.pga,
      peakDynamic: td2.peakDynamic,
      rms: td2.rms,
      crestFactor: td2.crestFactor,
      zcr: td2.zcr,
      dominantFreq: spec2.dominantFreq,
      spectralEnergyRatio: spec2.spectralEnergyRatio,
      spectralEntropy: spec2.spectralEntropy,
      spectralCentroid: spec2.spectralCentroid,
      swActiveFraction: sw2Fraction,
      vibCountTotal: vibCount2Total,
      maxTilt: parseFloat(maxTilt2.toFixed(2)),
      spectrum: spec2,
    },
    comparative: {
      shockReductionPct,
      energyDissipationPct,
      frequencyDelta,
      peakDynamic1,
      peakDynamic2,
    },
  };
}

module.exports = {
  computeSpectrum,
  computeTimeDomain,
  extractFeatures,
  SAMPLING_RATE,
};
