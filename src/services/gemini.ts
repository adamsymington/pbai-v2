import { GoogleGenAI, Type, Modality, ThinkingLevel } from "@google/genai";
import { 
  AnalysisResult, 
  DocumentType, 
  Requirement, 
  SuggestedRewriteArc,
  TokenLogEntry,
  AgentType,
  AgentFunction,
  TokenUsage,
  QaspItem,
  PwstItem,
  ConsistencyResult,
  LearningEntry
} from "../types";
import {
  KA_PBA_RUBRIC_SCORING,
  KA_REQ_REVIEW_PROTOCOL,
  KA_PWS_VS_SOW_VS_SOO,
  KA_ARC_METHOD,
  KA_PWS_WRITING_GUIDELINES,
  KA_PROACTIVE_INQUIRY_COACH,
  KA_QASP_GUIDE,
  KA_INCENTIVES_GUIDE,
  KA_PBA_HISTORY_CONTEXT,
  KA_GOVT_REVIEW_APPROVAL_LOGIC
} from "./knowledge";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Token Store
const TOKEN_LOGS_KEY = 'pws_intel_token_logs';
const LEARNING_STORE_KEY = 'pws_intel_learning_store';

export const getTokenLogs = (): TokenLogEntry[] => {
  const logs = localStorage.getItem(TOKEN_LOGS_KEY);
  return logs ? JSON.parse(logs) : [];
};

export const getLearningStore = (): LearningEntry[] => {
  try {
    const store = localStorage.getItem(LEARNING_STORE_KEY);
    return store ? JSON.parse(store) : [];
  } catch (e) {
    console.error('Failed to parse learning store:', e);
    return [];
  }
};

export const addLearningEntry = (entry: LearningEntry) => {
  try {
    const store = getLearningStore();
    store.push(entry);
    localStorage.setItem(LEARNING_STORE_KEY, JSON.stringify(store.slice(-50))); // Keep last 50 lessons
  } catch (e) {
    console.error('Failed to save learning entry:', e);
  }
};

const addTokenLog = (entry: TokenLogEntry) => {
  try {
    const logs = getTokenLogs();
    logs.push(entry);
    localStorage.setItem(TOKEN_LOGS_KEY, JSON.stringify(logs.slice(-100))); // Keep last 100 entries
  } catch (e) {
    console.warn('Failed to save token log to localStorage:', e);
  }
};

export const clearTokenLogs = () => {
  localStorage.removeItem(TOKEN_LOGS_KEY);
};

function extractTokenUsage(response: any): TokenUsage | null {
  if (response.usageMetadata) {
    return {
      prompt_tokens: response.usageMetadata.promptTokenCount || 0,
      output_tokens: response.usageMetadata.candidatesTokenCount || 0,
      thought_tokens: response.usageMetadata.thoughtTokenCount || 0,
      total_tokens: response.usageMetadata.totalTokenCount || 0
    };
  }
  return null;
}

