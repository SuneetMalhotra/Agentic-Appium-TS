import { createDriver, createIOSSimulatorConfig } from "./dist/drivers/index.js";
import { runGraph } from "./dist/graph.js";

/**
 * Test automation on iOS Settings App
 *
 * This demonstrates the full automation flow:
 * 1. Connect to simulator
 * 2. Navigate through Settings
 * 3. Use hybrid locator (selectors + vision fallback)
 */
async function main() {
  const config = createIOSSimulatorConfig(
    "iPhone 16 Pro",
    "18.2",
    "509F0B46-F805-40FD-BB9B-2C453C3396A6",
    "com.apple.Preferences"  // Settings app bundle ID
  );

  const driver = createDriver("ios", config);

  try {
    console.log("=== iOS Settings App Automation Test ===\n");
    console.log("Connecting to iOS Simulator...");
    await driver.connect();

    // Wait for Settings to load
    await driver.waitFor(2000);

    console.log("\n--- Manual Test Steps ---\n");

    // Step 1: Find and tap on "General"
    console.log("Step 1: Looking for 'General' menu item...");
    const generalResult = await driver.findByText("General");
    if (generalResult.found) {
      console.log(`  Found 'General' at (${generalResult.x}, ${generalResult.y})`);
      await driver.tap(generalResult.x, generalResult.y);
      console.log("  Tapped 'General'");
    } else {
      console.log("  'General' not visible, scrolling down...");
      await driver.swipe("up");
      await driver.waitFor(500);
      const retry = await driver.findByText("General");
      if (retry.found) {
        await driver.tap(retry.x, retry.y);
        console.log("  Found and tapped 'General' after scroll");
      }
    }

    await driver.waitFor(1500);

    // Step 2: Find and tap on "About"
    console.log("\nStep 2: Looking for 'About'...");
    const aboutResult = await driver.findByText("About");
    if (aboutResult.found) {
      console.log(`  Found 'About' at (${aboutResult.x}, ${aboutResult.y})`);
      await driver.tap(aboutResult.x, aboutResult.y);
      console.log("  Tapped 'About'");
    }

    await driver.waitFor(1500);

    // Step 3: Verify we're on About page
    console.log("\nStep 3: Verifying About page loaded...");
    const nameResult = await driver.findByText("Name");
    if (nameResult.found) {
      console.log("  SUCCESS! Found 'Name' field on About page");
    }

    // Also look for device model
    const modelResult = await driver.findByText("iPhone 16 Pro");
    if (modelResult.found) {
      console.log(`  Found device model at (${modelResult.x}, ${modelResult.y})`);
    }

    // Step 4: Go back
    console.log("\nStep 4: Going back...");
    const backResult = await driver.findByText("General");
    if (backResult.found) {
      await driver.tap(backResult.x, backResult.y);
      console.log("  Tapped back to General");
    }

    await driver.waitFor(1000);

    console.log("\n=== Manual Test Complete ===\n");

    // Now run an automated goal with the LangGraph agent
    console.log("--- Running LangGraph Agent ---\n");
    console.log("Goal: Navigate to Display & Brightness settings\n");

    // Go back to main settings first
    const settingsBack = await driver.findByText("Settings");
    if (settingsBack.found) {
      await driver.tap(settingsBack.x, settingsBack.y);
      await driver.waitFor(1000);
    }

    const result = await runGraph(
      {
        driver,
        reasonerConfig: {
          ollamaHost: "http://localhost:11434",
          model: "llava"
        }
      },
      "Find and tap on 'Display & Brightness' in Settings"
    );

    console.log("\n--- Agent Result ---");
    console.log("Goal Complete:", result.isComplete);
    console.log("Actions taken:", result.actionHistory.length);
    result.actionHistory.forEach((action, i) => {
      console.log(`  ${i + 1}. ${action}`);
    });

    if (result.errors.length > 0) {
      console.log("Errors:", result.errors);
    }

  } catch (error) {
    console.error("\nError:", error.message);
  } finally {
    console.log("\nDisconnecting...");
    await driver.disconnect();
  }
}

main();
