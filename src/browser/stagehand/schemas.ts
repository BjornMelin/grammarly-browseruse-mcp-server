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
 * Zod schema matching Stagehand V3's observe() return type (Action interface).
 * Used with Stagehand's observe() method to find actionable elements.
 *
 * @see https://docs.stagehand.dev/v3/references/observe
 */
export const ActionSchema = z.object({
  selector: z
    .string()
    .describe("XPath selector that precisely locates the element"),
  description: z
    .string()
    .describe("Human-readable description of the element and its purpose"),
  method: z
    .string()
    .optional()
    .describe("Suggested interaction method: 'click', 'fill', 'type', etc."),
  arguments: z
    .array(z.string())
    .optional()
    .describe("Additional parameters for the action"),
});

export type Action = z.infer<typeof ActionSchema>;

// Backward compatibility aliases
export const ObservationSchema = ActionSchema;
export type Observation = Action;