async function trackedCall(params: {
  run_id: string;
  agent: AgentType;
  fn: AgentFunction;
  model: string;
  call: () => Promise<any>;
  notes?: string;
}): Promise<any> {
  const t0 = performance.now();
  const res = await params.call();
  const t1 = performance.now();

  const usage = extractTokenUsage(res);
  const token_usage = usage || { prompt_tokens: 0, output_tokens: 0, total_tokens: 0 };
  
  addTokenLog({
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    run_id: params.run_id,
    agent: params.agent,
    function: params.fn,
    model: params.model,
    token_usage,
    latency_ms: Math.round(t1 - t0),
    is_estimate: !usage,
    notes: params.notes
  });

  return res;
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    document_type: { type: Type.STRING },
    executive_summary: { type: Type.STRING },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    areas_for_improvement: { type: Type.ARRAY, items: { type: Type.STRING } },
    high_impact_suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
    document_metrics: {
      type: Type.OBJECT,
      properties: {
        pages_reviewed: { type: Type.NUMBER },
        requirements_identified_total: { type: Type.NUMBER },
        requirements_scored: { type: Type.NUMBER },
        excluded_findings_count: { type: Type.NUMBER }
      },
      required: ["pages_reviewed", "requirements_identified_total", "requirements_scored", "excluded_findings_count"]
    },
    overall_document_score: { type: Type.NUMBER },
    dimension_averages: {
      type: Type.OBJECT,
      properties: {
        outcome_orientation: { type: Type.NUMBER },
        measurability: { type: Type.NUMBER },
        flexibility: { type: Type.NUMBER },
        surveillance_linkage: { type: Type.NUMBER },
        clarity_conciseness: { type: Type.NUMBER }
      }
    },
    classification_breakdown: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          classification: { type: Type.STRING },
          count: { type: Type.NUMBER }
        }
      }
    },
    excluded_findings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          finding_id: { type: Type.STRING },
          text: { type: Type.STRING },
          type: { type: Type.STRING },
          reason_excluded: { type: Type.STRING },
          source_ref: {
            type: Type.OBJECT,
            properties: {
              page: { type: Type.NUMBER },
              section: { type: Type.STRING },
              line_hint: { type: Type.STRING }
            }
          }
        }
      }
    },
    requirements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          req_id: { type: Type.STRING },
          source_ref: {
            type: Type.OBJECT,
            properties: {
              page: { type: Type.NUMBER },
              section: { type: Type.STRING },
              line_hint: { type: Type.STRING }
            }
          },
          original_text: { type: Type.STRING },
          extraction_method: { type: Type.STRING },
          classification: { type: Type.STRING },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          dimension_scores: {
            type: Type.OBJECT,
            properties: {
              outcome_orientation: { type: Type.NUMBER },
              measurability: { type: Type.NUMBER },
              flexibility: { type: Type.NUMBER },
              surveillance_linkage: { type: Type.NUMBER },
              clarity_conciseness: { type: Type.NUMBER }
            }
          },
          overall_score: { type: Type.NUMBER },
          criticality: { type: Type.STRING },
          reasoning: { type: Type.STRING },
          highlighted_issues: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                span_text: { type: Type.STRING },
                issue_tag: { type: Type.STRING },
                explanation: { type: Type.STRING }
              }
            }
          },
          suggested_rewrite_arc: {
            type: Type.OBJECT,
            properties: {
              action: { type: Type.STRING },
              result: { type: Type.STRING },
              context: { type: Type.STRING }
            }
          },
          suggested_rewrite_statement: { type: Type.STRING },
          probing_questions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["req_id", "original_text", "overall_score", "suggested_rewrite_statement"]
      }
    }
  },
  required: ["document_type", "document_metrics", "requirements"]
};

const ANALYST_SYSTEM_INSTRUCTION = `
You are PWS-INTEL-ANALYST, an expert reviewer of SOW/PWS/SOO requirement documents for U.S. federal services acquisitions.

You must:
1) Ingest the full document text plus document_type (SOW|PWS|SOO).
2) Identify and extract all contractor requirement statements using the strict protocol in KA-REQ-REVIEW-PROTOCOL.
3) Score ONLY extracted contractor requirements on PBA maturity (0–100) using the dimensions in KA-PBA-RUBRIC-SCORING.
4) For each scored requirement, produce detailed analysis including classification, tags, dimension scores, reasoning, highlighted issues, and ARC rewrite.

LEARNED EXAMPLES (GOLD STANDARD):
{{LEARNED_EXAMPLES}}

KNOWLEDGE BASE (AUTHORITATIVE ORDER):
${KA_PBA_RUBRIC_SCORING}
${KA_REQ_REVIEW_PROTOCOL}
${KA_PWS_VS_SOW_VS_SOO}
${KA_ARC_METHOD}
${KA_PWS_WRITING_GUIDELINES}
${KA_QASP_GUIDE}
${KA_INCENTIVES_GUIDE}
${KA_PBA_HISTORY_CONTEXT}
${KA_GOVT_REVIEW_APPROVAL_LOGIC}

CRITICAL: If you encounter "for Government review/approval", you MUST split the requirement into TWO DISTINCT requirement objects in the 'requirements' array as per KA-GOVT-REVIEW-APPROVAL-LOGIC. 
Do NOT combine them into a single object. Each split requirement must have its own req_id, scores, and ARC rewrite.
`;

