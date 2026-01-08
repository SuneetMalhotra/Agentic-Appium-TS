import { createDriver, createIOSSimulatorConfig } from "./dist/drivers/index.js";
import { writeFileSync } from "fs";

async function main() {
  const config = createIOSSimulatorConfig(
    "iPhone 16 Pro",
    "18.2",
    "509F0B46-F805-40FD-BB9B-2C453C3396A6",
    "com.shapepopper.app"
  );

  const driver = createDriver("ios", config);

  try {
    console.log("Connecting...");
    await driver.connect();

    console.log("Waiting for app to load...");
    await driver.waitFor(2000);

    console.log("Taking screenshot...");
    const screenshot = await driver.getScreenshot();

    // Save as file
    const buffer = Buffer.from(screenshot, 'base64');
    writeFileSync('/Users/suneetmalhotra/Desktop/app-ai-automation/screenshot.png', buffer);
    console.log("Screenshot saved to screenshot.png");

    // Also get page source
    const source = await driver.getPageSource();
    writeFileSync('/Users/suneetmalhotra/Desktop/app-ai-automation/page-source.xml', source);
    console.log("Page source saved to page-source.xml");

  } finally {
    await driver.disconnect();
  }
}

main();
