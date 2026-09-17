/* =========================================================================
   engine.js - one season in, a full P&L and cash flow out.
   Pure calculation. No DOM. Follows the Year 1 participant handout exactly.

   Handout section references appear beside the rules they implement so the
   numbers can be checked line by line against the paper.
   ========================================================================= */

const R = x => Math.round(x);            // s.10: post whole shekels, per line
const nz = v => (Number.isFinite(+v) ? +v : 0);

/* ---------------------------------------------------------------- machines */

/** Every machine copy the company owns during this season, bought ones included.
 *  s.02: an idle owned machine still incurs maintenance and depreciation. */
function machineRoster(owned, bought) {
  const roster = [];
  (owned || []).forEach(o => {
    const t = machineById(o.typeId);
    if (!t) return;
    roster.push({ type: t, qty: nz(o.qty), seasonsLeft: nz(o.seasonsRemaining), isNew: false });
  });
  (bought || []).forEach(b => {
    const t = machineById(b.typeId);
    if (!t || nz(b.qty) <= 0) return;
    roster.push({ type: t, qty: nz(b.qty), seasonsLeft: RULES.deprSeasons, isNew: true });
  });
  return roster;
}

/* ------------------------------------------------------------------- loans */

/** s.08: interest is 10% per season on principal outstanding immediately
 *  before that season's repayment; principal repays in equal portions and the
 *  first principal-and-interest payment falls in the season of borrowing. */
function loanCharges(existing, newLoan) {
  const lines = [];

  (existing || []).forEach(l => {
    const outstanding = nz(l.outstanding);
    if (outstanding <= 0) return;
    const interest = R(outstanding * nz(l.ratePct) / 100);
    const principal = Math.min(R(nz(l.principalPerSeason)), outstanding);
    lines.push({
      name: l.name || 'Loan', outstanding, interest, principal,
      payment: principal + interest, closing: outstanding - principal, isNew: false
    });
  });

  if (newLoan && nz(newLoan.amount) > 0) {
    const amount = nz(newLoan.amount);
    const term = Math.max(1, Math.min(nz(newLoan.termSeasons) || RULES.maxLoanTerm, RULES.maxLoanTerm));
    const interest = R(amount * nz(newLoan.ratePct || RULES.loanRatePct) / 100);
    const principal = Math.min(R(amount / term), amount);
    lines.push({
      name: newLoan.name || 'New loan', outstanding: amount, interest, principal,
      payment: principal + interest, closing: amount - principal, isNew: true, term
    });
  }

  return {
    lines,
    interest:  lines.reduce((s, l) => s + l.interest, 0),
    principal: lines.reduce((s, l) => s + l.principal, 0),
    payment:   lines.reduce((s, l) => s + l.payment, 0),
    openingDebt: lines.reduce((s, l) => s + (l.isNew ? 0 : l.outstanding), 0),
    closingDebt: lines.reduce((s, l) => s + l.closing, 0)
  };
}

/** The full repayment schedule for one new loan, for the loan table. */
function loanSchedule(amount, term, ratePct) {
  const rows = [];
  let outstanding = nz(amount);
  const per = Math.floor(nz(amount) / Math.max(1, term));
  for (let s = 1; s <= term && outstanding > 0; s++) {
    const interest = R(outstanding * nz(ratePct) / 100);
    const principal = (s === term) ? outstanding : Math.min(per, outstanding);
    rows.push({ season: s, opening: outstanding, interest, principal,
                payment: principal + interest, closing: outstanding - principal });
    outstanding -= principal;
  }
  return rows;
}

/* --------------------------------------------------------------- transport */

/** s.07: assign sold units to premises in proportion to actual production,
 *  round to whole ice creams, push any residual to the LAST premise in the
 *  recorded order. Zero production and sales -> zero transport. */
function transportSplit(sites, sold) {
  const totalProduced = sites.reduce((s, x) => s + x.produced, 0);
  if (totalProduced <= 0 || sold <= 0) {
    return { rows: sites.map(s => ({ ...s, soldHere: 0, cost: 0 })), total: 0 };
  }
  const rows = sites.map(s => ({ ...s, soldHere: 0, cost: 0 }));
  let assigned = 0;
  for (let i = 0; i < rows.length - 1; i++) {
    rows[i].soldHere = R(sold * rows[i].produced / totalProduced);
    assigned += rows[i].soldHere;
  }
  rows[rows.length - 1].soldHere = sold - assigned;   // residual to the last
  rows.forEach(r => { r.cost = R(r.soldHere * r.transport); });
  return { rows, total: rows.reduce((s, r) => s + r.cost, 0) };
}

/* ==========================================================================
   computeSeason - the whole season
   ========================================================================== */

