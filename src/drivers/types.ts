import type { SwipeDirection } from "../types.js";

/**
 * Result from element finding operations.
 */
export interface ElementResult {
  found: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  error?: string;
}

/**
 * Locator strategies for finding elements.
 */
export type LocatorStrategy =
  | { type: "accessibilityId"; value: string }
  | { type: "resourceId"; value: string }
  | { type: "text"; value: string }
  | { type: "xpath"; value: string }
  | { type: "coordinates"; x: number; y: number };

/**
 * Strategy pattern interface for mobile drivers.
 * Allows swapping between Android (ADB/UiAutomator2) and iOS (XCUITest) implementations.
 */
export interface IMobileDriver {
  /**
   * Capture the current screen as a base64-encoded PNG.
   */
  getScreenshot(): Promise<string>;

  /**
   * Get the current page source as XML (Android) or JSON (iOS).
   */
  getPageSource(): Promise<string>;

  /**
   * Tap at specific coordinates.
   * @param x - X coordinate
   * @param y - Y coordinate
   */
  tap(x: number, y: number): Promise<void>;

  /**
   * Type text into the currently focused element.
   * @param text - Text to type
   */
  type(text: string): Promise<void>;

  /**
   * Perform a swipe gesture.
   * @param direction - Direction to swipe
   * @param duration - Duration of swipe in milliseconds (default: 300)
   */
  swipe(direction: SwipeDirection, duration?: number): Promise<void>;

  /**
   * Press a special key (e.g., "Enter", "Back").
   * @param key - Key to press
   */
  pressKey(key: string): Promise<void>;

  /**
   * Wait for a specified duration.
   * @param ms - Duration in milliseconds
   */
  waitFor(ms: number): Promise<void>;

  /**
   * Initialize/connect the driver.
   */
  connect(): Promise<void>;

  /**
   * Cleanup/disconnect the driver.
   */
  disconnect(): Promise<void>;

  // ============ ELEMENT FINDING METHODS (for Hybrid Locator Strategy) ============

  /**
   * Find element by Accessibility ID and return its center coordinates.
   * @param id - Accessibility identifier
   */
  findByAccessibilityId(id: string): Promise<ElementResult>;

  /**
   * Find element by Resource ID (Android) or name (iOS).
   * @param id - Resource identifier
   */
  findByResourceId(id: string): Promise<ElementResult>;

  /**
   * Find element by visible text.
   * @param text - Text to search for
   * @param exact - Whether to match exactly (default: false)
   */
  findByText(text: string, exact?: boolean): Promise<ElementResult>;

  /**
   * Tap on an element found by locator strategy.
   * Returns the coordinates used for the tap.
   */
  tapElement(locator: LocatorStrategy): Promise<{ x: number; y: number }>;

  /**
   * Type text into an element found by locator strategy.
   */
  typeIntoElement(locator: LocatorStrategy, text: string): Promise<void>;

  /**
   * Get screen dimensions.
   */
  getScreenSize(): { width: number; height: number };
}