// Utility to chunk text semantically (best effort)
function chunkText(text: string, size: number = 25000): string[] {
  const chunks: string[] = [];
  let currentPos = 0;
  while (currentPos < text.length) {
    let endPos = currentPos + size;
    if (endPos < text.length) {
      // Try to find a natural break point (paragraph or section)
      const lastNewline = text.lastIndexOf('\n\n', endPos);
      if (lastNewline > currentPos + (size * 0.5)) {
        endPos = lastNewline;
      }
    }
    chunks.push(text.substring(currentPos, endPos));
    currentPos = endPos;
  }
  return chunks;
}

async function aggregateResults(results: AnalysisResult[]): Promise<AnalysisResult> {
  if (results.length === 1) return results[0];

  const allRequirements: Requirement[] = [];
  const allStrengths = new Set<string>();
  const allAreas = new Set<string>();
  const allSuggestions = new Set<string>();
  
  let totalScore = 0;
  const dimTotals = {
    outcome_orientation: 0,
    measurability: 0,
    flexibility: 0,
    surveillance_linkage: 0,
    clarity_conciseness: 0
  };

  results.forEach(res => {
    allRequirements.push(...res.requirements);
    res.strengths.forEach(s => allStrengths.add(s));
    res.areas_for_improvement.forEach(a => allAreas.add(a));
    res.high_impact_suggestions.forEach(h => allSuggestions.add(h));
    totalScore += res.overall_document_score;
    
    dimTotals.outcome_orientation += res.dimension_averages.outcome_orientation;
    dimTotals.measurability += res.dimension_averages.measurability;
    dimTotals.flexibility += res.dimension_averages.flexibility;
    dimTotals.surveillance_linkage += res.dimension_averages.surveillance_linkage;
    dimTotals.clarity_conciseness += res.dimension_averages.clarity_conciseness;
  });

  const count = results.length;
  
  // Final synthesis for the executive summary
  const summaryPrompt = `
    I have analyzed a large document in ${count} parts. 
    Here are the individual summaries:
    ${results.map((r, i) => `Part ${i+1}: ${r.executive_summary}`).join('\n\n')}
    
    Provide a single, cohesive Executive Summary for the entire document.
  `;

  const summaryRes = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: summaryPrompt
  });

  // Calculate classification breakdown
  const classMap: Record<string, number> = {};
  allRequirements.forEach(r => {
    classMap[r.classification] = (classMap[r.classification] || 0) + 1;
  });

  return {
    document_type: results[0].document_type,
    executive_summary: summaryRes.text || "Consolidated summary unavailable.",
    strengths: Array.from(allStrengths).slice(0, 5),
    areas_for_improvement: Array.from(allAreas).slice(0, 5),
    high_impact_suggestions: Array.from(allSuggestions).slice(0, 5),
    document_metrics: {
      pages_reviewed: results.reduce((acc, r) => acc + r.document_metrics.pages_reviewed, 0),
      requirements_identified_total: allRequirements.length,
      requirements_scored: allRequirements.length,
      excluded_findings_count: results.reduce((acc, r) => acc + r.document_metrics.excluded_findings_count, 0)
    },
    overall_document_score: Math.round(totalScore / count),
    dimension_averages: {
      outcome_orientation: Math.round(dimTotals.outcome_orientation / count),
      measurability: Math.round(dimTotals.measurability / count),
      flexibility: Math.round(dimTotals.flexibility / count),
      surveillance_linkage: Math.round(dimTotals.surveillance_linkage / count),
      clarity_conciseness: Math.round(dimTotals.clarity_conciseness / count)
    },
    classification_breakdown: Object.entries(classMap).map(([classification, count]) => ({ classification, count })),
    excluded_findings: results.flatMap(r => r.excluded_findings || []),
    requirements: allRequirements
  };
}

