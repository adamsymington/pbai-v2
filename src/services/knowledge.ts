export const KA_PBA_RUBRIC_SCORING = `
[KA-ID: KA-PBA-RUBRIC-SCORING]
[VERSION: 1.0]
[PRIORITY: 1]
[APPLIES-TO: Analyst|Coach]

TITLE: Reviewing PWS Requirement Statements for Alignment with Performance-Based Acquisition (PBA) Principles and Maturity Scoring

PURPOSE:
Train the model to evaluate, score, and improve requirement statements for services contracting using PBA principles.

CORE PBA CONCEPTS:
PBA focuses on outcomes rather than prescribing methods. Requirements should support:
1) Performance outcomes
2) Measurable standards
3) Flexibility / innovation space
4) Surveillance linkage (verifiability)
5) Accountability tied to measurable results

PBA MATURITY SCORE (0–100):
0–20: Prescriptive or Task-Based (method-focused)
21–40: Activity-Oriented (work described, outcomes unclear)
41–60: Partial PBA (some outcome intent, missing clarity/metrics)
61–80: Performance-Oriented (measurable results, moderate flexibility)
81–100: Fully PBA (clear outcomes, metrics, verification friendly)

SCORING DIMENSIONS (WEIGHTED):
1) Outcome Orientation (25%)
2) Measurability (25%)
3) Flexibility (20%)
4) Surveillance Linkage (20%)
5) Clarity & Conciseness (10%)

CLASSIFICATION AND TAG TAXONOMY:

Primary structural/alignment tags:
- Prescriptive
- Ambiguous
- Task-Based
- Outcome-Based
- Mixed-Mode
- Non-Measurable
- Incomplete Outcome
- Redundant

Quality/clarity tags:
- Subjective Language
- Multi-Action
- Undefined Term
- Circular Requirement
- Compliance-Driven
- Passive Voice

Context/oversight tags:
- No Surveillance Method
- Weak Inspection Link
- No Incentive Linkage
- Over-Constrained
- Inappropriate Detail Level

Advanced pitfall patterns:
- False Measurability
- Performance Drift
- Dependency Bloat
- Misaligned Metric
- Inspection Myopia
- Goal Ambiguity

MODEL TASKS:
For each requirement:
1) Classify (primary classification + tags)
2) Score 0–100 using the 5 dimensions
3) Provide a PBA-aligned rewrite and justification
`;

export const KA_REQ_REVIEW_PROTOCOL = `
[KA-ID: KA-REQ-REVIEW-PROTOCOL]
[VERSION: 1.0]
[PRIORITY: 2]
[APPLIES-TO: Analyst]

TITLE: Requirement Identification and Scoring Protocol (PBAi)

GOAL:
Extract contractor requirement statements comprehensively, exclude non-requirements from scoring, and ensure scoring is based only on text evidence.

TWO-PASS EXTRACTION:
PASS 1 (Explicit):
- Identify explicit contractor obligations (e.g., "shall", "must") including:
  - Lead-in clauses followed by bullets (treat each bullet as a distinct requirement).
  - Tables: treat each cell content as eligible text; extract requirements embedded in cells.

PASS 2 (Implied obligations):
- Identify implied contractor obligations ONLY when they clearly impose action:
  - “will” (only if binding, not narrative)
  - “is responsible for”
  - “ensure”
- Do NOT treat aspirational language as obligations.

SPLITTING RULES:
- Bullet split: If a lead-in obligation introduces bullets, each bullet becomes its own requirement.
- Multi-verb split: If one sentence contains multiple distinct obligations, split into separate requirements.

EXCLUSIONS (NOT SCORED):
Exclude the following from scoring, but list them as excluded findings:
- Background narrative
- Government obligations (e.g., “The Government shall…”)
- Informational statements
- Policy references

NO-INFERENCE SCORING RULE:
- Do NOT invent metrics, thresholds, SLAs, frequencies, AQLs, or standards.
- Score measurability and surveillance linkage based only on what is written.
- If missing, penalize and explicitly state what is missing.

SOURCE TRACEABILITY:
For each extracted requirement or excluded finding, capture a best-effort:
- page number (if available)
- section heading (if available)
- line hint / excerpt anchor (best-effort)
`;

