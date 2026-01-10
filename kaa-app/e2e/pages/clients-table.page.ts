import { Page, Locator } from '@playwright/test';

/**
 * Page object for Clients Table Management
 */
export class ClientsTablePage {
  readonly page: Page;
  readonly title: Locator;
  readonly subtitle: Locator;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly statusFilter: Locator;
  readonly tierFilter: Locator;
  readonly table: Locator;
  readonly tableRows: Locator;
  readonly loadingState: Locator;
  readonly emptyState: Locator;
  readonly summary: Locator;
  readonly totalClients: Locator;
  readonly totalRevenue: Locator;
  readonly pagination: Locator;
  readonly prevButton: Locator;
  readonly nextButton: Locator;
  readonly pageInfo: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('.clients-table__title');
    this.subtitle = page.locator('.clients-table__subtitle');
    this.searchInput = page.locator('.clients-table__search-input');
    this.searchButton = page.locator('.clients-table__search-btn');
    this.statusFilter = page.locator('.clients-table__filter-select').first();
    this.tierFilter = page.locator('.clients-table__filter-select').last();
    this.table = page.locator('.clients-table__table');
    this.tableRows = page.locator('.clients-table__row');
    this.loadingState = page.locator('.clients-table__loading');
    this.emptyState = page.locator('.clients-table__empty');
    this.summary = page.locator('.clients-table__summary');
    this.totalClients = page.locator('.clients-table__summary-item').first();
    this.totalRevenue = page.locator('.clients-table__summary-value--revenue');
    this.pagination = page.locator('.clients-table__pagination');
    this.prevButton = page.locator('.clients-table__page-btn').filter({ hasText: 'Prev' });
    this.nextButton = page.locator('.clients-table__page-btn').filter({ hasText: 'Next' });
    this.pageInfo = page.locator('.clients-table__page-info');
  }

  async goto() {
    await this.page.goto('/admin/clients');
  }

  async waitForLoad() {
    await this.page.waitForSelector('.clients-table', { timeout: 10000 });
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

  async getClientCount(): Promise<number> {
    return this.tableRows.count();
  }

  async getClientByIndex(index: number) {
    const row = this.tableRows.nth(index);
    return {
      email: await row.locator('.clients-table__client-email').textContent(),
      address: await row.locator('.clients-table__client-address').textContent(),
      tier: await row.locator('.clients-table__tier').textContent(),
      status: await row.locator('.clients-table__status').textContent(),
      projectCount: await row.locator('.clients-table__project-count').textContent(),
      activeProjects: await row.locator('.clients-table__project-active').textContent(),
      revenue: await row.locator('.clients-table__revenue').textContent(),
      lastLogin: await row.locator('.clients-table__date').textContent(),
    };
  }

  async viewClient(index: number) {
    const row = this.tableRows.nth(index);
    await row.locator('.clients-table__action--view').click();
  }

  async viewClientProjects(index: number) {
    const row = this.tableRows.nth(index);
    await row.locator('.clients-table__action--projects').click();
  }

  async hasProjectsButton(index: number): Promise<boolean> {
    const row = this.tableRows.nth(index);
    return row.locator('.clients-table__action--projects').isVisible();
  }

  async getTotalRevenue(): Promise<string> {
    return (await this.totalRevenue.textContent()) ?? '$0';
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
