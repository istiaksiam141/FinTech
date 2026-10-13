# Financial algorithms

## Exchange rate

The app contains no hard-coded FX rates. The student enters the current rate in BDT per unit of tuition currency, along with its source/reference and timestamp. Tuition cost in BDT is:

`tuition × student-entered BDT-per-destination-currency rate`

The app does not query or verify the source and reports that limitation beside the result and in the exported report. Verify current rates directly with a payment provider or authorized-dealer bank.

## Tuition gap and usable funds

- `requiredFunds = tuition × enteredRate + knownOneTimeFees`
- `usableFunds = max(0, savings − protectedEmergencyFund − committedFunds)`
- `fundingGap = max(0, requiredFunds − usableFunds)`
- `monthlySurplus = monthlyIncome − monthlyLivingCosts`
- `monthlySavingsTarget = fundingGap ÷ monthsUntilDeadline`
- `projectedSavingsCapacity = max(0, monthlySurplus) × floor(daysToDeadline ÷ 30)`

Known one-time payment fees should be entered once in the planner. Quote comparison is separate; do not add those quote fees to the profile fee estimate again. The deadline projection assumes full 30-day savings cycles and no income, expense, exchange-rate, or fee changes. It is not a guarantee.

## Quote comparison

The student must enter quotes for the same principal, payment purpose, destination, and recipient: total amount debited in BDT (including provider costs), recipient amount, any separately stated fee, delivery estimate, quote timestamp, and quote source/reference. Effective rate is derived as `total BDT sender cost ÷ destination-currency recipient amount`.

Quotes rank by lowest entered sender cost, highest entered recipient amount, or fastest entered delivery days. Quotes without valid cost/recipient values or a timestamp and source reference are excluded. Quotes without a delivery estimate are excluded from speed rankings. The app does not validate whether entries are authentic, current, available for the student's institution, or inclusive of intermediary/receiving-bank charges.

## Validation

Currency and corridor must match Bangladesh → UK (BDT/GBP), Bangladesh → US (BDT/USD), or Bangladesh → Canada (BDT/CAD). Monetary inputs must be finite, non-negative, within the application safety limit, and tuition/payment principal greater than zero. The rate must be positive and timestamped. Deadlines in the past or today are rejected.
