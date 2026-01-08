import { createDriver, createIOSSimulatorConfig } from "./dist/drivers/index.js";

async function main() {
  // Create iOS driver for Shape Popper app
  const config = createIOSSimulatorConfig(
    "iPhone 16 Pro",
    "18.2",
    "509F0B46-F805-40FD-BB9B-2C453C3396A6",
    "com.shapepopper.app"
  );

  const driver = createDriver("ios", config);

  try {
    console.log("Connecting to iOS Simulator...");
    await driver.connect();

    console.log("\nWaiting 3 seconds - watch the simulator...\n");
    await driver.waitFor(3000);

    console.log("=== Step 1: Tapping Settings gear icon (top right) ===");
    await driver.tap(362, 150);
    console.log("Tapped! Waiting 3 seconds...\n");
    await driver.waitFor(3000);

    console.log("=== Step 2: Tapping first toggle ===");
    await driver.tap(350, 300);
    console.log("Tapped! Waiting 2 seconds...\n");
    await driver.waitFor(2000);

    console.log("=== Step 3: Tapping second toggle ===");
    await driver.tap(350, 400);
    console.log("Tapped! Waiting 2 seconds...\n");
    await driver.waitFor(2000);

    console.log("\n=== DONE ===");
    console.log("Successfully turned off both toggles!");

  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    console.log("\nDisconnecting...");
    await driver.disconnect();
  }
}

main();
