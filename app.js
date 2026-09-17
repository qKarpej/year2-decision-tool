/* =========================================================================
   Year 2 Winter Decision Tool - Pork and Garlic Ice Cream Co.
   Single-page, no build step, no dependencies.

   IMPORTANT: every Year 2 price and rule in here is an ESTIMATE carried
   over from Year 1. The trainer has not issued the Year 2 rules yet.
   ========================================================================= */

const STORAGE_KEY = 'pgic-year2-tool-v1';

/* ---------------------------------------------------------------- defaults */

function defaults() {
  return {
    meta: {
      company: 'Pork and Garlic Ice Cream Co.',
      team: '',
      currency: '€'
    },

    // --- REPLACE THESE WITH YOUR REAL YEAR 1 CLOSING POSITION ---
    opening: {
      cash: 12000,
      loanPrincipal: 10000,
      lossCF: 0,
      y1Profit: 4500
    },

    machines: [
      { id: 'm1', name: 'Machine 1 (owned)', bookValue: 9000, remainingSeasons: 6,
        capacity: 4000, runCost: 600, deprPerSeason: 1500 }
    ],

    // --- ESTIMATES. Year 1 prices, NOT confirmed Year 2 prices. ---
    rules: {
      price: 3.00,
      milkPrice: 0.50,
      litresPerUnit: 0.40,
      otherVarPerUnit: 0.35,
      transportPerUnit: 0.15,
      spoilRecoveryPct: 0,
      interestRatePct: 5,
      taxRatePct: 20,
      advancePct: 50,
      forecastMarketUnits: 9000,
      competitors: 6,
      forecastNote: 'Winter market forecast from the trainer - not a promise of sales.'
    },

    premises: [
      { id: 'p1', name: 'Small premises', rent: 2000, capacity: 3000 },
      { id: 'p2', name: 'Large premises', rent: 4500, capacity: 8000 }
    ],

    scenarios: [
      {
        id: 's1', name: 'Option A - Cautious winter', premisesId: 'p1',
        useMachines: ['m1'],
        buyMachine: false, newMachineName: 'Second machine',
        newMachinePrice: 8000, newMachineCapacity: 4000,
        newMachineLife: 8, newMachineRun: 600,
        plannedProduction: 2500, milkPurchase: 1000, salesRequest: 2500,
        marketing: 500, borrowing: 0, repayment: 2000,
        actualSales: 2000
      },
      {
        id: 's2', name: 'Option B - Push for share', premisesId: 'p2',
        useMachines: ['m1'],
        buyMachine: true, newMachineName: 'Second machine',
        newMachinePrice: 8000, newMachineCapacity: 4000,
        newMachineLife: 8, newMachineRun: 600,
        plannedProduction: 5000, milkPurchase: 2000, salesRequest: 5000,
        marketing: 2500, borrowing: 6000, repayment: 0,
        actualSales: 3500
      }
    ],

    // --- Year 1 validation: one real season from the classroom model ---
    y1: {
      label: 'Year 1 summer',
      openingCash: 8000, openingLoans: 10000, lossCF: 0,
      price: 3.00, milkPrice: 0.50, litresPerUnit: 0.40,
      otherVarPerUnit: 0.35, transportPerUnit: 0.15, spoilRecoveryPct: 0,
      interestRatePct: 5, taxRatePct: 20, advancePct: 50,
      capacity: 3000, plannedProduction: 3000, milkPurchase: 1200,
      salesRequest: 3000, actualSales: 2800,
      marketing: 1000, rent: 2000, machineRun: 600, depreciation: 1500,
      machinePurchaseCash: 0, borrowing: 0, repayment: 0,
      modelProfit: null, modelCash: null
    },

    decision: { chosen: 's1', assumedSales: 2000, text: '', assumption: '', downside: '' }
  };
}

/* ------------------------------------------------------------ state plumbing */

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return merge(defaults(), JSON.parse(raw));
  } catch (e) { /* storage blocked or corrupt - fall through to defaults */ }
  return defaults();
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { /* private window / blocked storage: the tool still works */ }
}

function merge(base, incoming) {
  if (Array.isArray(base)) return Array.isArray(incoming) ? incoming : base;
  if (base && typeof base === 'object') {
    const out = {};
    for (const k of Object.keys(base)) {
      out[k] = (incoming && k in incoming) ? merge(base[k], incoming[k]) : base[k];
    }
    return out;
  }
  return incoming === undefined ? base : incoming;
}

function getPath(path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), state);
}

function setPath(path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], state);
  target[last] = value;
}

/* ------------------------------------------------------------- formatting */

const n0 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const n2 = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const cur = () => state.meta.currency || '€';
const num = v => (Number.isFinite(+v) ? +v : 0);

function money(v, dp) {
  const x = num(v);
  const body = (dp === 2 ? n2 : n0).format(Math.abs(x));
  return (x < 0 ? '-' : '') + cur() + body;
}
function units(v) { return n0.format(Math.round(num(v))); }
function signClass(v) { return num(v) < 0 ? 'neg' : ''; }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* =========================================================================
   THE ENGINE
   One season in, one full P&L + cash timeline out.
   Used for both Year 2 options and the Year 1 validation check.
   ========================================================================= */

