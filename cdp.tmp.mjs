// Authed failure-path + completion receipts via EH (:9226) CDP connect
import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT='C:/Users/jonch/Projects/jarvis/data/rb-portal-modules/runtime-logs/visual-2026-07-19-da7c';
const log=[]; const say=m=>{log.push(m);console.log(m)};
const browser=await chromium.connectOverCDP('http://127.0.0.1:9226');
const ctx=browser.contexts()[0];
const p=await ctx.newPage();
// seed a completed quiz BEFORE results loads
await p.goto('https://resetbiology.com/quiz',{waitUntil:'domcontentloaded'});
await p.evaluate(()=>{
  const q={preferredName:'Receipt Probe',email:'',guidanceLevel:7,freeToolsInterest:['nutrition'],assistanceLevel:'comprehensive',successDefinition:'stay strong for my family',commitmentLevel:8,whyChange:'health',processPriorities:['sustainability'],desiredFeelings:['energized'],peptideChoice:'retatrutide',partnership:'yes',metabolicControl:'possible',priorities:['health'],successJustification:'I want to hike with my kids at 70',completedAt:new Date().toISOString()};
  localStorage.setItem('resetbiology_quiz_responses',JSON.stringify(q));
});
say('seeded completed quiz in authed profile');
// force sync 500
await p.route('**/api/quiz/sync',r=>r.fulfill({status:500,contentType:'application/json',body:'{}'}));
await p.goto('https://resetbiology.com/quiz/results',{waitUntil:'networkidle'});
await p.waitForTimeout(1500);
const banner=await p.locator('text=syncing them to your account failed').count();
say('forced-500: failure banner visible = '+banner);
await p.screenshot({path:`${OUT}/authed-results-forced500.png`});
// un-intercept, retry
await p.unroute('**/api/quiz/sync');
const retry=p.locator('button',{hasText:'Retry sync'});
if(await retry.count()){await retry.click(); await p.waitForTimeout(2500);
  say('after retry: banner remaining = '+await p.locator('text=syncing them to your account failed').count());
  await p.screenshot({path:`${OUT}/authed-results-retry-ok.png`});}
// results-page controls
const ctrls=p.locator('a[href^="/"]:visible');
for(let i=0;i<await ctrls.count();i++){say('results control: '+(await ctrls.nth(i).innerText().catch(()=>'')).trim().slice(0,25)+' → '+await ctrls.nth(i).getAttribute('href'));}
// cleanup: remove probe quiz data from Jon's profile localStorage
await p.evaluate(()=>localStorage.removeItem('resetbiology_quiz_responses'));
say('probe localStorage cleaned');
await p.close();
fs.writeFileSync(`${OUT}/authed-sync-failure-receipt.txt`,log.join('\n')+'\n');
say('CDP_DONE');
