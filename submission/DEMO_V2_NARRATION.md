# Demo V2 Narration

The narration is AI-generated with AIDP
`gemini-3.1-flash-tts-preview`, male voice `Charon`. The product workflow is
recorded from the public Cloudflare deployment and executes against the live
W7900 runtime.

## Open the Live Product

This is Radeon Voice Skill Foundry running as a public full-stack product, not
a static mockup. The cinematic cover is hosted on Cloudflare Pages. Every API
action is forwarded through an authenticated same-origin gateway to an AMD
Radeon Pro W7900 running ROCm 7.2.1. The product turns a private spoken
procedure into a governed, reusable Agent Skill before risky actions are
allowed.

## Capture Source-Bound Voice

I open the Voice module and upload the same twenty-point-three-nine second
Chinese procedure used in the Radeon validation. Qwen three A-S-R transcribes
the audio on the W7900. Voice Evidence version zero point three measures source
integrity, level, clipping, silence, signal-to-noise ratio, dropout, and
multi-frame burst loss. This recording passes at one hundred out of one
hundred, and the server binds the original transcript hash to the skill.

## Compile on Radeon

Now the Radeon model adapter compiles the spoken procedure. Qwen three,
four-B Instruct combines the transcript, the aligned action trace, and
retrieved local policy evidence. This is a real model call, so the interface
keeps the compiling state visible while the W7900 generates structured output.
During this live generation window, the public interface does not substitute a
cached policy or accelerate the footage. It waits for the Radeon response and
preserves the measured latency as part of the evidence.
The runtime then merges deterministic safety guardrails ahead of the model
result and advances directly into the Policy module.

## Inspect Enforced Policy

The policy makes the hidden intent executable. The Chinese instruction not to
send automatically becomes a must-not rule and `mail.send` is denied. Salary
data becomes a redaction rule. Missing ownership opens human review. Calendar
holds remain conditional on a due date. Seven generated tests cover voice
integrity, the happy path, automatic sending, sensitive data, missing context,
conditional scope, and unapproved network writes.

## Prove Unsafe Paths

Verification executes those unsafe paths before promotion. The server resolves
the authoritative compile run instead of trusting client-side permissions.
All seven fixtures pass. Automatic email sending is blocked before tool
execution, sensitive data is removed, and four governance receipts record the
review and block decisions. The Proof module exposes the measured Radeon
runtime, the generated skill, and a downloadable hash-bound package.

## Save and Reuse Memory

The verified result is saved into local procedural memory. I immediately reuse
the same skill without asking the model to regenerate its rules and tests.
Compatibility remains bound to the current runtime, verifier, tool contract,
policy, skill definition, and Voice Evidence schema. This is reusable proof,
not just a transcript or a one-time workflow recording.

## Show W7900 Evidence

The same W7900 produced the optimization evidence used by the submission.
At concurrency eight, vLLM graph serving reached two hundred fifty-seven point
six five aggregate output tokens per second, twelve point four seven times the
serialized Transformers path. Native Qwen three A-S-R batching reached
eighty-five point three five times aggregate real-time and was six point six
six times faster than sequential inference. The current regression suite
passes thirty-five out of thirty-five tests.

## Close on the Public Demo

The complete path is now public: Cloudflare, authenticated gateway, W7900
speech recognition, local policy retrieval, Radeon model compilation,
least-privilege enforcement, adversarial proof, and procedural memory. Actions
capture what happened. Voice captures why, when, exceptions, and what must
never happen. Speak the S-O-P. Prove the Skill.
