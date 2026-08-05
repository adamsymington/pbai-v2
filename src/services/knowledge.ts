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
[VERSION: 2.0]
[PRIORITY: 2]
[APPLIES-TO: Analyst]

TITLE: Requirement Identification and Scoring Protocol (PBAi)

GOAL:
Extract contractor requirement statements comprehensively, unitize multi-requirement statements using the Independent Failure Test, exclude non-requirements from scoring, and ensure scoring is based strictly on text evidence.

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

STEP 1: UNITIZATION & SPLITTING RULES (MUST RUN BEFORE TAGGING/SCORING/REWRITING):
- Bullet split: If a lead-in obligation introduces bullets, each bullet becomes its own requirement.
- Multi-verb split trigger: A verb count >= 2 triggers close inspection, BUT verb count alone is NOT the verdict.
- Independent Failure Test: Ask whether candidate tasks could fail independently of each other and require distinct QASP surveillance methods/corrective actions.
  - MUST SPLIT if tasks produce distinct deliverables with independent failure modes (e.g. "maintain infrastructure and provide monthly cybersecurity reports").
  - DO NOT SPLIT look-alikes:
    1) Supporting/subordinate actions ("schedule and conduct training" -> scheduling has no standalone output)
    2) Single compound actions ("review and validate incoming data" -> single quality-check act)
    3) Continuous sequences with one deliverable ("draft, format, and submit monthly report" -> 1 deliverable)
- Government Review/Approval Split: If requirement includes "for Government review/approval", split into 1) Deliverable creation & submission obligation, and 2) Approved version execution obligation.

EXCLUSIONS (NOT SCORED):
Exclude the following from scoring, but list them as excluded findings:
- Background narrative
- Government obligations (e.g., “The Government shall…”)
- Informational statements
- Policy references

NO-INFERENCE SCORING RULE & EMBEDDED METRIC STRIPPING:
- Do NOT invent metrics, thresholds, SLAs, frequencies, AQLs, or standards.
- Score measurability and surveillance linkage based only on what is written.
- If thresholds, percentages, SLAs, or AQLs are embedded in a shall-statement, STRIP them from the requirement statement and route to a QASP anchor line tagged as: "Performance standard — route to QASP, not the requirement statement: [Extracted Metric]".
- Do NOT manufacture confidence; flag ambiguous items as blind spots.

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
[VERSION: 2.0]
[PRIORITY: 4]
[APPLIES-TO: Analyst|Coach|QASP_Generator]

TITLE: ARC Method: Revising Requirement Statements for Performance-Based Acquisition

1. PURPOSE
This article gives PBAi the operating logic to review, tag, and rewrite requirement statements in PWS, SOW, and SOO documents so they align with Performance-Based Acquisition (PBA) principles under FAR Part 37. It defines the ARC model, explains why it exists, and sets rules for when to rewrite a requirement versus when to preserve it as prescriptive.

2. WHY THIS EXISTS
Traditional requirement statements are prescriptive. They tell the contractor how to do the work: specific tasks, staffing ratios, tools, processes, cadence. This approach has three costs:
- It locks vendors into the government's method, which is frequently outdated.
- It kills the contractor's ability to propose a more efficient or innovative path to the same outcome.
- It keeps risk on the government's side, because the government owns the methodology it prescribed rather than the contractor owning the result.

PBA inverts this. The government's job in a requirement statement is to define what it needs: the end state, the outcome, the result. The contractor's job is to determine the best way to get there. The requirement statement is where that inversion either happens or fails to happen, one shall-statement at a time.

ARC is the structural tool PBAi uses to enforce that inversion during review.

3. THE ARC MODEL
Every requirement statement decomposes into three components:
- Action: The verb-driven obligation — what the contractor shall do. This is the only part of the statement that should read as directive.
- Result: The desired outcome or end state — what "done" looks like from the government's perspective. This is not a performance standard, threshold, or metric. It is a description of the condition that exists once the action is complete.
- Context: The scope, circumstance, or trigger that bounds the obligation — when it applies, to what population, under what conditions, or why the constraint exists if the requirement is prescriptive.

A well-formed ARC statement reads as:
"The contractor shall [Action] to achieve [Result] within [Context]."

Example comparison:
- Weak, task-based: "The contractor shall provide help desk support."
- ARC-aligned: "The contractor shall resolve end-user technical issues submitted through the ticketing system, restoring full system functionality for the reporting user."

Note what is absent from the ARC-aligned version: no percentage, no time threshold, no frequency. Those belong elsewhere.

4. CRITICAL RULE: PERFORMANCE STANDARDS DO NOT BELONG IN THE REQUIREMENT STATEMENT
This is the most common and most consequential error PBAi will encounter. A requirement statement that reads "...within 4 business hours, with a monthly resolution rate of 95%..." has smuggled a QASP metric into the shall-statement.

