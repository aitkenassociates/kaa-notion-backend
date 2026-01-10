import { Page, Locator } from '@playwright/test';

/**
 * Page object for User Profile Page
 */
export class ProfilePage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly emailDisplay: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly phoneInput: Locator;
  readonly addressDisplay: Locator;
  readonly tierDisplay: Locator;
  readonly accountSection: Locator;
  readonly preferencesSection: Locator;
  readonly notificationsSection: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly changePasswordButton: Locator;
  readonly successMessage: Locator;
  readonly errorMessage: Locator;
  readonly loadingState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByRole('heading', { level: 1 });
    this.emailDisplay = page.locator('[data-testid="email"], .profile-email');
    this.nameInput = page.locator('[name="name"], [data-testid="name-input"]');
    this.emailInput = page.locator('[name="email"], [data-testid="email-input"]');
    this.phoneInput = page.locator('[name="phone"], [data-testid="phone-input"]');
    this.addressDisplay = page.locator('[data-testid="address"], .profile-address');
    this.tierDisplay = page.locator('[data-testid="tier"], .profile-tier');
    this.accountSection = page.locator('.account-section, [data-testid="account"]');
    this.preferencesSection = page.locator('.preferences-section, [data-testid="preferences"]');
    this.notificationsSection = page.locator('.notifications-section, [data-testid="notifications"]');
    this.saveButton = page.getByRole('button', { name: /save|update/i });
    this.cancelButton = page.getByRole('button', { name: /cancel/i });
    this.changePasswordButton = page.getByRole('button', { name: /change password/i });
    this.successMessage = page.locator('.success-message, [data-testid="success"]');
    this.errorMessage = page.locator('.error-message, [data-testid="error"]');
    this.loadingState = page.locator('.loading, [data-testid="loading"]');
  }

  async goto() {
    await this.page.goto('/portal/profile');
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('.profile, [data-testid="profile"]', { timeout: 10000 }).catch(() => {});
  }

  async getEmail(): Promise<string> {
    if (await this.emailDisplay.isVisible()) {
      return (await this.emailDisplay.textContent()) ?? '';
    }
    if (await this.emailInput.isVisible()) {
      return await this.emailInput.inputValue();
    }
    return '';
  }

  async getName(): Promise<string> {
    return await this.nameInput.inputValue().catch(() => '');
  }

  async setName(name: string) {
    await this.nameInput.fill(name);
  }

  async getPhone(): Promise<string> {
    return await this.phoneInput.inputValue().catch(() => '');
  }

  async setPhone(phone: string) {
    await this.phoneInput.fill(phone);
  }

  async getTier(): Promise<string> {
    return (await this.tierDisplay.textContent()) ?? '';
  }

  async save() {
    await this.saveButton.click();
  }

  async cancel() {
    await this.cancelButton.click();
  }

  async clickChangePassword() {
    await this.changePasswordButton.click();
  }

  async hasSuccessMessage(): Promise<boolean> {
    return this.successMessage.isVisible();
  }

  async hasErrorMessage(): Promise<boolean> {
    return this.errorMessage.isVisible();
  }

  async isLoading(): Promise<boolean> {
    return this.loadingState.isVisible();
  }
}
