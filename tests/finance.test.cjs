const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Finance = require('../lib/finance.js');
const ExchangeRates = require('../lib/exchange-rates.js');
const BangladeshBankRates = require('../lib/bangladesh-bank-rates.js');
const exchangeRateHandler = require('../api/exchange-rates.js');

const today = new Date(2026, 9, 13);
const quoteNow = new Date(2026, 9, 13, 12, 0);
function isoAfter(days) { const d=new Date(today);d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function profile(overrides={}) { return {homeCountry:'Bangladesh',destinationCountry:'United Kingdom',homeCur:'BDT',tuitionCur:'GBP',tuition:'8000',exchangeRate:'155',rateSource:'Student-entered bank quote ref 123',rateTimestamp:'2026-10-13T10:00',savings:'500000',income:'60000',expenses:'35000',committed:'10000',emergency:'50000',paymentFee:'0',deadline:isoAfter(60),...overrides}; }
function quote(overrides={}) { return {name:'Provider A',currency:'GBP',totalCost:'200000',fee:'1000',quotedRate:'155',recipientAmount:'1200',days:'3',timestamp:'2026-10-13T08:00',reference:'A-123',...overrides}; }
function compare(input,quotes,now=quoteNow) { return Finance.compareEnteredQuotes(input,quotes,now); }
const apiNow = Date.UTC(2026,9,13,12,0,0);
function officialHtml(overrides={}) {
  const { date='13/10/2026', gbp='162.8300', gbpAsk='163.0484', usd='123.3000', usdAsk='123.4000', war='123.3600', cad='86.3264', cadAsk='86.4025' }=overrides;
  return `<html><p>FX Rate Sheet effective for ${date}</p><table><tr><th>Currency</th><th>Bid Rate</th><th>Ask Rate</th><th>WAR</th></tr><tr><td>USD</td><td>${usd}</td><td>${usdAsk}</td><td>${war}</td></tr></table><table><tr><th>Currency</th><th>Bid Rate</th><th>Ask Rate</th></tr><tr><td>GBP</td><td>${gbp}</td><td>${gbpAsk}</td></tr><tr><td>CAD</td><td>${cad}</td><td>${cadAsk}</td></tr></table></html>`;
}
function bbResponse(overrides={}) { return {source:'Bangladesh Bank FX Rate Sheet',sourceUrl:BangladeshBankRates.SOURCE_URL,publicationDate:'2026-10-13',retrievedAt:'2026-10-13T12:00:00.000Z',rates:{GBP:{baseCurrency:'GBP',quoteCurrency:'BDT',bid:162.83,ask:163.0484,weightedAverage:null},USD:{baseCurrency:'USD',quoteCurrency:'BDT',bid:123.3,ask:123.4,weightedAverage:123.36},CAD:{baseCurrency:'CAD',quoteCurrency:'BDT',bid:86.3264,ask:86.4025,weightedAverage:null}},...overrides}; }

test('all primary corridors have real-currency support without preset conversion rates',()=>{
  for(const c of ['GBP','USD','CAD']) assert.ok(Finance.CURRENCIES.includes(c));
  const referenceRates={GBP:0.79,BDT:120};
  assert.ok(Math.abs(Finance.convert(100,'GBP','BDT',referenceRates)-100*120/.79)<1e-8);
  assert.throws(()=>Finance.convert(1,'GBP','BDT'),/source-identified rate/);
});

test('Bangladesh Bank HTML sheet parses published BDT-per-currency ask, bid, and USD WAR',()=>{
  const result=BangladeshBankRates.parseBangladeshBankPage(officialHtml(),new Date('2026-10-13T12:00:00Z'));
  assert.equal(result.publicationDate,'2026-10-13');
  assert.equal(result.rates.GBP.ask,163.0484);
  assert.equal(result.rates.GBP.bid,162.83);
  assert.equal(result.rates.USD.weightedAverage,123.36);
  assert.equal(result.rates.CAD.ask,86.4025);
  const validated=ExchangeRates.parseOfficialResponse(result,apiNow);
  assert.equal(validated.rates.GBP,163.0484);
  assert.equal(validated.rates.USD,123.4);
  assert.equal(Finance.calculateTuition(profile({exchangeRate:String(validated.rates.GBP)}),today).tuitionHome,1304387.2);
});

test('parser extracts current values from a saved fragment of the actual Bangladesh Bank HTML page',()=>{
  const html=fs.readFileSync(path.join(__dirname,'fixtures','bangladesh-bank-live-2026-10-13.html'),'utf8');
  const data=BangladeshBankRates.parseBangladeshBankPage(html,new Date('2026-10-13T12:00:00Z'));
  assert.equal(data.publicationDate,'2026-10-13');
  assert.deepEqual(data.rates,{GBP:{bid:162.83,ask:163.0484,weightedAverage:null,baseCurrency:'GBP',quoteCurrency:'BDT'},USD:{bid:123.3,ask:123.4,weightedAverage:123.36,baseCurrency:'USD',quoteCurrency:'BDT'},CAD:{bid:86.3264,ask:86.4025,weightedAverage:null,baseCurrency:'CAD',quoteCurrency:'BDT'}});
  assert.equal((html.match(/<table>/g)||[]).length,2,'fixture retains the source’s two current rate tables');
  assert.match(html,/<td>EUR<\/td>/,'unrequested current cross-rate rows are present in the source fragment');
  assert.equal(data.rates.EUR,undefined,'other currencies are not mistaken for planner currencies');
  assert.throws(()=>BangladeshBankRates.parseBangladeshBankPage(html.replace('<td>CAD</td>','<td>XXX</td>'),new Date('2026-10-13T12:00:00Z')),/did not publish a CAD rate/);
});

test('Bangladesh Bank fetch calls same-origin Vercel route and accepts mocked JSON',async()=>{
  let requestedUrl='';let requestedOptions;
  const result=await ExchangeRates.fetchLatestRates({nowMs:apiNow,fetchImpl:async(url,options)=>{requestedUrl=url;requestedOptions=options;return {ok:true,status:200,json:async()=>bbResponse()};}});
  assert.equal(requestedUrl,'/api/exchange-rates');
  assert.equal(result.rates.GBP,163.0484);
  assert.equal(requestedOptions.headers.Accept,'application/json');
  assert.equal(requestedOptions.headers.Authorization,undefined);
  const cachedStale=await ExchangeRates.fetchLatestRates({nowMs:apiNow,fetchImpl:async()=>({ok:true,status:200,headers:{get:(name)=>name==='x-vercel-cache'?'STALE':null},json:async()=>bbResponse()})});
  assert.equal(cachedStale.stale,true,'Vercel stale-while-revalidate responses are not presented as fresh');
});

test('a missing rate API route gives preview-specific guidance without applying a rate',async()=>{
  await assert.rejects(
    ExchangeRates.fetchLatestRates({fetchImpl:async()=>({ok:false,status:404,json:async()=>({})})}),
    error=>/unavailable on this preview/.test(error.message)&&/No rate was applied/.test(error.message)
  );
});

test('Bangladesh Bank parser rejects missing date, malformed layout, and invalid rates',()=>{
  assert.throws(()=>BangladeshBankRates.parseBangladeshBankPage(officialHtml({date:''}),new Date('2026-10-13T12:00:00Z')),/publication date/);
  assert.throws(()=>BangladeshBankRates.parseBangladeshBankPage(`<html><p>FX Rate Sheet effective for 13/10/2026</p>${'x'.repeat(120)}</html>`,new Date('2026-10-13T12:00:00Z')),/layout/);
  assert.throws(()=>BangladeshBankRates.parseBangladeshBankPage(officialHtml({gbp:'0'}),new Date('2026-10-13T12:00:00Z')),/invalid/);
  assert.throws(()=>BangladeshBankRates.parseBangladeshBankPage(officialHtml({cad:'-2'}),new Date('2026-10-13T12:00:00Z')),/malformed/);
  assert.throws(()=>BangladeshBankRates.parseBangladeshBankPage(officialHtml({war:'NaN'}),new Date('2026-10-13T12:00:00Z')),/malformed/);
  assert.throws(()=>BangladeshBankRates.parseBangladeshBankPage(officialHtml({date:'32/13/2026'}),new Date('2026-10-13T12:00:00Z')),/invalid/);
  const stale=BangladeshBankRates.parseBangladeshBankPage(officialHtml({date:'01/10/2026'}),new Date('2026-10-13T12:00:00Z'));
  assert.equal(stale.stale,true);
});

test('upstream fetch rejects HTTP errors, invalid content type, and timeout',async()=>{
  await assert.rejects(BangladeshBankRates.fetchBangladeshBankRates({fetchImpl:async()=>({ok:false,status:503}),now:()=>new Date('2026-10-13T12:00:00Z')}),/HTTP 503/);
  await assert.rejects(BangladeshBankRates.fetchBangladeshBankRates({fetchImpl:async()=>({ok:true,headers:{get:()=> 'application/pdf'},text:async()=>officialHtml()}),now:()=>new Date('2026-10-13T12:00:00Z')}),/content type/);
  await assert.rejects(BangladeshBankRates.fetchBangladeshBankRates({timeoutMs:1,fetchImpl:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})))),now:()=>new Date('2026-10-13T12:00:00Z')}),/timed out/);
});

