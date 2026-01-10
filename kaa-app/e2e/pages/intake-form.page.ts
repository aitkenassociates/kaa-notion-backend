import { Page, Locator } from '@playwright/test';

export class IntakeFormPage {
  readonly page: Page;

  // Form container
  readonly formContainer: Locator;
  readonly stepIndicators: Locator;
  readonly currentStepIndicator: Locator;

  // Step 1 elements
  readonly emailInput: Locator;
  readonly nameInput: Locator;
  readonly addressInput: Locator;

  // Navigation
  readonly continueButton: Locator;
  readonly backButton: Locator;
  readonly submitButton: Locator;

  // Progress
  readonly progressBar: Locator;

  // Validation
  readonly errorMessages: Locator;
  readonly fieldErrors: Locator;

  // Tier Recommendation
  readonly tierRecommendation: Locator;
  readonly recommendedTierCard: Locator;
  readonly confidenceBadge: Locator;
  readonly reasonsList: Locator;
  readonly alternativeTiers: Locator;
  readonly continueWithTierButton: Locator;
  readonly editAnswersButton: Locator;
  readonly redFlags: Locator;

  constructor(page: Page) {
    this.page = page;
    this.formContainer = page.locator('.intake-form, [data-testid="intake-form"]');
    this.stepIndicators = page.locator('.step-indicator, .intake-step, [data-testid="step"]');
    this.currentStepIndicator = page.locator('.step-indicator.active, .intake-step.active');
    this.emailInput = page.getByLabel(/email address/i);
    this.nameInput = page.getByLabel(/your name/i);
    this.addressInput = page.getByLabel(/project address/i);
    this.continueButton = page.getByRole('button', { name: /continue/i });
    this.backButton = page.getByRole('button', { name: /back/i });
    this.submitButton = page.getByRole('button', { name: /get my recommendation/i });
    this.progressBar = page.locator('.intake-progress-fill');
    this.errorMessages = page.locator('.error-message, .error, [role="alert"]');
    this.fieldErrors = page.locator('.field-error, .input-error, .validation-error');
    this.tierRecommendation = page.locator('[data-testid="tier-recommendation"], .tier-recommendation');
    this.recommendedTierCard = page.locator('[data-testid="recommended-tier"], .recommended-tier');
    this.confidenceBadge = page.locator('.confidence-badge, [data-testid="confidence"]');
    this.reasonsList = page.locator('.reasons-list li, .why-section li');
    this.alternativeTiers = page.locator('.alternative-tiers, .other-options');
    this.continueWithTierButton = page.getByRole('button', { name: /continue with|proceed|checkout/i });
    this.editAnswersButton = page.getByRole('button', { name: /edit.*answers|go back|modify/i });
    this.redFlags = page.locator('.red-flags, .warnings, [data-testid="red-flags"]');
  }

  async goto() {
    await this.page.goto('/intake');
  }

  async fillStep1(data: { email: string; name?: string; address: string }) {
    await this.emailInput.fill(data.email);
    if (data.name) await this.nameInput.fill(data.name);
    await this.addressInput.fill(data.address);
  }

  async selectBudget(value: string) {
    await this.page.getByLabel(new RegExp(value, 'i')).click();
  }

  async selectTimeline(value: string) {
    await this.page.getByLabel(new RegExp(value, 'i')).click();
  }

  async selectProjectType(value: string) {
    await this.page.getByLabel(new RegExp(value, 'i')).click();
  }

  async toggleSurvey(checked: boolean) {
    const checkbox = this.page.getByRole('checkbox', { name: /property survey/i });
    if (checked) await checkbox.check();
    else await checkbox.uncheck();
  }

  async toggleDrawings(checked: boolean) {
    const checkbox = this.page.getByRole('checkbox', { name: /drawings/i });
    if (checked) await checkbox.check();
    else await checkbox.uncheck();
  }

  async completeAllSteps(data: {
    email: string;
    name?: string;
    address: string;
    budget: string;
    timeline: string;
    projectType: string;
    hasSurvey?: boolean;
    hasDrawings?: boolean;
  }) {
    // Step 1: Contact info
    await this.fillStep1({ email: data.email, name: data.name, address: data.address });
    await this.continueButton.click();

    // Step 2: Budget
    await this.selectBudget(data.budget);
    await this.continueButton.click();

    // Step 3: Timeline
    await this.selectTimeline(data.timeline);
    await this.continueButton.click();

    // Step 4: Project type and assets
    await this.selectProjectType(data.projectType);
    if (data.hasSurvey) await this.toggleSurvey(true);
    if (data.hasDrawings) await this.toggleDrawings(true);
    await this.continueButton.click();

    // Now on Step 5 (Review)
  }

  async submit() {
    await this.submitButton.click();
  }

  async getProgress(): Promise<number> {
    const style = await this.progressBar.getAttribute('style');
    const match = style?.match(/width:\s*(\d+)%/);
    return match ? parseInt(match[1]) : 0;
  }

  async waitForTierRecommendation() {
    await this.page.waitForSelector('[data-testid="tier-recommendation"]', { timeout: 10000 });
  }

  async getRecommendedTier(): Promise<number | null> {
    const tierElement = this.page.locator('[data-testid="recommended-tier"]');
    const text = await tierElement.textContent();
    const match = text?.match(/tier\s*(\d)/i);
    return match ? parseInt(match[1]) : null;
  }

  async gotoGetStarted() {
    await this.page.goto('/get-started');
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('.intake-form, [data-testid="intake-form"], form', { timeout: 10000 }).catch(() => {});
  }

  async getStepCount(): Promise<number> {
    return this.stepIndicators.count();
  }

  async getCurrentStep(): Promise<number> {
    const activeSteps = await this.currentStepIndicator.count();
    return activeSteps || 1;
  }

  async hasErrors(): Promise<boolean> {
    const errorCount = await this.errorMessages.count();
    const fieldErrorCount = await this.fieldErrors.count();
    return errorCount > 0 || fieldErrorCount > 0;
  }

  async getErrorMessages(): Promise<string[]> {
    const errors = this.errorMessages.or(this.fieldErrors);
    const count = await errors.count();
    const messages: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await errors.nth(i).textContent();
      if (text) messages.push(text.trim());
    }

    return messages;
  }

  async getConfidenceLevel(): Promise<string> {
    return (await this.confidenceBadge.textContent()) ?? '';
  }

  async getReasons(): Promise<string[]> {
    const count = await this.reasonsList.count();
    const reasons: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await this.reasonsList.nth(i).textContent();
      if (text) reasons.push(text.trim());
    }

    return reasons;
  }

  async hasRedFlags(): Promise<boolean> {
    return this.redFlags.isVisible();
  }

  async hasAlternativeTiers(): Promise<boolean> {
    return this.alternativeTiers.isVisible();
  }

  async clickContinueWithTier() {
    await this.continueWithTierButton.click();
  }

  async clickEditAnswers() {
    await this.editAnswersButton.click();
  }

  async clickStepIndicator(stepNumber: number) {
    await this.stepIndicators.nth(stepNumber - 1).click();
  }
}
