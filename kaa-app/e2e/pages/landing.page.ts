import { Page, Locator } from '@playwright/test';

/**
 * Page object for Landing Page
 */
export class LandingPageObject {
  readonly page: Page;
  readonly logo: Locator;
  readonly heroTitle: Locator;
  readonly heroSubtitle: Locator;
  readonly getStartedButton: Locator;
  readonly viewPricingButton: Locator;
  readonly portalCards: Locator;
  readonly clientPortalCard: Locator;
  readonly teamDashboardCard: Locator;
  readonly featureDemoCard: Locator;
  readonly animatedBackground: Locator;

  constructor(page: Page) {
    this.page = page;
    this.logo = page.locator('.landing-logo, .sage-logo, [data-testid="logo"]');
    this.heroTitle = page.locator('.landing-title, .hero-title, h1').first();
    this.heroSubtitle = page.locator('.landing-subtitle, .hero-subtitle');
    this.getStartedButton = page.getByRole('link', { name: /get started/i }).or(
      page.getByRole('button', { name: /get started/i })
    );
    this.viewPricingButton = page.getByRole('link', { name: /view pricing|pricing/i });
    this.portalCards = page.locator('.portal-card, .feature-card, [data-testid="portal-card"]');
    this.clientPortalCard = page.locator('.portal-card, [data-testid="portal-card"]').filter({ hasText: /client portal/i });
    this.teamDashboardCard = page.locator('.portal-card, [data-testid="portal-card"]').filter({ hasText: /team dashboard/i });
    this.featureDemoCard = page.locator('.portal-card, [data-testid="portal-card"]').filter({ hasText: /demo/i });
    this.animatedBackground = page.locator('.landing-background, .animated-background');
  }

  async goto() {
    await this.page.goto('/');
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('.landing-page, .home-page, main', { timeout: 10000 }).catch(() => {});
  }

  async clickGetStarted() {
    await this.getStartedButton.click();
  }

  async clickViewPricing() {
    await this.viewPricingButton.click();
  }

  async clickClientPortal() {
    await this.clientPortalCard.click();
  }

  async clickTeamDashboard() {
    await this.teamDashboardCard.click();
  }

  async clickFeatureDemo() {
    await this.featureDemoCard.click();
  }

  async getPortalCardCount(): Promise<number> {
    return this.portalCards.count();
  }

  async getHeroTitle(): Promise<string> {
    return (await this.heroTitle.textContent()) ?? '';
  }

  async getHeroSubtitle(): Promise<string> {
    return (await this.heroSubtitle.textContent()) ?? '';
  }

  // Alias for heroSection (used in some tests)
  get heroSection() {
    return this.heroTitle.locator('..');
  }
}

// Alias for backward compatibility
export { LandingPageObject as LandingPage };