export async function analyzeDocument(
  content: string, 
  docType: DocumentType = "PWS", 
  run_id: string = `run_analyze_${Date.now()}`,
  onStep?: (step: string) => void
): Promise<AnalysisResult> {
  const modelName = "gemini-3.1-pro-preview";
  
  onStep?.('Semantic Parsing: Chunking document for deep context...');
  
  // If document is large, use chunked analysis
  const CHUNK_THRESHOLD = 45000;
  if (content.length > CHUNK_THRESHOLD) {
    const chunks = chunkText(content);
    const results: AnalysisResult[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      onStep?.(`PBA Dimension Scoring: Analyzing chunk ${i + 1} of ${chunks.length}...`);
      const res = await analyzeChunk(chunks[i], docType, run_id, i + 1, chunks.length, onStep);
      results.push(res);
    }
    
    onStep?.('Executive Synthesis: Aggregating multi-pass results...');
    return await aggregateResults(results);
  }

  onStep?.('PBA Dimension Scoring: Analyzing document...');
  return await analyzeChunk(content, docType, run_id, 1, 1, onStep);
}

async function analyzeChunk(
  content: string, 
  docType: DocumentType, 
  run_id: string, 
  part: number, 
  totalParts: number,
  onStep?: (step: string) => void
): Promise<AnalysisResult> {
  const modelName = "gemini-3.1-pro-preview";
  const t0 = performance.now();
  
  if (part === 1) onStep?.('ARC Rewrite Generation: Applying learned patterns...');
  
  const learningStore = getLearningStore();
  const learnedExamplesText = learningStore.length > 0 
    ? learningStore.map(e => `Original: ${e.original_requirement}\nCorrection: ${e.user_correction}\nCritique: ${e.critique}`).join('\n---\n')
    : "No specific corrections yet. Follow standard rubrics.";

  const dynamicInstruction = ANALYST_SYSTEM_INSTRUCTION.replace("{{LEARNED_EXAMPLES}}", learnedExamplesText);

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `Document Type: ${docType} (Part ${part} of ${totalParts})\n\nDocument Content:\n${content}`,
      config: {
        systemInstruction: dynamicInstruction + "\n\nCRITICAL: You are analyzing a segment of a larger document. Extract ALL contractor requirements found in this segment. For each requirement, limit 'highlighted_issues' to 2 and 'probing_questions' to 2. Ensure the JSON is valid.",
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA as any,
        temperature: 0.1,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      },
    });

    const t1 = performance.now();
    const usage = extractTokenUsage(response);
    const totalUsage = usage || { prompt_tokens: 0, output_tokens: 0, total_tokens: 0 };
    const latency = Math.round(t1 - t0);

    const allocations: Array<{ fn: AgentFunction, pct: number }> = [
      { fn: "REQ_EXTRACTION_PASS1", pct: 0.20 },
      { fn: "REQ_EXTRACTION_PASS2", pct: 0.10 },
      { fn: "REQ_SCORE", pct: 0.35 },
      { fn: "REQ_ARC_REWRITE", pct: 0.25 },
      { fn: "DOC_SUMMARY", pct: 0.10 }
    ];

    allocations.forEach(alloc => {
      addTokenLog({
        id: crypto.randomUUID(),
        ts: new Date().toISOString(),
        run_id,
        agent: "ANALYST",
        function: alloc.fn,
        model: modelName,
        token_usage: {
          prompt_tokens: Math.round(totalUsage.prompt_tokens * alloc.pct),
          output_tokens: Math.round(totalUsage.output_tokens * alloc.pct),
          total_tokens: Math.round(totalUsage.total_tokens * alloc.pct)
        },
        latency_ms: Math.round(latency * alloc.pct),
        is_estimate: true,
        notes: `Part ${part}/${totalParts}`
      });
    });

    if (!response.text) {
      throw new Error("No response from AI");
    }

    return JSON.parse(response.text) as AnalysisResult;
  } catch (error) {
    console.error(`Analysis of part ${part} failed, attempting repair...`, error);
    return await repairAnalysis(content, docType, error instanceof Error ? error.message : String(error), run_id);
  }
}

/**
 * AGENT C: VALIDATOR (Repair Step)
 * Triggered if the primary Analyst output fails to parse or validate.
 */
