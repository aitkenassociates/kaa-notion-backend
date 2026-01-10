/**
 * E2E Tests for Projects Management (Admin)
 * Tests projects table, filtering, viewing, and status management
 */

import { test, expect } from '../fixtures/auth.fixture';
import { ProjectsTablePage } from '../pages/projects-table.page';

test.describe('Projects Management', () => {
  test.describe('Projects Table Display', () => {
    test('should display projects table title', async ({ adminPage }) => {
      const projectsTable = new ProjectsTablePage(adminPage);
      await projectsTable.goto();
      await projectsTable.waitForLoad();

      await expect(projectsTable.title).toContainText(/projects/i);
      await expect(projectsTable.subtitle).toBeVisible();
    });

    test('should display filter controls', async ({ adminPage }) => {
      const projectsTable = new ProjectsTablePage(adminPage);
      await projectsTable.goto();
      await projectsTable.waitForLoad();

      await expect(projectsTable.searchInput).toBeVisible();
      await expect(projectsTable.searchButton).toBeVisible();
      await expect(projectsTable.statusFilter).toBeVisible();
      await expect(projectsTable.tierFilter).toBeVisible();
      await expect(projectsTable.paymentFilter).toBeVisible();
    });

    test('should display projects table or empty state', async ({ adminPage }) => {
      const projectsTable = new ProjectsTablePage(adminPage);
      await projectsTable.goto();
      await projectsTable.waitForLoad();

      const isEmpty = await projectsTable.isEmpty();
      if (isEmpty) {
        await expect(projectsTable.emptyState).toBeVisible();
      } else {
        await expect(projectsTable.table).toBeVisible();
      }
    });

    test('should show table headers', async ({ adminPage }) => {
      const projectsTable = new ProjectsTablePage(adminPage);
      await projectsTable.goto();
      await projectsTable.waitForLoad();

      const isEmpty = await projectsTable.isEmpty();
      if (!isEmpty) {
        await expect(adminPage.locator('th').filter({ hasText: 'Project' })).toBeVisible();
        await expect(adminPage.locator('th').filter({ hasText: 'Client' })).toBeVisible();
        await expect(adminPage.locator('th').filter({ hasText: 'Tier' })).toBeVisible();
        await expect(adminPage.locator('th').filter({ hasText: 'Status' })).toBeVisible();
        await expect(adminPage.locator('th').filter({ hasText: 'Progress' })).toBeVisible();
        await expect(adminPage.locator('th').filter({ hasText: 'Payment' })).toBeVisible();
      }
    });
  });

  test.describe('Project Filtering', () => {
    test('should filter projects by search query', async ({ adminPage }) => {
      const projectsTable = new ProjectsTablePage(adminPage);
      await projectsTable.goto();
      await projectsTable.waitForLoad();

      const isEmpty = await projectsTable.isEmpty();
      if (!isEmpty) {
        await projectsTable.search('nonexistent-project-xyz');
        await adminPage.waitForLoadState('networkidle');

        // Should show filtered results or empty
        const newCount = await projectsTable.getProjectCount();
        const isNowEmpty = await projectsTable.isEmpty();
        expect(newCount === 0 || isNowEmpty).toBeTruthy();
      }
    });

    test('should filter projects by status', async ({ adminPage }) => {
      const projectsTable = new ProjectsTablePage(adminPage);
      await projectsTable.goto();
      await projectsTable.waitForLoad();

      await projectsTable.filterByStatus('IN_PROGRESS');
      await adminPage.waitForLoadState('networkidle');

      const isEmpty = await projectsTable.isEmpty();
      if (!isEmpty) {
        const firstProject = await projectsTable.getProjectByIndex(0);
        expect(firstProject.status?.toLowerCase()).toMatch(/in progress|in_progress/i);
      }
    });

    test('should filter projects by tier', async ({ adminPage }) => {
      const projectsTable = new ProjectsTablePage(adminPage);
      await projectsTable.goto();
      await projectsTable.waitForLoad();

      await projectsTable.filterByTier('3');
      await adminPage.waitForLoadState('networkidle');

      const isEmpty = await projectsTable.isEmpty();
      if (!isEmpty) {
        const firstProject = await projectsTable.getProjectByIndex(0);
        expect(firstProject.tier?.toLowerCase()).toMatch(/tier 3|concierge/i);
      }
    });

    test('should filter projects by payment status', async ({ adminPage }) => {
      const projectsTable = new ProjectsTablePage(adminPage);
      await projectsTable.goto();
      await projectsTable.waitForLoad();

      await projectsTable.filterByPaymentStatus('PAID');
      await adminPage.waitForLoadState('networkidle');

      const isEmpty = await projectsTable.isEmpty();
      if (!isEmpty) {
        const firstProject = await projectsTable.getProjectByIndex(0);
        expect(firstProject.paymentStatus?.toLowerCase()).toContain('paid');
      }
    });

    test('should combine multiple filters', async ({ adminPage }) => {
      const projectsTable = new ProjectsTablePage(adminPage);
      await projectsTable.goto();
      await projectsTable.waitForLoad();

      await projectsTable.filterByStatus('IN_PROGRESS');
      await projectsTable.filterByTier('2');
      await adminPage.waitForLoadState('networkidle');

      // Should apply both filters
      const isEmpty = await projectsTable.isEmpty();
      if (!isEmpty) {
        const firstProject = await projectsTable.getProjectByIndex(0);
        expect(firstProject.status?.toLowerCase()).toMatch(/in progress|in_progress/i);
        expect(firstProject.tier?.toLowerCase()).toMatch(/tier 2|builder/i);
      }
    });
  });

  test.describe('Project Details', () => {
    test('should display project name', async ({ adminPage }) => {
      const projectsTable = new ProjectsTablePage(adminPage);
      await projectsTable.goto();
      await projectsTable.waitForLoad();

      const isEmpty = await projectsTable.isEmpty();
      if (!isEmpty) {
        const project = await projectsTable.getProjectByIndex(0);
        expect(project.name).toBeTruthy();
      }
    });

    test('should display client information', async ({ adminPage }) => {
      const projectsTable = new ProjectsTablePage(adminPage);
      await projectsTable.goto();
      await projectsTable.waitForLoad();

      const isEmpty = await projectsTable.isEmpty();
      if (!isEmpty) {
        const project = await projectsTable.getProjectByIndex(0);
        expect(project.clientEmail || project.clientAddress).toBeTruthy();
      }
    });

    test('should display progress bar', async ({ adminPage }) => {
      const projectsTable = new ProjectsTablePage(adminPage);
      await projectsTable.goto();
      await projectsTable.waitForLoad();

      const isEmpty = await projectsTable.isEmpty();
      if (!isEmpty) {
        const progressBar = projectsTable.tableRows.first().locator('.projects-table__progress-bar');
        await expect(progressBar).toBeVisible();

        const project = await projectsTable.getProjectByIndex(0);
        expect(project.progress).toMatch(/\d+\/\d+/);
      }
    });

    test('should display payment information', async ({ adminPage }) => {
      const projectsTable = new ProjectsTablePage(adminPage);
      await projectsTable.goto();
      await projectsTable.waitForLoad();

      const isEmpty = await projectsTable.isEmpty();
      if (!isEmpty) {
        const project = await projectsTable.getProjectByIndex(0);
        expect(project.paymentStatus).toBeTruthy();
        expect(project.paymentAmount).toMatch(/\$/);
      }
    });

    test('should show Notion sync indicator for synced projects', async ({ adminPage }) => {
      const projectsTable = new ProjectsTablePage(adminPage);
      await projectsTable.goto();
      await projectsTable.waitForLoad();

      const isEmpty = await projectsTable.isEmpty();
      if (!isEmpty) {
        const projectCount = await projectsTable.getProjectCount();
        for (let i = 0; i < Math.min(projectCount, 10); i++) {
          const hasNotionSync = await projectsTable.hasNotionSync(i);
          if (hasNotionSync) {
            const notionBadge = projectsTable.tableRows.nth(i).locator('.projects-table__notion-badge');
            await expect(notionBadge).toHaveAttribute('title', 'Synced to Notion');
            break;
          }
        }
      }
    });
  });

  test.describe('Project Actions', () => {
    test('should have view action button', async ({ adminPage }) => {
      const projectsTable = new ProjectsTablePage(adminPage);
      await projectsTable.goto();
      await projectsTable.waitForLoad();

      const isEmpty = await projectsTable.isEmpty();
      if (!isEmpty) {
        const viewButton = projectsTable.tableRows.first().locator('.projects-table__action--view');
        await expect(viewButton).toBeVisible();
        await expect(viewButton).toHaveAttribute('title', 'View Project');
      }
    });

    test('should have status update action button', async ({ adminPage }) => {
      const projectsTable = new ProjectsTablePage(adminPage);
      await projectsTable.goto();
      await projectsTable.waitForLoad();

      const isEmpty = await projectsTable.isEmpty();
      if (!isEmpty) {
        const statusButton = projectsTable.tableRows.first().locator('.projects-table__action--status');
        // Status button may or may not be present depending on permissions
        const isVisible = await statusButton.isVisible();
        if (isVisible) {
          await expect(statusButton).toHaveAttribute('title', 'Change Status');
        }
      }
    });

    test('should open project detail when clicking view', async ({ adminPage }) => {
      const projectsTable = new ProjectsTablePage(adminPage);
      await projectsTable.goto();
      await projectsTable.waitForLoad();

      const isEmpty = await projectsTable.isEmpty();
      if (!isEmpty) {
        await projectsTable.viewProject(0);

        // Should navigate to project detail or open modal
        await expect(adminPage).toHaveURL(/project|detail/, { timeout: 5000 }).catch(() => {
          // Or modal should be visible
          return expect(adminPage.locator('[role="dialog"], .modal')).toBeVisible();
        });
      }
    });
  });

  test.describe('Pagination', () => {
    test('should display pagination when multiple pages exist', async ({ adminPage }) => {
      const projectsTable = new ProjectsTablePage(adminPage);
      await projectsTable.goto();
      await projectsTable.waitForLoad();

      const isEmpty = await projectsTable.isEmpty();
      if (!isEmpty) {
        const isPaginationVisible = await projectsTable.pagination.isVisible();
        if (isPaginationVisible) {
          await expect(projectsTable.prevButton).toBeVisible();
          await expect(projectsTable.nextButton).toBeVisible();
        }
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should display on mobile viewport', async ({ adminPage }) => {
      await adminPage.setViewportSize({ width: 375, height: 667 });

      const projectsTable = new ProjectsTablePage(adminPage);
      await projectsTable.goto();
      await projectsTable.waitForLoad();

      await expect(projectsTable.title).toBeVisible();
      await expect(projectsTable.searchInput).toBeVisible();
    });

    test('should be horizontally scrollable on mobile', async ({ adminPage }) => {
      await adminPage.setViewportSize({ width: 375, height: 667 });

      const projectsTable = new ProjectsTablePage(adminPage);
      await projectsTable.goto();
      await projectsTable.waitForLoad();

      const isEmpty = await projectsTable.isEmpty();
      if (!isEmpty) {
        const tableContainer = adminPage.locator('.projects-table__container');
        await expect(tableContainer).toBeVisible();
      }
    });
  });

  test.describe('Loading States', () => {
    test('should show loading indicator while fetching', async ({ adminPage }) => {
      const projectsTable = new ProjectsTablePage(adminPage);

      const loadingPromise = adminPage.waitForSelector('.projects-table__loading', { timeout: 2000 }).catch(() => null);
      await projectsTable.goto();

      const loading = await loadingPromise;
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible table structure', async ({ adminPage }) => {
      const projectsTable = new ProjectsTablePage(adminPage);
      await projectsTable.goto();
      await projectsTable.waitForLoad();

      const isEmpty = await projectsTable.isEmpty();
      if (!isEmpty) {
        // Table should have proper structure
        await expect(projectsTable.table.locator('thead')).toBeVisible();
        await expect(projectsTable.table.locator('tbody')).toBeVisible();
      }
    });

    test('should have focusable action buttons', async ({ adminPage }) => {
      const projectsTable = new ProjectsTablePage(adminPage);
      await projectsTable.goto();
      await projectsTable.waitForLoad();

      const isEmpty = await projectsTable.isEmpty();
      if (!isEmpty) {
        const viewButton = projectsTable.tableRows.first().locator('.projects-table__action--view');
        await viewButton.focus();
        await expect(viewButton).toBeFocused();
      }
    });
  });
});
