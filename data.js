/* =========================================================================
   data.js - the game catalogue, straight from the Year 1 participant handout.
   Pork & Garlic Ice Cream Co. All money is virtual shekels (Sh).

   Year 2 rules have NOT been issued. Everything here is Year 1 and is treated
   as an estimate for Year 2 until the trainer confirms it.
   ========================================================================= */

const RULES = {
  currency: 'Sh',
  startingCash: 100000,     // once, at Year 1 winter
  pricePerUnit: 2,          // Sh per ice cream actually sold
  milkPricePerTon: 20000,
  unitsPerTon: 20000,
  minMilkTons: 1,           // at least one ton every season, even sitting out
  minMarketInvestment: 1000,
  requestBlock: 10000,      // requests in whole blocks of 10,000
  fixedSalaries: 10000,     // every season, including a season with no sales
  bonusPctOfGross: 5,       // only when gross profit is positive
  taxPct: 10,               // on taxable profit, after the loss pool
  loanRatePct: 10,          // per season, on principal outstanding before repayment
  deprSeasons: 8,           // straight line, idle seasons included
  maxLoanTerm: 8,           // 1-8 seasons, no longer than two game years
  marketSwingPct: 20        // actual market runs up to +/-20% of forecast
};

/* --- Section 03: Year 1 production premises -------------------------------
   A slot is space for ONE installed machine, not a number of ice creams.
   "P" premises can store unused milk in Year 2 - no effect in Year 1.        */
const PREMISES = [
  { id: 'A', name: 'Premise A', slots: 1, transport: 0.3, rent: 12000, storesMilkY2: true  },
  { id: 'B', name: 'Premise B', slots: 1, transport: 0.4, rent: 10000, storesMilkY2: true  },
  { id: 'C', name: 'Premise C', slots: 1, transport: 0.3, rent: 12000, storesMilkY2: false },
  { id: 'D', name: 'Premise D', slots: 1, transport: 0.1, rent: 17000, storesMilkY2: false },
  { id: 'E', name: 'Premise E', slots: 2, transport: 0.2, rent: 15000, storesMilkY2: false },
  { id: 'F', name: 'Premise F', slots: 3, transport: 0.2, rent: 16000, storesMilkY2: true  }
];

/* --- Section 04: Year 1 machines ------------------------------------------
   Depreciation is one eighth of purchase price for eight seasons.            */
const MACHINES = [
  { id: 'M1', name: 'Machine 1', capacity:  72000, price: 35000, maintenance: 1800, depr:  4375 },
  { id: 'M2', name: 'Machine 2', capacity: 120000, price: 95000, maintenance: 2900, depr: 11875 },
  { id: 'M3', name: 'Machine 3', capacity:  68000, price: 38000, maintenance: 2100, depr:  4750 },
  { id: 'M4', name: 'Machine 4', capacity:  95000, price: 70000, maintenance: 2900, depr:  8750 },
  { id: 'M5', name: 'Machine 5', capacity:  45000, price: 28000, maintenance: 1300, depr:  3500 },
  { id: 'M6', name: 'Machine 6', capacity: 110000, price: 90000, maintenance: 2900, depr: 11250 }
];

/* --- Section 06: demand forecast, all three years -------------------------
   The actual market runs up to 20% below or above forecast.                  */
const FORECAST = {
  winter: { y1: 280000, y2: 410000, y3: 540000 },
  spring: { y1: 360000, y2: 550000, y3: 750000 },
  summer: { y1: 400000, y2: 650000, y3: 900000 },
  autumn: { y1: 320000, y2: 470000, y3: 620000 }
};

/* --- What the Year 1 winter market actually did ---------------------------
   Transcribed from the trainer's allocation screen. Group 7's own row is
   confirmed; the rest reconciles exactly to the printed totals (requested
   620,000, cut 290,000, sold 330,000, revenue Sh 660,000), so the reading
   is sound. This is the only hard evidence the company has about how the
   trainer ranks and trims, and it is what the Year 2 plan has to respect. */
const Y1_WINTER_MARKET = {
  forecast: 280000,        // the handout's Year 1 winter forecast
  marketSize: 336000,      // what the market actually came in at: +20%, the top of the range
  saleableMarket: 330000,  // rounded down to whole 10,000-unit blocks
  totalRequested: 620000,
  totalCut: 290000,
  totalSold: 330000,
  totalRevenue: 660000,
  teams: [
    { team: 'Rank 1',  investment: 7000, requested: 330000, cut: 50000, sold: 280000, us: false },
    { team: 'Group 7', investment: 5000, requested:  70000, cut: 50000, sold:  20000, us: true  },
    { team: 'Rank 3',  investment: 3000, requested:  60000, cut: 50000, sold:  10000, us: false },
    { team: 'Rank 4',  investment: 2000, requested:  60000, cut: 50000, sold:  10000, us: false },
    { team: 'Rank 5',  investment: 1000, requested:  60000, cut: 50000, sold:  10000, us: false },
    { team: 'Rank 6',  investment: 1000, requested:  40000, cut: 40000, sold:      0, us: false }
  ]
};

const machineById = id => MACHINES.find(m => m.id === id);
const premiseById = id => PREMISES.find(p => p.id === id);
