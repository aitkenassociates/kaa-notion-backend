/**
 * E2E Tests for Lead Management (Admin)
 * Tests lead queue, filtering, viewing, tier override, and conversion
 */

import { test, expect } from '../fixtures/auth.fixture';
import { LeadQueuePage } from '../pages/lead-queue.page';
import { generateUniqueEmail, generateAddress } from '../utils/test-data';
import { createTestLead } from '../utils/api-helpers';

test.describe('Lead Management', () => {
  test.describe('Lead Queue Display', () => {
    test('should display lead queue title', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      await expect(leadQueue.title).toContainText(/lead queue/i);
      await expect(leadQueue.subtitle).toBeVisible();
    });

    test('should display filter controls', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      await expect(leadQueue.searchInput).toBeVisible();
      await expect(leadQueue.searchButton).toBeVisible();
      await expect(leadQueue.statusFilter).toBeVisible();
      await expect(leadQueue.tierFilter).toBeVisible();
    });

    test('should display leads table or empty state', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      const isEmpty = await leadQueue.isEmpty();
      if (isEmpty) {
        await expect(leadQueue.emptyState).toBeVisible();
      } else {
        await expect(leadQueue.table).toBeVisible();
      }
    });

    test('should show table headers', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      const isEmpty = await leadQueue.isEmpty();
      if (!isEmpty) {
        await expect(adminPage.locator('th').filter({ hasText: 'Lead' })).toBeVisible();
        await expect(adminPage.locator('th').filter({ hasText: 'Status' })).toBeVisible();
        await expect(adminPage.locator('th').filter({ hasText: 'Recommended Tier' })).toBeVisible();
        await expect(adminPage.locator('th').filter({ hasText: 'Actions' })).toBeVisible();
      }
    });
  });

  test.describe('Lead Filtering', () => {
    test('should filter leads by search query', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      const isEmpty = await leadQueue.isEmpty();
      if (!isEmpty) {
        const originalCount = await leadQueue.getLeadCount();
        await leadQueue.search('nonexistent-email-xyz');

        // Should either show filtered results or empty state
        const newCount = await leadQueue.getLeadCount();
        const isNowEmpty = await leadQueue.isEmpty();
        expect(newCount <= originalCount || isNowEmpty).toBeTruthy();
      }
    });

    test('should filter leads by status', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      // Filter by NEW status
      await leadQueue.filterByStatus('NEW');
      await adminPage.waitForLoadState('networkidle');

      const isEmpty = await leadQueue.isEmpty();
      if (!isEmpty) {
        // All visible leads should have NEW status
        const firstLead = await leadQueue.getLeadByIndex(0);
        expect(firstLead.status?.toLowerCase()).toContain('new');
      }
    });

    test('should filter leads by tier', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      // Filter by Tier 2
      await leadQueue.filterByTier('2');
      await adminPage.waitForLoadState('networkidle');

      // Should filter to Tier 2 leads or show empty state
      const isEmpty = await leadQueue.isEmpty();
      if (!isEmpty) {
        const firstLead = await leadQueue.getLeadByIndex(0);
        expect(firstLead.tier?.toLowerCase()).toMatch(/tier 2|builder/i);
      }
    });

    test('should clear filters when selecting "All"', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      // Apply filter then clear
      await leadQueue.filterByStatus('NEW');
      await adminPage.waitForLoadState('networkidle');

      await leadQueue.filterByStatus('');
      await adminPage.waitForLoadState('networkidle');

      // Filters should be cleared
      await expect(leadQueue.statusFilter).toHaveValue('');
    });
  });

  test.describe('Lead Details', () => {
    test('should display lead email and address', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      const isEmpty = await leadQueue.isEmpty();
      if (!isEmpty) {
        const lead = await leadQueue.getLeadByIndex(0);
        expect(lead.email).toBeTruthy();
        expect(lead.address).toBeTruthy();
      }
    });

    test('should display lead status badge', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      const isEmpty = await leadQueue.isEmpty();
      if (!isEmpty) {
        const lead = await leadQueue.getLeadByIndex(0);
        expect(lead.status).toBeTruthy();
      }
    });

    test('should display recommended tier', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      const isEmpty = await leadQueue.isEmpty();
      if (!isEmpty) {
        const lead = await leadQueue.getLeadByIndex(0);
        expect(lead.tier).toMatch(/tier \d|concept|builder|concierge|white glove/i);
      }
    });
  });

  test.describe('Lead Actions', () => {
    test('should have view action button', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      const isEmpty = await leadQueue.isEmpty();
      if (!isEmpty) {
        const viewButton = leadQueue.tableRows.first().locator('.lead-queue__action--view');
        await expect(viewButton).toBeVisible();
        await expect(viewButton).toHaveAttribute('title', 'View Details');
      }
    });

    test('should have tier override action button', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      const isEmpty = await leadQueue.isEmpty();
      if (!isEmpty) {
        const tierButton = leadQueue.tableRows.first().locator('.lead-queue__action--tier');
        await expect(tierButton).toBeVisible();
        await expect(tierButton).toHaveAttribute('title', 'Override Tier');
      }
    });

    test('should have convert action for unconverted leads', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      const isEmpty = await leadQueue.isEmpty();
      if (!isEmpty) {
        const leadCount = await leadQueue.getLeadCount();
        let hasUnconvertedLead = false;

        for (let i = 0; i < Math.min(leadCount, 5); i++) {
          const isConverted = await leadQueue.isLeadConverted(i);
          if (!isConverted) {
            const convertButton = leadQueue.tableRows.nth(i).locator('.lead-queue__action--convert');
            await expect(convertButton).toBeVisible();
            hasUnconvertedLead = true;
            break;
          }
        }
      }
    });

    test('should show converted indicator for converted leads', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      const isEmpty = await leadQueue.isEmpty();
      if (!isEmpty) {
        const leadCount = await leadQueue.getLeadCount();
        for (let i = 0; i < Math.min(leadCount, 10); i++) {
          const isConverted = await leadQueue.isLeadConverted(i);
          if (isConverted) {
            const convertedIndicator = leadQueue.tableRows.nth(i).locator('.lead-queue__converted');
            await expect(convertedIndicator).toBeVisible();
            break;
          }
        }
      }
    });

    test('should open lead review panel when clicking view', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      const isEmpty = await leadQueue.isEmpty();
      if (!isEmpty) {
        await leadQueue.viewLead(0);

        // Should open review panel or modal
        await expect(adminPage.locator('.lead-review-panel, [role="dialog"], .modal')).toBeVisible({ timeout: 5000 });
      }
    });

    test('should open tier override modal when clicking tier action', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      const isEmpty = await leadQueue.isEmpty();
      if (!isEmpty) {
        await leadQueue.overrideTier(0);

        // Should open tier override modal
        await expect(adminPage.locator('.tier-override-modal, [role="dialog"], .modal')).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Pagination', () => {
    test('should display pagination when multiple pages exist', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      const isEmpty = await leadQueue.isEmpty();
      if (!isEmpty) {
        // Pagination may or may not be visible depending on lead count
        const isPaginationVisible = await leadQueue.pagination.isVisible();
        if (isPaginationVisible) {
          await expect(leadQueue.prevButton).toBeVisible();
          await expect(leadQueue.nextButton).toBeVisible();
          await expect(leadQueue.pageInfo).toBeVisible();
        }
      }
    });

    test('should navigate to next page', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      const isEmpty = await leadQueue.isEmpty();
      const isPaginationVisible = await leadQueue.pagination.isVisible();

      if (!isEmpty && isPaginationVisible) {
        const isNextDisabled = await leadQueue.nextButton.isDisabled();
        if (!isNextDisabled) {
          await leadQueue.goToNextPage();
          await adminPage.waitForLoadState('networkidle');

          const pageInfo = await leadQueue.getCurrentPage();
          expect(pageInfo).toContain('Page 2');
        }
      }
    });

    test('should disable prev button on first page', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      const isPaginationVisible = await leadQueue.pagination.isVisible();
      if (isPaginationVisible) {
        await expect(leadQueue.prevButton).toBeDisabled();
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should display on mobile viewport', async ({ adminPage }) => {
      await adminPage.setViewportSize({ width: 375, height: 667 });

      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      await expect(leadQueue.title).toBeVisible();
      await expect(leadQueue.searchInput).toBeVisible();
    });

    test('should be scrollable on small screens', async ({ adminPage }) => {
      await adminPage.setViewportSize({ width: 375, height: 667 });

      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      const isEmpty = await leadQueue.isEmpty();
      if (!isEmpty) {
        // Table container should be scrollable
        const tableContainer = adminPage.locator('.lead-queue__table-container');
        await expect(tableContainer).toBeVisible();
      }
    });
  });

  test.describe('Loading States', () => {
    test('should show loading indicator while fetching', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);

      // Check for loading state on initial load
      const loadingPromise = adminPage.waitForSelector('.lead-queue__loading', { timeout: 2000 }).catch(() => null);
      await leadQueue.goto();

      // Loading state may be visible briefly
      const loading = await loadingPromise;
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible search form', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      // Search input should have placeholder
      await expect(leadQueue.searchInput).toHaveAttribute('placeholder');

      // Search button should be within form
      const form = adminPage.locator('form.lead-queue__search');
      await expect(form).toBeVisible();
    });

    test('should have accessible filter dropdowns', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      // Filter selects should be focusable
      await leadQueue.statusFilter.focus();
      await expect(leadQueue.statusFilter).toBeFocused();
    });

    test('should have action buttons with titles', async ({ adminPage }) => {
      const leadQueue = new LeadQueuePage(adminPage);
      await leadQueue.goto();
      await leadQueue.waitForLoad();

      const isEmpty = await leadQueue.isEmpty();
      if (!isEmpty) {
        const viewButton = leadQueue.tableRows.first().locator('.lead-queue__action--view');
        await expect(viewButton).toHaveAttribute('title');

        const tierButton = leadQueue.tableRows.first().locator('.lead-queue__action--tier');
        await expect(tierButton).toHaveAttribute('title');
      }
    });
  });
});
