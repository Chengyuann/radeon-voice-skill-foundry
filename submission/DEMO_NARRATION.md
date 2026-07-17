# Demo Narration

The narration is AI-generated with the built-in macOS `Samantha` voice. Radeon
runtime screenshots and metrics come from the actual `c759a41` validation run.
Product UI scenes are a deterministic replay using the same source WAV and the
same application revision; they are labeled as replay footage in the video.

## Speak the SOP. Prove the Skill.

A local Agent can observe what a user clicks, but it cannot reliably infer why
a step is required, which exception applies, or what must never happen. Radeon
Voice Skill Foundry turns a private spoken procedure and its aligned action
trace into a governed Agent Skill. The output is not just a transcript. It is a
portable skill with typed rules, minimum permissions, adversarial tests,
governance receipts, and a hash-bound proof package.

## Real Radeon Runtime

This final validation ran on an AMD Radeon Pro W7900-class allocation with
gfx1100, about forty-eight gigabytes of VRAM, and ROCm 7.2.1. Qwen3-ASR 0.6B
handled speech recognition, while Qwen3 4B Instruct compiled the spoken
procedure into structured constraints. The public source commit was c759a41.
On that exact commit, all twenty-one tests and the production build passed
inside Radeon Cloud.

## Source-Bound Voice Evidence

The expert explains the hidden rules for a private project-review workflow:
keep only P0 and P1 findings, exclude salary data, draft email but never send it
automatically, request confirmation when an owner is missing, and create a
calendar hold only when a due date exists. Before those words can become
executable policy, the Voice Evidence Gate measures level, clipping, silence,
format, and source integrity. The server also binds the original ASR transcript
hash, so later edits require explicit human review.

## Local RAG and Skill Compilation

The Agent retrieves relevant local policy and procedure evidence, then combines
it with the voice transcript and action trace. Qwen3 4B produced thirteen
constraints in 24.13 seconds, with 368 milliseconds time to first token and
20.07 tokens per second. Deterministic guardrails preserve critical Chinese
semantics even if the model omits them: salary data becomes a redaction rule,
a missing owner becomes a confirmation rule, and the due-date clause remains
an only-if condition.

## Adversarial Verification

Verification proves the voice evidence first, then executes the unsafe paths
before promotion. The final Radeon run passed all seven fixtures. It removed
salary data, skipped out-of-scope findings, opened review for missing context,
blocked automatic sending, and denied unapproved network writes. Three BLOCK
receipts were issued. The client payload was deliberately modified to claim
that mail sending was allowed, but the server ignored the untrusted fields and
resolved the authoritative run. The final decision remained mail dot send:
deny.

## Proof and Procedural Memory

After verification, the package contains a GAIA-compatible skill definition,
least-privilege policy, fixtures, receipts, retrieved evidence, source-bound
voice evidence, and the proof bundle. Raw audio is excluded. A verified skill
can be versioned in local procedural memory and reused without model
generation. On the same Radeon allocation, compact structured output reduced
median output tokens by 29.42 percent and generation latency by 30.03 percent.
Exact verified-skill reuse measured 2.18 milliseconds median HTTP round trip.

## Final Artifact

Radeon Voice Skill Foundry extends local voice interaction into capability
creation. Actions capture what happened. Voice captures why, when, exceptions,
and what must never happen. The final Radeon audio proof scored one hundred out
of one hundred for source quality, passed seven out of seven fixtures, and
preserved mail sending as denied. The source, specification, architecture,
poster, raw benchmark summaries, and proof hashes are public and reproducible.
Speak the SOP. Prove the Skill.
