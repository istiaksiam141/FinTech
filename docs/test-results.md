# Test results

Command: `node --test tests/finance.test.cjs`

Result after the latest real-input changes: 6 tests passed, 0 failed. Coverage includes source-bound user rates, missing/invalid values, funding calculations, quote ranking by total cost/recipient amount/delivery speed, refusal to guess missing delivery data, blank initial values, official provider handoff links, and JavaScript parsing.

Browser end-to-end/visual testing has not been completed. No provider API or live quote credentials exist, so live provider tests were not possible.
