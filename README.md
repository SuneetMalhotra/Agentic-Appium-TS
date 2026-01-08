# Agentic Appium TS

A **Self-Healing Agentic Mobile Automation Framework** built with TypeScript, LangGraph.js, and Appium. Uses vision AI models for intelligent element detection and automatic recovery when traditional selectors fail.

## Features

- **Hybrid Locator Strategy**: Selector-first approach with vision AI fallback
- **Self-Healing**: Automatic recovery when UI elements change or selectors break
- **Multi-Platform**: iOS (XCUITest) and Android (UiAutomator2) support
- **Vision AI**: Uses Ollama with llava model for intelligent screen analysis
- **LangGraph Architecture**: Observer → Reasoner → Executor pattern for robust automation

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         LangGraph Loop                          │
│                                                                 │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                │
│  │ Observer │────▶│ Reasoner │────▶│ Executor │───┐            │
│  └──────────┘     └──────────┘     └──────────┘   │            │
│       ▲                                           │            │
│       │           ┌──────────┐                    │            │
│       └───────────│  Router  │◀───────────────────┘            │
│                   └──────────┘                                 │
│                        │                                       │
│                   [goal_complete?]                             │
│                        │                                       │
│                   ┌────┴────┐                                  │
│                   ▼         ▼                                  │
│                 END     Observer                               │
└─────────────────────────────────────────────────────────────────┘
```

### Hybrid Locator Flow

```
1. Reasoner outputs action with selector hint + fallback coordinates
2. Executor tries selector-first via HybridLocator
3. If selector fails → Vision model locates element
4. Falls back to coordinates if vision fails
5. Healing events logged throughout
```

## Project Structure

```
src/
├── drivers/
│   ├── types.ts          # IMobileDriver interface & LocatorStrategy
│   ├── ios.driver.ts     # iOS/XCUITest implementation
│   ├── android.driver.ts # Android/UiAutomator2 implementation
│   ├── mock.driver.ts    # Mock driver for testing
│   └── index.ts          # Driver factory
├── nodes/
│   ├── observer.ts       # Captures screenshots & UI tree
│   ├── reasoner.ts       # Vision LLM decides next action
│   └── executor.ts       # Executes actions with hybrid locator
├── utils/
│   ├── hybrid-locator.ts # Selector-first with vision fallback
│   ├── vision-fallback.ts# Ollama vision integration
│   └── xml-parser.ts     # Android XML parsing
├── state.ts              # LangGraph state definition
├── types.ts              # Core type definitions
├── graph.ts              # StateGraph builder & runner
└── index.ts              # Main entry point
```

## Prerequisites

- **Node.js** 18+
- **Appium** 2.x with drivers:
  - `appium driver install xcuitest` (iOS)
  - `appium driver install uiautomator2` (Android)
- **Ollama** with vision model:
  ```bash
  ollama pull llava
  ollama serve
  ```
- **Xcode** (for iOS Simulator)
- **Android SDK** (for Android Emulator)

## Installation

```bash
npm install
npm run build
```

## Quick Start

### 1. Start Appium Server

```bash
appium
```

### 2. Start Ollama

```bash
ollama serve
```

### 3. Run iOS Automation

```javascript
import { createDriver, createIOSSimulatorConfig } from "./dist/drivers/index.js";
import { runGraph } from "./dist/graph.js";

const config = createIOSSimulatorConfig(
  "iPhone 16 Pro",
  "18.2",
  "YOUR-SIMULATOR-UDID",
  "com.apple.Preferences"  // Settings app
);

const driver = createDriver("ios", config);
await driver.connect();

const result = await runGraph(
  { driver },
  "Navigate to Display & Brightness settings"
);

console.log("Success:", result.isComplete);
await driver.disconnect();
```

### 4. Run Tests

```bash
# Test hybrid locator with Safari
node test-hybrid-locator.mjs

# Test Settings app automation
node test-settings-app.mjs
```

## Hybrid Locator Strategy

The framework uses a **selector-first** approach with **vision fallback**:

```typescript
// Reasoner outputs action with selector hint
{
  "action": "click",
  "params": {
    "selector": { "type": "text", "value": "Settings" },
    "elementDescription": "Settings menu item",
    "x": 200, "y": 300  // fallback coordinates
  }
}
```

**Locator Priority:**
1. `accessibilityId` - Best for stable automation
2. `resourceId` - Android resource-id / iOS name
3. `text` - Visible text matching
4. `xpath` - XPath expressions
5. `coordinates` - Last resort fallback

When selectors fail, the **Vision Fallback** activates:
- Takes screenshot
- Asks Ollama llava model to locate element by description
- Returns coordinates for the element
- Logs healing event for analytics

## Configuration

### Environment Variables

```bash
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llava
```

### Graph Options

```typescript
const result = await runGraph({
  driver,
  reasonerConfig: {
    ollamaHost: "http://localhost:11434",
    model: "llava"
  },
  enableVisionFallback: true  // Enable self-healing
}, "Your automation goal");
```

## Driver Methods

### Core Methods
- `connect()` / `disconnect()` - Session management
- `tap(x, y)` - Tap at coordinates
- `type(text)` - Type text into focused element
- `swipe(direction)` - Swipe gesture
- `pressKey(key)` - Press special keys
- `getScreenshot()` - Capture screen (base64)
- `getPageSource()` - Get UI tree (XML)

### Hybrid Locator Methods
- `findByAccessibilityId(id)` - Find by accessibility ID
- `findByResourceId(id)` - Find by resource ID
- `findByText(text, exact?)` - Find by visible text
- `tapElement(locator)` - Tap using locator strategy
- `typeIntoElement(locator, text)` - Type into element
- `getScreenSize()` - Get screen dimensions

## Healing Analytics

The framework tracks all locator attempts:

```typescript
const stats = hybridLocator.getHealingStats();
// {
//   totalAttempts: 10,
//   selectorSuccesses: 7,
//   visionSuccesses: 2,  // healed!
//   failures: 1,
//   healingRate: 0.2
// }
```

## License

MIT

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