function computeSeason(i) {
  const price       = num(i.price);
  const milkPrice   = num(i.milkPrice);
  const lpu         = num(i.litresPerUnit);
  const otherVar    = num(i.otherVarPerUnit);
  const transportPU = num(i.transportPerUnit);
  const recFrac     = Math.min(Math.max(num(i.spoilRecoveryPct), 0), 100) / 100;

  const capacity    = Math.max(num(i.capacity), 0);
  const planned     = Math.max(num(i.plannedProduction), 0);
  const milkLitres  = Math.max(num(i.milkPurchase), 0);
  const request     = Math.max(num(i.salesRequest), 0);

  /* --- production is limited by the tightest of three constraints --- */
  const milkAllows = lpu > 0 ? milkLitres / lpu : Infinity;
  const production = Math.max(0, Math.min(planned, capacity, milkAllows));

  const limits = [];
  if (production < planned - 1e-9) {
    if (capacity <= milkAllows + 1e-9 && capacity < planned) limits.push('capacity');
    if (milkAllows < capacity - 1e-9 && milkAllows < planned) limits.push('milk');
  }

  /* --- sales: you cannot sell more than you made, or more than you asked for --- */
  const wanted = Math.max(num(i.actualSales), 0);
  const sales  = Math.min(wanted, production, request);
  const salesCappedByStock   = wanted > production + 1e-9;
  const salesCappedByRequest = wanted > request + 1e-9;

  /* --- materials --- */
  const milkUsed      = production * lpu;
  const milkLeftover  = Math.max(milkLitres - milkUsed, 0);
  const milkCost      = milkLitres * milkPrice;
  const otherVarCost  = production * otherVar;
  const productionCost = milkUsed * milkPrice + otherVarCost;
  const unitCost      = production > 0 ? productionCost / production : 0;

  const unsold             = Math.max(production - sales, 0);
  const costOfSales        = sales * unitCost;
  const costOfUnsoldUnits  = unsold * unitCost;
  const costOfLeftoverMilk = milkLeftover * milkPrice;
  const recovery           = costOfUnsoldUnits * recFrac;
  const spoilage           = costOfUnsoldUnits + costOfLeftoverMilk - recovery;

  /* --- operating costs --- */
  const revenue    = sales * price;
  const transport  = sales * transportPU;
  const marketing  = num(i.marketing);
  const rent       = num(i.rent);
  const machineRun = num(i.machineRun);
  const depreciation = num(i.depreciation);

  const grossProfit = revenue - costOfSales - spoilage;
  const overheads   = rent + machineRun + marketing + transport;
  const ebitda      = grossProfit - overheads;
  const operating   = ebitda - depreciation;

  /* --- financing and tax --- */
  const borrowing  = num(i.borrowing);
  const repayment  = num(i.repayment);
  const openLoans  = num(i.openingLoans);
  const interest   = (openLoans + borrowing) * num(i.interestRatePct) / 100;

  const pbt      = operating - interest;
  const lossIn   = Math.max(num(i.lossCF), 0);
  const offset   = pbt > 0 ? Math.min(pbt, lossIn) : 0;
  const taxable  = Math.max(pbt - offset, 0);
  const tax      = taxable * num(i.taxRatePct) / 100;
  const netProfit = pbt - tax;
  const lossOut  = lossIn - offset + (pbt < 0 ? -pbt : 0);

  /* --- cash timeline: where in the season does cash actually run out? --- */
  const machineBuy = num(i.machinePurchaseCash);
  const advance    = milkCost * num(i.advancePct) / 100;

  const steps = [];
  let c = num(i.openingCash);
  steps.push({ label: 'Opening cash', flow: null, balance: c });

  c += borrowing;                    steps.push({ label: 'New borrowing drawn', flow: borrowing, balance: c });
  c -= machineBuy;                   steps.push({ label: 'Machines bought', flow: -machineBuy, balance: c });
  c -= rent;                         steps.push({ label: 'Rent paid', flow: -rent, balance: c });
  c -= marketing;                    steps.push({ label: 'Market investment paid', flow: -marketing, balance: c });
  const beforeAdvance = c;           steps.push({ label: 'Cash available before milk advance', flow: null, balance: c, mark: 'before-advance' });
  c -= advance;                      steps.push({ label: 'Milk advance paid', flow: -advance, balance: c, mark: 'advance' });
  c -= (milkCost - advance);         steps.push({ label: 'Milk balance paid', flow: -(milkCost - advance), balance: c });
  c -= otherVarCost;                 steps.push({ label: 'Other production costs', flow: -otherVarCost, balance: c });
  c -= machineRun;                   steps.push({ label: 'Machine running costs', flow: -machineRun, balance: c });
  c += revenue;                      steps.push({ label: 'Sales received', flow: revenue, balance: c });
  if (recovery > 0) { c += recovery; steps.push({ label: 'Value recovered on unsold stock', flow: recovery, balance: c }); }
  c -= transport;                    steps.push({ label: 'Transport paid', flow: -transport, balance: c });
  c -= interest;                     steps.push({ label: 'Interest paid', flow: -interest, balance: c });
  c -= repayment;                    steps.push({ label: 'Loan repaid', flow: -repayment, balance: c });
  c -= tax;                          steps.push({ label: 'Tax paid', flow: -tax, balance: c, mark: 'end' });

  const closingCash = c;
  const minStep = steps.reduce((a, b) => (b.balance < a.balance ? b : a), steps[0]);

  /* --- flags --- */
  const flags = [];
  if (limits.includes('capacity'))
    flags.push({ level: 'warn', text: 'Production is capped by premises/machine capacity of ' + units(capacity) + ' units. You planned ' + units(planned) + '.' });
  if (limits.includes('milk'))
    flags.push({ level: 'warn', text: 'Production is capped by milk. ' + units(milkLitres) + ' litres only makes ' + units(milkAllows) + ' units, but you planned ' + units(planned) + '.' });
  if (salesCappedByStock)
    flags.push({ level: 'warn', text: 'You entered ' + units(wanted) + ' units sold but only made ' + units(production) + '. Sales were capped at what you produced.' });
  if (salesCappedByRequest)
    flags.push({ level: 'warn', text: 'You entered ' + units(wanted) + ' units sold but only requested ' + units(request) + '. The trainer cannot allocate more than you ask for.' });
  if (beforeAdvance < advance - 1e-9)
    flags.push({ level: 'bad', text: 'You cannot afford the milk advance. You need ' + money(advance) + ' and have ' + money(beforeAdvance) + ' at that point. Borrow more, cut market spending, or buy less milk.' });
  if (closingCash < 0)
    flags.push({ level: 'bad', text: 'Closing cash is negative (' + money(closingCash) + '). This plan does not survive the season.' });
  if (minStep.balance < 0 && beforeAdvance >= advance - 1e-9 && closingCash >= 0)
    flags.push({ level: 'bad', text: 'Cash goes negative mid-season, at "' + minStep.label + '" (' + money(minStep.balance) + '), even though it ends positive.' });
  if (unsold > 0)
    flags.push({ level: 'warn', text: units(unsold) + ' units go unsold and spoil, costing ' + money(costOfUnsoldUnits - recovery) + '.' });
  if (milkLeftover > 0)
    flags.push({ level: 'warn', text: units(milkLeftover) + ' litres of milk are bought and never used, wasting ' + money(costOfLeftoverMilk) + '.' });
  if (!flags.some(f => f.level === 'bad'))
    flags.push({ level: 'ok', text: 'Cash stays positive all season. Lowest point is ' + money(minStep.balance) + ' at "' + minStep.label + '".' });

  /* --- reconciliation: cash must tie back to profit --- */
  const reconciled = num(i.openingCash) + netProfit + depreciation + borrowing - repayment - machineBuy;

  return {
    production, planned, capacity, milkAllows, sales, wanted, request, unsold,
    milkUsed, milkLeftover, unitCost,
    revenue, costOfSales, costOfUnsoldUnits, costOfLeftoverMilk, recovery, spoilage,
    grossProfit, rent, machineRun, marketing, transport, overheads, ebitda,
    depreciation, operating, interest, pbt, lossIn, offset, taxable, tax, netProfit, lossOut,
    milkCost, otherVarCost, productionCost, advance, beforeAdvance,
    steps, closingCash, minStep, machineBuy, borrowing, repayment,
    openingCash: num(i.openingCash),
    closingLoans: openLoans + borrowing - repayment,
    reconciled, reconcileGap: closingCash - reconciled,
    flags
  };
}

