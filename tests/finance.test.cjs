const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Finance = require('../lib/finance.js');

const today = new Date(2026, 9, 13);
function isoAfter(days) { const d=new Date(today);d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function profile(overrides={}) { return {homeCountry:'Bangladesh',destinationCountry:'United Kingdom',homeCur:'BDT',tuitionCur:'GBP',tuition:'8000',exchangeRate:'155',rateSource:'Student-entered bank quote ref 123',rateTimestamp:'2026-10-13T10:00',savings:'500000',income:'60000',expenses:'35000',committed:'10000',emergency:'50000',paymentFee:'0',deadline:isoAfter(60),...overrides}; }

test('all primary corridors have real-currency support without preset conversion rates',()=>{
  for(const c of ['GBP','USD','CAD']) assert.ok(Finance.CURRENCIES.includes(c));
  const referenceRates={GBP:0.79,BDT:120};
  assert.ok(Math.abs(Finance.convert(100,'GBP','BDT',referenceRates)-100*120/.79)<1e-8);
  assert.throws(()=>Finance.convert(1,'GBP','BDT'),/source-identified rate/);
});

test('tuition planner uses the rate entered with source and timestamp',()=>{
  const r=Finance.calculateTuition(profile(),today);
  assert.equal(r.ok,true);assert.equal(r.rate,155);assert.equal(r.tuitionHome,1240000);assert.equal(r.usable,440000);assert.equal(r.gap,800000);
  assert.match(r.assumptions[0],/Student-entered bank quote ref 123/);
});

test('missing, zero, negative, or unreferenced rates and invalid monetary inputs are rejected',()=>{
  assert.match(Finance.validateProfile(profile({exchangeRate:''}),today).join(' '),/Exchange rate/);
  assert.match(Finance.validateProfile(profile({exchangeRate:'-1'}),today).join(' '),/cannot be negative/);
  assert.match(Finance.validateProfile(profile({rateSource:''}),today).join(' '),/source/);
  assert.match(Finance.validateProfile(profile({rateTimestamp:''}),today).join(' '),/timestamp/);
  assert.match(Finance.validateProfile(profile({savings:'-1'}),today).join(' '),/cannot be negative/);
  assert.match(Finance.validateProfile(profile({deadline:isoAfter(0)}),today).join(' '),/at least 1 day/);
});

test('real quote entries are ranked by total cost, recipient amount, or speed',()=>{
  const quotes=[
    {name:'Provider A',totalCost:'202000',fee:'2000',recipientAmount:'1300',days:'3',timestamp:'2026-10-13T08:00',reference:'A-123'},
    {name:'Provider B',totalCost:'201000',fee:'1000',recipientAmount:'1280',days:'1',timestamp:'2026-10-13T08:01',reference:'B-456'},
    {name:'Bank C',totalCost:'204000',fee:'4000',recipientAmount:'1350',days:'5',timestamp:'2026-10-13T08:02',reference:'C-789'}
  ];
  assert.equal(Finance.compareEnteredQuotes({amount:'200000',to:'GBP',sort:'cost'},quotes).available[0].quote.name,'Provider B');
  assert.equal(Finance.compareEnteredQuotes({amount:'200000',to:'GBP',sort:'recv'},quotes).available[0].quote.name,'Bank C');
  assert.equal(Finance.compareEnteredQuotes({amount:'200000',to:'GBP',sort:'time'},quotes).available[0].quote.name,'Provider B');
});

test('quote comparison rejects fake or incomplete financial values and will not guess delivery speed',()=>{
  const base={name:'Provider A',totalCost:'200000',recipientAmount:'1200',fee:'',days:'',timestamp:'2026-10-13T08:00',reference:'A-123'};
  assert.equal(Finance.compareEnteredQuotes({amount:'200000',to:'GBP',sort:'cost'},[base]).available.length,1);
  const speed=Finance.compareEnteredQuotes({amount:'200000',to:'GBP',sort:'time'},[base]);
  assert.equal(speed.available.length,0);assert.match(speed.unavailable[0].reason,/Delivery time is missing/);
  assert.equal(Finance.compareEnteredQuotes({amount:'200000',to:'GBP',sort:'cost'},[{...base,totalCost:'199000'}]).available.length,0);
  assert.equal(Finance.compareEnteredQuotes({amount:'200000',to:'GBP',sort:'cost'},[{...base,reference:''}]).available.length,0);
});

test('active UI has blank financial inputs and working external quote paths; scripts parse',()=>{
  const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  for(const marker of ['id="exchangeRate"','id="rateSource"','id="rateTimestamp"','id="providerQuoteForms"','convera.com/students/faq','pay.flywire.com','id="applyScenario"','id="resetScenario"','id="exportReport"']) assert.ok(html.includes(marker),`missing ${marker}`);
  assert.doesNotMatch(html,/value="(?:12000|450000|80000|52000|200000)"/);
  assert.doesNotMatch(app,/fictional|illustrative/);
  assert.ok(app.includes('Finance.compareEnteredQuotes'));
  new vm.Script(app,{filename:'app.js'});
});
