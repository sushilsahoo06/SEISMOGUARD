/**
 * verify_ml_pipeline.js
 * Comprehensive Verification & Benchmarking Test Suite for ML Roadmap (Phase 5).
 * Tests:
 *  1. Latency & throughput (< 2ms per window).
 *  2. Ambient baseline stability.
 *  3. Table knock / door slam false-alarm rejection.
 *  4. Harmonic seismic tremor classification & attenuation calculation.
 *  5. Structural damage index scoring.
 */

const RingBuffer = require('../services/mlRingBuffer');
const extractor = require('../services/mlFeatureExtractor');
const classifier = require('../services/mlClassifier');
const inferenceEngine = require('../services/mlInferenceEngine');

async function runTestSuite() {
  console.log('================================================================');
  console.log('  🧪 SHM MACHINE LEARNING PIPELINE VERIFICATION & BENCHMARK');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
    }
  }

  // ── TEST 1: LATENCY BENCHMARK ───────────────────────────────────────────
  console.log('⚡ [1/5] Latency & Throughput Benchmark (1,000 Window Iterations):');
  const benchBuffer = new RingBuffer(64);
  for (let i = 0; i < 64; i++) {
    benchBuffer.push({
      magnitude_1: 1.0 + 0.3 * Math.sin(2 * Math.PI * 3.0 * i / 20),
      magnitude_2: 1.0 + 0.1 * Math.sin(2 * Math.PI * 3.0 * i / 20),
      accel_x_1: 0.25 * Math.sin(2 * Math.PI * 3.0 * i / 20),
      accel_x_2: 0.08 * Math.sin(2 * Math.PI * 3.0 * i / 20),
      sw420_1: i % 2 === 0 ? 1 : 0,
      sw420_2: 0,
      roll_1: 1.2,
      pitch_1: 0.8,
    });
  }

  const samples = benchBuffer.toArray();
  const startTime = process.hrtime.bigint();
  const iterations = 1000;

  for (let i = 0; i < iterations; i++) {
    const feat = extractor.extractFeatures(samples);
    classifier.classify(feat);
  }

  const endTime = process.hrtime.bigint();
  const totalNs = Number(endTime - startTime);
  const avgMs = totalNs / iterations / 1e6;
  console.log(`     Average inference time per window: ${avgMs.toFixed(3)} ms`);
  assert(avgMs < 2.0, `Inference latency is under 2.0 ms (Measured: ${avgMs.toFixed(3)} ms)`);

  // ── TEST 2: AMBIENT QUIET BASELINE ──────────────────────────────────────
  console.log('\n🟢 [2/5] Ambient Baseline Test (Stationary Building Resting):');
  const ambientBuffer = new RingBuffer(64);
  for (let i = 0; i < 64; i++) {
    ambientBuffer.push({
      magnitude_1: 0.98 + 0.003 * Math.random(),
      magnitude_2: 0.99 + 0.003 * Math.random(),
      accel_x_1: 0.002 * (Math.random() - 0.5),
      accel_x_2: 0.001 * (Math.random() - 0.5),
      sw420_1: 0,
      sw420_2: 0,
      roll_1: 0.1,
      pitch_1: 0.1,
    });
  }
  const ambFeat = extractor.extractFeatures(ambientBuffer.toArray());
  const ambPred = classifier.classify(ambFeat);

  assert(ambPred.eventType === 'NORMAL', `Ambient classified as NORMAL (Got: ${ambPred.eventType})`);
  assert(ambPred.hazardLevel === 'SAFE', `Hazard Level is SAFE (Got: ${ambPred.hazardLevel})`);
  assert(ambPred.damageIndex === 0.0, `Damage Index is 0.0 (Got: ${ambPred.damageIndex})`);
  assert(ambPred.probabilities.normal > 0.95, `Ambient confidence > 95% (Got: ${(ambPred.probabilities.normal * 100).toFixed(1)}%)`);

  // ── TEST 3: TRANSIENT DISTURBANCE (FALSE-ALARM FILTER) ──────────────────
  console.log('\n🟡 [3/5] Transient Knock / Disturbance Test (Accidental Table Bump):');
  const knockBuffer = new RingBuffer(64);
  for (let i = 0; i < 64; i++) {
    const isSpike = (i === 32);
    knockBuffer.push({
      magnitude_1: isSpike ? 1.48 : 0.98,
      magnitude_2: 0.99,
      accel_x_1: isSpike ? 0.38 : 0.005,
      accel_x_2: 0.005,
      sw420_1: isSpike ? 1 : 0,
      sw420_2: 0,
      roll_1: 0.1,
      pitch_1: 0.1,
    });
  }
  const knockFeat = extractor.extractFeatures(knockBuffer.toArray());
  const knockPred = classifier.classify(knockFeat);

  assert(knockPred.eventType === 'DISTURBANCE', `Knock classified as DISTURBANCE (Got: ${knockPred.eventType})`);
  assert(knockPred.hazardLevel === 'SAFE', `Hazard Level remains SAFE to prevent false siren (Got: ${knockPred.hazardLevel})`);
  assert(knockPred.damageIndex <= 0.05, `Negligible damage index for bump (Got: ${knockPred.damageIndex})`);

  // ── TEST 4: HARMONIC SEISMIC TREMOR & ATTENUATION ──────────────────────
  console.log('\n🔴 [4/5] Harmonic Seismic Tremor Test (3.5 Hz Shake Table Simulation):');
  const seismicBuffer = new RingBuffer(64);
  for (let i = 0; i < 64; i++) {
    const t = i / 20; // 20 Hz
    seismicBuffer.push({
      magnitude_1: 1.0 + 0.65 * Math.sin(2 * Math.PI * 3.5 * t), // B1 Unprotected: heavy sway
      magnitude_2: 1.0 + 0.15 * Math.sin(2 * Math.PI * 3.5 * t), // B2 Resistant: damped by isolator
      accel_x_1: 0.50 * Math.sin(2 * Math.PI * 3.5 * t),
      accel_x_2: 0.12 * Math.sin(2 * Math.PI * 3.5 * t),
      sw420_1: i % 2 === 0 ? 1 : 0,
      sw420_2: 0,
      roll_1: 6.5 * Math.sin(2 * Math.PI * 3.5 * t),
      pitch_1: 4.2 * Math.cos(2 * Math.PI * 3.5 * t),
      roll_2: 1.1 * Math.sin(2 * Math.PI * 3.5 * t),
      pitch_2: 0.8 * Math.cos(2 * Math.PI * 3.5 * t),
    });
  }
  const seisFeat = extractor.extractFeatures(seismicBuffer.toArray());
  const seisPred = classifier.classify(seisFeat);

  assert(seisPred.eventType === 'SEISMIC_TREMOR', `Seismic classified as SEISMIC_TREMOR (Got: ${seisPred.eventType})`);
  assert(seisPred.hazardLevel === 'WARNING' || seisPred.hazardLevel === 'STRUCTURAL_HAZARD', `Hazard Level is WARNING or STRUCTURAL_HAZARD (Got: ${seisPred.hazardLevel})`);
  assert(seisPred.attenuation.shockReductionPct >= 65, `Building 2 Shock Reduction >= 65% (Got: ${seisPred.attenuation.shockReductionPct}%)`);
  assert(Math.abs(seisPred.building1.dominantFreq - 3.44) < 0.5, `Identified 3.5 Hz dominant resonant frequency (Got: ${seisPred.building1.dominantFreq} Hz)`);
  assert(seisPred.damageIndex > 0.20, `Structural Damage Index reflects high stress (Got: ${seisPred.damageIndex})`);

  // ── TEST 5: INFERENCE ENGINE EVENT LIFECYCLE ────────────────────────────
  console.log('\n⚙️ [5/5] Engine Event Lifecycle Tracking:');
  const engineResult = inferenceEngine.processReading({
    magnitude_1: 1.55,
    magnitude_2: 1.05,
    accel_x_1: 0.45,
    accel_x_2: 0.10,
    sw420_1: 1,
    sw420_2: 0,
    roll_1: 4.0,
    pitch_1: 3.0,
    timestamp: new Date(),
  });
  assert(typeof engineResult.eventType === 'string', `Engine returned valid prediction object`);
  assert(typeof engineResult.bufferSamples === 'number', `Engine maintains active buffer sample count`);

  // Summary
  console.log('\n================================================================');
  console.log(`  VERIFICATION RESULT: ${passedTests} / ${totalTests} TESTS PASSED (${(passedTests/totalTests*100).toFixed(0)}%)`);
  console.log('================================================================\n');

  process.exit(passedTests === totalTests ? 0 : 1);
}

runTestSuite().catch((err) => {
  console.error('Test suite error:', err);
  process.exit(1);
});

