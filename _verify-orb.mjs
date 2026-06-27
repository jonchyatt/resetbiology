import { chromium } from 'playwright';
const URL = 'https://www.resetbiology.com/pitch-defender/vocal-trainer-3';
const DIR = 'C:/Users/jonch/AppData/Local/Temp/claude/C--Users-jonch-Projects-jarvis/13120a95-ac69-4aa6-994c-ece6f14a7445/scratchpad';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DEADLINE = Date.now() + 6 * 60 * 1000;
const browser = await chromium.launch();

async function attempt() {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  const out = {};
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2800);
    const ball = page.locator('button[title^="Tap → controls"]');
    out.deployed = (await ball.count()) > 0;
    if (!out.deployed) { await ctx.close(); return out; }

    out.blurbGone = (await page.locator('text=Three independent channels').count()) === 0;
    const box = await ball.first().boundingBox();
    out.orbSize = box ? { w: Math.round(box.width), h: Math.round(box.height) } : null;
    await page.screenshot({ path: `${DIR}/vt3-orb-collapsed.png` });

    // SHORT press → transport menu (Loop button appears)
    await ball.first().click();
    await page.waitForTimeout(500);
    out.shortPressTransport = (await page.locator('button[title="Loop whole song"]').count()) > 0;
    await page.screenshot({ path: `${DIR}/vt3-orb-shortpress.png` });
    // collapse again
    await ball.first().click();
    await page.waitForTimeout(400);

    // LONG press → nav menu ("Jump to")
    const b2 = await ball.first().boundingBox();
    if (b2) {
      await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(680);
      await page.mouse.up();
      await page.waitForTimeout(400);
    }
    out.longPressNav = (await page.locator('text=Jump to').count()) > 0;
    out.navHasLibrary = (await page.locator('text=📚 Library').count()) > 0;
    await page.screenshot({ path: `${DIR}/vt3-orb-longpress.png` });
    // close nav by tapping a blank area
    await page.mouse.click(180, 300);
    await page.waitForTimeout(300);

    // DOUBLE tap → Mixing Desk + tempo inside
    await ball.first().dblclick();
    await page.waitForTimeout(700);
    out.doubleTapDesk = (await page.locator('text=🎛️ Mixing Desk').count()) > 0;
    out.tempoInDesk = (await page.locator('text=🐢 Tempo').count()) > 0;
    await page.screenshot({ path: `${DIR}/vt3-orb-desk.png` });
  } catch (e) { out.fatal = String(e).slice(0, 150); }
  out.errors = errors.slice(0, 5);
  await ctx.close();
  return out;
}

let res = { deployed: false };
while (Date.now() < DEADLINE) {
  res = await attempt();
  if (res.deployed) break;
  await sleep(20000);
}
await browser.close();
console.log('ORB_VERIFY ' + JSON.stringify(res));
