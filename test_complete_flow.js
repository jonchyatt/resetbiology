const { chromium } = require('@playwright/test');

async function testCompleteUserFlow() {
  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = {
    heroConversion: false,
    assessmentPsychology: false,
    irbHandoff: false,
    psychologicalTriggers: [],
    consoleErrors: [],
    screenshots: []
  };

  try {
    console.log('🚀 Testing Complete Reset Biology User Flow...\n');
    
    // Monitor console for errors and logs
    page.on('console', msg => {
      if (msg.type() === 'error') {
        results.consoleErrors.push(msg.text());
        console.log('❌ Console Error:', msg.text());
      } else if (msg.text().includes('IRB')) {
        console.log('🏥 IRB Log:', msg.text());
      }
    });

    // Step 1: Hero Page Psychology
    console.log('📍 Step 1: Testing Hero Page Psychology...');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Check for psychological framing
    const heroFrame = await page.getByText('Is it crazy to want').isVisible();
    const trustMessage = await page.getByText('earn their living from hospitals, not from your wallet').isVisible();
    
    if (heroFrame && trustMessage) {
      results.heroConversion = true;
      results.psychologicalTriggers.push('Hero psychological framing active');
      console.log('✅ Hero psychology: Authority + Trust positioning working');
    }
    
    await page.screenshot({ 
      path: '/home/jonch/reset-biology-website/screenshots/01-hero-psychology.png',
      fullPage: true 
    });
    results.screenshots.push('01-hero-psychology.png');

    // Step 2: Assessment Entry Psychology  
    console.log('\n📍 Step 2: Testing Assessment Entry Psychology...');
    await page.click('text=Take the 60-Second Reset Assessment');
    await page.waitForLoadState('networkidle');
    
    // Check timer creates urgency
    const timer = await page.getByText('60-Second Reset Assessment').isVisible();
    const progressBar = await page.locator('.bg-primary-400').first().isVisible();
    
    if (timer && progressBar) {
      results.psychologicalTriggers.push('Time pressure + progress visualization');
      console.log('✅ Assessment entry: Timer urgency + progress bar working');
    }
    
    await page.screenshot({ 
      path: '/home/jonch/reset-biology-website/screenshots/02-assessment-start.png' 
    });
    results.screenshots.push('02-assessment-start.png');

    // Step 3: Complete Assessment (High Score Profile)
    console.log('\n📍 Step 3: Completing High-Score Assessment Profile...');
    
    const highScoreAnswers = [
      'Semaglutide (Ozempic/Wegovy)', // Current dangerous medication
      'Over 1 year', // Long dependency  
      '9', // High muscle loss - critical trigger
      '3', // Low energy - suffering indicator
      'Yes', // Weight plateaus - ineffective current treatment
      '8', // High side effects - pain motivation
      '10', // Maximum dependency concerns - fear motivation  
      '2', // Poor provider support - abandonment fear
      'Medication independence', // Goal alignment
      '9' // High investment readiness - commitment signal
    ];
    
    for (let i = 0; i < highScoreAnswers.length; i++) {
      await page.waitForTimeout(300);
      
      try {
        await page.click(`text="${highScoreAnswers[i]}"`);
        console.log(`   ✓ Q${i + 1}: ${highScoreAnswers[i]}`);
        
        // Check psychological investment builds
        if (i === 2) { // Muscle loss question
          results.psychologicalTriggers.push('Critical muscle loss question answered');
        }
        if (i === 6) { // Dependency concerns
          results.psychologicalTriggers.push('Maximum dependency fear triggered');
        }
        
      } catch (error) {
        console.log(`   ⚠️ Could not find: ${highScoreAnswers[i]}`);
      }
    }
    
    // Step 4: Results Page Psychology
    console.log('\n📍 Step 4: Testing Results Psychology...');
    await page.waitForSelector('text=Your Personalized Reset Protocol', { timeout: 10000 });
    
    // Check for psychological investment display
    const investmentTracker = await page.getByText('invested', { exact: false }).isVisible();
    if (investmentTracker) {
      results.assessmentPsychology = true;
      results.psychologicalTriggers.push('Psychological investment tracker displayed');
      console.log('✅ Investment psychology: Sunk cost effect active');
    }
    
    // Check for high urgency messaging (should trigger for high score)
    const urgencyMessage = await page.getByText('IMMEDIATE ACTION NEEDED').isVisible();
    if (urgencyMessage) {
      results.psychologicalTriggers.push('High urgency messaging triggered');
      console.log('✅ Urgency psychology: Immediate action messaging active');
    }
    
    await page.screenshot({ 
      path: '/home/jonch/reset-biology-website/screenshots/03-high-score-results.png',
      fullPage: true 
    });
    results.screenshots.push('03-high-score-results.png');

    // Step 5: IRB Handoff Flow
    console.log('\n📍 Step 5: Testing IRB Handoff Flow...');
    
    const irbButton = await page.getByRole('button', { name: /Secure Your Research Spot Now/i }).isVisible();
    if (irbButton) {
      console.log('✅ IRB CTA button found with scarcity psychology');
      
      await page.click('button:has-text("Secure Your Research Spot Now")');
      await page.waitForTimeout(2000);
      
      // Check IRB handoff page elements
      const irbTitle = await page.getByText('IRB Compliance Application').isVisible();
      const scarcityMessage = await page.getByText('Research protocol enrollment is limited').isVisible();
      
      if (irbTitle && scarcityMessage) {
        results.psychologicalTriggers.push('IRB scarcity psychology active');
        console.log('✅ IRB psychology: Scarcity + exclusivity messaging working');
      }
      
      await page.screenshot({ 
        path: '/home/jonch/reset-biology-website/screenshots/04-irb-handoff.png' 
      });
      results.screenshots.push('04-irb-handoff.png');
      
      // Test IRB submission
      await page.click('button:has-text("Continue to IRB Application")');
      await page.waitForTimeout(3000);
      
      // Check for completion state
      const irbComplete = await page.getByText('IRB Application Submitted').isVisible();
      if (irbComplete) {
        results.irbHandoff = true;
        results.psychologicalTriggers.push('IRB handoff completion flow working');
        console.log('✅ IRB handoff: Complete submission flow working');
        
        await page.screenshot({ 
          path: '/home/jonch/reset-biology-website/screenshots/05-irb-complete.png' 
        });
        results.screenshots.push('05-irb-complete.png');
      }
    }
    
  } catch (error) {
    console.error('❌ Flow Test Error:', error.message);
    await page.screenshot({ 
      path: '/home/jonch/reset-biology-website/screenshots/error-flow.png',
      fullPage: true 
    });
    results.screenshots.push('error-flow.png');
  } finally {
    await browser.close();
  }

  return results;
}

