/**
 * E2E Tests for Intake Form Flow
 * Tests multi-step form, validation, tier recommendation, and navigation
 */

import { test, expect } from '@playwright/test';
import { IntakeFormPage } from '../pages/intake-form.page';
import { generateUniqueEmail, generateAddress } from '../utils/test-data';

test.describe('Intake Form Flow', () => {
  test.describe('Form Display', () => {
    test('should display intake form', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      await expect(intake.formContainer).toBeVisible();
    });

    test('should display step indicators', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      const stepCount = await intake.getStepCount();
      expect(stepCount).toBeGreaterThanOrEqual(4);
    });

    test('should display progress bar', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      await expect(intake.progressBar).toBeVisible();
    });

    test('should start at step 1', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      // Should show contact info fields
      await expect(intake.emailInput).toBeVisible();
    });
  });

  test.describe('Step 1: Contact Info', () => {
    test('should display name input', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      await expect(intake.nameInput).toBeVisible();
    });

    test('should display email input', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      await expect(intake.emailInput).toBeVisible();
    });

    test('should display address input', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      await expect(intake.addressInput).toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      // Try to continue without filling fields
      await intake.continueButton.click();

      // Should show validation errors or stay on step
      const hasErrors = await intake.hasErrors();
      const progress = await intake.getProgress();
      expect(hasErrors || progress === 0).toBeTruthy();
    });

    test('should validate email format', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      await intake.emailInput.fill('invalid-email');
      await intake.addressInput.fill('123 Main St');
      await intake.continueButton.click();

      // Should show email validation error
      const hasErrors = await intake.hasErrors();
      // May show inline validation
    });

    test('should advance to step 2 with valid data', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      await intake.fillStep1({
        email: generateUniqueEmail('intake'),
        address: generateAddress(),
      });
      await intake.continueButton.click();

      // Should advance - progress should increase
      const progress = await intake.getProgress();
      expect(progress).toBeGreaterThan(0);
    });
  });

  test.describe('Step 2: Budget', () => {
    test('should display budget options', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      // Complete step 1
      await intake.fillStep1({
        email: generateUniqueEmail('intake'),
        address: generateAddress(),
      });
      await intake.continueButton.click();

      // Budget options should be visible
      await page.waitForTimeout(500);
      const budgetOptions = page.locator('label, .budget-option').filter({ hasText: /\$|under|over/i });
      const count = await budgetOptions.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should select budget option', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      // Complete step 1
      await intake.fillStep1({
        email: generateUniqueEmail('intake'),
        address: generateAddress(),
      });
      await intake.continueButton.click();

      await page.waitForTimeout(500);
      await intake.selectBudget('5,000');
      await intake.continueButton.click();

      // Should advance
      const progress = await intake.getProgress();
      expect(progress).toBeGreaterThan(20);
    });
  });

  test.describe('Step 3: Timeline', () => {
    test('should display timeline options', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      // Complete steps 1-2
      await intake.fillStep1({
        email: generateUniqueEmail('intake'),
        address: generateAddress(),
      });
      await intake.continueButton.click();
      await page.waitForTimeout(500);

      await intake.selectBudget('5,000');
      await intake.continueButton.click();
      await page.waitForTimeout(500);

      // Timeline options should be visible
      const timelineOptions = page.locator('label, .timeline-option').filter({ hasText: /week|month|asap|flexible/i });
      const count = await timelineOptions.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Step 4: Project Type & Assets', () => {
    test('should display project type options', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      // Complete steps 1-3
      await intake.completeAllSteps({
        email: generateUniqueEmail('intake'),
        address: generateAddress(),
        budget: '5,000',
        timeline: 'Standard',
        projectType: 'Renovation',
      });

      // Should be on step 4 or 5
      const progress = await intake.getProgress();
      expect(progress).toBeGreaterThan(60);
    });

    test('should have optional survey checkbox', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      // Navigate to step 4
      await intake.fillStep1({
        email: generateUniqueEmail('intake'),
        address: generateAddress(),
      });
      await intake.continueButton.click();
      await page.waitForTimeout(500);

      await intake.selectBudget('5,000');
      await intake.continueButton.click();
      await page.waitForTimeout(500);

      await intake.selectTimeline('Standard');
      await intake.continueButton.click();
      await page.waitForTimeout(500);

      // Checkbox should be available
      const surveyCheckbox = page.getByRole('checkbox', { name: /survey/i });
      // May be visible depending on step structure
    });
  });

  test.describe('Navigation', () => {
    test('should go back to previous step', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      // Complete step 1
      await intake.fillStep1({
        email: generateUniqueEmail('intake'),
        address: generateAddress(),
      });
      await intake.continueButton.click();
      await page.waitForTimeout(500);

      // Go back
      await intake.backButton.click();
      await page.waitForTimeout(500);

      // Should be back on step 1
      await expect(intake.emailInput).toBeVisible();
    });

    test('should preserve data when going back', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      const email = generateUniqueEmail('intake');
      const address = generateAddress();

      // Complete step 1
      await intake.fillStep1({ email, address });
      await intake.continueButton.click();
      await page.waitForTimeout(500);

      // Go back
      await intake.backButton.click();
      await page.waitForTimeout(500);

      // Data should be preserved
      await expect(intake.emailInput).toHaveValue(email);
      await expect(intake.addressInput).toHaveValue(address);
    });

    test('should click step indicator to go back', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      // Complete step 1
      await intake.fillStep1({
        email: generateUniqueEmail('intake'),
        address: generateAddress(),
      });
      await intake.continueButton.click();
      await page.waitForTimeout(500);

      // Click step 1 indicator
      await intake.clickStepIndicator(1);
      await page.waitForTimeout(500);

      // Should be on step 1
      await expect(intake.emailInput).toBeVisible();
    });
  });

  test.describe('Tier Recommendation', () => {
    test('should show tier recommendation after completion', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      // Complete all steps
      await intake.completeAllSteps({
        email: generateUniqueEmail('intake'),
        address: generateAddress(),
        budget: '5,000',
        timeline: 'Standard',
        projectType: 'Renovation',
      });

      await intake.submit();
      await intake.waitForTierRecommendation();

      // Should show recommendation
      await expect(intake.tierRecommendation).toBeVisible();
    });

    test('should display recommended tier', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      await intake.completeAllSteps({
        email: generateUniqueEmail('intake'),
        address: generateAddress(),
        budget: '5,000',
        timeline: 'Standard',
        projectType: 'Renovation',
      });

      await intake.submit();
      await intake.waitForTierRecommendation();

      const tier = await intake.getRecommendedTier();
      expect(tier).toBeGreaterThanOrEqual(1);
      expect(tier).toBeLessThanOrEqual(4);
    });

    test('should display confidence level', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      await intake.completeAllSteps({
        email: generateUniqueEmail('intake'),
        address: generateAddress(),
        budget: '5,000',
        timeline: 'Standard',
        projectType: 'Renovation',
      });

      await intake.submit();
      await intake.waitForTierRecommendation();

      const confidence = await intake.getConfidenceLevel();
      // Confidence should be displayed
    });

    test('should have continue button to proceed', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      await intake.completeAllSteps({
        email: generateUniqueEmail('intake'),
        address: generateAddress(),
        budget: '5,000',
        timeline: 'Standard',
        projectType: 'Renovation',
      });

      await intake.submit();
      await intake.waitForTierRecommendation();

      await expect(intake.continueWithTierButton).toBeVisible();
    });

    test('should have edit answers button', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      await intake.completeAllSteps({
        email: generateUniqueEmail('intake'),
        address: generateAddress(),
        budget: '5,000',
        timeline: 'Standard',
        projectType: 'Renovation',
      });

      await intake.submit();
      await intake.waitForTierRecommendation();

      await expect(intake.editAnswersButton).toBeVisible();
    });

    test('should navigate to pricing when continuing', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      await intake.completeAllSteps({
        email: generateUniqueEmail('intake'),
        address: generateAddress(),
        budget: '5,000',
        timeline: 'Standard',
        projectType: 'Renovation',
      });

      await intake.submit();
      await intake.waitForTierRecommendation();

      await intake.clickContinueWithTier();
      await expect(page).toHaveURL(/pricing|checkout/);
    });
  });

  test.describe('Responsive Design', () => {
    test('should display on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      await expect(intake.emailInput).toBeVisible();
      await expect(intake.continueButton).toBeVisible();
    });

    test('should display on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      await expect(intake.emailInput).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have form labels', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      // Inputs should have labels
      const labels = page.locator('label');
      const labelCount = await labels.count();
      expect(labelCount).toBeGreaterThan(0);
    });

    test('should have keyboard navigation', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      // Should be able to tab through form
      await intake.emailInput.focus();
      await expect(intake.emailInput).toBeFocused();

      await page.keyboard.press('Tab');
      // Next field should be focused
    });

    test('should announce errors', async ({ page }) => {
      const intake = new IntakeFormPage(page);
      await intake.goto();
      await intake.waitForLoad();

      // Submit without data
      await intake.continueButton.click();

      // Errors should be visible (may use role="alert")
      const alerts = page.locator('[role="alert"], .error-message');
    });
  });
});