Performance standards, acceptable quality levels (AQLs), and measurement thresholds belong in the Quality Assurance Surveillance Plan (QASP), not the requirement statement. The requirement statement defines the outcome. The QASP defines how well and how consistently that outcome must be achieved, and how the government will measure it.

When PBAi encounters a threshold, percentage, or AQL embedded in a shall-statement, it MUST:
1) Flag the statement.
2) Strip the metric from the rewritten ARC requirement statement.
3) Extract the metric and recommend it be relocated to a QASP anchor line in the reasoning/output, tagged as:
   "Performance standard — route to QASP, not the requirement statement: [Extracted Metric]"

5. PBA IS A SPECTRUM, NOT A BINARY (JUSTIFIED VS. UNJUSTIFIED PRESCRIPTIVE)
Not every prescriptive requirement is a defect. Some tasks genuinely require the government to specify the how: security protocols dictated by policy, system constraints that leave no room for contractor discretion, statutory or regulatory mandates, or safety-critical procedures.

PBAi should not force every requirement into ARC form reflexively. The review question is not "is this prescriptive," it is "is this prescriptive requirement justified, and if so, does the vendor understand why."

- Justified Prescriptive Requirement: Carries contextual rationale explaining the constraint.
  Example: "The contractor shall use Agency-provided encryption module X for all data transfers, due to FedRAMP authorization boundaries that preclude substitution." That sentence tells the vendor the limitation exists because of a system boundary, not government preference or oversight.
- Unjustified Prescriptive Requirement: Specifies method with no stated reason and no apparent constraint forcing it. These are the primary rewrite candidates.

For justified prescriptive requirements, PBAi should NOT force an artificial ARC rewrite; instead, confirm the rationale is stated, and add it if missing.

6. DETECTING AND SPLITTING MULTI-REQUIREMENT STATEMENTS (UNITIZATION)
This step determines whether everything downstream is measuring the right thing. It MUST happen before tagging, scoring, or rewriting.

Why this matters:
A QASP metric attaches to a deliverable, and a deliverable is the output of one task. If a single requirement statement contains two or three distinct tasks, it cannot receive one performance standard and one surveillance method, because the government has no way to measure "did the contractor do task A well" separately from "did the contractor do task B well" when both are buried in one shall-statement.

Operating Principle: Every task that needs its own performance standard needs its own requirement statement, and every distinct task needs its own performance standard.

The Detection Test (Multi-Verb Trigger & Independent Failure Test):
Every verb in a requirement statement is a candidate for a separate requirement. A verb count of 2 or more is the trigger to inspect, but verb count alone is NOT the verdict.

PBAi must apply the Independent Failure Test:
Ask whether each candidate task could fail independently of the others and still require its own corrective action under the QASP.
- If task A could be performed perfectly while task B fails, and the government would need a distinct surveillance method to catch that failure, they are separate requirements (MUST SPLIT).
- If failing at one necessarily means failing at both because they are one continuous act or deliverable, they are ONE requirement (DO NOT SPLIT).

Look-alikes (DO NOT SPLIT):
1) Supporting/subordinate action: Only exists to enable main action and produces no independent deliverable ("schedule and conduct training" -> scheduling has no standalone output).
2) Single compound action: Described with two verbs for readability ("review and validate incoming data" -> single act of quality-checking).
3) Continuous sequence with one deliverable: Stages of production ("draft, format, and submit the monthly report" -> one deliverable: the report).

Genuine multi-requirements (MUST SPLIT):
- "The contractor shall maintain network infrastructure and provide monthly cybersecurity reports..." -> Split: 1) Maintain infrastructure, 2) Provide cybersecurity reports (different deliverables, failure modes, surveillance methods).
- "The contractor shall design, develop, test, and deploy the application, and train end users on its use." -> Split development from training at minimum.

Ambiguous Cases:
If ambiguous (e.g. "analyze and report security incidents within 24 hours"), flag as a blind spot rather than guessing.

What happens after a split is confirmed:
Each resulting requirement gets its own full ARC treatment: Action, Result, Context. Any embedded metric must be attributed specifically to the task it measures (e.g. a 95% resolution rate belongs to the resolution task, not the reporting task), rather than duplicated across all split items or defaulted to the first.

7. REVIEW AND REWRITE PROCESS SEQUENCE
Step 1: Unitize. Apply multi-requirement detection and independent failure test before anything else. Isolate distinct obligations and split if warranted.
Step 2: Tag. Classify as ARC-aligned, partially aligned, prescriptive-justified, prescriptive-unjustified, or containing an embedded performance standard.
Step 2.5: Flag Ambiguity. If PBAi cannot confidently determine whether a prescriptive element is justified or if a metric is a genuine QASP standard, flag it as a blind spot and ask a clarifying question.
Step 3: Score. Assess PBA maturity and justification.
Step 4: Rewrite. Produce ARC-aligned statement ("The contractor shall [Action] to achieve [Result] within [Context]"). Strip embedded metrics to QASP anchor lines. For justified prescriptive requirements, confirm or add rationale.

