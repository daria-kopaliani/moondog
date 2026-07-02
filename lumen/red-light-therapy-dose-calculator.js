// Red light therapy dose calculator — ported from apps/lumen/Lumen/Lumen/DoseMath.swift.
// SAFETY / DOSE DOMAIN: the biphasic-window bands match DoseMath.biphasicBand
// EXACTLY and are NEVER more permissive than the app. Photobiomodulation (PBM)
// has a therapeutic window — too little does nothing, too much can reduce or
// reverse the effect (Arndt-Schulz / biphasic dose response).
//
// Free-tier scope: the canonical J/cm² dose formula and its inverse
// (minutes to a target dose from a panel's irradiance). The app's brand-aware
// irradiance preset library (Mito Red / Joovv / GembaRed, lab-audited values),
// inverse-square distance scaling, and per-target cumulative-dose tracking are
// the paid moat and are intentionally NOT ported here.
//
// Sources: Huang YY, Sharma SK, Carroll J, Hamblin MR (2011), "Biphasic dose
// response in low level light therapy — an update," Dose Response 9(4):602-18,
// PMID 22461763; PMC11991943 (2025) 5–10 J/cm² therapeutic-window framing;
// Frankowski et al. 2025 (PMC12181550) Arndt-Schulz framing; Mito Red LightLab
// International ISO/IEC 17025 (NVLAP 201079-0) irradiance citation chain.

