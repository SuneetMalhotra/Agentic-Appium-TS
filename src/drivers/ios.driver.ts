import { remote, type Browser } from "webdriverio";
import type { IMobileDriver, ElementResult, LocatorStrategy } from "./types.js";
import type { SwipeDirection } from "../types.js";

// Screen dimensions for swipe calculations
const DEFAULT_SCREEN_WIDTH = 390;
const DEFAULT_SCREEN_HEIGHT = 844;

export interface IOSDriverConfig {
  host: string;
  port: number;
  path: string;
  capabilities: {
    platformName: "iOS";
    "appium:automationName": "XCUITest";
    "appium:deviceName": string;
    "appium:platformVersion": string;
    "appium:udid"?: string;
    "appium:app"?: string;
    "appium:bundleId"?: string;
    "appium:noReset"?: boolean;
  };
}

/**
 * iOS driver implementation using WebdriverIO with Appium XCUITest.
 */
export class IOSDriver implements IMobileDriver {
  private browser: Browser | null = null;
  private config: IOSDriverConfig;
  private screenWidth: number = DEFAULT_SCREEN_WIDTH;
  private screenHeight: number = DEFAULT_SCREEN_HEIGHT;

  constructor(config: IOSDriverConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    console.log("[IOSDriver] Connecting to Appium server...");

    this.browser = await remote({
      hostname: this.config.host,
      port: this.config.port,
      path: this.config.path,
      capabilities: this.config.capabilities,
      logLevel: "warn",
    });

    // Get actual screen dimensions
    const windowSize = await this.browser.getWindowSize();
    this.screenWidth = windowSize.width;
    this.screenHeight = windowSize.height;

    console.log(
      `[IOSDriver] Connected. Screen: ${this.screenWidth}x${this.screenHeight}`
    );
  }

  async disconnect(): Promise<void> {
    if (this.browser) {
      console.log("[IOSDriver] Disconnecting...");
      await this.browser.deleteSession();
      this.browser = null;
    }
  }

  private getBrowser(): Browser {
    if (!this.browser) {
      throw new Error("IOSDriver not connected. Call connect() first.");
    }
    return this.browser;
  }

  async getScreenshot(): Promise<string> {
    const browser = this.getBrowser();
    return await browser.takeScreenshot();
  }

  async getPageSource(): Promise<string> {
    const browser = this.getBrowser();
    // iOS returns XML page source similar to Android
    return await browser.getPageSource();
  }

  async tap(x: number, y: number): Promise<void> {
    const browser = this.getBrowser();

    // Clamp coordinates to screen bounds
    const clampedX = Math.max(0, Math.min(x, this.screenWidth - 1));
    const clampedY = Math.max(0, Math.min(y, this.screenHeight - 1));

    console.log(`[IOSDriver] Tapping at (${clampedX}, ${clampedY})${x !== clampedX || y !== clampedY ? ` (clamped from ${x},${y})` : ""}`);

    await browser.action("pointer", {
      parameters: { pointerType: "touch" },
    })
      .move({ x: clampedX, y: clampedY, duration: 0 })
      .down()
      .pause(50)
      .up()
      .perform();
  }

  async type(text: string): Promise<void> {
    const browser = this.getBrowser();
    console.log(`[IOSDriver] Typing: "${text.slice(0, 20)}${text.length > 20 ? "..." : ""}"`);

    // Use keyboard actions with proper key up/down sequence
    const keyboardActions = browser.action("key");
    for (const char of text) {
      keyboardActions.down(char).up(char);
    }
    await keyboardActions.perform();
  }

  async swipe(
    direction: SwipeDirection,
    duration: number = 300
  ): Promise<void> {
    const browser = this.getBrowser();
    console.log(`[IOSDriver] Swiping ${direction}`);

    const centerX = Math.round(this.screenWidth / 2);
    const centerY = Math.round(this.screenHeight / 2);
    const swipeDistance = Math.round(this.screenHeight * 0.4);

    let startX: number, startY: number, endX: number, endY: number;

    switch (direction) {
      case "up":
        startX = centerX;
        startY = centerY + swipeDistance / 2;
        endX = centerX;
        endY = centerY - swipeDistance / 2;
        break;
      case "down":
        startX = centerX;
        startY = centerY - swipeDistance / 2;
        endX = centerX;
        endY = centerY + swipeDistance / 2;
        break;
      case "left":
        startX = centerX + swipeDistance / 2;
        startY = centerY;
        endX = centerX - swipeDistance / 2;
        endY = centerY;
        break;
      case "right":
        startX = centerX - swipeDistance / 2;
        startY = centerY;
        endX = centerX + swipeDistance / 2;
        endY = centerY;
        break;
    }

    await browser.action("pointer", {
      parameters: { pointerType: "touch" },
    })
      .move({ x: startX, y: startY, duration: 0 })
      .down()
      .move({ x: endX, y: endY, duration })
      .up()
      .perform();
  }

  async pressKey(key: string): Promise<void> {
    const browser = this.getBrowser();
    console.log(`[IOSDriver] Pressing key: ${key}`);

    // iOS key handling
    if (key.toLowerCase() === "enter" || key.toLowerCase() === "return") {
      await browser.keys(["\n"]);
    } else {
      await browser.keys([key]);
    }
  }