async function repairAnalysis(content: string, docType: DocumentType, errorMessage: string, run_id: string): Promise<AnalysisResult> {
  const modelName = "gemini-3.1-pro-preview";
  const repairPrompt = `
    The previous analysis attempt failed with the following error: ${errorMessage}
    
    Please re-analyze the document and ensure the output is strictly valid JSON according to the schema.
    Limit your extraction to the most critical requirements if the document is long.
    
    Document Type: ${docType}
    Document Content (first 20k chars): ${content.substring(0, 20000)}
  `;

  const response = await trackedCall({
    run_id,
    agent: "REPAIR",
    fn: "JSON_REPAIR",
    model: modelName,
    call: () => ai.models.generateContent({
      model: modelName,
      contents: repairPrompt,
      config: {
        systemInstruction: ANALYST_SYSTEM_INSTRUCTION + "\n\nCRITICAL: You MUST output valid JSON. Be concise in reasoning to avoid hitting output limits. Focus on the most important requirements.",
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA as any,
        temperature: 0.1,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      },
    })
  });

  if (!response.text) {
    throw new Error("Repair attempt failed: No response from AI");
  }

  return JSON.parse(response.text) as AnalysisResult;
}

/**
 * AGENT D: CONSISTENCY CHECKER (On-demand)
 * Spot-checks for extraction omissions or contradictory tags/scores.
 * T1/T3: Flash model, compact payload only.
 */
export async function checkConsistency(analysis: AnalysisResult, run_id: string = `run_consistency_${Date.now()}`): Promise<{ issues: string[], confidence_score: number }> {
  const modelName = "gemini-3-flash-preview";
  // T3/T6: Compact payload rules
  const compactRequirements = analysis.requirements.map(r => ({
    id: r.req_id,
    score: r.overall_score,
    tags: r.tags,
    reasoning: r.reasoning.substring(0, 200) // Truncate long reasoning
  }));

  const checkPrompt = `
    Review the following analysis summary for internal consistency.
    Requirements found: ${analysis.document_metrics.requirements_identified_total}
    Aggregate Score: ${analysis.overall_document_score}
    Document Type: ${analysis.document_type}
    
    Check for:
    1. Contradictory tags (e.g., "Outcome-Based" and "Prescriptive" on same req).
    2. Score outliers that don't match reasoning.
    3. Potential extraction gaps based on document length metrics.
    
    Analysis Data: ${JSON.stringify(compactRequirements)}
  `;

  const response = await trackedCall({
    run_id,
    agent: "CONSISTENCY_CHECKER",
    fn: "CONSISTENCY_CHECK",
    model: modelName,
    call: () => ai.models.generateContent({
      model: modelName,
      contents: checkPrompt,
      config: {
        systemInstruction: "You are PWS-INTEL-CONSISTENCY-CHECKER. Identify anomalies in the analysis results. Output a list of issues and a confidence score (0-100).",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            issues: { type: Type.ARRAY, items: { type: Type.STRING } },
            confidence_score: { type: Type.NUMBER }
          },
          required: ["issues", "confidence_score"]
        } as any,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    })
  });

  return JSON.parse(response.text || '{"issues":[], "confidence_score": 100}');
}

