# Final Submission Checklist

Deadline: 2026-08-06 23:59 UTC+8.

## Eligibility

- [x] Luma registration approved
- [x] AMD Developer Program registered
- [x] Radeon Cloud credits available
- [x] Solo entry; PR team name must be `N/A`
- [x] GitHub ID: `Chengyuann`
- [x] Discord/WeChat joined

## Track 2 Technical Requirements

- [x] Core Agent inference on AMD Radeon + ROCm
- [x] Local ASR on AMD Radeon + ROCm
- [x] Local RAG
- [x] Tool invocation
- [x] Multi-step planning
- [x] Local multi-turn/procedural memory
- [x] Permission and privacy controls
- [x] Targeted Radeon inference optimization
- [x] Raw benchmark evidence committed

## Required Deliverables

- [x] Complete public source repository
- [x] English README with setup and dependencies
- [x] English Project Specification Markdown
- [x] English Project Specification PDF
- [x] Agent architecture diagram
- [x] Supplementary poster
- [x] 3-5 minute English demo script
- [ ] Record final demo video
- [ ] Upload demo video and verify public access
- [ ] Add video URL to `submission/README.md`
- [ ] Add video URL to official submission PR body

## Quality Gates

- [x] Local `npm test`: 20/20 passed
- [x] Local `npm run build`: passed
- [x] Radeon baseline `npm test`: 10/10 passed
- [ ] Re-run the 20-test suite on Radeon after Voice Evidence Gate sync
- [x] Radeon `npm run build`: passed
- [x] Agent service health: passed
- [x] ASR service health: passed
- [x] Local Voice Evidence Gate fixture: 100/100 pass
- [x] App service health: passed
- [x] Compact-output semantic gate: passed in 3/3 runs
- [x] `mail.send = deny`
- [x] Original Radeon workflow fixtures: 6/6 passed
- [x] Local audio-backed verification: 7/7 fixtures passed
- [ ] Re-run audio-backed verification on Radeon: 7/7 fixtures
- [x] Benchmark JSON validates
- [x] Proof ZIP integrity validates
- [x] Secret scan passed

## Official Repository Submission

- [ ] Fork `AMD-DEV-CONTEST/Radeon-hackathon-2026-07`
- [ ] Create submission branch
- [ ] Add `submissions/track2-na-radeon-voice-skill-foundry/`
- [ ] Include submission index and required materials
- [ ] Open English PR
- [ ] PR title:
  `Track 2, N/A, Radeon Voice Skill Foundry`
- [ ] Verify all links from an incognito browser

## Evidence Values

- Git commit: `9768d5338742bf3e5b055c4a0db67bb41693a8bf`
- Original Radeon proof ZIP SHA-256:
  `0f9a37f69aea24677561b3c43c2e5fbfa275aa0fadf0509816a7a8f1229879bd`
- Local audio-backed proof ZIP SHA-256:
  `8c68e2b2c1dc6fec4f73601488113241259d751a82e0e5e2ab65f1f001911f30`
- Optimization JSON SHA-256:
  `ce2848f92c7f93b30fe558c99128cb6eba1988319931f7ab0bdcc803d291298d`
- W7900-class GPU: `gfx1100`, 47.98 GiB VRAM
- ROCm: 7.2.1
- Agent median TTFT: 108.87 ms
- Agent median throughput: 22.02 tokens/s
- ASR warm median RTF: 0.0556
- Output token reduction: 29.42%
- Generation latency reduction: 30.03%
- Exact reuse HTTP median: 2.18 ms
- Measured exact-reuse speedup: 11,052.03x