/* ------------------------------------------- build engine input from a scenario */

function scenarioInput(sc, salesOverride) {
  const prem = state.premises.find(p => p.id === sc.premisesId) || { rent: 0, capacity: 0 };
  const used = state.machines.filter(m => (sc.useMachines || []).includes(m.id));

  let machineCap = used.reduce((s, m) => s + num(m.capacity), 0);
  let machineRun = used.reduce((s, m) => s + num(m.runCost), 0);
  let depreciation = used.reduce(
    (s, m) => s + (num(m.remainingSeasons) > 0 ? num(m.deprPerSeason) : 0), 0);
  let machineBuy = 0;

  if (sc.buyMachine) {
    machineCap += num(sc.newMachineCapacity);
    machineRun += num(sc.newMachineRun);
    machineBuy  = num(sc.newMachinePrice);
    const life = num(sc.newMachineLife);
    depreciation += life > 0 ? num(sc.newMachinePrice) / life : 0;
  }

  return {
    openingCash: num(state.opening.cash),
    openingLoans: num(state.opening.loanPrincipal),
    lossCF: num(state.opening.lossCF),

    price: state.rules.price, milkPrice: state.rules.milkPrice,
    litresPerUnit: state.rules.litresPerUnit,
    otherVarPerUnit: state.rules.otherVarPerUnit,
    transportPerUnit: state.rules.transportPerUnit,
    spoilRecoveryPct: state.rules.spoilRecoveryPct,
    interestRatePct: state.rules.interestRatePct,
    taxRatePct: state.rules.taxRatePct,
    advancePct: state.rules.advancePct,

    capacity: Math.min(num(prem.capacity), machineCap),
    premisesCapacity: num(prem.capacity),
    machineCapacity: machineCap,
    rent: num(prem.rent),
    machineRun, depreciation, machinePurchaseCash: machineBuy,

    plannedProduction: sc.plannedProduction,
    milkPurchase: sc.milkPurchase,
    salesRequest: sc.salesRequest,
    actualSales: salesOverride === undefined ? sc.actualSales : salesOverride,
    marketing: sc.marketing,
    borrowing: sc.borrowing,
    repayment: sc.repayment
  };
}

function results() {
  return state.scenarios.map(sc => {
    const inp = scenarioInput(sc);
    return { sc, inp, r: computeSeason(inp) };
  });
}

/* --- how many units must be sold before this plan breaks even on profit? --- */
function breakevenSales(sc) {
  const at0 = computeSeason(scenarioInput(sc, 0)).pbt;
  const full = scenarioInput(sc);
  const maxSales = Math.min(num(full.salesRequest),
    computeSeason(scenarioInput(sc, 1e12)).production);
  if (maxSales <= 0) return null;
  const atMax = computeSeason(scenarioInput(sc, maxSales)).pbt;
  const slope = (atMax - at0) / maxSales;
  if (slope <= 0) return null;
  const be = -at0 / slope;
  return be >= 0 ? be : 0;
}

/* =========================================================================
   RENDERING
   ========================================================================= */

/* ---------- tables of editable rows (machines, premises) ---------- */

function renderMachines() {
  const t = document.getElementById('machineTable');
  const head = '<thead><tr><th>Machine</th><th>Book value</th><th>Seasons left</th>' +
    '<th>Capacity / season</th><th>Running cost</th><th>Depreciation / season</th><th></th></tr></thead>';
  const rows = state.machines.map((m, idx) => (
    '<tr>' +
    '<td><input type="text" data-path="machines.' + idx + '.name"></td>' +
    '<td><input type="number" step="any" data-path="machines.' + idx + '.bookValue"></td>' +
    '<td><input type="number" step="any" data-path="machines.' + idx + '.remainingSeasons"></td>' +
    '<td><input type="number" step="any" data-path="machines.' + idx + '.capacity"></td>' +
    '<td><input type="number" step="any" data-path="machines.' + idx + '.runCost"></td>' +
    '<td><input type="number" step="any" data-path="machines.' + idx + '.deprPerSeason"></td>' +
    '<td><button class="btn btn-sm btn-danger" data-del-machine="' + idx + '" type="button">Remove</button></td>' +
    '</tr>')).join('');
  t.innerHTML = head + '<tbody>' + (rows || '<tr><td colspan="7">No machines yet.</td></tr>') + '</tbody>';
  bindInputs(t);
  t.querySelectorAll('[data-del-machine]').forEach(b => b.onclick = () => {
    const id = state.machines[+b.dataset.delMachine].id;
    state.machines.splice(+b.dataset.delMachine, 1);
    state.scenarios.forEach(s => s.useMachines = (s.useMachines || []).filter(x => x !== id));
    save(); renderMachines(); renderScenarioInputs(); renderOutputs();
  });
}

