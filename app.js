/* =========================================================================
   app.js - state, rendering and charts.
   The accounting lives in engine.js; the catalogue lives in data.js.
   ========================================================================= */

const STORAGE_KEY = 'pgic-y2-tool-v2';
const SEASONS = ['winter', 'spring', 'summer', 'autumn'];
const OPT_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];

/* ============================================================== defaults === */

function blankSeason(key, name) {
  return {
    key, name, played: false,
    premises: [{ premiseId: 'D', machines: [{ typeId: 'M1', qty: 1 }], plannedProduction: 70000 }],
    buyMachines: [],
    milkTons: 3.5,
    marketInvestment: 5000,
    requested: 70000,
    allocated: 70000,
    newLoan: { name: '', amount: 0, termSeasons: 8, ratePct: RULES.loanRatePct },
    modelProfit: null, modelCash: null
  };
}

function defaults() {
  const winter = blankSeason('winter', 'Year 1 winter');
  /* --- Group 7's real Year 1 winter setup ------------------------------
     Premise D (rent 17,000, transport 0.1), one Machine 1 bought for 35,000,
     3.5 tons of milk (70,000 Sh), Sh 5,000 on the market, 70,000 requested,
     and a Sh 50,000 bank loan.                                            */
  winter.played = true;
  winter.premises = [{ premiseId: 'D', machines: [{ typeId: 'M1', qty: 1 }], plannedProduction: 70000 }];
  winter.buyMachines = [{ typeId: 'M1', qty: 1 }];
  winter.milkTons = 3.5;
  winter.marketInvestment = 5000;
  winter.requested = 70000;
  winter.allocated = 70000;              // TRAINER'S REAL NUMBER GOES HERE
  winter.newLoan = { name: 'Winter loan', amount: 50000, termSeasons: 8, ratePct: 10 };

  const spring = blankSeason('spring', 'Year 1 spring');
  const summer = blankSeason('summer', 'Year 1 summer');
  const autumn = blankSeason('autumn', 'Year 1 autumn');
  [spring, summer, autumn].forEach(s => { s.buyMachines = []; s.newLoan.amount = 0; });

  return {
    meta: { company: 'Pork & Garlic Ice Cream Co.', team: 'Group 7' },
    y1: { seasons: [winter, spring, summer, autumn] },
    position: { override: false, cash: null, lossPool: null },
    rules: JSON.parse(JSON.stringify(RULES)),

    /* --- Three Year 2 winter options -----------------------------------
       A repeats Year 1 winter. B doubles capacity with a second Machine 1
       (the cheapest capacity in the game). C is the half-measure, kept in
       deliberately because it shows why half-measures lose here.          */
    options: [
      {
        id: 'o1', name: 'Option A · Hold Premise D',
        premises: [{ premiseId: 'D', machines: [{ typeId: 'M1', qty: 1 }], plannedProduction: 70000 }],
        buyMachines: [],
        milkTons: 3.5, marketInvestment: 5000, requested: 70000, allocated: 70000,
        newLoan: { name: '', amount: 0, termSeasons: 8, ratePct: 10 }
      },
      {
        id: 'o2', name: 'Option B · Premise F, second Machine 1',
        premises: [{ premiseId: 'F', machines: [{ typeId: 'M1', qty: 2 }], plannedProduction: 140000 }],
        buyMachines: [{ typeId: 'M1', qty: 1 }],
        milkTons: 7, marketInvestment: 12000, requested: 140000, allocated: 140000,
        newLoan: { name: 'Y2 winter expansion loan', amount: 90000, termSeasons: 8, ratePct: 10 }
      },
      {
        id: 'o3', name: 'Option C · Expand but hold the milk back',
        premises: [{ premiseId: 'F', machines: [{ typeId: 'M1', qty: 2 }], plannedProduction: 100000 }],
        buyMachines: [{ typeId: 'M1', qty: 1 }],
        milkTons: 5, marketInvestment: 9000, requested: 100000, allocated: 100000,
        newLoan: { name: 'Y2 winter loan', amount: 25000, termSeasons: 8, ratePct: 10 }
      }
    ],

    decision: {
      chosen: 'o2',
      assumedAllocation: 140000,

      text: 'Take Option B. Move to Premise F, buy a second Machine 1, and commit 7 tons of milk ' +
        'against a 140,000 request, funded by a Sh 90,000 loan over 8 seasons. At a full fill it ' +
        'returns Sh 37,703 against Option A’s Sh 15,533, and it needs a LOWER fill rate to break ' +
        'even — 82% against Option A’s 86% — because the fixed Sh 10,000 salaries and the rent ' +
        'are spread over twice the volume. Machine 1 is the cheapest capacity in the game at 0.486 Sh ' +
        'per unit bought and 0.086 Sh per unit to own each season, and it keeps earning for eight ' +
        'seasons. Option C is in the tool to show why the half-measure loses: leaving Premise D doubles ' +
        'transport from 0.1 to 0.2 per unit sold, which swallows almost the whole gain unless the extra ' +
        'capacity is actually filled.',

      assumption: 'That the trainer fills at least 82% of a 140,000 request. That is 28.1% of the ' +
        'Year 2 winter forecast of 410,000 — and 35.2% of the market if it comes in 20% below ' +
        'forecast at 328,000. The largest share this team has ever been granted is 25%, in Year 1 ' +
        'winter, when we were filled in full on a 70,000 request. Everything rests on that one number: ' +
        'above a 77% fill Option B beats Option A, below it Option A is better, and below 82% Option B ' +
        'loses money outright.',

      downside: 'At a 70% fill Option B loses Sh 29,508 against Option A’s Sh 20,541; at 50% it ' +
        'loses Sh 77,725 against Sh 46,050. Cash stays positive in every case, so no rule is breached ' +
        '— the loss is the punishment, not insolvency. The lever we control is the request itself. ' +
        'Milk is the only cost spent before the trainer speaks and thrown away if unsold, so dropping ' +
        'the request by one 10,000 block takes Sh 20,000 of committed milk off the table with it. If ' +
        'the class starts requesting heavily, we cut to 120,000 units and 6 tons BEFORE the market, ' +
        'not after.'
    }
  };
}

/* ========================================================= state plumbing === */

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return reconcile(defaults(), JSON.parse(raw));
  } catch (e) { /* blocked or corrupt storage - fall through */ }
  return defaults();
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}
function reconcile(base, saved) {
  if (Array.isArray(base)) return Array.isArray(saved) ? saved : base;
  if (base && typeof base === 'object') {
    const out = {};
    for (const k of Object.keys(base)) out[k] = (saved && k in saved) ? reconcile(base[k], saved[k]) : base[k];
    return out;
  }
  return saved === undefined ? base : saved;
}
const getPath = p => p.split('.').reduce((o, k) => (o == null ? o : o[k]), state);
function setPath(p, v) {
  const keys = p.split('.'), last = keys.pop();
  keys.reduce((o, k) => o[k], state)[last] = v;
}

/* ============================================================ formatting === */

const nf = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
const N = v => (Number.isFinite(+v) ? +v : 0);

function sh(v) {
  const x = Math.round(N(v));
  return (x < 0 ? '−' : '') + 'Sh ' + nf.format(Math.abs(x));
}
function shSigned(v) {
  const x = Math.round(N(v));
  return (x < 0 ? '−' : '+') + 'Sh ' + nf.format(Math.abs(x));
}
const u = v => nf.format(Math.round(N(v)));
const sgn = v => (N(v) < 0 ? 'is-neg' : '');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICONS = { good: '✓', warning: '⚠', serious: '◆', critical: '✕' };

/* ====================================================== Year 1 chaining === */

/** Age every owned machine by one season and fold in this season's purchases. */
function ageMachines(owned, bought) {
  const out = owned.map(o => ({ ...o, seasonsRemaining: Math.max(N(o.seasonsRemaining) - 1, 0) }));
  (bought || []).forEach(b => {
    if (N(b.qty) <= 0) return;
    out.push({ typeId: b.typeId, qty: N(b.qty), seasonsRemaining: RULES.deprSeasons - 1 });
  });
  // fold identical rows together so the table stays short
  const folded = [];
  out.forEach(m => {
    const hit = folded.find(f => f.typeId === m.typeId && f.seasonsRemaining === m.seasonsRemaining);
    if (hit) hit.qty += m.qty; else folded.push({ ...m });
  });
  return folded.filter(m => m.qty > 0);
}

function rollLoans(loans, newLoan) {
  const out = loans
    .map(l => {
      const principal = Math.min(N(l.principalPerSeason), N(l.outstanding));
      return { ...l, outstanding: N(l.outstanding) - principal };
    })
    .filter(l => l.outstanding > 0.5);

  if (newLoan && N(newLoan.amount) > 0) {
    const amount = N(newLoan.amount);
    const term = Math.max(1, Math.min(N(newLoan.termSeasons) || 8, RULES.maxLoanTerm));
    const per = Math.round(amount / term);
    if (amount - per > 0.5) {
      out.push({
        name: newLoan.name || 'Loan', outstanding: amount - per,
        principalPerSeason: per, ratePct: N(newLoan.ratePct) || RULES.loanRatePct
      });
    }
  }
  return out;
}

