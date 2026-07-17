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
- [x] Record final demo video
- [x] Upload demo video and verify public access
- [x] Add video URL to `submission/README.md`
- [x] Add video URL to official submission PR body

## Quality Gates

- [x] Local `npm test`: 21/21 passed
- [x] Local `npm run build`: passed
- [x] Radeon baseline `npm test`: 10/10 passed
- [x] Re-run the 21-test suite on Radeon after Voice Evidence Gate sync
- [x] Radeon `npm run build`: passed
- [x] Agent service health: passed
- [x] ASR service health: passed
- [x] Local Voice Evidence Gate fixture: 100/100 pass
- [x] App service health: passed
- [x] Compact-output semantic gate: passed in 3/3 runs
- [x] `mail.send = deny`
- [x] Original Radeon workflow fixtures: 6/6 passed
- [x] Local audio-backed verification: 7/7 fixtures passed
- [x] Re-run audio-backed verification on Radeon: 7/7 fixtures
- [x] Benchmark JSON validates
- [x] Proof ZIP integrity validates
- [x] Secret scan passed

## Official Repository Submission

- [x] Fork `AMD-DEV-CONTEST/Radeon-hackathon-2026-07`
- [x] Create submission branch
- [x] Add `submissions/track2-na-radeon-voice-skill-foundry/`
- [x] Include submission index and required materials
- [x] Open English PR
- [ ] PR title:
  `Track 2, N/A, Radeon Voice Skill Foundry`
- [x] Verify all links from an incognito browser

Official PR:
`https://github.com/AMD-DEV-CONTEST/Radeon-hackathon-2026-07/pull/7`

## Evidence Values

- Final Radeon validation commit:
  `c759a417c68d06f639e3df797f50b4ebd7b81091`
- Original Radeon proof ZIP SHA-256:
  `0f9a37f69aea24677561b3c43c2e5fbfa275aa0fadf0509816a7a8f1229879bd`
- Local audio-backed proof ZIP SHA-256:
  `8c68e2b2c1dc6fec4f73601488113241259d751a82e0e5e2ab65f1f001911f30`
- Radeon audio-backed proof ZIP SHA-256:
  `6ea53dfe28f8221b3db9b06e6eed537767bf28b4c6536d25d45f3ffec20500e9`
- Radeon audio-backed proof hash:
  `6ff30ccc2d052e226051fa6819760abe3b2c2ef6243b63169ab9d5e0caebfc40`
- Demo video SHA-256:
  `79ccceb89ba7ac50f9fe1f7f5e302c6682759b64bcf1e8cae9c5dd5891436eb7`
- Demo captions SHA-256:
  `e83753648ac9317d8cbba4fdd07a0d6466ed7d48372a4e68c2a7ddb7f1e370b6`
- Optimization JSON SHA-256:
  `ce2848f92c7f93b30fe558c99128cb6eba1988319931f7ab0bdcc803d291298d`
- W7900-class GPU: `gfx1100`, 47.98 GiB VRAM
- ROCm: 7.2.1
- Agent median TTFT: 108.87 ms
- Agent median throughput: 22.02 tokens/s
- ASR warm median RTF: 0.0556
- Final SOP ASR RTF: 0.0699, 14.3x real-time
- Final Agent compile: 24.13 s, 368.16 ms TTFT, 20.07 tokens/s
- Output token reduction: 29.42%
- Generation latency reduction: 30.03%
- Exact reuse HTTP median: 2.18 ms
- Measured exact-reuse speedup: 11,052.03x
