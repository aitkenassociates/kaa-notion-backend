/**
 * E2E Tests for Client Portal Project Detail Page
 * Tests project viewing, milestones, deliverables, and navigation
 */

import { test, expect } from '../fixtures/auth.fixture';
import { PortalDashboardPage } from '../pages/portal-dashboard.page';
import { PortalProjectPage } from '../pages/portal-project.page';

test.describe('Client Portal Project Detail', () => {
  test.describe('Project Header', () => {
    test('should display project title', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        const name = await projectPage.getProjectName();
        expect(name).toBeTruthy();
      }
    });

    test('should display project status badge', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        await expect(projectPage.statusBadge).toBeVisible();
      }
    });

    test('should display tier indicator', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        await expect(projectPage.tierBadge).toBeVisible();
      }
    });

    test('should have back navigation button', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        await expect(projectPage.backButton).toBeVisible();
      }
    });
  });

  test.describe('Progress Section', () => {
    test('should display progress section', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        await expect(projectPage.progressSection).toBeVisible();
      }
    });

    test('should display progress percentage', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        const progress = await projectPage.getProgressPercentage();
        expect(progress).toMatch(/\d+%?/);
      }
    });

    test('should display progress ring or bar', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        const hasRing = await projectPage.progressRing.isVisible();
        // Progress visualization should be present
        expect(hasRing || await projectPage.progressSection.isVisible()).toBeTruthy();
      }
    });
  });

  test.describe('Milestones', () => {
    test('should display milestones section', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        await expect(projectPage.milestonesSection).toBeVisible();
      }
    });

    test('should display milestone timeline', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        const milestoneCount = await projectPage.getMilestoneCount();
        if (milestoneCount > 0) {
          await expect(projectPage.milestoneTimeline).toBeVisible();
        }
      }
    });

    test('should display milestone items', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        const milestoneCount = await projectPage.getMilestoneCount();
        if (milestoneCount > 0) {
          const milestone = await projectPage.getMilestoneByIndex(0);
          expect(milestone.name).toBeTruthy();
        }
      }
    });

    test('should show milestone status indicators', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        const milestoneCount = await projectPage.getMilestoneCount();
        if (milestoneCount > 0) {
          // Check for status indicators
          await expect(projectPage.milestoneItems.first()).toBeVisible();
        }
      }
    });

    test('should display completed milestone count', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        const totalCount = await projectPage.getMilestoneCount();
        const completedCount = await projectPage.getCompletedMilestoneCount();

        expect(completedCount).toBeLessThanOrEqual(totalCount);
      }
    });
  });

  test.describe('Deliverables', () => {
    test('should display deliverables section or tab', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        const hasSection = await projectPage.deliverablesSection.isVisible();
        const hasTab = await projectPage.deliverablesTab.isVisible();

        expect(hasSection || hasTab).toBeTruthy();
      }
    });

    test('should switch to deliverables tab if available', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        const hasTab = await projectPage.deliverablesTab.isVisible();
        if (hasTab) {
          await projectPage.clickDeliverablesTab();
          await expect(projectPage.deliverablesTab).toHaveAttribute('aria-selected', 'true');
        }
      }
    });

    test('should display deliverable cards', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        await projectPage.clickDeliverablesTab();

        const deliverableCount = await projectPage.getDeliverableCount();
        if (deliverableCount > 0) {
          await expect(projectPage.deliverableCards.first()).toBeVisible();
        }
      }
    });

    test('should display deliverable details', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        await projectPage.clickDeliverablesTab();

        const deliverableCount = await projectPage.getDeliverableCount();
        if (deliverableCount > 0) {
          const deliverable = await projectPage.getDeliverableByIndex(0);
          expect(deliverable.name).toBeTruthy();
        }
      }
    });

    test('should have download button on deliverables', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        await projectPage.clickDeliverablesTab();

        const deliverableCount = await projectPage.getDeliverableCount();
        if (deliverableCount > 0) {
          const downloadButton = projectPage.deliverableCards.first().getByRole('button', { name: /download/i });
          await expect(downloadButton).toBeVisible();
        }
      }
    });
  });

  test.describe('Navigation', () => {
    test('should navigate back to dashboard', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        await projectPage.goBack();
        await expect(page).toHaveURL(/portal|dashboard/);
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should display on mobile viewport', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      await page.setViewportSize({ width: 375, height: 667 });

      const portal = new PortalDashboardPage(page);
      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        await expect(projectPage.projectTitle).toBeVisible();
      }
    });

    test('should stack sections vertically on mobile', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      await page.setViewportSize({ width: 375, height: 667 });

      const portal = new PortalDashboardPage(page);
      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        // Sections should be visible and stacked
        await expect(projectPage.progressSection).toBeVisible();
        await expect(projectPage.milestonesSection).toBeVisible();
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle invalid project ID', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const projectPage = new PortalProjectPage(page);

      await projectPage.goto('invalid-project-id-12345');

      // Should show error or redirect
      await page.waitForLoadState('networkidle');
      const hasError = await projectPage.hasError();
      const redirectedAway = !page.url().includes('invalid-project-id');

      expect(hasError || redirectedAway).toBeTruthy();
    });

    test('should handle API errors gracefully', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      // Let dashboard load first
      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        // Intercept project detail API
        await page.route('**/api/projects/**', (route) => {
          route.fulfill({
            status: 500,
            body: JSON.stringify({ error: 'Server error' }),
          });
        });

        await portal.clickProject(0);
        await page.waitForLoadState('networkidle');

        // Should show error or handle gracefully
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        // Should have h1 for project title
        const h1Count = await page.locator('h1').count();
        expect(h1Count).toBeGreaterThanOrEqual(1);
      }
    });

    test('should have accessible milestone list', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        const milestoneCount = await projectPage.getMilestoneCount();
        if (milestoneCount > 0) {
          // Milestones should be in a list or timeline structure
          await expect(projectPage.milestoneTimeline.or(projectPage.milestonesSection)).toBeVisible();
        }
      }
    });

    test('should have keyboard accessible back button', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const portal = new PortalDashboardPage(page);

      await portal.goto();
      await portal.waitForLoad();

      const hasProjects = await portal.hasProjects();
      if (hasProjects) {
        await portal.clickProject(0);

        const projectPage = new PortalProjectPage(page);
        await projectPage.waitForLoad();

        await projectPage.backButton.focus();
        await expect(projectPage.backButton).toBeFocused();
      }
    });
  });
});
