/**
 * Mock Claude response fixtures for different scenarios.
 */

/**
 * Standard rewrite response.
 */
export const standardRewriteResponse = {
	rewrittenText: `I've been reflecting on this issue for some time, and honestly,
it's more nuanced than most people assume. You get that gut feeling
when something isn't quite right - that's what happened in this case.
After experimenting with various strategies, I finally found an approach
that seems to work well.`,
	reasoning:
		"Replaced formal connectors with conversational language, varied sentence lengths, and added personal voice.",
};

/**
 * Minimal change rewrite (text already good).
 */
export const minimalChangeResponse = {
	rewrittenText:
		"This text was already well-written with natural language patterns.",
	reasoning: "Minor adjustments to sentence rhythm. Original text was close to target.",
};

/**
 * Aggressive rewrite response for high AI detection.
 */
export const aggressiveRewriteResponse = {
	rewrittenText: `Look, here's the thing - I've spent way too much time on this problem.
It kept bugging me, you know? Some approaches worked great, others fell flat.
But after all that trial and error, something finally clicked. Not perfect,
but it gets the job done.`,
	reasoning:
		"Complete restructuring with colloquial expressions, contractions, and informal tone to significantly reduce AI detection patterns.",
};

/**
 * Analysis response for analyze mode.
 */
export const analysisResponse = {
	analysis: `The text exhibits several characteristics commonly associated with AI-generated content:

1. **Uniform paragraph structure**: Each paragraph follows a similar length and pattern
2. **Formal connectors**: Heavy use of "Furthermore," "Moreover," "Additionally"
3. **Passive voice**: Multiple instances of passive construction
4. **Hedging language**: Frequent use of "it is important to note" and similar phrases

Recommendations:
- Vary sentence length and structure
- Use active voice and personal pronouns
- Replace formal connectors with natural transitions
- Add specific examples and anecdotes`,
};

/**
 * Summary response for optimization completion.
 */
export const summaryResponse = `Optimization completed successfully:

**Results:**
- AI Detection: Reduced from 45% to 8% (within 10% threshold)
- Plagiarism: Reduced from 12% to 2% (within 5% threshold)
- Iterations: 3 of 5 maximum

**Key Changes Made:**
1. Replaced formal academic language with conversational tone
2. Added personal pronouns and contractions
3. Varied sentence lengths and paragraph structures
4. Introduced rhetorical questions and colloquialisms

The final text maintains the original meaning while significantly reducing detectable AI patterns.`;

/**
 * Error/failure response.
 */
export const errorResponse = {
	error: "Failed to generate rewrite",
	message: "Rate limit exceeded or API unavailable",
};

/**
 * Empty/minimal text handling.
 */
export const emptyTextResponse = {
	rewrittenText: "",
	reasoning: "Input text was empty or contained only whitespace.",
};
