import { Page, Locator } from '@playwright/test';

/**
 * Page object for Client Portal Dashboard
 */
export class PortalDashboardPage {
  readonly page: Page;
  readonly welcomeSection: Locator;
  readonly greeting: Locator;
  readonly projectsSection: Locator;
  readonly projectCards: Locator;
  readonly emptyState: Locator;
  readonly loadingState: Locator;
  readonly userMenu: Locator;
  readonly logoutButton: Locator;
  readonly profileLink: Locator;
  readonly navbar: Locator;
  readonly sidebar: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeSection = page.locator('.welcome-section, .dashboard-header, [data-testid="welcome"]');
    this.greeting = page.locator('.greeting, .welcome-message, h1').first();
    this.projectsSection = page.locator('.projects-section, .project-list, [data-testid="projects"]');
    this.projectCards = page.locator('.project-card, [data-testid="project-card"]');
    this.emptyState = page.locator('[data-testid="empty-state"], .empty-state, .no-projects');
    this.loadingState = page.locator('.loading, .skeleton, [data-testid="loading"]');
    this.userMenu = page.locator('[aria-label="User menu"], [data-testid="user-menu"], .user-menu');
    this.logoutButton = page.getByRole('button', { name: /logout|sign out/i });
    this.profileLink = page.getByRole('link', { name: /profile/i });
    this.navbar = page.locator('nav, .navbar, header');
    this.sidebar = page.locator('.sidebar, [role="navigation"]');
  }

  async goto() {
    await this.page.goto('/portal');
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
    // Wait for either projects or empty state
    await Promise.race([
      this.page.waitForSelector('.project-card, [data-testid="project-card"]', { timeout: 10000 }),
      this.page.waitForSelector('[data-testid="empty-state"], .empty-state', { timeout: 10000 }),
      this.page.waitForSelector('.portal, .dashboard', { timeout: 10000 }),
    ]).catch(() => {});
  }

  async getProjectCount(): Promise<number> {
    return this.projectCards.count();
  }

  async getProjectByIndex(index: number) {
    const card = this.projectCards.nth(index);
    return {
      name: await card.locator('.project-name, [data-testid="project-name"], h3').textContent(),
      status: await card.locator('.project-status, [data-testid="status"]').textContent().catch(() => ''),
      tier: await card.locator('.project-tier, [data-testid="tier"]').textContent().catch(() => ''),
      progress: await card.locator('.progress-text, [data-testid="progress"]').textContent().catch(() => ''),
    };
  }

  async clickProject(index: number) {
    await this.projectCards.nth(index).click();
  }

  async clickProjectByName(name: string) {
    await this.projectCards.filter({ hasText: name }).click();
  }

  async hasProjects(): Promise<boolean> {
    const count = await this.projectCards.count();
    return count > 0;
  }

  async isEmpty(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  async getGreeting(): Promise<string> {
    return (await this.greeting.textContent()) ?? '';
  }

  async openUserMenu() {
    if (await this.userMenu.isVisible()) {
      await this.userMenu.click();
    }
  }

  async logout() {
    await this.openUserMenu();
    if (await this.logoutButton.isVisible()) {
      await this.logoutButton.click();
    }
  }

  async goToProfile() {
    await this.openUserMenu();
    if (await this.profileLink.isVisible()) {
      await this.profileLink.click();
    }
  }
}
