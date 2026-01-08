import { XMLParser } from "fast-xml-parser";
import type { Bounds, PrunedElement } from "../types.js";

const BOUNDS_REGEX = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/;
const MAX_TEXT_LENGTH = 50;

/**
 * Parse Android bounds string into numeric coordinates with center point.
 * @param boundsStr - Format: "[x1,y1][x2,y2]" e.g., "[156,892][924,1050]"
 * @returns Bounds object with coordinates and center point
 */
export function parseBounds(boundsStr: string): Bounds | null {
  const match = boundsStr.match(BOUNDS_REGEX);
  if (!match) return null;

  const x1 = parseInt(match[1], 10);
  const y1 = parseInt(match[2], 10);
  const x2 = parseInt(match[3], 10);
  const y2 = parseInt(match[4], 10);

  return {
    x1,
    y1,
    x2,
    y2,
    centerX: Math.round((x1 + x2) / 2),
    centerY: Math.round((y1 + y2) / 2),
  };
}

/**
 * Truncate text to prevent token bloat.
 */
function truncateText(text: string | undefined | null): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= MAX_TEXT_LENGTH) return trimmed;
  return trimmed.slice(0, MAX_TEXT_LENGTH) + "...";
}

/**
 * Check if an element has any identifiable attributes.
 */
function hasIdentifiableContent(attrs: Record<string, string>): boolean {
  return !!(
    attrs["resource-id"] ||
    attrs["text"] ||
    attrs["content-desc"]
  );
}

/**
 * Check if an element is visible and potentially interactable.
 */
function isVisible(attrs: Record<string, string>): boolean {
  // Skip invisible elements
  if (attrs["displayed"] === "false") return false;

  // Skip elements with zero size
  const bounds = parseBounds(attrs["bounds"] || "");
  if (!bounds) return false;
  if (bounds.x2 - bounds.x1 <= 0 || bounds.y2 - bounds.y1 <= 0) return false;

  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XmlNode = any;

/**
 * Recursively extract pruned elements from parsed XML (preserveOrder format).
 */
function extractElements(nodes: XmlNode[], elements: PrunedElement[]): void {
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;

    // Get attributes (nested in :@.:@ with preserveOrder)
    const attrWrapper = node[":@"] as { ":@"?: Record<string, string> } | undefined;
    const attrs: Record<string, string> = attrWrapper?.[":@"] || {};

    // Process this node if it has useful content
    if (attrs["bounds"] && isVisible(attrs)) {
      const bounds = parseBounds(attrs["bounds"]);

      if (bounds && (hasIdentifiableContent(attrs) || attrs["clickable"] === "true")) {
        elements.push({
          resourceId: attrs["resource-id"] || null,
          text: truncateText(attrs["text"]),
          contentDesc: truncateText(attrs["content-desc"]),
          className: attrs["class"] || "unknown",
          bounds,
          clickable: attrs["clickable"] === "true",
          enabled: attrs["enabled"] !== "false",
        });
      }
    }

    // Recurse into children (any key that's not :@)
    for (const key of Object.keys(node)) {
      if (key === ":@") continue;

      const children = node[key];
      if (Array.isArray(children)) {
        extractElements(children, elements);
      }
    }
  }
}

/**
 * Parse Android UI XML and return pruned elements.
 * Dramatically reduces token usage by keeping only essential attributes.
 *
 * @param xml - Raw XML from Appium getPageSource()
 * @returns Array of pruned UI elements with bounds and identifiers
 */
export function parseAndroidXml(xml: string): PrunedElement[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    attributesGroupName: ":@",
    preserveOrder: true,
    trimValues: true,
  });

  const elements: PrunedElement[] = [];

  try {
    const parsed = parser.parse(xml) as XmlNode[];
    extractElements(parsed, elements);
  } catch (error) {
    console.error("Failed to parse Android XML:", error);
    return [];
  }

  return elements;
}

/**
 * Format pruned elements as a compact string for the LLM prompt.
 */
export function formatElementsForPrompt(elements: PrunedElement[]): string {
  if (elements.length === 0) {
    return "(No UI elements detected)";
  }

  return elements
    .map((el, idx) => {
      const parts: string[] = [`[${idx}]`];

      if (el.text) parts.push(`text="${el.text}"`);
      if (el.contentDesc) parts.push(`desc="${el.contentDesc}"`);
      if (el.resourceId) {
        // Shorten resource IDs (remove package prefix)
        const shortId = el.resourceId.split("/").pop() || el.resourceId;
        parts.push(`id="${shortId}"`);
      }

      parts.push(`class="${el.className.split(".").pop()}"`);
      parts.push(`center=(${el.bounds.centerX},${el.bounds.centerY})`);

      if (el.clickable) parts.push("clickable");
      if (!el.enabled) parts.push("disabled");

      return parts.join(" ");
    })
    .join("\n");
}