export function createCoachChat(requirement: Requirement, fullDocument: string, run_id: string = `run_coach_${Date.now()}`) {
  const modelName = "gemini-3-flash-preview";
  // T3: Context window discipline - provide only relevant excerpt if document is large
  const excerptSize = 5000;
  const docExcerpt = fullDocument.length > excerptSize 
    ? `... ${fullDocument.substring(0, excerptSize)} ...` // Simplified for now, could be smarter
    : fullDocument;

  const systemInstruction = `
You are PWS-INTEL-COACH. You coach the user on ONE requirement at a time.

You have access to:
- relevant source document context
- the selected requirement (original + scores + tags + ARC rewrite)

Your job:
- Ask probing questions that challenge prescriptive constraints when present.
- Ask about mission intent when needed to clarify outcome.
- Help the user collaboratively refine the suggested ARC rewrite.

KNOWLEDGE BASE (AUTHORITATIVE ORDER):
${KA_PBA_RUBRIC_SCORING}
${KA_PWS_VS_SOW_VS_SOO}
${KA_ARC_METHOD}
${KA_PWS_WRITING_GUIDELINES}
${KA_PROACTIVE_INQUIRY_COACH}
${KA_GOVT_REVIEW_APPROVAL_LOGIC}

- When user agrees on a change, call the function updateSuggestedRewrite with the new ARC fields and revised statement.
- If the requirement involves "Government review/approval", follow KA-GOVT-REVIEW-APPROVAL-LOGIC to split it.
- CRITICAL: If a split is required, you must clearly indicate both resulting requirements. The system currently supports updating one requirement at a time; if you split, provide the first requirement now and advise the user that a second requirement has been identified for the list.

Selected Requirement Context:
ID: ${requirement.req_id}
Original: ${requirement.original_text}
Current Rewrite: ${requirement.suggested_rewrite_statement}
ARC: ${JSON.stringify(requirement.suggested_rewrite_arc)}

Document Context Excerpt:
${docExcerpt}
`;

  const tools = [
    { googleSearch: {} },
    {
      functionDeclarations: [
        {
          name: "updateSuggestedRewrite",
          description: "Update the suggested rewrite for the selected requirement after collaborative editing.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              req_id: { type: Type.STRING },
              suggested_rewrite_arc: {
                type: Type.OBJECT,
                properties: {
                  action: { type: Type.STRING },
                  result: { type: Type.STRING },
                  context: { type: Type.STRING }
                },
                required: ["action", "result", "context"]
              },
              suggested_rewrite_statement: { type: Type.STRING }
            },
            required: ["req_id", "suggested_rewrite_arc", "suggested_rewrite_statement"]
          }
        }
      ]
    }
  ];

  const chat = ai.chats.create({
    model: modelName,
    config: {
      systemInstruction,
      tools,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
    }
  });

  // Wrap sendMessage to track tokens
  const originalSendMessage = chat.sendMessage.bind(chat);
  chat.sendMessage = async (params: any) => {
    return await trackedCall({
      run_id,
      agent: "COACH",
      fn: "COACH_DIALOGUE",
      model: modelName,
      call: () => originalSendMessage(params)
    });
  };

  return chat;
}

/**
 * STEP 6: QASP Generation
 * T1: Pro-tier for complex table generation.
 * T3: Compact requirements payload.
 */
export async function generateQASP(analysis: AnalysisResult, userRefinements: string = "", run_id: string = `run_qasp_${Date.now()}`): Promise<QaspItem[]> {
  const modelName = "gemini-3.1-pro-preview";
  // T3: Compact payload rules
  const compactRequirements = analysis.requirements.map(r => ({
    req_id: r.req_id,
    original_text: r.original_text,
    classification: r.classification,
    tags: r.tags,
    overall_score: r.overall_score,
    dimension_scores: r.dimension_scores,
    suggested_rewrite_statement: r.suggested_rewrite_statement,
    source_ref: r.source_ref
  }));

  const response = await trackedCall({
    run_id,
    agent: "QASP_GENERATOR",
    fn: "QASP_BUILD",
    model: modelName,
    call: () => ai.models.generateContent({
      model: modelName,
      contents: `Generate a Quality Assurance Surveillance Plan (QASP) based on these analyzed requirements. 
      User Refinements: ${userRefinements}
      Requirements: ${JSON.stringify(compactRequirements)}`,
      config: {
        systemInstruction: `You are PWS-INTEL-GENERATOR. Create a professional QASP table structure in JSON. 
        For each item, include the 'requirement_statement' which should be the 'suggested_rewrite_statement' from the source requirement you are referencing.
        CRITICAL: If the input requirements list contains split requirements (e.g., from a Government review/approval split), you MUST maintain them as SEPARATE rows in the QASP. Do NOT combine them.
        \n${KA_QASP_GUIDE}`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              requirement_statement: { type: Type.STRING },
              performance_objective: { type: Type.STRING },
              performance_standard: { type: Type.STRING },
              surveillance_method: { type: Type.STRING },
              sampling_frequency: { type: Type.STRING },
              incentive_disincentive: { type: Type.STRING }
            },
            required: ["requirement_statement", "performance_objective", "performance_standard", "surveillance_method", "sampling_frequency", "incentive_disincentive"]
          }
        } as any,
        temperature: 0.1,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    })
  });
  
  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse QASP JSON", e);
    return [];
  }
}

/**
 * STEP 7: PWST Generation
 * T1: Flash model for mapping task.
 * T3: Compact QASP + Requirements payload.
 */
/**
 * STEP 7: PWST Generation
 * T1: Flash model for mapping task.
 * T3: Compact QASP + Requirements payload.
 */