/** Run the Year 1 seasons in order, carrying everything forward. */
function chainYear1() {
  let cash = RULES.startingCash, lossPool = 0, owned = [], loans = [];
  const rows = [];

  state.y1.seasons.forEach(s => {
    if (!s.played) {
      rows.push({ season: s, r: null, openingCash: cash, lossPool, owned: owned.slice(), loans: loans.slice() });
      return;
    }
    const inp = {
      openingCash: cash, lossPool,
      ownedMachines: owned, buyMachines: s.buyMachines, premises: s.premises,
      milkTons: s.milkTons, marketInvestment: s.marketInvestment,
      requested: s.requested, allocated: s.allocated,
      existingLoans: loans,
      newLoan: (s.newLoan && N(s.newLoan.amount) > 0) ? s.newLoan : null
    };
    const r = computeSeason(inp);
    rows.push({ season: s, r, inp, openingCash: cash, owned: owned.slice(), loans: loans.slice() });

    cash = r.closingCash;
    lossPool = r.lossPoolOut;
    owned = ageMachines(owned, s.buyMachines);
    loans = rollLoans(loans, inp.newLoan);
  });

  const played = rows.filter(x => x.r);
  return {
    rows, cash, lossPool, owned, loans,
    playedCount: played.length,
    annualProfit: played.reduce((a, x) => a + x.r.netProfit, 0),
    lastPlayed: played.length ? played[played.length - 1].season.name : null
  };
}

/** The opening position for a Year 2 winter option. */
function position() {
  const c = chainYear1();
  return {
    cash: state.position.override && state.position.cash !== null ? N(state.position.cash) : c.cash,
    lossPool: state.position.override && state.position.lossPool !== null ? N(state.position.lossPool) : c.lossPool,
    owned: c.owned, loans: c.loans,
    annualProfit: c.annualProfit, chain: c
  };
}

function optionInput(opt, allocOverride) {
  const pos = position();
  return {
    openingCash: pos.cash, lossPool: pos.lossPool,
    ownedMachines: pos.owned, buyMachines: opt.buyMachines, premises: opt.premises,
    milkTons: opt.milkTons, marketInvestment: opt.marketInvestment,
    requested: opt.requested,
    allocated: allocOverride === undefined ? opt.allocated : allocOverride,
    existingLoans: pos.loans,
    newLoan: (opt.newLoan && N(opt.newLoan.amount) > 0) ? opt.newLoan : null,
    rules: state.rules
  };
}

const optionResults = () => state.options.map((opt, i) => ({
  opt, i, color: OPT_COLORS[i % OPT_COLORS.length], r: computeSeason(optionInput(opt))
}));

/** Units that must be sold for this option to break even before tax.
 *  Profit is only piecewise linear in the allocation - the 5% bonus switches
 *  on the moment gross profit turns positive - so this bisects for the real
 *  root rather than drawing a chord across the kink. */
function breakEven(opt) {
  const req = N(opt.requested);
  if (req <= 0) return null;
  const pbtAt = a => computeSeason(optionInput(opt, a)).pbt;
  if (pbtAt(req) < 0) return null;          // never breaks even, even filled
  if (pbtAt(0) >= 0) return 0;              // profitable with no sales at all

  let lo = 0, hi = req;
  for (let i = 0; i < 40 && hi - lo > 0.5; i++) {
    const mid = (lo + hi) / 2;
    if (pbtAt(mid) >= 0) hi = mid; else lo = mid;
  }
  return hi;
}

/* ================================================================ charts === */

const tipEl = () => document.getElementById('tip');
function showTip(evt, html) {
  const t = tipEl();
  t.innerHTML = html;
  t.classList.add('on');
  const pad = 14, w = t.offsetWidth, h = t.offsetHeight;
  let x = evt.clientX + pad, y = evt.clientY + pad;
  if (x + w > innerWidth - 8) x = evt.clientX - w - pad;
  if (y + h > innerHeight - 8) y = evt.clientY - h - pad;
  t.style.left = x + 'px'; t.style.top = y + 'px';
}
const hideTip = () => tipEl().classList.remove('on');

/** Horizontal waterfall of the season's cash timeline.
 *  Labels sit on the left, so a dozen steps stay readable. */
function cashWaterfall(r, color, id) {
  const steps = r.steps;
  const rowH = 21, gap = 5, padL = 178, padR = 74, padT = 22, padB = 8;
  const H = padT + steps.length * (rowH + gap) + padB;
  const W = 720;
  const plotW = W - padL - padR;

  const balances = steps.map(s => s.balance);
  const lo = Math.min(0, ...balances), hi = Math.max(0, ...balances);
  const span = (hi - lo) || 1;
  const x = v => padL + (v - lo) / span * plotW;

  let svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
            'aria-label="Cash timeline through the season">';

  // zero reference
  svg += '<line class="zero-line" x1="' + x(0).toFixed(1) + '" y1="' + (padT - 8) +
         '" x2="' + x(0).toFixed(1) + '" y2="' + (H - padB) + '"/>';
  svg += '<text x="' + x(0).toFixed(1) + '" y="' + (padT - 12) + '" text-anchor="middle">0</text>';

  steps.forEach((s, i) => {
    const y = padT + i * (rowH + gap);
    const marker = s.flow === null;
    const prev = i > 0 ? steps[i - 1].balance : 0;
    const from = marker ? 0 : prev;
    const to = s.balance;
    const x1 = Math.min(x(from), x(to)), x2 = Math.max(x(from), x(to));
    const wBar = Math.max(x2 - x1, 2);

    let fill, op;
    if (marker) { fill = 'var(--rule-strong)'; op = s.balance < 0 ? '1' : '.85'; }
    else if (s.flow >= 0) { fill = color; op = '1'; }
    else { fill = 'var(--ink-muted)'; op = '.85'; }
    if (s.balance < 0) { fill = 'var(--critical)'; op = '1'; }

    svg += '<rect x="' + x1.toFixed(1) + '" y="' + y + '" width="' + wBar.toFixed(1) +
           '" height="' + rowH + '" rx="3" fill="' + fill + '" opacity="' + op + '"/>';

    svg += '<text x="' + (padL - 10) + '" y="' + (y + rowH / 2 + 3.5) + '" text-anchor="end"' +
           (marker ? ' style="font-weight:600;fill:var(--ink-2)"' : '') + '>' +
           esc(s.label.length > 30 ? s.label.slice(0, 29) + '…' : s.label) + '</text>';

    svg += '<text class="val-label" x="' + (W - padR + 8) + '" y="' + (y + rowH / 2 + 3.5) + '"' +
           (s.balance < 0 ? ' style="fill:var(--critical)"' : '') + '>' +
           nf.format(Math.round(s.balance)) + '</text>';

    svg += '<rect class="hit" data-wf="' + id + '|' + i + '" x="0" y="' + (y - gap / 2) +
           '" width="' + W + '" height="' + (rowH + gap) + '"/>';
  });

  svg += '</svg>';
  return svg;
}

/** Net profit against the trainer's allocation, one line per option. */
function allocationChart(series, id) {
  const W = 720, H = 268, padL = 62, padR = 104, padT = 16, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const maxX = Math.max(...series.map(s => s.maxAlloc), 1);
  const allY = series.flatMap(s => s.points.map(p => p.y));

  /* Round the y scale out to a nice step so zero is always a labelled tick. */
  const rawLo = Math.min(0, ...allY), rawHi = Math.max(0, ...allY);
  const rawStep = (rawHi - rawLo) / 5 || 1;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = [1, 2, 2.5, 5, 10].find(m => m * mag >= rawStep) * mag;
  const lo = Math.floor(rawLo / step) * step;
  const hi = Math.ceil(rawHi / step) * step;

  const X = v => padL + v / maxX * plotW;
  const Y = v => padT + (hi - v) / (hi - lo) * plotH;

  let svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
            'aria-label="Net profit against units allocated">';

  // y grid, on the nice step so 0 always lands on a line
  for (let v = lo; v <= hi + step / 2; v += step) {
    const y = Y(v), isZero = Math.abs(v) < step / 2;
    svg += '<line class="' + (isZero ? 'zero-line' : 'grid-line') + '" x1="' + padL +
           '" y1="' + y.toFixed(1) + '" x2="' + (padL + plotW) + '" y2="' + y.toFixed(1) + '"/>';
    svg += '<text x="' + (padL - 8) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end"' +
           (isZero ? ' style="fill:var(--ink-2);font-weight:600"' : '') + '>' +
           (isZero ? '0' : nf.format(Math.round(v / 1000)) + 'k') + '</text>';
  }
  // x ticks
  for (let i = 0; i <= 5; i++) {
    const v = maxX * i / 5;
    svg += '<text x="' + X(v).toFixed(1) + '" y="' + (H - padB + 16) + '" text-anchor="middle">' +
           nf.format(Math.round(v / 1000)) + 'k</text>';
  }
  svg += '<text x="' + (padL + plotW / 2) + '" y="' + (H - 3) + '" text-anchor="middle">Ice creams allocated by the trainer</text>';

  series.forEach(s => {
    const d = s.points.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
    svg += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="2" ' +
           'stroke-linecap="round" stroke-linejoin="round"/>';
    // break-even marker
    if (s.be != null && s.be >= 0 && s.be <= s.maxAlloc) {
      svg += '<circle class="mark-ring" cx="' + X(s.be).toFixed(1) + '" cy="' + Y(0).toFixed(1) +
             '" r="4.5" fill="' + s.color + '"/>';
    }
    // Direct label at this series' own line end. A shorter option ends mid-plot,
    // so the label carries a surface halo to stay legible over the other line.
    const last = s.points[s.points.length - 1];
    svg += '<text x="' + (X(last.x) + 9).toFixed(1) + '" y="' + (Y(last.y) - 6).toFixed(1) +
           '" style="fill:' + s.color + ';font-weight:600;paint-order:stroke;' +
           'stroke:var(--surface);stroke-width:3px;stroke-linejoin:round">' + esc(s.short) + '</text>';
  });

  // crosshair hit area
  svg += '<rect class="hit" data-alloc="' + id + '" x="' + padL + '" y="' + padT +
         '" width="' + plotW + '" height="' + plotH + '"/>';
  svg += '<line id="' + id + '-cross" x1="0" y1="' + padT + '" x2="0" y2="' + (padT + plotH) +
         '" stroke="var(--rule-strong)" stroke-width="1" opacity="0"/>';
  svg += '</svg>';
  return svg;
}

