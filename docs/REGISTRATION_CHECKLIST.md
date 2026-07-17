# AMD AI DevMaster Hackathon - Track 2 Registration Checklist

Last verified: 2026-07-16 (UTC+8)

## Critical eligibility checks

- [ ] Submit the Luma application and receive organizer approval.
  - Joining WeChat and Discord does not complete registration.
  - In a logged-out browser the event still shows `Apply to Join`; verify the
    logged-in account shows approved/registered status.
- [ ] Register for the AMD AI Developer Program.
  - Mainland China: use AMD Developer Program China.
  - Use the same email in the Luma form because it is used to issue Radeon
    Cloud credits.
- [ ] Select `Track 2: Agentic AI` in the Luma application.
- [ ] Use a legal name and valid contact information.
- [ ] Have valid GitHub and Discord/WeChat IDs.
- [ ] If entering as a team, all members must register separately and use the
    exact same team name.

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

- [ ] Confirm Radeon Cloud or Model API credits have been issued.
- [ ] Confirm login to the Radeon Cloud portal.
- [ ] Launch a Radeon GPU instance or dedicated vLLM Model API.
- [ ] Record the actual GPU model and available VRAM.
- [ ] Confirm `rocminfo`, PyTorch ROCm, and the chosen inference runtime work.
- [ ] Destroy unused instances so credits are not consumed.

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

