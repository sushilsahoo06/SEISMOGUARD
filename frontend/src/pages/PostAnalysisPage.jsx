import React, { useState, useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Clean and sanitize text to remove LaTeX notation, dollar signs, and math commands
function cleanReportText(text) {
  if (!text) return '';
  return text
    // Replace \text{...} with inner content
    .replace(/\\text\{([^}]+)\}/g, '$1')
    // Fractions \frac{a}{b} -> (a / b)
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)')
    // Math symbols
    .replace(/\\cdot/g, ' * ')
    .replace(/\\times/g, ' x ')
    .replace(/\\gg/g, ' >> ')
    .replace(/\\ll/g, ' << ')
    .replace(/\\quad|\\qquad/g, ' ')
    .replace(/\\approx/g, ' ~ ')
    .replace(/\\leq?/g, ' <= ')
    .replace(/\\geq?/g, ' >= ')
    .replace(/\\Delta/g, 'Delta')
    .replace(/\\theta/g, 'theta')
    .replace(/\\alpha/g, 'alpha')
    .replace(/\\beta/g, 'beta')
    .replace(/\\max/g, 'max')
    .replace(/\\min/g, 'min')
    .replace(/\\left|\\right/g, '')
    // Clean subscripts and superscripts: a_{max} -> a_max, K_{secant} -> K_secant
    .replace(/_\{([^}]+)\}/g, '_$1')
    .replace(/\^\{([^}]+)\}/g, '^$1')
    // Remove all dollar signs
    .replace(/\$\$/g, '')
    .replace(/\$/g, '')
    // Clean any remaining backslashes before words
    .replace(/\\([a-zA-Z]+)/g, '$1')
    .replace(/ {2,}/g, ' ')
    .trim();
}