// Run comprehensive flow test
testCompleteUserFlow().then(results => {
  console.log('\n=== 🧠 RESET BIOLOGY PSYCHOLOGY FLOW TEST ===\n');
  
  console.log('🎯 CONVERSION PSYCHOLOGY:');
  console.log(`Hero Conversion: ${results.heroConversion ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Assessment Psychology: ${results.assessmentPsychology ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`IRB Handoff: ${results.irbHandoff ? '✓ PASS' : '✗ FAIL'}`);
  
  if (results.psychologicalTriggers.length > 0) {
    console.log('\n🧠 PSYCHOLOGICAL TRIGGERS ACTIVATED:');
    results.psychologicalTriggers.forEach(trigger => {
      console.log(`✓ ${trigger}`);
    });
  }
  
  if (results.consoleErrors.length > 0) {
    console.log('\n❌ JAVASCRIPT ERRORS:');
    results.consoleErrors.forEach(error => {
      console.log(`• ${error}`);
    });
  } else {
    console.log('\n✅ Zero JavaScript errors - clean execution');
  }
  
  console.log('\n📸 FLOW SCREENSHOTS:');
  results.screenshots.forEach(screenshot => {
    console.log(`• ${screenshot}`);
  });
  
  const coreSystemsWorking = [
    results.heroConversion,
    results.assessmentPsychology, 
    results.irbHandoff
  ].filter(Boolean).length;
  
  console.log(`\n📊 FLOW TEST SUMMARY: ${coreSystemsWorking}/3 conversion systems working`);
  console.log(`🧠 PSYCHOLOGY COUNT: ${results.psychologicalTriggers.length} triggers activated`);
  
  if (coreSystemsWorking === 3 && results.psychologicalTriggers.length >= 5) {
    console.log('\n🎉 PERFECT FLOW: All psychological systems working!');
    console.log('💰 Users will experience escalating psychological investment');
    console.log('🏥 IRB handoff maintains momentum and legitimacy');
    console.log('⚡ Ready for real user traffic!');
  } else if (coreSystemsWorking === 3) {
    console.log('\n✅ CORE FLOW WORKING: Some psychology fine-tuning needed');
  } else {
    console.log('\n⚠️ CRITICAL ISSUES: Core conversion flow needs attention');
  }
  
}).catch(console.error);