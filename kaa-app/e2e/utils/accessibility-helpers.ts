/**
 * Accessibility Testing Utilities
 * Provides axe-core integration and WCAG compliance testing
 */

import { Page, Locator, expect } from '@playwright/test';

// =============================================================================
// Axe-Core Integration (Inline)
// =============================================================================

/**
 * Inject axe-core into the page and run accessibility audit
 */
export async function runAccessibilityAudit(
  page: Page,
  options: {
    include?: string[];
    exclude?: string[];
    runOnly?: string[];
    resultTypes?: ('violations' | 'passes' | 'incomplete' | 'inapplicable')[];
  } = {}
): Promise<AccessibilityResult> {
  // Inject axe-core from CDN
  await page.addScriptTag({
    url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js',
  });

  // Wait for axe to be available
  await page.waitForFunction(() => typeof (window as any).axe !== 'undefined', { timeout: 5000 });

  // Run axe audit
  const results = await page.evaluate((opts) => {
    const axeOptions: any = {};

    if (opts.include) {
      axeOptions.include = opts.include;
    }
    if (opts.exclude) {
      axeOptions.exclude = opts.exclude;
    }
    if (opts.runOnly) {
      axeOptions.runOnly = opts.runOnly;
    }
    if (opts.resultTypes) {
      axeOptions.resultTypes = opts.resultTypes;
    }

    return (window as any).axe.run(document, axeOptions);
  }, options);

  return {
    violations: results.violations || [],
    passes: results.passes || [],
    incomplete: results.incomplete || [],
    inapplicable: results.inapplicable || [],
    url: page.url(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check for critical accessibility violations
 */
export async function checkCriticalViolations(page: Page): Promise<Violation[]> {
  const results = await runAccessibilityAudit(page, {
    resultTypes: ['violations'],
  });

  return results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  );
}

/**
 * Assert no accessibility violations
 */
export async function assertNoViolations(
  page: Page,
  options: {
    impactLevel?: 'critical' | 'serious' | 'moderate' | 'minor';
    exclude?: string[];
  } = {}
): Promise<void> {
  const { impactLevel = 'serious', exclude = [] } = options;

  const results = await runAccessibilityAudit(page, {
    exclude,
    resultTypes: ['violations'],
  });

  const impactLevels = ['critical', 'serious', 'moderate', 'minor'];
  const minImpactIndex = impactLevels.indexOf(impactLevel);
  const relevantViolations = results.violations.filter((v) => {
    const violationImpactIndex = impactLevels.indexOf(v.impact || 'minor');
    return violationImpactIndex <= minImpactIndex;
  });

  if (relevantViolations.length > 0) {
    const violationSummary = relevantViolations
      .map((v) => `- ${v.id}: ${v.description} (${v.impact}) - ${v.nodes.length} instance(s)`)
      .join('\n');

    throw new Error(`Accessibility violations found:\n${violationSummary}`);
  }
}

// =============================================================================
// WCAG Compliance Testing
// =============================================================================

/**
 * Test for WCAG 2.1 Level A compliance
 */
export async function testWCAG21LevelA(page: Page): Promise<AccessibilityResult> {
  return runAccessibilityAudit(page, {
    runOnly: ['wcag2a', 'wcag21a'],
    resultTypes: ['violations', 'passes'],
  });
}

/**
 * Test for WCAG 2.1 Level AA compliance
 */
export async function testWCAG21LevelAA(page: Page): Promise<AccessibilityResult> {
  return runAccessibilityAudit(page, {
    runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    resultTypes: ['violations', 'passes'],
  });
}

/**
 * Test for WCAG 2.1 Level AAA compliance
 */
export async function testWCAG21LevelAAA(page: Page): Promise<AccessibilityResult> {
  return runAccessibilityAudit(page, {
    runOnly: ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa'],
    resultTypes: ['violations', 'passes'],
  });
}

// =============================================================================
// Manual Accessibility Checks
// =============================================================================

/**
 * Check heading hierarchy (h1, h2, h3, etc.)
 */
export async function checkHeadingHierarchy(
  page: Page
): Promise<{ valid: boolean; issues: string[]; headings: HeadingInfo[] }> {
  const headings = await page.evaluate(() => {
    const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const results: { level: number; text: string; visible: boolean }[] = [];

    headingElements.forEach((el) => {
      const level = parseInt(el.tagName.charAt(1));
      const text = el.textContent?.trim() || '';
      const style = window.getComputedStyle(el);
      const visible =
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0';

      results.push({ level, text, visible });
    });

    return results;
  });

  const visibleHeadings = headings.filter((h) => h.visible);
  const issues: string[] = [];

  // Check for h1 presence
  const h1Count = visibleHeadings.filter((h) => h.level === 1).length;
  if (h1Count === 0) {
    issues.push('No H1 heading found on page');
  } else if (h1Count > 1) {
    issues.push(`Multiple H1 headings found (${h1Count})`);
  }

  // Check for skipped levels
  let lastLevel = 0;
  for (const heading of visibleHeadings) {
    if (heading.level > lastLevel + 1 && lastLevel !== 0) {
      issues.push(`Heading level skipped: H${lastLevel} followed by H${heading.level}`);
    }
    lastLevel = heading.level;
  }

  // Check for empty headings
  const emptyHeadings = visibleHeadings.filter((h) => !h.text);
  if (emptyHeadings.length > 0) {
    issues.push(`${emptyHeadings.length} empty heading(s) found`);
  }

  return {
    valid: issues.length === 0,
    issues,
    headings: visibleHeadings.map((h) => ({
      level: h.level,
      text: h.text,
    })),
  };
}

/**
 * Check all images have alt text
 */
export async function checkImageAltText(
  page: Page
): Promise<{ valid: boolean; issues: ImageAltIssue[] }> {
  const issues = await page.evaluate(() => {
    const images = document.querySelectorAll('img');
    const problems: Array<{ src: string; issue: string }> = [];

    images.forEach((img) => {
      const alt = img.getAttribute('alt');
      const src = img.src || img.getAttribute('data-src') || 'unknown';

      if (alt === null) {
        problems.push({ src, issue: 'Missing alt attribute' });
      } else if (alt === '' && !img.getAttribute('role')) {
        // Empty alt is valid for decorative images with role="presentation"
        const isDecorative =
          img.getAttribute('aria-hidden') === 'true' ||
          img.closest('[aria-hidden="true"]') !== null;

        if (!isDecorative) {
          problems.push({ src, issue: 'Empty alt without role="presentation" or aria-hidden' });
        }
      }
    });

    return problems;
  });

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Check all form inputs have labels
 */
export async function checkFormLabels(
  page: Page
): Promise<{ valid: boolean; issues: FormLabelIssue[] }> {
  const issues = await page.evaluate(() => {
    const inputs = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea'
    );
    const problems: Array<{ type: string; name: string; issue: string }> = [];

    inputs.forEach((input) => {
      const inputElement = input as HTMLInputElement;
      const type = inputElement.type || inputElement.tagName.toLowerCase();
      const name = inputElement.name || inputElement.id || 'unnamed';

      // Check for associated label
      const id = inputElement.id;
      const hasExplicitLabel = id && document.querySelector(`label[for="${id}"]`);
      const hasImplicitLabel = input.closest('label');
      const hasAriaLabel = inputElement.getAttribute('aria-label');
      const hasAriaLabelledby = inputElement.getAttribute('aria-labelledby');
      const hasTitle = inputElement.title;
      const hasPlaceholder = inputElement.placeholder; // Not recommended as only label

      if (!hasExplicitLabel && !hasImplicitLabel && !hasAriaLabel && !hasAriaLabelledby && !hasTitle) {
        let issue = 'No accessible label';
        if (hasPlaceholder) {
          issue = 'Only has placeholder (not accessible label)';
        }
        problems.push({ type, name, issue });
      }
    });

    return problems;
  });

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Check link text is descriptive
 */
export async function checkLinkText(
  page: Page
): Promise<{ valid: boolean; issues: LinkTextIssue[] }> {
  const issues = await page.evaluate(() => {
    const links = document.querySelectorAll('a');
    const problems: Array<{ href: string; text: string; issue: string }> = [];

    const badLinkTexts = ['click here', 'here', 'link', 'read more', 'more', 'learn more'];

    links.forEach((link) => {
      const text = (link.textContent || '').trim().toLowerCase();
      const href = link.getAttribute('href') || '';
      const ariaLabel = link.getAttribute('aria-label');

      // Skip if has aria-label
      if (ariaLabel) return;

      // Check for generic link text
      if (badLinkTexts.includes(text)) {
        problems.push({
          href,
          text: link.textContent?.trim() || '',
          issue: 'Generic link text',
        });
      }

      // Check for empty links
      if (!text && !ariaLabel && !link.querySelector('img[alt]')) {
        problems.push({
          href,
          text: '',
          issue: 'Empty link with no accessible name',
        });
      }
    });

    return problems;
  });

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Check color contrast for text elements
 */
export async function checkColorContrast(
  page: Page
): Promise<{ lowContrastElements: ColorContrastIssue[] }> {
  const issues = await page.evaluate(() => {
    const elements = document.querySelectorAll('*');
    const problems: Array<{
      selector: string;
      text: string;
      foreground: string;
      background: string;
      ratio: number;
    }> = [];

    // Helper to get RGB from computed color
    const getRGB = (color: string): number[] | null => {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : null;
    };

    // Helper to calculate relative luminance
    const getLuminance = (rgb: number[]): number => {
      const [r, g, b] = rgb.map((c) => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    // Helper to calculate contrast ratio
    const getContrastRatio = (rgb1: number[], rgb2: number[]): number => {
      const l1 = getLuminance(rgb1);
      const l2 = getLuminance(rgb2);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    };

    elements.forEach((el) => {
      const text = el.textContent?.trim();
      if (!text || text.length > 100) return;

      const style = window.getComputedStyle(el);
      const color = style.color;
      const bgColor = style.backgroundColor;

      const fgRGB = getRGB(color);
      const bgRGB = getRGB(bgColor);

      if (!fgRGB || !bgRGB) return;
      if (bgColor === 'rgba(0, 0, 0, 0)') return; // Transparent background

      const ratio = getContrastRatio(fgRGB, bgRGB);

      // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
      const fontSize = parseFloat(style.fontSize);
      const fontWeight = parseInt(style.fontWeight);
      const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
      const minRatio = isLargeText ? 3.0 : 4.5;

      if (ratio < minRatio) {
        const tagName = el.tagName.toLowerCase();
        const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : '';
        const className =
          (el as HTMLElement).className && typeof (el as HTMLElement).className === 'string'
            ? '.' + (el as HTMLElement).className.split(' ').filter(Boolean).slice(0, 2).join('.')
            : '';

        problems.push({
          selector: `${tagName}${id}${className}`.slice(0, 50),
          text: text.slice(0, 30),
          foreground: color,
          background: bgColor,
          ratio: Math.round(ratio * 100) / 100,
        });
      }
    });

    // Return first 20 issues
    return problems.slice(0, 20);
  });

  return { lowContrastElements: issues };
}

/**
 * Check focus indicators are visible
 */
export async function checkFocusIndicators(
  page: Page
): Promise<{ valid: boolean; elementsWithoutFocus: string[] }> {
  const results = await page.evaluate(() => {
    const focusableElements = document.querySelectorAll(
      'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const missingFocus: string[] = [];

    focusableElements.forEach((el) => {
      const element = el as HTMLElement;
      const style = window.getComputedStyle(element);
      const focusStyle = window.getComputedStyle(element, ':focus');

      // Check if outline is explicitly removed without replacement
      if (style.outlineStyle === 'none' || style.outline === '0') {
        // Check for alternative focus indicators
        const hasBorderChange = style.borderColor !== focusStyle.borderColor;
        const hasBoxShadow = style.boxShadow !== 'none';
        const hasBackgroundChange = style.backgroundColor !== focusStyle.backgroundColor;

        if (!hasBorderChange && !hasBoxShadow && !hasBackgroundChange) {
          const tagName = element.tagName.toLowerCase();
          const id = element.id ? `#${element.id}` : '';
          missingFocus.push(`${tagName}${id}`);
        }
      }
    });

    return missingFocus.slice(0, 10);
  });

  return {
    valid: results.length === 0,
    elementsWithoutFocus: results,
  };
}

// =============================================================================
// Keyboard Navigation Testing
// =============================================================================

/**
 * Test keyboard navigation through interactive elements
 */
export async function testKeyboardNavigation(
  page: Page
): Promise<{ focusableCount: number; focusOrder: string[] }> {
  const focusOrder: string[] = [];

  // Get all focusable elements
  const focusableCount = await page.evaluate(() => {
    return document.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ).length;
  });

  // Tab through elements and record order
  for (let i = 0; i < Math.min(focusableCount, 20); i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(50);

    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;

      const tagName = el.tagName.toLowerCase();
      const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : '';
      const text = (el.textContent || '').trim().slice(0, 20);

      return `${tagName}${id}${text ? `: "${text}"` : ''}`;
    });

    if (focused) {
      focusOrder.push(focused);
    }
  }

  return { focusableCount, focusOrder };
}

/**
 * Test skip link functionality
 */
export async function testSkipLink(
  page: Page
): Promise<{ hasSkipLink: boolean; skipLinkWorks: boolean }> {
  // Look for skip link
  const skipLink = page.locator('a[href^="#"]').filter({
    hasText: /skip|jump|main/i,
  });

  const hasSkipLink = (await skipLink.count()) > 0;

  if (!hasSkipLink) {
    return { hasSkipLink: false, skipLinkWorks: false };
  }

  // Test skip link
  await page.keyboard.press('Tab');
  const firstFocused = await page.evaluate(() => {
    const el = document.activeElement;
    return el?.textContent?.toLowerCase().includes('skip') ?? false;
  });

  if (!firstFocused) {
    return { hasSkipLink, skipLinkWorks: false };
  }

  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);

  // Check if focus moved to main content
  const focusedAfterSkip = await page.evaluate(() => {
    const el = document.activeElement;
    return el?.tagName.toLowerCase() !== 'a' || !el.textContent?.toLowerCase().includes('skip');
  });

  return { hasSkipLink, skipLinkWorks: focusedAfterSkip };
}

/**
 * Test ARIA live regions
 */
export async function findLiveRegions(
  page: Page
): Promise<Array<{ role: string; ariaLive: string; text: string }>> {
  return page.evaluate(() => {
    const liveRegions = document.querySelectorAll(
      '[aria-live], [role="alert"], [role="status"], [role="log"], [role="timer"]'
    );

    return Array.from(liveRegions).map((el) => ({
      role: el.getAttribute('role') || '',
      ariaLive: el.getAttribute('aria-live') || 'implicit',
      text: (el.textContent || '').trim().slice(0, 100),
    }));
  });
}

// =============================================================================
// Screen Reader Testing Helpers
// =============================================================================

/**
 * Get accessible name for an element
 */
export async function getAccessibleName(locator: Locator): Promise<string> {
  return locator.evaluate((el) => {
    // Priority: aria-labelledby > aria-label > native label > title > inner text
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labels = labelledBy.split(' ').map((id) => {
        const labelEl = document.getElementById(id);
        return labelEl?.textContent?.trim() || '';
      });
      return labels.join(' ');
    }

    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    const id = (el as HTMLElement).id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent?.trim() || '';
    }

    const title = el.getAttribute('title');
    if (title) return title;

    return el.textContent?.trim() || '';
  });
}

/**
 * Get ARIA role for an element
 */
export async function getAriaRole(locator: Locator): Promise<string> {
  return locator.evaluate((el) => {
    // Explicit role
    const explicitRole = el.getAttribute('role');
    if (explicitRole) return explicitRole;

    // Implicit roles based on element
    const tagName = el.tagName.toLowerCase();
    const type = (el as HTMLInputElement).type;

    const implicitRoles: Record<string, string> = {
      a: 'link',
      article: 'article',
      aside: 'complementary',
      button: 'button',
      footer: 'contentinfo',
      form: 'form',
      h1: 'heading',
      h2: 'heading',
      h3: 'heading',
      h4: 'heading',
      h5: 'heading',
      h6: 'heading',
      header: 'banner',
      img: 'img',
      input: type === 'checkbox' ? 'checkbox' : type === 'radio' ? 'radio' : 'textbox',
      li: 'listitem',
      main: 'main',
      nav: 'navigation',
      ol: 'list',
      option: 'option',
      progress: 'progressbar',
      section: 'region',
      select: 'combobox',
      table: 'table',
      textarea: 'textbox',
      ul: 'list',
    };

    return implicitRoles[tagName] || '';
  });
}

// =============================================================================
// Types
// =============================================================================

export interface AccessibilityResult {
  violations: Violation[];
  passes: Violation[];
  incomplete: Violation[];
  inapplicable: Violation[];
  url: string;
  timestamp: string;
}

export interface Violation {
  id: string;
  impact?: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{ html: string; target: string[] }>;
}

export interface HeadingInfo {
  level: number;
  text: string;
}

export interface ImageAltIssue {
  src: string;
  issue: string;
}

export interface FormLabelIssue {
  type: string;
  name: string;
  issue: string;
}

export interface LinkTextIssue {
  href: string;
  text: string;
  issue: string;
}

export interface ColorContrastIssue {
  selector: string;
  text: string;
  foreground: string;
  background: string;
  ratio: number;
}

// =============================================================================
// Comprehensive Accessibility Report
// =============================================================================

/**
 * Generate comprehensive accessibility report
 */
export async function generateAccessibilityReport(
  page: Page
): Promise<{
  axeResults: AccessibilityResult;
  headings: { valid: boolean; issues: string[]; headings: HeadingInfo[] };
  images: { valid: boolean; issues: ImageAltIssue[] };
  forms: { valid: boolean; issues: FormLabelIssue[] };
  links: { valid: boolean; issues: LinkTextIssue[] };
  keyboard: { focusableCount: number; focusOrder: string[] };
  skipLink: { hasSkipLink: boolean; skipLinkWorks: boolean };
  score: number;
}> {
  const [axeResults, headings, images, forms, links, keyboard, skipLink] = await Promise.all([
    runAccessibilityAudit(page).catch(() => ({
      violations: [],
      passes: [],
      incomplete: [],
      inapplicable: [],
      url: page.url(),
      timestamp: new Date().toISOString(),
    })),
    checkHeadingHierarchy(page),
    checkImageAltText(page),
    checkFormLabels(page),
    checkLinkText(page),
    testKeyboardNavigation(page),
    testSkipLink(page),
  ]);

  // Calculate accessibility score (0-100)
  let score = 100;
  score -= axeResults.violations.filter((v) => v.impact === 'critical').length * 15;
  score -= axeResults.violations.filter((v) => v.impact === 'serious').length * 10;
  score -= axeResults.violations.filter((v) => v.impact === 'moderate').length * 5;
  score -= axeResults.violations.filter((v) => v.impact === 'minor').length * 2;
  score -= headings.issues.length * 3;
  score -= images.issues.length * 2;
  score -= forms.issues.length * 3;
  score -= links.issues.length * 2;
  if (!skipLink.hasSkipLink) score -= 5;

  return {
    axeResults,
    headings,
    images,
    forms,
    links,
    keyboard,
    skipLink,
    score: Math.max(0, Math.min(100, score)),
  };
}
