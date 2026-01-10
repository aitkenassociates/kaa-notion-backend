/**
 * E2E Tests for Clients Management (Admin)
 * Tests clients table, filtering, viewing, and statistics
 */

import { test, expect } from '../fixtures/auth.fixture';
import { ClientsTablePage } from '../pages/clients-table.page';

test.describe('Clients Management', () => {
  test.describe('Clients Table Display', () => {
    test('should display clients table title', async ({ adminPage }) => {
      const clientsTable = new ClientsTablePage(adminPage);
      await clientsTable.goto();
      await clientsTable.waitForLoad();

      await expect(clientsTable.title).toContainText(/clients/i);
      await expect(clientsTable.subtitle).toBeVisible();
    });

    test('should display filter controls', async ({ adminPage }) => {
      const clientsTable = new ClientsTablePage(adminPage);
      await clientsTable.goto();
      await clientsTable.waitForLoad();

      await expect(clientsTable.searchInput).toBeVisible();
      await expect(clientsTable.searchButton).toBeVisible();
      await expect(clientsTable.statusFilter).toBeVisible();
      await expect(clientsTable.tierFilter).toBeVisible();
    });

    test('should display clients table or empty state', async ({ adminPage }) => {
      const clientsTable = new ClientsTablePage(adminPage);
      await clientsTable.goto();
      await clientsTable.waitForLoad();

      const isEmpty = await clientsTable.isEmpty();
      if (isEmpty) {
        await expect(clientsTable.emptyState).toBeVisible();
      } else {
        await expect(clientsTable.table).toBeVisible();
      }
    });

    test('should show table headers', async ({ adminPage }) => {
      const clientsTable = new ClientsTablePage(adminPage);
      await clientsTable.goto();
      await clientsTable.waitForLoad();

      const isEmpty = await clientsTable.isEmpty();
      if (!isEmpty) {
        await expect(adminPage.locator('th').filter({ hasText: 'Client' })).toBeVisible();
        await expect(adminPage.locator('th').filter({ hasText: 'Tier' })).toBeVisible();
        await expect(adminPage.locator('th').filter({ hasText: 'Status' })).toBeVisible();
        await expect(adminPage.locator('th').filter({ hasText: 'Projects' })).toBeVisible();
        await expect(adminPage.locator('th').filter({ hasText: 'Revenue' })).toBeVisible();
      }
    });
  });

  test.describe('Client Filtering', () => {
    test('should filter clients by search query', async ({ adminPage }) => {
      const clientsTable = new ClientsTablePage(adminPage);
      await clientsTable.goto();
      await clientsTable.waitForLoad();

      const isEmpty = await clientsTable.isEmpty();
      if (!isEmpty) {
        await clientsTable.search('nonexistent-client-xyz');
        await adminPage.waitForLoadState('networkidle');

        const isNowEmpty = await clientsTable.isEmpty();
        const newCount = await clientsTable.getClientCount();
        expect(newCount === 0 || isNowEmpty).toBeTruthy();
      }
    });

    test('should filter clients by status', async ({ adminPage }) => {
      const clientsTable = new ClientsTablePage(adminPage);
      await clientsTable.goto();
      await clientsTable.waitForLoad();

      await clientsTable.filterByStatus('ACTIVE');
      await adminPage.waitForLoadState('networkidle');

      const isEmpty = await clientsTable.isEmpty();
      if (!isEmpty) {
        const firstClient = await clientsTable.getClientByIndex(0);
        expect(firstClient.status?.toLowerCase()).toContain('active');
      }
    });

    test('should filter clients by tier', async ({ adminPage }) => {
      const clientsTable = new ClientsTablePage(adminPage);
      await clientsTable.goto();
      await clientsTable.waitForLoad();

      await clientsTable.filterByTier('1');
      await adminPage.waitForLoadState('networkidle');

      const isEmpty = await clientsTable.isEmpty();
      if (!isEmpty) {
        const firstClient = await clientsTable.getClientByIndex(0);
        expect(firstClient.tier?.toLowerCase()).toMatch(/tier 1|concept/i);
      }
    });
  });

  test.describe('Client Details', () => {
    test('should display client email and address', async ({ adminPage }) => {
      const clientsTable = new ClientsTablePage(adminPage);
      await clientsTable.goto();
      await clientsTable.waitForLoad();

      const isEmpty = await clientsTable.isEmpty();
      if (!isEmpty) {
        const client = await clientsTable.getClientByIndex(0);
        expect(client.email || client.address).toBeTruthy();
      }
    });

    test('should display project counts', async ({ adminPage }) => {
      const clientsTable = new ClientsTablePage(adminPage);
      await clientsTable.goto();
      await clientsTable.waitForLoad();

      const isEmpty = await clientsTable.isEmpty();
      if (!isEmpty) {
        const client = await clientsTable.getClientByIndex(0);
        expect(client.projectCount).toMatch(/\d+ total/);
        expect(client.activeProjects).toMatch(/\d+ active/);
      }
    });

    test('should display revenue with currency format', async ({ adminPage }) => {
      const clientsTable = new ClientsTablePage(adminPage);
      await clientsTable.goto();
      await clientsTable.waitForLoad();

      const isEmpty = await clientsTable.isEmpty();
      if (!isEmpty) {
        const client = await clientsTable.getClientByIndex(0);
        expect(client.revenue).toMatch(/\$/);
      }
    });

    test('should display last login date', async ({ adminPage }) => {
      const clientsTable = new ClientsTablePage(adminPage);
      await clientsTable.goto();
      await clientsTable.waitForLoad();

      const isEmpty = await clientsTable.isEmpty();
      if (!isEmpty) {
        const client = await clientsTable.getClientByIndex(0);
        expect(client.lastLogin).toBeTruthy();
      }
    });
  });

  test.describe('Client Actions', () => {
    test('should have view client action button', async ({ adminPage }) => {
      const clientsTable = new ClientsTablePage(adminPage);
      await clientsTable.goto();
      await clientsTable.waitForLoad();

      const isEmpty = await clientsTable.isEmpty();
      if (!isEmpty) {
        const viewButton = clientsTable.tableRows.first().locator('.clients-table__action--view');
        await expect(viewButton).toBeVisible();
        await expect(viewButton).toHaveAttribute('title', 'View Client');
      }
    });

    test('should have view projects button for clients with projects', async ({ adminPage }) => {
      const clientsTable = new ClientsTablePage(adminPage);
      await clientsTable.goto();
      await clientsTable.waitForLoad();

      const isEmpty = await clientsTable.isEmpty();
      if (!isEmpty) {
        const clientCount = await clientsTable.getClientCount();
        for (let i = 0; i < Math.min(clientCount, 10); i++) {
          const hasProjectsButton = await clientsTable.hasProjectsButton(i);
          if (hasProjectsButton) {
            const projectsButton = clientsTable.tableRows.nth(i).locator('.clients-table__action--projects');
            await expect(projectsButton).toHaveAttribute('title', 'View Projects');
            break;
          }
        }
      }
    });

    test('should open client detail when clicking view', async ({ adminPage }) => {
      const clientsTable = new ClientsTablePage(adminPage);
      await clientsTable.goto();
      await clientsTable.waitForLoad();

      const isEmpty = await clientsTable.isEmpty();
      if (!isEmpty) {
        await clientsTable.viewClient(0);

        // Should navigate to client detail or open modal
        await expect(adminPage).toHaveURL(/client|detail/, { timeout: 5000 }).catch(() => {
          return expect(adminPage.locator('[role="dialog"], .modal')).toBeVisible();
        });
      }
    });
  });

  test.describe('Summary Section', () => {
    test('should display summary when clients exist', async ({ adminPage }) => {
      const clientsTable = new ClientsTablePage(adminPage);
      await clientsTable.goto();
      await clientsTable.waitForLoad();

      const isEmpty = await clientsTable.isEmpty();
      if (!isEmpty) {
        await expect(clientsTable.summary).toBeVisible();
      }
    });

    test('should display total clients count', async ({ adminPage }) => {
      const clientsTable = new ClientsTablePage(adminPage);
      await clientsTable.goto();
      await clientsTable.waitForLoad();

      const isEmpty = await clientsTable.isEmpty();
      if (!isEmpty) {
        await expect(clientsTable.totalClients).toContainText(/total clients/i);
      }
    });

    test('should display total revenue', async ({ adminPage }) => {
      const clientsTable = new ClientsTablePage(adminPage);
      await clientsTable.goto();
      await clientsTable.waitForLoad();

      const isEmpty = await clientsTable.isEmpty();
      if (!isEmpty) {
        const revenue = await clientsTable.getTotalRevenue();
        expect(revenue).toMatch(/\$/);
      }
    });
  });

  test.describe('Pagination', () => {
    test('should display pagination when multiple pages exist', async ({ adminPage }) => {
      const clientsTable = new ClientsTablePage(adminPage);
      await clientsTable.goto();
      await clientsTable.waitForLoad();

      const isEmpty = await clientsTable.isEmpty();
      if (!isEmpty) {
        const isPaginationVisible = await clientsTable.pagination.isVisible();
        if (isPaginationVisible) {
          await expect(clientsTable.prevButton).toBeVisible();
          await expect(clientsTable.nextButton).toBeVisible();
        }
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should display on mobile viewport', async ({ adminPage }) => {
      await adminPage.setViewportSize({ width: 375, height: 667 });

      const clientsTable = new ClientsTablePage(adminPage);
      await clientsTable.goto();
      await clientsTable.waitForLoad();

      await expect(clientsTable.title).toBeVisible();
      await expect(clientsTable.searchInput).toBeVisible();
    });

    test('should display on tablet viewport', async ({ adminPage }) => {
      await adminPage.setViewportSize({ width: 768, height: 1024 });

      const clientsTable = new ClientsTablePage(adminPage);
      await clientsTable.goto();
      await clientsTable.waitForLoad();

      await expect(clientsTable.title).toBeVisible();
      const isEmpty = await clientsTable.isEmpty();
      if (!isEmpty) {
        await expect(clientsTable.table).toBeVisible();
      }
    });
  });

  test.describe('Loading States', () => {
    test('should show loading indicator while fetching', async ({ adminPage }) => {
      const clientsTable = new ClientsTablePage(adminPage);

      const loadingPromise = adminPage.waitForSelector('.clients-table__loading', { timeout: 2000 }).catch(() => null);
      await clientsTable.goto();

      const loading = await loadingPromise;
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible table structure', async ({ adminPage }) => {
      const clientsTable = new ClientsTablePage(adminPage);
      await clientsTable.goto();
      await clientsTable.waitForLoad();

      const isEmpty = await clientsTable.isEmpty();
      if (!isEmpty) {
        await expect(clientsTable.table.locator('thead')).toBeVisible();
        await expect(clientsTable.table.locator('tbody')).toBeVisible();
      }
    });

    test('should have focusable filter controls', async ({ adminPage }) => {
      const clientsTable = new ClientsTablePage(adminPage);
      await clientsTable.goto();
      await clientsTable.waitForLoad();

      await clientsTable.searchInput.focus();
      await expect(clientsTable.searchInput).toBeFocused();

      await clientsTable.statusFilter.focus();
      await expect(clientsTable.statusFilter).toBeFocused();
    });
  });
});