function renderPremises() {
  const t = document.getElementById('premisesTable');
  const head = '<thead><tr><th>Premises</th><th>Rent per season</th>' +
    '<th>Production capacity / season</th><th></th></tr></thead>';
  const rows = state.premises.map((p, idx) => (
    '<tr>' +
    '<td><input type="text" data-path="premises.' + idx + '.name"></td>' +
    '<td><input type="number" step="any" data-path="premises.' + idx + '.rent"></td>' +
    '<td><input type="number" step="any" data-path="premises.' + idx + '.capacity"></td>' +
    '<td><button class="btn btn-sm btn-danger" data-del-prem="' + idx + '" type="button">Remove</button></td>' +
    '</tr>')).join('');
  t.innerHTML = head + '<tbody>' + rows + '</tbody>';
  bindInputs(t);
  t.querySelectorAll('[data-del-prem]').forEach(b => b.onclick = () => {
    if (state.premises.length <= 1) return;
    state.premises.splice(+b.dataset.delPrem, 1);
    save(); renderPremises(); renderScenarioInputs(); renderOutputs();
  });
}

/* ---------- scenario decision cards ---------- */

function renderScenarioInputs() {
  const wrap = document.getElementById('scenarioInputs');
  wrap.innerHTML = state.scenarios.map((sc, i) => {
    const premOpts = state.premises.map(p =>
      '<option value="' + p.id + '"' + (p.id === sc.premisesId ? ' selected' : '') + '>' +
      esc(p.name) + '</option>').join('');

    const machineChecks = state.machines.map(m =>
      '<label><input type="checkbox" data-machine-use="' + i + '|' + m.id + '"' +
      ((sc.useMachines || []).includes(m.id) ? ' checked' : '') + '> ' + esc(m.name) + '</label>'
    ).join('') || '<span class="note">No machines on the position page yet.</span>';

    return '' +
      '<div class="scenario-card">' +
        '<h4><input type="text" data-path="scenarios.' + i + '.name">' +
          (state.scenarios.length > 2
            ? '<button class="btn btn-sm btn-danger" data-del-scenario="' + i + '" type="button">&times;</button>' : '') +
        '</h4>' +

        '<label class="field"><span>Premises</span>' +
          '<select data-path="scenarios.' + i + '.premisesId">' + premOpts + '</select></label>' +

        '<span class="field"><span>Machines used</span></span>' +
        '<div class="machine-checks">' + machineChecks + '</div>' +

        '<label class="field"><span><input type="checkbox" data-path="scenarios.' + i + '.buyMachine"> ' +
          'Buy an additional machine this season</span></label>' +
        '<div class="grid grid-2">' +
          '<label class="field"><span>New machine name</span><input type="text" data-path="scenarios.' + i + '.newMachineName"></label>' +
          '<label class="field"><span>Purchase price</span><input type="number" step="any" data-path="scenarios.' + i + '.newMachinePrice"></label>' +
          '<label class="field"><span>Capacity added</span><input type="number" step="any" data-path="scenarios.' + i + '.newMachineCapacity"></label>' +
          '<label class="field"><span>Life in seasons</span><input type="number" step="any" data-path="scenarios.' + i + '.newMachineLife"></label>' +
          '<label class="field"><span>Running cost / season</span><input type="number" step="any" data-path="scenarios.' + i + '.newMachineRun"></label>' +
        '</div>' +

        '<h3 style="margin-top:14px">Season decisions</h3>' +
        '<div class="grid grid-2">' +
          '<label class="field"><span>Planned production (units)</span><input type="number" step="any" data-path="scenarios.' + i + '.plannedProduction"></label>' +
          '<label class="field"><span>Milk purchased (litres)</span><input type="number" step="any" data-path="scenarios.' + i + '.milkPurchase"></label>' +
          '<label class="field"><span>Sales requested (units)</span><input type="number" step="any" data-path="scenarios.' + i + '.salesRequest"></label>' +
          '<label class="field"><span>Market investment</span><input type="number" step="any" data-path="scenarios.' + i + '.marketing"></label>' +
          '<label class="field"><span>New borrowing</span><input type="number" step="any" data-path="scenarios.' + i + '.borrowing"></label>' +
          '<label class="field"><span>Loan repayment</span><input type="number" step="any" data-path="scenarios.' + i + '.repayment"></label>' +
        '</div>' +

        '<h3 style="margin-top:14px">Actual sales allocation to test</h3>' +
        '<label class="field"><span>Units the trainer allocates</span>' +
          '<input type="number" step="any" data-path="scenarios.' + i + '.actualSales"></label>' +

        '<div class="callout" id="scMini' + i + '"></div>' +
      '</div>';
  }).join('');

  bindInputs(wrap);

  wrap.querySelectorAll('[data-machine-use]').forEach(cb => cb.onchange = () => {
    const [i, id] = cb.dataset.machineUse.split('|');
    const sc = state.scenarios[+i];
    sc.useMachines = sc.useMachines || [];
    if (cb.checked) { if (!sc.useMachines.includes(id)) sc.useMachines.push(id); }
    else sc.useMachines = sc.useMachines.filter(x => x !== id);
    save(); renderOutputs();
  });

  wrap.querySelectorAll('[data-del-scenario]').forEach(b => b.onclick = () => {
    state.scenarios.splice(+b.dataset.delScenario, 1);
    save(); renderScenarioInputs(); renderOutputs();
  });

  document.getElementById('scenarioCount').textContent =
    state.scenarios.length + ' options. The assignment requires at least 2.';
}

/* ---------- P&L and cash flow tables ---------- */