export const KA_PWS_VS_SOW_VS_SOO = `
[KA-ID: KA-PWS-VS-SOW-VS-SOO]
[VERSION: 1.0]
[PRIORITY: 3]
[APPLIES-TO: Analyst|Coach]

TITLE: PWS vs. SOW vs. SOO: Differences, Uses, and Best Practices

1. Overview
Federal acquisition uses three primary requirements documents: Performance Work Statements (PWS), Statements of Work (SOW), and Statements of Objectives (SOO). Each sets expectations differently, from prescriptive instructions to outcome-driven goals.

2. Performance Work Statement (PWS)
A PWS defines required results and measurable performance standards. It tells industry what outcomes must be achieved, not how to do the work.
Key traits: Outcome-oriented, Requires measurable performance standards, Supports performance-based acquisition, Often paired with a QASP.

3. Statement of Work (SOW)
A SOW is prescriptive. It directs the contractor how to perform tasks, specifying processes, steps, labor, and technical methods.
Key traits: Government-controlled approach, Less flexibility for industry innovation, Useful when work must be executed in a specific manner.

4. Statement of Objectives (SOO)
A SOO states high-level objectives and desired outcomes. Industry proposes the PWS and performance standards.
Key traits: Outcome-focused, Industry defines the solution, Used for complex or innovative procurements.
`;

export const KA_ARC_METHOD = `
[KA-ID: KA-ARC-METHOD]
[VERSION: 1.0]
[PRIORITY: 4]
[APPLIES-TO: Analyst|Coach]

TITLE: ARC Method (Action–Result–Context) Knowledge Article

- ARC is used to write and review performance-based requirement statements.
- Action: contractor-controlled verb phrase describing what the contractor must do.
- Result: measurable outcome/deliverable/condition indicating success.
- Context: scoping details (systems, locations, timeframes) that bound the work.
- Good ARC uses a single clear verb, avoids vague verbs standing alone, and keeps method out unless required by law/policy.
- Multi-verb sentences often hide multiple requirements; split into separate ARC requirements.
- Approved dependency pattern: 'government-approved plan' often implies a missing upstream requirement to submit for approval.
`;

export const KA_PWS_WRITING_GUIDELINES = `
[KA-ID: KA_PWS_WRITING_GUIDELINES]
[VERSION: 1.0]
[PRIORITY: 5]
[APPLIES-TO: Analyst|Coach]

TITLE: PWS Writing Guidelines for Clear, Enforceable Requirements

GOAL: Improve clarity & conciseness without changing meaning.

STYLE RULES:
- Prefer “The Contractor shall …” with one primary action.
- Avoid vague verbs unless paired with a concrete deliverable (e.g., “provide training materials” vs “support training”).
- Replace subjective terms (“timely”, “high quality”) with defined criteria or flag as missing.
- Remove redundancy and filler phrases that do not change enforceability.
- Use active voice. Name the actor.
- Avoid dictating tools/methods unless required constraints exist.
- If a requirement includes multiple distinct obligations, split.
- Keep the rewrite to one sentence when possible; add context only to bound scope.

CLARITY CHECKS: Who does what? What indicates success? What evidence proves compliance? What boundaries apply?
`;

export const KA_PROACTIVE_INQUIRY_COACH = `
[KA-ID: KA-PROACTIVE-INQUIRY-COACH]
[VERSION: 1.0]
[PRIORITY: 6]
[APPLIES-TO: Coach]

TITLE: Proactive Inquiry Module for Requirement Coaching

PURPOSE: Guide users to improve a single requirement via Socratic questions and collaborative rewrite.

COACHING BEHAVIOR:
- Ask one question at a time.
- Be specific and grounded in the requirement text and document context.
- Challenge prescriptive constraints: “Is this method mandated, or is it a preference?” “What outcome are you protecting by requiring this step/tool/staffing?”
- Probe mission intent when outcome is unclear: “What operational failure are you trying to prevent?” “What does success look like to the customer?”

CONSTRAINTS:
- Stay requirement-level.
- Do NOT propose QASP metrics, AQLs, incentives, or surveillance plans unless user already provided them in the document text.
- Do NOT invent thresholds, frequencies, or standards. If measurability is desired, ask the user to supply values.
- When user agrees, update the suggested ARC rewrite and statement only.
`;

