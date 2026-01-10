import { Page, Locator } from '@playwright/test';

/**
 * Page object for Checkout Success and Cancel pages
 */
export class CheckoutSuccessPage {
  readonly page: Page;
  readonly successIcon: Locator;
  readonly heading: Locator;
  readonly orderDetails: Locator;
  readonly amountPaid: Locator;
  readonly email: Locator;
  readonly status: Locator;
  readonly nextSteps: Locator;
  readonly goToPortalButton: Locator;
  readonly returnHomeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.successIcon = page.locator('.success-icon, .checkmark, [data-testid="success-icon"]');
    this.heading = page.locator('h1, .checkout-heading').filter({ hasText: /success|thank you|payment/i });
    this.orderDetails = page.locator('.order-details, [data-testid="order-details"]');
    this.amountPaid = page.locator('.amount-paid, [data-testid="amount"]');
    this.email = page.locator('.order-email, [data-testid="email"]');
    this.status = page.locator('.order-status, [data-testid="status"]');
    this.nextSteps = page.locator('.next-steps, .whats-next, [data-testid="next-steps"]');
    this.goToPortalButton = page.getByRole('link', { name: /portal|dashboard/i }).or(
      page.getByRole('button', { name: /portal|dashboard/i })
    );
    this.returnHomeButton = page.getByRole('link', { name: /home|return/i }).or(
      page.getByRole('button', { name: /home|return/i })
    );
  }

  async goto(sessionId?: string) {
    const url = sessionId ? `/checkout/success?session_id=${sessionId}` : '/checkout/success';
    await this.page.goto(url);
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('.checkout-success, [data-testid="checkout-success"]', { timeout: 10000 }).catch(() => {});
  }

  async getAmountPaid(): Promise<string> {
    return (await this.amountPaid.textContent()) ?? '';
  }

  async getEmail(): Promise<string> {
    return (await this.email.textContent()) ?? '';
  }

  async getStatus(): Promise<string> {
    return (await this.status.textContent()) ?? '';
  }

  async clickGoToPortal() {
    await this.goToPortalButton.click();
  }

  async clickReturnHome() {
    await this.returnHomeButton.click();
  }

  async hasNextSteps(): Promise<boolean> {
    return this.nextSteps.isVisible();
  }
}

export class CheckoutCancelPage {
  readonly page: Page;
  readonly cancelIcon: Locator;
  readonly heading: Locator;
  readonly explanation: Locator;
  readonly helpSection: Locator;
  readonly tryAgainButton: Locator;
  readonly viewPricingButton: Locator;
  readonly returnHomeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cancelIcon = page.locator('.cancel-icon, .error-icon, [data-testid="cancel-icon"]');
    this.heading = page.locator('h1, .checkout-heading').filter({ hasText: /cancel|failed|error/i });
    this.explanation = page.locator('.explanation, .message, [data-testid="explanation"]');
    this.helpSection = page.locator('.help-section, .suggestions, [data-testid="help"]');
    this.tryAgainButton = page.getByRole('link', { name: /try again|retry/i }).or(
      page.getByRole('button', { name: /try again|retry/i })
    );
    this.viewPricingButton = page.getByRole('link', { name: /pricing/i }).or(
      page.getByRole('button', { name: /pricing/i })
    );
    this.returnHomeButton = page.getByRole('link', { name: /home|return/i }).or(
      page.getByRole('button', { name: /home|return/i })
    );
  }

  async goto() {
    await this.page.goto('/checkout/cancel');
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('.checkout-cancel, [data-testid="checkout-cancel"]', { timeout: 10000 }).catch(() => {});
  }

  async clickTryAgain() {
    await this.tryAgainButton.click();
  }

  async clickViewPricing() {
    await this.viewPricingButton.click();
  }

  async clickReturnHome() {
    await this.returnHomeButton.click();
  }

  async hasHelpSection(): Promise<boolean> {
    return this.helpSection.isVisible();
  }
}
