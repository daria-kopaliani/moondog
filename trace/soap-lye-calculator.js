// Soap lye calculator — ported from apps/trace (Swift).
// Sources: OilDatabase.swift (SAP values + oil table), SoapMath.swift (lye /
// superfat / water math). SAP values are g NaOH (or g KOH) per g oil,
// cross-checked against SoapCalc.net + Bramble Berry and anchored to
// AOCS-typical ranges; oil table is public reference data.
//
// FREE-TIER ONLY. The app's depth — fatty-acid quality analysis
// (hardness / cleansing / conditioning / bubbly / creamy / longevity),
// multi-batch cure tracking, brand-aware oil presets, and fragrance /
// additive (citric acid, etc.) math — is intentionally NOT ported here.
// This page ports only the lye/water/superfat core.
// Cited: Kevin Dunn, Scientific Soapmaking (Clavicula Press, 2010);
// USDA Agricultural Handbook 8; AOCS Official Methods.

(function (global) {
  'use strict';

  // --- SAP table (OilDatabase.swift). sapNaOH / sapKOH = g lye per g oil. ---
  // KOH SAP ≈ 1.4035 × NaOH SAP (MW: NaOH 40.00, KOH 56.11 g/mol).
  var OILS = [
    // Base oils — common foundations
    { slug: 'coconut-76', name: 'Coconut Oil (76° melt)', category: 'Base', sapNaOH: 0.190, sapKOH: 0.266 },
    { slug: 'coconut-92', name: 'Coconut Oil (92° melt, hydrogenated)', category: 'Base', sapNaOH: 0.190, sapKOH: 0.266 },
    { slug: 'olive-pure', name: 'Olive Oil (pure)', category: 'Base', sapNaOH: 0.135, sapKOH: 0.190 },
    { slug: 'olive-pomace', name: 'Olive Oil (pomace)', category: 'Base', sapNaOH: 0.135, sapKOH: 0.190 },
    { slug: 'palm', name: 'Palm Oil (RBD)', category: 'Base', sapNaOH: 0.141, sapKOH: 0.198 },
    { slug: 'palm-kernel', name: 'Palm Kernel Oil', category: 'Base', sapNaOH: 0.156, sapKOH: 0.219 },
    { slug: 'castor', name: 'Castor Oil', category: 'Base', sapNaOH: 0.128, sapKOH: 0.180 },
    { slug: 'lard', name: 'Lard', category: 'Base', sapNaOH: 0.139, sapKOH: 0.195 },
    { slug: 'tallow-beef', name: 'Tallow (Beef)', category: 'Base', sapNaOH: 0.141, sapKOH: 0.198 },
    { slug: 'canola', name: 'Canola Oil', category: 'Base', sapNaOH: 0.124, sapKOH: 0.174 },
    { slug: 'sunflower-high-oleic', name: 'Sunflower (High Oleic)', category: 'Base', sapNaOH: 0.135, sapKOH: 0.190 },
    { slug: 'sunflower', name: 'Sunflower Oil (regular)', category: 'Base', sapNaOH: 0.135, sapKOH: 0.190 },
    { slug: 'safflower-high-oleic', name: 'Safflower (High Oleic)', category: 'Base', sapNaOH: 0.137, sapKOH: 0.193 },
    { slug: 'rice-bran', name: 'Rice Bran Oil', category: 'Base', sapNaOH: 0.128, sapKOH: 0.180 },
    { slug: 'soybean', name: 'Soybean Oil', category: 'Base', sapNaOH: 0.135, sapKOH: 0.190 },
    { slug: 'corn', name: 'Corn Oil', category: 'Base', sapNaOH: 0.136, sapKOH: 0.191 },
    { slug: 'peanut', name: 'Peanut Oil', category: 'Base', sapNaOH: 0.137, sapKOH: 0.193 },
    // Specialty oils
    { slug: 'avocado', name: 'Avocado Oil', category: 'Specialty', sapNaOH: 0.133, sapKOH: 0.187 },
    { slug: 'sweet-almond', name: 'Sweet Almond Oil', category: 'Specialty', sapNaOH: 0.136, sapKOH: 0.191 },
    { slug: 'apricot-kernel', name: 'Apricot Kernel Oil', category: 'Specialty', sapNaOH: 0.135, sapKOH: 0.190 },
    { slug: 'grapeseed', name: 'Grapeseed Oil', category: 'Specialty', sapNaOH: 0.126, sapKOH: 0.177 },
    { slug: 'hemp-seed', name: 'Hemp Seed Oil', category: 'Specialty', sapNaOH: 0.134, sapKOH: 0.188 },
    { slug: 'macadamia', name: 'Macadamia Nut Oil', category: 'Specialty', sapNaOH: 0.139, sapKOH: 0.195 },
    { slug: 'sesame', name: 'Sesame Oil', category: 'Specialty', sapNaOH: 0.134, sapKOH: 0.188 },
    { slug: 'walnut', name: 'Walnut Oil', category: 'Specialty', sapNaOH: 0.135, sapKOH: 0.190 },
    { slug: 'stearic-acid', name: 'Stearic Acid', category: 'Specialty', sapNaOH: 0.143, sapKOH: 0.201 },
    // Butters
    { slug: 'cocoa-butter', name: 'Cocoa Butter', category: 'Butter', sapNaOH: 0.137, sapKOH: 0.193 },
    { slug: 'shea-butter', name: 'Shea Butter (refined)', category: 'Butter', sapNaOH: 0.128, sapKOH: 0.180 },
    { slug: 'mango-butter', name: 'Mango Butter', category: 'Butter', sapNaOH: 0.137, sapKOH: 0.193 },
    { slug: 'kokum-butter', name: 'Kokum Butter', category: 'Butter', sapNaOH: 0.135, sapKOH: 0.190 },
    // Wax / unsaponifiable (very low SAP — behave differently)
    { slug: 'jojoba', name: 'Jojoba Oil (wax ester)', category: 'Wax / Unsaponifiable', sapNaOH: 0.069, sapKOH: 0.097 },
    { slug: 'beeswax', name: 'Beeswax (yellow)', category: 'Wax / Unsaponifiable', sapNaOH: 0.069, sapKOH: 0.097 }
  ];

  var OIL_BY_SLUG = {};
  OILS.forEach(function (o) { OIL_BY_SLUG[o.slug] = o; });
  function findOil(slug) { return OIL_BY_SLUG[slug] || null; }

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  // Water expression, matching SoapMath.waterMass:
  //   { kind: 'percentOfOils', value }   → totalOils × clamp(15,50,value)/100
  //   { kind: 'lyeConcentration', value }→ lye × (1-safe)/safe, safe=clamp(20,50)/100
  //   { kind: 'waterToLyeRatio', value } → lye × clamp(1,4,value)
  function waterMass(water, totalOils, totalEffectiveLye) {
    if (!water) return 0;
    if (water.kind === 'percentOfOils') {
      return totalOils * (clamp(water.value, 15, 50) / 100.0);
    }
    if (water.kind === 'lyeConcentration') {
      var safe = clamp(water.value, 20, 50) / 100.0;
      if (totalEffectiveLye <= 0) return 0;
      return totalEffectiveLye * ((1 - safe) / safe);
    }
    if (water.kind === 'waterToLyeRatio') {
      var r = clamp(water.value, 1.0, 4.0);
      return totalEffectiveLye * r;
    }
    return 0;
  }

  // Core lye calculation — free-tier port of SoapMath.compute (no citric,
  // fragrance, dual-lye or quality math). Input:
  //   { oils: [{oilSlug, grams}], lyeType: 'naoh'|'koh',
  //     superfatPercent, lyePurityNaOH, lyePurityKOH, water }
  function computeLye(input) {
    var oils = input.oils || [];
    var totalOils = oils.reduce(function (s, o) { return s + (o.grams || 0); }, 0);
    if (totalOils <= 0) {
      return {
        totalOilGrams: 0, effectiveNaOHGrams: 0, effectiveKOHGrams: 0,
        lyeToBuyNaOHGrams: 0, lyeToBuyKOHGrams: 0, waterGrams: 0,
        unknownOils: [], warnings: ['Add at least one oil to compute lye amount.']
      };
    }

    // 1. Aggregate SAP × grams (full saponification, superfat ignored).
    var sapNaOH = 0, sapKOH = 0, unknown = [];
    oils.forEach(function (entry) {
      var p = findOil(entry.oilSlug);
      if (!p) { unknown.push(entry.oilSlug); return; }
      sapNaOH += (entry.grams || 0) * p.sapNaOH;
      sapKOH += (entry.grams || 0) * p.sapKOH;
    });

    // 2. Superfat / lye discount (clamp 0–20%).
    var superfat = clamp(input.superfatPercent || 0, 0, 20) / 100.0;
    var effNaOH = sapNaOH * (1 - superfat);
    var effKOH = sapKOH * (1 - superfat);

    // 3. Split by lye type (free page supports pure NaOH or pure KOH).
    var lyeType = input.lyeType === 'koh' ? 'koh' : 'naoh';
    var splitNaOH = lyeType === 'koh' ? 0 : effNaOH;
    var splitKOH = lyeType === 'koh' ? effKOH : 0;

    // 4. Purity (buy more raw to hit the same effective lye).
    var purNaOH = clamp((input.lyePurityNaOH == null ? 100 : input.lyePurityNaOH) / 100.0, 0.5, 1.0);
    var purKOH = clamp((input.lyePurityKOH == null ? 100 : input.lyePurityKOH) / 100.0, 0.5, 1.0);
    var buyNaOH = splitNaOH > 0 ? splitNaOH / purNaOH : 0;
    var buyKOH = splitKOH > 0 ? splitKOH / purKOH : 0;

    // 5. Water against the pre-purity effective lye total.
    var waterGrams = waterMass(input.water, totalOils, splitNaOH + splitKOH);

    // 6. Warnings (subset of the app's).
    var warnings = [];
    if (unknown.length) warnings.push('Unknown oils ignored: ' + unknown.join(', '));
    if ((input.superfatPercent || 0) < 1) {
      warnings.push('Superfat below 1% leaves little margin for SAP-value variation — most CP recipes use around 5%.');
    }
    if ((input.superfatPercent || 0) > 15) {
      warnings.push('Superfat above 15% — the bar may be very soft and prone to DOS (dreaded orange spots).');
    }

    return {
      totalOilGrams: totalOils,
      effectiveNaOHGrams: splitNaOH,
      effectiveKOHGrams: splitKOH,
      lyeToBuyNaOHGrams: buyNaOH,
      lyeToBuyKOHGrams: buyKOH,
      waterGrams: waterGrams,
      unknownOils: unknown,
      warnings: warnings
    };
  }

  var api = { OILS: OILS, findOil: findOil, computeLye: computeLye, waterMass: waterMass };

  // Node export for the fixture test.
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  global.TraceCalc = api;

  // --- Browser UI (skipped under node) ---
  if (typeof document === 'undefined') return;

  function fmt(n, dp) {
    return (Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp)).toLocaleString('en-US');
  }

  function ready() {
    var rowsEl = document.getElementById('oilRows');
    var addBtn = document.getElementById('addOil');
    var lyeType = document.getElementById('lyeType');
    var superfat = document.getElementById('superfat');
    var purity = document.getElementById('purity');
    var waterMode = document.getElementById('waterMode');
    var waterVal = document.getElementById('waterVal');
    var waterUnit = document.getElementById('waterUnit');
    var out = document.getElementById('lyeOut');

    // Build the <optgroup> option markup once, reuse per row.
    function optionMarkup() {
      var cats = ['Base', 'Butter', 'Specialty', 'Wax / Unsaponifiable'];
      var html = '';
      cats.forEach(function (cat) {
        var group = OILS.filter(function (o) { return o.category === cat; });
        if (!group.length) return;
        html += '<optgroup label="' + cat + '">';
        group.forEach(function (o) { html += '<option value="' + o.slug + '">' + o.name + '</option>'; });
        html += '</optgroup>';
      });
      return html;
    }
    var OPTS = optionMarkup();

    function addRow(slug, grams) {
      var row = document.createElement('div');
      row.className = 'oil-row';
      row.innerHTML =
        '<select class="oil-select" aria-label="Oil">' + OPTS + '</select>' +
        '<input class="oil-grams" type="number" inputmode="decimal" step="1" min="0" placeholder="grams" aria-label="Grams">' +
        '<button type="button" class="oil-remove" aria-label="Remove oil">×</button>';
      rowsEl.appendChild(row);
      if (slug) row.querySelector('.oil-select').value = slug;
      if (grams != null) row.querySelector('.oil-grams').value = grams;
      row.querySelector('.oil-select').addEventListener('change', render);
      row.querySelector('.oil-grams').addEventListener('input', render);
      row.querySelector('.oil-remove').addEventListener('click', function () {
        row.remove(); render();
      });
    }

    function collectOils() {
      var oils = [];
      rowsEl.querySelectorAll('.oil-row').forEach(function (r) {
        var slug = r.querySelector('.oil-select').value;
        var g = parseFloat(r.querySelector('.oil-grams').value);
        if (isFinite(g) && g > 0) oils.push({ oilSlug: slug, grams: g });
      });
      return oils;
    }

    function waterInput() {
      var v = parseFloat(waterVal.value);
      if (!isFinite(v)) v = waterMode.value === 'waterToLyeRatio' ? 2 : (waterMode.value === 'lyeConcentration' ? 33 : 38);
      return { kind: waterMode.value, value: v };
    }

    function syncWaterUnit() {
      if (waterMode.value === 'percentOfOils') { waterUnit.textContent = '% of oils'; waterVal.step = '1'; }
      else if (waterMode.value === 'lyeConcentration') { waterUnit.textContent = '% lye conc.'; waterVal.step = '1'; }
      else { waterUnit.textContent = ': 1 (water : lye)'; waterVal.step = '0.1'; }
    }

    function render() {
      var input = {
        oils: collectOils(),
        lyeType: lyeType.value,
        superfatPercent: parseFloat(superfat.value),
        lyePurityNaOH: parseFloat(purity.value),
        lyePurityKOH: parseFloat(purity.value),
        water: waterInput()
      };
      if (!isFinite(input.superfatPercent)) input.superfatPercent = 5;
      if (!isFinite(input.lyePurityNaOH)) { input.lyePurityNaOH = 100; input.lyePurityKOH = 100; }

      var r = computeLye(input);
      if (r.totalOilGrams <= 0) { out.hidden = true; return; }
      out.hidden = false;

      var isKOH = input.lyeType === 'koh';
      var buy = isKOH ? r.lyeToBuyKOHGrams : r.lyeToBuyNaOHGrams;
      var eff = isKOH ? r.effectiveKOHGrams : r.effectiveNaOHGrams;
      var label = isKOH ? 'KOH (potassium hydroxide)' : 'NaOH (sodium hydroxide)';

      var html = '<div class="big">' + fmt(buy, 1) + ' g ' + (isKOH ? 'KOH' : 'NaOH') + '</div>' +
        '<table><tbody>' +
        '<tr><td>Total oils</td><td class="num">' + fmt(r.totalOilGrams, 0) + ' g</td></tr>' +
        '<tr><td>' + label + ' to weigh</td><td class="num">' + fmt(buy, 1) + ' g</td></tr>';
      if (Math.abs(buy - eff) > 0.05) {
        html += '<tr><td>&nbsp;&nbsp;of which effective lye</td><td class="num">' + fmt(eff, 1) + ' g</td></tr>';
      }
      html += '<tr><td>Water</td><td class="num">' + fmt(r.waterGrams, 0) + ' g</td></tr>' +
        '<tr><td>Superfat (lye discount)</td><td class="num">' + fmt(clamp(input.superfatPercent, 0, 20), 0) + '%</td></tr>' +
        '</tbody></table>' +
        '<div class="cite">' + (isKOH ? 'KOH' : 'NaOH') + ' = Σ(oil g × SAP) × (1 − superfat) ÷ purity. ' +
        'SAP values from OilDatabase (AOCS-typical / SoapCalc-cross-checked). Superfat leaves that % of oils unsaponified.</div>';

      if (r.warnings.length) {
        html += '<div class="warn"><strong>Check:</strong> ' + r.warnings.join(' ') + '</div>';
      }
      out.innerHTML = html;
    }

    addBtn.addEventListener('click', function () { addRow(); render(); });
    lyeType.addEventListener('change', render);
    superfat.addEventListener('input', render);
    purity.addEventListener('input', render);
    waterMode.addEventListener('change', function () { syncWaterUnit(); render(); });
    waterVal.addEventListener('input', render);

    // Seed a common "trinity" starter so the page shows a live result.
    addRow('olive-pomace', 600);
    addRow('coconut-76', 250);
    addRow('palm', 150);
    syncWaterUnit();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();

})(typeof globalThis !== 'undefined' ? globalThis : this);
