import { Page, Locator } from '@playwright/test';

/**
 * Page object for Site Navigation (Header & Footer)
 */
export class NavigationPage {
  readonly page: Page;

  // Header elements
  readonly header: Locator;
  readonly logo: Locator;
  readonly navLinks: Locator;
  readonly pricingLink: Locator;
  readonly myProjectsLink: Locator;
  readonly adminLink: Locator;
  readonly getStartedLink: Locator;
  readonly signInLink: Locator;
  readonly signOutButton: Locator;
  readonly userEmail: Locator;
  readonly tierBadge: Locator;
  readonly mobileMenuButton: Locator;
  readonly mobileMenu: Locator;

  // Footer elements
  readonly footer: Locator;
  readonly footerLogo: Locator;
  readonly footerServiceLinks: Locator;
  readonly footerCompanyLinks: Locator;
  readonly footerLegalLinks: Locator;
  readonly privacyPolicyLink: Locator;
  readonly termsOfServiceLink: Locator;
  readonly copyright: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header
    this.header = page.locator('header, .app-header, [role="banner"]');
    this.logo = page.locator('.app-logo, .site-logo, header a').filter({ hasText: /sage/i }).first();
    this.navLinks = page.locator('.nav-links a, nav a, header nav a');
    this.pricingLink = page.locator('header').getByRole('link', { name: /pricing/i });
    this.myProjectsLink = page.locator('header').getByRole('link', { name: /my projects/i });
    this.adminLink = page.locator('header').getByRole('link', { name: /admin/i });
    this.getStartedLink = page.locator('header').getByRole('link', { name: /get started/i });
    this.signInLink = page.locator('header').getByRole('link', { name: /sign in|login/i });
    this.signOutButton = page.locator('header').getByRole('button', { name: /sign out|logout/i });
    this.userEmail = page.locator('.user-email, .user-info, [data-testid="user-email"]');
    this.tierBadge = page.locator('.tier-badge, [data-testid="tier-badge"]');
    this.mobileMenuButton = page.locator('.mobile-menu-btn, .hamburger, [aria-label="Menu"]');
    this.mobileMenu = page.locator('.mobile-menu, .nav-mobile, [role="menu"]');

    // Footer
    this.footer = page.locator('footer, .app-footer, [role="contentinfo"]');
    this.footerLogo = page.locator('footer .logo, footer .brand');
    this.footerServiceLinks = page.locator('footer .service-links a, footer [data-testid="service-links"] a');
    this.footerCompanyLinks = page.locator('footer .company-links a, footer [data-testid="company-links"] a');
    this.footerLegalLinks = page.locator('footer .legal-links a, footer [data-testid="legal-links"] a');
    this.privacyPolicyLink = page.locator('footer').getByRole('link', { name: /privacy/i });
    this.termsOfServiceLink = page.locator('footer').getByRole('link', { name: /terms/i });
    this.copyright = page.locator('footer .copyright, footer small');
  }

  async goto(path: string = '/') {
    await this.page.goto(path);
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  async clickLogo() {
    await this.logo.click();
  }

  async clickPricing() {
    await this.pricingLink.click();
  }

  async clickGetStarted() {
    await this.getStartedLink.click();
  }

  async clickSignIn() {
    await this.signInLink.click();
  }

  async clickSignOut() {
    await this.signOutButton.click();
  }

  async clickMyProjects() {
    await this.myProjectsLink.click();
  }

  async clickAdmin() {
    await this.adminLink.click();
  }

  async openMobileMenu() {
    if (await this.mobileMenuButton.isVisible()) {
      await this.mobileMenuButton.click();
    }
  }

  async isAuthenticated(): Promise<boolean> {
    return this.signOutButton.isVisible();
  }

  async isAdmin(): Promise<boolean> {
    return this.adminLink.isVisible();
  }

  async getUserEmail(): Promise<string> {
    return (await this.userEmail.textContent()) ?? '';
  }

  async getTierBadge(): Promise<string> {
    return (await this.tierBadge.textContent()) ?? '';
  }

  async getNavLinkCount(): Promise<number> {
    return this.navLinks.count();
  }

  async scrollToFooter() {
    await this.footer.scrollIntoViewIfNeeded();
  }

  async clickPrivacyPolicy() {
    await this.scrollToFooter();
    await this.privacyPolicyLink.click();
  }

  async clickTermsOfService() {
    await this.scrollToFooter();
    await this.termsOfServiceLink.click();
  }
}
