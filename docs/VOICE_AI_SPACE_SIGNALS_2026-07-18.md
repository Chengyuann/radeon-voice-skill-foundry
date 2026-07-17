# Voice AI Space Signals and Product Decision

Researched: 2026-07-18 (UTC+8)

Source starting point:
`https://www.voiceaispace.com/news`

## Executive decision

The site is useful, but it does not justify turning Radeon Voice Skill Foundry
into another general real-time voice assistant.

The strongest product signal is that production Voice AI is moving from:

`clean transcript demo -> real-world conversation infrastructure`

The project should absorb that shift through a narrowly scoped
**Voice Evidence Gate**:

`audio -> local quality evidence -> ASR -> governed skill -> proof`

This preserves the existing innovation, voice-seeded proof-carrying skills,
while making the voice input itself auditable.

## Signals that matter

### 1. Real-world audio is now part of the product contract

The Far-Field ASR Leaderboard launched by Treble and Hugging Face evaluates
models across distance, reverberation, background noise, competing speech, and
different acoustic scenarios. This is more relevant than another clean-speech
WER claim because Agent reliability depends on the audio conditions that
produced the transcript.

Project implication:

- keep the existing Qwen3-ASR Radeon benchmark
- add local evidence for level, clipping, silence, format, duration, and source
  hash
- explicitly state that full far-field WER evaluation remains future work

### 2. Audio observability should precede downstream failure

ai-coustics introduced Tyto in June 2026 to predict whether incoming audio will
cause failures in VAD, STT, turn-taking, or speech-to-speech components. The
important product pattern is not the specific commercial model. It is treating
audio quality as a first-class operational signal rather than debugging only
from bad transcripts.

Project implication:

- calculate a local, deterministic quality score before skill promotion
- classify evidence as `pass`, `review`, or `quarantine`
- require transcript acknowledgement for review-grade audio
- require a new recording for quarantine-grade audio

The current implementation is intentionally simpler than Tyto. It does not
claim learned noise, reverb, packet-loss, or cross-talk diagnosis.

### 3. Real-time speech is becoming structured conversation intelligence

Soniox v5 Real-Time, released on 2026-06-16, emphasizes speaker separation,
language identification, endpointing, translation, context, and stable
structured output during live speech. The broader lesson is that text alone is
not enough; downstream systems need provenance and interaction state.

Project implication:

- keep full-duplex turn-taking outside the judged MVP
- bind audio-derived evidence and transcript review state to the generated
  skill proof
- retain speaker-aware and semantic endpointing as a post-submission roadmap

### 4. Voice Agents are expected to resolve tasks, not merely answer

The 2026-07-13 Voice AI Space roundup highlights real-time interruption,
multi-action assistants, local/offline speech, fraud detection, and Agentic
workflow execution. This supports the current project thesis: voice must create
or govern reusable capability, not act as a cosmetic input mode.

Project implication:

- do not pivot to a voice chat demo
- show the complete path from spoken rule to permission, adversarial test,
  governance receipt, and reusable skill

## Implemented response

The project now includes a local Voice Evidence Gate that:

- parses browser-produced PCM/float WAV input
- records sample rate, channels, duration, RMS, peak, clipping, and silence
- hashes the source audio with SHA-256
- hashes the original ASR transcript and detects later transcript edits
- emits `pass`, `review`, or `quarantine`
- resolves evidence from a server-held run instead of trusting browser metrics
- binds the evidence to compilation and verification
- adds a critical verification fixture for voice-seeded runs
- stores derived evidence in `voice_evidence.json`
- excludes raw audio from the proof ZIP

This keeps the local evidence chain honest: the browser can reference a voice
evidence run, but it cannot submit replacement quality metrics or silently edit
the ASR transcript without triggering explicit review.

The repository's existing synthetic Chinese SOP fixture measured:

| Metric | Result |
|---|---:|
| Duration | 20.39 s |
| Sample rate | 16 kHz |
| Channels | 1 |
| RMS | -18.36 dBFS |
| Peak | -2.94 dBFS |
| Clipping | 0% |
| Near-silence | 17.17% |
| Gate | PASS, 100/100 |

Source SHA-256:

`23a8c063efe23181f5f9d9da3e4dd50ac74d681731c599f43066f97a1c41589f`

## Scope boundary

This enhancement does not claim:

- full-duplex speech-to-speech interaction
- learned acoustic-failure prediction
- speaker diarization
- semantic endpointing
- noise, reverberation, cross-talk, or packet-loss classification
- far-field ASR accuracy measured on FFASR

Those are credible next steps after the current judged workflow and final
submission are complete.

## References

- Voice AI Space newsroom:
  `https://www.voiceaispace.com/news`
- Voice AI Space roundup, 2026-07-13:
  `https://www.voiceaispace.com/news/voice-ai-news-2026-07-13-7g0b`
- Treble / Hugging Face FFASR:
  `https://huggingface.co/spaces/treble-technologies/ffasr`
- ai-coustics Tyto documentation:
  `https://docs.ai-coustics.com/models/audio-insight/tyto`
- Soniox v5 Real-Time:
  `https://soniox.com/blog/soniox-v5-real-time`
