# Year 2 Winter Decision Tool — Pork and Garlic Ice Cream Co.

A single-page web tool for choosing the Year 2 **winter** strategy in the ice cream
simulation. It starts from the company's real position after Year 1 autumn, compares
several possible winter decisions, and shows the projected profit & loss, the cash
flow through the season, and where the plan breaks.

**Live site:** _paste your Vercel URL here_

---

## What it does

| Page | What it covers |
|---|---|
| 1 · Position | Closing cash, loans, unused tax losses, Year 1 annual profit, and every owned machine with its remaining life in seasons |
| 2 · Year 2 rules | Prices, milk, transport, interest, tax, premises options, and the winter market forecast — **all estimates until the trainer issues the Year 2 rules** |
| 3 · Options | The decisions for each option: production, milk purchase, sales request, market investment, premises, machines, borrowing — plus the actual sales allocation you want to test |
| 4 · Results | Full P&L (including depreciation, interest and tax loss carried forward), the season's cash timeline, warnings, and a sensitivity table |
| 5 · Compare | Line-by-line differences between the options and a written explanation of what drives them |
| 6 · Year 1 check | Enter one real Year 1 season; profit and closing cash must match the classroom model |
| 7 · Decision | The recommendation, its key assumption, and what happens on a low allocation |

## Everything is an estimate until the trainer says otherwise

The Year 2 rules, premises and machine choices have not been issued. Every price on
page 2 is carried over from Year 1 and is labelled as an estimate. The market forecast
is **not a promise of sales** — the trainer allocates the market in class. All of these
inputs stay editable so the tool can be updated in minutes when the real rules arrive.

## How the numbers work

**Production** is the smallest of: planned production, premises/machine capacity, and
what the purchased milk allows (`litres ÷ litres per unit`).

**Sales** cannot exceed production, and cannot exceed the sales request — the trainer
cannot allocate more than you ask for.

**Profit & loss**

```
Revenue                        units sold × price
− Cost of goods sold           units sold × unit cost
− Spoilage and wasted milk     unsold units + unused milk, less any recovery
= Gross profit
− Rent, machine running costs, market investment, transport
= Operating profit before depreciation
− Depreciation
= Operating profit
− Interest                     (opening loans + new borrowing) × rate
= Profit before tax
− Tax                          on profit after using the loss carried forward
= Net profit
```

**Cash flow** is modelled as a timeline, not a single total, because the question is
*when* cash runs out. Borrowing is drawn, then machines, rent and market investment
are paid, then the milk advance, then the milk balance and production costs, then
sales come in, and finally interest, repayments and tax. The tool flags the plan if
cash cannot cover the milk advance, if it dips negative mid-season, or if it ends
negative.

Every cash flow is cross-checked against profit:

```
opening cash + net profit + depreciation + borrowing − repayment − machines bought
= closing cash
```

If that check ever fails, the tool says so in red.

## Running it locally

There is no build step and no dependencies. Open `index.html` in a browser, or:

```bash
npx serve .
```

Your figures are stored in your own browser (`localStorage`). Use **Export** to save
them to a JSON file and **Import** to load them on another machine.

## Publishing

The project is plain static HTML, CSS and JavaScript, so Vercel needs no build
configuration — import the GitHub repository and deploy with the framework preset
set to **Other**.
