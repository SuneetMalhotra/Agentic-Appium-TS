import type { IMobileDriver, ElementResult, LocatorStrategy } from "./types.js";
import type { MockDriverConfig, MockScreen, SwipeDirection } from "../types.js";

/**
 * Mock driver for testing the graph logic without a real device.
 * Stores predefined screens and tracks actions for verification.
 */
export class MockDriver implements IMobileDriver {
  private screens: MockScreen[];
  private currentScreenIndex: number = 0;
  private connected: boolean = false;

  // Action tracking for test assertions
  public actionLog: Array<{
    type: string;
    params: Record<string, unknown>;
    timestamp: number;
  }> = [];

  constructor(config: MockDriverConfig) {
    this.screens = config.screens;
  }

  private get currentScreen(): MockScreen {
    return this.screens[this.currentScreenIndex];
  }

  private logAction(type: string, params: Record<string, unknown> = {}): void {
    this.actionLog.push({
      type,
      params,
      timestamp: Date.now(),
    });
  }

  async connect(): Promise<void> {
    this.connected = true;
    this.logAction("connect");
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.logAction("disconnect");
  }

  async getScreenshot(): Promise<string> {
    if (!this.connected) throw new Error("Driver not connected");
    this.logAction("getScreenshot");
    return this.currentScreen.screenshot;
  }

  async getPageSource(): Promise<string> {
    if (!this.connected) throw new Error("Driver not connected");
    this.logAction("getPageSource");
    return this.currentScreen.xml;
  }

  async tap(x: number, y: number): Promise<void> {
    if (!this.connected) throw new Error("Driver not connected");
    this.logAction("tap", { x, y });

    // Simulate screen transition after tap (e.g., login button -> home screen)
    this.advanceScreen();
  }

  async type(text: string): Promise<void> {
    if (!this.connected) throw new Error("Driver not connected");
    this.logAction("type", { text });
  }

  async swipe(direction: SwipeDirection, duration: number = 300): Promise<void> {
    if (!this.connected) throw new Error("Driver not connected");
    this.logAction("swipe", { direction, duration });

    // Simulate scroll revealing new content
    if (direction === "up" || direction === "down") {
      this.advanceScreen();
    }
  }

  async pressKey(key: string): Promise<void> {
    if (!this.connected) throw new Error("Driver not connected");
    this.logAction("pressKey", { key });
  }

  async waitFor(ms: number): Promise<void> {
    this.logAction("waitFor", { ms });
    await new Promise((resolve) => setTimeout(resolve, Math.min(ms, 100))); // Cap wait time in tests
  }

  /**
   * Advance to the next screen (simulates navigation).
   */
  private advanceScreen(): void {
    if (this.currentScreenIndex < this.screens.length - 1) {
      this.currentScreenIndex++;
    }
  }

  /**
   * Reset to initial state for test setup.
   */
  reset(): void {
    this.currentScreenIndex = 0;
    this.actionLog = [];
  }

  /**
   * Set a specific screen (useful for testing specific scenarios).
   */
  setScreen(index: number): void {
    if (index >= 0 && index < this.screens.length) {
      this.currentScreenIndex = index;
    }
  }

  /**
   * Get action log for test assertions.
   */
  getActions(): typeof this.actionLog {
    return [...this.actionLog];
  }

  /**
   * Check if a specific action was performed.
   */
  hasAction(type: string, params?: Record<string, unknown>): boolean {
    return this.actionLog.some((action) => {
      if (action.type !== type) return false;
      if (!params) return true;
      return Object.entries(params).every(
        ([key, value]) => action.params[key] === value
      );
    });
  }

  // ============ ELEMENT FINDING METHODS (for Hybrid Locator Strategy) ============

  getScreenSize(): { width: number; height: number } {
    return { width: 1080, height: 1920 }; // Mock screen size
  }

  async findByAccessibilityId(id: string): Promise<ElementResult> {
    this.logAction("findByAccessibilityId", { id });
    // Mock implementation - returns a found element at a predictable location
    if (id.includes("login") || id.includes("username") || id.includes("password")) {
      return {
        found: true,
        x: 540,
        y: 450,
        width: 880,
        height: 100,
        text: id,
      };
    }
    return { found: false, error: `Element with accessibilityId '${id}' not found` };
  }

  async findByResourceId(id: string): Promise<ElementResult> {
    this.logAction("findByResourceId", { id });
    // Mock implementation based on sample screens
    const resourceMap: Record<string, { x: number; y: number; text?: string }> = {
      "com.app:id/username": { x: 540, y: 450 },
      "com.app:id/password": { x: 540, y: 600 },
      "com.app:id/login_button": { x: 540, y: 800, text: "Login" },
      "com.app:id/welcome": { x: 540, y: 250, text: "Welcome, User!" },
      "com.app:id/logout_button": { x: 540, y: 450, text: "Logout" },
    };

    const element = resourceMap[id];
    if (element) {
      return {
        found: true,
        x: element.x,
        y: element.y,
        width: 880,
        height: 100,
        text: element.text,
      };
    }
    return { found: false, error: `Element with resourceId '${id}' not found` };
  }

  async findByText(text: string, exact: boolean = false): Promise<ElementResult> {
    this.logAction("findByText", { text, exact });
    // Mock implementation
    const textMap: Record<string, { x: number; y: number }> = {
      Login: { x: 540, y: 800 },
      Logout: { x: 540, y: 450 },
      "Welcome, User!": { x: 540, y: 250 },
    };

    for (const [key, value] of Object.entries(textMap)) {
      if (exact ? key === text : key.toLowerCase().includes(text.toLowerCase())) {
        return {
          found: true,
          x: value.x,
          y: value.y,
          width: 880,
          height: 100,
          text: key,
        };
      }
    }
    return { found: false, error: `Element with text '${text}' not found` };
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
        result = { found: false, error: "XPath not supported in mock driver" };
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
    await this.tapElement(locator);
    await this.waitFor(100);
    await this.type(text);
  }
}

// Sample screens for testing a login flow
export const SAMPLE_LOGIN_SCREENS: MockScreen[] = [
  {
    name: "login_screen",
    screenshot: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", // 1x1 placeholder
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy rotation="0">
  <android.widget.FrameLayout bounds="[0,0][1080,1920]">
    <android.widget.LinearLayout bounds="[0,0][1080,1920]">
      <android.widget.EditText resource-id="com.app:id/username" text="" content-desc="Username input" bounds="[100,400][980,500]" clickable="true" enabled="true" class="android.widget.EditText"/>
      <android.widget.EditText resource-id="com.app:id/password" text="" content-desc="Password input" bounds="[100,550][980,650]" clickable="true" enabled="true" class="android.widget.EditText"/>
      <android.widget.Button resource-id="com.app:id/login_button" text="Login" bounds="[100,750][980,850]" clickable="true" enabled="true" class="android.widget.Button"/>
    </android.widget.LinearLayout>
  </android.widget.FrameLayout>
</hierarchy>`,
  },
  {
    name: "home_screen",
    screenshot: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy rotation="0">
  <android.widget.FrameLayout bounds="[0,0][1080,1920]">
    <android.widget.TextView resource-id="com.app:id/welcome" text="Welcome, User!" bounds="[100,200][980,300]" clickable="false" enabled="true" class="android.widget.TextView"/>
    <android.widget.Button resource-id="com.app:id/logout_button" text="Logout" bounds="[100,400][980,500]" clickable="true" enabled="true" class="android.widget.Button"/>
  </android.widget.FrameLayout>
</hierarchy>`,
  },
];
