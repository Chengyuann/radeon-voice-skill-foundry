# Track 2 Innovation Research and Direction

Last researched: 2026-07-16 (UTC+8)

## Executive decision

Recommended concept:

**ProofSkill Local - A private agent that learns workflows from demonstrations,
but only promotes a learned workflow into a reusable skill after local
simulation, policy checks, and regression tests pass.**

Voice-focused product expression:

**Radeon Voice Skill Foundry - users demonstrate workflows while explaining
hidden SOP rules, and those spoken rules are compiled into GAIA-compatible
permissions, tests, governance receipts, and proof.**

See `docs/VOICE_INTEGRATION.md` and
`docs/VOICE_SOP_FEASIBILITY_RESEARCH.md` for the two-pass speech architecture,
competitive analysis, and feasibility verdict.

Short positioning:

> Teach it once. Verify it locally. Reuse it without surrendering your data.

This is not another local chat UI, RAG assistant, meeting summarizer, or generic
automation canvas. Its output is a versioned and testable local skill.

## Why generic concepts are weak

The self-hosted Agent market already contains mature general platforms:

- Open WebUI: local model UI, RAG, tools, memories, and extensible functions.
- Dify: visual Agent/workflow orchestration, RAG, tools, and self-hosting.
- n8n: workflow automation with self-hosted AI components.
- LobeChat and similar clients: local knowledge bases, plugins, and model
  routing.

Meeting assistants already cover transcription, summaries, action items, and
follow-up workflows. A project framed as "private meeting assistant" would have
to compete with products such as Otter, Read AI, and Granola while also proving
why the meeting domain is essential.

The currently public Track 2 submissions already include:

- RepoMind: on-prem repository Agent and CUDA-to-ROCm helper.
- Hermes GRC Agent: local compliance/control mapping.

Therefore the project should not be a coding assistant, compliance assistant,
generic RAG assistant, or ordinary office copilot.

## Research signal

Recent research and open-source work point toward three important directions:

1. **Workflow induction from demonstrations**
   - Research such as GPA learns executable GUI procedures from demonstrations.
   - Agent Workflow Memory extracts reusable workflows from prior trajectories.
2. **Self-evolving skills**
   - Open-source systems are beginning to synthesize reusable skills from
     completed tasks.
   - The hard unsolved issue is not skill generation but deciding whether a
     generated skill is safe, stable, and reusable.
3. **Security of memory and tool use**
   - Agent memory can be poisoned by malicious or stale content.
   - Tool agents need least-privilege capabilities, provenance, approval gates,
     and revocation.

The innovation opportunity is at their intersection:

**demonstration -> candidate skill -> policy analysis -> sandbox replay ->
regression suite -> signed promotion or rejection**

AMD ecosystem alignment is unusually strong:

- AMD GAIA already defines local Agents that reason, call tools, search
  documents, and act without requiring cloud inference.
- GAIA's Agent Skills design includes typed tools, permissions, and security
  tiers.
- GAIA also publishes a proposed Skill Auto-Synthesis pipeline, but its current
  design page explicitly marks the implementation as greenfield.

ProofSkill should not merely duplicate auto-synthesis. Its novel unit is a
**proof-carrying skill**: the generated skill travels with a behavioral
contract, minimum capability manifest, provenance, adversarial fixtures,
regression evidence, and revocation metadata.

## Candidate concepts

| Concept | Novelty | Demo clarity | Track fit | Three-week risk | Decision |
|---|---:|---:|---:|---:|---|
| ProofSkill Local | 9 | 9 | 10 | 7 | Recommend |
| Commitment Graph Agent | 8 | 9 | 9 | 5 | Strong fallback |
| Permission/Memory Firewall | 8 | 8 | 9 | 6 | Use as subsystem |

### Candidate A: ProofSkill Local

The user performs or describes a recurring workflow once. The Agent converts
the trace into a typed skill containing:

- intent and preconditions
- ordered tool calls
- input/output schemas
- required capabilities
- sensitive data classes
- expected invariants
- replay fixtures
- rollback steps
- a portable proof bundle containing the evidence required for promotion

The Agent cannot immediately use the new skill. It first runs:

1. static policy checks
2. dry-run simulation with mock tools
3. local LLM critique
4. deterministic regression tests
5. permission minimization
6. user approval for promotion

The skill then receives one of four states:

- Draft
- Quarantined
- Verified
- Revoked

The demo should visibly show a naive generated workflow failing or requesting
excessive privileges, followed by local repair and successful verified replay.