export const KA_QASP_GUIDE = `
KNOWLEDGE ARTICLE: Quality Assurance Surveillance Plan (QASP)
Audience: LLM Agent — PWSai QASP Builder Module
Version: 2.0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. DEFINITION AND PURPOSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A Quality Assurance Surveillance Plan (QASP) is the Government's 
documented methodology for verifying contractor performance against 
the standards defined in a Performance Work Statement (PWS).

A QASP is REQUIRED for performance-based acquisitions (FAR 37.601(b)(2)).
It is not optional. Its absence is a compliance deficiency.

A QASP answers five questions for every performance standard:
  1. What is being measured?
  2. What level of performance is acceptable (AQL)?
  3. How will the Government verify it (method)?
  4. What evidence artifact proves it was checked?
  5. How often does surveillance occur?

If any of the five are missing, the QASP entry is INCOMPLETE.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. REGULATORY BASIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FAR 37.601(b)(2)    QASPs are required for performance-based contracts
FAR 37.602          Performance-Based Acquisition policy
FAR 37.604          Performance standards and AQLs
FAR 46.401          Government contract quality assurance
FAR 46.401(b)       Surveillance methods
FAR 46.407          Remedies for nonconforming services

Reference: OFPP A Guide to Best Practices for Performance-Based 
Contracting (defines QASP structure and surveillance matrix format)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. FIVE REQUIRED QASP ELEMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every row in a QASP surveillance matrix requires all five:

ELEMENT 1 — Performance Objective
  The service, deliverable, or outcome being measured.
  Must correspond directly to a requirement in the PWS.

ELEMENT 2 — Performance Standard
  A measurable, quantified statement of expected performance.
  Must contain: a metric + a threshold + a time period.
  Example: "System available 99.9% of scheduled operational hours 
  per calendar month."
  NOT acceptable: "System is reliably available."

ELEMENT 3 — Acceptable Quality Level (AQL)
  The minimum performance level the Government will accept before 
  triggering a remedy.
  Must be expressed as: a percentage, count, rate, or binary pass/fail.
  The AQL is the floor, not the target.
  Example: AQL = 99.5% uptime (even if standard is 99.9%)

ELEMENT 4 — Surveillance Method
  How the Government will verify compliance. Must specify:
  - The method type (see Section 4)
  - The evidence artifact (what document or data proves it was done)
  Example: "Automated monitoring dashboard; COR reviews weekly 
  system report."
  NOT acceptable: "COR will monitor performance."

ELEMENT 5 — Surveillance Frequency
  How often surveillance is conducted.
  Must be specific: daily, weekly, monthly, per deliverable, 
  per incident, continuous.
  NOT acceptable: "periodically" or "as needed"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. SURVEILLANCE METHODS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

METHOD              DESCRIPTION                        BEST USE CASE
─────────────────────────────────────────────────────────────────────
Random Sampling     Statistically valid subset review  High-volume 
                                                       repetitive tasks
Periodic Inspection Scheduled evaluation of outputs    Recurring 
                                                       deliverables
100% Inspection     Review of all outputs              Critical/safety 
                                                       services only
Customer Feedback   End-user satisfaction surveys      Support services,
                                                       help desks
Validated Reports   Contractor-submitted metrics with  IT systems,
                    Government spot-check audit        reporting tasks
Automated Monitoring System-generated performance data IT uptime, SLAs

RULE: 100% inspection should only appear for life-safety, 
security, or legally mandated services. Flag it elsewhere as 
a potential surveillance burden issue.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. PERFORMANCE STANDARD TYPES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The LLM must distinguish between these standard types because 
they drive different surveillance approaches:

TYPE A — Output-Based Standard
  Measures delivery of a specific work product.
  Example: "The contractor shall deliver a monthly status report 
  no later than the 5th business day of each month."
  Surveillance: Periodic inspection; deliverable receipt log.

TYPE B — Outcome-Based Standard
  Measures achievement of a result or mission effect.
  Example: "The contractor shall maintain end-user satisfaction 
  at or above 4.0/5.0 on quarterly surveys."
  Surveillance: Customer feedback; survey data.

TYPE C — Process/Activity Standard
  Measures adherence to a required process or method.
  Example: "The contractor shall conduct weekly status meetings 
  with the COR."
  Surveillance: Meeting minutes; attendance log.

TYPE D — Timeliness Standard
  Measures response or completion time.
  Example: "The contractor shall respond to P1 incidents within 
  1 hour of ticket creation."
  Surveillance: Ticket system data; automated monitoring.

NOTE: Most robust PWSs combine multiple standard types. A single 
task may need both an output standard AND a timeliness standard.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. INCENTIVE/DISINCENTIVE LINKAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If the contract type includes performance incentives (award fee, 
CPIF, IDIQ task order with performance deductions), the QASP 
design must reflect this.

IMPACT ON QASP DESIGN:
- AQL thresholds must align with incentive/deduction trigger points
- Surveillance frequency must be sufficient to support fee 
  determinations
- Evidence artifacts become legally significant (used in AFEB 
  findings or payment adjustments)

RULE: If a PWS references an award fee, CPIF structure, or 
performance deductions, flag any QASP entries that lack a 
documented evidence artifact — these are audit liabilities.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. COR DOCUMENTATION REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The QASP must produce a documentation trail. The COR is 
responsible for maintaining surveillance records that:
  - Record what was checked and when
  - Record the result against the AQL
  - Note any deviations or corrective actions
  - Support past performance documentation (CPARS)
  - Support cure notice or show cause letter issuance

A QASP without a defined evidence artifact for each surveillance 
entry is operationally incomplete, even if structurally present.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. REMEDIES FOR NONCONFORMANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Escalating remedies, applied based on severity and frequency:

LEVEL 1 — Informal correction: COR notifies contractor verbally 
           or via email; documented in surveillance log
LEVEL 2 — Corrective Action Request (CAR): Formal written 
           notice with required response timeline
LEVEL 3 — Cure Notice (FAR 49.607): Government notifies 
           contractor of anticipated breach; 10-day cure period
LEVEL 4 — Show Cause Notice: Issued prior to termination for 
           default
LEVEL 5 — Contract termination (for default or convenience) or 
           payment reduction if incentive-linked

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. LLM DECISION RULES — QASP ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Apply these rules when analyzing any PWS requirement for QASP 
completeness. Each rule has a trigger condition, a flag type, 
and a recommended action.

─────────────────────────────────────
RULE 1: Missing Surveillance Method
Trigger: Performance standard exists; no surveillance method defined
Flag: QASP_INCOMPLETE — Missing surveillance method
Action: Recommend appropriate method based on standard type 
        (see Section 4). Prompt user to specify evidence artifact.
─────────────────────────────────────
RULE 2: Subjective/Non-Measurable Language
Trigger: Standard contains: timely, adequate, high quality, 
         appropriate, sufficient, effective, satisfactory, 
         as needed, reasonable, best efforts
Flag: QASP_DEFECT — Non-measurable performance language
Action: Identify the subjective term. Generate a revised 
        standard with a quantified metric and time period.
        Show before/after.
─────────────────────────────────────
RULE 3: Missing AQL
Trigger: Performance standard exists; no AQL or threshold defined
Flag: QASP_INCOMPLETE — No acceptable quality level defined
Action: Recommend AQL based on standard type. Note that AQL 
        should be set below the performance standard to allow 
        a buffer before remedies trigger.
─────────────────────────────────────
RULE 4: Missing Evidence Artifact
Trigger: Surveillance method named; no evidence artifact specified
Flag: QASP_INCOMPLETE — No surveillance evidence artifact defined
Action: Recommend artifact type based on surveillance method:
        - Automated monitoring → system report / dashboard export
        - Random sampling → sampling log with dates and findings
        - Customer feedback → survey summary report
        - Periodic inspection → inspection checklist / sign-off
─────────────────────────────────────
RULE 5: 100% Inspection on Non-Critical Service
Trigger: 100% inspection specified for non-safety/non-critical task
Flag: QASP_ADVISORY — High surveillance burden
Action: Recommend replacing with random sampling or validated 
        contractor reporting with spot-check audit.
─────────────────────────────────────
RULE 6: Frequency is Vague
Trigger: Frequency stated as "periodically," "as needed," 
         "occasionally," or similar
Flag: QASP_DEFECT — Undefined surveillance frequency
Action: Recommend specific frequency based on task criticality 
        and volume (daily, weekly, monthly, per deliverable).
─────────────────────────────────────
RULE 7: Standard Lacks a Denominator
Trigger: AQL or standard expressed as a percentage but no 
         population or measurement base defined
Example: "95% compliance" — 95% of what? In what period?
Flag: QASP_DEFECT — Incomplete metric definition
Action: Request clarification on measurement population and 
        reporting period. Generate revised language with 
        denominator included.
─────────────────────────────────────
RULE 8: No Responsible Surveillance Party Named
Trigger: Surveillance method defined; no role assigned to 
         perform it
Flag: QASP_INCOMPLETE — No surveillance responsibility assigned
Action: Default recommendation is COR. Flag if surveillance 
        requires technical expertise beyond typical COR scope 
        (suggest adding a Technical Monitor or SME reviewer).
─────────────────────────────────────

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. EXAMPLE REQUIREMENTS — ANNOTATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXAMPLE A — COMPLIANT (Output + Timeliness)

PWS Text:
"The contractor shall deliver a monthly program status report 
no later than the 5th business day of each month. Reports shall 
contain all required data elements per Attachment 1."

QASP Entry:
  Objective:    Monthly status report delivery
  Standard:     Delivered by 5th business day; all required 
                data elements present
  AQL:          100% on-time delivery; 98% data element accuracy
  Method:       Periodic inspection — COR reviews report on receipt
  Evidence:     Deliverable receipt log; COR checklist per 
                Attachment 1
  Frequency:    Monthly (per deliverable)

─────────────────────────────────────
EXAMPLE B — NON-COMPLIANT (Multiple Defects)

PWS Text:
"The contractor shall provide timely and adequate support 
to end users."

LLM Analysis:
  RULE 2 triggered: "timely" — no time metric defined
  RULE 2 triggered: "adequate" — no performance threshold defined
  RULE 1 triggered: No surveillance method present
  RULE 3 triggered: No AQL defined
  RULE 4 triggered: No evidence artifact

Suggested Revision:
"The contractor shall respond to Tier 1 help desk tickets within 
2 business hours of submission and resolve Tier 1 issues within 
1 business day. Response and resolution times will be tracked via 
the Government ticketing system. The COR will review weekly 
ticket system reports."

QASP Entry (Generated):
  Objective:    Help desk responsiveness
  Standard:     Response ≤ 2 hrs; Resolution ≤ 1 business day
  AQL:          95% compliance per weekly reporting period
  Method:       Automated monitoring — ticket system data
  Evidence:     Weekly ticket report export; COR review log
  Frequency:    Weekly

─────────────────────────────────────
EXAMPLE C — PARTIAL (Missing Evidence Artifact)

PWS Text:
"The contractor shall maintain network uptime of 99.5% 
during core business hours."

LLM Analysis:
  Standard: PRESENT and measurable ✓
  AQL: ABSENT → RULE 3 triggered
  Method: Not specified → RULE 1 triggered
  Evidence artifact: Not specified → RULE 4 triggered
  Frequency: Not specified → RULE 6 triggered

Note: Standard is well-written. QASP structure around it is missing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. QASP MATRIX OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The LLM should generate QASP matrices in this format:

| Performance Objective | Performance Standard | AQL | 
Surveillance Method | Evidence Artifact | Frequency | 
Responsible Party |

All seven columns are required. Any cell left blank must be 
flagged and explained in the coaching output.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12. STRUCTURED SCHEMA (LLM INGESTION)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "knowledge_article": "QASP",
  "version": "2.0",
  "required_elements": [
    "performance_objective",
    "performance_standard",
    "acceptable_quality_level",
    "surveillance_method",
    "evidence_artifact",
    "surveillance_frequency",
    "responsible_party"
  ],
  "standard_types": [
    "output_based",
    "outcome_based",
    "process_activity",
    "timeliness"
  ],
  "surveillance_methods": [
    "random_sampling",
    "periodic_inspection",
    "100_percent_inspection",
    "customer_feedback",
    "validated_contractor_reporting",
    "automated_monitoring"
  ],
  "flag_types": [
    "QASP_INCOMPLETE",
    "QASP_DEFECT",
    "QASP_ADVISORY"
  ],
  "llm_rules": [
    {
      "rule_id": "R1",
      "trigger": "performance_standard_present AND surveillance_method_absent",
      "flag": "QASP_INCOMPLETE",
      "action": "recommend_surveillance_method"
    },
    {
      "rule_id": "R2",
      "trigger": "subjective_language_detected",
      "flag": "QASP_DEFECT",
      "action": "generate_revised_standard"
    },
    {
      "rule_id": "R3",
      "trigger": "performance_standard_present AND aql_absent",
      "flag": "QASP_INCOMPLETE",
      "action": "recommend_aql"
    },
    {
      "rule_id": "R4",
      "trigger": "surveillance_method_present AND evidence_artifact_absent",
      "flag": "QASP_INCOMPLETE",
      "action": "recommend_evidence_artifact"
    },
    {
      "rule_id": "R5",
      "trigger": "100_percent_inspection AND non_critical_service",
      "flag": "QASP_ADVISORY",
      "action": "recommend_random_sampling"
    },
    {
      "rule_id": "R6",
      "trigger": "frequency_vague_or_absent",
      "flag": "QASP_DEFECT",
      "action": "recommend_specific_frequency"
    },
    {
      "rule_id": "R7",
      "trigger": "percentage_metric AND no_denominator_defined",
      "flag": "QASP_DEFECT",
      "action": "request_denominator_and_period"
    },
    {
      "rule_id": "R8",
      "trigger": "surveillance_method_present AND responsible_party_absent",
      "flag": "QASP_INCOMPLETE",
      "action": "assign_responsible_party"
    }
  ]
}
`;

