import { invokeLLM } from "./_core/llm";

export type IncidentClassification = {
  type: "harassment" | "assault" | "stalking" | "theft" | "unsafe_area" | "other";
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  reasoning: string;
};

/**
 * Use Claude to automatically classify an incident based on its description.
 * Returns suggested type, severity, and confidence score.
 */
export async function classifyIncident(description: string): Promise<IncidentClassification> {
  try {
    const systemPrompt = `You are a highly sophisticated Safety Incident Classifier for SafeHer. Your mission is to analyze incident reports and categorize them with high precision to help protect the community.

### CLASSIFICATION CATEGORIES:
1. harassment: Unwanted verbal/physical conduct, catcalling, threatening messages, or intimidation.
2. assault: Physical attack, violence, or direct physical threat to safety.
3. stalking: Persistent unwanted contact, being followed, or surveillance.
4. theft: Robbery, pickpocketing, or property crime.
5. unsafe_area: General safety concerns about location (e.g., "dark alley", "poor lighting", "suspicious groups").
6. other: Anything that doesn't fit the above (be specific in reasoning).

### SEVERITY LEVELS:
- low: No immediate danger, minor concern (e.g., poor lighting).
- medium: Potential risk, uncomfortable situation, or non-violent harassment.
- high: Significant risk, violent threats, or multiple aggressors.
- critical: Immediate danger, life-threatening, or physical assault in progress/just occurred.

### OUTPUT FORMAT:
You must return ONLY a JSON object. No markdown blocks, no preamble.
{
  "type": "harassment" | "assault" | "stalking" | "theft" | "unsafe_area" | "other",
  "severity": "low" | "medium" | "high" | "critical",
  "confidence": 0.0-1.0,
  "reasoning": "A concise explanation of why this classification was chosen."
}

### EXAMPLES:
- "Someone followed me for three blocks from the station" -> {"type": "stalking", "severity": "high", "confidence": 0.95, "reasoning": "Active following over distance indicates targeted stalking and significant risk."}
- "The street lights are all out on Main St" -> {"type": "unsafe_area", "severity": "low", "confidence": 1.0, "reasoning": "Environmental safety concern with no immediate person-to-person threat."}`;

    const userPrompt = `Classify this incident report:

${description}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt as any },
        { role: "user", content: userPrompt as any },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from LLM");
    }

    // Parse the JSON response
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const parsed = JSON.parse(contentStr);

    // Validate the response
    const validTypes = ["harassment", "assault", "stalking", "theft", "unsafe_area", "other"];
    const validSeverities = ["low", "medium", "high", "critical"];

    if (!validTypes.includes(parsed.type)) {
      parsed.type = "other";
    }
    if (!validSeverities.includes(parsed.severity)) {
      parsed.severity = "medium";
    }

    const confidence = Math.min(1, Math.max(0, parsed.confidence || 0.5));

    return {
      type: parsed.type,
      severity: parsed.severity,
      confidence,
      reasoning: parsed.reasoning || "Classification performed by LLM",
    };
  } catch (error) {
    console.error("[LLM Classification] Error:", error);
    // Return a safe default if classification fails
    return {
      type: "other",
      severity: "medium",
      confidence: 0,
      reasoning: "Classification failed, using default",
    };
  }
}
