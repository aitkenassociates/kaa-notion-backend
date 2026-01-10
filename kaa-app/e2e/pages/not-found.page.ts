import { Page, Locator } from '@playwright/test';

/**
 * Page object for 404 Not Found page
 */
export class NotFoundPage {
  readonly page: Page;
  readonly icon: Locator;
  readonly errorCode: Locator;
  readonly title: Locator;
  readonly message: Locator;
  readonly goBackButton: Locator;
  readonly returnHomeButton: Locator;
  readonly helpSection: Locator;
  readonly quickLinks: Locator;

  constructor(page: Page) {
    this.page = page;
    this.icon = page.locator('.not-found-icon, .error-icon, [data-testid="404-icon"]');
    this.errorCode = page.locator('.error-code, .status-code').filter({ hasText: '404' });
    this.title = page.locator('h1, .not-found-title');
    this.message = page.locator('.not-found-message, .error-message, p').first();
    this.goBackButton = page.getByRole('button', { name: /go back|back/i }).or(
      page.getByRole('link', { name: /go back|back/i })
    );
    this.returnHomeButton = page.getByRole('link', { name: /home|return home/i }).or(
      page.getByRole('button', { name: /home|return home/i })
    );
    this.helpSection = page.locator('.help-section, .quick-links-section, [data-testid="help"]');
    this.quickLinks = page.locator('.quick-links a, .help-section a');
  }

  async goto() {
    await this.page.goto('/non-existent-page-12345');
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  async clickGoBack() {
    await this.goBackButton.click();
  }

  async clickReturnHome() {
    await this.returnHomeButton.click();
  }

  async getQuickLinkCount(): Promise<number> {
    return this.quickLinks.count();
  }

  async has404Code(): Promise<boolean> {
    return this.errorCode.isVisible();
  }

  async hasHelpSection(): Promise<boolean> {
    return this.helpSection.isVisible();
  }
}