Voice is a first-class local inference and teaching path. It remains
structurally tied to verification: timestamped speech is aligned to actions,
spoken qualifiers become policy clauses and negative tests, and the system
reads high-risk learned rules back before proof-bundle promotion.

### Technical novelty claim

The project does not claim that workflow induction, Agent memory, or permission
control is individually new. The contribution is their integration into an
enforceable lifecycle:

1. Infer a reusable workflow from a private local trace.
2. Compile it into a typed, parameterized skill.
3. Infer and minimize the exact capabilities needed.
4. Generate adversarial and regression fixtures locally.
5. Replay the skill in a deterministic sandbox.
6. Produce a proof bundle with machine-checkable results.
7. Permit runtime reuse only while the proof remains valid for the current
   model, tools, policy, and skill version.

Changing the model, tool schema, policy, or skill invalidates the proof and
automatically returns the skill to quarantine. This lifecycle is the primary
innovation and should be visible in the architecture, UI, and demo.

### Candidate B: Commitment Graph Agent

A private temporal Agent converts meetings, notes, and documents into a graph of
commitments:

- who promised what
- source evidence
- due date and dependencies
- confidence and contradictions
- current status

It answers questions such as:

- "Which promises are blocked by decisions that never happened?"
- "What changed since the last meeting?"
- "Which follow-up draft is supported by source evidence?"

This is more differentiated than summarization because its core artifact is a
time-aware, auditable graph. It is easier to finish but has less direct
inference-optimization depth than ProofSkill.

### Candidate C: Permission and Memory Firewall

A local security layer sits between an Agent, its memory, and its tools. It:

- labels every memory with source, time, sensitivity, and trust
- detects suspicious memory changes
- computes the minimum capability token for each plan
- pauses risky tool calls
- supports revocation and rollback

This is technically strong, but on its own it may feel like middleware rather
than a complete end-user product. It should become ProofSkill's verification
and policy subsystem.

## Recommended product architecture

### 1. Demonstration intake

MVP inputs:

- natural-language task description
- structured event trace from a local mock workspace
- optional local file/document evidence

Do not make real browser or desktop recording the critical path. A deterministic
mock mail/calendar/files workspace is easier to reproduce and judge.

### 2. Local planner and skill compiler

The local instruct model:

- decomposes the demonstrated task
- selects typed tools
- generates a candidate skill manifest
- generates test cases and failure cases

Use constrained JSON output or a grammar/schema so the compiler produces
machine-checkable artifacts.

### 3. Capability policy engine

Each tool declares capabilities such as:

- `files.read`
- `files.write:/workspace/reports`
- `mail.draft`
- `mail.send`
- `calendar.draft`
- `calendar.commit`

The verifier rejects overbroad permissions and treats draft/preview operations
separately from irreversible operations.

### 4. Sandbox and tests

- Execute against mock tools first.
- Assert invariants and expected artifacts.
- Inject failures such as missing files, contradictory instructions, poisoned
  memory, and prohibited recipients.
- Store full traces and benchmark results.

### 5. Skill registry and memory

Version skills locally and retain:

- origin demonstration
- generated manifest
- test history
- granted capabilities
- model/runtime version
- benchmark data
- verification signature

### 6. Runtime Agent

The runtime uses only verified skills by default. It can:

- retrieve a relevant skill
- adapt allowed parameters
- request approval for privilege escalation
- execute or dry run
- record outcomes for later regression tests

## Radeon and ROCm score strategy

Track 2 allocates a large share of the score to local inference and
optimization. AMD acceleration must be a visible product feature, not a line in
the README.

Recommended initial stack:

- Radeon Cloud Linux instance
- PyTorch ROCm
- vLLM OpenAI-compatible endpoint
- a compact open-source instruct model with reliable structured output/tool
  calling
- a small local embedding model
- FastAPI backend
- SQLite for registry, traces, and benchmark metadata
- React/Vite frontend

Benchmark:

- baseline versus optimized configuration
- time to first token
- output tokens per second
- end-to-end skill compilation time
- end-to-end verification time
- VRAM use
- concurrent verification throughput
- verified-skill replay latency versus full replanning latency
- sequential versus batched adversarial-test generation

Optimization hypotheses to test, not assume:

- BF16 versus FP16
- quantized model if supported reliably in the provided environment
- prefix caching for repeated policy/schema prompts
- batched generation for test-case synthesis
- structured output constraints to reduce retries
- separate small models for embedding or classification
- reuse of verified skills to avoid repeated long-context planning

The strongest technical story is:

> Radeon acceleration makes local verification practical: the system can
> generate, critique, test, and replay a skill without sending private workflow
> traces to a third-party API.

