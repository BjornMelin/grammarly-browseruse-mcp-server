import { z } from "zod";

/**
 * Zod schema for extracting Grammarly AI detection and plagiarism scores.
 * Used with Stagehand's extract() method for structured data extraction.
 */
export const GrammarlyExtractSchema = z.object({
  aiDetectionPercent: z
    .number()
    .min(0)
    .max(100)
    .nullable()
    .describe(
      "AI-generated content percentage (0-100) shown by Grammarly's AI Detector. Set to null if the feature is unavailable or not visible.",
    ),
  plagiarismPercent: z
    .number()
    .min(0)
    .max(100)
    .nullable()
    .describe(
      "Plagiarism/originality percentage (0-100) from Grammarly's Plagiarism Checker. Set to null if the feature is unavailable or not visible.",
    ),
  overallScore: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe(
      "Overall Grammarly performance score if visible in the interface. Optional.",
    ),
  notes: z
    .string()
    .describe(
      "Brief observations about what was visible in the UI, including any warnings, loading states, or issues encountered.",
    ),
});

export type GrammarlyExtractResult = z.infer<typeof GrammarlyExtractSchema>;

/**
 * Schema for observing UI elements before acting.
 * Used with Stagehand's observe() method to find actionable elements.
 */
export const ObservationSchema = z.object({
  selector: z.string().describe("CSS selector for the observed element"),
  description: z.string().describe("Human-readable description of the element"),
  visible: z.boolean().describe("Whether the element is currently visible"),
  interactable: z
    .boolean()
    .describe("Whether the element can be interacted with"),
});

export type Observation = z.infer<typeof ObservationSchema>;
