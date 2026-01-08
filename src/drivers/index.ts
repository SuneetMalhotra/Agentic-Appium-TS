import type { IMobileDriver } from "./types.js";
import type {
  AndroidDriverConfig,
  DriverConfig,
  MockDriverConfig,
} from "../types.js";
import { AndroidDriver } from "./android.driver.js";
import { IOSDriver, type IOSDriverConfig } from "./ios.driver.js";
import { MockDriver, SAMPLE_LOGIN_SCREENS } from "./mock.driver.js";

export type DriverType = "android" | "ios" | "mock";

/**
 * Factory function to create the appropriate driver based on type.
 * Implements the Strategy Pattern for easy swapping between platforms.
 *
 * @param type - The driver type to create
 * @param config - Optional configuration (type-specific)
 * @returns The configured driver instance
 */
export function createDriver(
  type: DriverType,
  config?: DriverConfig | IOSDriverConfig
): IMobileDriver {
  switch (type) {
    case "android": {
      const androidConfig = config as AndroidDriverConfig | undefined;
      if (!androidConfig) {
        throw new Error(
          "Android driver requires configuration. Use createDefaultAndroidConfig() to generate one."
        );
      }
      return new AndroidDriver(androidConfig);
    }

    case "ios": {
      const iosConfig = config as IOSDriverConfig | undefined;
      if (!iosConfig) {
        throw new Error(
          "iOS driver requires configuration. Use createIOSSimulatorConfig() to generate one."
        );
      }
      return new IOSDriver(iosConfig);
    }

    case "mock": {
      const mockConfig = config as MockDriverConfig | undefined;
      return new MockDriver(
        mockConfig || { screens: SAMPLE_LOGIN_SCREENS }
      );
    }

    default:
      throw new Error(`Unknown driver type: ${type}`);
  }
}

// Re-export for convenience
export { IMobileDriver } from "./types.js";
export { AndroidDriver, createDefaultAndroidConfig } from "./android.driver.js";
export { IOSDriver, createIOSSimulatorConfig, type IOSDriverConfig } from "./ios.driver.js";
export { MockDriver, SAMPLE_LOGIN_SCREENS } from "./mock.driver.js";
