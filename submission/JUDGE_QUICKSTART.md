# Judge Quickstart

This page is the shortest path through Radeon Voice Skill Foundry.

## 1. Watch These First

1. Unedited live W7900 evidence, 48.96 seconds:
   `https://github.com/Chengyuann/radeon-voice-skill-foundry/releases/download/submission/W7900_LIVE_EVIDENCE_UNEDITED.mp4`
   Raw browser capture:
   `https://github.com/Chengyuann/radeon-voice-skill-foundry/releases/download/submission/W7900_LIVE_EVIDENCE_UNEDITED.webm`
2. Product Demo, 4:49:
   `https://github.com/Chengyuann/radeon-voice-skill-foundry/releases/download/submission/RADEON_VOICE_SKILL_FOUNDRY_DEMO.mp4`
3. Multi-turn Director Cut, 35.5 seconds:
   `https://github.com/Chengyuann/radeon-voice-skill-foundry/releases/download/submission/MULTI_TURN_INTERACTION_DIRECTOR_CUT.mp4`

The unedited capture shows one continuous public request sequence:
`health -> ASR -> compile -> verify -> proof hash`. The Product Demo shows the
broader workflow, and the Director Cut isolates multi-turn revision behavior.

## 2. Score Map

| Track 2 area | Fast evidence |
|---|---|
| Local RAG | Product Demo `00:29-04:15`; proof `rag_evidence.json` |
| Tool invocation | Six server-authoritative actions in `action_contract.json` |
| Multi-step planning | Generated `SKILL.md`, `policy.yaml`, fixtures, and sandbox replay |
| Smooth multi-turn interaction | 35.5-second Director Cut; `MULTI_TURN_REFINEMENT_PROOF.zip` |
| Local memory | Promotion review, governance ledger, and exact reuse in Product Demo |
| Permission and privacy | `mail:send = deny`, redaction, five fail-closed probes |
| Agent infrastructure | `AGENT_HARNESS_REPAIR_EVIDENCE.json` and `AGENT_HARNESS_REPAIR_PROOF.zip` |
| Radeon optimization | vLLM concurrency, ASR batching, compact output, Quark rejection study |
| Live W7900 execution | 48.96-second unedited capture and `W7900_LIVE_EVIDENCE_SUMMARY.json` |
| Public stability | `PUBLIC_HEALTH_SUMMARY.json` and `PUBLIC_HEALTH_HISTORY.jsonl` |

## 3. One-command Verification

From the source repository root:

```bash
npm ci
npm run verify:submission
```

The verification command regenerates the agent-harness repair evidence, runs
the 68-test suite, typechecks, builds the production frontend, checks every
submission artifact in `SHA256SUMS.txt`, and verifies that the Project
Specification PDF contains the current P0 evidence.

## 4. Most Important Proofs

- `VERIFIED_WORKFLOW_PROOF.zip`: authoritative workflow proof.
- `MULTI_TURN_REFINEMENT_PROOF.zip`: child revision proof.
- `AGENT_HARNESS_REPAIR_PROOF.zip`: harness, verifier, structured feedback,
  repair cycle, and final child proof.
- `GOVERNANCE_LEDGER.jsonl`: hash-chained promotion ledger sample.
- `LIVE_RADEON_RECOVERY_EVIDENCE.json`: current W7900 public-health,
  ASR, compile, verify, dependency restart, and tunnel-rotation evidence.
- `W7900_LIVE_EVIDENCE_SUMMARY.json`: hashes, runtime, timings, 7/7 result,
  and proof hash for the 48.96-second unedited live capture.
- `PUBLIC_HEALTH_SUMMARY.json` and `PUBLIC_HEALTH_HISTORY.jsonl`: more than
  three hours of external stable-URL health samples.
- `GITHUB_SCHEDULED_HEALTH_SUMMARY.json`: independently scheduled cloud checks
  with observed run times and explicit GitHub scheduling boundaries.
- `SHA256SUMS.txt`: SHA-256 digest for every finalized artifact except itself.

## 5. Boundaries

- Exact reuse is an application fast path for an identical promoted skill, not
  a fresh-inference GPU speedup.
- Voice Evidence is an internal deterministic signal-quality gate, not an ASR
  word-error-rate benchmark.
- Quark INT8 is a measured rejected candidate; production remains FP16.
- Ledger entries are SHA-256 chained but not digitally signed or externally
  anchored.
