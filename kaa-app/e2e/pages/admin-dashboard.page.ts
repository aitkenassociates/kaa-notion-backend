import { Page, Locator } from '@playwright/test';

/**
 * Page object for Admin Dashboard
 */
export class AdminDashboardPage {
  readonly page: Page;
  readonly title: Locator;
  readonly subtitle: Locator;
  readonly leadsCard: Locator;
  readonly projectsCard: Locator;
  readonly clientsCard: Locator;
  readonly revenueCard: Locator;
  readonly tierBreakdown: Locator;
  readonly leadsStatusSection: Locator;
  readonly projectsStatusSection: Locator;
  readonly activitySection: Locator;
  readonly activityItems: Locator;
  readonly loadingState: Locator;
  readonly errorState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('.admin-dashboard__title');
    this.subtitle = page.locator('.admin-dashboard__subtitle');
    this.leadsCard = page.locator('.admin-dashboard__card--leads');
    this.projectsCard = page.locator('.admin-dashboard__card--projects');
    this.clientsCard = page.locator('.admin-dashboard__card--clients');
    this.revenueCard = page.locator('.admin-dashboard__card--revenue');
    this.tierBreakdown = page.locator('.admin-dashboard__tier-list');
    this.leadsStatusSection = page.locator('.admin-dashboard__section').filter({ hasText: 'Leads by Status' });
    this.projectsStatusSection = page.locator('.admin-dashboard__section').filter({ hasText: 'Projects by Status' });
    this.activitySection = page.locator('.admin-dashboard__activity');
    this.activityItems = page.locator('.admin-dashboard__activity-item');
    this.loadingState = page.locator('.admin-dashboard--loading');
    this.errorState = page.locator('.admin-dashboard--error');
  }

  async goto() {
    await this.page.goto('/admin');
  }

  async waitForLoad() {
    await this.page.waitForSelector('.admin-dashboard', { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  async getLeadsCount(): Promise<string> {
    const value = this.leadsCard.locator('.admin-dashboard__card-value');
    return (await value.textContent()) ?? '0';
  }

  async getProjectsCount(): Promise<string> {
    const value = this.projectsCard.locator('.admin-dashboard__card-value');
    return (await value.textContent()) ?? '0';
  }

  async getClientsCount(): Promise<string> {
    const value = this.clientsCard.locator('.admin-dashboard__card-value');
    return (await value.textContent()) ?? '0';
  }

  async getRevenueTotal(): Promise<string> {
    const value = this.revenueCard.locator('.admin-dashboard__card-value');
    return (await value.textContent()) ?? '$0';
  }

  async clickLeadsCard() {
    await this.leadsCard.click();
  }

  async clickProjectsCard() {
    await this.projectsCard.click();
  }

  async clickClientsCard() {
    await this.clientsCard.click();
  }

  async getActivityCount(): Promise<number> {
    return this.activityItems.count();
  }

  async getTierCounts(): Promise<{ [tier: string]: string }> {
    const tierItems = this.tierBreakdown.locator('.admin-dashboard__tier-item');
    const count = await tierItems.count();
    const counts: { [tier: string]: string } = {};

    for (let i = 0; i < count; i++) {
      const item = tierItems.nth(i);
      const name = await item.locator('.admin-dashboard__tier-name').textContent();
      const countValue = await item.locator('.admin-dashboard__tier-count').textContent();
      if (name && countValue) {
        counts[name] = countValue;
      }
    }

    return counts;
  }

  async isLoading(): Promise<boolean> {
    return this.loadingState.isVisible();
  }

  async hasError(): Promise<boolean> {
    return this.errorState.isVisible();
  }
}
