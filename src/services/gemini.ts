import { GoogleGenAI, Type, Modality } from "@google/genai";
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
  PwstItem
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
export const getTokenLogs = (): TokenLogEntry[] => {
  const logs = localStorage.getItem(TOKEN_LOGS_KEY);
  return logs ? JSON.parse(logs) : [];
};

const addTokenLog = (entry: TokenLogEntry) => {
  const logs = getTokenLogs();
  logs.push(entry);
  localStorage.setItem(TOKEN_LOGS_KEY, JSON.stringify(logs.slice(-100))); // Keep last 100 entries
};

export const clearTokenLogs = () => {
  localStorage.removeItem(TOKEN_LOGS_KEY);
};

function extractTokenUsage(response: any): TokenUsage | null {
  if (response.usageMetadata) {
    return {
      prompt_tokens: response.usageMetadata.promptTokenCount || 0,
      output_tokens: response.usageMetadata.candidatesTokenCount || 0,
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

export async function analyzeDocument(content: string, docType: DocumentType = "PWS", run_id: string = `run_analyze_${Date.now()}`): Promise<AnalysisResult> {
  const modelName = "gemini-3-flash-preview";
  const t0 = performance.now();
  
  // Truncate content to avoid hitting output token limits with massive JSON
  const maxChars = 40000;
  const truncatedContent = content.length > maxChars 
    ? content.substring(0, maxChars) + "\n\n[TRUNCATED FOR ANALYSIS PERFORMANCE]"
    : content;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `Document Type: ${docType}\n\nDocument Content:\n${truncatedContent}`,
      config: {
        systemInstruction: ANALYST_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA as any,
        temperature: 0.1, // Lower temperature for more stable JSON
      },
    });

    const t1 = performance.now();
    const usage = extractTokenUsage(response);
    const totalUsage = usage || { prompt_tokens: 0, output_tokens: 0, total_tokens: 0 };
    const latency = Math.round(t1 - t0);

    // Option B: Allocated Breakdown for Analyst
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
        notes: "Allocated from single Analyst call"
      });
    });

    if (!response.text) {
      throw new Error("No response from AI");
    }

    return JSON.parse(response.text) as AnalysisResult;
  } catch (error) {
    console.error("Analysis failed, attempting repair...", error);
    return await repairAnalysis(content, docType, error instanceof Error ? error.message : String(error), run_id);
  }
}

/**
 * AGENT C: VALIDATOR (Repair Step)
 * Triggered if the primary Analyst output fails to parse or validate.
 */
async function repairAnalysis(content: string, docType: DocumentType, errorMessage: string, run_id: string): Promise<AnalysisResult> {
  const modelName = "gemini-3-flash-preview";
  const repairPrompt = `
    The previous analysis attempt failed with the following error: ${errorMessage}
    
    Please re-analyze the document and ensure the output is strictly valid JSON according to the schema.
    Limit your extraction to the most critical requirements if the document is long.
    
    Document Type: ${docType}
    Document Content (first 15k chars): ${content.substring(0, 15000)}
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
        systemInstruction: ANALYST_SYSTEM_INSTRUCTION + "\n\nCRITICAL: You MUST output valid JSON. Be concise in reasoning to avoid hitting output limits.",
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA as any,
        temperature: 0.1,
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
        } as any
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
      tools
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
  const modelName = "gemini-3-flash-preview";
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
