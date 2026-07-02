// Mushroom substrate calculator — ported from apps/flush (Swift).
// Sources: HydrationMath.swift (water-to-add + moisture %), BEPredictor.swift
// (biological efficiency + predicted yield), SpeciesLibrary.swift (BE ranges).
// The species-specific grow trackers and the agar / liquid-culture / grain-spawn
// calculators are the app's paid moat and are intentionally NOT ported here —
// this page is free-tier only.
// Cited: Stamets (Growing Gourmet & Medicinal Mushrooms), Cotter (Organic
// Mushroom Farming), Cornell Small Farms mushroom BMP, Field & Forest,
// Bermúdez-Bazán et al. (PLOS One 2024) shiitake BE.

(function (global) {
  'use strict';

  // --- Substrate hydration (HydrationMath.swift) ---
  // Practitioner formula: moisture% = water / (dry + water) × 100.
  // Solved for the water to add to bring bone-dry substrate to a target moisture:
  //   waterToAdd = dry × m / (100 − m)
  function waterToAdd(dryWeight, targetMoisturePercent) {
    var m = targetMoisturePercent;
    if (m <= 0 || m >= 100 || dryWeight <= 0) return 0;
    return dryWeight * m / (100 - m);
  }

  // Final hydrated weight = dry weight + water to add.
  function hydratedWeight(dryWeight, targetMoisturePercent) {
    return dryWeight + waterToAdd(dryWeight, targetMoisturePercent);
  }

  // Moisture % of a hydrated mass (HydrationMath.computedMoisturePercent):
  //   moisture% = water / (dry + water) × 100
  function moisturePercent(waterMass, dryMass) {
    var total = dryMass + waterMass;
    if (total <= 0) return 0;
    return (waterMass / total) * 100;
  }

  // Water to add when the substrate already holds some moisture. Converts the
  // as-is weight back to bone-dry, then hydrates to the target.
  //   boneDry   = currentWeight × (1 − c/100)
  //   targetWet = boneDry / (1 − m/100)
  //   waterToAdd = targetWet − currentWeight
  function waterToAddFromCurrent(currentWeight, currentMoisturePercent, targetMoisturePercent) {
    var c = currentMoisturePercent, m = targetMoisturePercent;
    if (m <= 0 || m >= 100 || c < 0 || c >= 100 || currentWeight <= 0) return 0;
    var boneDry = currentWeight * (1 - c / 100);
    var targetWet = boneDry / (1 - m / 100);
    return targetWet - currentWeight;
  }

  // --- Biological efficiency (BEPredictor.swift) ---
  // BE% = (fresh fruit weight / dry substrate weight) × 100
  function biologicalEfficiencyPercent(freshYield, dryWeight) {
    if (dryWeight <= 0) return 0;
    return (freshYield / dryWeight) * 100;
  }

  // Inverse: predicted fresh yield from a target BE and dry substrate weight.
  //   yield = (BE / 100) × dry
  function predictedYield(dryWeight, bePercent) {
    if (dryWeight <= 0 || bePercent < 0) return 0;
    return (bePercent / 100) * dryWeight;
  }

  // --- Species BE benchmarks (SpeciesLibrary.swift beRangePercent) ---
  // Published starting-point ranges; the app's per-species grow trackers are paid.
  var SPECIES_BE = [
    { id: 'oyster', name: 'Oyster (Pleurotus)', be: [75, 125], cite: 'Out-Grow / Stamets — oyster, first flush+ across multiple flushes' },
    { id: 'shiitake', name: 'Shiitake (Lentinula edodes)', be: [30, 74], cite: 'Bermúdez-Bazán et al., PLOS One 2024 — 30–50% industrial, 59–74% controlled supp-sawdust trials' },
    { id: 'lions-mane', name: "Lion's mane (Hericium erinaceus)", be: [50, 100], cite: 'Field & Forest / Stamets — lion’s mane' },
    { id: 'king-oyster', name: 'King oyster (Pleurotus eryngii)', be: [50, 100], cite: 'Stamets / Out-Grow — king oyster' },
    { id: 'maitake', name: 'Maitake (Grifola frondosa)', be: [30, 50], cite: 'Cotter, Organic Mushroom Farming — maitake' },
    { id: 'reishi', name: 'Reishi (Ganoderma lucidum)', be: [25, 50], cite: 'Stamets — reishi (slow, dense; lower BE)' },
    { id: 'turkey-tail', name: 'Turkey tail (Trametes versicolor)', be: [30, 60], cite: 'Stamets / Field & Forest — turkey tail (medicinal, modest by weight)' }
  ];

  // --- Substrate target-moisture presets (SubstrateRecipes.swift free tier) ---
  var SUBSTRATE_TARGETS = [
    { id: 'hwp-plain', name: 'Hardwood fuel pellet (plain)', target: 62, cite: 'Stamets / Cotter — 60–65%' },
    { id: 'cvg', name: 'CVG (coir / verm / gypsum)', target: 65, cite: 'Out-Grow / Cotter — 60–70%' },
    { id: 'straw', name: 'Straw (chopped)', target: 70, cite: 'Stamets / Out-Grow — 60–75%' },
    { id: 'supp-sawdust', name: 'Supplemented hardwood sawdust', target: 60, cite: 'Stamets — 55–65%' }
  ];

  var api = {
    waterToAdd: waterToAdd,
    hydratedWeight: hydratedWeight,
    moisturePercent: moisturePercent,
    waterToAddFromCurrent: waterToAddFromCurrent,
    biologicalEfficiencyPercent: biologicalEfficiencyPercent,
    predictedYield: predictedYield,
    SPECIES_BE: SPECIES_BE,
    SUBSTRATE_TARGETS: SUBSTRATE_TARGETS
  };

  // Node export for the fixture test.
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  global.FlushCalc = api;

  // --- Browser UI (skipped under node) ---
  if (typeof document === 'undefined') return;

  function fmt(n, dp) { return (Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp)).toLocaleString('en-US'); }
  function num(id) { var x = parseFloat(document.getElementById(id).value); return isFinite(x) ? x : NaN; }

  function ready() {
    // 1. Substrate hydration
    var subSel = document.getElementById('subSel');
    var dryW = document.getElementById('dryW');
    var tgtM = document.getElementById('tgtM');
    var curM = document.getElementById('curM');
    var hydOut = document.getElementById('hydOut');

    SUBSTRATE_TARGETS.forEach(function (s, i) {
      var o = document.createElement('option'); o.value = String(i); o.textContent = s.name + ' (~' + s.target + '%)'; subSel.appendChild(o);
    });
    var custom = document.createElement('option'); custom.value = 'custom'; custom.textContent = 'Custom target'; subSel.appendChild(custom);

    function onSub() {
      if (subSel.value !== 'custom') {
        tgtM.value = String(SUBSTRATE_TARGETS[parseInt(subSel.value, 10)].target);
      }
      renderHyd();
    }
    function renderHyd() {
      var d = num('dryW'), m = num('tgtM'), c = num('curM');
      if (!isFinite(d) || d <= 0 || !isFinite(m) || m <= 0 || m >= 100) { hydOut.hidden = true; return; }
      var water, boneDry, cite;
      if (isFinite(c) && c > 0) {
        water = waterToAddFromCurrent(d, c, m);
        boneDry = d * (1 - c / 100);
        cite = 'Entered weight treated as ' + fmt(c, 0) + '% moisture (bone-dry ≈ ' + fmt(boneDry, 0) + ' g). waterToAdd = boneDry ÷ (1 − m) − weight.';
      } else {
        water = waterToAdd(d, m);
        cite = 'waterToAdd = dry × m ÷ (100 − m). moisture% = water ÷ (dry + water) × 100.';
      }
      if (water < 0) {
        hydOut.hidden = false;
        hydOut.innerHTML = '<div class="big">Already wetter than target</div>' +
          '<div class="cite">The substrate already holds more water than the ' + fmt(m, 0) + '% target — dry it back rather than adding water.</div>';
        return;
      }
      var finalWet = d + water;
      hydOut.hidden = false;
      hydOut.innerHTML =
        '<div class="big">Add ' + fmt(water, 0) + ' g (≈ ' + fmt(water, 0) + ' mL) of water</div>' +
        '<table><tbody>' +
        '<tr><td>Target moisture</td><td class="num">' + fmt(m, 0) + '%</td></tr>' +
        '<tr><td>Water to add</td><td class="num">' + fmt(water, 0) + ' g</td></tr>' +
        '<tr><td>Final hydrated weight</td><td class="num">' + fmt(finalWet, 0) + ' g</td></tr>' +
        '</tbody></table>' +
        '<div class="cite">' + cite + ' Always confirm with the squeeze test — a hard squeeze should force out only a few drops.</div>';
    }
    subSel.addEventListener('change', onSub);
    [dryW, tgtM, curM].forEach(function (el) { el.addEventListener('input', function () { subSel.value = 'custom'; renderHyd(); }); });

    // 2. Biological efficiency (fresh yield → BE%)
    var beFresh = document.getElementById('beFresh');
    var beDry = document.getElementById('beDry');
    var beOut = document.getElementById('beOut');
    function renderBe() {
      var f = num('beFresh'), d = num('beDry');
      if (!isFinite(f) || f < 0 || !isFinite(d) || d <= 0) { beOut.hidden = true; return; }
      var be = biologicalEfficiencyPercent(f, d);
      beOut.hidden = false;
      beOut.innerHTML =
        '<div class="big">BE = ' + fmt(be, 1) + '%</div>' +
        '<div class="cite">BE% = fresh yield ÷ dry substrate weight × 100. Values above 100% are normal — fresh mushrooms are mostly water, the substrate is weighed dry. Use dry weight for the denominator, never wet.</div>';
    }
    [beFresh, beDry].forEach(function (el) { el.addEventListener('input', renderBe); });

    // 3. Predicted yield (dry weight + target BE → expected fresh yield)
    var pySpecies = document.getElementById('pySpecies');
    var pyDry = document.getElementById('pyDry');
    var pyBe = document.getElementById('pyBe');
    var pyOut = document.getElementById('pyOut');

    SPECIES_BE.forEach(function (s, i) {
      var o = document.createElement('option'); o.value = String(i); o.textContent = s.name; pySpecies.appendChild(o);
    });
    var pyCustom = document.createElement('option'); pyCustom.value = 'custom'; pyCustom.textContent = 'Custom BE %'; pySpecies.appendChild(pyCustom);

    function onSpecies() {
      if (pySpecies.value !== 'custom') {
        var s = SPECIES_BE[parseInt(pySpecies.value, 10)];
        pyBe.value = String(Math.round((s.be[0] + s.be[1]) / 2));
      }
      renderPy();
    }
    function renderPy() {
      var d = num('pyDry');
      if (!isFinite(d) || d <= 0) { pyOut.hidden = true; return; }
      pyOut.hidden = false;
      if (pySpecies.value !== 'custom') {
        var s = SPECIES_BE[parseInt(pySpecies.value, 10)];
        var lo = predictedYield(d, s.be[0]), hi = predictedYield(d, s.be[1]);
        pyOut.innerHTML =
          '<div class="big">' + fmt(lo, 0) + '–' + fmt(hi, 0) + ' g fresh (total, multi-flush)</div>' +
          '<table><tbody>' +
          '<tr><td>Dry substrate</td><td class="num">' + fmt(d, 0) + ' g</td></tr>' +
          '<tr><td>BE range</td><td class="num">' + s.be[0] + '–' + s.be[1] + '%</td></tr>' +
          '</tbody></table>' +
          '<div class="cite">yield = BE ÷ 100 × dry weight. ' + s.cite + '. Ranges are lifetime totals across flushes — a single first flush is lower.</div>';
      } else {
        var be = num('pyBe');
        if (!isFinite(be) || be < 0) { pyOut.hidden = true; return; }
        var y = predictedYield(d, be);
        pyOut.innerHTML =
          '<div class="big">' + fmt(y, 0) + ' g fresh</div>' +
          '<div class="cite">yield = BE ÷ 100 × dry weight = ' + fmt(be, 0) + '% × ' + fmt(d, 0) + ' g.</div>';
      }
    }
    pySpecies.addEventListener('change', onSpecies);
    pyDry.addEventListener('input', renderPy);
    pyBe.addEventListener('input', function () { pySpecies.value = 'custom'; renderPy(); });
    onSpecies();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();

})(typeof globalThis !== 'undefined' ? globalThis : this);
