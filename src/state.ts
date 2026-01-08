import { Annotation } from "@langchain/langgraph";
import type { PrunedElement, ReasonerOutput } from "./types.js";

// LangGraph state schema using Annotation.Root
export const AgentState = Annotation.Root({
  // Current screenshot as base64 PNG
  screenshot: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  // Pruned UI tree from XML
  uiTree: Annotation<PrunedElement[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),

  // The goal to achieve (e.g., "Login with username 'test' and password 'pass123'")
  goal: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  // History of actions taken
  actionHistory: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Current retry count
  retryCount: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),

  // Error messages for self-healing context
  errors: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Whether the goal has been achieved
  isComplete: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),

  // Last action decided by reasoner (used by executor)
  lastAction: Annotation<ReasonerOutput | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Iteration counter for termination
  iteration: Annotation<number>({
    reducer: (prev, next) => (next === 0 ? 0 : prev + 1),
    default: () => 0,
  }),
});

export type AgentStateType = typeof AgentState.State;
