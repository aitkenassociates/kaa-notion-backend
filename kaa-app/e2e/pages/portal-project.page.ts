import { Page, Locator } from '@playwright/test';

/**
 * Page object for Client Portal Project Detail
 */
export class PortalProjectPage {
  readonly page: Page;
  readonly projectTitle: Locator;
  readonly statusBadge: Locator;
  readonly tierBadge: Locator;
  readonly progressSection: Locator;
  readonly progressRing: Locator;
  readonly progressPercentage: Locator;
  readonly milestonesSection: Locator;
  readonly milestoneTimeline: Locator;
  readonly milestoneItems: Locator;
  readonly deliverablesSection: Locator;
  readonly deliverablesTab: Locator;
  readonly deliverableCards: Locator;
  readonly backButton: Locator;
  readonly messagesSection: Locator;
  readonly paymentSection: Locator;
  readonly loadingState: Locator;
  readonly errorState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.projectTitle = page.getByRole('heading', { level: 1 });
    this.statusBadge = page.locator('[data-testid="project-status"], .project-status, .status-badge');
    this.tierBadge = page.locator('[data-testid="project-tier"], .project-tier, .tier-badge');
    this.progressSection = page.locator('.progress-section, [data-testid="progress"]');
    this.progressRing = page.locator('.progress-ring, .progress-circle');
    this.progressPercentage = page.locator('.progress-percentage, .progress-value');
    this.milestonesSection = page.locator('.milestones-section, [data-testid="milestones"]');
    this.milestoneTimeline = page.locator('.milestone-timeline, .timeline');
    this.milestoneItems = page.locator('.milestone-item, [data-testid="milestone"]');
    this.deliverablesSection = page.locator('.deliverables-section, [data-testid="deliverables"]');
    this.deliverablesTab = page.getByRole('tab', { name: /deliverables/i });
    this.deliverableCards = page.locator('.deliverable-card, [data-testid="deliverable"]');
    this.backButton = page.getByRole('button', { name: /back/i }).or(page.getByRole('link', { name: /back/i }));
    this.messagesSection = page.locator('.messages-section, [data-testid="messages"]');
    this.paymentSection = page.locator('.payment-section, [data-testid="payments"]');
    this.loadingState = page.locator('.loading, [data-testid="loading"]');
    this.errorState = page.locator('.error, [data-testid="error"]');
  }

  async goto(projectId: string) {
    await this.page.goto(`/portal/projects/${projectId}`);
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('[data-testid="project-detail"], .project-detail, .project-page', { timeout: 10000 }).catch(() => {});
  }

  async getProjectName(): Promise<string> {
    return (await this.projectTitle.textContent()) ?? '';
  }

  async getStatus(): Promise<string> {
    return (await this.statusBadge.textContent()) ?? '';
  }

  async getTier(): Promise<string> {
    return (await this.tierBadge.textContent()) ?? '';
  }

  async getProgressPercentage(): Promise<string> {
    return (await this.progressPercentage.textContent()) ?? '0%';
  }

  async getMilestoneCount(): Promise<number> {
    return this.milestoneItems.count();
  }

  async getMilestoneByIndex(index: number) {
    const item = this.milestoneItems.nth(index);
    return {
      name: await item.locator('.milestone-name, [data-testid="name"]').textContent(),
      status: await item.locator('.milestone-status, [data-testid="status"]').textContent().catch(() => ''),
      dueDate: await item.locator('.milestone-date, [data-testid="due-date"]').textContent().catch(() => ''),
    };
  }

  async getCompletedMilestoneCount(): Promise<number> {
    return this.milestoneItems.filter({ has: this.page.locator('[data-status="completed"], .completed') }).count();
  }

  async clickDeliverablesTab() {
    if (await this.deliverablesTab.isVisible()) {
      await this.deliverablesTab.click();
    }
  }

  async getDeliverableCount(): Promise<number> {
    return this.deliverableCards.count();
  }

  async getDeliverableByIndex(index: number) {
    const card = this.deliverableCards.nth(index);
    return {
      name: await card.locator('.deliverable-name, [data-testid="name"]').textContent(),
      category: await card.locator('.deliverable-category, [data-testid="category"]').textContent().catch(() => ''),
      fileSize: await card.locator('.deliverable-size, [data-testid="size"]').textContent().catch(() => ''),
      date: await card.locator('.deliverable-date, [data-testid="date"]').textContent().catch(() => ''),
    };
  }

  async downloadDeliverable(index: number) {
    const downloadButton = this.deliverableCards.nth(index).getByRole('button', { name: /download/i });
    const downloadPromise = this.page.waitForEvent('download');
    await downloadButton.click();
    return downloadPromise;
  }

  async goBack() {
    await this.backButton.click();
  }

  async hasError(): Promise<boolean> {
    return this.errorState.isVisible();
  }

  async isLoading(): Promise<boolean> {
    return this.loadingState.isVisible();
  }
}
