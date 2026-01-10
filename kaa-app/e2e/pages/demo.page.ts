import { Page, Locator } from '@playwright/test';

/**
 * Page object for Feature Demo page
 */
export class DemoPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly demoTabs: Locator;
  readonly activeTab: Locator;
  readonly demoContent: Locator;
  readonly featureCards: Locator;
  readonly mobileFrame: Locator;
  readonly kanbanBoard: Locator;
  readonly clientPortalDemo: Locator;
  readonly darkModeToggle: Locator;
  readonly loadingDemo: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h1, .demo-title');
    this.demoTabs = page.locator('.demo-tabs button, .demo-nav button, [role="tab"]');
    this.activeTab = page.locator('.demo-tabs button.active, [role="tab"][aria-selected="true"]');
    this.demoContent = page.locator('.demo-content, .demo-panel, [role="tabpanel"]');
    this.featureCards = page.locator('.feature-card, .demo-feature');
    this.mobileFrame = page.locator('.mobile-frame, .phone-mockup');
    this.kanbanBoard = page.locator('.kanban-board, .kanban-demo');
    this.clientPortalDemo = page.locator('.client-portal-demo, .portal-demo');
    this.darkModeToggle = page.locator('.dark-mode-toggle, [data-testid="dark-mode"]');
    this.loadingDemo = page.locator('.skeleton-demo, .loading-demo');
  }

  async goto() {
    await this.page.goto('/demo');
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('.feature-demo, .demo-page', { timeout: 10000 }).catch(() => {});
  }

  async getTabCount(): Promise<number> {
    return this.demoTabs.count();
  }

  async clickTab(name: string) {
    await this.demoTabs.filter({ hasText: new RegExp(name, 'i') }).click();
  }

  async getActiveTabName(): Promise<string> {
    return (await this.activeTab.textContent()) ?? '';
  }

  async getFeatureCardCount(): Promise<number> {
    return this.featureCards.count();
  }

  async hasMobileFrame(): Promise<boolean> {
    return this.mobileFrame.isVisible();
  }

  async hasKanbanBoard(): Promise<boolean> {
    return this.kanbanBoard.isVisible();
  }

  async toggleDarkMode() {
    await this.darkModeToggle.click();
  }

  async isDarkModeActive(): Promise<boolean> {
    const body = this.page.locator('body');
    const classList = await body.getAttribute('class');
    return classList?.includes('dark') ?? false;
  }
}
