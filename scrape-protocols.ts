import { chromium } from 'playwright';
import * as fs from 'fs';

interface ProtocolData {
  name: string;
  slug: string;
  url: string;
  whatItHelps: string[];
  howItWorks: string;
  peptidesIncluded: string[];
  protocolLength: string;
  dosing: string;
  timing: string;
  rawContent: string;
}

async function scrapeProtocols() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const protocols: ProtocolData[] = [];

  try {
    // Login
    console.log('Navigating to login page...');
    await page.goto('https://cellularpeptide.com/account/login');
    await page.waitForLoadState('networkidle');

    console.log('Filling in credentials...');
    await page.fill('input[type="email"]', 'jonchyatt@gmail.com');
    await page.fill('input[type="password"]', 'Sisklj53!!!');

    console.log('Submitting login form...');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Check if 2FA code is needed
    const currentUrl = page.url();
    if (currentUrl.includes('verify') || currentUrl.includes('code') || currentUrl.includes('2fa')) {
      console.log('⚠️  2FA code required. Please provide the code.');
      console.log('Current URL:', currentUrl);
      // Wait for manual code entry or we can add logic to accept code from stdin
      await page.waitForTimeout(30000); // 30 seconds to enter code manually
    }

    // Navigate to information page
    console.log('Navigating to information page...');
    await page.goto('https://cellularpeptide.com/pages/information-page');
    await page.waitForLoadState('networkidle');

    // Get all protocol links
    const protocolLinks = await page.$$eval('a[href*="/products/"]', links =>
      links.map(link => ({
        url: (link as HTMLAnchorElement).href,
        text: link.textContent?.trim() || ''
      }))
    );

    // Filter to only protocol packages
    const protocolUrls = protocolLinks
      .filter(link =>
        link.url.includes('protocol') ||
        link.url.includes('package') ||
        link.text.toLowerCase().includes('protocol')
      )
      .map(link => link.url)
      .filter((url, index, self) => self.indexOf(url) === index); // unique only

    console.log(`Found ${protocolUrls.length} protocol URLs`);

    // Scrape each protocol
    for (const url of protocolUrls) {
      try {
        console.log(`\nScraping: ${url}`);
        await page.goto(url);
        await page.waitForLoadState('networkidle');

        // Extract protocol name
        const name = await page.textContent('h1').catch(() => '') || '';
        const slug = url.split('/products/')[1] || '';

        // Try to find "What does the protocol help with?" section
        const whatItHelps: string[] = [];
        const helpSection = await page.locator('text=/What does the protocol help with/i').first().locator('..').textContent().catch(() => '');
        if (helpSection) {
          // Extract bullet points
          const bullets = await page.locator('text=/What does the protocol help with/i').first().locator('.. >> ul li, .. ~ ul li').allTextContents().catch(() => []);
          whatItHelps.push(...bullets);
        }

        // Try to find "How does the protocol work?" section
        let howItWorks = '';
        const workSection = await page.locator('text=/How does the protocol work/i').first().locator('..').textContent().catch(() => '');
        if (workSection) {
          howItWorks = workSection.replace(/How does the protocol work\?/i, '').trim();
        }

        // Extract peptides included
        const peptidesIncluded: string[] = [];
        const includesSection = await page.locator('text=/includes/i').first().locator('.. >> ul li, .. ~ ul li').allTextContents().catch(() => []);
        peptidesIncluded.push(...includesSection);

        // Extract protocol length
        const protocolLength = await page.locator('text=/protocol length|duration/i').first().locator('..').textContent().catch(() => '') || '';

        // Extract dosing
        const dosing = await page.locator('text=/dosing|dosage/i').first().locator('..').textContent().catch(() => '') || '';

        // Extract timing
        const timing = await page.locator('text=/timing/i').first().locator('..').textContent().catch(() => '') || '';

        // Get all text content as fallback
        const rawContent = await page.locator('main, .product, .product-info').first().textContent().catch(() => '') || '';

        protocols.push({
          name,
          slug,
          url,
          whatItHelps,
          howItWorks,
          peptidesIncluded,
          protocolLength,
          dosing,
          timing,
          rawContent: rawContent.substring(0, 5000) // Limit raw content
        });

        console.log(`✓ Scraped: ${name}`);
      } catch (error) {
        console.error(`Error scraping ${url}:`, error);
      }
    }

    // Save results
    const outputPath = 'protocol-details-scraped.json';
    fs.writeFileSync(outputPath, JSON.stringify(protocols, null, 2));
    console.log(`\n✓ Saved ${protocols.length} protocols to ${outputPath}`);

  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    await browser.close();
  }
}

scrapeProtocols();
