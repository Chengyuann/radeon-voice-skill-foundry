# Voice SOP Compiler Feasibility and Innovation Research

Last researched: 2026-07-16 (UTC+8)

## Short conclusion

The raw idea, "record my actions while I narrate and generate an automation,"
is **not novel enough**. Microsoft Power Automate Record with Copilot already
captures voice, mouse, and keyboard input and turns them into desktop flows.
Rabbit Teach Mode, Agivar, Minded, and ALLOY also cover adjacent
demonstration-to-workflow or demonstration-to-agent territory.

The defensible version is narrower:

**Voice SOP Compiler: convert action demonstrations plus spoken rationale into a
proof-carrying Agent Skill.**

The novel artifact is not the generated workflow itself. It is the bundle of:

- inferred preconditions
- spoken exceptions
- privacy rules
- denied actions
- minimum tool capabilities
- positive and negative fixtures
- deterministic replay results
- Radeon-local model/runtime benchmark
- revocation and revalidation metadata

This is feasible in the hackathon timeframe if the MVP uses a deterministic
mock workspace and does not try to automate arbitrary desktop software.

## Product landscape

### Direct competitor class: AI recorder for workflow automation

Microsoft Power Automate's Record with Copilot is the closest direct reference.
It lets users share their screen, describe a task, captures voice/mouse/keyboard,
and converts the session into a desktop flow. It also explicitly distinguishes
classic recording, which repeats actions, from AI recording, which can infer
conditions and loops.

Implication:

- Do not position this project as "AI Recorder for Agent workflows".
- Do not claim that narration plus screen recording is novel.
- Use Microsoft as the baseline and position against its gaps:
  - cloud processing
  - enterprise product constraints
  - no proof-carrying local Agent Skill artifact
  - no public focus on learned denied actions/regression tests from narration

### Agent workflow from demonstration

Rabbit Teach Mode, Agivar, Minded, and similar tools use screen recording or
demonstration to create agents or automations.

Implication:

- "The Agent learns by watching you" is a crowded story.
- The project needs an evaluable technical artifact beyond task playback.

### Research precedent

Relevant prior work includes:

- Sugilite: natural language plus GUI demonstration for mobile automation.
- PUMICE: learning concepts and conditionals from natural language and GUI
  demonstrations.
- VASTA: vision and language-assisted smartphone task automation.
- ALLOY: reusable Agent workflows from user demonstrations.

Implication:

- "Demonstration plus natural language captures procedural preferences" is
  already an established HCI/agent research direction.
- The project can still be innovative if it adds a modern local-Agent security
  and verification layer that those systems do not center.

## Innovation assessment

| Claim | Novelty | Evidence | Keep? |
|---|---:|---|---|
| Record actions plus narration to create workflow | Low | Already in Microsoft Record with Copilot and prior PBD work | No |
| Use speech to explain hidden SOP logic | Medium | Related to Sugilite/PUMICE/ALLOY | Only as input modality |
| Convert spoken rationale into denied actions and negative tests | High | Less directly covered by products found | Yes |
| Produce proof-carrying Agent Skill with permission manifest and replay evidence | High | Aligns with GAIA skills but extends synthesis with verification | Yes |
| Run the complete compiler/verifier locally on Radeon | Medium-high | Strong contest fit, not a general research novelty | Yes |
| Use Moonshine alone as the core speech engine | Low | Useful tool, but not Radeon-scored and Chinese accuracy is limited | No |

Final innovation statement:

> Voice SOP Compiler is a local Agent skill compiler that transforms a user's
> demonstrated workflow and spoken SOP rationale into a proof-carrying skill.
> Unlike AI recorders that only generate flows, it extracts constraints and
> counterexamples, minimizes permissions, generates regression tests, and only
> promotes the skill after Radeon-local verification.

## Feasibility assessment

### Feasible within hackathon scope

1. **Deterministic mock workspace**
   - Files, meeting notes, CRM rows, email drafts, calendar drafts, and task
     records can be represented as local JSON/SQLite.
   - This avoids fragile live-browser or enterprise-app automation.

2. **Action trace capture**
   - Capture structured events from our own UI instead of OS-level screen
     recording.
   - Event schema: `open_doc`, `filter_items`, `select_commitment`,
     `draft_email`, `create_calendar_hold`, `write_report`.

3. **Voice transcript ingestion**
   - Start with recorded audio or transcript fixtures.
   - Use Qwen3-ASR-0.6B on Radeon for final ASR if the environment supports it.
   - Use Moonshine only for optional live captions and local event feel.

4. **Constraint extraction**
   - Local LLM outputs structured JSON:
     - `must_do`
     - `must_not_do`
     - `only_if`
     - `unless`
     - `privacy_redaction`
     - `confirmation_required`
   - Constrained JSON schema keeps it testable.

5. **Skill compiler**
   - Generate `SKILL.md`, tool schema, policy file, and test fixtures.
   - The first version can target GAIA/Agent Skills style metadata without
     needing full GAIA runtime integration.

6. **Verifier**
   - Static capability check.
   - Replay in mock workspace.
   - Positive and negative tests.
   - Policy mutation tests.
   - Proof bundle as JSON.

