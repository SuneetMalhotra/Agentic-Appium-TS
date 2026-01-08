import type { VisionFallbackFn } from "./hybrid-locator.js";

/**
 * Vision fallback prompt for element location
 */
const VISION_LOCATE_PROMPT = `You are a mobile UI element locator. Analyze the screenshot and find the described element.

ELEMENT TO FIND: {description}

IMPORTANT:
- Look carefully at the screenshot
- Return ONLY the center coordinates (x, y) of the element
- If the element is not visible, return null

OUTPUT FORMAT (strict JSON only):
{"x": number, "y": number} or null

Examples:
- Element found: {"x": 200, "y": 350}
- Not found: null

Respond with ONLY JSON, no other text.`;

interface OllamaChatResponse {
  model: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

/**
 * Create a vision fallback function using Ollama
 */
export function createOllamaVisionFallback(
  ollamaHost: string = "http://localhost:11434",
  model: string = "llava"
): VisionFallbackFn {
  return async function visionFallback(
    elementDescription: string,
    screenshot: string
  ): Promise<{ x: number; y: number } | null> {
    console.log(`[VisionFallback] Locating: "${elementDescription}"`);

    const prompt = VISION_LOCATE_PROMPT.replace("{description}", elementDescription);

    try {
      const response = await fetch(`${ollamaHost}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: prompt,
              images: [screenshot],
            },
          ],
          stream: false,
          options: {
            temperature: 0.1,
          },
        }),
      });

      if (!response.ok) {
        console.error(`[VisionFallback] Ollama API error: ${response.status}`);
        return null;
      }

      const result = (await response.json()) as OllamaChatResponse;
      const content = result.message?.content?.trim();

      if (!content) {
        console.error("[VisionFallback] No content in response");
        return null;
      }

      // Parse the JSON response
      const jsonMatch = content.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        if (content.toLowerCase().includes("null")) {
          console.log("[VisionFallback] Element not found");
          return null;
        }
        console.error("[VisionFallback] Could not parse response:", content);
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (parsed && typeof parsed.x === "number" && typeof parsed.y === "number") {
        console.log(`[VisionFallback] Found element at (${parsed.x}, ${parsed.y})`);
        return { x: parsed.x, y: parsed.y };
      }

      console.log("[VisionFallback] Element not found");
      return null;
    } catch (error) {
      console.error(`[VisionFallback] Error:`, error);
      return null;
    }
  };
}

/**
 * Healing event summary for logging
 */
export interface HealingSummary {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  totalLocateAttempts: number;
  selectorSuccesses: number;
  visionHealings: number;
  failures: number;
  events: HealingEventLog[];
}

export interface HealingEventLog {
  timestamp: Date;
  elementDescription: string;
  attemptedSelector?: string;
  method: "selector" | "vision" | "failed";
  coordinates?: { x: number; y: number };
  durationMs: number;
}

/**
 * Healing logger for session analytics
 */
export class HealingLogger {
  private summary: HealingSummary;

  constructor(sessionId?: string) {
    this.summary = {
      sessionId: sessionId || `session-${Date.now()}`,
      startTime: new Date(),
      totalLocateAttempts: 0,
      selectorSuccesses: 0,
      visionHealings: 0,
      failures: 0,
      events: [],
    };
  }

  logEvent(event: HealingEventLog): void {
    this.summary.events.push(event);
    this.summary.totalLocateAttempts++;

    switch (event.method) {
      case "selector":
        this.summary.selectorSuccesses++;
        break;
      case "vision":
        this.summary.visionHealings++;
        break;
      case "failed":
        this.summary.failures++;
        break;
    }
  }

  getSummary(): HealingSummary {
    return {
      ...this.summary,
      endTime: new Date(),
    };
  }

  printSummary(): void {
    const s = this.getSummary();
    console.log("\n========== HEALING SESSION SUMMARY ==========");
    console.log(`Session ID: ${s.sessionId}`);
    console.log(`Duration: ${((s.endTime!.getTime() - s.startTime.getTime()) / 1000).toFixed(1)}s`);
    console.log(`Total Locate Attempts: ${s.totalLocateAttempts}`);
    console.log(`  - Selector Successes: ${s.selectorSuccesses}`);
    console.log(`  - Vision Healings: ${s.visionHealings}`);
    console.log(`  - Failures: ${s.failures}`);

    if (s.totalLocateAttempts > 0) {
      const healingRate = ((s.visionHealings / s.totalLocateAttempts) * 100).toFixed(1);
      const successRate = (((s.selectorSuccesses + s.visionHealings) / s.totalLocateAttempts) * 100).toFixed(1);
      console.log(`Healing Rate: ${healingRate}%`);
      console.log(`Overall Success Rate: ${successRate}%`);
    }
    console.log("=============================================\n");
  }

  exportToJSON(): string {
    return JSON.stringify(this.getSummary(), null, 2);
  }
}