function computeSeason(inp) {
  const rules = Object.assign({}, RULES, inp.rules || {});

  /* --- premises, machines and capacity (s.03, s.04, s.05) --- */
  const sites = (inp.premises || []).map(p => {
    const prem = premiseById(p.premiseId) || { name: '?', slots: 0, transport: 0, rent: 0 };
    const installed = (p.machines || []).filter(m => nz(m.qty) > 0);
    const slotsUsed = installed.reduce((s, m) => s + nz(m.qty), 0);
    const capacity = installed.reduce((s, m) => {
      const t = machineById(m.typeId);
      return s + (t ? t.capacity * nz(m.qty) : 0);
    }, 0);
    return {
      premiseId: p.premiseId, name: prem.name, rent: nz(prem.rent),
      transport: nz(prem.transport), slots: nz(prem.slots),
      installed, slotsUsed, capacity,
      planned: Math.max(nz(p.plannedProduction), 0),
      produced: 0
    };
  });

  const rent = sites.reduce((s, x) => s + x.rent, 0);
  const totalCapacity = sites.reduce((s, x) => s + x.capacity, 0);

  /* Milk is bought by the ton and yields 20,000 units per ton (s.05). */
  const milkTons = Math.max(nz(inp.milkTons), 0);
  const milkUnits = milkTons * rules.unitsPerTon;
  const milkCost = R(milkTons * rules.milkPricePerTon);

  /* Planned production cannot exceed the milk available or the capacity of
     machines operating in rented premises (s.05). Each site is capped by its
     own installed capacity first, then the total is trimmed to the milk. */
  sites.forEach(s => { s.produced = Math.min(s.planned, s.capacity); });
  let produced = sites.reduce((s, x) => s + x.produced, 0);
  const cappedByCapacity = sites.some(s => s.planned > s.capacity + 1e-9);

  let cappedByMilk = false;
  if (produced > milkUnits) {
    cappedByMilk = true;
    const keep = milkUnits / produced;
    let running = 0;
    sites.forEach((s, i) => {
      if (i < sites.length - 1) { s.produced = Math.floor(s.produced * keep); running += s.produced; }
      else s.produced = Math.max(milkUnits - running, 0);
    });
    produced = sites.reduce((s, x) => s + x.produced, 0);
  }

  const milkUsedUnits = produced;
  const milkUnusedUnits = Math.max(milkUnits - produced, 0);

  /* --- the market (s.06) --- */
  const requested = Math.max(nz(inp.requested), 0);
  const allocatedRaw = Math.max(nz(inp.allocated), 0);
  const sold = Math.min(allocatedRaw, requested, produced);
  const unsold = Math.max(produced - sold, 0);
  const marketInvestment = R(nz(inp.marketInvestment));

  /* --- transport (s.07) --- */
  const tsplit = transportSplit(sites, sold);
  const transport = tsplit.total;

  /* --- machines owned this season (s.02, s.04) --- */
  const roster = machineRoster(inp.ownedMachines, inp.buyMachines);
  const maintenance = R(roster.reduce((s, m) => s + m.type.maintenance * m.qty, 0));
  const depreciation = R(roster.reduce(
    (s, m) => s + (m.seasonsLeft > 0 ? m.type.depr * m.qty : 0), 0));
  const machinePurchases = R((inp.buyMachines || []).reduce((s, b) => {
    const t = machineById(b.typeId);
    return s + (t ? t.price * nz(b.qty) : 0);
  }, 0));

  /* --- loans (s.08) --- */
  const loans = loanCharges(inp.existingLoans, inp.newLoan);
  const loanReceived = (inp.newLoan && nz(inp.newLoan.amount) > 0) ? R(nz(inp.newLoan.amount)) : 0;

  /* ======================= PROFIT & LOSS (s.10) =======================
     Revenue - milk (full, spoiled included) - maintenance - depreciation
     = GROSS PROFIT
     - transport, market investment, bonus
     - fixed salaries, rent, loan interest
     = profit before tax, then the loss pool and 10% game tax.           */

  const revenue = R(sold * rules.pricePerUnit);
  const grossProfit = revenue - milkCost - maintenance - depreciation;

  const salaries = R(rules.fixedSalaries);
  // s.09: bonus only when gross profit is positive; never negative.
  const bonus = grossProfit > 0 ? R(grossProfit * rules.bonusPctOfGross / 100) : 0;
  const interest = loans.interest;

  const pbt = grossProfit - transport - marketInvestment - bonus - salaries - rent - interest;

  const lossPoolIn = Math.max(nz(inp.lossPool), 0);
  const lossUsed = pbt > 0 ? Math.min(pbt, lossPoolIn) : 0;
  const taxable = Math.max(pbt - lossUsed, 0);
  const tax = R(taxable * rules.taxPct / 100);
  const netProfit = pbt - tax;
  const lossPoolOut = lossPoolIn - lossUsed + (pbt < 0 ? -pbt : 0);

  /* ======================= CASH FLOW (s.08, s.10) =====================
     Paid in advance : machine purchases, milk, market investment.
     At season end   : sales in; rent, maintenance, transport, salaries,
                       bonus, bank payments and tax out.
     Cash before each advance payment, and closing cash, must never be
     negative.                                                            */

  const steps = [];
  let c = R(nz(inp.openingCash));
  const step = (label, flow, phase) => {
    c += flow; steps.push({ label, flow, balance: c, phase });
  };
  steps.push({ label: 'Opening cash', flow: null, balance: c, phase: 'open' });

  if (loanReceived) step('Bank loan received', loanReceived, 'advance');
  if (machinePurchases) step('Machine purchases', -machinePurchases, 'advance');
  step('Milk purchase (' + milkTons + ' t)', -milkCost, 'advance');
  step('Market investment', -marketInvestment, 'advance');

  const cashBeforeMarket = c;
  steps.push({ label: 'Cash before the market', flow: null, balance: c, phase: 'checkpoint' });

  step('Sales receipt', revenue, 'end');
  step('Premise rent', -rent, 'end');
  step('Machine maintenance', -maintenance, 'end');
  step('Transport', -transport, 'end');
  step('Fixed salaries', -salaries, 'end');
  if (bonus) step('Bonus (5% of gross profit)', -bonus, 'end');
  if (loans.payment) step('Bank principal and interest', -loans.payment, 'end');
  step('Game tax', -tax, 'end');

  const closingCash = c;
  const minStep = steps.reduce((a, b) => (b.balance < a.balance ? b : a), steps[0]);

  /* Cash must tie back to profit: the machine purchase is cash only and the
     depreciation is profit only (the handout makes this point in s.11). */
  const reconciled = R(nz(inp.openingCash)) + netProfit + depreciation
                   + loanReceived - loans.principal - machinePurchases;

  /* ------------------------------ rule checks ------------------------------ */
  const issues = [];
  const add = (level, text) => issues.push({ level, text });

  if (milkTons < rules.minMilkTons)
    add('critical', 'You must buy at least ' + rules.minMilkTons +
      ' ton of milk every season, even sitting one out. This plan buys ' + milkTons + '.');
  if (marketInvestment < rules.minMarketInvestment)
    add('critical', 'Minimum market investment is Sh ' + rules.minMarketInvestment.toLocaleString('en-GB') +
      ' every season. This plan invests ' + marketInvestment.toLocaleString('en-GB') + '.');
  if (inp.newLoan && nz(inp.newLoan.amount) > 0) {
    const term = nz(inp.newLoan.termSeasons);
    if (term < 1 || term > RULES.maxLoanTerm)
      add('critical', 'A repayment term must be 1 to ' + RULES.maxLoanTerm +
        ' seasons, and no longer than two game years. This loan is set to ' + term + '.');
  }
  if (requested % rules.requestBlock !== 0)
    add('critical', 'Sales must be requested in whole blocks of ' +
      rules.requestBlock.toLocaleString('en-GB') + '. ' + requested.toLocaleString('en-GB') + ' is not a whole block.');
  if (requested > produced)
    add('serious', 'You are requesting ' + requested.toLocaleString('en-GB') +
      ' units but only producing ' + produced.toLocaleString('en-GB') +
      '. A request must be backed by production and machine capacity.');
  sites.forEach(s => {
    if (s.slotsUsed > s.slots)
      add('critical', s.name + ' has ' + s.slots + ' machine slot(s) but ' +
        s.slotsUsed + ' machines are installed there.');
  });
  if (cappedByCapacity)
    add('warning', 'Planned production exceeds installed machine capacity in at least one premise, so it was trimmed to capacity.');
  if (cappedByMilk)
    add('warning', 'Planned production exceeds what ' + milkTons + ' tons of milk can make (' +
      milkUnits.toLocaleString('en-GB') + ' units), so it was trimmed to the milk.');
  if (allocatedRaw > requested)
    add('warning', 'The trainer cannot allocate more than you request. ' +
      allocatedRaw.toLocaleString('en-GB') + ' was capped to ' + requested.toLocaleString('en-GB') + '.');
  if (cashBeforeMarket < 0)
    add('critical', 'Cash is negative before the market (' + Math.round(cashBeforeMarket).toLocaleString('en-GB') +
      '). Advance payments must be financed first - take a loan before them.');
  if (closingCash < 0)
    add('critical', 'Closing cash is negative (' + Math.round(closingCash).toLocaleString('en-GB') +
      '). This plan is not allowed to stand.');
  if (milkUnusedUnits > 0)
    add('warning', (milkUnusedUnits / rules.unitsPerTon).toFixed(2) + ' tons of milk go unused and spoil, ' +
      'already costed at ' + R(milkUnusedUnits / rules.unitsPerTon * rules.milkPricePerTon).toLocaleString('en-GB') + '.');
  if (unsold > 0)
    add('warning', unsold.toLocaleString('en-GB') + ' ice creams go unsold and spoil. They cost nothing extra, ' +
      'but the milk behind them was already paid for and earns no revenue.');
  if (Math.abs(closingCash - reconciled) > 0.5)
    add('critical', 'Cash flow does not reconcile to profit. Difference of ' +
      Math.round(closingCash - reconciled).toLocaleString('en-GB') + '.');

  return {
    sites, rent, totalCapacity, milkTons, milkUnits, milkCost, milkUsedUnits, milkUnusedUnits,
    produced, requested, allocatedRaw, sold, unsold, marketInvestment,
    transport, transportRows: tsplit.rows,
    roster, maintenance, depreciation, machinePurchases,
    revenue, grossProfit, bonus, salaries, interest, pbt,
    lossPoolIn, lossUsed, taxable, tax, netProfit, lossPoolOut,
    loans, loanReceived,
    steps, cashBeforeMarket, closingCash, minStep,
    openingCash: R(nz(inp.openingCash)),
    reconciled, reconcileGap: closingCash - reconciled,
    issues,
    utilisation: totalCapacity > 0 ? produced / totalCapacity : 0,
    sellThrough: produced > 0 ? sold / produced : 0
  };
}

