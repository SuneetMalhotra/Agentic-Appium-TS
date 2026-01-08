import { remote, type Browser } from "webdriverio";
import type { IMobileDriver, ElementResult, LocatorStrategy } from "./types.js";
import type { AndroidDriverConfig, SwipeDirection } from "../types.js";

// Screen dimensions for swipe calculations
const DEFAULT_SCREEN_WIDTH = 1080;
const DEFAULT_SCREEN_HEIGHT = 1920;

/**
 * Android driver implementation using WebdriverIO with Appium.
 * Uses W3C Actions API for coordinate-based interactions.
 */
export class AndroidDriver implements IMobileDriver {
  private browser: Browser | null = null;
  private config: AndroidDriverConfig;
  private screenWidth: number = DEFAULT_SCREEN_WIDTH;
  private screenHeight: number = DEFAULT_SCREEN_HEIGHT;

  constructor(config: AndroidDriverConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    console.log("[AndroidDriver] Connecting to Appium server...");

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
      `[AndroidDriver] Connected. Screen: ${this.screenWidth}x${this.screenHeight}`
    );
  }

  async disconnect(): Promise<void> {
    if (this.browser) {
      console.log("[AndroidDriver] Disconnecting...");
      await this.browser.deleteSession();
      this.browser = null;
    }
  }

  private getBrowser(): Browser {
    if (!this.browser) {
      throw new Error("AndroidDriver not connected. Call connect() first.");
    }
    return this.browser;
  }

  async getScreenshot(): Promise<string> {
    const browser = this.getBrowser();
    const screenshot = await browser.takeScreenshot();
    return screenshot; // Already base64 encoded
  }

  async getPageSource(): Promise<string> {
    const browser = this.getBrowser();
    return await browser.getPageSource();
  }

  async tap(x: number, y: number): Promise<void> {
    const browser = this.getBrowser();
    console.log(`[AndroidDriver] Tapping at (${x}, ${y})`);

    // W3C Actions API for precise coordinate tapping
    await browser.action("pointer", {
      parameters: { pointerType: "touch" },
    })
      .move({ x, y, duration: 0 })
      .down()
      .pause(50)
      .up()
      .perform();
  }

  async type(text: string): Promise<void> {
    const browser = this.getBrowser();
    console.log(`[AndroidDriver] Typing: "${text.slice(0, 20)}${text.length > 20 ? "..." : ""}"`);

    // Use sendKeys for typing (works with focused element)
    await browser.keys(text.split(""));
  }

  async swipe(
    direction: SwipeDirection,
    duration: number = 300
  ): Promise<void> {
    const browser = this.getBrowser();
    console.log(`[AndroidDriver] Swiping ${direction}`);

    // Calculate swipe coordinates based on direction
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
    console.log(`[AndroidDriver] Pressing key: ${key}`);

    // Map common key names to Android key codes
    const keyMap: Record<string, number> = {
      enter: 66,
      back: 4,
      home: 3,
      tab: 61,
      delete: 67,
      escape: 111,
    };

    const keyCode = keyMap[key.toLowerCase()];
    if (keyCode) {
      await browser.execute("mobile: pressKey", { keycode: keyCode });
    } else {
      // Try as a single character
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
      // Android uses resource-id attribute
      const element = await browser.$(`android=new UiSelector().resourceId("${id}")`);
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
      return { found: false, error: `Element with resourceId '${id}' not found` };
    } catch (error) {
      return { found: false, error: `Error finding resourceId '${id}': ${(error as Error).message}` };
    }
  }

  async findByText(text: string, exact: boolean = false): Promise<ElementResult> {
    const browser = this.getBrowser();
    try {
      // Android UiSelector for text matching
      const selector = exact
        ? `android=new UiSelector().text("${text}")`
        : `android=new UiSelector().textContains("${text}")`;

      const element = await browser.$(selector);
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
 * Create a default Android driver config for local Appium server.
 */
export function createDefaultAndroidConfig(
  deviceName: string,
  appPath?: string
): AndroidDriverConfig {
  return {
    host: "localhost",
    port: 4723,
    path: "/",
    capabilities: {
      platformName: "Android",
      "appium:automationName": "UiAutomator2",
      "appium:deviceName": deviceName,
      ...(appPath && { "appium:app": appPath }),
      "appium:noReset": true,
    },
  };
}
