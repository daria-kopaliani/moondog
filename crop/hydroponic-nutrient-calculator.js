// Hydroponic nutrient calculator — ported from apps/crop (Swift).
// Sources: ChemistryUnits.swift (EC/ppm + oxide factors), PlantRecipes.swift
// (crop targets). The salt-weight solver (Solver.swift) is the app's paid moat
// and is intentionally NOT ported here — this page is free-tier only.
// Cited: Cornell CEA (Mattson & Lieth), Penn State Extension, UF/IFAS,
// Produce Grower; oxide factors from IUPAC 2021 atomic weights.

(function (global) {
  'use strict';

  // --- EC ↔ ppm (ChemistryUnits.ecToPpm / ppmToEC) ---
  // ppm = EC(mS/cm) × scale multiplier; scale is a calibration choice, not chemistry.
  function ecToPpm(ec, scale) { return ec * scale; }
  function ppmToEc(ppm, scale) { return scale > 0 ? ppm / scale : 0; }

  // --- Oxide % → elemental % (ChemistryUnits.OxideForm.toElementFactor) ---
  var OXIDE_FACTOR = { K2O: 0.8301, P2O5: 0.4364, CaO: 0.7147, MgO: 0.6030 };
  function oxideToElement(oxidePercent, form) { return oxidePercent * OXIDE_FACTOR[form]; }

  // --- Crop targets (PlantRecipes.swift). ppm as [lower, upper]; equal = point. ---
  // depth "full" = every macro published; "broad" = EC band + N anchor, rest general.
  var CROP_TARGETS = [
    { id: 'lettuce-seedling', name: 'Lettuce — seedling', N:[75,100], P:[50,50], K:[100,140], Ca:[100,140], Mg:[40,40], ec:[0.8,1.2], ph:[5.6,6.0], depth:'full', cite:'Cornell CEA (Mattson & Lieth) — lettuce seedling' },
    { id: 'lettuce-vegetative', name: 'Lettuce — mature head', N:[150,150], P:[50,50], K:[210,210], Ca:[200,200], Mg:[50,50], ec:[1.4,1.8], ph:[5.6,6.0], depth:'full', cite:'Cornell CEA (Mattson & Lieth) — lettuce mature head' },
    { id: 'tomato-seedling', name: 'Tomato — seedling', N:[100,120], P:[40,40], K:[150,150], Ca:[150,150], Mg:[50,50], ec:[1.2,1.6], ph:[5.8,6.2], depth:'full', cite:'Penn State Extension — tomato seedling' },
    { id: 'tomato-vegetative', name: 'Tomato — vegetative', N:[170,170], P:[50,50], K:[210,210], Ca:[180,180], Mg:[50,50], ec:[1.8,2.2], ph:[5.8,6.2], depth:'full', cite:'UF/IFAS — tomato vegetative (Sonneveld base)' },
    { id: 'tomato-fruiting', name: 'Tomato — fruiting', N:[190,190], P:[50,50], K:[310,310], Ca:[200,200], Mg:[60,60], ec:[2.2,2.8], ph:[5.8,6.2], depth:'full', cite:'UF/IFAS — tomato fruiting (Sonneveld base)' },
    { id: 'basil-vegetative', name: 'Basil — vegetative', N:[150,150], P:[40,40], K:[180,180], Ca:[140,140], Mg:[40,40], ec:[1.4,1.8], ph:[5.5,6.0], depth:'full', cite:'Penn State Extension — modified Sonneveld (basil)' },
    { id: 'leafy-herbs-vegetative', name: 'Leafy herbs — vegetative', N:[140,140], P:[40,40], K:[170,170], Ca:[140,140], Mg:[40,40], ec:[1.4,1.8], ph:[5.5,6.0], depth:'full', cite:'Penn State Extension — modified Sonneveld (leafy herbs)' },
    { id: 'cucumber-vegetative', name: 'Cucumber — vegetative', N:[180,180], P:[50,50], K:[220,220], Ca:[180,180], Mg:[50,50], ec:[1.8,2.4], ph:[5.8,6.2], depth:'broad', cite:'UF/IFAS — cucumber (broad guidance)' },
    { id: 'pepper-vegetative', name: 'Pepper — vegetative', N:[170,170], P:[50,50], K:[220,220], Ca:[170,170], Mg:[50,50], ec:[1.8,2.4], ph:[5.8,6.2], depth:'broad', cite:'Cornell CEA — pepper (broad guidance)' },
    { id: 'strawberry-fruiting', name: 'Strawberry — fruiting', N:[120,120], P:[40,40], K:[200,200], Ca:[150,150], Mg:[45,45], ec:[1.2,1.8], ph:[5.8,6.2], depth:'broad', cite:'UF/IFAS — strawberry (broad guidance)' },
    { id: 'leafy-greens-vegetative', name: 'Leafy greens — vegetative', N:[120,160], P:[45,45], K:[180,180], Ca:[160,160], Mg:[45,45], ec:[1.2,1.8], ph:[5.8,6.2], depth:'broad', cite:'Penn State Extension — leafy greens (broad guidance)' },
    { id: 'microgreens-range', name: 'Microgreens — range', N:[75,150], P:[40,40], K:[100,200], Ca:[80,160], Mg:[null,null], ec:[1.0,1.8], ph:[5.8,6.2], depth:'broad', cite:'Produce Grower — commercial microgreens range' }
  ];

  var api = { ecToPpm: ecToPpm, ppmToEc: ppmToEc, oxideToElement: oxideToElement, OXIDE_FACTOR: OXIDE_FACTOR, CROP_TARGETS: CROP_TARGETS };

  // Node export for the fixture test.
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  global.CropCalc = api;

  // --- Browser UI (skipped under node) ---
  if (typeof document === 'undefined') return;

  function fmt(n, dp) { return (Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp)).toLocaleString('en-US'); }
  function ppmStr(pair) {
    if (pair[0] === null) return '—';
    return pair[0] === pair[1] ? fmt(pair[0], 0) : fmt(pair[0], 0) + '–' + fmt(pair[1], 0);
  }

  function ready() {
    // 1. EC ↔ ppm
    var ecScale = document.getElementById('ecScale');
    var ecIn = document.getElementById('ecIn');
    var ppmIn = document.getElementById('ppmIn');
    var ecOut = document.getElementById('ecOut');

    function renderEc(from) {
      var scale = parseFloat(ecScale.value);
      var ec, ppm;
      if (from === 'ppm' && ppmIn.value !== '') {
        ppm = parseFloat(ppmIn.value); ec = ppmToEc(ppm, scale);
        if (isFinite(ec)) ecIn.value = fmt(ec, 2);
      } else if (ecIn.value !== '') {
        ec = parseFloat(ecIn.value); ppm = ecToPpm(ec, scale);
        if (isFinite(ppm)) ppmIn.value = fmt(ppm, 0);
      } else { ecOut.hidden = true; return; }
      if (!isFinite(ec) || ec < 0) { ecOut.hidden = true; return; }
      ecOut.hidden = false;
      ecOut.innerHTML =
        '<div class="big">EC ' + fmt(ec, 2) + ' mS/cm</div>' +
        '<table><tbody>' +
        '<tr><td>500 scale (Hanna / Bluelab)</td><td class="num">' + fmt(ecToPpm(ec, 500), 0) + ' ppm</td></tr>' +
        '<tr><td>640 scale (European)</td><td class="num">' + fmt(ecToPpm(ec, 640), 0) + ' ppm</td></tr>' +
        '<tr><td>700 scale (US hydroponic)</td><td class="num">' + fmt(ecToPpm(ec, 700), 0) + ' ppm</td></tr>' +
        '</tbody></table>' +
        '<div class="cite">ppm = EC × scale factor. The same solution shows a different ppm on each scale — EC is the fixed value.</div>';
    }
    ecScale.addEventListener('change', function () { renderEc('ec'); });
    ecIn.addEventListener('input', function () { renderEc('ec'); });
    ppmIn.addEventListener('input', function () { renderEc('ppm'); });

    // 2. Oxide → element
    var lblIds = { N: 'lblN', P2O5: 'lblP2O5', K2O: 'lblK2O', CaO: 'lblCaO', MgO: 'lblMgO' };
    var lblOut = document.getElementById('lblOut');
    function renderLbl() {
      function v(id) { var x = parseFloat(document.getElementById(id).value); return isFinite(x) ? x : 0; }
      var n = v(lblIds.N), p = oxideToElement(v(lblIds.P2O5), 'P2O5'), k = oxideToElement(v(lblIds.K2O), 'K2O');
      var ca = oxideToElement(v(lblIds.CaO), 'CaO'), mg = oxideToElement(v(lblIds.MgO), 'MgO');
      if (n + p + k + ca + mg === 0) { lblOut.hidden = true; return; }
      lblOut.hidden = false;
      var rows = '<tr><td>N (nitrogen)</td><td class="num">' + fmt(n, 2) + '%</td></tr>' +
        '<tr><td>P (elemental, from P₂O₅)</td><td class="num">' + fmt(p, 2) + '%</td></tr>' +
        '<tr><td>K (elemental, from K₂O)</td><td class="num">' + fmt(k, 2) + '%</td></tr>';
      if (ca) rows += '<tr><td>Ca (from CaO)</td><td class="num">' + fmt(ca, 2) + '%</td></tr>';
      if (mg) rows += '<tr><td>Mg (from MgO)</td><td class="num">' + fmt(mg, 2) + '%</td></tr>';
      lblOut.innerHTML = '<div class="big">Elemental analysis</div><table><tbody>' + rows + '</tbody></table>' +
        '<div class="cite">Factors: K₂O×0.8301, P₂O₅×0.4364, CaO×0.7147, MgO×0.6030 (IUPAC 2021 atomic weights).</div>';
    }
    Object.keys(lblIds).forEach(function (k) { document.getElementById(lblIds[k]).addEventListener('input', renderLbl); });

    // 3. Crop target lookup
    var cropSel = document.getElementById('cropSel');
    var cropOut = document.getElementById('cropOut');
    CROP_TARGETS.forEach(function (t, i) {
      var o = document.createElement('option'); o.value = String(i); o.textContent = t.name; cropSel.appendChild(o);
    });
    function renderCrop() {
      var t = CROP_TARGETS[parseInt(cropSel.value, 10)];
      var badge = t.depth === 'full' ? '<span class="badge">fully cited</span>' : '<span class="badge">broad guidance</span>';
      cropOut.innerHTML =
        '<div class="big">' + t.name + ' ' + badge + '</div>' +
        '<table><tbody>' +
        '<tr><td>Nitrogen (N)</td><td class="num">' + ppmStr(t.N) + ' ppm</td></tr>' +
        '<tr><td>Phosphorus (P)</td><td class="num">' + ppmStr(t.P) + ' ppm</td></tr>' +
        '<tr><td>Potassium (K)</td><td class="num">' + ppmStr(t.K) + ' ppm</td></tr>' +
        '<tr><td>Calcium (Ca)</td><td class="num">' + ppmStr(t.Ca) + ' ppm</td></tr>' +
        '<tr><td>Magnesium (Mg)</td><td class="num">' + ppmStr(t.Mg) + ' ppm</td></tr>' +
        '<tr><td>EC</td><td class="num">' + fmt(t.ec[0], 1) + '–' + fmt(t.ec[1], 1) + ' mS/cm</td></tr>' +
        '<tr><td>pH</td><td class="num">' + fmt(t.ph[0], 1) + '–' + fmt(t.ph[1], 1) + '</td></tr>' +
        '</tbody></table>' +
        '<div class="cite">' + t.cite + '. Elemental ppm; starting points — adjust to your cultivar and system.</div>';
    }
    cropSel.addEventListener('change', renderCrop);
    renderCrop();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();

})(typeof globalThis !== 'undefined' ? globalThis : this);