(function (global) {
  'use strict';

  // --- Canonical PBM dose (DoseMath.dose) ---
  // J/cm² = irradiance (mW/cm²) × duration (s) / 1000.
  // Huang/Hamblin 2011 worked example: 55 mW/cm² × 16 s = 0.88 J/cm².
  function dose(irradianceMWcm2, durationSec) {
    return irradianceMWcm2 * durationSec / 1000.0;
  }

  // --- Inverse: seconds / minutes to reach a target dose at a given irradiance ---
  // From dose = irr × t / 1000  →  t(s) = target(J/cm²) × 1000 / irr(mW/cm²).
  function secondsToTargetDose(targetDoseJcm2, irradianceMWcm2) {
    return irradianceMWcm2 > 0 ? targetDoseJcm2 * 1000.0 / irradianceMWcm2 : Infinity;
  }
  function minutesToTargetDose(targetDoseJcm2, irradianceMWcm2) {
    return secondsToTargetDose(targetDoseJcm2, irradianceMWcm2) / 60.0;
  }

  // --- Biphasic-window band (DoseMath.biphasicBand + BiphasicBand) ---
  // Boundaries ported EXACTLY from the Swift switch. Never widened.
  //   < 1.0        belowTherapeutic
  //   1.0 –  <10.0 therapeuticLow      (most-cited 5–10 J/cm² window, PMC11991943)
  //   10.0 – <50.0 therapeuticExtended
  //   50.0 – <60.0 overshootCaution
  //   >= 60.0      overshootHigh
  var BANDS = {
    belowTherapeutic:    { key: 'belowTherapeutic',    label: 'Below therapeutic',      level: 'below', cite: 'PMC11991943 (below the 5–10 J/cm² low therapeutic window)' },
    therapeuticLow:      { key: 'therapeuticLow',      label: 'Low therapeutic window', level: 'ok',    cite: 'PMC11991943 (5–10 J/cm² low therapeutic window)' },
    therapeuticExtended: { key: 'therapeuticExtended', label: 'Extended therapeutic',   level: 'ok',    cite: 'Huang/Hamblin 2011 PMID 22461763 (extended therapeutic range)' },
    overshootCaution:    { key: 'overshootCaution',    label: 'Caution',                level: 'warn',  cite: 'Huang/Hamblin 2011 PMID 22461763 (Arndt-Schulz biphasic descent)' },
    overshootHigh:       { key: 'overshootHigh',       label: 'Overshoot risk',         level: 'stop',  cite: 'Huang/Hamblin 2011 PMID 22461763 (Arndt-Schulz biphasic descent)' }
  };

  function biphasicBandKey(doseJcm2) {
    if (doseJcm2 < 1.0)  return 'belowTherapeutic';
    if (doseJcm2 < 10.0) return 'therapeuticLow';
    if (doseJcm2 < 50.0) return 'therapeuticExtended';
    if (doseJcm2 < 60.0) return 'overshootCaution';
    return 'overshootHigh';
  }
  function biphasicBand(doseJcm2) { return BANDS[biphasicBandKey(doseJcm2)]; }

  var api = {
    dose: dose,
    secondsToTargetDose: secondsToTargetDose,
    minutesToTargetDose: minutesToTargetDose,
    biphasicBand: biphasicBand,
    biphasicBandKey: biphasicBandKey,
    BANDS: BANDS
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  global.LumenCalc = api;

  // --- Browser UI (skipped under node) ---
  if (typeof document === 'undefined') return;

  function fmt(n, dp) { return (Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp)).toLocaleString('en-US'); }

  function durationLabel(totalSec) {
    var s = Math.round(totalSec);
    var m = Math.floor(s / 60);
    var r = s % 60;
    if (m > 0 && r > 0) return m + ' min ' + r + ' s';
    if (m > 0) return m + ' min';
    return r + ' s';
  }

  function bandWarnHTML(band) {
    if (band.level === 'ok') return '';
    if (band.level === 'below') {
      return '<div class="warn"><strong>Below the therapeutic window.</strong> Under ~1 J/cm² most PBM effects are sub-threshold (Arndt-Schulz). Increase time or move closer, then re-check. ' + band.cite + '.</div>';
    }
    if (band.level === 'warn') {
      return '<div class="warn"><strong>Caution — nearing overshoot.</strong> 50–60 J/cm² per session is where reduced or reversed effects start to be reported. More is not better in PBM. ' + band.cite + '.</div>';
    }
    return '<div class="warn stop"><strong>Overshoot risk.</strong> Above ~60 J/cm² a single session is in the biphasic descent zone — higher dose can reduce or reverse the therapeutic effect. Cut your time or distance. ' + band.cite + '.</div>';
  }

  function ready() {
    // 1. Dose from irradiance × time
    var irr1 = document.getElementById('irr1');
    var minIn = document.getElementById('minIn');
    var out1 = document.getElementById('out1');

    function render1() {
      var irr = parseFloat(irr1.value);
      var mins = parseFloat(minIn.value);
      if (!isFinite(irr) || !isFinite(mins) || irr <= 0 || mins < 0) { out1.hidden = true; return; }
      var d = dose(irr, mins * 60);
      var band = biphasicBand(d);
      out1.hidden = false;
      out1.innerHTML =
        '<div class="big">' + fmt(d, 2) + ' J/cm²</div>' +
        '<table><tbody>' +
        '<tr><td>Band</td><td class="num">' + band.label + '</td></tr>' +
        '<tr><td>Irradiance × time</td><td class="num">' + fmt(irr, 1) + ' mW/cm² × ' + fmt(mins, 1) + ' min</td></tr>' +
        '</tbody></table>' +
        bandWarnHTML(band) +
        '<div class="cite">J/cm² = mW/cm² × seconds ÷ 1000. Band per ' + band.cite + '.</div>';
    }
    irr1.addEventListener('input', render1);
    minIn.addEventListener('input', render1);

    // 2. Minutes to a target dose
    var irr2 = document.getElementById('irr2');
    var targetIn = document.getElementById('targetIn');
    var out2 = document.getElementById('out2');

    function render2() {
      var irr = parseFloat(irr2.value);
      var target = parseFloat(targetIn.value);
      if (!isFinite(irr) || !isFinite(target) || irr <= 0 || target <= 0) { out2.hidden = true; return; }
      var mins = minutesToTargetDose(target, irr);
      var secs = secondsToTargetDose(target, irr);
      var band = biphasicBand(target);
      out2.hidden = false;
      out2.innerHTML =
        '<div class="big">' + durationLabel(secs) + '</div>' +
        '<table><tbody>' +
        '<tr><td>Time to reach ' + fmt(target, 1) + ' J/cm²</td><td class="num">' + fmt(mins, 1) + ' min</td></tr>' +
        '<tr><td>Target dose band</td><td class="num">' + band.label + '</td></tr>' +
        '</tbody></table>' +
        bandWarnHTML(band) +
        '<div class="cite">time (s) = target J/cm² × 1000 ÷ mW/cm². Band per ' + band.cite + '.</div>';
    }
    irr2.addEventListener('input', render2);
    targetIn.addEventListener('input', render2);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();

})(typeof globalThis !== 'undefined' ? globalThis : this);
