import { Page, Locator } from '@playwright/test';

/**
 * Page object for Projects Table Management
 */
export class ProjectsTablePage {
  readonly page: Page;
  readonly title: Locator;
  readonly subtitle: Locator;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly statusFilter: Locator;
  readonly tierFilter: Locator;
  readonly paymentFilter: Locator;
  readonly table: Locator;
  readonly tableRows: Locator;
  readonly loadingState: Locator;
  readonly emptyState: Locator;
  readonly pagination: Locator;
  readonly prevButton: Locator;
  readonly nextButton: Locator;
  readonly pageInfo: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('.projects-table__title');
    this.subtitle = page.locator('.projects-table__subtitle');
    this.searchInput = page.locator('.projects-table__search-input');
    this.searchButton = page.locator('.projects-table__search-btn');
    this.statusFilter = page.locator('.projects-table__filter-select').nth(0);
    this.tierFilter = page.locator('.projects-table__filter-select').nth(1);
    this.paymentFilter = page.locator('.projects-table__filter-select').nth(2);
    this.table = page.locator('.projects-table__table');
    this.tableRows = page.locator('.projects-table__row');
    this.loadingState = page.locator('.projects-table__loading');
    this.emptyState = page.locator('.projects-table__empty');
    this.pagination = page.locator('.projects-table__pagination');
    this.prevButton = page.locator('.projects-table__page-btn').filter({ hasText: 'Prev' });
    this.nextButton = page.locator('.projects-table__page-btn').filter({ hasText: 'Next' });
    this.pageInfo = page.locator('.projects-table__page-info');
  }

  async goto() {
    await this.page.goto('/admin/projects');
  }

  async waitForLoad() {
    await this.page.waitForSelector('.projects-table', { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.searchButton.click();
  }

  async filterByStatus(status: string) {
    await this.statusFilter.selectOption(status);
  }

  async filterByTier(tier: string) {
    await this.tierFilter.selectOption(tier);
  }

  async filterByPaymentStatus(status: string) {
    await this.paymentFilter.selectOption(status);
  }

  async getProjectCount(): Promise<number> {
    return this.tableRows.count();
  }

  async getProjectByIndex(index: number) {
    const row = this.tableRows.nth(index);
    return {
      name: await row.locator('.projects-table__name').textContent(),
      clientEmail: await row.locator('.projects-table__client-email').textContent(),
      clientAddress: await row.locator('.projects-table__client-address').textContent(),
      tier: await row.locator('.projects-table__tier').textContent(),
      status: await row.locator('.projects-table__status').textContent(),
      progress: await row.locator('.projects-table__progress-text').textContent(),
      paymentStatus: await row.locator('.projects-table__payment-status').textContent(),
      paymentAmount: await row.locator('.projects-table__payment-amount').textContent(),
    };
  }

  async viewProject(index: number) {
    const row = this.tableRows.nth(index);
    await row.locator('.projects-table__action--view').click();
  }

  async updateStatus(index: number) {
    const row = this.tableRows.nth(index);
    await row.locator('.projects-table__action--status').click();
  }

  async hasNotionSync(index: number): Promise<boolean> {
    const row = this.tableRows.nth(index);
    return row.locator('.projects-table__notion-badge').isVisible();
  }

  async goToNextPage() {
    await this.nextButton.click();
  }

  async goToPrevPage() {
    await this.prevButton.click();
  }

  async isEmpty(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  async isLoading(): Promise<boolean> {
    return this.loadingState.isVisible();
  }
}
