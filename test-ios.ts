import { createDriver, createIOSSimulatorConfig } from "./dist/drivers/index.js";
import { runGraph } from "./dist/graph.js";

async function main() {
  // Create iOS driver for Safari
  const config = createIOSSimulatorConfig(
    "iPhone 16 Pro",
    "18.2",
    "509F0B46-F805-40FD-BB9B-2C453C3396A6",
    "com.apple.mobilesafari"  // Safari bundle ID
  );

  const driver = createDriver("ios", config);

  try {
    console.log("Connecting to iOS Simulator...");
    await driver.connect();

    console.log("Running automation...");
    const result = await runGraph(
      { driver },
      "Search for 'hello world' on the search bar"
    );

    console.log("\n=== RESULT ===");
    console.log("Success:", result.isComplete);
    console.log("Actions:", result.actionHistory);
    console.log("Errors:", result.errors);
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await driver.disconnect();
  }
}

main();
