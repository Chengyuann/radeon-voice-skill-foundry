# AMD Alignment Recommendation

Last researched: 2026-07-16 (UTC+8)

## Verdict

Do not submit the project as a generic "Voice SOP Compiler" or "AI workflow
recorder." That framing is too close to Microsoft Record with Copilot and other
demonstration-to-agent products.

Submit it as:

**Radeon Voice Skill Foundry**

Subtitle:

**Speak the SOP. Prove the Skill.**

One-line pitch:

> Turn one private spoken SOP and its demonstrated workflow into a
> GAIA-compatible skill with permissions, negative tests, governance receipts,
> and Radeon-local proof before the skill is allowed to run.

Voice is a first-class product and technical surface, not an optional microphone
button. The AMD-facing heart of the project is the complete
**Voice-to-Verified-Skill** pipeline running locally on Radeon.

## Voice-first AMD framing

AMD GAIA already treats voice as a P0 enabling technology through Talk, Whisper
ASR, Kokoro TTS, local RAG, and voice interaction. The opportunity is not to
rebuild voice chat. It is to extend GAIA's voice surface from conversation into
capability creation:

> GAIA Talk lets users speak with a local agent. Radeon Voice Skill Foundry lets
> domain experts teach that local agent a governed skill by speaking.

The voice pipeline has four substantive stages:

1. **Speak and demonstrate**
   - The user performs a workflow while explaining hidden SOP rules.
   - Example: "Only include P0 and P1 findings. Never expose compensation data.
     Draft the email, but do not send it."
2. **Align voice with actions**
   - Timestamped speech spans are aligned to structured tool/action events.
   - This distinguishes a general policy from a rule attached to a particular
     step, field, recipient, or output.
3. **Compile spoken rationale**
   - Local models extract `must`, `must_not`, `only_if`, `unless`,
     `redact`, and `requires_confirmation` clauses.
   - Clauses become GAIA permissions, governance tags, and positive/negative
     fixtures.
4. **Read back and prove**
   - The system speaks a concise summary of high-risk learned constraints for
     confirmation.
   - Radeon-local replay and tests produce governance receipts and a proof
     bundle.

This makes voice structurally necessary: action traces show *what* the expert
did, while speech explains *why*, *when*, and *what must never happen*.

## Why this fits Track 2

Track 2 rewards:

- local deployment on AMD Radeon GPU and ROCm
- scenario-based task execution
- tool invocation and workflow orchestration
- stable response performance
- at least two of RAG, tools, planning, memory, and permission/privacy
- speed optimization on Radeon

Radeon Voice Skill Foundry can show all five functional capabilities:

- RAG: retrieve prior SOPs, existing verified skills, and policy documents.
- Tools: run typed local mail/calendar/file/report tools.
- Planning: compile trace plus SOP rationale into an execution graph.
- Memory: store skills, proof bundles, failures, receipts, and versions.
- Permission/privacy: generate minimum permissions, deny rules, redaction rules,
  and promotion gates.

## Why this better captures AMD's interest

AMD is visibly investing in:

- local agents through GAIA
- privacy-first local execution
- RAG, tools, voice, and document workflows
- Agent Skills / SKILL.md interoperability
- skill marketplace, security tiers, and AMD Verified concepts
- procedural memory / skill auto-synthesis
- governance receipts and checkpointing

The current GAIA skill auto-synthesis implementation distills procedures from
repeated successful tool sequences. It requires multiple prior successes and
emits only derived fields such as name, when-to-use, tools-required, and body.
The distillation prompt explicitly avoids emitting permissions, security tiers,
or other fields.

Radeon Voice Skill Foundry should therefore position itself as an AMD-aligned
complement:

> GAIA learns from repeated successful runs. Radeon Voice Skill Foundry captures
> expert intent through speech and verifies a new SOP-derived skill before its
> first risky run.

This avoids competing with GAIA and instead demonstrates how Radeon Cloud can
make GAIA's skill ecosystem safer, faster, and easier to seed.

## Strategic wedge

The strongest wedge is:

