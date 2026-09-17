# Year 2 Winter Decision Tool — Pork & Garlic Ice Cream Co.

Group 7's decision tool for the Year 2 **winter** season of the ice cream simulation.
It carries the real Year 1 position forward, compares possible winter strategies under
the handout's rules, and shows exactly where each one makes or loses money — and where
it runs out of cash.

**Live site:** https://year2-decision-tool-taupe.vercel.app/

---

## It checks itself against the handout

The engine implements the Year 1 participant rules directly, and on every page load it
re-runs the four worked examples printed in the handout:

| Handout section | What it checks | Status |
|---|---|---|
| § 11 | The full worked winter company — gross profit 35,200, transport 16,000, bonus 1,760, net loss −3,560, closing cash 71,940 | ✅ |
| § 07 | Transport split across two premises — 42,000 × 0.3 + 28,000 × 0.4 = 23,800 | ✅ |
| § 08 | Sh 60,000 loan over 4 seasons at 10 % — interest 6,000, payment 21,000, debt 45,000 | ✅ |
| § 09 | Sh 100,000 profit against a Sh 50,000 loss pool — tax 5,000, net 95,000 | ✅ |

17 assertions in total, shown as pass/fail pills in the footer of the live site. If the
engine ever stops matching the paper rules, the page says so in red.

## The rules it implements

- **Revenue** Sh 2 per ice cream *actually allocated and sold* — not requested, not produced.
- **Milk** Sh 20,000/ton, 20,000 units per ton, minimum one ton every season. The whole
  season's purchase is costed once, spoiled portion included — there is deliberately
  **no second spoilage line**, exactly as § 05 requires.
- **Production** is capped by the tighter of the milk available and the capacity of
  machines installed in rented premises. Slots limit machines per premise.
- **Machines** depreciate ⅛ of purchase price for eight seasons, idle seasons included.
  Maintenance is paid every season of ownership. A purchase is cash only and never
  touches the P&L.
- **Transport** is charged per premise on units sold, split in proportion to what each
  premise produced, rounded to whole ice creams with the residual pushed to the last.
- **Bonus** 5 % of *gross* profit when gross profit is positive — so it can be paid in a
  season that still ends in a loss.
- **Salaries** Sh 10,000 every season, including a season with no sales.
- **Loans** 10 % per season on principal outstanding before that season's repayment,
  equal principal instalments, first payment in the season of borrowing.
- **Tax** 10 % of taxable profit after the carried loss pool; a loss grows the pool.
- **Cash** must never be negative before an advance payment or at season end. Advance
  payments are machines, milk and market investment — all made before the trainer says
  a word about your sales.

Profit and cash are reconciled on every scenario:

```
opening cash + net profit + depreciation + loan received
             − principal repaid − machines bought = closing cash
```

The page prints that tie-back under every cash flow and flags it in red if it ever fails.

## The pages

| | |
|---|---|
| **01 Position** | Cash, debt, loss pool and machines carried into Year 2 winter — all derived from the ledger |
| **02 Year 1 ledger** | The four Year 1 seasons, chained. Each opens with the previous season's closing cash, aged machines and outstanding loans. Enter what your classroom model said and it diagnoses any difference |
| **03 Year 2 rules** | Prices, premises, machines, forecast — every figure editable and labelled as a Year 1 estimate |
| **04 Options** | The decisions per option: premises, machines, milk, market investment, request, borrowing, and the allocation to test |
| **05 Results** | Full P&L, the season's cash timeline as a waterfall, transport by premise, break-even, and every rule breach |
| **06 Compare** | Line by line, an exact profit bridge, and net profit plotted against the trainer's allocation |
| **07 Decision** | The recommendation, its key assumption, and the answer to a thin allocation |

## Year 2 rules are not out yet

Everything on the rules page is the **Year 1 handout used as an estimate**. The trainer
issues the real Year 2 rules, premises and machine list next class. Nothing here is a
confirmed Year 2 price, every input stays editable, and the tool recalculates the moment
the real figures are typed in. The only Year 2 fact the handout already gives is the
demand forecast — and § 06 is explicit that a forecast is not a promise of sales:
when demand exceeds supply the trainer trims the lowest-ranked requests in 10,000-unit
blocks.

## Running it locally

No build step and no dependencies — plain HTML, CSS and JavaScript.

```bash
npx serve .
```

Or just open `index.html`. Figures are stored in your own browser; **Export** writes them
to a JSON file and **Import** reads them back.

## Publishing

Import the repository in Vercel with the framework preset set to **Other**. No build
command, no output directory — it is a static site.

## The Year 1 accounting model

`Pork-and-Garlic-Year-1-accounts-Group7.xlsx` is the classroom accounting model required by
§ 10 of the handout: a decisions-and-results form per season, a cash flow, a profit & loss
statement, and running records for machine life, loan debt and the unused tax loss pool.

It is built from the handout **independently of the JavaScript engine in this repository** and
recalculated by Excel. Both reach the same Year 1 winter result — net loss Sh 75,175 and
closing cash Sh 37,950 — and the workbook's own proof line, *opening cash + net profit +
depreciation + loan received − principal repaid − machines bought − closing cash*, comes to
zero. That agreement between two separate implementations is what the green tick on the
Year 1 ledger page rests on.

Colour legend: blue = typed input, black = formula, green = pulled from another sheet,
yellow = fill in each season.

## Files

| File | Role |
|---|---|
| `data.js` | The catalogue from the handout: premises, machines, forecast, constants |
| `engine.js` | One season in, a full P&L and cash timeline out. Pure calculation, no DOM. Includes the self-tests |
| `app.js` | State, the seven pages, and the hand-rolled SVG charts |
| `styles.css` | Design system, light and dark |
