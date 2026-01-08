import type { AgentStateType } from "../state.js";
import type { ReasonerOutput } from "../types.js";
import { ReasonerOutputSchema } from "../types.js";
import { formatElementsForPrompt } from "../utils/xml-parser.js";

const MAX_RETRIES = 3;

const SYSTEM_PROMPT = `You are a mobile UI automation agent. Your job is to analyze screenshots and UI element data to determine the next action needed to achieve a goal.

CRITICAL RULES:
1. For text input: You MUST first click the input field, then use a type action in the next step
2. PREFER SELECTORS: When possible, include a "selector" in params to enable reliable element location
3. Use the element center coordinates for click actions as FALLBACK
4. If an element is not visible, use scroll action to reveal it
5. If goal appears complete (e.g., "Welcome" screen visible), use "done" action
6. Consider the action history to avoid repeating failed actions

SELECTOR TYPES (in order of preference):
- "accessibilityId": Best choice - accessibility labels/identifiers
- "resourceId": For Android resource-id or iOS name attributes
- "text": For matching visible text content
- "coordinates": Last resort - use x,y coordinates

OUTPUT FORMAT (strict JSON only, no other text):
{
  "thought": "Your reasoning about the current state and next step",
  "action": "click" | "type" | "swipe" | "scroll" | "wait" | "done",
  "params": {
    "x": number (fallback for click),
    "y": number (fallback for click),
    "text": string (required for type),
    "direction": "up" | "down" | "left" | "right" (required for scroll/swipe),
    "selector": {
      "type": "accessibilityId" | "resourceId" | "text" | "coordinates",
      "value": "the selector value" (for non-coordinate selectors)
    },
    "elementDescription": "Human-readable description of the target element"
  },
  "targetElement": "Brief description of the target element for logging"
}

EXAMPLES:
- Click button with accessibility ID:
  {"thought": "I see a Login button with accessibility label", "action": "click", "params": {"selector": {"type": "accessibilityId", "value": "loginButton"}, "elementDescription": "Login button", "x": 540, "y": 800}, "targetElement": "Login button"}

- Click element by text:
  {"thought": "I see Settings text", "action": "click", "params": {"selector": {"type": "text", "value": "Settings"}, "elementDescription": "Settings menu item", "x": 200, "y": 300}, "targetElement": "Settings"}

- Type into field (after clicking):
  {"thought": "Username field is focused", "action": "type", "params": {"text": "testuser", "selector": {"type": "accessibilityId", "value": "usernameField"}, "elementDescription": "Username input field"}, "targetElement": "Username field"}

- Click by coordinates only (fallback):
  {"thought": "Tapping gear icon at top right", "action": "click", "params": {"x": 362, "y": 150, "elementDescription": "Settings gear icon"}, "targetElement": "Settings icon"}

- To scroll down:
  {"thought": "Need to scroll to find element", "action": "scroll", "params": {"direction": "down"}, "targetElement": "Screen"}

IMPORTANT:
- Respond with ONLY the JSON object, no additional text
- ALWAYS include "elementDescription" for click/type actions to help with self-healing
- Include x,y coordinates as FALLBACK even when providing a selector`;

function buildUserPrompt(state: AgentStateType): string {
  const parts: string[] = [];

  parts.push(`GOAL: ${state.goal}`);
  parts.push("");

  if (state.actionHistory.length > 0) {
    parts.push(`PREVIOUS ACTIONS:`);
    state.actionHistory.slice(-5).forEach((action, i) => {
      parts.push(`  ${i + 1}. ${action}`);
    });
    parts.push("");
  }

  if (state.errors.length > 0) {
    parts.push(`RECENT ERRORS (self-healing context):`);
    state.errors.slice(-3).forEach((error) => {
      parts.push(`  - ${error}`);
    });
    parts.push(`Retry count: ${state.retryCount}/${MAX_RETRIES}`);
    parts.push("");
  }

  parts.push(`UI ELEMENTS (${state.uiTree.length} elements):`);
  parts.push(formatElementsForPrompt(state.uiTree));
  parts.push("");
  parts.push("Analyze the screenshot and elements above, then provide your next action as JSON only.");

  return parts.join("\n");
}

function parseReasonerResponse(text: string): ReasonerOutput {
  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = text.trim();

  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  } else {
    // Try to find raw JSON object
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }
  }

  const parsed = JSON.parse(jsonStr);
  return ReasonerOutputSchema.parse(parsed);
}

export interface ReasonerConfig {
  /** Ollama server URL (defaults to http://localhost:11434) */
  ollamaHost?: string;
  /** Vision model to use (defaults to llava) */
  model?: string;
}

interface OllamaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[];
}

interface OllamaChatResponse {
  model: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

/**
 * Reasoner Node - Uses Ollama Vision LLM to decide the next action.
 *
 * Responsibilities:
 * 1. Send screenshot + pruned UI tree to local Ollama vision model
 * 2. Parse the structured JSON response
 * 3. Return the decided action for the Executor
 *
 * Supported vision models:
 * - llama3.2-vision (recommended)
 * - llava
 * - llava-llama3
 * - bakllava
 */
export function createReasonerNode(config: ReasonerConfig = {}) {
  const ollamaHost = config.ollamaHost || process.env.OLLAMA_HOST || "http://localhost:11434";
  const model = config.model || process.env.OLLAMA_MODEL || "llava";

  return async function reasoner(
    state: AgentStateType
  ): Promise<Partial<AgentStateType>> {
    try {
      // Check if we already completed
      if (state.isComplete) {
        return {};
      }

      const userPrompt = buildUserPrompt(state);

      console.log(`[Reasoner] Analyzing screen with ${model} for goal: "${state.goal}"`);

      // Build messages for Ollama chat API
      const messages: OllamaChatMessage[] = [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userPrompt,
          images: [state.screenshot], // Ollama accepts base64 images directly
        },
      ];

      // Call Ollama chat API
      const response = await fetch(`${ollamaHost}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: {
            temperature: 0.1, // Low temperature for consistent JSON output
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const result = (await response.json()) as OllamaChatResponse;
      const content = result.message?.content;

      if (!content) {
        throw new Error("No content in Ollama response");
      }

      const action = parseReasonerResponse(content);

      console.log(`[Reasoner] Decided: ${action.action} - ${action.thought}`);

      return {
        lastAction: action,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown reasoner error";
      console.error(`[Reasoner] Error: ${errorMessage}`);

      return {
        errors: [errorMessage],
        retryCount: state.retryCount + 1,
      };
    }
  };
}