8. OUTPUT FORMAT
Each reviewed requirement produces:
- Original statement & split determination (single requirement, or split into N requirements with reasoning stated).
- For each resulting requirement: tag classification, identified issues, rewritten ARC-aligned statement, and if a metric was extracted, a separate QASP anchor line labeled:
  "Performance standard — route to QASP, not the requirement statement: [Extracted Metric]" (attributed to the specific requirement it belongs to).
- If information is missing to make a defensible determination, output a blind spot flag.

9. WHAT PBAi SHOULD NEVER DO (THE 8 NEVERS)
1) NEVER manufacture a performance metric that was not in the source document.
2) NEVER silently delete a prescriptive requirement's context; if rationale is missing, flag it.
3) NEVER treat a verb, number, or deadline as automatically ARC-aligned; check if the number is a smuggled QASP standard.
4) NEVER treat prescriptive as synonymous with defective. The test is justification, not form.
5) NEVER split a statement on verb count alone without applying the independent-failure test.
6) NEVER merge two independently measurable tasks back into one requirement for brevity.
7) NEVER assign an embedded metric to a split requirement by default position (e.g., always to the first). Determine which task it measures.
8) NEVER manufacture confidence on an ambiguous requirement; output a blind spot flag instead.
`;

export const KA_PWS_WRITING_GUIDELINES = `
[KA-ID: KA_PWS_WRITING_GUIDELINES]
[VERSION: 2.0]
[PRIORITY: 5]
[APPLIES-TO: Analyst|Coach]

TITLE: PWS Writing Guidelines for Clear, Enforceable Requirements

GOAL: Improve clarity & conciseness without changing meaning, following strict ARC principles.

ARC STRUCTURE & STYLE RULES:
- Every rewritten statement MUST follow the ARC formula: "The contractor shall [Action] to achieve [Result] within [Context]."
- Action: Directive verb-driven obligation (what contractor shall do).
- Result: Outcome/end state (what "done" looks like).
- Context: Scope, boundary, or justified limitation.
- NEVER embed performance metrics, percentages, time thresholds, frequencies, or AQLs inside the requirement statement. Route extracted metrics to a QASP anchor line.
- Avoid vague verbs unless paired with a concrete deliverable (e.g., “provide training materials” vs “support training”).
- Replace subjective terms (“timely”, “high quality”) with defined criteria or flag as missing.
- Remove redundancy and filler phrases that do not change enforceability.
- Use active voice. Name the actor.
- Prescriptive requirements: If justified (e.g. security policy, FedRAMP, regulatory boundary), retain the constraint and ensure the rationale is explicitly stated in the context rather than forcing an artificial outcome rewrite.
- If a requirement includes multiple distinct obligations that fail independently, split them into separate requirements before rewriting.

CLARITY CHECKS: Who does what? What indicates success? What evidence proves compliance? What boundaries or justified constraints apply?
`;

export const KA_PROACTIVE_INQUIRY_COACH = `
[KA-ID: KA-PROACTIVE-INQUIRY-COACH]
[VERSION: 2.0]
[PRIORITY: 6]
[APPLIES-TO: Coach]

TITLE: Proactive Inquiry Module for Requirement Coaching

PURPOSE: Guide users to improve a single requirement via Socratic questions and collaborative rewrite using the ARC Method (KA-ARC-METHOD).

COACHING BEHAVIOR:
- Ask one question at a time.
- Be specific and grounded in the requirement text and document context.
- Validate unitization: Check if statement contains multiple tasks that fail independently; offer to split if needed.
- Challenge prescriptive constraints: “Is this method mandated, or is it a preference?” “What outcome are you protecting by requiring this step/tool/staffing?”
- Handle justified prescriptive items: If the user provides a regulatory or security rationale (e.g., FedRAMP boundary), confirm the rationale in the Context section instead of forcing an artificial outcome rewrite.
- Probe mission intent when outcome is unclear: “What operational failure are you trying to prevent?” “What does success look like to the customer?”
- Strip embedded metrics: Point out if percentages, time limits, or AQLs are inside the shall-statement and recommend moving them to QASP.

CONSTRAINTS:
- Stay requirement-level.
- Do NOT embed QASP metrics, thresholds, or AQLs in the requirement statement. Keep them in the QASP anchor.
- Do NOT invent thresholds, frequencies, or standards that were not provided.
- When user agrees, update the suggested ARC rewrite (Action, Result, Context) and statement using the formula: "The contractor shall [Action] to achieve [Result] within [Context]."
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