  async waitFor(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============ ELEMENT FINDING METHODS (for Hybrid Locator Strategy) ============

  getScreenSize(): { width: number; height: number } {
    return { width: this.screenWidth, height: this.screenHeight };
  }

  async findByAccessibilityId(id: string): Promise<ElementResult> {
    const browser = this.getBrowser();
    try {
      const element = await browser.$(`~${id}`);
      if (await element.isExisting()) {
        const location = await element.getLocation();
        const size = await element.getSize();
        const text = await element.getText().catch(() => undefined);
        return {
          found: true,
          x: Math.round(location.x + size.width / 2),
          y: Math.round(location.y + size.height / 2),
          width: size.width,
          height: size.height,
          text,
        };
      }
      return { found: false, error: `Element with accessibilityId '${id}' not found` };
    } catch (error) {
      return { found: false, error: `Error finding accessibilityId '${id}': ${(error as Error).message}` };
    }
  }

  async findByResourceId(id: string): Promise<ElementResult> {
    const browser = this.getBrowser();
    try {
      // iOS uses name attribute or accessibility identifier
      const element = await browser.$(`[name="${id}"]`);
      if (await element.isExisting()) {
        const location = await element.getLocation();
        const size = await element.getSize();
        const text = await element.getText().catch(() => undefined);
        return {
          found: true,
          x: Math.round(location.x + size.width / 2),
          y: Math.round(location.y + size.height / 2),
          width: size.width,
          height: size.height,
          text,
        };
      }
      return { found: false, error: `Element with name '${id}' not found` };
    } catch (error) {
      return { found: false, error: `Error finding name '${id}': ${(error as Error).message}` };
    }
  }

  async findByText(text: string, exact: boolean = false): Promise<ElementResult> {
    const browser = this.getBrowser();
    try {
      // Use XPath for text matching - iOS uses label attribute
      const xpath = exact
        ? `//*[@label="${text}" or @value="${text}" or @name="${text}"]`
        : `//*[contains(@label, "${text}") or contains(@value, "${text}") or contains(@name, "${text}")]`;

      const element = await browser.$(xpath);
      if (await element.isExisting()) {
        const location = await element.getLocation();
        const size = await element.getSize();
        const elementText = await element.getText().catch(() => undefined);
        return {
          found: true,
          x: Math.round(location.x + size.width / 2),
          y: Math.round(location.y + size.height / 2),
          width: size.width,
          height: size.height,
          text: elementText,
        };
      }
      return { found: false, error: `Element with text '${text}' not found` };
    } catch (error) {
      return { found: false, error: `Error finding text '${text}': ${(error as Error).message}` };
    }
  }

  async tapElement(locator: LocatorStrategy): Promise<{ x: number; y: number }> {
    let result: ElementResult;

    switch (locator.type) {
      case "accessibilityId":
        result = await this.findByAccessibilityId(locator.value);
        break;
      case "resourceId":
        result = await this.findByResourceId(locator.value);
        break;
      case "text":
        result = await this.findByText(locator.value);
        break;
      case "xpath":
        result = await this.findByXPath(locator.value);
        break;
      case "coordinates":
        await this.tap(locator.x, locator.y);
        return { x: locator.x, y: locator.y };
    }

    if (!result.found || result.x === undefined || result.y === undefined) {
      throw new Error(result.error || "Element not found");
    }

    await this.tap(result.x, result.y);
    return { x: result.x, y: result.y };
  }

  async typeIntoElement(locator: LocatorStrategy, text: string): Promise<void> {
    // First tap to focus the element
    await this.tapElement(locator);
    await this.waitFor(200); // Brief wait for focus
    // Then type
    await this.type(text);
  }

  private async findByXPath(xpath: string): Promise<ElementResult> {
    const browser = this.getBrowser();
    try {
      const element = await browser.$(xpath);
      if (await element.isExisting()) {
        const location = await element.getLocation();
        const size = await element.getSize();
        const text = await element.getText().catch(() => undefined);
        return {
          found: true,
          x: Math.round(location.x + size.width / 2),
          y: Math.round(location.y + size.height / 2),
          width: size.width,
          height: size.height,
          text,
        };
      }
      return { found: false, error: `Element with xpath '${xpath}' not found` };
    } catch (error) {
      return { found: false, error: `Error finding xpath '${xpath}': ${(error as Error).message}` };
    }
  }
}

/**
 * Create an iOS driver config for simulator.
 */
export function createIOSSimulatorConfig(
  deviceName: string,
  platformVersion: string,
  udid?: string,
  bundleId?: string
): IOSDriverConfig {
  return {
    host: "localhost",
    port: 4723,
    path: "/",
    capabilities: {
      platformName: "iOS",
      "appium:automationName": "XCUITest",
      "appium:deviceName": deviceName,
      "appium:platformVersion": platformVersion,
      ...(udid && { "appium:udid": udid }),
      ...(bundleId && { "appium:bundleId": bundleId }),
      "appium:noReset": true,
    },
  };
}