function plRows(r) {
  const row = (label, v, cls) =>
    '<tr class="' + (cls || '') + '"><td>' + label + '</td>' +
    '<td class="num ' + signClass(v) + '">' + money(v) + '</td></tr>';

  return '<table class="tbl">' +
    '<thead><tr><th>Profit &amp; loss</th><th class="num">Amount</th></tr></thead><tbody>' +
    row('Revenue (' + units(r.sales) + ' units sold)', r.revenue) +
    row('Cost of goods sold', -r.costOfSales, 'indent') +
    row('Spoilage and wasted milk', -r.spoilage, 'indent') +
    row('Gross profit', r.grossProfit, 'sub') +
    row('Rent', -r.rent, 'indent') +
    row('Machine running costs', -r.machineRun, 'indent') +
    row('Market investment', -r.marketing, 'indent') +
    row('Transport', -r.transport, 'indent') +
    row('Operating profit before depreciation', r.ebitda, 'sub') +
    row('Depreciation', -r.depreciation, 'indent') +
    row('Operating profit', r.operating, 'sub') +
    row('Interest', -r.interest, 'indent') +
    row('Profit before tax', r.pbt, 'sub') +
    row('Tax loss carried forward used', -r.offset, 'indent') +
    row('Taxable profit', r.taxable, 'indent') +
    row('Tax', -r.tax, 'indent') +
    row('Net profit for the season', r.netProfit, 'total') +
    '</tbody></table>' +
    '<p class="note">Tax losses: ' + money(r.lossIn) + ' brought in, ' + money(r.offset) +
    ' used, <strong>' + money(r.lossOut) + '</strong> carried forward.</p>';
}

function cashRows(r) {
  const body = r.steps.map(s => {
    const isMark = s.mark === 'before-advance' || s.mark === 'end';
    return '<tr class="' + (isMark ? 'sub' : '') + '">' +
      '<td>' + s.label + '</td>' +
      '<td class="num ' + (s.flow == null ? '' : signClass(s.flow)) + '">' +
        (s.flow == null ? '' : money(s.flow)) + '</td>' +
      '<td class="num ' + signClass(s.balance) + '">' + money(s.balance) + '</td></tr>';
  }).join('');

  return '<table class="tbl">' +
    '<thead><tr><th>Cash flow through the season</th><th class="num">Movement</th><th class="num">Cash</th></tr></thead>' +
    '<tbody>' + body +
    '<tr class="total"><td>Closing cash</td><td class="num"></td>' +
    '<td class="num ' + signClass(r.closingCash) + '">' + money(r.closingCash) + '</td></tr>' +
    '</tbody></table>' +
    '<p class="note">Check: opening cash ' + money(r.openingCash) + ' + net profit ' + money(r.netProfit) +
    ' + depreciation ' + money(r.depreciation) + ' + borrowing ' + money(r.borrowing) +
    ' &minus; repayment ' + money(r.repayment) + ' &minus; machines bought ' + money(r.machineBuy) +
    ' = ' + money(r.reconciled) +
    (Math.abs(r.reconcileGap) < 0.01
      ? ' &mdash; matches closing cash.'
      : ' &mdash; <span class="neg">does not match (' + money(r.reconcileGap, 2) + ')</span>.') +
    '</p>';
}

function flagsHtml(flags) {
  return flags.map(f =>
    '<div class="flag flag-' + f.level + '">' +
      '<span class="flag-icon">' + (f.level === 'bad' ? '!' : f.level === 'warn' ? '&#9888;' : '&#10003;') + '</span>' +
      '<span>' + f.text + '</span></div>').join('');
}

function sensitivityTable(sc) {
  const req = num(sc.salesRequest);
  const shares = [1, 0.8, 0.6, 0.4, 0.2, 0];
  const rows = shares.map(sh => {
    const r = computeSeason(scenarioInput(sc, req * sh));
    return '<tr><td>' + Math.round(sh * 100) + '% of request (' + units(req * sh) + ' units)</td>' +
      '<td class="num ' + signClass(r.netProfit) + '">' + money(r.netProfit) + '</td>' +
      '<td class="num ' + signClass(r.closingCash) + '">' + money(r.closingCash) + '</td></tr>';
  }).join('');

  const be = breakevenSales(sc);
  return '<table class="tbl"><thead><tr><th>If the trainer allocates&hellip;</th>' +
    '<th class="num">Net profit</th><th class="num">Closing cash</th></tr></thead><tbody>' +
    rows + '</tbody></table>' +
    '<p class="note">' + (be == null
      ? 'This plan does not break even at any sales level.'
      : 'Break-even: <strong>' + units(Math.ceil(be)) + ' units</strong> must be sold to reach zero profit before tax' +
        (be > req ? ' &mdash; which is more than the ' + units(req) + ' units requested, so this plan cannot break even.' : '.')) +
    '</p>';
}

