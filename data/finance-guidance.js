(function (root) {
  const guidance = [
    { id: 'guidance-fees', topic: 'transfer fees', text: 'Review the provider quote for the full sender debit, provider fees, exchange rate, any intermediary or receiving bank charges, and expiry. If a cost is not stated, ask the provider before paying.', source: 'General checklist; verify every item on the provider’s own quote.' },
    { id: 'guidance-rate', topic: 'exchange-rate spread', text: 'Compare the provider’s quoted conversion rate and the final recipient amount with a dated reference rate. A reference rate is not necessarily the rate available for your tuition payment.', source: 'Bangladesh Bank reference-rate page: https://www.bb.org.bd/en/index.php/econdata/rfrexrate' },
    { id: 'guidance-planning', topic: 'tuition planning', text: 'Keep the tuition deadline, committed funds, emergency reserve, and available savings separate. Recheck them when your payment quote or budget changes.', source: 'CampusBridge planning guidance; the figures are yours and are not independently verified.' },
    { id: 'guidance-emergency', topic: 'emergency savings', text: 'The planner protects the emergency amount you enter by excluding it from tuition funds. Choose that reserve based on your own circumstances.', source: 'Planner rule; not individualized financial advice.' },
    { id: 'guidance-fraud', topic: 'fraud warning signs', text: 'Do not share banking passwords or one-time codes with CampusBridge. Verify changed payment instructions using a known university or bank contact channel before sending funds.', source: 'Security guidance; confirm instructions with your institution and bank.' },
    { id: 'guidance-verification', topic: 'payment verification', text: 'Confirm the institution, student reference, currency, amount, payment purpose, and receiving account details from the current payment instruction before authorizing anything.', source: 'Check the university’s official payment instructions and your provider’s current quote.' }
  ];
  if (typeof module === 'object' && module.exports) module.exports = guidance;
  if (root) root.CampusBridgeGuidance = guidance;
})(typeof globalThis !== 'undefined' ? globalThis : this);