/* ============================================================ components === */

function alerts(list) {
  if (!list.length) return '';
  const order = { critical: 0, serious: 1, warning: 2, good: 3 };
  return list.slice().sort((a, b) => order[a.level] - order[b.level]).map(a =>
    '<div class="alert alert-' + a.level + '"><span class="ico">' + ICONS[a.level] +
    '</span><span>' + a.text + '</span></div>').join('');
}

const tile = (k, v, sub, cls) =>
  '<div class="tile"><span class="k">' + k + '</span><div class="v ' + (cls || '') + '">' + v + '</div>' +
  (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>';

function plTable(r) {
  const row = (label, v, cls) =>
    '<tr class="' + (cls || '') + '"><td>' + label + '</td><td class="n ' + sgn(v) + '">' + sh(v) + '</td></tr>';
  return '<div class="t-wrap"><table class="t">' +
    '<thead><tr><th>Profit &amp; loss</th><th class="n">Sh</th></tr></thead><tbody>' +
    row('Revenue &mdash; ' + u(r.sold) + ' &times; Sh&nbsp;2', r.revenue) +
    row('Milk bought (' + nf2.format(r.milkTons) + ' t, spoiled portion included)', -r.milkCost, 'in') +
    row('Machine maintenance', -r.maintenance, 'in') +
    row('Machine depreciation', -r.depreciation, 'in') +
    row('Gross profit', r.grossProfit, 'sub') +
    row('Transport', -r.transport, 'in') +
    row('Market investment', -r.marketInvestment, 'in') +
    row('Bonus &mdash; 5% of gross profit', -r.bonus, 'in') +
    row('Fixed salaries', -r.salaries, 'in') +
    row('Premise rent', -r.rent, 'in') +
    row('Loan interest', -r.interest, 'in') +
    row('Profit before tax', r.pbt, 'sub') +
    row('Loss pool used', -r.lossUsed, 'in') +
    row('Taxable profit', r.taxable, 'in') +
    row('Game tax &mdash; 10%', -r.tax, 'in') +
    row('Net profit', r.netProfit, 'total') +
    '</tbody></table></div>' +
    '<p class="hint" style="margin-top:10px">Loss pool: ' + sh(r.lossPoolIn) + ' in, ' + sh(r.lossUsed) +
    ' used, <strong>' + sh(r.lossPoolOut) + '</strong> carried forward. ' +
    'Machine purchases and loan principal are cash only &mdash; they never touch this statement.</p>';
}

function cashTable(r) {
  const body = r.steps.map(s => {
    const mark = s.flow === null;
    return '<tr class="' + (mark ? 'sub' : 'in') + '"><td>' + esc(s.label) + '</td>' +
      '<td class="n ' + (s.flow == null ? '' : sgn(s.flow)) + '">' + (s.flow == null ? '' : shSigned(s.flow)) + '</td>' +
      '<td class="n ' + sgn(s.balance) + '">' + sh(s.balance) + '</td></tr>';
  }).join('');
  return '<div class="t-wrap"><table class="t">' +
    '<thead><tr><th>Cash flow</th><th class="n">Movement</th><th class="n">Balance</th></tr></thead><tbody>' +
    body +
    '<tr class="total"><td>Closing cash</td><td class="n"></td><td class="n ' + sgn(r.closingCash) + '">' +
    sh(r.closingCash) + '</td></tr></tbody></table></div>' +
    '<p class="hint" style="margin-top:10px">Tie&#8209;back: opening ' + sh(r.openingCash) + ' + net profit ' +
    sh(r.netProfit) + ' + depreciation ' + sh(r.depreciation) + ' + loan received ' + sh(r.loanReceived) +
    ' &minus; principal repaid ' + sh(r.loans.principal) + ' &minus; machines bought ' + sh(r.machinePurchases) +
    ' = ' + sh(r.reconciled) +
    (Math.abs(r.reconcileGap) < 0.5
      ? ' <span class="badge badge-ok">matches</span>'
      : ' <span class="badge badge-bad">off by ' + sh(r.reconcileGap) + '</span>') + '</p>';
}

/* ================================================= shared decision editor === */

function decisionEditor(obj, P) {
  const siteRows = (obj.premises || []).map((site, si) => {
    const prem = premiseById(site.premiseId) || {};
    const cap = (site.machines || []).reduce((s, m) => {
      const t = machineById(m.typeId); return s + (t ? t.capacity * N(m.qty) : 0);
    }, 0);
    const used = (site.machines || []).reduce((s, m) => s + N(m.qty), 0);
    const over = used > N(prem.slots);

    const machineRows = (site.machines || []).map((m, mi) =>
      '<div style="display:flex;gap:7px;align-items:center;margin-bottom:6px">' +
        '<select data-path="' + P + '.premises.' + si + '.machines.' + mi + '.typeId" style="flex:1">' +
          MACHINES.map(t => '<option value="' + t.id + '"' + (t.id === m.typeId ? ' selected' : '') + '>' +
            t.name + ' · ' + u(t.capacity) + '/season</option>').join('') +
        '</select>' +
        '<input type="number" min="0" step="1" style="width:62px" ' +
          'data-path="' + P + '.premises.' + si + '.machines.' + mi + '.qty">' +
        '<button class="btn btn-xs btn-ghost" data-act="delMachine" data-a="' + P + '" data-b="' + si +
          '" data-c="' + mi + '" type="button">&times;</button>' +
      '</div>').join('');

    return '<div class="site">' +
      '<div class="site-head">' +
        '<select data-path="' + P + '.premises.' + si + '.premiseId" style="flex:1;max-width:210px">' +
          PREMISES.map(p => '<option value="' + p.id + '"' + (p.id === site.premiseId ? ' selected' : '') + '>' +
            p.name + ' · ' + p.slots + ' slot' + (p.slots > 1 ? 's' : '') + '</option>').join('') +
        '</select>' +
        '<button class="btn btn-xs btn-ghost" data-act="delSite" data-a="' + P + '" data-b="' + si +
          '" type="button">Remove</button>' +
      '</div>' +
      '<div class="site-meta" style="margin-bottom:8px">Rent ' + u(prem.rent) + ' · transport ' +
        prem.transport + '/unit · slots ' + used + '/' + prem.slots +
        (over ? ' <span class="is-neg">over</span>' : '') + ' · capacity ' + u(cap) + '</div>' +
      machineRows +
      '<button class="btn btn-xs" data-act="addMachine" data-a="' + P + '" data-b="' + si +
        '" type="button">+ machine</button>' +
      '<label class="field" style="margin-top:9px"><span>Produce here <span class="unit">units</span></span>' +
        '<input type="number" step="1000" data-path="' + P + '.premises.' + si + '.plannedProduction"></label>' +
    '</div>';
  }).join('');

  const buyRows = (obj.buyMachines || []).map((b, bi) => {
    const t = machineById(b.typeId) || {};
    return '<div style="display:flex;gap:7px;align-items:center;margin-bottom:6px">' +
      '<select data-path="' + P + '.buyMachines.' + bi + '.typeId" style="flex:1">' +
        MACHINES.map(m => '<option value="' + m.id + '"' + (m.id === b.typeId ? ' selected' : '') + '>' +
          m.name + ' · ' + u(m.price) + ' Sh</option>').join('') +
      '</select>' +
      '<input type="number" min="0" step="1" style="width:62px" data-path="' + P + '.buyMachines.' + bi + '.qty">' +
      '<button class="btn btn-xs btn-ghost" data-act="delBuy" data-a="' + P + '" data-b="' + bi +
        '" type="button">&times;</button>' +
    '</div>' +
    '<div class="site-meta" style="margin:-3px 0 9px">Maintenance ' + u(t.maintenance) +
      '/season · depreciation ' + u(t.depr) + '/season for 8 seasons</div>';
  }).join('');

  return '' +
    '<fieldset><legend>Premises and machines</legend>' +
      siteRows +
      '<button class="btn btn-xs" data-act="addSite" data-a="' + P + '" type="button">+ rent a premise</button>' +
    '</fieldset>' +

    '<fieldset><legend>Machines bought this season</legend>' +
      (buyRows || '<p class="hint">None. Cash only &mdash; a purchase never hits the P&amp;L.</p>') +
      '<button class="btn btn-xs" data-act="addBuy" data-a="' + P + '" type="button">+ buy a machine</button>' +
    '</fieldset>' +

    '<fieldset><legend>Milk and the market</legend>' +
      '<div class="grid g2">' +
        '<label class="field"><span>Milk <span class="unit">tons, min 1</span></span>' +
          '<input type="number" step="0.5" min="1" data-path="' + P + '.milkTons"></label>' +
        '<label class="field"><span>Market investment <span class="unit">Sh, min 1,000</span></span>' +
          '<input type="number" step="1000" data-path="' + P + '.marketInvestment"></label>' +
        '<label class="field"><span>Requested <span class="unit">blocks of 10,000</span></span>' +
          '<input type="number" step="10000" data-path="' + P + '.requested"></label>' +
        '<label class="field"><span>Allocated <span class="unit">the trainer decides</span></span>' +
          '<input type="number" step="10000" data-path="' + P + '.allocated"></label>' +
      '</div>' +
    '</fieldset>' +

    '<fieldset><legend>New bank loan this season</legend>' +
      '<div class="grid g3">' +
        '<label class="field"><span>Amount <span class="unit">Sh</span></span>' +
          '<input type="number" step="5000" data-path="' + P + '.newLoan.amount"></label>' +
        '<label class="field"><span>Term <span class="unit">1&ndash;8 seasons</span></span>' +
          '<input type="number" min="1" max="8" step="1" data-path="' + P + '.newLoan.termSeasons"></label>' +
        '<label class="field"><span>Rate <span class="unit">% per season</span></span>' +
          '<input type="number" step="1" data-path="' + P + '.newLoan.ratePct"></label>' +
      '</div>' +
    '</fieldset>';
}

/* --------------------------------------------------------- debt schedule --- */

/** Season 0 is Year 1 winter, season 4 is Year 2 winter, and so on. */
function seasonLabel(offset) {
  const year = Math.floor(offset / 4) + 1;
  const s = SEASONS[((offset % 4) + 4) % 4];
  return 'Y' + year + ' ' + s;
}

/** s.08: equal principal each season at 10% on the balance before repayment. */
function remainingSchedule(loan, startOffset) {
  const rows = [];
  let out = N(loan.outstanding);
  const per = Math.max(N(loan.principalPerSeason), 1);
  for (let i = 0; out > 0.5 && i < 24; i++) {
    const interest = Math.round(out * N(loan.ratePct) / 100);
    const principal = Math.min(per, out);
    rows.push({
      label: seasonLabel(startOffset + i), offset: startOffset + i,
      opening: out, interest, principal, payment: principal + interest, closing: out - principal
    });
    out -= principal;
  }
  return rows;
}

const LAST_Y3_SEASON = 11;   // Y3 autumn, the deadline for a Year 1 or Year 2 loan

function debtScheduleCard(loans, startOffset) {
  if (!loans.length) return '';

  const blocks = loans.map(l => {
    const rows = remainingSchedule(l, startOffset);
    if (!rows.length) return '';
    const last = rows[rows.length - 1];
    const late = last.offset > LAST_Y3_SEASON;
    const totalInterest = rows.reduce((s, r) => s + r.interest, 0);

    return '<h3 class="section-title" style="margin-top:18px">' + esc(l.name) + '</h3>' +
      '<div class="t-wrap"><table class="t"><thead><tr><th>Season</th><th class="n">Debt before</th>' +
      '<th class="n">Interest 10%</th><th class="n">Principal</th><th class="n">Bank payment</th>' +
      '<th class="n">Debt after</th></tr></thead><tbody>' +
      rows.map(r => '<tr><td>' + r.label + '</td><td class="n">' + sh(r.opening) + '</td>' +
        '<td class="n">' + sh(r.interest) + '</td><td class="n">' + sh(r.principal) + '</td>' +
        '<td class="n">' + sh(r.payment) + '</td><td class="n">' + sh(r.closing) + '</td></tr>').join('') +
      '<tr class="total"><td>Still to pay</td><td class="n"></td><td class="n">' + sh(totalInterest) + '</td>' +
      '<td class="n">' + sh(rows.reduce((s, r) => s + r.principal, 0)) + '</td>' +
      '<td class="n">' + sh(rows.reduce((s, r) => s + r.payment, 0)) + '</td><td class="n">Sh 0</td></tr>' +
      '</tbody></table></div>' +
      '<div class="alert alert-' + (late ? 'critical' : 'good') + '" style="margin-top:10px">' +
      '<span class="ico">' + (late ? ICONS.critical : ICONS.good) + '</span><span>' +
      (late
        ? 'This loan is still outstanding after ' + seasonLabel(LAST_Y3_SEASON) +
          '. A loan taken in Year 1 or Year 2 must be fully repaid by the end of Year 3 &mdash; ' +
          'shorten the term or make an extra principal repayment by Year 3 autumn.'
        : 'Clears in <strong>' + last.label + '</strong>, inside the Year 3 deadline. ' +
          sh(totalInterest) + ' of interest left to pay.') +
      '</span></div>';
  }).join('');

  return '<div class="card"><h3>Debt schedule</h3>' +
    '<p class="hint">Equal principal every season, interest at 10% on the balance standing before that ' +
    'season’s repayment. The term is the team’s own choice &mdash; one to eight seasons, and no ' +
    'longer than two game years. A Year 1 or Year 2 loan must be fully repaid by the end of Year 3.</p>' +
    blocks + '</div>';
}

/* ============================================================== page 01 === */

function renderPosition() {
  const pos = position();
  const c = pos.chain;
  const ownedCap = pos.owned.reduce((s, m) => {
    const t = machineById(m.typeId); return s + (t ? t.capacity * m.qty : 0);
  }, 0);
  const ownedBook = pos.owned.reduce((s, m) => {
    const t = machineById(m.typeId);
    return s + (t ? t.price * m.qty * m.seasonsRemaining / RULES.deprSeasons : 0);
  }, 0);
  const debt = pos.loans.reduce((s, l) => s + N(l.outstanding), 0);

  const missing = 4 - c.playedCount;

  document.getElementById('positionBody').innerHTML =
    (missing > 0 ? '<div class="alert alert-warning"><span class="ico">' + ICONS.warning + '</span><span>' +
      '<strong>' + c.playedCount + ' of 4 Year 1 seasons entered.</strong> ' +
      'The assignment asks for the position after Year 1 <em>autumn</em>. This is the position after ' +
      esc(c.lastPlayed || 'the start of the game') + '. Enter the remaining ' + missing +
      ' season' + (missing > 1 ? 's' : '') + ' on the Year 1 ledger page as they are played.' +
      '</span></div>' : '') +

    '<div class="tiles" style="margin-bottom:18px">' +
      tile('Cash', sh(pos.cash), 'after ' + esc(c.lastPlayed || 'nothing yet'), sgn(pos.cash) ? 'is-neg' : '') +
      tile('Bank debt', sh(debt), pos.loans.length + ' loan' + (pos.loans.length === 1 ? '' : 's') + ' outstanding') +
      tile('Tax loss pool', sh(pos.lossPool), pos.lossPool > 0 ? 'shelters future profit' : 'nothing carried') +
      tile('Profit so far', sh(pos.annualProfit), c.playedCount + ' season' + (c.playedCount === 1 ? '' : 's'),
           pos.annualProfit < 0 ? 'is-neg' : 'is-pos') +
      tile('Machine capacity', u(ownedCap), 'units per season, if slotted') +
      tile('Machine book value', sh(ownedBook), 'straight line over 8 seasons') +
    '</div>' +

    '<div class="card"><h3>Machines owned</h3>' +
      (pos.owned.length
        ? '<div class="t-wrap"><table class="t"><thead><tr><th>Machine</th><th class="n">Qty</th>' +
          '<th class="n">Capacity</th><th class="n">Maintenance</th><th class="n">Depreciation</th>' +
          '<th class="n">Seasons left</th><th class="n">Book value</th></tr></thead><tbody>' +
          pos.owned.map(m => {
            const t = machineById(m.typeId);
            const book = t.price * m.qty * m.seasonsRemaining / RULES.deprSeasons;
            return '<tr' + (m.seasonsRemaining === 0 ? ' class="quiet"' : '') + '><td>' + t.name + '</td>' +
              '<td class="n">' + m.qty + '</td><td class="n">' + u(t.capacity * m.qty) + '</td>' +
              '<td class="n">' + u(t.maintenance * m.qty) + '</td>' +
              '<td class="n">' + (m.seasonsRemaining > 0 ? u(t.depr * m.qty) : '&mdash;') + '</td>' +
              '<td class="n">' + m.seasonsRemaining + ' / 8</td>' +
              '<td class="n">' + sh(book) + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<p class="hint" style="margin-top:10px">A machine with no seasons left still costs maintenance ' +
          'and must be replaced to keep producing.</p>'
        : '<p class="hint">No machines owned yet.</p>') +
    '</div>' +

    '<div class="card"><h3>Loans outstanding</h3>' +
      (pos.loans.length
        ? '<div class="t-wrap"><table class="t"><thead><tr><th>Loan</th><th class="n">Outstanding</th>' +
          '<th class="n">Principal / season</th><th class="n">Rate</th><th class="n">Next interest</th>' +
          '<th class="n">Seasons left</th></tr></thead><tbody>' +
          pos.loans.map(l => '<tr><td>' + esc(l.name) + '</td>' +
            '<td class="n">' + sh(l.outstanding) + '</td>' +
            '<td class="n">' + sh(l.principalPerSeason) + '</td>' +
            '<td class="n">' + l.ratePct + '%</td>' +
            '<td class="n">' + sh(l.outstanding * l.ratePct / 100) + '</td>' +
            '<td class="n">' + Math.ceil(l.outstanding / Math.max(l.principalPerSeason, 1)) + '</td></tr>').join('') +
          '</tbody></table></div>'
        : '<p class="hint">No debt outstanding.</p>') +
    '</div>' +

    debtScheduleCard(pos.loans, c.playedCount) +

    '<div class="card"><h3>Override the carried position</h3>' +
      '<p class="hint">Leave this off unless the trainer or your classroom model gives a different ' +
      'closing position. The figures above come straight from the Year 1 ledger.</p>' +
      '<label class="check" style="margin-bottom:12px"><input type="checkbox" data-path="position.override">' +
      ' Enter cash and loss pool by hand</label>' +
      '<div class="grid g3">' +
        '<label class="field"><span>Closing cash <span class="unit">Sh</span></span>' +
          '<input type="number" step="1000" data-path="position.cash"' +
          (state.position.override ? '' : ' disabled') + '></label>' +
        '<label class="field"><span>Tax loss pool <span class="unit">Sh</span></span>' +
          '<input type="number" step="1000" data-path="position.lossPool"' +
          (state.position.override ? '' : ' disabled') + '></label>' +
        '<label class="field"><span>Team name</span><input type="text" data-path="meta.team"></label>' +
      '</div>' +
    '</div>';
}

/* ============================================================== page 02 === */

function renderYear1() {
  const c = chainYear1();

  const summary =
    '<div class="tiles" style="margin-bottom:18px">' +
      tile('Seasons entered', c.playedCount + ' / 4') +
      tile('Profit so far', sh(c.annualProfit), 'sum of entered seasons',
           c.annualProfit < 0 ? 'is-neg' : 'is-pos') +
      tile('Cash now', sh(c.cash)) +
      tile('Loss pool', sh(c.lossPool)) +
    '</div>';

  const cards = c.rows.map((row, i) => {
    const s = row.season, P = 'y1.seasons.' + i;
    const forecast = FORECAST[s.key].y1;

    let result = '<p class="hint">Tick &ldquo;played&rdquo; once the trainer has announced your sales ' +
      'for this season.</p>';

    if (row.r) {
      const r = row.r;
      const hasModel = s.modelProfit !== null && s.modelProfit !== '' &&
                       s.modelCash !== null && s.modelCash !== '';
      const dP = N(s.modelProfit) - r.netProfit, dC = N(s.modelCash) - r.closingCash;
      const ok = Math.abs(dP) < 0.5 && Math.abs(dC) < 0.5;

      let verdict;
      if (!hasModel) {
        verdict = '<div class="alert alert-warning"><span class="ico">' + ICONS.warning + '</span><span>' +
          'Enter what your classroom model says below to check this season.</span></div>';
      } else if (ok) {
        verdict = '<div class="alert alert-good"><span class="ico">' + ICONS.good + '</span><span>' +
          '<strong>Matches your classroom model.</strong> Profit and closing cash agree to the shekel.</span></div>';
      } else {
        const hints = [];
        if (Math.abs(dP) >= 0.5) hints.push('Profit differs by <strong>' + sh(dP) + '</strong> (model ' +
          sh(s.modelProfit) + ', tool ' + sh(r.netProfit) + ').');
        if (Math.abs(dC) >= 0.5) hints.push('Closing cash differs by <strong>' + sh(dC) + '</strong> (model ' +
          sh(s.modelCash) + ', tool ' + sh(r.closingCash) + ').');
        if (Math.abs(dP - dC) < 0.5 && Math.abs(dP) >= 0.5)
          hints.push('Both are off by the same amount, so the difference is a P&amp;L line, not cash timing.');
        else if (Math.abs(dP) < 0.5 && Math.abs(dC) >= 0.5)
          hints.push('Profit agrees but cash does not &mdash; check the machine purchase, the loan ' +
            'received, or the principal repaid. Those three are cash only.');
        else if (Math.abs(dC) < 0.5 && Math.abs(dP) >= 0.5)
          hints.push('Cash agrees but profit does not &mdash; check depreciation, which is profit only.');
        verdict = '<div class="alert alert-critical"><span class="ico">' + ICONS.critical + '</span><span>' +
          '<strong>Does not match your classroom model.</strong><br>' + hints.join('<br>') + '</span></div>';
      }

      result =
        verdict +
        '<div class="tiles" style="margin:14px 0">' +
          tile('Made', u(r.produced)) + tile('Sold', u(r.sold)) +
          tile('Spoiled', u(r.unsold), '', r.unsold > 0 ? 'is-neg' : '') +
          tile('Net profit', sh(r.netProfit), '', r.netProfit < 0 ? 'is-neg' : 'is-pos') +
          tile('Closing cash', sh(r.closingCash), '', sgn(r.closingCash)) +
        '</div>' +
        alerts(r.issues) +
        '<div class="two" style="margin-top:14px"><div>' + plTable(r) + '</div><div>' + cashTable(r) + '</div></div>';
    }

    return '<div class="card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px">' +
        '<h3 style="margin:0;font-size:16px;text-transform:none;letter-spacing:-0.02em;color:var(--ink)">' +
          esc(s.name) + '</h3>' +
        '<div style="display:flex;gap:14px;align-items:center">' +
          '<span class="site-meta">forecast ' + u(forecast) + ' ±' + RULES.marketSwingPct + '%</span>' +
          '<label class="check"><input type="checkbox" data-path="' + P + '.played"> played</label>' +
        '</div>' +
      '</div>' +
      (s.played
        ? '<div class="two"><div>' + decisionEditor(s, P) +
          '<fieldset><legend>Your classroom model says</legend><div class="grid g2">' +
            '<label class="field"><span>Net profit <span class="unit">Sh</span></span>' +
              '<input type="number" data-path="' + P + '.modelProfit"></label>' +
            '<label class="field"><span>Closing cash <span class="unit">Sh</span></span>' +
              '<input type="number" data-path="' + P + '.modelCash"></label>' +
          '</div></fieldset></div>' +
          '<div>' + result + '</div></div>'
        : result) +
    '</div>';
  }).join('');

  document.getElementById('year1Body').innerHTML = summary + cards;
}

/* ============================================================== page 03 === */

function renderRules() {
  document.getElementById('rulesBody').innerHTML =
    '<div class="estimate-banner"><span class="ico" style="font-size:16px">' + ICONS.warning + '</span><div>' +
      '<strong>These are the Year 1 rules, used as a Year 2 estimate.</strong>' +
      'The trainer has not issued the Year 2 rules, premises or machine list. Nothing on this page is a ' +
      'confirmed Year 2 price. The editable figures below feed every calculation, so the whole tool updates ' +
      'the moment the real rules arrive. The only Year 2 fact already in the handout is the demand forecast ' +
      '&mdash; and a forecast is not a promise of sales.' +
    '</div></div>' +

    '<div class="card"><h3>Prices and constants <span class="badge">estimate</span></h3>' +
      '<div class="grid g4">' +
        '<label class="field"><span>Price per ice cream <span class="unit">Sh</span></span>' +
          '<input type="number" step="0.1" data-path="rules.pricePerUnit"></label>' +
        '<label class="field"><span>Milk <span class="unit">Sh per ton</span></span>' +
          '<input type="number" step="1000" data-path="rules.milkPricePerTon"></label>' +
        '<label class="field"><span>Yield <span class="unit">units per ton</span></span>' +
          '<input type="number" step="1000" data-path="rules.unitsPerTon"></label>' +
        '<label class="field"><span>Fixed salaries <span class="unit">Sh per season</span></span>' +
          '<input type="number" step="1000" data-path="rules.fixedSalaries"></label>' +
        '<label class="field"><span>Bonus <span class="unit">% of gross profit</span></span>' +
          '<input type="number" step="1" data-path="rules.bonusPctOfGross"></label>' +
        '<label class="field"><span>Game tax <span class="unit">%</span></span>' +
          '<input type="number" step="1" data-path="rules.taxPct"></label>' +
        '<label class="field"><span>Loan interest <span class="unit">% per season</span></span>' +
          '<input type="number" step="1" data-path="rules.loanRatePct"></label>' +
        '<label class="field"><span>Minimum market investment <span class="unit">Sh</span></span>' +
          '<input type="number" step="500" data-path="rules.minMarketInvestment"></label>' +
      '</div>' +
      '<p class="hint" style="margin-top:14px">The bonus is 5% of <em>gross</em> profit &mdash; revenue less ' +
      'milk, maintenance and depreciation &mdash; and only when that is positive. It is charged before ' +
      'salaries, rent and interest, so it can be paid in a season that ends in a loss.</p>' +
    '</div>' +

    '<div class="card"><h3>Premises <span class="badge">Year 1 list</span></h3>' +
      '<div class="t-wrap"><table class="t"><thead><tr><th>Premise</th><th class="n">Machine slots</th>' +
      '<th class="n">Transport Sh/sold unit</th><th class="n">Rent Sh/season</th>' +
      '<th>Milk storage in Year 2</th></tr></thead><tbody>' +
      PREMISES.map(p => '<tr><td>' + p.name + '</td><td class="n">' + p.slots + '</td>' +
        '<td class="n">' + p.transport + '</td><td class="n">' + u(p.rent) + '</td>' +
        '<td>' + (p.storesMilkY2 ? 'Yes &mdash; marked P' : 'No') + '</td></tr>').join('') +
      '</tbody></table></div>' +
      '<p class="hint" style="margin-top:10px">A slot holds one installed machine; it is not a number of ' +
      'ice creams. Premises A, B and F can store unused milk in Year 2 &mdash; that could matter a great ' +
      'deal once the Year 2 rules land, because in Year 1 all unused milk spoils.</p>' +
    '</div>' +

    '<div class="card"><h3>Machines <span class="badge">Year 1 list</span></h3>' +
      '<div class="t-wrap"><table class="t"><thead><tr><th>Machine</th><th class="n">Capacity/season</th>' +
      '<th class="n">Purchase</th><th class="n">Maintenance</th><th class="n">Depreciation/season</th>' +
      '<th class="n">Sh per unit of capacity</th></tr></thead><tbody>' +
      MACHINES.map(m => '<tr><td>' + m.name + '</td><td class="n">' + u(m.capacity) + '</td>' +
        '<td class="n">' + u(m.price) + '</td><td class="n">' + u(m.maintenance) + '</td>' +
        '<td class="n">' + u(m.depr) + '</td>' +
        '<td class="n">' + (m.price / m.capacity).toFixed(3) + '</td></tr>').join('') +
      '</tbody></table></div>' +
      '<p class="hint" style="margin-top:10px">The last column is purchase price divided by capacity &mdash; ' +
      'Machine 1 is the cheapest capacity in the list at 0.486 Sh per unit, Machine 2 the most expensive ' +
      'at 0.792.</p>' +
    '</div>' +

    '<div class="card"><h3>Demand forecast <span class="badge">not a promise of sales</span></h3>' +
      '<div class="t-wrap"><table class="t"><thead><tr><th>Season</th><th class="n">Year 1</th>' +
      '<th class="n">Year 2</th><th class="n">Year 3</th><th class="n">Year 2 range &plusmn;20%</th>' +
      '</tr></thead><tbody>' +
      SEASONS.map(k => {
        const f = FORECAST[k];
        return '<tr' + (k === 'winter' ? ' class="sub"' : '') + '><td>' +
          k.charAt(0).toUpperCase() + k.slice(1) + '</td>' +
          '<td class="n">' + u(f.y1) + '</td><td class="n">' + u(f.y2) + '</td><td class="n">' + u(f.y3) + '</td>' +
          '<td class="n">' + u(f.y2 * 0.8) + ' – ' + u(f.y2 * 1.2) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="hint" style="margin-top:10px">Year 2 winter is forecast at ' + u(FORECAST.winter.y2) +
      ', which is ' + Math.round((FORECAST.winter.y2 / FORECAST.winter.y1 - 1) * 100) + '% above Year 1 winter. ' +
      'The real market runs anywhere between ' + u(FORECAST.winter.y2 * 0.8) + ' and ' +
      u(FORECAST.winter.y2 * 1.2) + '. If demand exceeds supply the trainer trims the lowest-ranked ' +
      'requests in 10,000-unit blocks &mdash; so a large request is not a large allocation.</p>' +
    '</div>';
}

/* ============================================================== page 04 === */

function renderOptions() {
  document.getElementById('optionCount').textContent =
    state.options.length + ' options. The assignment asks for at least two.';

  document.getElementById('optionsBody').innerHTML = state.options.map((o, i) => {
    const P = 'options.' + i;
    const color = OPT_COLORS[i % OPT_COLORS.length];
    const r = computeSeason(optionInput(o));
    const worst = r.issues.find(x => x.level === 'critical');

    return '<div class="opt" style="--opt-color:' + color + '">' +
      '<div class="opt-head"><span class="swatch"></span>' +
        '<input type="text" data-path="' + P + '.name">' +
        (state.options.length > 2
          ? '<button class="btn btn-xs btn-ghost" data-act="delOption" data-b="' + i + '" type="button">&times;</button>'
          : '') +
      '</div>' +
      decisionEditor(o, P) +
      '<div class="tiles" style="margin-top:16px;grid-template-columns:repeat(2,1fr)">' +
        tile('Net profit', sh(r.netProfit), '', r.netProfit < 0 ? 'is-neg' : 'is-pos') +
        tile('Closing cash', sh(r.closingCash), '', sgn(r.closingCash)) +
      '</div>' +
      (worst ? '<div class="alert alert-critical" style="margin-top:10px"><span class="ico">' +
        ICONS.critical + '</span><span>' + worst.text + '</span></div>' : '') +
    '</div>';
  }).join('');
}

/* ============================================================== page 05 === */

function renderResults() {
  const rs = optionResults();

  document.getElementById('resultsBody').innerHTML = rs.map(x => {
    const r = x.r;
    const be = breakEven(x.opt);
    return '<div class="card">' +
      '<div class="result-head"><span class="swatch" style="background:' + x.color + '"></span>' +
        esc(x.opt.name) + '</div>' +

      '<div class="tiles" style="margin-bottom:16px">' +
        tile('Net profit', sh(r.netProfit), '', r.netProfit < 0 ? 'is-neg' : 'is-pos') +
        tile('Closing cash', sh(r.closingCash), '', sgn(r.closingCash)) +
        tile('Cash before market', sh(r.cashBeforeMarket), 'must stay above zero', sgn(r.cashBeforeMarket)) +
        tile('Made / sold', u(r.produced) + ' / ' + u(r.sold),
             Math.round(r.sellThrough * 100) + '% sold through') +
        tile('Spoiled', u(r.unsold), 'ice creams thrown away', r.unsold > 0 ? 'is-neg' : '') +
        tile('Break-even', be == null ? 'never' : u(Math.ceil(be)) + ' units',
             be == null ? 'no allocation makes this work'
                        : (be > N(x.opt.requested) ? 'more than requested' : 'of ' + u(x.opt.requested) + ' requested'),
             be != null && be > N(x.opt.requested) ? 'is-neg' : '') +
      '</div>' +

      alerts(r.issues) +

      '<h3 style="margin-top:20px">Cash through the season</h3>' +
      '<p class="hint">Advance payments come first &mdash; machines, milk and the market investment are all ' +
      'paid before a single ice cream is sold. Cash must not go below zero at any bar.</p>' +
      cashWaterfall(r, x.color, 'wf' + x.i) +

      '<div class="two" style="margin-top:22px"><div>' + plTable(r) + '</div>' +
      '<div>' + cashTable(r) + transportCard(r) + '</div></div>' +
    '</div>';
  }).join('');

  bindChartHovers(rs);
}

function transportCard(r) {
  if (!r.transportRows.length) return '';
  return '<h3 class="section-title" style="margin-top:18px">Transport by premise</h3>' +
    '<div class="t-wrap"><table class="t"><thead><tr><th>Premise</th><th class="n">Produced</th>' +
    '<th class="n">Sold here</th><th class="n">Rate</th><th class="n">Cost</th></tr></thead><tbody>' +
    r.transportRows.map(t => '<tr><td>' + esc(t.name) + '</td><td class="n">' + u(t.produced) + '</td>' +
      '<td class="n">' + u(t.soldHere) + '</td><td class="n">' + t.transport + '</td>' +
      '<td class="n">' + sh(t.cost) + '</td></tr>').join('') +
    '<tr class="total"><td>Total</td><td class="n"></td><td class="n">' + u(r.sold) + '</td>' +
    '<td class="n"></td><td class="n">' + sh(r.transport) + '</td></tr>' +
    '</tbody></table></div>' +
    '<p class="hint" style="margin-top:10px">Sold units are split across premises in proportion to what each ' +
    'one produced, rounded to whole ice creams, with the residual pushed to the last premise.</p>';
}

/* ============================================================== page 06 === */

const COMPARE_ROWS = [
  ['Ice creams made',        r => r.produced,   'u'],
  ['Ice creams sold',        r => r.sold,       'u'],
  ['Ice creams spoiled',     r => r.unsold,     'u'],
  ['Revenue',                r => r.revenue],
  ['Milk bought',            r => -r.milkCost],
  ['Machine maintenance',    r => -r.maintenance],
  ['Machine depreciation',   r => -r.depreciation],
  ['Gross profit',           r => r.grossProfit, 'sub'],
  ['Transport',              r => -r.transport],
  ['Market investment',      r => -r.marketInvestment],
  ['Bonus',                  r => -r.bonus],
  ['Fixed salaries',         r => -r.salaries],
  ['Premise rent',           r => -r.rent],
  ['Loan interest',          r => -r.interest],
  ['Profit before tax',      r => r.pbt,        'sub'],
  ['Game tax',               r => -r.tax],
  ['Net profit',             r => r.netProfit,  'total'],
  ['Machines bought (cash)', r => -r.machinePurchases],
  ['Loan received (cash)',   r => r.loanReceived],
  ['Principal repaid (cash)', r => -r.loans.principal],
  ['Cash before the market', r => r.cashBeforeMarket],
  ['Closing cash',           r => r.closingCash, 'total']
];

/* The lines that explain the profit gap. They sum to the gap exactly. */
const BRIDGE_ROWS = [
  ['Revenue',              r => r.revenue],
  ['Milk',                 r => -r.milkCost],
  ['Maintenance',          r => -r.maintenance],
  ['Depreciation',         r => -r.depreciation],
  ['Transport',            r => -r.transport],
  ['Market investment',    r => -r.marketInvestment],
  ['Bonus',                r => -r.bonus],
  ['Salaries',             r => -r.salaries],
  ['Rent',                 r => -r.rent],
  ['Loan interest',        r => -r.interest],
  ['Game tax',             r => -r.tax]
];

function renderCompare() {
  const rs = optionResults();
  const el = document.getElementById('compareBody');
  if (rs.length < 2) { el.innerHTML = '<p class="hint">Add a second option to compare.</p>'; return; }

  const a = rs[0], b = rs[1];

  const head = '<thead><tr><th>Line</th>' + rs.map(x =>
    '<th class="n"><span class="swatch" style="background:' + x.color + '"></span>' +
    esc(x.opt.name) + '</th>').join('') + '<th class="n">B &minus; A</th></tr></thead>';

  const body = COMPARE_ROWS.map(([label, fn, kind]) => {
    const vals = rs.map(x => fn(x.r));
    const d = vals[1] - vals[0];
    const f = kind === 'u' ? u : sh;
    const fd = kind === 'u' ? (v => (v >= 0 ? '+' : '−') + u(Math.abs(v))) : shSigned;
    return '<tr class="' + (kind === 'total' ? 'total' : kind === 'sub' ? 'sub' : '') + '">' +
      '<td>' + label + '</td>' +
      vals.map(v => '<td class="n ' + (kind === 'u' ? '' : sgn(v)) + '">' + f(v) + '</td>').join('') +
      '<td class="n ' + sgn(d) + '">' + fd(d) + '</td></tr>';
  }).join('');

  /* --- the bridge --- */
  const drivers = BRIDGE_ROWS
    .map(([label, fn]) => [label, fn(b.r) - fn(a.r)])
    .filter(d => Math.abs(d[1]) >= 1)
    .sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));
  const maxAbs = Math.max(...drivers.map(d => Math.abs(d[1])), 1);
  const bridgeSum = drivers.reduce((s, d) => s + d[1], 0);
  const profitGap = b.r.netProfit - a.r.netProfit;

  const bridge = drivers.map(([label, v]) => {
    const w = Math.abs(v) / maxAbs * 50;
    return '<div class="bridge-row"><span class="lab">' + label + '</span>' +
      '<span class="track"><span class="mid"></span>' +
      '<span class="fill" style="left:' + (v >= 0 ? 50 : 50 - w) + '%;width:' + w + '%;background:' +
      (v >= 0 ? 'var(--series-1)' : 'var(--critical)') + '"></span></span>' +
      '<span class="val ' + sgn(v) + '">' + shSigned(v) + '</span></div>';
  }).join('');

  /* --- allocation sensitivity chart --- */
  const series = rs.map(x => {
    const maxAlloc = Math.max(N(x.opt.requested), 10000);
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const alloc = maxAlloc * i / 20;
      pts.push({ x: alloc, y: computeSeason(optionInput(x.opt, alloc)).netProfit });
    }
    return {
      color: x.color, short: 'Option ' + String.fromCharCode(65 + x.i),
      name: x.opt.name, points: pts, maxAlloc, be: breakEven(x.opt), opt: x.opt
    };
  });

  /* --- prose --- */
  const say = [];
  say.push('<strong>' + esc(b.opt.name) + '</strong> makes ' +
    (profitGap >= 0 ? sh(profitGap) + ' more' : sh(-profitGap) + ' less') +
    ' profit than <strong>' + esc(a.opt.name) + '</strong> at the allocations entered, and ends the season ' +
    'with ' + (b.r.closingCash - a.r.closingCash >= 0
      ? sh(b.r.closingCash - a.r.closingCash) + ' more cash.'
      : sh(a.r.closingCash - b.r.closingCash) + ' less cash.'));

  if (drivers.length) {
    say.push('Three lines do most of the work: ' + drivers.slice(0, 3)
      .map(d => d[0].toLowerCase() + ' ' + shSigned(d[1])).join(', ') + '.');
  }
  if (b.r.unsold !== a.r.unsold) {
    const more = b.r.unsold > a.r.unsold ? b : a, less = b.r.unsold > a.r.unsold ? a : b;
    say.push('<strong>' + esc(more.opt.name) + '</strong> throws away ' +
      u(more.r.unsold - less.r.unsold) + ' more ice creams. Spoilage never appears as its own cost line ' +
      '&mdash; the milk behind those units was already charged in full &mdash; but it is real money, ' +
      'and it is the mistake this game punishes hardest.');
  }
  const tighter = b.r.cashBeforeMarket < a.r.cashBeforeMarket ? b : a;
  const looser = tighter === b ? a : b;
  say.push('<strong>' + esc(tighter.opt.name) + '</strong> is the tighter plan on cash: it goes into the ' +
    'market with ' + sh(tighter.r.cashBeforeMarket) + ' in hand against ' + sh(looser.r.cashBeforeMarket) +
    '. Every advance payment is made before the trainer says a word about your sales.');

  el.innerHTML =
    '<div class="card"><h3>Line by line</h3>' +
      '<div class="t-wrap"><table class="t">' + head + '<tbody>' + body + '</tbody></table></div></div>' +

    '<div class="card"><h3>What the profit gap is made of</h3>' +
      '<p class="hint">Every line that differs, largest first. They add to ' + shSigned(bridgeSum) +
      ', which is exactly the ' + shSigned(profitGap) + ' profit gap' +
      (Math.abs(bridgeSum - profitGap) < 0.5 ? '' : ' (check: off by ' + sh(bridgeSum - profitGap) + ')') +
      '. Blue helps Option B, red hurts it.</p>' +
      bridge +
    '</div>' +

    '<div class="card"><h3>Profit against the trainer’s allocation</h3>' +
      '<p class="hint">The decisions are fixed; only the allocation moves. The dot is where each option ' +
      'breaks even. Below that point the option loses money however good the plan looked on paper.</p>' +
      '<div class="legend">' + series.map(s =>
        '<span class="item"><span class="swatch" style="background:' + s.color + '"></span>' +
        esc(s.name) + '</span>').join('') + '</div>' +
      allocationChart(series, 'alloc') +
    '</div>' +

    '<div class="card"><h3>In words</h3>' + say.map(s => '<p class="hint">' + s + '</p>').join('') + '</div>';

  bindAllocHover(series, 'alloc');
}

/* ============================================================== page 07 === */

function renderDecision() {
  const rs = optionResults();
  const chosen = rs.find(x => x.opt.id === state.decision.chosen) || rs[0];
  if (!chosen) return;

  const assumed = N(state.decision.assumedAllocation);
  const at = computeSeason(optionInput(chosen.opt, assumed));
  const be = breakEven(chosen.opt);
  const req = N(chosen.opt.requested);
  const half = computeSeason(optionInput(chosen.opt, req * 0.5));
  const forecast = FORECAST.winter.y2;

  document.getElementById('decisionBody').innerHTML =
    '<div class="card">' +
      '<div class="grid g3">' +
        '<label class="field"><span>Recommended option</span><select data-path="decision.chosen">' +
          rs.map(x => '<option value="' + x.opt.id + '"' +
            (x.opt.id === state.decision.chosen ? ' selected' : '') + '>' + esc(x.opt.name) + '</option>').join('') +
        '</select></label>' +
        '<label class="field"><span>Allocation this assumes <span class="unit">units</span></span>' +
          '<input type="number" step="10000" data-path="decision.assumedAllocation"></label>' +
        '<label class="field"><span>Share of the Year 2 winter forecast</span>' +
          '<input type="text" value="' + (forecast ? (assumed / forecast * 100).toFixed(1) + '% of ' + u(forecast) : '') +
          '" disabled></label>' +
      '</div>' +
    '</div>' +

    '<div class="tiles" style="margin-bottom:18px">' +
      tile('Net profit', sh(at.netProfit), 'at ' + u(assumed) + ' allocated',
           at.netProfit < 0 ? 'is-neg' : 'is-pos') +
      tile('Closing cash', sh(at.closingCash), '', sgn(at.closingCash)) +
      tile('Break-even', be == null ? 'never' : u(Math.ceil(be)),
           be == null ? '' : 'units must sell') +
      tile('Margin of safety', be == null ? '—' : u(Math.max(assumed - Math.ceil(be), 0)),
           be == null ? '' : 'units above break-even',
           be != null && assumed < be ? 'is-neg' : '') +
    '</div>' +

    '<div class="card"><h3>Write the recommendation</h3>' +
      '<div class="grid" style="gap:16px">' +
        '<label class="field"><span>Our recommendation</span>' +
          '<textarea rows="4" data-path="decision.text" placeholder="We recommend …"></textarea></label>' +
        '<label class="field"><span>The single most important assumption</span>' +
          '<textarea rows="3" data-path="decision.assumption" placeholder="This holds only if …"></textarea></label>' +
        '<label class="field"><span>If the trainer allocates fewer sales than we hoped</span>' +
          '<textarea rows="3" data-path="decision.downside" placeholder="At half the request we would …"></textarea></label>' +
      '</div>' +
    '</div>' +

    '<div class="card"><h3>What goes on the page</h3>' +
      '<p class="hint"><strong>Recommendation.</strong> ' +
        (state.decision.text ? esc(state.decision.text)
          : '<em>Not written yet. ' + esc(chosen.opt.name) + ' currently projects ' + sh(at.netProfit) +
            ' at ' + u(assumed) + ' units allocated.</em>') + '</p>' +
      '<p class="hint"><strong>Key assumption.</strong> ' +
        (state.decision.assumption ? esc(state.decision.assumption)
          : '<em>Not written yet. The obvious candidate: that the trainer fills the ' + u(req) +
            ' unit request, which is ' + (forecast ? (req / forecast * 100).toFixed(1) : '?') +
            '% of a forecast the market can miss by 20% either way.</em>') + '</p>' +
      '<p class="hint"><strong>On a thin allocation.</strong> ' +
        (state.decision.downside ? esc(state.decision.downside)
          : '<em>Not written yet. At half the request (' + u(req * 0.5) + ' units) this plan makes ' +
            sh(half.netProfit) + ' and closes with ' + sh(half.closingCash) + '.</em>') + '</p>' +
    '</div>' +

    '<div class="estimate-banner"><span class="ico" style="font-size:16px">' + ICONS.warning + '</span><div>' +
      '<strong>First version, built on Year 1 experience.</strong>' +
      'Every Year 2 price, premise and machine in this tool is the Year 1 handout used as an estimate. ' +
      'The trainer issues the real Year 2 rules next class, and the market forecast is not a promise of ' +
      'sales &mdash; requests are trimmed in 10,000-unit blocks when demand exceeds supply.' +
    '</div></div>';
}

/* ======================================================== chart hovering === */

let hoverData = {};

function bindChartHovers(rs) {
  rs.forEach(x => { hoverData['wf' + x.i] = x; });
  document.querySelectorAll('[data-wf]').forEach(el => {
    el.addEventListener('mousemove', e => {
      const [id, idx] = el.dataset.wf.split('|');
      const x = hoverData[id]; if (!x) return;
      const s = x.r.steps[+idx];
      showTip(e, '<div class="tip-h">' + esc(s.label) + '</div>' +
        (s.flow == null ? '' : '<div class="tip-r"><span>Movement</span><b>' + shSigned(s.flow) + '</b></div>') +
        '<div class="tip-r"><span>Cash after</span><b>' + sh(s.balance) + '</b></div>');
    });
    el.addEventListener('mouseleave', hideTip);
  });
}

function bindAllocHover(series, id) {
  const hit = document.querySelector('[data-alloc="' + id + '"]');
  if (!hit) return;
  const svg = hit.ownerSVGElement;
  const cross = document.getElementById(id + '-cross');
  const maxX = Math.max(...series.map(s => s.maxAlloc), 1);
  const padL = 62, padR = 104, W = 720;
  const plotW = W - padL - padR;

  hit.addEventListener('mousemove', e => {
    const box = svg.getBoundingClientRect();
    const scale = box.width / W;
    const px = (e.clientX - box.left) / scale;
    const alloc = Math.max(0, Math.min((px - padL) / plotW * maxX, maxX));
    cross.setAttribute('x1', px); cross.setAttribute('x2', px);
    cross.setAttribute('opacity', '1');

    const rows = series.map(s => {
      const v = computeSeason(optionInput(s.opt, Math.min(alloc, s.maxAlloc))).netProfit;
      return '<div class="tip-r"><span><span class="swatch" style="background:' + s.color + '"></span>' +
        esc(s.short) + '</span><b>' + sh(v) + '</b></div>';
    }).join('');
    showTip(e, '<div class="tip-h">' + u(alloc) + ' units allocated</div>' + rows);
  });
  hit.addEventListener('mouseleave', () => { cross.setAttribute('opacity', '0'); hideTip(); });
}

/* ================================================================ wiring === */

function bindInputs(root) {
  root.querySelectorAll('[data-path]').forEach(el => {
    const path = el.dataset.path;
    const val = getPath(path);
    if (el.type === 'checkbox') el.checked = !!val;
    else el.value = (val === null || val === undefined) ? '' : val;

    el.addEventListener('input', () => {
      // Half-typed numbers ("3.", "-") read back as an empty value with
      // badInput set. Re-rendering then would wipe what is on screen, so
      // leave the field alone until it parses.
      if (el.type === 'number' && el.validity && el.validity.badInput) return;

      let v;
      if (el.type === 'checkbox') v = el.checked;
      else if (el.type === 'number') v = el.value === '' ? null : parseFloat(el.value);
      else v = el.value;
      setPath(path, v);
      save();
      renderAll();
    });
  });
}

/** Every keystroke rebuilds the whole app, so the field being typed in has to
 *  survive it: remember which input had focus and the exact text it held
 *  (a half-typed "3." must not be rewritten to "3"), then put both back. */
function renderAll() {
  const active = document.activeElement;
  const path = active && active.dataset ? active.dataset.path : null;
  const raw = path && active.type !== 'checkbox' ? active.value : null;
  let selStart = null, selEnd = null;
  // Reading a selection off a number input throws in some browsers.
  try { if (path) { selStart = active.selectionStart; selEnd = active.selectionEnd; } } catch (e) {}

  const pages = {
    position: renderPosition, year1: renderYear1, rules: renderRules,
    options: renderOptions, results: renderResults, compare: renderCompare, decision: renderDecision
  };
  Object.entries(pages).forEach(([name, fn]) => {
    fn();
    bindInputs(document.getElementById('page-' + name));
  });
  document.getElementById('teamLine').textContent = state.meta.team || '';

  if (path) {
    const next = document.querySelector('[data-path="' + path.replace(/"/g, '\\"') + '"]');
    if (next) {
      if (raw !== null && next.value !== raw) next.value = raw;
      next.focus({ preventScroll: true });
      try { next.setSelectionRange(selStart, selEnd); } catch (e) { /* number inputs refuse */ }
    }
  }
}

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('is-active', p.id === 'page-' + name));
  document.querySelectorAll('.rail-nav button').forEach(b =>
    b.classList.toggle('is-active', b.dataset.page === name));
  scrollTo({ top: 0, behavior: 'smooth' });
}

function findObj(P) { return getPath(P); }

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const { act, a, b, c } = btn.dataset;
  const obj = a ? findObj(a) : null;

  if (act === 'addSite') obj.premises.push({ premiseId: 'A', machines: [], plannedProduction: 0 });
  if (act === 'delSite') obj.premises.splice(+b, 1);
  if (act === 'addMachine') obj.premises[+b].machines.push({ typeId: 'M1', qty: 1 });
  if (act === 'delMachine') obj.premises[+b].machines.splice(+c, 1);
  if (act === 'addBuy') obj.buyMachines.push({ typeId: 'M5', qty: 1 });
  if (act === 'delBuy') obj.buyMachines.splice(+b, 1);
  if (act === 'delOption') state.options.splice(+b, 1);

  save();
  renderAll();
});

