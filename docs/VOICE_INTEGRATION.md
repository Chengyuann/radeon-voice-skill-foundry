# Voice Integration Decision

Last verified: 2026-07-16 (UTC+8)

## Decision

Use voice as a core teaching and safety channel for ProofSkill Local, and rename
the product direction:

**Radeon Voice Skill Foundry**

> Speak the SOP. Prove the Skill.

The product is not a voice-controlled chatbot, and voice interruption is not the
main value. The core experience is voice-native teaching: the user demonstrates
a workflow while explaining hidden SOP logic, exceptions, privacy boundaries,
and approval rules. Actions capture what happened; speech captures why, when,
and what must never happen. Those spoken explanations become typed constraints
and regression tests.

This extends GAIA Talk from voice conversation and document Q&A into
voice-to-skill creation.

## How the linked Moonshine Voice project helps

The linked article describes Moonshine Voice, an active open-source real-time
speech toolkit. The official repository currently provides:

- streaming transcript events
- voice activity detection
- word timestamps
- speaker diarization
- intent recognition
- spelling mode
- local TTS and conversational flow primitives
- Python, C++, Swift, Java, and C interfaces

The project is useful for the real-time interaction layer because the system can
react while the user is speaking instead of waiting for a full recording.

Important limitations:

- Moonshine's current release defaults to CPU inference.
- Its public execution-provider configuration currently supports CPU, CoreML,
  and NNAPI, not ROCm/MIGraphX.
- The Mandarin Base model reports 25.76% CER in the official model table. The
  strong Whisper comparison in the article is for the English Medium Streaming
  model and must not be treated as evidence of Chinese accuracy.
- Moonshine code and English models are MIT licensed. Non-English models use
  the Moonshine Community License and require its conditions and attribution.

Conclusion:

**Moonshine should be the low-latency speech-event frontend, not the only
Radeon-scored ASR engine.**

## Recommended two-pass local speech architecture

### Fast path: Moonshine Voice

Run Moonshine locally for:

- `LineStarted`, `LineTextChanged`, and `LineCompleted` events
- VAD and endpoint detection
- immediate partial captions
- barge-in and cancellation
- spelling mode for names, IDs, and addresses
- optional local TTS

This path optimizes perceived responsiveness. CPU execution is acceptable
because Track 2's core Agent and accurate final ASR still run on Radeon.

### Accurate path: Qwen3-ASR-0.6B on Radeon

At the end of each utterance, send the retained audio segment to
Qwen3-ASR-0.6B:

- Apache-2.0 model license
- Chinese, English, Cantonese, dialect, and multilingual support
- streaming/offline unified model
- native vLLM support
- small enough to test on the provided Radeon environment

Initial implementation should use utterance-final inference on ROCm. Do not make
Qwen3-ASR streaming on Radeon a dependency until it is verified, because that
specific combination is not yet confirmed in the upstream discussion.

### Agent path: local planner on Radeon

The local Agent model receives:

- final transcript
- partial/final transcript differences
- interruption timestamp
- currently proposed tool call
- user correction
- relevant local policy and prior verified skills

It produces:

- amended workflow
- minimum capability manifest
- new policy clause
- positive and negative test cases
- proof-bundle update

## Voice-native innovation

### 1. Spoken explanation becomes policy

Example:

1. The user demonstrates a review follow-up workflow.
2. While operating the workflow, the user says: "Only include P0 and P1 issues,
   never include compensation data, and draft emails only."
3. The compiler extracts:
   - `include_if.severity in ["P0", "P1"]`
   - `redact.fields += ["compensation"]`
   - `deny_tools += ["mail.send"]`
   - `allow_tools += ["mail.draft"]`
4. The verifier creates negative tests for compensation leakage and accidental
   sending.

This captures information that clicks alone do not contain.

### 2. Barge-in is only a supporting case

Example:

1. Agent says, "I will send the follow-up email."
2. User interrupts: "No, never send it automatically. Draft only."
3. The runtime cancels the pending action.
4. The compiler creates:
   - deny rule: `mail.send`
   - allow rule: `mail.draft`
   - regression test: no execution trace may contain `mail.send`

The correction is retained as a reusable boundary, not merely applied to the
current conversation. This is useful, but it should not be the lead story.

### 3. Spoken qualifiers become behavioral contracts

Phrases such as:

- "always ask me before..."
- "never include..."
- "only for this project..."
- "unless the recipient is..."
- "draft it, do not send it"

are proposed as explicit clauses. The user confirms the structured clause before
it is stored.

### 4. Transcript disagreement triggers a safety gate

Compare Moonshine's fast transcript with Qwen3-ASR's final transcript. If they
disagree on a critical slot, such as:

- recipient
- date or time
- amount
- file path
- permission verb such as draft/send/delete

the Agent must ask for targeted confirmation or switch to spelling mode.

This converts two-pass ASR disagreement into a measurable safety mechanism.

### 5. Time-aligned corrections become counterexamples

An interruption is linked to the exact proposed tool call and execution state.
That pair becomes a negative demonstration:

`context + proposed action -> rejected action + corrected action`

These counterexamples are used when generating and testing later skill
versions.

### 6. Privacy-aware voice evidence

By default retain:

- transcript span
- timestamp
- speaker index within the session
- audio hash
- learned policy clause

Do not retain raw audio unless the user explicitly enables it. Speaker
diarization may organize a session, but must not be used as authentication or
permission evidence.

## Five-minute demo

1. User says:
   - "After each project review, find unresolved commitments, draft follow-up
     emails, create tentative calendar holds, and write an audit report."
2. Partial captions appear immediately through Moonshine.
3. Qwen3-ASR finalizes the utterance on Radeon.
4. VoiceProof proposes a workflow and reads the high-risk actions aloud.
5. User interrupts:
   - "Do not send anything. Draft only, and never include compensation data."
6. The pending send action is cancelled.
7. The UI shows two newly compiled constraints and generated regression tests.
8. Radeon runs local skill compilation, critique, and batched tests.
9. The skill moves from `Quarantined` to `Verified`.
10. A second review note reuses the verified skill with lower latency.

## Metrics

Voice:

- first partial transcript latency
- utterance-final transcript latency
- barge-in-to-cancel latency
- critical-slot disagreement rate
- targeted-confirmation success rate

Agent:

- correction-to-policy extraction accuracy
- prohibited-action escape rate
- generated-test pass/fail validity
- verified-skill reuse latency versus full replanning

Radeon:

- Qwen3-ASR real-time factor
- Agent TTFT and output tokens per second
- sequential versus batched verification time
- VRAM use
- full voice-to-proof latency

## Implementation priority

1. Verify Qwen3-ASR-0.6B utterance inference on Radeon/vLLM.
2. Implement deterministic tool execution, cancellation, and policy tests.
3. Integrate recorded audio before live microphone input.
4. Add Moonshine live events and barge-in.
5. Add TTS and spelling mode.
6. Treat a Moonshine ROCm/MIGraphX execution-provider patch as an optional
   stretch goal, not the submission's critical path.

## Source references

- [Linked WeChat article](https://mp.weixin.qq.com/s/4DuN9JrTGISE0A8_G_0yXA)
- [Moonshine Voice](https://github.com/moonshine-ai/moonshine)
- [Moonshine v2 paper](https://arxiv.org/abs/2602.12241)
- [Qwen3-ASR](https://github.com/QwenLM/Qwen3-ASR)
- [Qwen3-ASR vLLM recipe](https://docs.vllm.ai/projects/recipes/en/stable/Qwen/Qwen3-ASR.html)