export const KA_INCENTIVES_GUIDE = `
[KA-ID: KA-INCENTIVES-GUIDE]
[VERSION: 1.0]
[PRIORITY: 8]
[APPLIES-TO: Analyst]

TITLE: Incentives and Disincentives in Contract Surveillance

- The strongest incentive is a clear measurable requirement; incentives cannot fix vague requirements.
- Prefer non-monetary incentives where reasonable (options, CPARS, recognition).
- Ensure incentives tie to measurable outcomes; avoid gaming.
- Increased surveillance can function as a negative incentive when performance declines.
`;

export const KA_GOVT_REVIEW_APPROVAL_LOGIC = `
[KA-ID: KA-GOVT-REVIEW-APPROVAL-LOGIC]
[VERSION: 1.0]
[PRIORITY: 10]
[APPLIES-TO: Analyst]

TITLE: Government Review & Approval Split Logic

When the system detects requirement language that includes “for Government review,” “for Government approval,” “subject to Government approval,” or similar phrasing, the model shall:

1. Identify that the requirement improperly merges:
   - Deliverable creation obligation, and
   - Post-approval usage obligation.

2. Suggest restructuring into two separate requirement statements.

3. Generate two distinct requirements as follows:

REQUIRED OUTPUT STRUCTURE:
Requirement 1 – Deliverable Submission Obligation:
"The Contractor shall develop and submit the [Deliverable Name] for Government review and approval."
(Do not include performance standards, acceptance criteria, or delivery schedule timing.)

Requirement 2 – Approved Version Usage Obligation:
"The Contractor shall implement and adhere to the Government-approved [Deliverable Name] in the performance of contract requirements."
(Do not include performance standards, surveillance methods, or administrative timing.)

ADDITIONAL RULES:
- Do not embed approval timing in either requirement.
- Do not embed performance standards or AQL.
- If the original language includes implementation verbs (e.g., “develop and execute”), split execution into the second requirement.
- Preserve the original deliverable name exactly as written.
- Flag the original requirement as “Structurally Merged – Requires Decomposition.”

EXAMPLE TRANSFORMATION:
Input: "The Contractor shall develop a Quality Control Plan for Government review and approval and implement the approved plan."
Output Suggestion:
1. "The Contractor shall develop and submit a Quality Control Plan for Government review and approval."
2. "The Contractor shall implement and adhere to the Government-approved Quality Control Plan in the performance of contract requirements."
`;

export const KA_PBA_HISTORY_CONTEXT = `
[KA-ID: KA-PBA-HISTORY-CONTEXT]
[VERSION: 1.0]
[PRIORITY: 9]
[APPLIES-TO: Analyst]

TITLE: Context & History of Performance-Based Acquisition (PBA)

DEFINITION:
PBA is acquiring services based on measurable outcomes (FAR Subpart 37.6), typically involving PWS/SOO, measurable standards, QASP, and incentives aligned to standards.

IMPLICATIONS FOR REVIEW:
A reviewer should assess: outcomes vs inputs, measurability, flexibility/innovation space, QASP feasibility linkage, clarity and enforceability.
`;