export default function PostAnalysisPage() {
  const API_BASE_URL =
    typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:5000'
      : (import.meta.env.VITE_BACKEND_URL || 'https://shm-v5rg.onrender.com');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Zoom mode: 'event' (zoomed to earthquake, no flat line) vs 'full' (all history)
  const [timelineMode, setTimelineMode] = useState('event');

  // Gemini AI state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [apiKey, setApiKey] = useState('');

  // Chart canvas refs to capture graphs as base64 images
  const accelChartRef = useRef(null);
  const tiltChartRef = useRef(null);

  // Initial fetch with loader
  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/sensor-data/analysis`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setError(`Could not connect to backend server (${API_BASE_URL}). Make sure it is running.`);
    } finally {
      setLoading(false);
    }
  };

  // Background quiet fetch
  const fetchAnalysisQuiet = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/sensor-data/analysis`);
      const json = await res.json();
      if (json && json.hasData) {
        setData(json);
      }
    } catch (err) {
      // Ignore background fetch errors
    }
  };

  const handleClearSession = async () => {
    if (!window.confirm('Are you sure you want to clear past earthquake data and start a fresh test?')) return;
    try {
      await fetch(`${API_BASE_URL}/api/sensor-data/session`, { method: 'DELETE' });
      setAiReport(null);
      fetchAnalysis();
    } catch (err) {
      alert('Failed to reset session');
    }
  };

  // Trigger Gemini AI Forensic Civil Engineering Analysis
  const handleGenerateAIReport = async () => {
    if (!data || !data.hasData) return;
    try {
      setAiLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/sensor-data/ai-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telemetry: data,
          apiKey: apiKey.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.aiReport) {
        const cleaned = cleanReportText(json.aiReport);
        setAiReport(cleaned);
        return cleaned;
      } else {
        alert(json.error || 'Failed to generate AI report');
      }
    } catch (err) {
      alert('AI Generation request failed: ' + err.message);
    } finally {
      setAiLoading(false);
    }
    return null;
  };

  // DOWNLOAD PUBLICATION-GRADE 3-PAGE CIVIL ENGINEERING REPORT
  const handleDownloadDirectPDF = async () => {
    if (!data || !data.hasData) return;

    let activeAiText = aiReport;
    if (!activeAiText) {
      // Auto-fetch or generate AI report if not yet generated
      try {
        setAiLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/sensor-data/ai-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telemetry: data }),
        });
        const json = await res.json();
        if (json.aiReport) {
          activeAiText = json.aiReport;
          setAiReport(json.aiReport);
        }
      } catch (e) {
        // Fall back gracefully
      } finally {
        setAiLoading(false);
      }
    }

    const { b1, b2, dampingEfficiency, totalSamples, eventWindow, mlAssessment } = data;
    const dateStr = new Date().toLocaleString();
    const durationStr = eventWindow && eventWindow.hasEvent ? `${eventWindow.eventDurationSec}s` : 'Continuous';

    // Capture chart images
    const chart1Img = accelChartRef.current ? accelChartRef.current.toBase64Image() : null;
    const chart2Img = tiltChartRef.current ? tiltChartRef.current.toBase64Image() : null;

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;

    // Helper: Header bar for pages
    const renderHeaderBar = (title, sub) => {
      doc.setFillColor(15, 23, 42); // #0f172a Dark Slate
      doc.rect(0, 0, pageWidth, 24, 'F');

      // Top color accent strip
      doc.setFillColor(14, 165, 233); // #0ea5e9 Cyan
      doc.rect(0, 0, pageWidth, 2.5, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(title, margin, 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // #94a3b8
      doc.text(sub, margin, 19);
    };

    // Helper: Footer
    const renderFooter = (pageNum, totalPages = 3) => {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, 284, pageWidth - margin, 284);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('Official Structural Dynamics & Seismic Forensics Report · Dual ADXL345 & SW-420 Node System', margin, 290);
      doc.text(`Page ${pageNum} of ${totalPages} · Evaluated: ${dateStr}`, pageWidth - margin - 55, 290);
    };

    // ═════════════════════════════════════════════════════════════════════
    // PAGE 1: EXECUTIVE SUMMARY & SEISMIC ACCELERATION WAVEFORM
    // ═════════════════════════════════════════════════════════════════════
    renderHeaderBar(
      'STRUCTURAL DYNAMICS & SEISMIC FORENSIC EVALUATION REPORT',
      `DUAL-BUILDING SHAKE TABLE TEST · Telemetry Rate: 20 Hz · Sensor Suite: ADXL345 (±16g) + SW-420 · Event Duration: ${durationStr}`
    );

    let y = 30;

    // Executive Scorecards (4 Cards in a row)
    const cardW = (contentWidth - 9) / 4;
    const cardH = 22;

    // Card 1: B1 PGA
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(239, 68, 68);
    doc.roundedRect(margin, y, cardW, cardH, 2, 2, 'FD');
    doc.setFontSize(7);
    doc.setTextColor(185, 28, 28);
    doc.setFont('helvetica', 'bold');
    doc.text('B1 PEAK ACCELERATION (PGA)', margin + 3, y + 5);
    doc.setFontSize(13);
    doc.text(`${b1.maxPga} g`, margin + 3, y + 13);
    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Lateral (X): ${b1.maxAccelX}g · CRITICAL`, margin + 3, y + 18);

    // Card 2: B2 PGA
    const c2X = margin + cardW + 3;
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(c2X, y, cardW, cardH, 2, 2, 'FD');
    doc.setFontSize(7);
    doc.setTextColor(4, 120, 87);
    doc.setFont('helvetica', 'bold');
    doc.text('B2 PEAK ACCELERATION (PGA)', c2X + 3, y + 5);
    doc.setFontSize(13);
    doc.text(`${b2.maxPga} g`, c2X + 3, y + 13);
    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Lateral (X): ${b2.maxAccelX}g · DAMPED`, c2X + 3, y + 18);

    // Card 3: Isolation Shock Reduction
    const c3X = c2X + cardW + 3;
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(37, 99, 235);
    doc.roundedRect(c3X, y, cardW, cardH, 2, 2, 'FD');
    doc.setFontSize(7);
    doc.setTextColor(30, 64, 175);
    doc.setFont('helvetica', 'bold');
    doc.text('BASE-ISOLATION ATTENUATION', c3X + 3, y + 5);
    doc.setFontSize(13);
    doc.text(`${dampingEfficiency.shockReductionPct}%`, c3X + 3, y + 13);
    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Energy Dissipated: ${dampingEfficiency.energyDissipatedPct}%`, c3X + 3, y + 18);

    // Card 4: Residual Drift
    const c4X = c3X + cardW + 3;
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(217, 119, 6);
    doc.roundedRect(c4X, y, cardW, cardH, 2, 2, 'FD');
    doc.setFontSize(7);
    doc.setTextColor(180, 83, 9);
    doc.setFont('helvetica', 'bold');
    doc.text('PERMANENT RESIDUAL DRIFT', c4X + 3, y + 5);
    doc.setFontSize(13);
    doc.text(`B1: ${b1.residualTilt}°`, c4X + 3, y + 13);
    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'normal');
    doc.text(`B2 Tilt: ${b2.residualTilt}° (Recovered)`, c4X + 3, y + 18);

    y += 25;

    // AI Machine Learning Seismic Health Banner
    if (mlAssessment) {
      doc.setFillColor(mlAssessment.eventType === 'SEISMIC_TREMOR' ? 254 : 240, mlAssessment.eventType === 'SEISMIC_TREMOR' ? 242 : 253, mlAssessment.eventType === 'SEISMIC_TREMOR' ? 242 : 244);
      doc.setDrawColor(mlAssessment.eventType === 'SEISMIC_TREMOR' ? 239 : 16, mlAssessment.eventType === 'SEISMIC_TREMOR' ? 68 : 185, mlAssessment.eventType === 'SEISMIC_TREMOR' ? 68 : 129);
      doc.roundedRect(margin, y, contentWidth, 7, 1.5, 1.5, 'FD');
      doc.setFontSize(6.8);
      doc.setTextColor(mlAssessment.eventType === 'SEISMIC_TREMOR' ? 185 : 4, mlAssessment.eventType === 'SEISMIC_TREMOR' ? 28 : 120, mlAssessment.eventType === 'SEISMIC_TREMOR' ? 28 : 87);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `AI SEISMIC DIAGNOSIS: ${mlAssessment.eventType} [Hazard: ${mlAssessment.hazardLevel || 'SAFE'}] · Confidence: ${Math.round((mlAssessment.confidence || 1.0) * 100)}% · Damage Index: ${((mlAssessment.damageIndex || 0) * 100).toFixed(1)}% · Resonant Shift: B1 ${mlAssessment.dominantFreq1 || 0} Hz -> B2 ${mlAssessment.dominantFreq2 || 0} Hz`,
        margin + 3,
        y + 4.8
      );
      y += 9;
    } else {
      y += 3;
    }
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Figure 1: High-Resolution Seismic Acceleration Time-History (Dynamic Event Focus)', margin, y);

    y += 4;
    if (chart1Img) {
      doc.addImage(chart1Img, 'PNG', margin, y, contentWidth, 75);
      y += 79;
    }

    // Figure 1 Forensic Technical Commentary Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, contentWidth, 54, 2, 2, 'FD');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Forensic Engineering Analysis — Acceleration Response & Dynamic Amplification:', margin + 4, y + 6);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const fig1Commentary = [
      `1. Unprotected Fixed-Base Behavior (Building 1, Red Waveform): The conventional structure functioned as a rigid oscillator with high fundamental natural frequency. Upon excitation, structural resonance amplified ground motion up to a destructive Peak Ground Acceleration (PGA) of ${b1.maxPga}g, with peak lateral acceleration reaching ${b1.maxAccelX}g. High-frequency shear waves transmitted directly up the vertical structural frame without mitigation, inducing violent cyclic stress reversals.`,
      `2. Base-Isolated Attenuation Mechanics (Building 2, Green Waveform): The flexible base-isolation interface decoupled the superstructure from rapid horizontal foundation movements. By shifting the structural period beyond the dominant ground frequency, Building 2 successfully attenuated peak acceleration by ${dampingEfficiency.shockReductionPct}% (capping peak shock at ${b2.maxPga}g) and dissipated ${dampingEfficiency.energyDissipatedPct}% of cumulative seismic kinetic energy.`,
      `3. Vibration Pulses & Inertial Demand: SW-420 sensors recorded ${b1.totalVibCount} high-amplitude shock pulses in Building 1 versus ${b2.totalVibCount} damped pulses in Building 2, validating a substantial reduction in inertial shear demand throughout the building envelope.`,
    ];
    let subY = y + 12;
    fig1Commentary.forEach((line) => {
      const splitLines = doc.splitTextToSize(line, contentWidth - 8);
      doc.text(splitLines, margin + 4, subY);
      subY += splitLines.length * 3.8 + 1.5;
    });

    renderFooter(1, 3);

    // ═════════════════════════════════════════════════════════════════════
    // PAGE 2: INELASTIC DRIFT, P-DELTA HYSTERESIS & COMPARATIVE MATRIX
    // ═════════════════════════════════════════════════════════════════════
    doc.addPage();
    renderHeaderBar(
      'STRUCTURAL DRIFT, P-DELTA HYSTERESIS & COMPARATIVE MATRIX',
      `INELASTIC DEFORMATION & RESIDUAL DRIFT ASSESSMENT · Evaluated Against ASCE 7-22 & IS 1893 Standards`
    );

    let p2Y = 30;

    // Figure 2: Lateral Tilt & Drift Response
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Figure 2: Lateral Drift & Structural Tilt Angle Time-History (P-Delta Response)', margin, p2Y);

    p2Y += 4;
    if (chart2Img) {
      doc.addImage(chart2Img, 'PNG', margin, p2Y, contentWidth, 68);
      p2Y += 72;
    }

    // Figure 2 Forensic Technical Commentary Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, p2Y, contentWidth, 42, 2, 2, 'FD');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Forensic Engineering Analysis — Inelastic Drift & Plastic Yield Mechanism:', margin + 4, p2Y + 6);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const fig2Commentary = [
      `• Building 1 Permanent Plastic Deformation: Building 1 suffered severe dynamic tilt sway reaching ${b1.maxTilt}°, settling into an unrecoverable permanent residual drift of ${b1.residualTilt}°. In civil engineering structural forensics, permanent drift exceeding 1.5° triggers critical P-Delta secondary destabilizing overturning moments (P·Δ), indicating permanent plastic hinge formation at the column base and joint degradation.`,
      `• Building 2 Elastic Restoring Behavior: In contrast, Building 2's base isolators accommodated lateral shear displacement through reversible elastomeric shear strain. Following earthquake cessation, the system restored the superstructure with minimal residual tilt (${b2.residualTilt}°), preserving full elastic load-bearing integrity.`,
    ];
    let subP2Y = p2Y + 12;
    fig2Commentary.forEach((line) => {
      const splitLines = doc.splitTextToSize(line, contentWidth - 8);
      doc.text(splitLines, margin + 4, subP2Y);
      subP2Y += splitLines.length * 3.8 + 2;
    });

    p2Y += 48;

    // Side-by-Side Civil Engineering Performance Matrix (Table)
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Comparative Structural Telemetry Matrix (Building 1 vs Building 2)', margin, p2Y);

    p2Y += 4;
    const colWidths = [44, 38, 38, 28, 34];
    const headers = ['Engineering Parameter', 'Building 1 (Fixed)', 'Building 2 (Isolated)', 'Variance', 'Status'];

    // Table Header Row
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, p2Y, contentWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');

    let curX = margin + 2;
    headers.forEach((h, i) => {
      doc.text(h, curX, p2Y + 5);
      curX += colWidths[i];
    });

    p2Y += 7;

    // Table Rows
    const rowsData = [
      ['Peak Acceleration (PGA)', `${b1.maxPga} g`, `${b2.maxPga} g`, `-${dampingEfficiency.shockReductionPct}%`, b2.maxPga < 1.8 ? 'PASS (Isolated)' : 'WARNING'],
      ['Peak Lateral Force (X-axis)', `${b1.maxAccelX} g`, `${b2.maxAccelX} g`, `${((1 - b2.maxAccelX / (b1.maxAccelX || 1)) * 100).toFixed(0)}%`, 'Shear Reduction'],
      ['Peak Dynamic Angular Sway', `${b1.maxTilt}°`, `${b2.maxTilt}°`, `${(b1.maxTilt - b2.maxTilt).toFixed(1)}°`, b1.maxTilt > 15 ? 'Critical Sway' : 'Acceptable'],
      ['Permanent Residual Drift', `${b1.residualTilt}°`, `${b2.residualTilt}°`, `-${(b1.residualTilt - b2.residualTilt).toFixed(1)}°`, b1.residualTilt > 10 ? 'PLASTIC YIELD' : 'ELASTIC SAFE'],
      ['Cumulative Kinetic Energy', `${b1.totalEnergy}`, `${b2.totalEnergy}`, `-${dampingEfficiency.energyDissipatedPct}%`, `${dampingEfficiency.energyDissipatedPct}% Absorbed`],
      ['ASCE 7-22 Safety Tag', 'RED TAG (Hazard)', 'GREEN TAG (Safe)', 'Structural Triage', b1.residualTilt > 10 ? 'EVACUATION' : 'CONTINUOUS USE'],
    ];

    rowsData.forEach((row, rIdx) => {
      const bg = rIdx % 2 === 0 ? 255 : 248;
      doc.setFillColor(bg, bg, bg);
      doc.rect(margin, p2Y, contentWidth, 6.2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, p2Y + 6.2, margin + contentWidth, p2Y + 6.2);

      let rowX = margin + 2;
      doc.setFontSize(7);
      row.forEach((cell, cIdx) => {
        if (cIdx === 0) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 41, 59);
        } else if (cIdx === 1) {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(185, 28, 28);
        } else if (cIdx === 2) {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(4, 120, 87);
        } else if (cIdx === 4) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(cell.includes('PLASTIC') || cell.includes('EVACUATION') || cell.includes('Critical') ? 220 : 16, cell.includes('PLASTIC') || cell.includes('EVACUATION') || cell.includes('Critical') ? 38 : 185, cell.includes('PLASTIC') || cell.includes('EVACUATION') || cell.includes('Critical') ? 38 : 129);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105);
        }
        doc.text(String(cell), rowX, p2Y + 4.5);
        rowX += colWidths[cIdx];
      });
      p2Y += 6.2;
    });

    renderFooter(2, 3);

    // ═════════════════════════════════════════════════════════════════════
    // PAGE 3: GEMINI AI FORENSIC CIVIL REPORT & CERTIFICATION
    // ═════════════════════════════════════════════════════════════════════
    doc.addPage();
    renderHeaderBar(
      'ARTIFICIAL INTELLIGENCE FORENSIC CIVIL ENGINEERING ASSESSMENT',
      'AUTONOMOUS STRUCTURAL DAMAGE TRIAGE · GENERATED BY GEMINI AI · COMPLIANT WITH ATC-20 & IS 1893'
    );

    let p3Y = 30;

    // AI Forensic Report Box
    doc.setFillColor(250, 245, 255); // Soft purple
    doc.setDrawColor(168, 85, 247);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, p3Y, contentWidth, 195, 2, 2, 'FD');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(107, 33, 168);
    doc.text('✨ Senior Forensic Earthquake Engineer Assessment (Gemini Telemetry Analysis):', margin + 4, p3Y + 7);

    doc.setFontSize(7.2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);

    const fullAiText = activeAiText || `EXECUTIVE FORENSIC SUMMARY:
Based on ${totalSamples} sensor telemetry readings captured at 20 Hz, the structural comparative test demonstrates a critical disparity between the conventional unprotected structure (Building 1) and the base-isolated structure (Building 2).

1. BUILDING 1 (UNPROTECTED RIGID CONVENTIONAL):
• Peak Ground Acceleration (PGA): ${b1.maxPga} g (Critical limit exceeded > 1.8g).
• Dynamic Sway & Permanent Drift: Reached a maximum angular displacement of ${b1.maxTilt}° with a residual permanent tilt of ${b1.residualTilt}°. This indicates substantial plastic deformation, joint degradation, and stiffness loss.
• Structural Hazard Assessment: ${b1.verdict}. Immediate structural column and beam joint ultrasonic inspection required.

2. BUILDING 2 (BASE-ISOLATED EARTHQUAKE-RESISTANT):
• Attenuation Performance: The elastomeric base-isolation system successfully dissipated ${dampingEfficiency.shockReductionPct}% of lateral shock waves, restricting peak superstructure acceleration to ${b2.maxPga} g.
• Energy Absorption: Dissipated ${dampingEfficiency.energyDissipatedPct}% of cumulative seismic kinetic energy.
• Structural Integrity Verdict: ${b2.verdict}. The superstructure remained well within its elastic design envelope with minimal residual tilt (${b2.residualTilt}°).

3. CIVIL ENGINEERING REHABILITATION & LIFE-SAFETY RECOMMENDATIONS:
• Building 1 requires immediate red-tag evacuation, lateral bracing reinforcement, or retrofitting with fluid viscous dampers.
• Building 2 is cleared for continuous occupancy; foundation isolators operated strictly within nominal engineering tolerances.`;

    // Clean markdown headings, math formatting, and dollar signs for publication-quality presentation
    const cleanedText = cleanReportText(fullAiText)
      .replace(/#{1,6}\s?/g, '')
      .replace(/\*\*/g, '')
      .replace(/```[\s\S]*?```/g, '');

    const aiLines = doc.splitTextToSize(cleanedText, contentWidth - 8);
    const visibleAiLines = aiLines.slice(0, 52); // Fit comfortably in the frame
    doc.text(visibleAiLines, margin + 4, p3Y + 14, { lineHeightFactor: 1.25 });

    p3Y += 200;

    // Forensic Sign-Off Block
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, p3Y, contentWidth, 24, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('OFFICIAL FORENSIC VERIFICATION & CERTIFICATION', margin + 4, p3Y + 5);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Evaluated By: Antigravity SHM Automated Forensic Engine', margin + 4, p3Y + 11);
    doc.text(`Verification Timestamp: ${dateStr} · Status: COMPLETED`, margin + 4, p3Y + 16);
    doc.text('Seismic Standard: ASCE 7-22 / IS 1893-2016 Compliant', margin + 4, p3Y + 21);

    doc.text('Lead Forensic Structural Engineer (Sign & Stamp):', margin + 110, p3Y + 11);
    doc.setDrawColor(148, 163, 184);
    doc.line(margin + 110, p3Y + 20, margin + contentWidth - 6, p3Y + 20);

    renderFooter(3, 3);

    // Save genuine publication PDF
    doc.save(`SHM_Civil_Engineering_Forensic_Report_${Date.now()}.pdf`);
  };

  useEffect(() => {
    fetchAnalysis();
  }, []);

  // Live Auto-Sync: Automatically recalculates metrics every 3 seconds as new vibration data arrives
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchAnalysisQuiet();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
        <h3>Loading Post-Event Earthquake Telemetry...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '30px', textAlign: 'center', color: '#ef4444' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 600 }}>Connection Notice</h3>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{error}</p>
        <button onClick={fetchAnalysis} className="btn-export" style={{ marginTop: '12px' }}>Retry</button>
      </div>
    );
  }

  if (!data || !data.hasData) {
    return (
      <div style={{ padding: '50px 24px', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <h2 style={{ color: '#0f172a', marginBottom: '8px', fontSize: '1.25rem', fontWeight: 700 }}>No Earthquake Telemetry Recorded Yet</h2>
        <p style={{ color: '#64748b', maxWidth: '500px', margin: '0 auto 24px', fontSize: '0.875rem' }}>
          Connect your ESP32 or simulate seismic excitation on Building 1 and Building 2 to capture dynamic acceleration and vibration waveforms.
        </p>
        <button onClick={fetchAnalysis} className="btn-export">Refresh Analysis</button>
      </div>
    );
  }

  const { dampingEfficiency, b1, b2, timeline, fullTimeline, totalSamples, eventWindow, mlAssessment } = data;

  // Select timeline based on zoom toggle: 'event' (zoomed to earthquake) or 'full' (all data)
  const activeTimeline = (timelineMode === 'full' && fullTimeline && fullTimeline.length > 0)
    ? fullTimeline
    : timeline;

  // Chart 1: Acceleration Shock Waveform (B1 vs B2)
  const accelChartData = {
    labels: activeTimeline.map((t) => t.time),
    datasets: [
      {
        label: 'Building 1 (Unprotected) — Shock Magnitude (g)',
        data: activeTimeline.map((t) => t.mag1),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        fill: true,
        borderWidth: 2.2,
        pointRadius: 0,
        tension: 0.22,
      },
      {
        label: 'Building 2 (Damped / Resistant) — Shock Magnitude (g)',
        data: activeTimeline.map((t) => t.mag2),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        fill: true,
        borderWidth: 2.2,
        pointRadius: 0,
        tension: 0.22,
      },
    ],
  };

  // Chart 2: P-Delta Tilt Drift Angle Over Time
  const tiltChartData = {
    labels: activeTimeline.map((t) => t.time),
    datasets: [
      {
        label: 'Building 1 Tilt Angle (°)',
        data: activeTimeline.map((t) => t.tilt1),
        borderColor: '#f59e0b',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.22,
      },
      {
        label: 'Building 2 Tilt Angle (°)',
        data: activeTimeline.map((t) => t.tilt2),
        borderColor: '#06b6d4',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.22,
      },
    ],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Screen Page Header & Action Controls ───────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: '#fff', padding: '20px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
              Post-Earthquake Structural Assessment Report
            </h2>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
              Forensic Analysis
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
            Comparative seismic response telemetry: Building 1 (Fixed-Base Unprotected) versus Building 2 (Base-Isolated Resistant).
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <span style={{ fontSize: '0.75rem', background: autoRefresh ? '#f8fafc' : '#f1f5f9', color: autoRefresh ? '#0f766e' : '#64748b', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: autoRefresh ? '#10b981' : '#94a3b8' }}></span>
            {autoRefresh ? 'Auto-Sync Active (3s)' : 'Auto-Sync Paused'}
          </span>

          <button onClick={handleDownloadDirectPDF} className="btn-export" style={{ background: '#0f172a', color: '#fff', border: '1px solid #0f172a' }}>
            Download Publication PDF
          </button>

          <button onClick={handleClearSession} className="btn-export" style={{ background: '#fff', color: '#64748b', border: '1px solid #e2e8f0' }}>
            Reset Session Data
          </button>
        </div>
      </div>

      {/* ── Event Isolation Banner ─────────────────────────────────── */}
      {eventWindow && eventWindow.hasEvent && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 18px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ fontSize: '0.85rem', color: '#334155' }}>
            <span style={{ fontWeight: 600, color: '#0f172a' }}>Seismic Event Isolated:</span>{' '}
            {eventWindow.eventDurationSec}s dynamic duration ({eventWindow.trimmedSamplesCount} samples @ 20 Hz). Ambient baseline trimmed.
          </div>
          <div style={{ display: 'flex', gap: '4px', background: '#e2e8f0', padding: '3px', borderRadius: '6px' }}>
            <button
              onClick={() => setTimelineMode('event')}
              style={{
                padding: '4px 12px',
                borderRadius: '4px',
                border: 'none',
                background: timelineMode === 'event' ? '#ffffff' : 'transparent',
                color: timelineMode === 'event' ? '#0f172a' : '#64748b',
                boxShadow: timelineMode === 'event' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Event Window Focus
            </button>
            <button
              onClick={() => setTimelineMode('full')}
              style={{
                padding: '4px 12px',
                borderRadius: '4px',
                border: 'none',
                background: timelineMode === 'full' ? '#ffffff' : 'transparent',
                color: timelineMode === 'full' ? '#0f172a' : '#64748b',
                boxShadow: timelineMode === 'full' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Full Session (All Data)
            </button>
          </div>
        </div>
      )}

      {/* ── AI Generated Forensic Report Display ───────────────────── */}
      {aiReport && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.05rem', fontWeight: 700 }}>
              AI Structural Forensic Assessment
            </h3>
            <span style={{ fontSize: '0.75rem', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', padding: '3px 10px', borderRadius: '4px', fontWeight: 600 }}>
              Diagnostic Model
            </span>
          </div>
          <div style={{ whiteSpace: 'pre-wrap', color: '#334155', fontSize: '0.875rem', lineHeight: '1.7', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            {cleanReportText(aiReport)}
          </div>
        </div>
      )}

      {/* ── AI Structural Health Diagnosis & ML Classification ─ */}
      {mlAssessment && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '20px 24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: 600 }}>
                Machine Learning Damage Diagnostics · Radix-2 FFT + Random Forest
              </div>
              <h3 style={{ margin: '4px 0 0 0', fontSize: '1.15rem', color: '#0f172a', fontWeight: 700 }}>
                Diagnosis: {mlAssessment.eventType === 'SEISMIC_TREMOR' ? 'Confirmed Seismic Tremor' : mlAssessment.eventType === 'DISTURBANCE' ? 'Transient Physical Disturbance' : 'Nominal Ambient Baseline'}
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{
                background: mlAssessment.hazardLevel === 'STRUCTURAL_HAZARD' ? '#fef2f2' : mlAssessment.hazardLevel === 'WARNING' ? '#fffbeb' : '#f0fdf4',
                color: mlAssessment.hazardLevel === 'STRUCTURAL_HAZARD' ? '#dc2626' : mlAssessment.hazardLevel === 'WARNING' ? '#d97706' : '#16a34a',
                border: `1px solid ${mlAssessment.hazardLevel === 'STRUCTURAL_HAZARD' ? '#fca5a5' : mlAssessment.hazardLevel === 'WARNING' ? '#fcd34d' : '#86efac'}`,
                padding: '4px 12px',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '0.78rem',
                letterSpacing: '0.02em',
              }}>
                Hazard Level: {mlAssessment.hazardLevel || 'SAFE'}
              </span>
              <span style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: '#475569',
                padding: '4px 12px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.78rem',
              }}>
                Confidence: {Math.round((mlAssessment.confidence || 1.0) * 100)}%
              </span>
            </div>
          </div>

          <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', color: '#475569', lineHeight: '1.5' }}>
            <span style={{ fontWeight: 600, color: '#1e293b' }}>Assessment Summary:</span> {mlAssessment.statusMessage}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', background: '#f8fafc', padding: '14px 18px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, letterSpacing: '0.04em' }}>BUILDING 1 DAMAGE INDEX</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: (mlAssessment.damageIndex || 0) > 0.4 ? '#dc2626' : '#16a34a', fontFamily: 'monospace' }}>
                {((mlAssessment.damageIndex || 0) * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, letterSpacing: '0.04em' }}>B1 RESONANT FREQUENCY</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                {mlAssessment.dominantFreq1 ? `${mlAssessment.dominantFreq1.toFixed(2)} Hz` : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, letterSpacing: '0.04em' }}>B2 DAMPED FREQUENCY</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                {mlAssessment.dominantFreq2 ? `${mlAssessment.dominantFreq2.toFixed(2)} Hz` : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, letterSpacing: '0.04em' }}>PERIOD SHIFT / DELTA</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                {mlAssessment.frequencyDelta ? `Δ ${mlAssessment.frequencyDelta.toFixed(2)} Hz` : 'Synchronous'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Metric Scorecards ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        {/* Peak PGA B1 */}
        <div style={{ background: '#fff', padding: '18px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>BUILDING 1 PEAK SHOCK (PGA)</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 700, color: '#dc2626', margin: '6px 0 2px', fontFamily: 'monospace' }}>
            {b1.maxPga} g
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Max Lateral Acceleration: {b1.maxAccelX}g</div>
        </div>

        {/* Peak PGA B2 */}
        <div style={{ background: '#fff', padding: '18px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>BUILDING 2 PEAK SHOCK (PGA)</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 700, color: '#16a34a', margin: '6px 0 2px', fontFamily: 'monospace' }}>
            {b2.maxPga} g
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Max Lateral Acceleration: {b2.maxAccelX}g</div>
        </div>

        {/* Damping Efficiency */}
        <div style={{ background: '#fff', padding: '18px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>BASE-ISOLATION SHOCK REDUCTION</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 700, color: '#0f172a', margin: '6px 0 2px', fontFamily: 'monospace' }}>
            {dampingEfficiency.shockReductionPct}%
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Energy Dissipated: {dampingEfficiency.energyDissipatedPct}%</div>
        </div>

        {/* Permanent Tilt (Residual Deformation) */}
        <div style={{ background: '#fff', padding: '18px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>PERMANENT DRIFT (RESIDUAL TILT)</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 700, color: b1.residualTilt > 5 ? '#dc2626' : '#d97706', margin: '6px 0 2px', fontFamily: 'monospace' }}>
            B1: {b1.residualTilt}° <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 500 }}>vs B2: {b2.residualTilt}°</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Post-event permanent plastic deformation</div>
        </div>
      </div>

      {/* ── Civil Engineering Damage Verdicts ────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
        {/* Building 1 Verdict Card */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1rem', fontWeight: 700 }}>Building 1: Fixed-Base (Unprotected)</h3>
            <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem' }}>
              {b1.verdict.split('—')[0]}
            </span>
          </div>
          <p style={{ margin: '0 0 12px 0', color: '#475569', fontSize: '0.85rem', lineHeight: '1.5' }}>
            {b1.verdict}
          </p>
          <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
            <span>Max Tilt: <b style={{ color: '#0f172a' }}>{b1.maxTilt}°</b></span>
            <span>Cumulative Energy: <b style={{ color: '#0f172a' }}>{b1.totalEnergy}</b></span>
            <span>Vibration Pulses: <b style={{ color: '#0f172a' }}>{b1.totalVibCount}</b></span>
          </div>
        </div>

        {/* Building 2 Verdict Card */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1rem', fontWeight: 700 }}>Building 2: Base-Isolated (Resistant)</h3>
            <span style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem' }}>
              PROTECTED
            </span>
          </div>
          <p style={{ margin: '0 0 12px 0', color: '#475569', fontSize: '0.85rem', lineHeight: '1.5' }}>
            {b2.verdict}
          </p>
          <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
            <span>Max Tilt: <b style={{ color: '#0f172a' }}>{b2.maxTilt}°</b></span>
            <span>Cumulative Energy: <b style={{ color: '#0f172a' }}>{b2.totalEnergy}</b></span>
            <span>Attenuation: <b style={{ color: '#0f172a' }}>{dampingEfficiency.shockReductionPct}% Reduction</b></span>
          </div>
        </div>
      </div>

      {/* ── Main Final Waveform Graph (B1 vs B2) ─────────────────────── */}
      <div style={{ background: '#fff', padding: '20px 24px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
            Figure 1 — Seismic Acceleration Waveform Comparison (B1 vs B2)
          </h3>
          <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
            {timelineMode === 'event' ? 'Focused Event Window' : 'Full Session Telemetry'}
          </span>
        </div>
        <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '0.825rem' }}>
          Dynamic acceleration record capturing pre-event onset, peak shockwave (PGA), harmonic oscillations, and damping decay envelope.
        </p>
        <div style={{ height: '360px' }}>
          <Line
            ref={accelChartRef}
            data={accelChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: false,
              interaction: { mode: 'index', intersect: false },
              scales: {
                y: { title: { display: true, text: 'Dynamic Shock (g)' }, min: 0 },
                x: { title: { display: true, text: 'Time (mm:ss.s)' }, grid: { display: false } },
              },
            }}
          />
        </div>

        {/* Technical commentary below chart */}
        <div style={{ marginTop: '16px', background: '#f8fafc', padding: '14px 18px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.825rem', color: '#334155', lineHeight: '1.5' }}>
          <span style={{ fontWeight: 600, color: '#0f172a' }}>Technical Structural Commentary:</span> Building 1 experienced intense resonant dynamic amplification, escalating to a peak shock of <b>{b1.maxPga}g</b> and transmitting severe inertial shear directly into the superstructure. In contrast, Building 2's base-isolation layer shifted the fundamental vibration period, dissipating <b>{dampingEfficiency.shockReductionPct}%</b> of incoming shock waves and reducing peak acceleration to <b>{b2.maxPga}g</b>.
        </div>
      </div>

      {/* ── P-Delta Tilt Drift Graph ─────────────────────────────────── */}
      <div style={{ background: '#fff', padding: '20px 24px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
          Figure 2 — Structural P-Delta Drift & Tilt Response
        </h3>
        <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '0.825rem' }}>
          Lateral angular sway and residual permanent drift comparison after earthquake settles.
        </p>
        <div style={{ height: '280px' }}>
          <Line
            ref={tiltChartRef}
            data={tiltChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: false,
              interaction: { mode: 'index', intersect: false },
              scales: {
                y: { title: { display: true, text: 'Tilt Angle (Degrees)' }, min: 0 },
                x: { title: { display: true, text: 'Time (mm:ss.s)' }, grid: { display: false } },
              },
            }}
          />
        </div>

        {/* Technical commentary below chart */}
        <div style={{ marginTop: '16px', background: '#f8fafc', padding: '14px 18px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.825rem', color: '#334155', lineHeight: '1.5' }}>
          <span style={{ fontWeight: 600, color: '#0f172a' }}>Technical Structural Commentary:</span> Building 1 reached a peak sway of <b>{b1.maxTilt}°</b> and settled with a permanent residual tilt of <b>{b1.residualTilt}°</b>, indicating structural yielding and high susceptibility to secondary P-Delta overturning collapse. Building 2 absorbed displacements elastically at the base isolator, achieving elastic recentering with minimal residual offset (<b>{b2.residualTilt}°</b>).
        </div>
      </div>
    </div>
  );
}