The strongest performance experiment is to compile and verify multiple
candidate/test variants in a batch on Radeon, then compare that with sequential
verification. A second experiment compares expensive full replanning with
low-latency reuse of a verified skill.

## Track 2 capability mapping

The official minimum is at least two of five capabilities. ProofSkill can show
all five:

- Local RAG: retrieve prior verified skills, policies, and local documents.
- Tool invocation: typed mock mail/calendar/files/task tools.
- Multi-step planning: compile demonstrations into execution graphs.
- Local multi-turn memory: retain skill versions and execution outcomes.
- Permission/privacy: capability minimization, quarantine, approval, and
  revocation.

## Demo scenario

Use a visually understandable five-minute scenario:

1. A user demonstrates:
   - read a local meeting note
   - find open commitments
   - draft a follow-up email
   - create draft calendar holds
   - write an audit report
2. The first synthesized skill requests `mail.send` and broad file write access.
3. The verifier quarantines it and explains the policy violations.
4. The local model repairs it to `mail.draft`, `calendar.draft`, and a scoped
   report directory.
5. Regression tests pass on Radeon.
6. The user promotes the skill.
7. A second similar input reuses the verified skill with much lower latency.
8. The dashboard displays provenance, tests, capabilities, benchmark deltas,
   and full output artifacts.

## Scope boundaries

Do:

- build one excellent vertical workflow
- use typed tools and deterministic test fixtures
- make verification visible and measurable
- ship a complete source repo, English docs, video, and poster

Do not:

- promise arbitrary computer control
- depend on Gmail/Slack/Google Calendar credentials for the judged demo
- make voice the only differentiator
- use closed online APIs for the core reasoning path
- claim autonomous self-improvement without tests and rollback
- combine every candidate concept into one product

## Immediate validation questions

Ask the AMD community:

1. What Radeon GPU model and VRAM are provided?
2. Which ROCm and PyTorch container is recommended?
3. Which vLLM image/version is prevalidated?
4. Are quantized models supported for the Track 2 bonus?
5. Are dedicated Model APIs eligible for the local inference requirement and
   bonus?
6. How many credits or GPU hours are issued, and when do they expire?
7. Is outbound internet available on instances?
8. May participants add materials to a submission PR after opening it?

## Three-week execution outline

### July 16-18

- Complete registration and GPU access.
- Benchmark two compact instruct models.
- Prove structured tool calling on ROCm.
- Freeze the MVP scenario and tool schemas.

### July 19-24

- Build skill compiler, registry, typed tools, and basic UI.
- Implement deterministic replay and test fixtures.

### July 25-30

- Add capability policy, quarantine, repair, promotion, and revocation.
- Run failure injection and regression tests.
- Capture optimization measurements.

### July 31-August 3

- Polish UX and Radeon benchmark dashboard.
- Finish English technical specification and reproducibility guide.

### August 4-5

- Record the real Radeon demo.
- Prepare poster/PPT.
- Run clean-environment reproduction.

### August 6

- Final audit, fork official repo, open the English pull request, and verify all
  links before 23:59 UTC+8.

## Selected sources

Official competition and AMD:

- [Official submission repository](https://github.com/AMD-DEV-CONTEST/Radeon-hackathon-2026-07)
- [Radeon Cloud user guide](https://github.com/AMD-DEV-CONTEST/Radeon-hackathon-2026-07/blob/main/Radeon-Cloud-User%20Guide/README.md)
- [AMD GAIA SDK](https://amd-gaia.ai/docs)
- [GAIA Agent Skills](https://amd-gaia.ai/docs/spec/agent-skills)
- [GAIA Skill Auto-Synthesis plan](https://amd-gaia.ai/docs/plans/skill-synthesis)
- [ROCm vLLM inference](https://rocm.docs.amd.com/en/7.13.0-preview/ai-inference/vllm.html)
- [ROCm vLLM optimization](https://rocm.docs.amd.com/en/latest/how-to/rocm-for-ai/inference-optimization/vllm-optimization.html)
- [ROCm quantization with Quark and vLLM](https://rocm.docs.amd.com/projects/ai-developer-hub/en/latest/notebooks/gpu_dev_optimize/fp8_quantization_quark_vllm.html)

Market and open source:

- [Open WebUI](https://github.com/open-webui/open-webui)
- [Dify](https://github.com/langgenius/dify)

Research and security:

- [GPA: Learning GUI Process Automation from Demonstrations](https://arxiv.org/abs/2604.01676)
- [Agent Workflow Memory](https://arxiv.org/abs/2409.07429)
- [OWASP AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html)
- [OWASP Agent Memory Guard](https://owasp.org/www-project-agent-memory-guard/)
