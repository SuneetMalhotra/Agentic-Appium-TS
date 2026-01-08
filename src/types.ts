import { z } from "zod";

// Action types supported by the framework
export type MobileAction = "click" | "type" | "swipe" | "scroll" | "wait" | "done";

export type SwipeDirection = "up" | "down" | "left" | "right";

// Parsed bounds from Android XML
export interface Bounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  centerX: number;
  centerY: number;
}

// Pruned UI element from XML
export interface PrunedElement {
  resourceId: string | null;
  text: string | null;
  contentDesc: string | null;
  className: string;
  bounds: Bounds;
  clickable: boolean;
  enabled: boolean;
}

// Selector types for hybrid locator strategy
export type SelectorType = "accessibilityId" | "resourceId" | "text" | "xpath" | "coordinates";

export interface SelectorHint {
  type: SelectorType;
  value?: string;
  x?: number;
  y?: number;
}

// Action parameters with hybrid locator support
export interface ActionParams {
  x?: number;
  y?: number;
  text?: string;
  direction?: SwipeDirection;
  duration?: number;
  // Hybrid locator fields
  selector?: SelectorHint;
  elementDescription?: string; // Human-readable description for vision fallback
}

// Selector hint schema for Zod validation
const SelectorHintSchema = z.object({
  type: z.enum(["accessibilityId", "resourceId", "text", "xpath", "coordinates"]),
  value: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
});

// Reasoner output schema (validated with Zod)
export const ReasonerOutputSchema = z.object({
  thought: z.string().describe("Reasoning about the current state and next action"),
  action: z.enum(["click", "type", "swipe", "scroll", "wait", "done"]),
  params: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    text: z.string().optional(),
    direction: z.enum(["up", "down", "left", "right"]).optional(),
    duration: z.number().optional(),
    // Hybrid locator fields
    selector: SelectorHintSchema.optional(),
    elementDescription: z.string().optional(),
  }).optional().default({}),
  targetElement: z.string().optional().default("unknown"),
});

export type ReasonerOutput = z.infer<typeof ReasonerOutputSchema>;

// Driver configuration
export interface AndroidDriverConfig {
  host: string;
  port: number;
  path: string;
  capabilities: {
    platformName: "Android";
    "appium:automationName": "UiAutomator2";
    "appium:deviceName": string;
    "appium:app"?: string;
    "appium:appPackage"?: string;
    "appium:appActivity"?: string;
    "appium:noReset"?: boolean;
  };
}

export interface MockDriverConfig {
  screens: MockScreen[];
}

export interface MockScreen {
  name: string;
  screenshot: string; // base64
  xml: string;
}

export type DriverConfig = AndroidDriverConfig | MockDriverConfig;

// Execution result
export interface ExecutionResult {
  success: boolean;
  goal: string;
  actionHistory: string[];
  finalState: "completed" | "failed" | "max_retries";
  errors: string[];
}
