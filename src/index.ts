import {
  createDriver,
  createDefaultAndroidConfig,
  type DriverType,
} from "./drivers/index.js";
import { runGraph } from "./graph.js";
import type { ExecutionResult, AndroidDriverConfig } from "./types.js";

export interface AutomationOptions {
  /** Driver type: "android" or "mock" */
  driverType?: DriverType;
  /** Android driver configuration (required for android driver) */
  androidConfig?: AndroidDriverConfig;
  /** Ollama server URL (defaults to http://localhost:11434) */
  ollamaHost?: string;
  /** Ollama vision model to use (defaults to llava) */
  model?: string;
}

/**
 * Run mobile automation with a natural language goal.
 *
 * @example
 * ```typescript
 * // Using mock driver for testing (requires Ollama running locally)
 * const result = await runAutomation(
 *   "Login with username 'testuser' and password 'secret123'",
 *   { driverType: "mock" }
 * );
 *
 * // Using real Android device with custom Ollama model
 * const result = await runAutomation(
 *   "Login with username 'testuser' and password 'secret123'",
 *   {
 *     driverType: "android",
 *     androidConfig: createDefaultAndroidConfig("Pixel_6_API_33"),
 *     model: "llava",
 *   }
 * );
 * ```
 */
export async function runAutomation(
  goal: string,
  options: AutomationOptions = {}
): Promise<ExecutionResult> {
  const {
    driverType = "mock",
    androidConfig,
    ollamaHost,
    model,
  } = options;

  // Create driver
  const driver = createDriver(
    driverType,
    driverType === "android" ? androidConfig : undefined
  );

  try {
    // Connect driver
    await driver.connect();

    // Run the automation graph
    const finalState = await runGraph(
      {
        driver,
        reasonerConfig: { ollamaHost, model },
      },
      goal
    );

    // Build result
    const result: ExecutionResult = {
      success: finalState.isComplete,
      goal,
      actionHistory: finalState.actionHistory,
      finalState: finalState.isComplete
        ? "completed"
        : finalState.retryCount >= 3
          ? "max_retries"
          : "failed",
      errors: finalState.errors,
    };

    return result;
  } finally {
    // Always disconnect
    await driver.disconnect();
  }
}

// Re-export useful types and utilities
export { createDefaultAndroidConfig } from "./drivers/index.js";
export type { ExecutionResult, AndroidDriverConfig, ReasonerOutput } from "./types.js";
export type { DriverType } from "./drivers/index.js";

// CLI entry point
async function main() {
  const goal = process.argv[2];

  if (!goal) {
    console.log(`
Usage: node dist/index.js "<goal>"

Examples:
  node dist/index.js "Login with username 'test' and password 'pass123'"
  node dist/index.js "Click the signup button"

Environment Variables:
  OLLAMA_HOST  - Ollama server URL (default: http://localhost:11434)
  OLLAMA_MODEL - Vision model to use (default: llava)
  DRIVER_TYPE  - "mock" or "android" (default: mock)
  DEVICE_NAME  - Android device name (required for android driver)
`);
    process.exit(1);
  }

  const driverType = (process.env.DRIVER_TYPE || "mock") as DriverType;
  const deviceName = process.env.DEVICE_NAME;

  let androidConfig: AndroidDriverConfig | undefined;
  if (driverType === "android") {
    if (!deviceName) {
      console.error("Error: DEVICE_NAME environment variable is required for android driver");
      process.exit(1);
    }
    androidConfig = createDefaultAndroidConfig(deviceName);
  }

  try {
    const result = await runAutomation(goal, {
      driverType,
      androidConfig,
    });

    console.log("\n--- Result ---");
    console.log(JSON.stringify(result, null, 2));

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error("Automation failed:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