**voice-seeded cold-start verification for the skill marketplace.**

GAIA's marketplace and AMD Verified tier need trustable skills. Our project
generates a promotion packet:

- `SKILL.md`
- `metadata.gaia.permissions`
- tool schema
- negative fixtures
- deterministic replay log
- governance receipts
- benchmark report
- proof bundle

This is the artifact a future AMD Verified reviewer or marketplace pipeline
would want to inspect.

## Scoring estimate

| Dimension | Generic Voice SOP framing | Radeon Voice Skill Foundry |
|---|---:|---:|
| Track 2 functional fit | 8/10 | 9.5/10 |
| AMD ecosystem fit | 6.5/10 | 9.5/10 |
| Voice differentiation | 5/10 | 9/10 |
| Innovation | 7/10 | 8.5/10 |
| Demo clarity | 7/10 | 9/10 |
| Radeon/ROCm optimization story | 6/10 | 9/10 |
| Judge memorability | 6.5/10 | 9.5/10 |

## Demo the judges should see

The demo should not start with "watch me talk to a workflow recorder." It should
start with an AMD/GAIA-relevant problem:

> A local agent can synthesize skills from repeated success, but teams need a
> way to seed private SOP skills safely before they run against real tools.

Demo flow:

1. The user speaks a private SOP while demonstrating the workflow.
2. Live captions and an action timeline show voice/action alignment.
3. The UI highlights learned clauses such as "P0/P1 only", "redact
   compensation", and "draft only".
4. Show the first generated skill requesting broad or risky permissions.
5. Radeon-local verifier generates minimum permissions and negative tests.
6. Governance blocks an unsafe `mail.send` or sensitive-data leak.
7. The skill is repaired and replayed in a deterministic mock workspace.
8. The system reads back the high-risk rules for confirmation.
9. `proof_bundle.json` and `receipts.jsonl` are created.
10. The skill is promoted from `Quarantined` to `Verified`.
11. The same task reuses the verified skill with lower latency than full
   replanning.
12. A benchmark panel shows ASR RTF, TTFT, tokens/s, verification time, VRAM, and
   sequential-vs-batched test generation.

## Radeon must be visible

Required measurements:

- ASR real-time factor and utterance-final latency on Radeon.
- Voice/action alignment accuracy on a small labeled scenario set.
- Spoken-clause extraction accuracy for `must_not`, `redact`, and
  `requires_confirmation`.
- LLM TTFT and output tokens/s on Radeon.
- Full skill compilation latency.
- Batched negative-test generation versus sequential generation.
- Verified-skill replay latency versus full replanning latency.
- VRAM use and model/runtime versions.

Optimization experiments:

- baseline PyTorch/Transformers versus vLLM where supported
- structured JSON/constrained output to reduce retry rate
- batched generation of fixtures and critiques
- optional quantization or distillation if stable on the provided environment
- caching fixed policy/schema prompts

The story should be:

> Radeon makes private voice understanding and local verification loops fast
> enough to be practical. Without local acceleration, teams either upload
> sensitive spoken SOPs to the cloud or skip the verification needed to turn
> them into safe Agent Skills.

## What not to say

Avoid:

- "We built an AI Recorder."
- "Voice interruption is the core innovation."
- "This is a meeting assistant."
- "This replaces GAIA."
- "It can automate any desktop app."
- "Voice is just another input option."

Say instead:

- "We built a voice-native, GAIA-compatible skill foundry."
- "Actions capture what the expert does; voice captures why, when, and what
  must never happen."
- "We extend GAIA Talk from local conversation to local capability creation."
- "The product generates proof, not just a workflow."
- "It complements GAIA skill auto-synthesis by solving cold-start safety."
- "Radeon acceleration enables private voice-to-skill verification before first
  use."

## Final recommendation

Proceed only with the AMD-aligned framing:

**Radeon Voice Skill Foundry: Speak the SOP. Prove the Skill.**

Voice is the headline user experience and a scored local inference path. The
proof-carrying GAIA-compatible skill remains the defensible technical artifact.
