import type { IMobileDriver, ElementResult, LocatorStrategy } from "../drivers/types.js";

/**
 * Event types for healing/logging
 */
export interface HealingEvent {
  timestamp: Date;
  attemptedLocator: LocatorStrategy;
  success: boolean;
  method: "selector" | "vision";
  coordinates?: { x: number; y: number };
  error?: string;
  healingTriggered: boolean;
}

/**
 * Result from hybrid locate operation
 */
export interface HybridLocateResult {
  found: boolean;
  x?: number;
  y?: number;
  method: "selector" | "vision" | "none";
  healingTriggered: boolean;
  error?: string;
}

/**
 * Vision fallback function type - called when selector fails
 */
export type VisionFallbackFn = (
  elementDescription: string,
  screenshot: string
) => Promise<{ x: number; y: number } | null>;

/**
 * HybridLocator implements selector-first approach with vision fallback.
 *
 * Strategy:
 * 1. Try standard Appium selectors (accessibilityId, resourceId, text, xpath)
 * 2. If selector fails, trigger vision model to find element by description
 * 3. Log healing events for analytics
 */
export class HybridLocator {
  private driver: IMobileDriver;
  private healingLog: HealingEvent[] = [];
  private visionFallback?: VisionFallbackFn;

  constructor(driver: IMobileDriver, visionFallback?: VisionFallbackFn) {
    this.driver = driver;
    this.visionFallback = visionFallback;
  }

  /**
   * Set the vision fallback function
   */
  setVisionFallback(fn: VisionFallbackFn): void {
    this.visionFallback = fn;
  }

  /**
   * Get all healing events for analysis
   */
  getHealingLog(): HealingEvent[] {
    return [...this.healingLog];
  }

  /**
   * Clear healing log
   */
  clearHealingLog(): void {
    this.healingLog = [];
  }

  /**
   * Log a healing event
   */
  private logEvent(event: HealingEvent): void {
    this.healingLog.push(event);
    const status = event.success ? "✓" : "✗";
    const healing = event.healingTriggered ? " [HEALED]" : "";
    console.log(
      `[HybridLocator] ${status} ${event.method.toUpperCase()}${healing} - ${this.describeLocator(event.attemptedLocator)}`
    );
  }

  /**
   * Describe a locator for logging
   */
  private describeLocator(locator: LocatorStrategy): string {
    switch (locator.type) {
      case "accessibilityId":
        return `accessibilityId="${locator.value}"`;
      case "resourceId":
        return `resourceId="${locator.value}"`;
      case "text":
        return `text="${locator.value}"`;
      case "xpath":
        return `xpath="${locator.value}"`;
      case "coordinates":
        return `coordinates=(${locator.x}, ${locator.y})`;
    }
  }

  /**
   * Try to find element using selector strategy
   */
  private async trySelector(locator: LocatorStrategy): Promise<ElementResult> {
    switch (locator.type) {
      case "accessibilityId":
        return await this.driver.findByAccessibilityId(locator.value);
      case "resourceId":
        return await this.driver.findByResourceId(locator.value);
      case "text":
        return await this.driver.findByText(locator.value);
      case "xpath":
        // For xpath, we'll use findByText with the xpath as a fallback
        // Most drivers don't expose xpath directly in the interface
        return { found: false, error: "XPath requires direct driver access" };
      case "coordinates":
        // Coordinates don't need finding - they're already known
        return {
          found: true,
          x: locator.x,
          y: locator.y,
        };
    }
  }

  /**
   * Main locate method - tries selector first, then vision fallback
   *
   * @param locator - The locator strategy to try
   * @param elementDescription - Human-readable description for vision fallback
   */
  async locate(
    locator: LocatorStrategy,
    elementDescription: string
  ): Promise<HybridLocateResult> {
    // Step 1: Try selector-based approach
    const selectorResult = await this.trySelector(locator);

    if (selectorResult.found && selectorResult.x !== undefined && selectorResult.y !== undefined) {
      // Selector succeeded
      this.logEvent({
        timestamp: new Date(),
        attemptedLocator: locator,
        success: true,
        method: "selector",
        coordinates: { x: selectorResult.x, y: selectorResult.y },
        healingTriggered: false,
      });

      return {
        found: true,
        x: selectorResult.x,
        y: selectorResult.y,
        method: "selector",
        healingTriggered: false,
      };
    }

    // Step 2: Selector failed - try vision fallback if available
    if (this.visionFallback) {
      console.log(`[HybridLocator] Selector failed, triggering vision fallback for: "${elementDescription}"`);

      try {
        const screenshot = await this.driver.getScreenshot();
        const visionResult = await this.visionFallback(elementDescription, screenshot);

        if (visionResult) {
          // Vision succeeded - this is a healing event!
          this.logEvent({
            timestamp: new Date(),
            attemptedLocator: locator,
            success: true,
            method: "vision",
            coordinates: visionResult,
            healingTriggered: true,
          });

          return {
            found: true,
            x: visionResult.x,
            y: visionResult.y,
            method: "vision",
            healingTriggered: true,
          };
        }
      } catch (error) {
        console.error(`[HybridLocator] Vision fallback error:`, error);
      }
    }

    // Both strategies failed
    this.logEvent({
      timestamp: new Date(),
      attemptedLocator: locator,
      success: false,
      method: "selector",
      error: selectorResult.error,
      healingTriggered: this.visionFallback !== undefined,
    });

    return {
      found: false,
      method: "none",
      healingTriggered: this.visionFallback !== undefined,
      error: selectorResult.error || "Element not found",
    };
  }

  /**
   * Locate and tap an element
   */
  async locateAndTap(
    locator: LocatorStrategy,
    elementDescription: string
  ): Promise<{ x: number; y: number; method: "selector" | "vision" }> {
    const result = await this.locate(locator, elementDescription);

    if (!result.found || result.x === undefined || result.y === undefined) {
      throw new Error(`Failed to locate element: ${elementDescription}. ${result.error || ""}`);
    }

    await this.driver.tap(result.x, result.y);
    return { x: result.x, y: result.y, method: result.method as "selector" | "vision" };
  }

  /**
   * Locate and type into an element
   */
  async locateAndType(
    locator: LocatorStrategy,
    elementDescription: string,
    text: string
  ): Promise<{ x: number; y: number; method: "selector" | "vision" }> {
    const tapResult = await this.locateAndTap(locator, elementDescription);
    await this.driver.waitFor(200); // Wait for focus
    await this.driver.type(text);
    return tapResult;
  }

  /**
   * Get healing statistics
   */
  getHealingStats(): {
    totalAttempts: number;
    selectorSuccesses: number;
    visionSuccesses: number;
    failures: number;
    healingRate: number;
  } {
    const total = this.healingLog.length;
    const selectorSuccesses = this.healingLog.filter(
      (e) => e.success && e.method === "selector"
    ).length;
    const visionSuccesses = this.healingLog.filter(
      (e) => e.success && e.method === "vision"
    ).length;
    const failures = this.healingLog.filter((e) => !e.success).length;
    const healingRate = total > 0 ? visionSuccesses / total : 0;

    return {
      totalAttempts: total,
      selectorSuccesses,
      visionSuccesses,
      failures,
      healingRate,
    };
  }
}
