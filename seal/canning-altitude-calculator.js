// Canning altitude calculator — ported from apps/seal/Seal/Seal/Altitude.swift.
// SAFETY DOMAIN: bounds match the USDA Complete Guide Part 1 tables exactly and
// are NEVER more permissive than the app. Rounds UP to the safe bracket only.
// Sources: USDA Complete Guide to Home Canning Part 1 (via NCHFP); SDSU Extension.

(function (global) {
  'use strict';

  // Pressure-canner bands (inclusive upper bound), USDA Part 1. dial/weighted PSI.
  var PRESSURE_BANDS = [
    { lo: 0,    hi: 1000,  dial: 11, weighted: 10 },
    { lo: 1001, hi: 2000,  dial: 11, weighted: 15 },
    { lo: 2001, hi: 4000,  dial: 12, weighted: 15 },
    { lo: 4001, hi: 6000,  dial: 13, weighted: 15 },
    { lo: 6001, hi: 8000,  dial: 14, weighted: 15 },
    { lo: 8001, hi: 10000, dial: 15, weighted: 15 }
  ];

  var USDA_MAX_FT = 10000;

  // Below 0 ft treated as sea level (matches Altitude.pressureBand: max(0, ...)).
  function pressureBand(altitudeFt) {
    var ft = Math.max(0, Math.floor(altitudeFt));
    for (var i = 0; i < PRESSURE_BANDS.length; i++) {
      if (ft >= PRESSURE_BANDS[i].lo && ft <= PRESSURE_BANDS[i].hi) return PRESSURE_BANDS[i];
    }
    return PRESSURE_BANDS[PRESSURE_BANDS.length - 1]; // above 10,000 ft — UI flags
  }

  // canningPSI(altitudeFt, gauge) — gauge = 'dial' | 'weighted'
  function canningPSI(altitudeFt, gauge) {
    var b = pressureBand(altitudeFt);
    return gauge === 'weighted' ? b.weighted : b.dial;
  }

  // Water-bath: minutes to ADD to the recipe's base time (Altitude.waterBathTimeAdditionMinutes).
  function waterBathTimeAdditionMinutes(altitudeFt) {
    if (altitudeFt < 1001) return 0;
    if (altitudeFt < 3001) return 5;
    if (altitudeFt < 6001) return 10;
    if (altitudeFt < 8001) return 15;
    return 20; // 8,001+ ft; above 10,000 the UI flags out-of-coverage
  }

  function waterBathProcessingMinutes(baseMinutes, altitudeFt) {
    return baseMinutes + waterBathTimeAdditionMinutes(altitudeFt);
  }

  // Warning: weighted-gauge step at 1,001 ft (10 → 15). Beginner trap.
  function nearWeightedGaugeStepAt1001(altitudeFt, slackFt) {
    return Math.abs(altitudeFt - 1000) <= (slackFt == null ? 200 : slackFt);
  }

  // Warning: within slack of a USDA bracket boundary (GPS error may flip bracket).
  function nearBracketBoundary(altitudeFt, slackFt) {
    var slack = slackFt == null ? 100 : slackFt;
    var boundaries = [1000, 2000, 3000, 4000, 6000, 8000, 10000];
    return boundaries.some(function (b) { return Math.abs(altitudeFt - b) <= slack; });
  }

  function aboveUsdaCoverage(altitudeFt) { return altitudeFt > USDA_MAX_FT; }

  var api = {
    canningPSI: canningPSI,
    waterBathTimeAdditionMinutes: waterBathTimeAdditionMinutes,
    waterBathProcessingMinutes: waterBathProcessingMinutes,
    nearWeightedGaugeStepAt1001: nearWeightedGaugeStepAt1001,
    nearBracketBoundary: nearBracketBoundary,
    aboveUsdaCoverage: aboveUsdaCoverage,
    USDA_MAX_FT: USDA_MAX_FT
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  global.SealCalc = api;

  if (typeof document === 'undefined') return;

  function ready() {
    var altFt = document.getElementById('altFt');
    var gauge = document.getElementById('gauge');
    var out = document.getElementById('altOut');

    function render() {
      if (altFt.value === '') { out.hidden = true; return; }
      var ft = parseFloat(altFt.value);
      if (!isFinite(ft)) { out.hidden = true; return; }
      out.hidden = false;

      var add = waterBathTimeAdditionMinutes(ft);
      var dial = canningPSI(ft, 'dial');
      var weighted = canningPSI(ft, 'weighted');
      var g = gauge.value;
      var chosenPsi = g === 'weighted' ? weighted : dial;

      var html = '<div class="big">At ' + Math.max(0, Math.round(ft)).toLocaleString('en-US') + ' ft</div>' +
        '<table><tbody>' +
        '<tr><td>Water bath — add to process time</td><td class="num">+' + add + ' min</td></tr>' +
        '<tr><td>Pressure — ' + (g === 'weighted' ? 'weighted gauge' : 'dial gauge') + '</td><td class="num">' + chosenPsi + (g === 'weighted' ? ' lb' : ' psi') + '</td></tr>' +
        '</tbody></table>' +
        '<div class="cite">Dial ' + dial + ' psi · Weighted ' + weighted + ' lb. Add water-bath minutes to the recipe’s sea-level time; pressure-canning time is unchanged by altitude. USDA Complete Guide Part 1.</div>';

      if (aboveUsdaCoverage(ft)) {
        html += '<div class="warn stop"><strong>Above 10,000 ft — off the USDA table.</strong> These figures are the 8,001–10,000 ft bracket and are <em>not</em> validated for your altitude. Contact <a href="https://nchfp.uga.edu/">NCHFP</a> or your local Extension office before canning.</div>';
      } else if (g === 'weighted' && nearWeightedGaugeStepAt1001(ft) && ft > 1000) {
        html += '<div class="warn"><strong>Weighted-gauge step.</strong> Above 1,000 ft a weighted gauge must be set to <strong>15 lb</strong> (there is no 11–14 lb weight) — not 10. Easy to miss just over the line.</div>';
      } else if (nearBracketBoundary(ft)) {
        html += '<div class="warn">You’re near a bracket boundary. If your altitude reading could be off, use the <strong>higher</strong> bracket to stay safe.</div>';
      }
      out.innerHTML = html;
    }
    altFt.addEventListener('input', render);
    gauge.addEventListener('change', render);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();

})(typeof globalThis !== 'undefined' ? globalThis : this);