function renderOutputs() {
  const rs = results();

  /* -- position summary -- */
  const totalCap = state.machines.reduce((s, m) => s + num(m.capacity), 0);
  const totalBook = state.machines.reduce((s, m) => s + num(m.bookValue), 0);
  const totalDepr = state.machines.reduce(
    (s, m) => s + (num(m.remainingSeasons) > 0 ? num(m.deprPerSeason) : 0), 0);
  document.getElementById('positionSummary').innerHTML =
    '<p><strong>Starting point for Year 2 winter.</strong></p>' +
    '<p>Cash ' + money(state.opening.cash) + ' &middot; loans ' + money(state.opening.loanPrincipal) +
    ' &middot; tax losses available ' + money(state.opening.lossCF) +
    ' &middot; Year 1 profit ' + money(state.opening.y1Profit) + '.</p>' +
    '<p>' + state.machines.length + ' machine(s), book value ' + money(totalBook) +
    ', combined capacity ' + units(totalCap) + ' units per season, depreciation ' +
    money(totalDepr) + ' per season.</p>';

  /* -- forecast summary -- */
  const fm = num(state.rules.forecastMarketUnits), comp = num(state.rules.competitors);
  document.getElementById('forecastSummary').innerHTML =
    '<p><strong>An even split of the forecast market would be ' +
    units(comp > 0 ? fm / comp : fm) + ' units per company.</strong> ' +
    'That is a reference point, not an entitlement &mdash; market investment, price and the trainer’s allocation decide the real number.</p>' +
    '<p class="note">' + esc(state.rules.forecastNote) + '</p>';

  /* -- per-scenario mini summary on the options page -- */
  rs.forEach((x, i) => {
    const el = document.getElementById('scMini' + i);
    if (!el) return;
    const bad = x.r.flags.some(f => f.level === 'bad');
    el.innerHTML =
      '<p><strong>' + (bad ? '⚠ ' : '') + 'Net profit ' + money(x.r.netProfit) +
      ' &middot; closing cash ' + money(x.r.closingCash) + '</strong></p>' +
      '<p class="note">Makes ' + units(x.r.production) + ', sells ' + units(x.r.sales) +
      ', spoils ' + units(x.r.unsold) + ' units. Capacity ' + units(x.inp.capacity) + '.</p>';
  });

  /* -- results tab -- */
  document.getElementById('resultsBody').innerHTML = rs.map(x =>
    '<div class="result-block">' +
      '<h3>' + esc(x.sc.name) + '</h3>' +
      '<div class="kpis">' +
        kpi('Net profit', money(x.r.netProfit), x.r.netProfit) +
        kpi('Closing cash', money(x.r.closingCash), x.r.closingCash) +
        kpi('Lowest cash point', money(x.r.minStep.balance), x.r.minStep.balance) +
        kpi('Units made', units(x.r.production)) +
        kpi('Units sold', units(x.r.sales)) +
        kpi('Units spoiled', units(x.r.unsold), -x.r.unsold) +
      '</div>' +
      flagsHtml(x.r.flags) +
      '<div class="two-col">' +
        '<div>' + plRows(x.r) + '</div>' +
        '<div>' + cashRows(x.r) + '</div>' +
      '</div>' +
      '<h3>If sales come in lower than requested</h3>' +
      sensitivityTable(x.sc) +
    '</div>').join('');

  renderCompare(rs);
  renderY1();
  renderDecision(rs);
  document.getElementById('companyLine').textContent =
    (state.meta.company || 'Company') + (state.meta.team ? ' — ' + state.meta.team : '');
}

function kpi(label, value, signRef) {
  const cls = signRef === undefined ? '' : signClass(signRef);
  return '<div class="kpi"><div class="k">' + label + '</div>' +
    '<div class="v ' + cls + '">' + value + '</div></div>';
}

/* ---------- comparison ---------- */

const COMPARE_LINES = [
  ['Units sold',                  r => r.sales,        'units'],
  ['Units spoiled',               r => r.unsold,       'units'],
  ['Revenue',                     r => r.revenue],
  ['Cost of goods sold',          r => -r.costOfSales],
  ['Spoilage and wasted milk',    r => -r.spoilage],
  ['Rent',                        r => -r.rent],
  ['Machine running costs',       r => -r.machineRun],
  ['Market investment',           r => -r.marketing],
  ['Transport',                   r => -r.transport],
  ['Depreciation',                r => -r.depreciation],
  ['Interest',                    r => -r.interest],
  ['Tax',                         r => -r.tax],
  ['Net profit',                  r => r.netProfit,    'total'],
  ['Machines bought (cash)',      r => -r.machineBuy],
  ['Net borrowing',               r => r.borrowing - r.repayment],
  ['Closing cash',                r => r.closingCash,  'total'],
  ['Lowest cash point',           r => r.minStep.balance]
];

function renderCompare(rs) {
  if (rs.length < 2) {
    document.getElementById('compareBody').innerHTML =
      '<p class="note">Add a second option to compare.</p>';
    return;
  }

  const head = '<thead><tr><th>Line</th>' +
    rs.map(x => '<th class="num">' + esc(x.sc.name) + '</th>').join('') +
    '<th class="num">B &minus; A</th></tr></thead>';

  const body = COMPARE_LINES.map(([label, fn, kind]) => {
    const vals = rs.map(x => fn(x.r));
    const diff = vals[1] - vals[0];
    const f = kind === 'units' ? units : money;
    return '<tr class="' + (kind === 'total' ? 'total' : '') + '"><td>' + label + '</td>' +
      vals.map(v => '<td class="num ' + signClass(v) + '">' + f(v) + '</td>').join('') +
      '<td class="num ' + signClass(diff) + '">' + (diff >= 0 ? '+' : '') + f(diff) + '</td></tr>';
  }).join('');

  document.getElementById('compareBody').innerHTML =
    '<div class="table-wrap"><table class="tbl">' + head + '<tbody>' + body + '</tbody></table></div>' +
    '<h3>What drives the difference</h3>' + explain(rs) +
    '<h3>Profit at each sales level, side by side</h3>' + crossSensitivity(rs);
}