export async function generatePWST(analysis: AnalysisResult, qasp: QaspItem[], run_id: string = `run_pwst_${Date.now()}`): Promise<PwstItem[]> {
  const modelName = "gemini-3-flash-preview";
  // T3: Compact payload rules
  const compactRequirements = analysis.requirements.map(r => ({
    req_id: r.req_id,
    suggested_rewrite_statement: r.suggested_rewrite_statement
  }));

  const response = await trackedCall({
    run_id,
    agent: "PWST_GENERATOR",
    fn: "PWST_BUILD",
    model: modelName,
    call: () => ai.models.generateContent({
      model: modelName,
      contents: `Generate a Performance Work Summary Table (PWST) using the requirements and the QASP context. 
      QASP (Compact): ${JSON.stringify(qasp).substring(0, 5000)} 
      Requirements (Compact): ${JSON.stringify(compactRequirements)}`,
      config: {
        systemInstruction: "You are PWS-INTEL-GENERATOR. Create a PWST that maps requirements to standards and surveillance methods in JSON format. CRITICAL: Maintain split requirements as SEPARATE rows in the PWST. Do NOT combine them.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              pws_task_reference: { type: Type.STRING },
              performance_objective: { type: Type.STRING },
              performance_standard: { type: Type.STRING },
              acceptable_quality_level: { type: Type.STRING },
              surveillance_method: { type: Type.STRING }
            },
            required: ["pws_task_reference", "performance_objective", "performance_standard", "acceptable_quality_level", "surveillance_method"]
          }
        } as any
      }
    })
  });
  
  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse PWST JSON", e);
    return [];
  }
}

/**
 * AGENT E: LEARNER (Accuracy Improvement)
 * Analyzes human corrections to generate "lessons" for future analysis.
 */
export async function learnFromCorrection(
  original: string, 
  ai_rewrite: string, 
  user_correction: string, 
  user_reasoning: string = "",
  run_id: string = `run_learn_${Date.now()}`
): Promise<LearningEntry> {
  const modelName = "gemini-3-flash-preview";
  const learnPrompt = `
    Analyze the difference between the AI's suggested rewrite and the user's manual correction.
    
    Original Requirement: ${original}
    AI Suggestion: ${ai_rewrite}
    User Correction: ${user_correction}
    User Reasoning: ${user_reasoning || "None provided."}
    
    Identify:
    1. Why the user made this change (Critique). Include the user's reasoning if provided.
    2. What category of improvement this is (score|rewrite|classification).
    3. Relevant tags.
  `;

  const response = await trackedCall({
    run_id,
    agent: "LEARNER",
    fn: "CONSISTENCY_CHECK", // Reusing for now
    model: modelName,
    call: () => ai.models.generateContent({
      model: modelName,
      contents: learnPrompt,
      config: {
        systemInstruction: "You are PWS-INTEL-LEARNER. Extract the essence of a human correction into a structured lesson.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            critique: { type: Type.STRING },
            category: { type: Type.STRING, enum: ["score", "rewrite", "classification"] },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["critique", "category", "tags"]
        } as any
      }
    })
  });

  const analysis = JSON.parse(response.text || '{}');
  const entry: LearningEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    original_requirement: original,
    ai_rewrite,
    user_correction,
    user_reasoning,
    critique: analysis.critique,
    category: analysis.category,
    tags: analysis.tags
  };

  addLearningEntry(entry);
  return entry;
}

/**
 * AGENT F: DIRECTOR (Orchestrator)
 * Manages complex multi-agent workflows.
 */
export async function runDirectedAnalysis(
  content: string, 
  docType: DocumentType, 
  run_id: string = `run_director_${Date.now()}`,
  onProgress?: (step: string) => void
): Promise<{ result: AnalysisResult, consistency: { issues: string[], confidence_score: number } }> {
  const modelName = "gemini-3.1-pro-preview";
  
  // 1. Run Analysis
  onProgress?.('Extracting and scoring requirements...');
  const result = await analyzeDocument(content, docType, run_id, onProgress);
  
  // 2. Run Consistency Check
  onProgress?.('Checking internal consistency...');
  const consistency = await checkConsistency(result, run_id);
  
  // 3. Optional: If confidence is low, the Director could re-trigger or flag
  // For now, we just return both.
  
  return { result, consistency };
}
