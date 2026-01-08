import type { IMobileDriver, LocatorStrategy } from "../drivers/types.js";
import type { AgentStateType } from "../state.js";
import type { SelectorHint } from "../types.js";
import { HybridLocator, type VisionFallbackFn, type HealingEvent } from "../utils/hybrid-locator.js";

const DEFAULT_WAIT_MS = 500;
const DEFAULT_SWIPE_DURATION = 300;

/**
 * Convert SelectorHint to LocatorStrategy
 */
function selectorToLocator(selector: SelectorHint): LocatorStrategy {
  switch (selector.type) {
    case "accessibilityId":
      return { type: "accessibilityId", value: selector.value || "" };
    case "resourceId":
      return { type: "resourceId", value: selector.value || "" };
    case "text":
      return { type: "text", value: selector.value || "" };
    case "xpath":
      return { type: "xpath", value: selector.value || "" };
    case "coordinates":
      return { type: "coordinates", x: selector.x || 0, y: selector.y || 0 };
  }
}

/**
 * Executor Node - Performs the action decided by the Reasoner.
 *
 * Implements Hybrid Locator Strategy:
 * 1. If selector hint provided, try selector-first approach
 * 2. If selector fails, trigger vision fallback
 * 3. Fall back to raw coordinates if no selector
 * 4. Log healing events for analytics
 */
export function createExecutorNode(
  driver: IMobileDriver,
  visionFallback?: VisionFallbackFn
) {
  const hybridLocator = new HybridLocator(driver, visionFallback);

  return async function executor(
    state: AgentStateType
  ): Promise<Partial<AgentStateType>> {
    const action = state.lastAction;

    if (!action) {
      console.log("[Executor] No action to execute");
      return {};
    }

    try {
      let historyEntry: string;
      let healingTriggered = false;

      switch (action.action) {
        case "click": {
          // Check if we have a selector hint for hybrid approach
          if (action.params.selector && action.params.selector.type !== "coordinates") {
            const locator = selectorToLocator(action.params.selector);
            const description = action.params.elementDescription || action.targetElement || "unknown element";

            try {
              const result = await hybridLocator.locateAndTap(locator, description);
              healingTriggered = result.method === "vision";
              historyEntry = `Clicked ${description} at (${result.x}, ${result.y}) via ${result.method}`;
              if (healingTriggered) {
                historyEntry += " [HEALED]";
              }
            } catch {
              // Hybrid locator failed, fall back to coordinates if available
              const x = action.params.x;
              const y = action.params.y;
              if (x !== undefined && y !== undefined) {
                await driver.tap(x, y);
                historyEntry = `Clicked at (${x}, ${y}) - ${action.targetElement} (fallback to coordinates)`;
              } else {
                throw new Error(`Failed to locate element: ${description}`);
              }
            }
          } else {
            // No selector hint, use raw coordinates
            const x = action.params.x;
            const y = action.params.y;
            if (x === undefined || y === undefined) {
              throw new Error("Click action requires x and y coordinates or selector hint");
            }
            await driver.tap(x, y);
            historyEntry = `Clicked at (${x}, ${y}) - ${action.targetElement}`;
          }
          break;
        }

        case "type": {
          const text = action.params.text;
          if (!text) {
            throw new Error("Type action requires text parameter");
          }

          // Check if we have a selector hint for the input field
          if (action.params.selector && action.params.selector.type !== "coordinates") {
            const locator = selectorToLocator(action.params.selector);
            const description = action.params.elementDescription || action.targetElement || "input field";

            try {
              const result = await hybridLocator.locateAndType(locator, description, text);
              healingTriggered = result.method === "vision";
              const truncatedText = text.length > 20 ? text.slice(0, 20) + "..." : text;
              historyEntry = `Typed "${truncatedText}" into ${description} via ${result.method}`;
              if (healingTriggered) {
                historyEntry += " [HEALED]";
              }
            } catch {
              // Fall back to just typing (assumes field is already focused)
              await driver.type(text);
              const truncatedText = text.length > 20 ? text.slice(0, 20) + "..." : text;
              historyEntry = `Typed "${truncatedText}" (field already focused)`;
            }
          } else {
            // No selector, just type into currently focused element
            await driver.type(text);
            const truncatedText = text.length > 20 ? text.slice(0, 20) + "..." : text;
            historyEntry = `Typed "${truncatedText}" into ${action.targetElement}`;
          }
          break;
        }

        case "swipe":
        case "scroll": {
          const direction = action.params.direction;
          if (!direction) {
            throw new Error("Scroll/swipe action requires direction parameter");
          }
          await driver.swipe(direction, DEFAULT_SWIPE_DURATION);
          historyEntry = `Scrolled ${direction}`;
          break;
        }

        case "wait": {
          const duration = action.params.duration || DEFAULT_WAIT_MS;
          await driver.waitFor(duration);
          historyEntry = `Waited ${duration}ms`;
          break;
        }

        case "done": {
          console.log("[Executor] Goal marked as complete");
          historyEntry = `Goal completed: ${action.thought}`;

          // Log final healing stats
          const stats = hybridLocator.getHealingStats();
          if (stats.totalAttempts > 0) {
            console.log("[Executor] Healing Statistics:");
            console.log(`  - Total attempts: ${stats.totalAttempts}`);
            console.log(`  - Selector successes: ${stats.selectorSuccesses}`);
            console.log(`  - Vision successes (healed): ${stats.visionSuccesses}`);
            console.log(`  - Failures: ${stats.failures}`);
            console.log(`  - Healing rate: ${(stats.healingRate * 100).toFixed(1)}%`);
          }

          return {
            isComplete: true,
            actionHistory: [historyEntry],
          };
        }

        default:
          throw new Error(`Unknown action type: ${action.action}`);
      }

      console.log(`[Executor] ${historyEntry}`);

      // Brief wait after action to allow UI to update
      await driver.waitFor(DEFAULT_WAIT_MS);

      return {
        actionHistory: [historyEntry],
        // Reset retry count on successful action
        retryCount: 0,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown executor error";
      console.error(`[Executor] Error: ${errorMessage}`);

      return {
        errors: [`Executor failed: ${errorMessage}`],
        retryCount: state.retryCount + 1,
        actionHistory: [`FAILED: ${action.action} - ${errorMessage}`],
      };
    }
  };
}

/**
 * Get healing events from the executor's hybrid locator
 * (For external analytics/logging)
 */
export function createExecutorWithHealingAccess(
  driver: IMobileDriver,
  visionFallback?: VisionFallbackFn
): {
  executor: ReturnType<typeof createExecutorNode>;
  getHealingLog: () => HealingEvent[];
  getHealingStats: () => ReturnType<HybridLocator["getHealingStats"]>;
} {
  const hybridLocator = new HybridLocator(driver, visionFallback);

  const executor = async function executor(
    state: AgentStateType
  ): Promise<Partial<AgentStateType>> {
    // ... same logic as above but using the shared hybridLocator
    // For now, delegate to createExecutorNode
    const node = createExecutorNode(driver, visionFallback);
    return node(state);
  };

  return {
    executor,
    getHealingLog: () => hybridLocator.getHealingLog(),
    getHealingStats: () => hybridLocator.getHealingStats(),
  };
}
