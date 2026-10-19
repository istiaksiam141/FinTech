const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const Finance = require('../lib/finance.js');
const PlannerResults = require('../lib/planner-results.js');
const ExchangeRates = require('../lib/exchange-rates.js');
const BangladeshBankRates = require('../lib/bangladesh-bank-rates.js');
const exchangeRateHandler = require('../api/exchange-rates.js');

const today = new Date(2026, 9, 13, 12, 0);
const quoteNow = new Date(2026, 9, 13, 12, 0);
function isoAfter(days) { const d=new Date(today);d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function profile(overrides={}) { return {homeCountry:'Bangladesh',destinationCountry:'United Kingdom',homeCur:'BDT',tuitionCur:'GBP',tuition:'8000',exchangeRate:'155',rateSource:'Student-entered bank quote ref 123',rateTimestamp:'2026-10-13T10:00',savings:'500000',income:'60000',expenses:'35000',committed:'10000',emergency:'50000',paymentFee:'0',deadline:isoAfter(60),...overrides}; }
function quote(overrides={}) { return {name:'Provider A',currency:'GBP',totalCost:'200000',fee:'1000',quotedRate:'155',recipientAmount:'1200',days:'3',timestamp:'2026-10-13T08:00',reference:'A-123',...overrides}; }
function compare(input,quotes,now=quoteNow) { return Finance.compareEnteredQuotes(input,quotes,now); }
test('planner results summary reuses the finance result for covered, shortfall, and no-date plans',()=>{
  const calculateSummary=overrides=>{
    const input=profile(overrides),result=Finance.calculateTuition(input,today);
    assert.equal(result.ok,true);
    const roadmap=Finance.buildContributionRoadmap(input,result,today);
    return {input,result,roadmap,summary:PlannerResults.summarize(result,roadmap,input.deadline)};
  };
  const covered=calculateSummary({savings:'1300000'});
  assert.equal(covered.summary.state,'covered');
  assert.equal(covered.summary.fundingGoalBdt,covered.result.requiredFunds);
  assert.equal(covered.summary.availableSavingsBdt,covered.result.usable);
  assert.equal(covered.summary.fundingGapBdt,0);
  assert.equal(covered.summary.scheduleAvailable,false);
  assert.match(covered.summary.message,/cover the estimated goal/);

  const shortfall=calculateSummary({});
  assert.ok(shortfall.summary.fundingGapBdt>0);
  assert.equal(shortfall.summary.state,'shortfall');
  assert.equal(shortfall.summary.shortfallBdt,shortfall.result.shortfall);
  assert.equal(shortfall.summary.scheduleAvailable,true);
  assert.deepEqual(shortfall.summary.contributionDates.map(item=>item.date),shortfall.roadmap.contributions.map(item=>item.dueDate));

  const noDates=calculateSummary({deadline:isoAfter(10)});
  assert.equal(noDates.roadmap.state,'no-contribution-dates');
  assert.equal(noDates.summary.state,'no-dates');
  assert.ok(noDates.summary.fundingGapBdt>0);
  assert.equal(noDates.summary.scheduleAvailable,false);
  assert.deepEqual(noDates.summary.contributionDates,[]);
  assert.match(noDates.summary.message,/No complete 30-day contribution date remains/);

  const shortfallCharts=PlannerResults.charts(shortfall.result,shortfall.roadmap);
  assert.equal(shortfallCharts.ok,true);
  assert.deepEqual(shortfallCharts.columns.map(item=>item.amountBdt),[shortfall.result.requiredFunds,shortfall.result.usable,shortfall.result.gap]);
  assert.equal(shortfallCharts.projectionConfirmed,true);
  assert.equal(shortfallCharts.coveredPercent+shortfallCharts.remainingPercent,100);
  assert.ok(shortfallCharts.remainingPercent>0);
  const coveredCharts=PlannerResults.charts(covered.result,covered.roadmap);
  assert.equal(coveredCharts.ok,true);
  assert.equal(coveredCharts.coveredPercent,100);
  assert.equal(coveredCharts.remainingPercent,0);
  assert.equal(coveredCharts.fundingGapBdt,0);
  assert.equal(PlannerResults.charts(noDates.result,noDates.roadmap).ok,true);
  const unconfirmedCharts=PlannerResults.charts(shortfall.result,null);
  assert.equal(unconfirmedCharts.ok,true);
  assert.equal(unconfirmedCharts.projectionConfirmed,false);
  assert.equal('projectedSavings' in unconfirmedCharts,false);
  assert.equal(PlannerResults.charts({...shortfall.result,requiredFunds:0,gap:0,fundedRatio:0},shortfall.roadmap).ok,false);
  assert.equal(PlannerResults.charts({...shortfall.result,rate:0},shortfall.roadmap).ok,false);
  assert.equal(PlannerResults.charts({...shortfall.result,usable:undefined},shortfall.roadmap).ok,false);
  assert.equal(PlannerResults.charts({...shortfall.result,ok:false},shortfall.roadmap).ok,false);

  const unconfirmed=PlannerResults.summarize(shortfall.result,null,shortfall.input.deadline);
  assert.equal(unconfirmed.state,'informational');
  assert.equal(unconfirmed.scheduleAvailable,false);
  assert.match(unconfirmed.message,/do not confirm whether the goal can be reached/);

  const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  for(const marker of ['Education Funding Goal','Available Savings','Funding Gap','resultSavingsPlanTitle','resultContributionDates','renderPlannerResultsSummary(input, result, roadmap']) assert.ok(app.includes(marker),`missing results UI marker ${marker}`);
  assert.match(app,/function renderPlannerResultsSummary\(input, result, roadmap, options\)[\s\S]*CampusBridgePlannerResults\.summarize\(result, roadmap, input\.deadline\)/);
  assert.match(app,/summary\.state === "informational" \? "Projection needs review"/);
  assert.match(app,/function renderFinancialCharts\(chartData, idPrefix\)/);
  assert.match(app,/renderFinancialCharts\(window\.CampusBridgePlannerResults\.charts\(result, roadmap\), "planner-results"\)/);
  assert.match(app,/page\.append\(summary,renderFinancialCharts\(chartData,"readiness-report"\)\)/);
  assert.match(app,/renderReadinessReport\(data,window\.CampusBridgePlannerResults\.charts\(result,latest\.roadmap\)\)/);
});
const apiNow = Date.UTC(2026,9,13,12,0,0);
function officialHtml(overrides={}) {
  const { date='13/10/2026', gbp='162.8300', gbpAsk='163.0484', usd='123.3000', usdAsk='123.4000', war='123.3600', cad='86.3264', cadAsk='86.4025' }=overrides;
  return `<html><p>FX Rate Sheet effective for ${date}</p><table><tr><th>Currency</th><th>Bid Rate</th><th>Ask Rate</th><th>WAR</th></tr><tr><td>USD</td><td>${usd}</td><td>${usdAsk}</td><td>${war}</td></tr></table><table><tr><th>Currency</th><th>Bid Rate</th><th>Ask Rate</th></tr><tr><td>EUR</td><td>137.5165</td><td>137.6774</td></tr><tr><td>GBP</td><td>${gbp}</td><td>${gbpAsk}</td></tr><tr><td>AUD</td><td>85.8045</td><td>85.8864</td></tr><tr><td>JPY</td><td>0.7771</td><td>0.7780</td></tr><tr><td>CAD</td><td>${cad}</td><td>${cadAsk}</td></tr><tr><td>SEK</td><td>12.2722</td><td>12.2979</td></tr><tr><td>SGD</td><td>96.2604</td><td>96.3611</td></tr><tr><td>CNH</td><td>18.4173</td><td>18.4325</td></tr><tr><td>INR</td><td>1.2873</td><td>1.2885</td></tr><tr><td>LKR</td><td>2.6815</td><td>2.6849</td></tr></table></html>`;
}
function bbResponse(overrides={}) { const row=(baseCurrency,bid,ask,weightedAverage=null,rateType='Bangladesh Bank cross rate')=>({baseCurrency,quoteCurrency:'BDT',bid,ask,weightedAverage,rateType});return {source:'Bangladesh Bank FX Rate Sheet',sourceUrl:BangladeshBankRates.SOURCE_URL,publicationDate:'2026-10-13',retrievedAt:'2026-10-13T12:00:00.000Z',rates:{USD:row('USD',123.3,123.4,123.36,'USD/BDT interbank rate'),EUR:row('EUR',137.5165,137.6774),GBP:row('GBP',162.83,163.0484),AUD:row('AUD',85.8045,85.8864),JPY:row('JPY',0.7771,0.7780),CAD:row('CAD',86.3264,86.4025),SEK:row('SEK',12.2722,12.2979),SGD:row('SGD',96.2604,96.3611),CNH:row('CNH',18.4173,18.4325),INR:row('INR',1.2873,1.2885),LKR:row('LKR',2.6815,2.6849)},...overrides}; }

test('all primary corridors have real-currency support without preset conversion rates',()=>{
  const wanted=['USD','EUR','GBP','AUD','JPY','CAD','SEK','SGD','CNH','INR','LKR'];
  assert.deepEqual(Finance.CURRENCIES,['BDT',...wanted]);
  assert.deepEqual(BangladeshBankRates.CURRENCIES,wanted);
  assert.deepEqual(ExchangeRates.DESTINATION_CURRENCIES,wanted);
  for(const c of wanted) assert.ok(Finance.CURRENCIES.includes(c));
  for(const unwanted of ['CNY','KRW','MYR']) assert.ok(!Finance.CURRENCIES.includes(unwanted),`${unwanted} is outside the requested set`);
  assert.match(Finance.CURRENCY_NAMES.CNH,/offshore/);
  const referenceRates={GBP:0.79,BDT:120};
  assert.ok(Math.abs(Finance.convert(100,'GBP','BDT',referenceRates)-100*120/.79)<1e-8);
  assert.throws(()=>Finance.convert(1,'GBP','BDT'),/source-identified rate/);
  assert.throws(()=>Finance.convert(1e12,'GBP','BDT',{GBP:1,BDT:2}),/supported maximum/);
});

test('requested currencies convert both ways using exact BDT-per-unit rates',()=>{
  const bdtPerUnit={BDT:1,USD:1/123.4,EUR:1/137.6774,GBP:1/163.0484,AUD:1/85.8864,JPY:1/0.778,CAD:1/86.4025,SEK:1/12.2979,SGD:1/96.3611,CNH:1/18.4325,INR:1/1.2885,LKR:1/2.6849};
  for(const [currency,rate] of [['USD',123.4],['EUR',137.6774],['GBP',163.0484],['AUD',85.8864],['JPY',0.778],['CAD',86.4025],['SEK',12.2979],['SGD',96.3611],['CNH',18.4325],['INR',1.2885],['LKR',2.6849]]){
    assert.ok(Math.abs(Finance.convert(rate,'BDT',currency,bdtPerUnit)-1)<1e-9,`${currency} BDT-to-foreign conversion`);
    assert.ok(Math.abs(Finance.convert(1,currency,'BDT',bdtPerUnit)-rate)<1e-9,`${currency} foreign-to-BDT conversion`);
  }
});

test('all requested destination corridors accept matching source-identified rates',()=>{
  for(const [destinationCountry,tuitionCur] of [['United States','USD'],['Euro area','EUR'],['United Kingdom','GBP'],['Australia','AUD'],['Japan','JPY'],['Canada','CAD'],['Sweden','SEK'],['Singapore','SGD'],['China','CNH'],['India','INR'],['Sri Lanka','LKR']]){
    const result=Finance.calculateTuition(profile({destinationCountry,tuitionCur,exchangeRate:'1',rateSource:`Manual ${tuitionCur} source`}),today);
    assert.equal(result.ok,true,`${destinationCountry} / ${tuitionCur} should be a supported manual-rate corridor`);
  }
  const chinaPlan=profile({destinationCountry:'China',tuitionCur:'CNH',exchangeRate:'18.5'});
  const chinaResult=Finance.calculateTuition(chinaPlan,today);
  assert.equal(chinaResult.tuitionHome,148000);
  assert.equal(Finance.buildReadinessReportData(chinaPlan,chinaResult).tuitionCurrencyName,'Chinese yuan (offshore)');
  assert.ok(Finance.calculateTuition(profile({destinationCountry:'China',tuitionCur:'USD'}),today).errors.length,'mismatched corridor currencies are rejected');
});

test('Bangladesh Bank HTML sheet parses published BDT-per-currency ask, bid, and USD WAR',()=>{
  const result=BangladeshBankRates.parseBangladeshBankPage(officialHtml(),new Date('2026-10-13T12:00:00Z'));
  assert.equal(result.publicationDate,'2026-10-13');
  assert.equal(result.rates.GBP.ask,163.0484);
  assert.equal(result.rates.GBP.bid,162.83);
  assert.equal(result.rates.USD.weightedAverage,123.36);
  assert.equal(result.rates.CAD.ask,86.4025);
  assert.equal(result.rates.JPY.ask,0.7780,'JPY is quoted in BDT per 1 JPY');
  assert.equal(result.rates.SGD.ask,96.3611);
  for(const currency of ['USD','EUR','GBP','AUD','JPY','CAD','SEK','SGD','CNH','INR','LKR']) assert.ok(result.rates[currency],`${currency} is present in the actual sheet`);
  assert.equal(result.rates.JPY.ask,0.7780,'JPY is quoted in BDT per 1 JPY');
  assert.equal(result.rates.CNH.baseCurrency,'CNH','the offshore currency code is preserved');
  assert.equal(result.rates.CNY,undefined,'the sheet provides CNH, not CNY');
  const validated=ExchangeRates.parseOfficialResponse(result,apiNow);
  assert.equal(validated.rates.GBP,163.0484);
  assert.equal(validated.rates.USD,123.4);
  assert.equal(Finance.calculateTuition(profile({exchangeRate:String(validated.rates.GBP)}),today).tuitionHome,1304387.2);
});

test('parser extracts current values from a saved fragment of the actual Bangladesh Bank HTML page',()=>{
  const html=fs.readFileSync(path.join(__dirname,'fixtures','bangladesh-bank-live-2026-10-13.html'),'utf8');
  const data=BangladeshBankRates.parseBangladeshBankPage(html,new Date('2026-10-13T12:00:00Z'));
  assert.equal(data.publicationDate,'2026-10-13');
  assert.deepEqual(data.rates,{USD:{bid:123.3,ask:123.4,weightedAverage:123.36,baseCurrency:'USD',quoteCurrency:'BDT',rateType:'USD/BDT interbank rate'},EUR:{bid:137.5165,ask:137.6774,weightedAverage:null,baseCurrency:'EUR',quoteCurrency:'BDT',rateType:'Bangladesh Bank cross rate'},GBP:{bid:162.83,ask:163.0484,weightedAverage:null,baseCurrency:'GBP',quoteCurrency:'BDT',rateType:'Bangladesh Bank cross rate'},AUD:{bid:85.8045,ask:85.8864,weightedAverage:null,baseCurrency:'AUD',quoteCurrency:'BDT',rateType:'Bangladesh Bank cross rate'},JPY:{bid:0.7771,ask:0.778,weightedAverage:null,baseCurrency:'JPY',quoteCurrency:'BDT',rateType:'Bangladesh Bank cross rate'},CAD:{bid:86.3264,ask:86.4025,weightedAverage:null,baseCurrency:'CAD',quoteCurrency:'BDT',rateType:'Bangladesh Bank cross rate'},SEK:{bid:12.2722,ask:12.2979,weightedAverage:null,baseCurrency:'SEK',quoteCurrency:'BDT',rateType:'Bangladesh Bank cross rate'},SGD:{bid:96.2604,ask:96.3611,weightedAverage:null,baseCurrency:'SGD',quoteCurrency:'BDT',rateType:'Bangladesh Bank cross rate'},CNH:{bid:18.4173,ask:18.4325,weightedAverage:null,baseCurrency:'CNH',quoteCurrency:'BDT',rateType:'Bangladesh Bank cross rate'},INR:{bid:1.2873,ask:1.2885,weightedAverage:null,baseCurrency:'INR',quoteCurrency:'BDT',rateType:'Bangladesh Bank cross rate'},LKR:{bid:2.6815,ask:2.6849,weightedAverage:null,baseCurrency:'LKR',quoteCurrency:'BDT',rateType:'Bangladesh Bank cross rate'}});
  assert.equal((html.match(/<table>/g)||[]).length,2,'fixture retains the source’s two current rate tables');
  assert.match(html,/<td>EUR<\/td>/,'the requested currencies are present in the source fragment');
  assert.equal(data.rates.EUR.ask,137.6774);
  assert.equal(data.rates.CNH.baseCurrency,'CNH');assert.equal(data.rates.CNH.quoteCurrency,'BDT');assert.equal(data.rates.CNY,undefined,'the actual source fragment has no CNY row');
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

test('Vercel cache hits preserve the original retrieval timestamp and expire at 24 hours',async()=>{
  const fetched=bbResponse();
  const cacheHit=await ExchangeRates.fetchLatestRates({nowMs:apiNow+23*60*60*1000,fetchImpl:async()=>({ok:true,status:200,headers:{get:name=>name==='x-vercel-cache'?'HIT':null},json:async()=>fetched})});
  assert.equal(cacheHit.stale,false);
  assert.equal(cacheHit.updatedAtMs,Date.parse(fetched.retrievedAt),'cache hits must preserve the successful upstream fetch timestamp');
  assert.equal(cacheHit.publicationDate,fetched.publicationDate,'the official effective date is retained');
  const expired=await ExchangeRates.fetchLatestRates({nowMs:apiNow+24*60*60*1000,fetchImpl:async()=>({ok:true,status:200,headers:{get:name=>name==='x-vercel-cache'?'STALE':null},json:async()=>fetched})});
  assert.equal(expired.stale,true,'the 24-hour cache expiry is treated as stale');
  assert.equal(expired.updatedAtMs,Date.parse(fetched.retrievedAt),'a stale cache hit does not pretend to be a new fetch');
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
  const originalError=console.error,logs=[];console.error=(...args)=>logs.push(args);
  globalThis.fetch=async()=>{throw new Error('network unavailable secret-value');};
  try { await exchangeRateHandler({},response); } finally { globalThis.fetch=originalFetch;console.error=originalError; }
  assert.equal(response.statusCode,502);
  assert.equal(response.headers['Cache-Control'],'no-store');
  assert.match(response.body.error,/temporarily unavailable/);
  assert.equal(response.body.rates,undefined,'errors never include invented fallback rates');
  assert.equal(response.body.detail,undefined,'client errors do not expose upstream details');
  assert.doesNotMatch(JSON.stringify(response.body),/secret-value|network unavailable/);
  assert.doesNotMatch(JSON.stringify(logs),/secret-value|network unavailable/);
});

test('Vercel endpoint returns validated source metadata and a 24-hour shared-cache policy on success',async()=>{
  const originalFetch=globalThis.fetch; let upstreamOptions;
  const response={headers:{},statusCode:null,body:null,setHeader(name,value){this.headers[name]=value;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
  globalThis.fetch=async(_url,options)=>{upstreamOptions=options;return {ok:true,status:200,headers:{get:()=> 'text/html; charset=utf-8'},text:async()=>fs.readFileSync(path.join(__dirname,'fixtures','bangladesh-bank-live-2026-10-13.html'),'utf8')};};
  try { await exchangeRateHandler({},response); } finally { globalThis.fetch=originalFetch; }
  assert.equal(response.statusCode,200);
  assert.equal(response.headers['Cache-Control'],'public, max-age=0, s-maxage=86400');
  assert.equal(response.headers['Content-Type'],'application/json; charset=utf-8');
  assert.equal(response.body.publicationDate,'2026-10-13');
  assert.match(response.body.retrievedAt,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,'the successful fetch timestamp is part of the cacheable response');
  assert.equal(response.body.rates.GBP.ask,163.0484);
  assert.equal(response.body.rates.USD.weightedAverage,123.36);
  assert.equal(upstreamOptions.headers.Authorization,undefined,'no upstream secret or API key is used');
});

test('expired Vercel cache requests can refresh the source timestamp, while invalid data is never cacheable',async()=>{
  const originalFetch=globalThis.fetch;
  const createResponse=()=>({headers:{},statusCode:null,body:null,setHeader(name,value){this.headers[name]=value;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
  let currentTime=new Date('2026-10-13T12:00:00.000Z');
  globalThis.fetch=async()=>({ok:true,status:200,headers:{get:()=> 'text/html'},text:async()=>officialHtml()});
  try {
    const first=createResponse(); await exchangeRateHandler({},first);
    currentTime=new Date('2026-10-14T12:00:01.000Z');
    const second=createResponse();
    // Control the route's fetch timestamp without changing the parser or its result.
    const realNow=globalThis.Date;
    globalThis.Date=class extends realNow { constructor(...args){super(...(args.length?args:[currentTime]));} static now(){return currentTime.getTime();} };
    try { await exchangeRateHandler({},second); } finally { globalThis.Date=realNow; }
    assert.notEqual(first.body.retrievedAt,second.body.retrievedAt,'a cache miss after expiry fetches a new source timestamp');
    assert.equal(second.headers['Cache-Control'],'public, max-age=0, s-maxage=86400');
    globalThis.fetch=async()=>({ok:true,status:200,headers:{get:()=> 'text/html'},text:async()=>'<html>invalid source response'.padEnd(150,'x')});
    const invalid=createResponse(); await exchangeRateHandler({},invalid);
    assert.equal(invalid.statusCode,502);
    assert.equal(invalid.headers['Cache-Control'],'no-store','invalid source data must never be cached');
    assert.equal(invalid.body.rates,undefined);
  } finally { globalThis.fetch=originalFetch; }
});

test('official response validation enforces direction, source, timestamps, stale state, and manual-safe errors',async()=>{
  const valid=ExchangeRates.parseOfficialResponse(bbResponse(),apiNow);
  assert.equal(valid.rates.GBP,163.0484);
  assert.equal(valid.rateDetails.CNH.currencyCode,'CNH');
  assert.equal(valid.rateDetails.CNH.baseCurrency,'CNH');
  assert.equal(valid.rateDetails.CNH.quoteCurrency,'BDT');
  assert.equal(valid.rateDetails.CNH.rateType,'Bangladesh Bank cross rate');
  assert.equal(valid.rates.CNY,undefined);
  const legacy=bbResponse();for(const row of Object.values(legacy.rates))delete row.rateType;
  assert.equal(ExchangeRates.parseOfficialResponse(legacy,apiNow).rateDetails.CNH.rateType,'Bangladesh Bank cross rate','existing 24-hour cache entries remain readable until expiry');
  assert.equal(valid.stale,false);
  assert.equal(ExchangeRates.parseOfficialResponse(bbResponse(),apiNow+23*60*60*1000).stale,false,'cached retrieval remains current within the 24-hour cache window');
  assert.equal(ExchangeRates.parseOfficialResponse(bbResponse(),apiNow+24*60*60*1000).stale,true,'cached retrieval expires at 24 hours');
  assert.throws(()=>ExchangeRates.parseOfficialResponse(bbResponse({publicationDate:''}),apiNow),/date/);
  assert.throws(()=>ExchangeRates.parseOfficialResponse(bbResponse({sourceUrl:'https://example.com/fake'}),apiNow),/source/);
  assert.throws(()=>ExchangeRates.parseOfficialResponse(bbResponse({retrievedAt:'2026-10-14T12:00:00Z'}),apiNow),/dates/);
  assert.throws(()=>ExchangeRates.parseOfficialResponse(bbResponse({rates:{...bbResponse().rates,GBP:{...bbResponse().rates.GBP,ask:Infinity}}}),apiNow),/GBP/);
  assert.throws(()=>ExchangeRates.parseOfficialResponse(bbResponse({rates:{...bbResponse().rates,GBP:{...bbResponse().rates.GBP,bid:0}}}),apiNow),/GBP/);
  assert.throws(()=>ExchangeRates.parseOfficialResponse(bbResponse({rates:{...bbResponse().rates,GBP:{...bbResponse().rates.GBP,ask:162}}}),apiNow),/GBP/);
  assert.throws(()=>ExchangeRates.parseOfficialResponse(bbResponse({rates:{...bbResponse().rates,CNH:{...bbResponse().rates.CNH,baseCurrency:'CNY'}}}),apiNow),/CNH/);
  assert.throws(()=>ExchangeRates.parseOfficialResponse(bbResponse({rates:{...bbResponse().rates,JPY:{...bbResponse().rates.JPY,rateType:''}}}),apiNow),/JPY/);
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

test('strict calendar dates reject normalization and count calendar days across DST',()=>{
  for(const deadline of ['2026-02-30','2026-13-01','2026-10-3','not-a-date']) {
    const result=Finance.calculateTuition(profile({deadline}),today);
    assert.equal(result.ok,false,`${deadline} must be rejected as an invalid calendar date`);
    assert.match(result.errors.join(' '),/valid calendar deadline/);
  }
  assert.equal(Finance.calculateTuition(profile({deadline:'2026-10-13'}),today).ok,false,'today is not a future deadline');
  assert.equal(Finance.calculateTuition(profile({deadline:'2026-10-14'}),today).daysRemaining,1);
  const script = `const F=require('./lib/finance.js');const p=${JSON.stringify(profile({deadline:'2026-03-15',rateTimestamp:'2026-03-07T10:00'}))};const t=new Date(2026,2,7,12);process.stdout.write(JSON.stringify(F.calculateTuition(p,t)));`;
  const result=JSON.parse(execFileSync(process.execPath,['-e',script],{cwd:path.join(__dirname,'..'),env:{...process.env,TZ:'America/New_York'},encoding:'utf8'}));
  assert.equal(result.ok,true);
  assert.equal(result.daysRemaining,8,'calendar-day count must not lose a day across spring DST');
  assert.equal(result.contributionCycles,0);
  assert.equal(Finance.calendarDaysBetween('2026-10-31','2026-11-01'),1,'fall DST also counts calendar days, not elapsed 24-hour periods');
  assert.equal(Finance.calendarDaysBetween('2026-02-30','2026-03-01'),null);
});

test('whole-BDT contribution schedule covers a non-divisible funding gap',()=>{
  const result=Finance.calculateTuition(profile({deadline:isoAfter(90),savings:'299999'}),today);
  assert.equal(result.ok,true);
  assert.equal(result.gap,1000001);
  const schedule=Finance.describeMonthlySavingsTarget(result);
  assert.equal(schedule.regularAmount,333333);
  assert.equal(schedule.finalAmount,333335);
  assert.ok(schedule.regularAmount*2+schedule.finalAmount>=result.gap);
  assert.equal(schedule.regularAmount*2+schedule.finalAmount,result.gap);
  const fractional=Finance.calculateTuition(profile({tuition:'1',exchangeRate:'1.1',savings:'0',emergency:'0',committed:'0',deadline:isoAfter(30)}),today);
  const fractionalSchedule=Finance.describeMonthlySavingsTarget(fractional);
  assert.equal(fractional.gap,1.1,'the underlying gap is not rounded to hide display rounding');
  assert.equal(fractionalSchedule.finalAmount,2,'whole BDT schedule must cover a fractional BDT gap');
});

test('dated contribution roadmap uses exact 30-day calendar dates and the adjusted final cycle',()=>{
  const input=profile({deadline:isoAfter(90),savings:'299999'});
  const result=Finance.calculateTuition(input,today);
  const inputBefore=structuredClone(input),resultBefore=structuredClone(result);
  const roadmap=Finance.buildContributionRoadmap(input,result,today);
  assert.equal(roadmap.ok,true);
  assert.deepEqual(roadmap.contributions.map(item=>item.dueDate),['2026-11-12','2026-12-12','2027-01-11']);
  assert.deepEqual(roadmap.contributions.map(item=>item.requiredContributionBdt),[333333,333333,333335]);
  assert.deepEqual(roadmap.contributions.map(item=>item.cumulativePlannedContributionsBdt),[333333,666666,1000001]);
  assert.deepEqual(roadmap.contributions.map(item=>item.remainingFundingGapBdt),[975001,950001,925001]);
  assert.equal(roadmap.contributions[0].projectedSavingsBalanceBdt,result.usable+25000);
  assert.equal(roadmap.requiredContributionTotalBdt,result.gap);
  assert.equal(roadmap.targetCanBeReachedByDeadline,false);
  assert.equal(roadmap.endingRemainingFundingGapBdt,result.shortfall);
  assert.deepEqual(input,inputBefore);
  assert.deepEqual(result,resultBefore);
});

test('dated roadmap separates required contributions from affordable projected capacity',()=>{
  const insufficientInput=profile({expenses:'60000'});
  const insufficient=Finance.calculateTuition(insufficientInput,today);
  const insufficientRoadmap=Finance.buildContributionRoadmap(insufficientInput,insufficient,today);
  assert.equal(insufficientRoadmap.ok,true);
  assert.equal(insufficientRoadmap.targetCanBeReachedByDeadline,false);
  assert.equal(insufficientRoadmap.monthlySavingsCapacityBdt,0);
  assert.ok(insufficientRoadmap.contributions.every(item=>item.projectedSavingsBalanceBdt===insufficient.usable));
  assert.ok(insufficientRoadmap.contributions.every(item=>item.remainingFundingGapBdt===insufficient.gap));
  assert.ok(insufficientRoadmap.contributions.every(item=>item.exceedsMonthlyCapacityBdt===item.requiredContributionBdt));

  const sufficientInput=profile({income:'500000',expenses:'0'});
  const sufficient=Finance.calculateTuition(sufficientInput,today);
  const sufficientRoadmap=Finance.buildContributionRoadmap(sufficientInput,sufficient,today);
  assert.equal(sufficientRoadmap.targetCanBeReachedByDeadline,true);
  assert.equal(sufficientRoadmap.endingRemainingFundingGapBdt,0);
  assert.equal(sufficientRoadmap.contributions.at(-1).remainingFundingGapBdt,0);
});

test('dated roadmap handles covered need, no contribution dates, impossible dates, and limits',()=>{
  const coveredInput=profile({savings:'1300000',deadline:isoAfter(60)});
  const covered=Finance.calculateTuition(coveredInput,today);
  const coveredRoadmap=Finance.buildContributionRoadmap(coveredInput,covered,today);
  assert.equal(coveredRoadmap.ok,true);
  assert.equal(coveredRoadmap.state,'covered');
  assert.equal(coveredRoadmap.targetCanBeReachedByDeadline,true);
  assert.equal(coveredRoadmap.requiredContributionTotalBdt,0);
  assert.deepEqual(coveredRoadmap.contributions,[]);

  const noDateInput=profile({deadline:isoAfter(29)});
  const noDates=Finance.calculateTuition(noDateInput,today);
  const noDateRoadmap=Finance.buildContributionRoadmap(noDateInput,noDates,today);
  assert.equal(noDateRoadmap.state,'no-contribution-dates');
  assert.equal(noDateRoadmap.targetCanBeReachedByDeadline,false);
  assert.match(noDateRoadmap.summary,/No complete 30-day contribution date/);
  assert.deepEqual(noDateRoadmap.contributions,[]);

  const invalidInput=profile({deadline:'2026-02-30'});
  assert.equal(Finance.buildContributionRoadmap(invalidInput,{ok:true,contributionCycles:3},today).ok,false);
  const overflow=Finance.buildContributionRoadmap(profile(),{ok:true,contributionCycles:2,gap:1e12+1,requiredFunds:1,usable:0,disposable:1,capacity:2,shortfall:1},today);
  assert.equal(overflow.ok,false);
  assert.match(overflow.errors.join(' '),/supported maximum/);
});

test('dated roadmap explains when its display horizon is exceeded without changing the projection',()=>{
  const input=profile({deadline:isoAfter((Finance.MAX_ROADMAP_CYCLES+1)*30),income:'1000',expenses:'0'});
  const result=Finance.calculateTuition(input,today);
  const roadmap=Finance.buildContributionRoadmap(input,result,today);
  assert.equal(result.ok,true);
  assert.equal(roadmap.ok,true);
  assert.equal(roadmap.state,'too-many-cycles');
  assert.equal(roadmap.contributionCycles,Finance.MAX_ROADMAP_CYCLES+1);
  assert.deepEqual(roadmap.contributions,[]);
  assert.equal(roadmap.projectedSavingsCapacityBdt,result.capacity);
  assert.equal(roadmap.endingRemainingFundingGapBdt,result.shortfall);
  assert.match(roadmap.summary,/too many dates to display/);
});

test('dated roadmap uses calendar dates across daylight-saving transitions',()=>{
  const input=profile({deadline:'2026-04-06',rateTimestamp:'2026-03-07T10:00'});
  const script=`const F=require('./lib/finance.js');const p=${JSON.stringify(input)};const today=new Date(2026,2,7,12);const r=F.calculateTuition(p,today);process.stdout.write(JSON.stringify(F.buildContributionRoadmap(p,r,today)));`;
  const roadmap=JSON.parse(execFileSync(process.execPath,['-e',script],{cwd:path.join(__dirname,'..'),env:{...process.env,TZ:'America/New_York'},encoding:'utf8'}));
  assert.equal(roadmap.ok,true);
  assert.equal(roadmap.contributionCycles,1);
  assert.equal(roadmap.contributions[0].dueDate,'2026-04-06');
});

test('tuition, fees, and projected contributions cannot exceed the supported BDT calculation range',()=>{
  const tuitionOverflow=Finance.calculateTuition(profile({tuition:'1000000000000',exchangeRate:'1000000000000'}),today);
  assert.equal(tuitionOverflow.ok,false);
  assert.match(tuitionOverflow.errors.join(' '),/Calculated BDT amounts exceed the supported maximum/);
  const feeOverflow=Finance.calculateTuition(profile({paymentFee:'1000000000000'}),today);
  assert.equal(feeOverflow.ok,false);
  const projectionOverflow=Finance.calculateTuition(profile({income:'1000000000000',expenses:'0',deadline:'9999-12-31'}),today);
  assert.equal(projectionOverflow.ok,false);
  assert.match(projectionOverflow.errors.join(' '),/Calculated BDT amounts exceed the supported maximum/);
});

test('optional study-abroad costs add once to tuition funding and preserve the existing plan when blank',()=>{
  const empty=profile();
  const original=Finance.calculateTuition(empty,today);
  const blank=Finance.calculateTuition({...empty,visaCost:'',applicationCost:'',flightCost:'',insuranceCost:'',documentCost:'',accommodationDeposit:'',initialSetupCost:'',otherOneTimeCosts:'',initialLivingMonths:'',monthlyRent:'',monthlyFood:'',monthlyTransport:'',monthlyUtilities:'',monthlyOtherLiving:''},today);
  assert.equal(blank.ok,true);
  assert.equal(blank.requiredFunds,original.requiredFunds);
  assert.equal(blank.gap,original.gap);
  const costs=Finance.calculateTuition(profile({paymentFee:'1200',visaCost:'5000',applicationCost:'3000',flightCost:'40000',insuranceCost:'6000',documentCost:'2500',accommodationDeposit:'20000',initialSetupCost:'8000',otherOneTimeCosts:'1500',initialLivingMonths:'3',monthlyRent:'30000',monthlyFood:'12000',monthlyTransport:'3000',monthlyUtilities:'4000',monthlyOtherLiving:'2000'}),today);
  assert.equal(costs.ok,true);
  assert.equal(costs.oneTimeCostsTotal,86000);
  assert.equal(costs.monthlyLivingCostsTotal,51000);
  assert.equal(costs.initialLivingCostsTotal,153000);
  assert.equal(costs.estimatedOtherCosts,240200,'the existing payment fee is included once, separately from categorized expenses');
  assert.equal(costs.requiredFunds,costs.tuitionHome+240200);
  assert.equal(costs.gap,Math.max(0,costs.requiredFunds-costs.usable));
  assert.equal(costs.contributionCycles,2,'the existing complete-30-day rule remains in effect');
  assert.equal(costs.capacity,original.capacity,'study cost estimates do not rewrite the current monthly budget surplus');
});

test('planning modes use isolated profiles and exclude other costs only in tuition mode',()=>{
  const input=profile({paymentFee:'1200',visaCost:'5000',flightCost:'40000',initialLivingMonths:'2',monthlyRent:'30000'});
  const before=structuredClone(input);
  const allCosts=Finance.profileForPlanningMode(input,Finance.PLANNING_MODES.ALL_COSTS);
  const tuitionOnly=Finance.profileForPlanningMode(input,Finance.PLANNING_MODES.TUITION_ONLY);
  assert.notEqual(allCosts,input);
  assert.notEqual(tuitionOnly,input);
  assert.equal(allCosts.visaCost,'5000');
  assert.equal(tuitionOnly.visaCost,'');
  assert.equal(tuitionOnly.monthlyRent,'');
  assert.equal(tuitionOnly.initialLivingMonths,'');
  assert.equal(tuitionOnly.paymentFee,'1200');
  assert.equal(tuitionOnly.savings,input.savings);
  const allResult=Finance.calculateTuition(allCosts,today);
  const tuitionResult=Finance.calculateTuition(tuitionOnly,today);
  const directModeResult=Finance.calculateTuition({...input,planningMode:Finance.PLANNING_MODES.TUITION_ONLY},today);
  assert.equal(allResult.estimatedOtherCosts,106200);
  assert.equal(tuitionResult.estimatedOtherCosts,1200);
  assert.equal(tuitionResult.requiredFunds,tuitionResult.tuitionHome+1200);
  assert.equal(directModeResult.estimatedOtherCosts,1200,'the core engine enforces a supplied mode too');
  assert.deepEqual(input,before,'calculating either mode must not mutate entered values');
  assert.throws(()=>Finance.profileForPlanningMode(input,'unknown'),/supported planning mode/);
});

test('tuition-only report identifies excluded costs without disclosing their entered values',()=>{
  const entered=profile({visaCost:'9876',monthlyRent:'5432',initialLivingMonths:'3'});
  const before=structuredClone(entered);
  const calculationProfile=Finance.profileForPlanningMode(entered,Finance.PLANNING_MODES.TUITION_ONLY);
  const result=Finance.calculateTuition(calculationProfile,today);
  const report=Finance.buildReadinessReportData(calculationProfile,result);
  assert.equal(report.planningModeName,'Tuition Only');
  assert.match(report.planningModeNote,/not a complete study-abroad budget/);
  assert.equal(report.otherEnteredCostsBdt,0);
  assert.ok(report.oneTimeCostItems.every(item=>item.amountBdt===null));
  assert.ok(report.monthlyLivingCostItems.every(item=>item.amountBdt===null));
  assert.equal(report.initialLivingMonths,null);
  assert.deepEqual(entered,before,'report creation must not mutate the entered profile');
  const text=Finance.buildFinancialReport(calculationProfile,result);
  assert.match(text,/Planning mode: Tuition Only/);
  assert.match(text,/Other one-time and initial living costs are excluded/);
  assert.match(text,/not a complete study-abroad budget/);
  assert.doesNotMatch(text,/Visa costs: 9876/);
});

test('optional cost validation rejects invalid, incomplete, and out-of-range scenarios',()=>{
  for(const value of ['-1','NaN','Infinity','1000000000001']){
    const result=Finance.calculateTuition(profile({flightCost:value}),today);
    assert.equal(result.ok,false,`invalid optional cost ${value}`);
    assert.match(result.errors.join(' '),/Flights/);
  }
  assert.match(Finance.validateProfile(profile({monthlyRent:'100',initialLivingMonths:''}),today).join(' '),/number of months/);
  assert.match(Finance.validateProfile(profile({initialLivingMonths:'1.5'}),today).join(' '),/whole number of months/);
  const overflow=Finance.calculateTuition(profile({visaCost:'600000000000',applicationCost:'500000000000'}),today);
  assert.equal(overflow.ok,false);
  assert.match(overflow.errors.join(' '),/Calculated BDT amounts exceed/);
  const livingOverflow=Finance.calculateTuition(profile({initialLivingMonths:'1000000000000',monthlyRent:'2'}),today);
  assert.equal(livingOverflow.ok,false);
  assert.match(livingOverflow.errors.join(' '),/Calculated BDT amounts exceed/);
});

test('readiness report maps optional study costs, currency equivalents, and existing fees without mutation',()=>{
  const input=profile({visaCost:'5000',paymentFee:'1200',initialLivingMonths:'2',monthlyRent:'10000',monthlyFood:'5000'});
  const result=Finance.calculateTuition(input,today);
  const before=structuredClone(input);
  const report=Finance.buildReadinessReportData(input,result);
  assert.equal(report.ok,true);
  assert.equal(report.paymentFeesBdt,1200);
  assert.equal(report.oneTimeCostsBdt,5000);
  assert.equal(report.monthlyLivingCostsBdt,15000);
  assert.equal(report.initialLivingCostsBdt,30000);
  assert.equal(report.otherEnteredCostsBdt,36200);
  assert.equal(report.totalRequiredFundsBdt,result.requiredFunds);
  assert.equal(report.destinationCurrencyCostEquivalent,36200/155);
  assert.equal(report.destinationCurrencyTotalEquivalent,result.requiredFunds/155);
  assert.equal(report.oneTimeCostItems.find(item=>item.label==='Flights').amountBdt,null);
  assert.deepEqual(input,before);
  const text=Finance.buildFinancialReport(input,result);
  assert.match(text,/Visa costs: 5000 BDT/);
  assert.match(text,/initial living estimate 30000 BDT/i);
  assert.match(text,/payment\/transfer fees 1200 BDT/);
});

test('stress scenarios recalculate rate, expense, and missed-contribution cases without mutating baseline inputs',()=>{
  const input=profile();
  const before=structuredClone(input);
  const baselineResult=Finance.calculateTuition(input,today);
  const baselineResultBefore=structuredClone(baselineResult);
  const stress=Finance.calculateStressScenarios(input,{expenseIncrease:10000,missedContributions:1},today);
  assert.equal(stress.ok,true);
  assert.deepEqual(input,before,'stress tests must not mutate the baseline input');
  assert.deepEqual(baselineResult,baselineResultBefore,'stress tests must not mutate an existing baseline result');
  const byName=Object.fromEntries(stress.scenarios.map(scenario=>[scenario.name,scenario]));
  assert.equal(byName.Baseline.fundingGap,800000);
  assert.equal(byName['Exchange rate +5%'].exchangeRate,162.75);
  assert.equal(byName['Exchange rate +5%'].fundingGap,862000);
  assert.equal(byName['Exchange rate +10%'].fundingGap,924000);
  assert.equal(byName['Increased monthly expenses'].monthlySurplus,15000);
  assert.equal(byName['Increased monthly expenses'].projectedCapacity,30000);
  assert.equal(byName['One missed contribution'].contributionCycles,1);
  assert.equal(byName['One missed contribution'].missedContributionAmount,25000,'missed amount is the scheduled 400,000 BDT installment capped at the 25,000 BDT available monthly surplus');
  assert.equal(byName['One missed contribution'].projectedCapacity,25000);
  assert.equal(byName['Increased expenses + one missed contribution'].projectedCapacity,15000);
  assert.equal(byName['Increased expenses + one missed contribution'].projectedShortfall,785000);
  assert.ok(byName['Increased monthly expenses'].contributionSchedule.regularAmount * (byName['Increased monthly expenses'].contributionCycles - 1) + byName['Increased monthly expenses'].contributionSchedule.finalAmount >= byName['Increased monthly expenses'].fundingGap);
  assert.equal(Finance.calculateStressScenarios(input,{expenseIncrease:-1},today).ok,false);
  for(const invalid of ['',null,'  ','100',Infinity,NaN]) assert.equal(Finance.calculateStressScenarios(input,{expenseIncrease:invalid},today).ok,false,`invalid expense increase ${String(invalid)} must be rejected`);
  assert.equal(Finance.calculateStressScenarios(input,{missedContributions:2},today).ok,false);
  const exceededRate=Finance.calculateStressScenarios(profile({tuition:'1',exchangeRate:'1000000000000'}),{},today);
  assert.equal(exceededRate.ok,false,'rate stress cases exceeding the supported calculated range must be rejected');
});

test('stress scenarios preserve zero-gap, zero-cycle, and negative-surplus boundaries',()=>{
  const covered=Finance.calculateStressScenarios(profile({savings:'1300000',emergency:'50000',committed:'10000'}),{missedContributions:1},today);
  assert.equal(covered.ok,true);
  assert.equal(covered.scenarios[0].fundingGap,0);
  assert.equal(covered.scenarios[0].monthlyTarget,0);
  const noCycles=Finance.calculateStressScenarios(profile({deadline:isoAfter(1)}),{missedContributions:1},today);
  assert.equal(noCycles.ok,true);
  assert.equal(noCycles.scenarios[0].contributionCycles,0);
  assert.equal(noCycles.scenarios[0].monthlyTarget,null);
  assert.equal(noCycles.scenarios[0].missedContributionAmount,0);
  assert.equal(noCycles.scenarios[0].projectedShortfall,noCycles.scenarios[0].fundingGap);
  const negative=Finance.calculateStressScenarios(profile({expenses:'70000'}),{expenseIncrease:5000,missedContributions:1},today);
  assert.equal(negative.ok,true);
  assert.equal(negative.scenarios[0].monthlySurplus,-10000);
  assert.equal(negative.scenarios[0].projectedCapacity,0);
  assert.equal(negative.scenarios.find(scenario=>scenario.name==='One missed contribution').missedContributionAmount,0,'a negative surplus means there is no contribution to miss');
});

test('financial report includes inputs, formulas, provenance, adjusted schedule, and available stress results',()=>{
  const input=profile({deadline:isoAfter(90),savings:'299999'});
  const result=Finance.calculateTuition(input,today);
  const stress=Finance.calculateStressScenarios(input,{expenseIncrease:5000,missedContributions:1},today);
  const report=Finance.buildFinancialReport(input,result,{generatedAt:new Date('2026-10-13T12:00:00'),stressScenarios:stress.scenarios});
  assert.match(report,/monthly income 60000 BDT/);
  assert.match(report,/tuition in BDT = tuition × rate/);
  assert.match(report,/Student-entered bank quote ref 123/);
  assert.match(report,/timestamp \(local\): 2026-10-13T10:00/);
  assert.match(report,/333333 BDT for 2 cycle\(s\), then 333335 BDT in the final cycle/);
  assert.match(report,/Exchange rate \+5%/);
  assert.match(report,/Exchange rate \+10%/);
  assert.match(report,/assumed missed amount 20000 BDT/);
  assert.match(report,/Increased monthly expenses/);
  assert.match(report,/One missed contribution/);
  assert.match(report,/projected shortfall/);
});

test('readiness report maps validated plan data, optional details, and stress results without mutation',()=>{
  const input=profile({deadline:isoAfter(90),savings:'299999'});
  const result=Finance.calculateTuition(input,today);
  const stress=Finance.calculateStressScenarios(input,{expenseIncrease:5000,missedContributions:1},today);
  const roadmap=Finance.buildContributionRoadmap(input,result,today);
  const inputBefore=structuredClone(input),resultBefore=structuredClone(result);
  const report=Finance.buildReadinessReportData(input,result,{reportDate:new Date(2026,9,13),stressScenarios:stress.scenarios,roadmap});
  assert.equal(report.ok,true);
  assert.equal(report.branding,'CampusBridge AI');
  assert.equal(report.title,'Student Financial Readiness Report');
  assert.equal(report.studentName,null,'name is omitted unless explicitly provided');
  assert.equal(report.reportDate,'2026-10-13');
  assert.equal(report.tuitionEstimateBdt,result.tuitionHome);
  assert.equal(report.totalRequiredFundsBdt,result.requiredFunds);
  assert.equal(report.fundingGapBdt,result.gap);
  assert.equal(report.monthlyContributionTargetBdt,result.monthlyTarget);
  assert.equal(report.contributionCycles,result.contributionCycles);
  assert.equal(report.rateSource,input.rateSource);
  assert.equal(report.stressScenarios.length,stress.scenarios.length);
  assert.equal(report.contributionRoadmap.firstDueDate,roadmap.contributions[0].dueDate);
  assert.equal(report.contributionRoadmap.lastDueDate,roadmap.contributions.at(-1).dueDate);
  assert.equal(report.contributionRoadmap.requiredContributionTotalBdt,result.gap);
  assert.deepEqual(input,inputBefore);
  assert.deepEqual(result,resultBefore);
  assert.equal(Finance.buildReadinessReportData(input,result,{studentName:'  Alex Student  '}).studentName,'Alex Student');
  assert.deepEqual(Finance.buildReadinessReportData(input,result).stressScenarios,[],'stress results are omitted unless available');
});

test('readiness report clearly maps covered need, no contribution dates, and zero disposable income',()=>{
  const coveredInput=profile({savings:'1300000',emergency:'50000',committed:'10000',deadline:isoAfter(1)});
  const covered=Finance.calculateTuition(coveredInput,today);
  const coveredReport=Finance.buildReadinessReportData(coveredInput,covered);
  assert.equal(coveredReport.fundingGapBdt,0);
  assert.equal(coveredReport.monthlyContributionTargetBdt,0);
  assert.equal(coveredReport.contributionSchedule.state,'covered');
  assert.match(coveredReport.nextSteps[0],/cover the estimated need/);

  const noDatesInput=profile({deadline:isoAfter(29)});
  const noDates=Finance.calculateTuition(noDatesInput,today);
  const noDatesReport=Finance.buildReadinessReportData(noDatesInput,noDates);
  assert.equal(noDatesReport.contributionCycles,0);
  assert.equal(noDatesReport.monthlyContributionTargetBdt,null);
  assert.equal(noDatesReport.contributionSchedule.state,'unavailable');
  assert.equal(noDatesReport.projectedShortfallBdt,noDatesReport.fundingGapBdt);
  assert.match(noDatesReport.nextSteps[0],/No complete 30-day contribution cycle/);

  const noSurplusInput=profile({expenses:'60000'});
  const noSurplus=Finance.calculateTuition(noSurplusInput,today);
  const noSurplusReport=Finance.buildReadinessReportData(noSurplusInput,noSurplus);
  assert.equal(noSurplusReport.monthlySurplusBdt,0);
  assert.equal(noSurplusReport.projectedSavingsCapacityBdt,0);
  assert.equal(noSurplusReport.projectedShortfallBdt,noSurplusReport.fundingGapBdt);
  assert.ok(noSurplusReport.nextSteps.some(step=>step.includes('does not leave a positive monthly surplus')));
});

test('readiness report rejects missing or invalid calculation results instead of inventing data',()=>{
  assert.equal(Finance.buildReadinessReportData(null,null).ok,false);
  assert.equal(Finance.buildReadinessReportData(profile(),{ok:false}).ok,false);
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
  assert.equal(guidance.message,'Your current usable savings cover the estimated study costs. No additional monthly savings are needed for this target.');
  const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  assert.ok(app.includes('target.state==="covered"?target.message'));
});

test('missing, zero, negative, or unreferenced rates and invalid monetary inputs are rejected',()=>{
  assert.match(Finance.validateProfile(profile({exchangeRate:''}),today).join(' '),/Exchange rate/);
  assert.match(Finance.validateProfile(profile({exchangeRate:'-1'}),today).join(' '),/cannot be negative/);
  for(const value of ['0','NaN','Infinity','1e13']) assert.ok(Finance.validateProfile(profile({exchangeRate:value}),today).length>0,`invalid exchange rate ${value} should be rejected`);
  assert.match(Finance.validateProfile(profile({rateSource:''}),today).join(' '),/source/);
  assert.match(Finance.validateProfile(profile({rateTimestamp:''}),today).join(' '),/timestamp/);
  for(const value of ['2026-02-30T10:00','2026-10-13T25:00','2026-10-13T10:60','2026-10-13']) {
    assert.match(Finance.validateProfile(profile({rateTimestamp:value}),today).join(' '),/valid exchange-rate timestamp/);
  }
  assert.match(Finance.validateProfile(profile({rateTimestamp:'2026-10-13T12:01'}),today).join(' '),/cannot be in the future/);
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

test('quote comparison accepts custom provider names and limits their length without changing quote values',()=>{
  const input={amount:'200000',to:'GBP',sort:'cost'};
  const original=quote({name:'Community Bank'});
  const customNames=['A trusted bank','Remittance Service Ltd.','Mobile Financial Service'];
  for(const name of customNames){
    const result=compare(input,[quote({name})]);
    assert.equal(result.available[0].quote.name,name);
  }
  const renamed=compare(input,[{...original,name:'Custom MFS'}]).available[0];
  assert.equal(renamed.quote.name,'Custom MFS');
  for(const key of ['currency','totalCost','fee','quotedRate','recipientAmount','days','timestamp','reference']) {
    assert.equal(renamed.quote[key],original[key],`${key} must remain unchanged when a provider is renamed`);
  }
  assert.equal(renamed.totalCost,Number(original.totalCost));
  assert.equal(renamed.recipientAmount,Number(original.recipientAmount));
  assert.equal(compare(input,[quote({name:'   '})]).available.length,0,'blank names remain invalid');
  const tooLong=compare(input,[quote({name:'x'.repeat(81)})]);
  assert.equal(tooLong.available.length,0);
  assert.match(tooLong.unavailable[0].reason,/80 characters or fewer/);
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
  const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'planner.html'),'utf8'),css=fs.readFileSync(path.join(root,'styles','site.css'),'utf8'),ui=html+css,app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  for(const code of ['USD','EUR','GBP','AUD','JPY','CAD','SEK','SGD','CNH','INR','LKR']) assert.ok(html.includes(`BDT → ${code}`),`${code} is selectable as a destination`);
  assert.doesNotMatch(html,/BDT → (?:CNY|KRW|MYR)/,'the corridor selector contains only the requested currency set');
  for(const marker of ['id="exchangeRate"','id="rateSource"','id="rateTimestamp"','id="rateTimestampHint"','id="rateTimestampTrigger"','id="rateTimestampCalendar"','id="rateTimestampTime"','id="useCurrentRateTimestamp"','id="refreshExchangeRate"','id="useExchangeRate"','id="exchangeRateStatus"','id="providerQuoteForms"','id="deadlineHint"','id="deadlineTrigger"','id="deadlineCalendar"','role="grid"','aria-haspopup="dialog"','.formSection .fieldGrid>label{align-self:start;align-content:start}','.timestampControl{display:flex;width:100%;min-width:0}','#providerQuoteForms .quoteTimestampLabel{grid-column:1/-1}','.calendarDay.isToday:not(.isSelected){background:#eaf6f0','.customSelect{position:relative;width:100%;min-width:0}','.customSelectOption[aria-selected=true]::after{content:"✓"','https://www.bb.org.bd/en/index.php/econdata/exchangerate','convera.com/students/faq','pay.flywire.com','id="applyScenario"','id="resetScenario"','id="stressExpenseIncrease"','id="runStressTest"','id="clearStressTest"','id="stressResults"','id="readinessStudentName"','id="generateReadinessReport"','id="readinessReportPreview"','id="printReadinessReport"','id="closeReadinessReport"','aria-live="polite"','@page{size:A4 portrait','@media print','id="exportReport"','src="lib/exchange-rates.js"']) assert.ok(ui.includes(marker),`missing ${marker}`);
  for(const marker of ['@keyframes globeTurn','animation:globeTurn 34s linear infinite','<div class="globeMap">','<g class="globeLand">','<g class="globeGrid">','.heroVisual .orb3d{width:min(430px,82vw)}','.heroVisual .tileB{right:-4%}']) assert.ok(ui.includes(marker),`missing ${marker}`);
  assert.doesNotMatch(html,/class="(?:orbit|node)(?:\s|")/,'the hero illustration no longer uses atom-style orbiting particles');
  assert.ok(app.includes('data-field="timestamp" type="datetime-local"'),'quote timestamps remain date-time inputs for existing validation and comparison');
  assert.equal(fs.existsSync(path.join(root,'api','exchange-rates.js')),true);
  assert.ok(fs.readFileSync(path.join(root,'docs','financial-algorithms.md'),'utf8').includes('Bangladesh Bank published rates'));
  const endpoint=fs.readFileSync(path.join(root,'api','exchange-rates.js'),'utf8');
  assert.match(endpoint,/s-maxage=\$\{CACHE_TTL_SECONDS\}/);
  assert.match(endpoint,/status\(502\)/);
  assert.doesNotMatch(html,/value="(?:12000|450000|80000|52000|200000)"/);
  assert.doesNotMatch(app,/fictional|illustrative/);
  assert.ok(app.includes('Finance.compareEnteredQuotes'));
  assert.match(app,/profileForPlanningMode\(enteredProfile,enteredProfile\.planningMode\);[\s\S]*const stress=Finance\.calculateStressScenarios\(\{\.\.\.input\},options\);[\s\S]*renderStressTestResults\(stress,input\.tuitionCur,input\.planningMode\)/,'stress tests call the deterministic engine with a mode-adjusted copy of current inputs');
  assert.match(app,/byId\("runStressTest"\)\.addEventListener\("click",runStressTest\)/,'students can run stress tests from the existing what-if section');
  assert.match(app,/description\.textContent=value/,'stress-test results are rendered as text, not interpreted HTML');
  assert.match(app,/Finance\.buildReadinessReportData\(/,'the report maps the validated finance result through the shared finance module');
  assert.match(fs.readFileSync(path.join(root,'js','site.js'),'utf8'),/\["roadmap", "Savings roadmap", "\/roadmap\.html", "route"\]/,'the savings-roadmap navigation points to its dedicated page and uses its route icon');
  assert.match(html,/id="roadmap"/,'the existing integrated roadmap remains available in the planner');
  assert.match(app,/if\(!roadmap\?\.ok\)\{section\.hidden=false;summary\.textContent=/,'the roadmap navigation target remains visible before a valid plan is calculated');
  assert.match(app,/byId\("printReadinessReport"\)\.addEventListener\("click",\(\)=>window\.print\(\)\)/,'the report uses the native browser print dialog');
  assert.match(app,/reportAction\.className = "resultsReportAction"[\s\S]*reportButton\.textContent = "Create print-ready report"[\s\S]*reportButton\.addEventListener\("click", generateReadinessReport\)/,'a completed calculation exposes the existing A4 report flow directly in its results');
  assert.match(css,/\.resultsReportAction\{display:flex/,'the results report action has a responsive, styled container');
  assert.match(html,/id="readinessReportPreview"[^>]*hidden/,'the report preview is hidden until the student generates it');
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
  assert.match(app,/summary\.daysRemaining === 1 \? "day" : "days"/,'deadline results use correct singular and plural labels');
  assert.match(app,/Finance\.calendarDaysBetween\(localDate\(today\), input\.value\)/,'deadline hint uses the same calendar-day calculation as the finance engine');
  assert.match(app,/byId\("deadline"\)\.addEventListener\("change"/,'selecting a deadline updates the displayed plan');
  const fetchHandler=app.slice(app.indexOf('async function refreshExchangeRate()'),app.indexOf('function useFetchedExchangeRate()'));
  assert.equal(fetchHandler.includes('byId("exchangeRate").value ='),false,'fetching only previews the rate and does not replace the student\'s current value');
  new vm.Script(app,{filename:'app.js'});
});

test('student-facing privacy notices, progressive quote entry, and technical disclosures are present',()=>{
  const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'planner.html'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  for(const marker of ['id="privacy"','Supported planning and quote questions are answered locally. General questions are sent to the AI assistant.','Your financial form and quote entries are not included','id="addQuoteProvider"','What will the downloaded report contain?','id="requirements"','Technical integration readiness','formal privacy/terms documents are not configured']) assert.ok(html.includes(marker),`missing ${marker}`);
  assert.match(app,/providerDefs\.slice\(0,\s*visibleProviderCount\)/,'quote forms are shown progressively');
  assert.match(app,/quoteDrafts\.clear\(\)/,'clearing planner inputs also clears saved-in-page quote drafts');
  assert.match(app,/What this estimate uses/);
});

test('study-cost inputs are optional, connected to the profile, and represented in the plan summary',()=>{
  const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'planner.html'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),summary=fs.readFileSync(path.join(root,'lib','planner-results.js'),'utf8');
  for(const id of ['visaCost','applicationCost','flightCost','insuranceCost','documentCost','accommodationDeposit','initialSetupCost','otherOneTimeCosts','initialLivingMonths','monthlyRent','monthlyFood','monthlyTransport','monthlyUtilities','monthlyOtherLiving']){
    assert.ok(html.includes(`id="${id}"`),`missing optional study-cost input ${id}`);
    assert.ok(app.includes(`"${id}"`),`profile does not read study-cost input ${id}`);
  }
  assert.match(app,/Education Funding Goal/);
  assert.match(app,/All Study-Abroad Costs includes only additional estimates entered/);
  assert.match(app,/Tuition Only/);
  assert.match(app,/Dated contribution roadmap/);
  assert.match(app,/buildContributionRoadmap/);
  assert.match(app,/destinationTotal/);
  assert.match(app,/Available Savings/);
  assert.match(summary,/fundingGoalBdt: result\.requiredFunds/);
  assert.match(app,/Rate verification/);
});

test('planner exposes accessible default mode choices and updates reports and stress scenarios by mode',()=>{
  const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'planner.html'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  assert.match(html,/name="planningMode" value="all-costs" checked/);
  assert.match(html,/name="planningMode" value="tuition-only"/);
  assert.match(html,/Estimate your complete study-abroad budget and find out how much funding you still need\./);
  assert.match(html,/Calculate your tuition costs and the funding gap for tuition\./);
  assert.match(app,/profileForPlanningMode\(enteredProfile,enteredProfile\.planningMode\)/);
  assert.match(app,/byId\("planningModeNote"\)/);
  assert.match(app,/Excluded in Tuition Only mode/);
  assert.match(app,/profileForm"\)\.addEventListener\("reset"/);
});
