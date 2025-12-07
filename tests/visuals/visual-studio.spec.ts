/**
 * Visual Studio (Breathing Orb) - Comprehensive Test Suite
 *
 * Tests the audio-reactive particle orb visualization system including:
 * - Page load and initial render
 * - Mode switching (breath/audio)
 * - Breath pattern selection
 * - Audio file upload and playback
 * - Color preset selection
 * - Custom color controls
 * - Particle settings (count, size, glow, spread)
 * - Background preset selection
 * - Video background upload
 * - Star field controls
 * - Water reflection controls
 * - Export settings configuration
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const VISUAL_STUDIO_URL = `${BASE_URL}/visuals/breathing`;
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function screenshot(page: Page, name: string): Promise<void> {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`   [Screenshot] ${name}`);
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// PAGE LOAD TESTS
// ============================================================================

test.describe('Visual Studio Page Load', () => {
  test('should load the Visual Studio page', async ({ page }) => {
    await page.goto(VISUAL_STUDIO_URL);

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Check header elements
    await expect(page.locator('h1')).toContainText('Visual Studio');
    await expect(page.locator('text=Audio-Reactive Orb Generator')).toBeVisible();

    await screenshot(page, '01-page-loaded');
  });

  test('should display the orb canvas', async ({ page }) => {
    await page.goto(VISUAL_STUDIO_URL);

    // Wait for canvas to render
    await delay(2000);

    // Check that the canvas element exists
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    await screenshot(page, '02-canvas-visible');
  });

  test('should show all four tabs', async ({ page }) => {
    await page.goto(VISUAL_STUDIO_URL);

    await expect(page.locator('button:has-text("Mode")')).toBeVisible();
    await expect(page.locator('button:has-text("Orb")')).toBeVisible();
    await expect(page.locator('button:has-text("Environment")')).toBeVisible();
    await expect(page.locator('button:has-text("Export")')).toBeVisible();

    await screenshot(page, '03-tabs-visible');
  });
});

// ============================================================================
// MODE TAB TESTS
// ============================================================================

test.describe('Mode Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(VISUAL_STUDIO_URL);
    await delay(1000);
  });

  test('should show breath mode controls by default', async ({ page }) => {
    // Breath mode should be active by default
    const breathModeBtn = page.locator('button:has-text("Breath Timer")');
    await expect(breathModeBtn).toBeVisible();

    // Should show breath pattern selector
    await expect(page.locator('text=Breath Pattern')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();

    await screenshot(page, '04-breath-mode-default');
  });

  test('should switch to audio mode', async ({ page }) => {
    // Click audio mode button
    await page.locator('button:has-text("Audio Reactive")').click();
    await delay(500);

    // Should show audio upload controls
    await expect(page.locator('text=Audio Source')).toBeVisible();
    await expect(page.locator('text=Upload Audio File')).toBeVisible();

    await screenshot(page, '05-audio-mode-selected');
  });

  test('should change breath pattern', async ({ page }) => {
    // Find and click the pattern dropdown
    const patternSelect = page.locator('select').first();
    await patternSelect.selectOption('box');
    await delay(500);

    // Verify the pattern info updates
    await expect(page.locator('text=Inhale: 4s | Hold: 4s | Exhale: 4s')).toBeVisible();

    await screenshot(page, '06-breath-pattern-changed');
  });
});

// ============================================================================
// ORB TAB TESTS
// ============================================================================

test.describe('Orb Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(VISUAL_STUDIO_URL);
    await page.locator('button:has-text("Orb")').click();
    await delay(500);
  });

  test('should display color presets', async ({ page }) => {
    await expect(page.locator('text=Color Presets')).toBeVisible();

    // Should have multiple color preset buttons
    const presetButtons = page.locator('[title]').filter({ hasText: /Glow|Blue|Purple|Green|Fire|Aurora|Sunset|Moonlight/i });
    const count = await presetButtons.count();
    expect(count).toBeGreaterThan(0);

    await screenshot(page, '07-color-presets-visible');
  });

  test('should show custom color pickers', async ({ page }) => {
    await expect(page.locator('text=Custom Colors')).toBeVisible();
    await expect(page.locator('text=Inner Core Color')).toBeVisible();
    await expect(page.locator('text=Outer Glow Color')).toBeVisible();

    // Should have color input elements
    const colorInputs = page.locator('input[type="color"]');
    expect(await colorInputs.count()).toBe(2);

    await screenshot(page, '08-custom-colors-visible');
  });

  test('should display particle settings sliders', async ({ page }) => {
    await expect(page.locator('text=Particle Settings')).toBeVisible();
    await expect(page.locator('text=Particle Count')).toBeVisible();
    await expect(page.locator('text=Glow Intensity')).toBeVisible();
    await expect(page.locator('text=Turbulence')).toBeVisible();

    await screenshot(page, '09-particle-settings-visible');
  });

  test('should update particle count slider', async ({ page }) => {
    // Find the particle count slider
    const particleSlider = page.locator('input[type="range"]').first();

    // Get initial value
    const initialValue = await particleSlider.inputValue();

    // Move slider
    await particleSlider.fill('30000');
    await delay(500);

    // Value should have changed
    const newValue = await particleSlider.inputValue();
    expect(newValue).toBe('30000');

    await screenshot(page, '10-particle-count-changed');
  });
});

// ============================================================================
// ENVIRONMENT TAB TESTS
// ============================================================================

test.describe('Environment Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(VISUAL_STUDIO_URL);
    await page.locator('button:has-text("Environment")').click();
    await delay(500);
  });

  test('should display background presets', async ({ page }) => {
    await expect(page.locator('text=Background Preset')).toBeVisible();

    // Should show background option buttons
    await expect(page.locator('text=Deep Space Stars')).toBeVisible();
    await expect(page.locator('text=Aurora Veil')).toBeVisible();

    await screenshot(page, '11-background-presets-visible');
  });

  test('should show star field controls', async ({ page }) => {
    await expect(page.locator('text=Star Field')).toBeVisible();
    await expect(page.locator('text=Enable Stars')).toBeVisible();

    await screenshot(page, '12-star-controls-visible');
  });

  test('should toggle star field', async ({ page }) => {
    // Find the toggle for stars
    const starToggle = page.locator('text=Enable Stars').locator('..').locator('input[type="checkbox"]');

    // Should be enabled by default
    await expect(starToggle).toBeChecked();

    // Toggle off
    await starToggle.click();
    await delay(500);

    // Should now be unchecked
    await expect(starToggle).not.toBeChecked();

    await screenshot(page, '13-stars-toggled-off');

    // Toggle back on
    await starToggle.click();
    await delay(500);
    await expect(starToggle).toBeChecked();

    await screenshot(page, '14-stars-toggled-on');
  });

  test('should show water reflection controls', async ({ page }) => {
    await expect(page.locator('text=Water Reflection')).toBeVisible();
    await expect(page.locator('text=Enable Water')).toBeVisible();

    await screenshot(page, '15-water-controls-visible');
  });

  test('should show video upload controls', async ({ page }) => {
    await expect(page.locator('text=Background Video')).toBeVisible();
    await expect(page.locator('text=Upload Background Video')).toBeVisible();

    await screenshot(page, '16-video-upload-visible');
  });
});

// ============================================================================
// EXPORT TAB TESTS
// ============================================================================

test.describe('Export Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(VISUAL_STUDIO_URL);
    await page.locator('button:has-text("Export")').click();
    await delay(500);
  });

  test('should display export settings', async ({ page }) => {
    await expect(page.locator('text=Offline Video Rendering')).toBeVisible();
    await expect(page.locator('text=Resolution')).toBeVisible();
    await expect(page.locator('text=Format')).toBeVisible();
    await expect(page.locator('text=Frame Rate')).toBeVisible();

    await screenshot(page, '17-export-settings-visible');
  });

  test('should display pipeline commands', async ({ page }) => {
    await expect(page.locator('text=Pipeline Commands')).toBeVisible();
    await expect(page.locator('text=Analyze Audio')).toBeVisible();
    await expect(page.locator('text=Render Video')).toBeVisible();

    // Should have copy button
    await expect(page.locator('button:has-text("Copy Render Command")')).toBeVisible();

    await screenshot(page, '18-pipeline-commands-visible');
  });

  test('should change resolution setting', async ({ page }) => {
    const resolutionSelect = page.locator('select').first();
    await resolutionSelect.selectOption('8k');
    await delay(500);

    // The command should reflect the change
    const commandText = await page.locator('code').last().textContent();
    expect(commandText).toContain('7680');

    await screenshot(page, '19-resolution-changed');
  });

  test('should toggle stereo mode', async ({ page }) => {
    const stereoToggle = page.locator('text=Stereo 3D').locator('..').locator('input[type="checkbox"]');
    await stereoToggle.click();
    await delay(500);

    // The command should include stereo flag
    const commandText = await page.locator('code').last().textContent();
    expect(commandText).toContain('--stereo');

    await screenshot(page, '20-stereo-enabled');
  });
});

// ============================================================================
// VISUAL REGRESSION TESTS
// ============================================================================

test.describe('Visual Regression', () => {
  test('should render orb with different color presets', async ({ page }) => {
    await page.goto(VISUAL_STUDIO_URL);
    await delay(2000);

    // Take baseline screenshot
    await screenshot(page, '21-baseline-render');

    // Navigate to orb tab
    await page.locator('button:has-text("Orb")').click();
    await delay(500);

    // Click each color preset and take a screenshot
    const presets = ['Ethereal Blue', 'Cosmic Purple', 'Fire Spirit'];

    for (const preset of presets) {
      const presetBtn = page.locator(`button[title*="${preset}"], button:has-text("${preset.split(' ')[0]}")`).first();
      if (await presetBtn.isVisible()) {
        await presetBtn.click();
        await delay(1500);
        await screenshot(page, `22-preset-${preset.replace(/\s+/g, '-').toLowerCase()}`);
      }
    }
  });

  test('should render orb with different backgrounds', async ({ page }) => {
    await page.goto(VISUAL_STUDIO_URL);
    await delay(2000);

    // Navigate to environment tab
    await page.locator('button:has-text("Environment")').click();
    await delay(500);

    // Click different background presets
    const backgrounds = ['Aurora Veil', 'Sunset Glow', 'Zion Canyon'];

    for (const bg of backgrounds) {
      const bgBtn = page.locator(`button:has-text("${bg}")`).first();
      if (await bgBtn.isVisible()) {
        await bgBtn.click();
        await delay(1500);
        await screenshot(page, `23-bg-${bg.replace(/\s+/g, '-').toLowerCase()}`);
      }
    }
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

test.describe('Performance', () => {
  test('should handle high particle counts', async ({ page }) => {
    await page.goto(VISUAL_STUDIO_URL);
    await delay(2000);

    // Navigate to orb tab
    await page.locator('button:has-text("Orb")').click();
    await delay(500);

    // Set particle count to max
    const particleSlider = page.locator('input[type="range"]').first();
    await particleSlider.fill('50000');
    await delay(2000);

    // Page should still be responsive
    const tabs = page.locator('button:has-text("Mode")');
    await expect(tabs).toBeVisible();
    await tabs.click();
    await expect(page.locator('text=Visualization Mode')).toBeVisible();

    await screenshot(page, '24-high-particle-count');
  });
});

// ============================================================================
// ACCESSIBILITY TESTS
// ============================================================================

test.describe('Accessibility', () => {
  test('should have accessible controls', async ({ page }) => {
    await page.goto(VISUAL_STUDIO_URL);
    await delay(1000);

    // All tabs should be keyboard accessible
    const modeTab = page.locator('button:has-text("Mode")');
    await modeTab.focus();
    await page.keyboard.press('Tab');

    // Should be able to navigate through tabs
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    await screenshot(page, '25-keyboard-navigation');
  });
});