function explain(rs) {
  const a = rs[0], b = rs[1];
  const drivers = [
    ['sales volume',        b.r.revenue - a.r.revenue],
    ['cost of goods sold',  -(b.r.costOfSales - a.r.costOfSales)],
    ['spoilage and wasted milk', -(b.r.spoilage - a.r.spoilage)],
    ['rent',                -(b.r.rent - a.r.rent)],
    ['machine running costs', -(b.r.machineRun - a.r.machineRun)],
    ['market investment',   -(b.r.marketing - a.r.marketing)],
    ['transport',           -(b.r.transport - a.r.transport)],
    ['depreciation',        -(b.r.depreciation - a.r.depreciation)],
    ['interest',            -(b.r.interest - a.r.interest)],
    ['tax',                 -(b.r.tax - a.r.tax)]
  ].filter(d => Math.abs(d[1]) >= 1).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));

  const bars = drivers.map(([label, v]) => {
    const max = Math.max(...drivers.map(d => Math.abs(d[1]))) || 1;
    const w = Math.abs(v) / max * 50;
    const left = v >= 0 ? 50 : 50 - w;
    return '<div class="bar-row">' +
      '<span class="bar-label">' + label + '</span>' +
      '<span class="bar-track"><span class="bar-fill' + (v < 0 ? ' is-neg' : '') +
        '" style="left:' + left + '%;width:' + w + '%"></span></span>' +
      '<span class="bar-val ' + signClass(v) + '">' + (v >= 0 ? '+' : '') + money(v) + '</span></div>';
  }).join('');

  const profitGap = b.r.netProfit - a.r.netProfit;
  const cashGap = b.r.closingCash - a.r.closingCash;

  const sentences = [];
  sentences.push('<strong>' + esc(b.sc.name) + '</strong> earns ' +
    (profitGap >= 0 ? money(profitGap) + ' more' : money(-profitGap) + ' less') +
    ' than <strong>' + esc(a.sc.name) + '</strong> at the sales levels entered, and ends the season with ' +
    (cashGap >= 0 ? money(cashGap) + ' more cash' : money(-cashGap) + ' less cash') + '.');

  if (drivers.length) {
    const top = drivers.slice(0, 3).map(d =>
      d[0] + ' (' + (d[1] >= 0 ? '+' : '') + money(d[1]) + ')').join(', ');
    sentences.push('The three lines that move the result most are ' + top + '.');
  }
  if (Math.abs(b.r.unsold - a.r.unsold) > 0) {
    sentences.push('Spoilage differs by ' + units(Math.abs(b.r.unsold - a.r.unsold)) +
      ' units: ' + esc(b.sc.name) + ' spoils ' + units(b.r.unsold) + ' against ' +
      units(a.r.unsold) + '. Unsold ice cream is a total loss, so producing ahead of an uncertain allocation is the most expensive mistake available.');
  }
  if (b.r.minStep.balance < a.r.minStep.balance) {
    sentences.push('<strong>' + esc(b.sc.name) + '</strong> is the tighter plan on cash: its lowest point is ' +
      money(b.r.minStep.balance) + ' at "' + b.r.minStep.label + '", against ' +
      money(a.r.minStep.balance) + '.');
  } else if (a.r.minStep.balance < b.r.minStep.balance) {
    sentences.push('<strong>' + esc(a.sc.name) + '</strong> is the tighter plan on cash: its lowest point is ' +
      money(a.r.minStep.balance) + ' at "' + a.r.minStep.label + '", against ' +
      money(b.r.minStep.balance) + '.');
  }

  return '<div class="callout">' + sentences.map(s => '<p>' + s + '</p>').join('') + '</div>' +
    '<div style="margin-top:14px">' + bars + '</div>' +
    '<p class="note">Bars show the effect on ' + esc(b.sc.name) + '’s profit relative to ' +
    esc(a.sc.name) + '. Green to the right helps, red to the left hurts.</p>';
}

function crossSensitivity(rs) {
  const shares = [1, 0.8, 0.6, 0.4, 0.2];
  const head = '<thead><tr><th>Allocation</th>' +
    rs.map(x => '<th class="num">' + esc(x.sc.name) + '</th>').join('') + '</tr></thead>';
  const body = shares.map(sh => {
    const cells = rs.map(x => {
      const r = computeSeason(scenarioInput(x.sc, num(x.sc.salesRequest) * sh));
      return '<td class="num ' + signClass(r.netProfit) + '">' + money(r.netProfit) + '</td>';
    }).join('');
    return '<tr><td>' + Math.round(sh * 100) + '% of each option’s request</td>' + cells + '</tr>';
  }).join('');
  return '<div class="table-wrap"><table class="tbl">' + head + '<tbody>' + body + '</tbody></table></div>' +
    '<p class="note">Each column is scaled to its own sales request, because the two options ask the market for different volumes.</p>';
}

/* ---------- Year 1 validation ---------- */

function renderY1() {
  const y = state.y1;
  const r = computeSeason(y);
  const el = document.getElementById('y1Body');

  const hasModel = y.modelProfit !== null && y.modelProfit !== '' &&
                   y.modelCash !== null && y.modelCash !== '';
  const dProfit = num(y.modelProfit) - r.netProfit;
  const dCash   = num(y.modelCash) - r.closingCash;
  const ok = Math.abs(dProfit) < 0.5 && Math.abs(dCash) < 0.5;

  let verdict;
  if (!hasModel) {
    verdict = '<div class="flag flag-warn"><span class="flag-icon">&#9888;</span><span>' +
      'Enter the profit and closing cash from your classroom model above to run the check.</span></div>';
  } else if (ok) {
    verdict = '<div class="flag flag-ok"><span class="flag-icon">&#10003;</span><span>' +
      '<strong>The tool matches the classroom model.</strong> Profit and closing cash agree for ' +
      esc(y.label) + '.</span></div>';
  } else {
    const hints = [];
    if (Math.abs(dProfit) >= 0.5) hints.push('Profit differs by <strong>' + money(dProfit, 2) +
      '</strong> (model ' + money(y.modelProfit) + ', tool ' + money(r.netProfit) + ').');
    if (Math.abs(dCash) >= 0.5) hints.push('Closing cash differs by <strong>' + money(dCash, 2) +
      '</strong> (model ' + money(y.modelCash) + ', tool ' + money(r.closingCash) + ').');
    if (Math.abs(dProfit - dCash) < 0.5 && Math.abs(dProfit) >= 0.5)
      hints.push('Profit and cash are off by the same amount, so the difference is in the P&amp;L, not in the cash timing.');
    if (Math.abs(dProfit) < 0.5 && Math.abs(dCash) >= 0.5)
      hints.push('Profit agrees but cash does not, so look at depreciation, machine purchases, borrowing or repayment &mdash; the non-profit cash items.');
    verdict = '<div class="flag flag-bad"><span class="flag-icon">!</span><span>' +
      '<strong>The tool does not match the classroom model yet.</strong><br>' +
      hints.join('<br>') + '</span></div>';
  }

  el.innerHTML = verdict + flagsHtml(r.flags.filter(f => f.level !== 'ok')) +
    '<div class="two-col" style="margin-top:14px">' +
      '<div>' + plRows(r) + '</div>' +
      '<div>' + cashRows(r) + '</div>' +
    '</div>';
}

