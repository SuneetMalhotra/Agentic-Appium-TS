import type { IMobileDriver } from "../drivers/types.js";
import type { AgentStateType } from "../state.js";
import { parseAndroidXml } from "../utils/xml-parser.js";

/**
 * Observer Node - Captures the current state of the mobile screen.
 *
 * Responsibilities:
 * 1. Take a screenshot of the current screen
 * 2. Get the UI tree (XML page source)
 * 3. Prune the XML into a compact JSON representation
 *
 * This node runs at the start of each iteration to provide
 * fresh visual and structural context to the Reasoner.
 */
export function createObserverNode(driver: IMobileDriver) {
  return async function observer(
    _state: AgentStateType
  ): Promise<Partial<AgentStateType>> {
    try {
      // Capture screenshot and page source in parallel
      const [screenshot, pageSource] = await Promise.all([
        driver.getScreenshot(),
        driver.getPageSource(),
      ]);

      // Parse and prune the XML to reduce token usage
      const uiTree = parseAndroidXml(pageSource);

      console.log(
        `[Observer] Captured screen with ${uiTree.length} UI elements`
      );

      return {
        screenshot,
        uiTree,
        iteration: 1, // Increment iteration (reducer adds to previous)
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown observer error";
      console.error(`[Observer] Error: ${errorMessage}`);

      return {
        errors: [errorMessage],
      };
    }
  };
}
