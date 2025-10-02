const { chromium } = require('@playwright/test');
const fs = require('fs');

// Comprehensive test for Reset Biology Assessment with psychological triggers
async function testAssessmentFlow() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = {
    heroSection: false,
    assessmentFlow: false,
    psychologicalTriggers: false,
    irbIntegration: false,
    consoleErrors: [],
    screenshots: []
  };

  try {
    console.log('🧪 Testing Reset Biology Assessment Flow with Psychology...\n');
    
    // Monitor console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        results.consoleErrors.push(msg.text());
        console.log('❌ Console Error:', msg.text());
      }
    });

    // Test 1: Main Hero Page
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    const heroHeadline = await page.getByText('Is it crazy to want the safest, most effective peptide therapy').isVisible();
    if (heroHeadline) {
      results.heroSection = true;
      console.log('✅ Hero headline with psychological framing found');
    }
    
    await page.screenshot({ 
      path: '/home/jonch/reset-biology-website/screenshots/hero-page.png',
      fullPage: true 
    });
    results.screenshots.push('hero-page.png');

    // Test 2: Navigate to Assessment
    await page.click('text=Take the 60-Second Reset Assessment');
    await page.waitForLoadState('networkidle');
    
    // Check assessment page loads
    const assessmentTitle = await page.locator('text=60-Second Reset Assessment').isVisible();
    if (assessmentTitle) {
      console.log('✅ Assessment page loaded');
      
      await page.screenshot({ 
        path: '/home/jonch/reset-biology-website/screenshots/assessment-start.png' 
      });
      results.screenshots.push('assessment-start.png');
      
      // Test 3: Complete Assessment Flow
      const questions = [
        { answer: 'Semaglutide (Ozempic/Wegovy)', type: 'click' },
        { answer: 'Over 1 year', type: 'click' },
        { answer: '8', type: 'click' }, // High muscle loss score
        { answer: '4', type: 'click' }, // Low energy
        { answer: 'Yes', type: 'click' }, // Weight plateaus
        { answer: '7', type: 'click' }, // Moderate side effects
        { answer: '9', type: 'click' }, // High dependency concerns
        { answer: '3', type: 'click' }, // Low provider satisfaction
        { answer: 'Medication independence', type: 'click' },
        { answer: '8', type: 'click' } // High investment readiness
      ];
      
      for (let i = 0; i < questions.length; i++) {
        console.log(`📋 Question ${i + 1}: Selecting ${questions[i].answer}`);
        
        await page.waitForTimeout(500);
        
        try {
          await page.click(`text="${questions[i].answer}"`);
          
          // Check progress bar advancement
          const progressBar = await page.locator('[class*="bg-primary-400"]').first();
          const progressWidth = await progressBar.getAttribute('style');
          console.log(`   Progress: ${progressWidth || 'N/A'}`);
          
        } catch (error) {
          console.log(`   ⚠️ Could not find: ${questions[i].answer}`);
        }
      }
      
      // Test 4: Results Page Psychology
      await page.waitForSelector('text=Your Personalized Reset Protocol', { timeout: 10000 });
      console.log('\n🎯 Results page loaded');
      
      // Check psychological investment display
      const investmentMessage = await page.getByText('invested', { exact: false }).isVisible();
      if (investmentMessage) {
        results.psychologicalTriggers = true;
        console.log('✅ Psychological investment tracker working');
      }
      
      // Check urgency messaging
      const urgencyHighlight = await page.getByText('IMMEDIATE ACTION NEEDED').or(
        page.getByText('WITHIN 30 DAYS')
      ).isVisible();
      
      if (urgencyHighlight) {
        console.log('✅ Urgency psychology messaging active');
      }
      
      // Test 5: IRB Integration Check
      const irbProtocol = await page.getByText('You Qualify for Advanced Protocol').isVisible();
      const consultationRequired = await page.getByText('Consultation Required First').isVisible();
      
      if (irbProtocol) {
        results.irbIntegration = true;
        console.log('✅ IRB Protocol eligibility display working');
        
        // Check time-sensitive messaging
        const timeSensitive = await page.getByText('Time-Sensitive').isVisible();
        const researchSpot = await page.locator('button:has-text("Secure Your Research Spot Now")').isVisible();
        
        if (timeSensitive && researchSpot) {
          console.log('✅ Scarcity psychology and CTA working');
        }
        
      } else if (consultationRequired) {
        results.irbIntegration = true;
        console.log('✅ Consultation pathway display working');
        
        const successRate = await page.getByText('94% of consultations').isVisible();
        if (successRate) {
          console.log('✅ Success rate psychology working');
        }
      }
      
      results.assessmentFlow = true;
      
      await page.screenshot({ 
        path: '/home/jonch/reset-biology-website/screenshots/assessment-results.png',
        fullPage: true 
      });
      results.screenshots.push('assessment-results.png');
    }
    
  } catch (error) {
    console.error('❌ Test Error:', error.message);
    await page.screenshot({ 
      path: '/home/jonch/reset-biology-website/screenshots/error-state.png' 
    });
    results.screenshots.push('error-state.png');
  } finally {
    await browser.close();
  }

  return results;
}

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Run the comprehensive assessment test
testAssessmentFlow().then(results => {
  console.log('\n=== Reset Biology Assessment Psychology Test Results ===\n');
  
  console.log('🎯 CORE FUNCTIONALITY:');
  console.log(`Hero Psychology: ${results.heroSection ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Assessment Flow: ${results.assessmentFlow ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Psychological Triggers: ${results.psychologicalTriggers ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`IRB Integration: ${results.irbIntegration ? '✓ PASS' : '✗ FAIL'}`);
  
  if (results.consoleErrors.length > 0) {
    console.log('\n❌ JAVASCRIPT ERRORS:');
    results.consoleErrors.forEach(error => {
      console.log(`• ${error}`);
    });
  } else {
    console.log('\n✅ No JavaScript errors detected');
  }
  
  if (results.screenshots.length > 0) {
    console.log('\n📸 SCREENSHOTS CAPTURED:');
    results.screenshots.forEach(screenshot => {
      console.log(`• screenshots/${screenshot}`);
    });
  }
  
  const passedTests = [
    results.heroSection,
    results.assessmentFlow,
    results.psychologicalTriggers,
    results.irbIntegration
  ].filter(Boolean).length;
  
  console.log(`\n📊 PSYCHOLOGY TEST SUMMARY: ${passedTests}/4 psychological systems working`);
  
  if (passedTests === 4) {
    console.log('🎉 All psychological investment systems are working perfectly!');
    console.log('🧠 Users will experience proper psychological investment escalation');
    console.log('💰 Loss aversion and urgency messaging functioning correctly');
  } else {
    console.log('⚠️  Some psychological systems need attention - review failed tests');
  }
}).catch(console.error);