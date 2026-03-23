export type DocumentType = "SOW" | "PWS" | "SOO";

export interface SourceRef {
  page: number;
  section: string;
  line_hint: string;
}

export interface DimensionScores {
  outcome_orientation: number;
  measurability: number;
  flexibility: number;
  surveillance_linkage: number;
  clarity_conciseness: number;
}

export interface HighlightedIssue {
  span_text: string;
  issue_tag: string;
  explanation: string;
}

export interface SuggestedRewriteArc {
  action: string;
  result: string;
  context: string;
}

export interface Requirement {
  req_id: string;
  source_ref: SourceRef;
  original_text: string;
  extraction_method: "explicit" | "implied" | "bullet_split" | "multi_verb_split";
  classification: string;
  tags: string[];
  dimension_scores: DimensionScores;
  overall_score: number;
  criticality: "Critical Issue" | "Major Issue" | "Minor Issue" | "Good";
  reasoning: string;
  highlighted_issues: HighlightedIssue[];
  suggested_rewrite_arc: SuggestedRewriteArc;
  suggested_rewrite_statement: string;
  probing_questions: string[];
}

export interface ExcludedFinding {
  finding_id: string;
  text: string;
  type: "background" | "government_obligation" | "informational" | "policy_reference";
  reason_excluded: string;
  source_ref: SourceRef;
}

export interface QaspItem {
  requirement_statement: string;
  performance_objective: string;
  performance_standard: string;
  surveillance_method: string;
  sampling_frequency: string;
  incentive_disincentive: string;
}

export interface PwstItem {
  pws_task_reference: string;
  performance_objective: string;
  performance_standard: string;
  acceptable_quality_level: string;
  surveillance_method: string;
}

export interface AnalysisResult {
  document_type: DocumentType;
  executive_summary: string;
  strengths: string[];
  areas_for_improvement: string[];
  high_impact_suggestions: string[];
  document_metrics: {
    pages_reviewed: number;
    requirements_identified_total: number;
    requirements_scored: number;
    excluded_findings_count: number;
  };
  overall_document_score: number;
  dimension_averages: DimensionScores;
  classification_breakdown: Array<{ classification: string; count: number }>;
  excluded_findings: ExcludedFinding[];
  requirements: Requirement[];
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export type AgentType =
  | "DIRECTOR"
  | "ANALYST"
  | "COACH"
  | "QASP_GENERATOR"
  | "PWST_GENERATOR"
  | "REPAIR"
  | "CONSISTENCY_CHECKER"
  | "LEARNER";

export interface ConsistencyResult {
  confidence_score: number;
  issues: string[];
  recommendations: string[];
}

export interface LearningEntry {
  id: string;
  timestamp: string;
  original_requirement: string;
  ai_rewrite: string;
  user_correction: string;
  user_reasoning?: string;
  critique: string;
  category: "score" | "rewrite" | "classification";
  tags: string[];
}

export type AgentFunction =
  // Analyst
  | "DOC_INGEST"
  | "REQ_EXTRACTION_PASS1"
  | "REQ_EXTRACTION_PASS2"
  | "REQ_SPLIT_BULLETS"
  | "REQ_SPLIT_MULTIVERB"
  | "REQ_CLASSIFY_TAG"
  | "REQ_SCORE"
  | "REQ_HIGHLIGHT_SPANS"
  | "REQ_ARC_REWRITE"
  | "DOC_SUMMARY"
  | "DOC_AGGREGATE_SCORE"
  // Coach
  | "COACH_DIALOGUE"
  | "COACH_REWRITE_UPDATE"
  // Generators
  | "QASP_BUILD"
  | "PWST_BUILD"
  // Utils
  | "JSON_REPAIR"
  | "CONSISTENCY_CHECK"
  | "DIRECTOR"
  | "LEARNER";

export interface TokenUsage {
  prompt_tokens: number;
  output_tokens: number;
  thought_tokens?: number;
  total_tokens: number;
}

export interface TokenLogEntry {
  id: string;                 // unique id for this log entry
  ts: string;                 // ISO datetime
  run_id: string;             // groups entries for one user action
  agent: AgentType;
  function: AgentFunction;
  model: string;              // e.g. "gemini-3-pro-preview"
  token_usage: TokenUsage;
  latency_ms?: number;
  is_estimate?: boolean;      // true if tokens are estimated
  notes?: string;             // e.g. "schema repair attempt #1"
}

export interface TokenRunSummary {
  run_id: string;
  ts: string;
  user_action: "ANALYZE" | "COACH" | "GENERATE_QASP" | "GENERATE_PWST" | "REANALYZE" | "REPAIR" | "CONSISTENCY_CHECK";
  entries: TokenLogEntry[];
  totals: TokenUsage;
}