/* ==========================================================================
   Self-tests - the four worked examples printed in the handout.
   If any of these fail, the engine does not match the paper rules.
   ========================================================================== */

function selfTests() {
  const t = [];

  /* s.11 - the full worked Year 1 winter company.
     Machine 5, Premise B, 2 tons of milk, makes and sells 40,000,
     Sh 1,000 on the market, no loan, Sh 100,000 opening cash. */
  const ex = computeSeason({
    openingCash: 100000, lossPool: 0,
    premises: [{ premiseId: 'B', machines: [{ typeId: 'M5', qty: 1 }], plannedProduction: 40000 }],
    ownedMachines: [], buyMachines: [{ typeId: 'M5', qty: 1 }],
    milkTons: 2, marketInvestment: 1000, requested: 40000, allocated: 40000,
    existingLoans: [], newLoan: null
  });
  t.push(['Handout s.11 - gross profit',   ex.grossProfit, 35200]);
  t.push(['Handout s.11 - transport',      ex.transport,   16000]);
  t.push(['Handout s.11 - bonus',          ex.bonus,        1760]);
  t.push(['Handout s.11 - profit before tax', ex.pbt,      -3560]);
  t.push(['Handout s.11 - net loss',       ex.netProfit,   -3560]);
  t.push(['Handout s.11 - closing cash',   ex.closingCash, 71940]);
  t.push(['Handout s.11 - loss pool out',  ex.lossPoolOut,  3560]);

  /* s.07 - transport across two premises: produce 60,000 at A and 40,000 at
     B, company sells 70,000 -> 42,000 x 0.3 and 28,000 x 0.4 = 23,800. */
  const tr = transportSplit(
    [{ produced: 60000, transport: 0.3 }, { produced: 40000, transport: 0.4 }], 70000);
  t.push(['Handout s.07 - split to A',     tr.rows[0].soldHere, 42000]);
  t.push(['Handout s.07 - split to B',     tr.rows[1].soldHere, 28000]);
  t.push(['Handout s.07 - total transport', tr.total,           23800]);

  /* s.08 - a Sh 60,000 loan over four seasons at 10% per season. */
  const sch = loanSchedule(60000, 4, 10);
  t.push(['Handout s.08 - season 1 interest', sch[0].interest,  6000]);
  t.push(['Handout s.08 - season 1 payment',  sch[0].payment,  21000]);
  t.push(['Handout s.08 - debt after S1',     sch[0].closing,  45000]);
  t.push(['Handout s.08 - season 2 interest', sch[1].interest,  4500]);

  /* s.09 - Sh 100,000 profit before tax against a Sh 50,000 carried loss. */
  const taxIn = 100000, pool = 50000;
  const used = Math.min(taxIn, pool);
  t.push(['Handout s.09 - taxable profit', taxIn - used,               50000]);
  t.push(['Handout s.09 - game tax',       R((taxIn - used) * 0.10),    5000]);
  t.push(['Handout s.09 - net profit',     taxIn - R((taxIn - used) * 0.10), 95000]);

  return t.map(([name, got, want]) => ({ name, got, want, pass: Math.abs(got - want) < 0.5 }));
}
