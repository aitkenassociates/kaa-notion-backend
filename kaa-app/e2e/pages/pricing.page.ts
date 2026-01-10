import { Page, Locator } from '@playwright/test';

/**
 * Page object for Pricing Page
 */
export class PricingPageObject {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly pageSubtitle: Locator;
  readonly tierCards: Locator;
  readonly tier1Card: Locator;
  readonly tier2Card: Locator;
  readonly tier3Card: Locator;
  readonly tier4Section: Locator;
  readonly recommendedBadge: Locator;
  readonly mostPopularBadge: Locator;
  readonly faqSection: Locator;
  readonly faqItems: Locator;
  readonly selectButtons: Locator;
  readonly getStartedButtons: Locator;
  readonly loadingState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('.pricing-title, .page-title, h1').first();
    this.pageSubtitle = page.locator('.pricing-subtitle, .page-subtitle');
    this.tierCards = page.locator('.tier-card, .pricing-card, [data-testid="tier-card"]');
    this.tier1Card = this.tierCards.filter({ hasText: /tier 1|diy|guidance|\$299/i });
    this.tier2Card = this.tierCards.filter({ hasText: /tier 2|design package|\$1,499/i });
    this.tier3Card = this.tierCards.filter({ hasText: /tier 3|full service|\$4,999/i });
    this.tier4Section = page.locator('.tier-4-section, .premium-section, [data-testid="tier-4"]');
    this.recommendedBadge = page.locator('.recommended-badge, .recommended, [data-testid="recommended"]');
    this.mostPopularBadge = page.locator('.most-popular, .popular-badge');
    this.faqSection = page.locator('.faq-section, [data-testid="faq"]');
    this.faqItems = page.locator('.faq-item, .faq-question, [data-testid="faq-item"]');
    this.selectButtons = page.locator('.tier-card button, .pricing-card button').filter({ hasText: /select|choose|get started/i });
    this.getStartedButtons = page.getByRole('button', { name: /get started/i });
    this.loadingState = page.locator('.loading, [data-testid="loading"]');
  }

  async goto() {
    await this.page.goto('/pricing');
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('.pricing-page, .pricing, [data-testid="pricing"]', { timeout: 10000 }).catch(() => {});
  }

  async getTierCardCount(): Promise<number> {
    return this.tierCards.count();
  }

  async getTierByIndex(index: number) {
    const card = this.tierCards.nth(index);
    return {
      name: await card.locator('.tier-name, h3, h2').first().textContent(),
      price: await card.locator('.tier-price, .price').textContent().catch(() => ''),
      description: await card.locator('.tier-description, .description').textContent().catch(() => ''),
      isRecommended: await card.locator('.recommended').isVisible().catch(() => false),
    };
  }

  async selectTier(tierNumber: 1 | 2 | 3) {
    const card = tierNumber === 1 ? this.tier1Card : tierNumber === 2 ? this.tier2Card : this.tier3Card;
    await card.locator('button').click();
  }

  async getTier1Price(): Promise<string> {
    return (await this.tier1Card.locator('.price, .tier-price').textContent()) ?? '';
  }

  async getTier2Price(): Promise<string> {
    return (await this.tier2Card.locator('.price, .tier-price').textContent()) ?? '';
  }

  async getTier3Price(): Promise<string> {
    return (await this.tier3Card.locator('.price, .tier-price').textContent()) ?? '';
  }

  async hasRecommendedTier(): Promise<boolean> {
    return this.recommendedBadge.isVisible();
  }

  async hasMostPopular(): Promise<boolean> {
    return this.mostPopularBadge.isVisible();
  }

  async getFaqCount(): Promise<number> {
    return this.faqItems.count();
  }

  async expandFaq(index: number) {
    await this.faqItems.nth(index).click();
  }

  async isFaqExpanded(index: number): Promise<boolean> {
    const faq = this.faqItems.nth(index);
    const expanded = await faq.getAttribute('aria-expanded');
    const hasAnswer = await faq.locator('.faq-answer, .answer').isVisible();
    return expanded === 'true' || hasAnswer;
  }

  async getTierFeatures(tierNumber: 1 | 2 | 3): Promise<string[]> {
    const card = tierNumber === 1 ? this.tier1Card : tierNumber === 2 ? this.tier2Card : this.tier3Card;
    const features = card.locator('.feature-item, .tier-feature, li');
    const count = await features.count();
    const featureTexts: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await features.nth(i).textContent();
      if (text) featureTexts.push(text.trim());
    }

    return featureTexts;
  }

  async hasTier4Callout(): Promise<boolean> {
    return this.tier4Section.isVisible();
  }
}
