import { END, START, StateGraph } from "@langchain/langgraph";
import type { IMobileDriver } from "./drivers/types.js";
import { createObserverNode } from "./nodes/observer.js";
import { createReasonerNode, type ReasonerConfig } from "./nodes/reasoner.js";
import { createExecutorNode } from "./nodes/executor.js";
import { AgentState, type AgentStateType } from "./state.js";
import { createOllamaVisionFallback } from "./utils/vision-fallback.js";
import type { VisionFallbackFn } from "./utils/hybrid-locator.js";

const MAX_RETRIES = 3;
const MAX_ITERATIONS = 15; // Max graph iterations to prevent infinite loops

/**
 * Router function - Decides whether to continue or end the graph.
 *
 * Routes to END if:
 * - Goal is complete (isComplete === true)
 * - Max retries exceeded (retryCount >= 3)
 *
 * Routes to "observer" to continue the loop otherwise.
 */
function createRouter() {
  return function router(state: AgentStateType): "continue" | "end" {
    if (state.isComplete) {
      console.log("[Router] Goal complete, ending graph");
      return "end";
    }

    if (state.retryCount >= MAX_RETRIES) {
      console.log(`[Router] Max retries (${MAX_RETRIES}) exceeded, ending graph`);
      return "end";
    }

    if (state.iteration >= MAX_ITERATIONS) {
      console.log(`[Router] Max iterations (${MAX_ITERATIONS}) reached, ending graph`);
      return "end";
    }

    console.log(`[Router] Continuing to observer (iteration ${state.iteration + 1}/${MAX_ITERATIONS})`);
    return "continue";
  };
}

export interface GraphConfig {
  driver: IMobileDriver;
  reasonerConfig?: ReasonerConfig;
  /** Enable vision fallback for self-healing (defaults to true) */
  enableVisionFallback?: boolean;
  /** Custom vision fallback function (uses Ollama by default) */
  visionFallback?: VisionFallbackFn;
}

/**
 * Create the automation StateGraph.
 *
 * Graph Structure:
 *   START -> observer -> reasoner -> executor -> router
 *                                                  |
 *                                    continue: observer
 *                                    end: END
 *
 * Hybrid Locator Strategy:
 *   - Executor uses selector-first approach
 *   - On selector failure, triggers vision fallback for self-healing
 */
export function createAutomationGraph(config: GraphConfig) {
  const { driver, reasonerConfig, enableVisionFallback = true, visionFallback } = config;

  // Create vision fallback if enabled
  let visionFn: VisionFallbackFn | undefined;
  if (enableVisionFallback) {
    const ollamaHost = reasonerConfig?.ollamaHost || process.env.OLLAMA_HOST || "http://localhost:11434";
    const model = reasonerConfig?.model || process.env.OLLAMA_MODEL || "llava";
    visionFn = visionFallback || createOllamaVisionFallback(ollamaHost, model);
    console.log("[Graph] Vision fallback enabled for self-healing");
  }

  // Create nodes with driver injected
  const observerNode = createObserverNode(driver);
  const reasonerNode = createReasonerNode(reasonerConfig);
  const executorNode = createExecutorNode(driver, visionFn);
  const routerFn = createRouter();

  // Build the state graph
  const graph = new StateGraph(AgentState)
    .addNode("observer", observerNode)
    .addNode("reasoner", reasonerNode)
    .addNode("executor", executorNode)
    .addEdge(START, "observer")
    .addEdge("observer", "reasoner")
    .addEdge("reasoner", "executor")
    .addConditionalEdges("executor", routerFn, {
      continue: "observer",
      end: END,
    });

  return graph.compile();
}

/**
 * Run the automation graph with a given goal.
 */
export async function runGraph(
  config: GraphConfig,
  goal: string
): Promise<AgentStateType> {
  const compiledGraph = createAutomationGraph(config);

  // Initialize state with goal
  const initialState: Partial<AgentStateType> = {
    goal,
    retryCount: 0,
    actionHistory: [],
    errors: [],
    isComplete: false,
    uiTree: [],
    screenshot: "",
    lastAction: null,
  };

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Starting automation with goal: "${goal}"`);
  console.log(`${"=".repeat(60)}\n`);

  const finalState = await compiledGraph.invoke(initialState, {
    recursionLimit: MAX_ITERATIONS * 3, // 3 nodes per iteration
  });

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Automation ${finalState.isComplete ? "COMPLETED" : "FAILED"}`);
  console.log(`Actions taken: ${finalState.actionHistory.length}`);
  console.log(`${"=".repeat(60)}\n`);

  return finalState;
}