/* ---------- decision page ---------- */

function renderDecision(rs) {
  const sel = document.getElementById('chosenSelect');
  sel.innerHTML = rs.map(x =>
    '<option value="' + x.sc.id + '"' + (x.sc.id === state.decision.chosen ? ' selected' : '') + '>' +
    esc(x.sc.name) + '</option>').join('');

  const chosen = rs.find(x => x.sc.id === state.decision.chosen) || rs[0];
  if (!chosen) { document.getElementById('decisionBody').innerHTML = ''; return; }

  const assumed = num(state.decision.assumedSales);
  const atAssumed = computeSeason(scenarioInput(chosen.sc, assumed));
  const be = breakevenSales(chosen.sc);
  const req = num(chosen.sc.salesRequest);

  const worst = computeSeason(scenarioInput(chosen.sc, req * 0.5));

  document.getElementById('decisionBody').innerHTML =
    '<div class="kpis" style="margin-top:18px">' +
      kpi('Recommended', esc(chosen.sc.name)) +
      kpi('Profit at ' + units(assumed) + ' units', money(atAssumed.netProfit), atAssumed.netProfit) +
      kpi('Closing cash', money(atAssumed.closingCash), atAssumed.closingCash) +
      kpi('Break-even sales', be == null ? 'never' : units(Math.ceil(be)) + ' units') +
    '</div>' +
    '<div class="callout">' +
      '<p><strong>Recommendation.</strong> ' +
        (state.decision.text ? esc(state.decision.text)
          : 'Write your recommendation in the box above. It appears here and in the printed version.') + '</p>' +
      '<p><strong>Most important assumption.</strong> ' +
        (state.decision.assumption ? esc(state.decision.assumption)
          : 'State the one assumption this recommendation depends on.') + '</p>' +
      '<p><strong>If sales are allocated lower.</strong> ' +
        (state.decision.downside ? esc(state.decision.downside)
          : 'At half the requested allocation (' + units(req * 0.5) + ' units) this plan makes ' +
            money(worst.netProfit) + ' and closes with ' + money(worst.closingCash) +
            '. Write what you would actually do about that.') + '</p>' +
    '</div>' +
    '<div class="warn-box" style="margin-top:16px">' +
      'This is a first version built on Year 1 experience. Every Year 2 price, premises option and machine ' +
      'choice above is an estimate until the trainer issues the Year 2 rules. The market forecast is not a ' +
      'promise of sales &mdash; the trainer allocates the market in class.' +
    '</div>';
}

/* =========================================================================
   WIRING
   ========================================================================= */

function bindInputs(root) {
  root.querySelectorAll('[data-path]').forEach(el => {
    const path = el.dataset.path;
    const val = getPath(path);

    if (el.type === 'checkbox') el.checked = !!val;
    else el.value = (val === null || val === undefined) ? '' : val;

    el.oninput = el.onchange = () => {
      let v;
      if (el.type === 'checkbox') v = el.checked;
      else if (el.type === 'number') v = el.value === '' ? null : parseFloat(el.value);
      else v = el.value;
      setPath(path, v);
      save();

      // Structural fields change the shape of the page, not just the numbers.
      if (/\.(premisesId|buyMachine)$/.test(path) || /^(machines|premises)\./.test(path)) {
        renderScenarioInputs();
      }
      renderOutputs();
    };
  });
}

function showTab(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('tab-' + name).classList.remove('hidden');
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('is-active', t.dataset.tab === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function uid(prefix) { return prefix + Math.random().toString(36).slice(2, 7); }

function init() {
  bindInputs(document);
  renderMachines();
  renderPremises();
  renderScenarioInputs();
  renderOutputs();

  document.getElementById('tabs').onclick = e => {
    const t = e.target.closest('.tab');
    if (t) showTab(t.dataset.tab);
  };

  document.getElementById('btnAddMachine').onclick = () => {
    state.machines.push({ id: uid('m'), name: 'New machine', bookValue: 0,
      remainingSeasons: 8, capacity: 0, runCost: 0, deprPerSeason: 0 });
    save(); renderMachines(); renderScenarioInputs(); renderOutputs();
  };

  document.getElementById('btnAddPremises').onclick = () => {
    state.premises.push({ id: uid('p'), name: 'New premises', rent: 0, capacity: 0 });
    save(); renderPremises(); renderScenarioInputs(); renderOutputs();
  };

  document.getElementById('btnAddScenario').onclick = () => {
    const base = state.scenarios[state.scenarios.length - 1];
    const copy = JSON.parse(JSON.stringify(base));
    copy.id = uid('s');
    copy.name = 'Option ' + String.fromCharCode(65 + state.scenarios.length);
    state.scenarios.push(copy);
    save(); renderScenarioInputs(); renderOutputs();
  };

  document.getElementById('btnExport').onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'year2-decision-tool.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  document.getElementById('fileImport').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        state = merge(defaults(), JSON.parse(reader.result));
        save();
        bindInputs(document);
        renderMachines(); renderPremises(); renderScenarioInputs(); renderOutputs();
      } catch (err) { alert('That file could not be read as saved tool data.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  document.getElementById('btnReset').onclick = () => {
    if (!confirm('Reset every input back to the seeded placeholder values? Your current figures will be lost.')) return;
    state = defaults();
    save();
    bindInputs(document);
    renderMachines(); renderPremises(); renderScenarioInputs(); renderOutputs();
  };

  document.getElementById('btnPrint').onclick = () => window.print();

  document.getElementById('btnTheme').onclick = () => {
    const root = document.documentElement;
    const now = root.getAttribute('data-theme');
    const next = now === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('pgic-theme', next); } catch (e) {}
  };

  try {
    const saved = localStorage.getItem('pgic-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    else document.documentElement.removeAttribute('data-theme');
  } catch (e) {}
}

init();