function init() {
  document.getElementById('nav').addEventListener('click', e => {
    const b = e.target.closest('button[data-page]');
    if (b) showPage(b.dataset.page);
  });

  document.getElementById('btnAddOption').addEventListener('click', () => {
    const copy = JSON.parse(JSON.stringify(state.options[state.options.length - 1]));
    copy.id = 'o' + Math.random().toString(36).slice(2, 7);
    copy.name = 'Option ' + String.fromCharCode(65 + state.options.length);
    state.options.push(copy);
    save(); renderAll();
  });

  document.getElementById('btnExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pg-icecream-year2-tool.json';
    a.click(); URL.revokeObjectURL(a.href);
  });

  document.getElementById('fileImport').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try { state = reconcile(defaults(), JSON.parse(rd.result)); save(); renderAll(); }
      catch (err) { alert('That file could not be read as saved tool data.'); }
    };
    rd.readAsText(f); e.target.value = '';
  });

  document.getElementById('btnReset').addEventListener('click', () => {
    if (!confirm('Reset every figure to the seeded Group 7 starting point?')) return;
    state = defaults(); save(); renderAll();
  });

  document.getElementById('btnPrint').addEventListener('click', () => print());

  document.getElementById('btnTheme').addEventListener('click', () => {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('pgic-theme', next); } catch (err) {}
  });
  try {
    const saved = localStorage.getItem('pgic-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  } catch (err) {}

  renderAll();

  /* The handout's own worked examples, run on every load. */
  const tests = selfTests();
  const failed = tests.filter(t => !t.pass);
  document.getElementById('testSummary').innerHTML = failed.length
    ? '<span class="is-neg"><strong>' + failed.length + ' of ' + tests.length +
      ' checks against the handout FAIL.</strong> The engine does not match the printed rules.</span>'
    : '<strong>All ' + tests.length + ' checks against the handout’s worked examples pass.</strong> ' +
      'Sections 7, 8, 9 and 11 of the Year 1 rules reproduce exactly.';
  document.getElementById('testPills').innerHTML = tests.map(t =>
    '<span class="test-pill ' + (t.pass ? 'pass' : 'fail') + '" title="' +
    esc(t.name) + ': got ' + t.got + ', want ' + t.want + '">' +
    (t.pass ? '✓' : '✕') + ' ' + esc(t.name.replace('Handout ', '')) + '</span>').join('');
}

init();
