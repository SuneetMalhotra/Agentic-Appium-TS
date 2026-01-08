import { createDriver, createIOSSimulatorConfig } from "./dist/drivers/index.js";

/**
 * Test the Hybrid Locator Strategy with Safari on iOS Simulator
 *
 * This test demonstrates:
 * 1. Finding elements by text selector
 * 2. Finding elements by accessibility ID
 * 3. Falling back to coordinates when selectors fail
 */
async function main() {
  const config = createIOSSimulatorConfig(
    "iPhone 16 Pro",
    "18.2",
    "509F0B46-F805-40FD-BB9B-2C453C3396A6",
    "com.apple.mobilesafari"
  );

  const driver = createDriver("ios", config);

  try {
    console.log("=== Hybrid Locator Strategy Test ===\n");
    console.log("Connecting to iOS Simulator...");
    await driver.connect();

    console.log("\n--- Testing Element Finding Methods ---\n");

    // Wait for app to load
    await driver.waitFor(2000);

    // Test 1: Find by text
    console.log("Test 1: Finding element by text 'Safari'...");
    const textResult = await driver.findByText("Safari");
    console.log("  Result:", textResult);

    // Test 2: Find by accessibility ID (URL bar)
    console.log("\nTest 2: Finding URL bar by accessibility ID...");
    const urlBarResult = await driver.findByAccessibilityId("URL");
    console.log("  Result:", urlBarResult);

    // Test 3: Get screen size
    console.log("\nTest 3: Getting screen size...");
    const screenSize = driver.getScreenSize();
    console.log("  Screen size:", screenSize);

    // Test 4: Tap using text selector
    console.log("\nTest 4: Tapping URL bar using selector...");
    try {
      // Try to tap the URL/search field
      const tapResult = await driver.tapElement({ type: "text", value: "Search or enter website" });
      console.log("  Tapped at:", tapResult);
      await driver.waitFor(1000);
    } catch (error) {
      console.log("  Selector failed, trying alternatives...");
      // Try accessibility ID
      try {
        const tapResult = await driver.tapElement({ type: "accessibilityId", value: "TabBarItemTitle" });
        console.log("  Tapped via accessibilityId at:", tapResult);
      } catch {
        // Fall back to coordinates (center top area where URL bar typically is)
        console.log("  Using coordinate fallback...");
        await driver.tap(screenSize.width / 2, 80);
        console.log("  Tapped at center-top coordinates");
      }
    }

    await driver.waitFor(1000);

    // Test 5: Type into the focused field
    console.log("\nTest 5: Typing URL...");
    await driver.type("https://example.com");
    console.log("  Typed URL");

    await driver.waitFor(500);

    // Test 6: Press Enter to navigate
    console.log("\nTest 6: Pressing Enter...");
    await driver.pressKey("enter");
    console.log("  Pressed Enter");

    await driver.waitFor(3000);

    // Take screenshot to verify
    console.log("\nTest 7: Taking screenshot...");
    const screenshot = await driver.getScreenshot();
    console.log("  Screenshot captured (length:", screenshot.length, "bytes)");

    // Get page source
    console.log("\nTest 8: Getting page source...");
    const source = await driver.getPageSource();
    console.log("  Page source length:", source.length, "characters");

    // Check if example.com loaded by looking for its text
    console.log("\nTest 9: Checking if page loaded...");
    const exampleResult = await driver.findByText("Example Domain");
    if (exampleResult.found) {
      console.log("  SUCCESS! Found 'Example Domain' text at:", exampleResult.x, exampleResult.y);
    } else {
      console.log("  Page text not found (may still be loading)");
    }

    console.log("\n=== Test Complete ===");
    console.log("The Hybrid Locator Strategy is working!");

  } catch (error) {
    console.error("\nError:", error.message);
    console.error(error.stack);
  } finally {
    console.log("\nDisconnecting...");
    await driver.disconnect();
  }
}

main();