7. **Benchmark dashboard**
   - Show ASR latency, LLM TTFT/tokens-per-second, verification time, pass/fail,
     and skill reuse latency.

### Risky or not feasible as core MVP

1. **Arbitrary desktop recording**
   - Too much selector brittleness.
   - Competes directly with Power Automate.

2. **General-purpose workflow induction**
   - Too broad.
   - ALLOY and other research already target this.

3. **Live microphone as a hard dependency**
   - Audio device setup on remote Radeon Cloud may be unreliable.
   - Use uploaded/recorded `.wav` for judged reproducibility.

4. **Moonshine ROCm acceleration**
   - Current provider code does not expose ROCm/MIGraphX as a supported
     execution provider.
   - Treat it as optional upstream contribution, not core path.

5. **Training/fine-tuning**
   - Unnecessary.
   - Inference plus structured generation and deterministic verification is
     enough for the contest.

## AMD / ROCm fit

The project can satisfy Track 2's Agentic AI requirements:

- **Tool invocation:** typed local tools in the mock workspace.
- **Multi-step planning:** trace plus narration becomes an execution graph.
- **Local memory:** verified skills, policy clauses, failures, and proof bundles
  are stored locally.
- **Permission/privacy:** capability minimization, deny rules, redaction rules,
  and promotion gates.
- **RAG:** retrieve prior SOPs, verified skills, and local policy documents.

The Radeon story should be:

- Run Qwen3-ASR-0.6B or another local ASR path on Radeon for final transcript.
- Run the Agent skill compiler model locally through vLLM/PyTorch ROCm.
- Batch-generate test cases and critiques on Radeon.
- Compare full compilation latency versus verified-skill reuse latency.
- Report TTFT, tokens/s, verification duration, real-time factor, and VRAM.

This gives a stronger score story than a plain office assistant because
acceleration visibly enables private local verification loops.

## MVP architecture

```text
Recorded / live voice
        |
        v
Fast caption path (optional Moonshine) ----+
        |                                  |
        v                                  |
Final ASR on Radeon (Qwen3-ASR)            |
        |                                  |
        +----------+-----------------------+
                   |
User action trace  |
        |          v
        +--> Trace + transcript aligner
                   |
                   v
        SOP constraint extractor
                   |
                   v
        Skill compiler
                   |
                   v
        Capability minimizer
                   |
                   v
        Sandbox replay + generated tests
                   |
                   v
        Proof bundle + verified skill registry
```

## Example demo scenario

Task: post-review follow-up workflow.

User demonstrates:

- open meeting note
- find unresolved commitments
- draft follow-up email
- create tentative calendar holds
- export audit report

User narrates:

- "Only include P0 and P1 issues."
- "Never include compensation data in the external summary."
- "Draft emails only; do not send."
- "If the owner is missing, mark it as needs confirmation."
- "If the customer name appears, replace it with account alias."

Generated artifacts:

- `review_followup.skill/`
- `SKILL.md`
- `policy.yaml`
- `tools.json`
- `fixtures/positive_review.json`
- `fixtures/negative_compensation_leak.json`
- `fixtures/negative_mail_send.json`
- `proof_bundle.json`

Verifier checks:

- output report exists
- no compensation field appears in external report
- no `mail.send` tool call exists
- missing owner produces `needs_confirmation`
- owner present produces draft email
- account aliasing is applied

## Competitive positioning

Positioning statement:

> For knowledge workers and operations teams who need private repeatable
> Agent workflows, Voice SOP Compiler is a local workflow-to-skill compiler
> that turns demonstration plus spoken SOP rationale into verified Agent Skills.
> Unlike AI recorders that generate flows, it produces permissions, tests,
> provenance, and a proof bundle before the skill is allowed to run.

Who it is not for:

- users who only need generic screen automation
- teams already standardized on Microsoft Power Automate
- users who need arbitrary browser control on day one

Who it is for:

- privacy-sensitive workflows
- compliance-heavy internal processes
- repeated review/follow-up/reporting procedures
- developers evaluating local Agent runtime safety

## Go / no-go verdict

Go, with constraints:

- Build a deterministic vertical demo, not a general recorder.
- Make "spoken rationale -> constraints -> negative tests" the centerpiece.
- Keep Moonshine optional and Qwen3-ASR/Radeon local inference as the scored
  speech path.
- Treat proof bundles and capability minimization as the innovation artifact.

No-go if:

- Radeon Cloud cannot run a local LLM/ASR model at all.
- The plan drifts back into generic AI recorder or meeting assistant.
- The demo cannot show a generated negative test catching a dangerous action.

## Source map

- Microsoft Record with Copilot: direct product baseline for voice + screen
  demonstration to automation.
- Rabbit, Agivar, Minded: agent/workflow learning from user demonstration.
- Sugilite, PUMICE, VASTA, ALLOY: research precedent for natural language plus
  demonstrations and reusable workflows.
- GAIA Agent Skills and Skill Auto-Synthesis: AMD-aligned skill format and
  procedural-memory direction.
- OWASP AI Agent Security and Agent Memory Guard: evidence that tool misuse,
  privilege escalation, and memory poisoning are real Agent risks.
- Qwen3-ASR and vLLM/ROCm: likely path for competition-relevant local speech and
  Agent inference.

