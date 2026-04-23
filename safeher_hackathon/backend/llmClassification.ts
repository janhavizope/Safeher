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
    const systemPrompt = `You are an expert safety incident classifier. Analyze incident reports and categorize them accurately.

You must classify each incident into ONE of these types:
- harassment: Unwanted verbal conduct, catcalling, threatening messages, or intimidation
- assault: Physical attack, violence, or physical threat
- stalking: Persistent unwanted contact, surveillance, or following
- theft: Theft, robbery, or property crime
- unsafe_area: General safety concern about a location or area
- other: Doesn't fit the above categories

And assign ONE severity level:
- low: Minor concern, no immediate danger, isolated incident
- medium: Moderate concern, potential risk, pattern emerging
- high: Serious concern, significant risk, immediate danger possible
- critical: Immediate danger, urgent response needed, severe incident

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "type": "harassment|assault|stalking|theft|unsafe_area|other",
  "severity": "low|medium|high|critical",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation of classification"
}`;

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
