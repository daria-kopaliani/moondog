// Hot tub chemical dosage calculator — ported from apps/soak (Swift).
// Source of truth: apps/soak/Soak/Soak/Formulas.swift (dose constants + math) and
// Models.swift (Dose formatting, target ranges). Reference doses are stated in the
// literature as "X amount per 10,000 gal raises Y by Z" and scaled linearly to the
// user's volume in gallons — identical to Formulas.swift.
//
// FREE-TIER ONLY. This page ports the single-chemical dose calcs (sanitizer, pH,
// alkalinity, calcium). The app's integrated balancer (enter every reading at once
// → an ordered add-this-then-that sequence with advisories), the after-use
// bather-load top-up, weekly shock dosing and logging are the paid moat and are NOT
// ported here.
//
// Cited: TroubleFreePool reference tables; industry pool/spa chemistry guides
// (Formulas.swift lines 1–5). Target ranges are standard spa ranges (Formulas.swift
// TargetRange, lines 35–43).

(function (global) {
  'use strict';

  // --- Dose constants (Formulas.swift Constants, lines 9–33) ---
  var C = {
    // Chlorine: amount per 10,000 gal to raise FC by 1 ppm
    liquidChlorine125_flOzPer10kPerPPM: 10.0, // line 11
    calHypo68_ozPer10kPerPPM: 2.0,            // line 12
    dichlor56_ozPer10kPerPPM: 2.4,            // line 13
    // pH: amount per 10,000 gal to change pH by 0.1
    dryAcid_ozPer10kPerPointOne: 0.5,         // line 16
    muriatic3145_flOzPer10kPerPointOne: 6.4,  // line 17
    sodaAsh_ozPer10kPerPointOne: 3.0,         // line 18
    // Total Alkalinity: amount per 10,000 gal to change TA by 10 ppm
    bakingSoda_lbPer10kPer10ppm: 1.5,         // line 21
    muriatic3145_qtPer10kPer10ppm: 1.0,       // line 22
    // Calcium Hardness: amount per 10,000 gal to raise CH by 10 ppm
    calciumChloride_lbPer10kPer10ppm: 1.0,    // line 25
    // Unit conversions (lines 27–30)
    gPerOz: 28.3495,
    gPerLb: 453.592,
    mlPerFlOz: 29.5735,
    mlPerQt: 946.353,
    referenceGallons: 10000                    // line 32
  };

  // --- Standard spa target ranges (Formulas.swift TargetRange, lines 35–43) ---
  var TARGET = {
    chlorineFC: [1.0, 3.0],
    bromine: [2.0, 4.0],
    pH: [7.2, 7.8],
    pHIdeal: [7.4, 7.6],
    totalAlkalinity: [80.0, 120.0],
    calciumHardness: [150.0, 250.0]
  };

  function none() { return { amount: 0, unit: 'grams' }; }

  // --- Sanitizer (Formulas.swift chlorineDose, lines 54–75) ---
  // product = 'liquid125' | 'calHypo68' | 'dichlor56'
  function chlorineDose(currentFC, targetFC, gallons, product) {
    var delta = targetFC - currentFC;
    if (!(delta > 0) || !(gallons > 0)) return none();
    var scale = gallons / C.referenceGallons * delta;
    switch (product) {
      case 'liquid125':
        return { amount: C.liquidChlorine125_flOzPer10kPerPPM * scale * C.mlPerFlOz, unit: 'milliliters' };
      case 'calHypo68':
        return { amount: C.calHypo68_ozPer10kPerPPM * scale * C.gPerOz, unit: 'grams' };
      case 'dichlor56':
        return { amount: C.dichlor56_ozPer10kPerPPM * scale * C.gPerOz, unit: 'grams' };
      default:
        return none();
    }
  }

  // 0.13 oz sodium bromide per 100 gal raises bromine ~1 ppm (Formulas.swift lines 78–84).
  function bromineDose(currentBr, targetBr, gallons) {
    var delta = targetBr - currentBr;
    if (!(delta > 0) || !(gallons > 0)) return none();
    var ozPerGalPerPPM = 0.13 / 100.0;
    var oz = ozPerGalPerPPM * gallons * delta;
    return { amount: oz * C.gPerOz, unit: 'grams' };
  }

  // --- pH (Formulas.swift pHRaiseDose/pHLowerDose, lines 88–114) ---
  function pHRaiseDose(currentPH, targetPH, gallons) {
    var delta = targetPH - currentPH;
    if (!(delta > 0) || !(gallons > 0)) return none();
    var scale = gallons / C.referenceGallons * (delta / 0.1);
    return { amount: C.sodaAsh_ozPer10kPerPointOne * scale * C.gPerOz, unit: 'grams' };
  }

  // product = 'dryAcid' | 'muriatic'
  function pHLowerDose(currentPH, targetPH, gallons, product) {
    var delta = currentPH - targetPH;
    if (!(delta > 0) || !(gallons > 0)) return none();
    var scale = gallons / C.referenceGallons * (delta / 0.1);
    if (product === 'muriatic') {
      return { amount: C.muriatic3145_flOzPer10kPerPointOne * scale * C.mlPerFlOz, unit: 'milliliters' };
    }
    return { amount: C.dryAcid_ozPer10kPerPointOne * scale * C.gPerOz, unit: 'grams' };
  }

  // --- Total Alkalinity (Formulas.swift, lines 118–132) ---
  function alkalinityRaiseDose(currentTA, targetTA, gallons) {
    var delta = targetTA - currentTA;
    if (!(delta > 0) || !(gallons > 0)) return none();
    var scale = gallons / C.referenceGallons * (delta / 10.0);
    return { amount: C.bakingSoda_lbPer10kPer10ppm * scale * C.gPerLb, unit: 'grams' };
  }

  function alkalinityLowerDose(currentTA, targetTA, gallons) {
    var delta = currentTA - targetTA;
    if (!(delta > 0) || !(gallons > 0)) return none();
    var scale = gallons / C.referenceGallons * (delta / 10.0);
    return { amount: C.muriatic3145_qtPer10kPer10ppm * scale * C.mlPerQt, unit: 'milliliters' };
  }

  // --- Calcium Hardness (Formulas.swift calciumRaiseDose, lines 136–142) ---
  function calciumRaiseDose(currentCH, targetCH, gallons) {
    var delta = targetCH - currentCH;
    if (!(delta > 0) || !(gallons > 0)) return none();
    var scale = gallons / C.referenceGallons * (delta / 10.0);
    return { amount: C.calciumChloride_lbPer10kPer10ppm * scale * C.gPerLb, unit: 'grams' };
  }

  // --- Dose formatting (Models.swift Dose, lines 74–116) ---
  function isNegligible(dose) { return dose.amount < 0.5; }

  function formattedAmount(dose, metric) {
    if (isNegligible(dose)) return '—';
    if (metric) {
      return dose.amount < 10
        ? dose.amount.toFixed(1)
        : dose.amount.toFixed(0);
    }
    if (dose.unit === 'grams') return (dose.amount / C.gPerOz).toFixed(2);
    return (dose.amount / C.mlPerFlOz).toFixed(2); // milliliters
  }

  function unitLabel(dose, metric) {
    if (isNegligible(dose)) return '';
    if (metric) return dose.unit === 'grams' ? 'g' : 'ml';
    return dose.unit === 'grams' ? 'oz' : 'fl oz';
  }

  function formatDose(dose, metric) {
    if (isNegligible(dose)) return '—';
    var a = formattedAmount(dose, metric);
    var u = unitLabel(dose, metric);
    return u ? (a + ' ' + u) : a;
  }

  var api = {
    C: C, TARGET: TARGET,
    chlorineDose: chlorineDose,
    bromineDose: bromineDose,
    pHRaiseDose: pHRaiseDose,
    pHLowerDose: pHLowerDose,
    alkalinityRaiseDose: alkalinityRaiseDose,
    alkalinityLowerDose: alkalinityLowerDose,
    calciumRaiseDose: calciumRaiseDose,
    isNegligible: isNegligible,
    formattedAmount: formattedAmount,
    unitLabel: unitLabel,
    formatDose: formatDose
  };

  // Node export for the fixture test.
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  global.SoakCalc = api;

  // --- Browser UI (skipped under node) ---
  if (typeof document === 'undefined') return;

  function num(id) {
    var el = document.getElementById(id);
    if (!el || el.value === '') return null;
    var x = parseFloat(el.value.replace(',', '.'));
    return isFinite(x) ? x : null;
  }
  function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function metricOn() {
    var el = document.getElementById('units');
    return el ? el.value === 'metric' : true;
  }
  function fmtVol(g) { return Math.round(g).toLocaleString('en-US'); }

  function bigDose(dose, metric) {
    if (isNegligible(dose)) {
      return '<div class="big">Already in range — nothing to add.</div>' +
        '<div class="cite">Your reading is at or above the target, so no dose is needed. Never add more sanitizer or acid than the target calls for.</div>';
    }
    return '<div class="big">Add ' + formattedAmount(dose, metric) + ' ' + unitLabel(dose, metric) + '</div>';
  }

  function ready() {
    // 1. Sanitizer dose (chlorine / bromine) — the "how much chlorine to add" query
    var sanType = document.getElementById('sanType');
    var chlProdWrap = document.getElementById('chlProdWrap');
    var sanOut = document.getElementById('sanOut');

    function renderSan() {
      var type = sanType.value;
      chlProdWrap.style.display = type === 'chlorine' ? '' : 'none';
      var gallons = num('sanVol'), current = num('sanCur'), target = num('sanTgt');
      if (gallons == null || current == null || target == null) { sanOut.hidden = true; return; }
      var metric = metricOn();
      var dose, product;
      if (type === 'chlorine') {
        var prod = val('chlProd');
        dose = chlorineDose(current, target, gallons, prod);
        product = { liquid125: 'Liquid chlorine 12.5%', calHypo68: 'Cal-hypo 68%', dichlor56: 'Dichlor 56%' }[prod];
      } else {
        dose = bromineDose(current, target, gallons);
        product = 'Sodium bromide';
      }
      sanOut.hidden = false;
      sanOut.innerHTML = bigDose(dose, metric) +
        (isNegligible(dose) ? '' :
          '<table><tbody>' +
          '<tr><td>Product</td><td class="num">' + product + '</td></tr>' +
          '<tr><td>Raises</td><td class="num">' + current + ' → ' + target + ' ppm</td></tr>' +
          '<tr><td>Water volume</td><td class="num">' + fmtVol(gallons) + ' gal</td></tr>' +
          '</tbody></table>' +
          '<div class="cite">Add with the jets running, wait, then re-test. Scaled from ' +
          '10,000-gal reference doses (TroubleFreePool tables). Target FC 1–3 ppm; bromine 2–4 ppm.</div>');
    }
    sanType.addEventListener('change', renderSan);
    ['sanVol', 'sanCur', 'sanTgt', 'chlProd', 'units'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.addEventListener('input', renderSan);
    });
    document.getElementById('chlProd').addEventListener('change', renderSan);

    // 2. pH adjuster
    var phLowProdWrap = document.getElementById('phLowProdWrap');
    var phOut = document.getElementById('phOut');
    function renderPh() {
      var gallons = num('phVol'), current = num('phCur');
      var target = 7.5;
      var lowering = current != null && current > target;
      phLowProdWrap.style.display = lowering ? '' : 'none';
      if (gallons == null || current == null) { phOut.hidden = true; return; }
      var metric = metricOn();
      var dose, product, dir;
      if (current < target) {
        dose = pHRaiseDose(current, target, gallons); product = 'Soda ash (pH up)'; dir = 'Raises';
      } else if (current > target) {
        var p = val('phLowProd');
        dose = pHLowerDose(current, target, gallons, p);
        product = p === 'muriatic' ? 'Muriatic acid (31.45%)' : 'Dry acid (sodium bisulfate)';
        dir = 'Lowers';
      } else {
        dose = none(); product = ''; dir = '';
      }
      phOut.hidden = false;
      phOut.innerHTML = bigDose(dose, metric) +
        (isNegligible(dose) ? '' :
          '<table><tbody>' +
          '<tr><td>Product</td><td class="num">' + product + '</td></tr>' +
          '<tr><td>' + dir + ' pH</td><td class="num">' + current + ' → 7.5</td></tr>' +
          '<tr><td>Water volume</td><td class="num">' + fmtVol(gallons) + ' gal</td></tr>' +
          '</tbody></table>' +
          '<div class="cite">Ideal spa pH 7.4–7.6. Add slowly, circulate, re-test before adding more.</div>');
    }
    ['phVol', 'phCur', 'phLowProd', 'units'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.addEventListener('input', renderPh);
    });
    document.getElementById('phLowProd').addEventListener('change', renderPh);

    // 3. Alkalinity & calcium hardness
    var akWhat = document.getElementById('akWhat');
    var akOut = document.getElementById('akOut');
    function renderAk() {
      var what = akWhat.value;
      var gallons = num('akVol'), current = num('akCur');
      if (gallons == null || current == null) { akOut.hidden = true; return; }
      var metric = metricOn();
      var dose, product, dir, target;
      if (what === 'ta-raise') {
        target = 90; dose = alkalinityRaiseDose(current, target, gallons);
        product = 'Sodium bicarbonate (baking soda)'; dir = 'Raises alkalinity';
      } else if (what === 'ta-lower') {
        target = 110; dose = alkalinityLowerDose(current, target, gallons);
        product = 'Muriatic acid (31.45%)'; dir = 'Lowers alkalinity';
      } else {
        target = 175; dose = calciumRaiseDose(current, target, gallons);
        product = 'Calcium chloride'; dir = 'Raises calcium';
      }
      akOut.hidden = false;
      var unitWord = what === 'ta-lower' ? '(to reach ~' + target + ' ppm)' : '(to reach ~' + target + ' ppm)';
      akOut.innerHTML = bigDose(dose, metric) +
        (isNegligible(dose) ? '' :
          '<table><tbody>' +
          '<tr><td>Product</td><td class="num">' + product + '</td></tr>' +
          '<tr><td>' + dir + '</td><td class="num">' + current + ' → ' + target + ' ppm</td></tr>' +
          '<tr><td>Water volume</td><td class="num">' + fmtVol(gallons) + ' gal</td></tr>' +
          '</tbody></table>' +
          '<div class="cite">Target alkalinity 80–120 ppm, calcium hardness 150–250 ppm. ' +
          (what === 'ta-lower' ? 'Aerate the water for several hours after adding acid. ' : '') +
          'Adjust alkalinity before pH.</div>');
    }
    akWhat.addEventListener('change', renderAk);
    ['akVol', 'akCur', 'units'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.addEventListener('input', renderAk);
    });

    renderSan(); renderPh(); renderAk();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();

})(typeof globalThis !== 'undefined' ? globalThis : this);
