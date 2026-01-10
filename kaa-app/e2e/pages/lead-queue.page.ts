import { Page, Locator } from '@playwright/test';

/**
 * Page object for Lead Queue Management
 */
export class LeadQueuePage {
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
  readonly pagination: Locator;
  readonly prevButton: Locator;
  readonly nextButton: Locator;
  readonly pageInfo: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('.lead-queue__title');
    this.subtitle = page.locator('.lead-queue__subtitle');
    this.searchInput = page.locator('.lead-queue__search-input');
    this.searchButton = page.locator('.lead-queue__search-btn');
    this.statusFilter = page.locator('.lead-queue__filter-select').first();
    this.tierFilter = page.locator('.lead-queue__filter-select').last();
    this.table = page.locator('.lead-queue__table');
    this.tableRows = page.locator('.lead-queue__row');
    this.loadingState = page.locator('.lead-queue__loading');
    this.emptyState = page.locator('.lead-queue__empty');
    this.pagination = page.locator('.lead-queue__pagination');
    this.prevButton = page.locator('.lead-queue__page-btn').filter({ hasText: 'Prev' });
    this.nextButton = page.locator('.lead-queue__page-btn').filter({ hasText: 'Next' });
    this.pageInfo = page.locator('.lead-queue__page-info');
  }

  async goto() {
    await this.page.goto('/admin/leads');
  }

  async waitForLoad() {
    await this.page.waitForSelector('.lead-queue', { timeout: 10000 });
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

  async getLeadCount(): Promise<number> {
    return this.tableRows.count();
  }

  async getLeadByIndex(index: number) {
    const row = this.tableRows.nth(index);
    return {
      email: await row.locator('.lead-queue__lead-email').textContent(),
      address: await row.locator('.lead-queue__lead-address').textContent(),
      status: await row.locator('.lead-queue__status').textContent(),
      tier: await row.locator('.lead-queue__tier').textContent(),
    };
  }

  async viewLead(index: number) {
    const row = this.tableRows.nth(index);
    await row.locator('.lead-queue__action--view').click();
  }

  async overrideTier(index: number) {
    const row = this.tableRows.nth(index);
    await row.locator('.lead-queue__action--tier').click();
  }

  async convertLead(index: number) {
    const row = this.tableRows.nth(index);
    await row.locator('.lead-queue__action--convert').click();
  }

  async isLeadConverted(index: number): Promise<boolean> {
    const row = this.tableRows.nth(index);
    return row.locator('.lead-queue__converted').isVisible();
  }

  async goToNextPage() {
    await this.nextButton.click();
  }

  async goToPrevPage() {
    await this.prevButton.click();
  }

  async getCurrentPage(): Promise<string> {
    const info = await this.pageInfo.textContent();
    return info ?? '';
  }

  async isEmpty(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  async isLoading(): Promise<boolean> {
    return this.loadingState.isVisible();
  }
}