test('Vercel endpoint returns a clear uncached 502 on network failure',async()=>{
  const originalFetch=globalThis.fetch; const response={headers:{},statusCode:null,body:null,setHeader(name,value){this.headers[name]=value;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
  globalThis.fetch=async()=>{throw new Error('network unavailable');};
  try { await exchangeRateHandler({},response); } finally { globalThis.fetch=originalFetch; }
  assert.equal(response.statusCode,502);
  assert.equal(response.headers['Cache-Control'],'no-store');
  assert.match(response.body.error,/temporarily unavailable/);
  assert.equal(response.body.rates,undefined,'errors never include invented fallback rates');
});

test('Vercel endpoint returns validated source metadata and cache headers on success',async()=>{
  const originalFetch=globalThis.fetch; let upstreamOptions;
  const response={headers:{},statusCode:null,body:null,setHeader(name,value){this.headers[name]=value;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
  globalThis.fetch=async(_url,options)=>{upstreamOptions=options;return {ok:true,status:200,headers:{get:()=> 'text/html; charset=utf-8'},text:async()=>fs.readFileSync(path.join(__dirname,'fixtures','bangladesh-bank-live-2026-10-13.html'),'utf8')};};
  try { await exchangeRateHandler({},response); } finally { globalThis.fetch=originalFetch; }
  assert.equal(response.statusCode,200);
  assert.equal(response.headers['Cache-Control'],'public, s-maxage=1800, stale-while-revalidate=1800');
  assert.equal(response.headers['Content-Type'],'application/json; charset=utf-8');
  assert.equal(response.body.publicationDate,'2026-10-13');
  assert.equal(response.body.rates.GBP.ask,163.0484);
  assert.equal(response.body.rates.USD.weightedAverage,123.36);
  assert.equal(upstreamOptions.headers.Authorization,undefined,'no upstream secret or API key is used');
});

test('official response validation enforces direction, source, timestamps, stale state, and manual-safe errors',async()=>{
  const valid=ExchangeRates.parseOfficialResponse(bbResponse(),apiNow);
  assert.equal(valid.rates.GBP,163.0484);
  assert.equal(valid.stale,false);
  assert.equal(ExchangeRates.parseOfficialResponse(bbResponse(),apiNow+3*60*60*1000).stale,true,'cached retrieval older than two hours is stale');
  assert.throws(()=>ExchangeRates.parseOfficialResponse(bbResponse({publicationDate:''}),apiNow),/date/);
  assert.throws(()=>ExchangeRates.parseOfficialResponse(bbResponse({sourceUrl:'https://example.com/fake'}),apiNow),/source/);
  assert.throws(()=>ExchangeRates.parseOfficialResponse(bbResponse({retrievedAt:'2026-10-14T12:00:00Z'}),apiNow),/dates/);
  assert.throws(()=>ExchangeRates.parseOfficialResponse(bbResponse({rates:{...bbResponse().rates,GBP:{...bbResponse().rates.GBP,ask:Infinity}}}),apiNow),/GBP/);
  assert.throws(()=>ExchangeRates.parseOfficialResponse(bbResponse({rates:{...bbResponse().rates,GBP:{...bbResponse().rates.GBP,bid:0}}}),apiNow),/GBP/);
  assert.throws(()=>ExchangeRates.parseOfficialResponse(bbResponse({rates:{...bbResponse().rates,GBP:{...bbResponse().rates.GBP,ask:162}}}),apiNow),/GBP/);
  const stale=ExchangeRates.parseOfficialResponse(bbResponse({publicationDate:'2026-10-01'}),Date.UTC(2026,9,13,12));
  assert.equal(stale.stale,true);
  await assert.rejects(ExchangeRates.fetchLatestRates({nowMs:apiNow,fetchImpl:async()=>({ok:false,status:502,json:async()=>({error:'upstream unavailable'})})}),/upstream unavailable/);
});

test('tuition planner uses the rate entered with source and timestamp',()=>{
  const r=Finance.calculateTuition(profile(),today);
  assert.equal(r.ok,true);assert.equal(r.rate,155);assert.equal(r.tuitionHome,1240000);assert.equal(r.usable,440000);assert.equal(r.gap,800000);
  assert.match(r.assumptions[0],/Student-entered bank quote ref 123/);
});

test('monthly target and projected capacity use only complete 30-day contribution dates',()=>{
  const expectedCycles=new Map([[1,0],[29,0],[30,1],[31,1],[59,1],[60,2]]);
  for(const [days,cycles] of expectedCycles){
    const r=Finance.calculateTuition(profile({deadline:isoAfter(days)}),today);
    assert.equal(r.ok,true,`${days}-day deadline should be valid`);
    assert.equal(r.contributionCycles,cycles,`${days}-day contribution dates`);
    assert.equal(r.monthsRemaining,cycles,`${days}-day count of remaining contribution months`);
    assert.equal(r.usable,440000,`${days}-day protected-reserve calculation`);
    assert.equal(r.gap,800000,`${days}-day funding gap`);
    if(cycles===0){
      assert.equal(r.monthlyTarget,null,`${days}-day deadline has no monthly target`);
      assert.equal(r.capacity,0);
      assert.equal(r.shortfall,r.gap);
    } else {
      assert.equal(r.monthlyTarget*cycles,r.gap,`${days}-day target sums to the gap`);
      assert.equal(r.capacity,25000*cycles);
      assert.equal(r.shortfall,Math.max(0,r.gap-r.capacity));
    }
  }
});

test('covered tuition needs no target, and zero or past deadlines remain invalid',()=>{
  const covered=Finance.calculateTuition(profile({deadline:isoAfter(1),savings:'1300000',emergency:'50000',committed:'10000'}),today);
  assert.equal(covered.ok,true);assert.equal(covered.gap,0);assert.equal(covered.monthlyTarget,0);assert.equal(covered.shortfall,0);
  for(const days of [0,-1]){
    const r=Finance.calculateTuition(profile({deadline:isoAfter(days)}),today);
    assert.equal(r.ok,false,`${days}-day deadline should be rejected`);
    assert.match(r.errors.join(' '),/Deadline must be at least 1 day/);
  }
});

test('assistant savings guidance says no more monthly savings are needed when the gap is covered',()=>{
  const covered=Finance.calculateTuition(profile({deadline:isoAfter(1),savings:'1300000',emergency:'50000',committed:'10000'}),today);
  const guidance=Finance.describeMonthlySavingsTarget(covered);
  assert.equal(guidance.state,'covered');
  assert.equal(guidance.amount,0);
  assert.equal(guidance.message,'Your current usable savings cover the estimated tuition need. No additional monthly savings are needed for this target.');
  const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  assert.ok(app.includes('target.state==="covered"?target.message'));
});

test('missing, zero, negative, or unreferenced rates and invalid monetary inputs are rejected',()=>{
  assert.match(Finance.validateProfile(profile({exchangeRate:''}),today).join(' '),/Exchange rate/);
  assert.match(Finance.validateProfile(profile({exchangeRate:'-1'}),today).join(' '),/cannot be negative/);
  for(const value of ['0','NaN','Infinity','1e13']) assert.ok(Finance.validateProfile(profile({exchangeRate:value}),today).length>0,`invalid exchange rate ${value} should be rejected`);
  assert.match(Finance.validateProfile(profile({rateSource:''}),today).join(' '),/source/);
  assert.match(Finance.validateProfile(profile({rateTimestamp:''}),today).join(' '),/timestamp/);
  assert.match(Finance.validateProfile(profile({savings:'-1'}),today).join(' '),/cannot be negative/);
  assert.match(Finance.validateProfile(profile({deadline:isoAfter(0)}),today).join(' '),/at least 1 day/);
});

test('real quote entries are ranked by total cost, recipient amount, or speed',()=>{
  const quotes=[
    quote({name:'Provider A',totalCost:'202000',fee:'2000',recipientAmount:'1300',days:'3',timestamp:'2026-10-13T08:00',reference:'A-123'}),
    quote({name:'Provider B',totalCost:'201000',fee:'1000',recipientAmount:'1280',days:'1',timestamp:'2026-10-13T08:01',reference:'B-456'}),
    quote({name:'Bank C',totalCost:'204000',fee:'4000',recipientAmount:'1350',days:'5',timestamp:'2026-10-13T08:02',reference:'C-789'})
  ];
  assert.equal(compare({amount:'200000',to:'GBP',sort:'cost'},quotes).available[0].quote.name,'Provider B');
  assert.equal(compare({amount:'200000',to:'GBP',sort:'recv'},quotes).available[0].quote.name,'Bank C');
  assert.equal(compare({amount:'200000',to:'GBP',sort:'time'},quotes).available[0].quote.name,'Provider B');
});

test('quote comparison rejects fake or incomplete financial values and will not guess delivery speed',()=>{
  const base=quote({fee:'',days:''});
  assert.equal(compare({amount:'200000',to:'GBP',sort:'cost'},[base]).available.length,1);
  const speed=compare({amount:'200000',to:'GBP',sort:'time'},[base]);
  assert.equal(speed.available.length,0);assert.match(speed.unavailable[0].reason,/delivery time is required to rank by speed/);
  assert.equal(compare({amount:'200000',to:'GBP',sort:'cost'},[{...base,totalCost:'199000'}]).available.length,0);
  assert.equal(compare({amount:'200000',to:'GBP',sort:'cost'},[{...base,reference:''}]).available.length,0);
});

test('quote comparison requires provider name, amounts, currency, timestamp, and source reference',()=>{
  const required=['name','totalCost','recipientAmount','currency','timestamp','reference'];
  for(const field of required){
    const result=compare({amount:'200000',to:'GBP',sort:'cost'},[quote({[field]:''})]);
    assert.equal(result.available.length,0,`${field} must be present`);
    assert.equal(result.unavailable.length,1);
  }
});

test('quote amounts and optional numeric details must be finite and within sensible bounds',()=>{
  for(const value of ['Infinity','NaN','not a number','1e13','-1','0']){
    const total=compare({amount:'200000',to:'GBP',sort:'cost'},[quote({totalCost:value})]);
    assert.equal(total.available.length,0,`invalid sender total ${value}`);
    const recipient=compare({amount:'200000',to:'GBP',sort:'cost'},[quote({recipientAmount:value})]);
    assert.equal(recipient.available.length,0,`invalid recipient amount ${value}`);
  }
  assert.equal(compare({amount:'1e13',to:'GBP',sort:'cost'},[quote()]).ok,false);
  for(const overrides of [{fee:'Infinity'},{fee:'-1'},{fee:'200001'},{quotedRate:'0'},{quotedRate:'Infinity'}]){
    assert.equal(compare({amount:'200000',to:'GBP',sort:'cost'},[quote(overrides)]).available.length,0,`invalid quote detail ${JSON.stringify(overrides)}`);
  }
});

test('invalid delivery estimates are shown as not provided and do not affect non-speed rankings',()=>{
  for(const days of ['not a number','1.5','366','Infinity','-1']){
    const byCost=compare({amount:'200000',to:'GBP',sort:'cost'},[quote({days})]);
    assert.equal(byCost.available.length,1,`${days} must not invalidate the cost quote`);
    assert.equal(byCost.available[0].days,null);
    const bySpeed=compare({amount:'200000',to:'GBP',sort:'time'},[quote({days})]);
    assert.equal(bySpeed.available.length,0,`${days} cannot be used to rank by speed`);
    assert.match(bySpeed.unavailable[0].reason,/delivery time is required to rank by speed/);
  }
});

test('timestamps must be well-formed, not future-dated, and no older than the 24-hour freshness window',()=>{
  const input={amount:'200000',to:'GBP',sort:'cost'};
  for(const timestamp of ['yesterday','2026-02-30T08:00','2026-10-13']){
    const result=compare(input,[quote({timestamp})]);
    assert.equal(result.available.length,0,`malformed timestamp ${timestamp}`);
    assert.match(result.unavailable[0].reason,/valid local date and time/);
  }
  const future=compare(input,[quote({timestamp:'2026-10-13T12:01'})]);
  assert.equal(future.available.length,0);
  assert.match(future.unavailable[0].reason,/future-dated/);
  const stale=compare(input,[quote({timestamp:'2026-10-12T11:59'})]);
  assert.equal(stale.available.length,0);
  assert.match(stale.unavailable[0].reason,/older than 24 hours/);
  const atLimit=compare(input,[quote({timestamp:'2026-10-12T12:00'})]);
  assert.equal(atLimit.available.length,1);
  assert.equal(atLimit.available[0].verified,false);
});

test('quote currency must match the selected corridor currency',()=>{
  const result=compare({amount:'200000',to:'GBP',sort:'cost'},[quote({currency:'USD'})]);
  assert.equal(result.available.length,0);
  assert.match(result.unavailable[0].reason,/does not match/);
});

test('comparison ranking and report export share the same eligible quote list',()=>{
  const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  const calls=app.match(/currentQuoteComparison\(\)/g)||[];
  assert.equal(calls.length,3,'the helper is defined and used for both comparison and report export');
  assert.ok(app.includes('const comparison=cmp.ok?cmp.available:[]'));
  assert.ok(app.includes('const excluded=cmp.ok?cmp.unavailable:[]'));
  const quotes=[quote(),quote({name:'Expired',timestamp:'2026-10-12T11:59'})];
  const result=compare({amount:'200000',to:'GBP',sort:'cost'},quotes);
  assert.equal(result.available.length,1);
  assert.equal(result.unavailable.length,1);
  assert.equal(result.available[0].quote.name,'Provider A');
});

test('active UI has blank financial inputs and working external quote paths; scripts parse',()=>{
  const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  for(const marker of ['id="exchangeRate"','id="rateSource"','id="rateTimestamp"','id="rateTimestampHint"','id="rateTimestampTrigger"','id="rateTimestampCalendar"','id="rateTimestampTime"','id="useCurrentRateTimestamp"','id="refreshExchangeRate"','id="useExchangeRate"','id="exchangeRateStatus"','id="providerQuoteForms"','id="deadlineHint"','id="deadlineTrigger"','id="deadlineCalendar"','role="grid"','aria-haspopup="dialog"','.formSection .fieldGrid>label{align-self:start;align-content:start}','.timestampControl{display:flex;width:100%;min-width:0}','#providerQuoteForms .quoteTimestampLabel{grid-column:1/-1}','.calendarDay.isToday:not(.isSelected){background:#eaf6f0','.customSelect{position:relative;width:100%;min-width:0}','.customSelectOption[aria-selected=true]::after{content:"✓"','https://www.bb.org.bd/en/index.php/econdata/exchangerate','convera.com/students/faq','pay.flywire.com','id="applyScenario"','id="resetScenario"','id="exportReport"','src="lib/exchange-rates.js"']) assert.ok(html.includes(marker),`missing ${marker}`);
  for(const marker of ['@keyframes globeTurn','animation:globeTurn 34s linear infinite','<div class="globeMap">','<g class="globeLand">','<g class="globeGrid">','.heroVisual .orb3d{width:min(430px,82vw)}','.heroVisual .tileB{right:-4%}']) assert.ok(html.includes(marker),`missing ${marker}`);
  assert.doesNotMatch(html,/class="(?:orbit|node)(?:\s|")/,'the hero illustration no longer uses atom-style orbiting particles');
  assert.ok(app.includes('data-field="timestamp" type="datetime-local"'),'quote timestamps remain date-time inputs for existing validation and comparison');
  assert.equal(fs.existsSync(path.join(root,'api','exchange-rates.js')),true);
  assert.ok(fs.readFileSync(path.join(root,'docs','financial-algorithms.md'),'utf8').includes('Bangladesh Bank published rates'));
  const endpoint=fs.readFileSync(path.join(root,'api','exchange-rates.js'),'utf8');
  assert.match(endpoint,/s-maxage=1800, stale-while-revalidate=1800/);
  assert.match(endpoint,/status\(502\)/);
  assert.doesNotMatch(html,/value="(?:12000|450000|80000|52000|200000)"/);
  assert.doesNotMatch(app,/fictional|illustrative/);
  assert.ok(app.includes('Finance.compareEnteredQuotes'));
  assert.ok(app.includes('data-field="currency"'));
  assert.match(app,/input\.min = localDate\(deadlineMinimum\(\)\)/,'past dates are excluded from the native constraint');
  assert.match(app,/calendarTomorrow/,'the calendar offers the earliest valid deadline as a shortcut');
  assert.match(app,/byId\("useCurrentRateTimestamp"\)\.addEventListener/,'the rate timestamp has a current-local-time shortcut');
  assert.match(app,/function renderRateTimestampCalendar/,'the rate timestamp has an interactive calendar');
  assert.match(app,/function initializeQuoteTimestampPicker/,'provider quote timestamps use the interactive date-time picker');
  assert.match(app,/function initializeCustomSelect/,'dropdowns use the branded accessible menu');
  assert.match(app,/trigger\.setAttribute\("aria-controls", menu\.id\)/,'dropdown triggers identify their listbox');
  assert.match(app,/event\.key === "Enter" \|\| event\.key === " "/,'dropdowns support keyboard activation');
  assert.match(app,/ArrowRight/,'the custom calendar supports keyboard navigation');
  assert.match(app,/result\.daysRemaining === 1 \? "day" : "days"/,'deadline results use correct singular and plural labels');
  assert.match(app,/byId\("deadline"\)\.addEventListener\("change"/,'selecting a deadline updates the displayed plan');
  const fetchHandler=app.slice(app.indexOf('async function refreshExchangeRate()'),app.indexOf('function useFetchedExchangeRate()'));
  assert.equal(fetchHandler.includes('byId("exchangeRate").value ='),false,'fetching only previews the rate and does not replace the student\'s current value');
  new vm.Script(app,{filename:'app.js'});
});

test('student-facing privacy notices, progressive quote entry, and technical disclosures are present',()=>{
  const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  for(const marker of ['id="privacy"','Your question is sent to Groq','Your financial form and quote entries are not included','id="addQuoteProvider"','What will the downloaded report contain?','id="requirements"','Technical integration readiness','formal privacy/terms documents are not configured']) assert.ok(html.includes(marker),`missing ${marker}`);
  assert.match(app,/providerDefs\.slice\(0,\s*visibleProviderCount\)/,'quote forms are shown progressively');
  assert.match(app,/quoteDrafts\.clear\(\)/,'clearing planner inputs also clears saved-in-page quote drafts');
  assert.match(app,/What this estimate uses/);
});
