# AMD AI DevMaster Hackathon - Track 2 Registration Checklist

Last verified: 2026-07-21 (UTC+8)

## Critical eligibility checks

- [x] Submit the Luma application and receive organizer approval.
  - Joining WeChat and Discord does not complete registration.
  - In a logged-out browser the event still shows `Apply to Join`; verify the
    logged-in account shows approved/registered status.
- [x] Register for the AMD AI Developer Program.
  - Mainland China: use AMD Developer Program China.
  - Use the same email in the Luma form because it is used to issue Radeon
    Cloud credits.
- [x] Select `Track 2: Agentic AI` in the Luma application.
- [x] Use a legal name and valid contact information.
- [x] Have valid GitHub and Discord/WeChat IDs.
- [x] Enter as a solo participant with team name `N/A`.

## Information required by the Luma application

- Legal name
- Email address
- Phone number
- Country
- City
- Team name, or `N/A` if competing individually
- Track selection: Track 2
- GitHub ID
- Discord ID or WeChat ID
- AMD AI Developer Program registered email address
- Agreement to join the AMD Developer Program and accept the event terms

## Radeon Cloud access checks

- [x] Confirm Radeon Cloud or Model API credits have been issued.
- [x] Confirm login to the Radeon Cloud portal.
- [x] Launch a Radeon GPU instance or dedicated vLLM Model API.
- [x] Record the actual GPU model and available VRAM.
- [x] Confirm `rocminfo`, PyTorch ROCm, and the chosen inference runtime work.
- [ ] After judging, destroy the live instance when the public demo no longer
      needs the W7900 origin.

## Final submission requirements

Deadline: 2026-08-06 23:59 (UTC+8)

- English project specification:
  - application scenario
  - Agent architecture diagram
  - core capabilities
  - model and local deployment plan
  - Radeon/ROCm inference optimization
- Complete source repository with English README:
  - environment setup
  - startup instructions
  - dependencies
  - reproduction steps
- Three-to-five-minute demo video:
  - real workflow
  - real execution on AMD Radeon GPU
  - smoothness and functional completeness
- PPT or poster
- Fork the official repository and open a pull request.
- Pull request title format:
  - `Track 2, <Team name>, <Application name>`

## Evidence to retain

- Luma approval email or approved status screenshot
- AMD Developer Program confirmation
- Radeon Cloud credit/allocation notice
- Radeon GPU and ROCm environment output
- Baseline and optimized benchmark JSON/CSV
- Final commit hash, pull request URL, video URL, and package checksum
