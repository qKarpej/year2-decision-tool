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

const machineById = id => MACHINES.find(m => m.id === id);
const premiseById = id => PREMISES.find(p => p.id === id);
