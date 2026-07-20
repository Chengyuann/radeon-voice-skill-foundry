# Radeon Cloud Runbook

Last updated: 2026-07-20 (UTC+8)

## Current status

- Luma registration: approved by user report.
- AMD group notice: new credits have been sent and currently do not deduct
  credits.
- Radeon Cloud account: registered hackathon email.
- Credits shown: 5.
- Active instance: one W7900-class workspace.
- Template: `Blank OpenCode Workspace`.
- Instance image:
  `vivienfanghua/amd-oneclick-base:git-proxy-test-20260528-1125`
- Instance status during validation: Ready.
- Local app port: `8791`.
- Local app URL: `http://127.0.0.1:8791/`.
- Public product: `https://radeon-voice-skill-foundry.pages.dev/`.
- Public API port on W7900: `8792`.
- Public API, Quick Tunnel, and origin registrar: Supervisor managed.
- Dynamic origin registry: Cloudflare KV binding `RVSF_ORIGIN_REGISTRY`.

If the browser says `127.0.0.1 refused to connect`, the local Express server is
not running. Start it from the project root:

```bash
npm start
```

## Radeon Cloud login

1. Open Radeon Cloud:
   - `https://radeon-global.anruicloud.com/`
2. Select `Login`.
3. Use the email account that passed AMD registration and received credits.
4. After login, open `Profile`.

## GPU workspace path

Use this when we need an SSH/Jupyter machine and full control.

1. In `Profile`, open `My Templates`.
2. Select `Add Template`.
3. Give the template a title, for example:
   - `radeon-voice-skill-foundry-dev`
4. Choose a ROCm / vLLM / OpenCode-capable image.
5. Enable `SSH Access (advanced)` if SSH access is needed.
6. Select `Add Template`.
7. Back in `My Templates`, select `Launch`.
8. Wait until `Your workspace is ready (100%)`.
9. Open JupyterLab or copy the SSH command.

## Dedicated model API path

Use this when we need an OpenAI-compatible endpoint for the local web app.

1. Go to Radeon Cloud `Profile` -> `Add Template`.
2. Set `Deploy Type = vLLM Model API`.
3. Use a serve command with:

```bash
vllm serve <model> --host 0.0.0.0 --port 8000
```

4. Keep `--host 0.0.0.0 --port 8000`.
5. Launch the template.
6. When ready, copy:
   - Base URL, usually ending with `/8000/v1`
   - Model name
   - API key
7. Configure local `.env`:

```bash
RADEON_OPENAI_BASE_URL=<base-url>
RADEON_MODEL=<model>
RADEON_API_KEY=<api-key>
RADEON_GPU_NAME=<gpu-name>
ROCM_VERSION=<rocm-version>
```

8. Restart the app and enable `Radeon model adapter` in the UI.

## Free model API path

The Feishu doc says shared public model APIs are available without starting an
instance and currently include Qwen and DeepSeek.

1. Open:
   - `https://developer.amd.com.cn/radeon/modelapis`
2. Log in.
3. Open a `Public Free Model APIs` detail dialog.
4. Copy:
   - Base URL
   - model name
   - API key
5. Use it for early integration tests. Do not treat this as the final Track 2
   local-inference proof unless AMD confirms it qualifies.

## Smoke test commands

On a Radeon Cloud terminal:

```bash
git clone <your-repo-url> radeon-voice-skill-foundry
cd radeon-voice-skill-foundry
npm install
npm run build
npm test
bash scripts/radeon_smoke.sh
```

Expected local service:

```bash
npm start
curl http://127.0.0.1:8791/api/health
```

## Public gateway auto-recovery

The public browser never receives the W7900 API token. Pages Functions proxy
same-origin `/api/*` requests and inject `RVSF_API_TOKEN`.

The Quick Tunnel hostname is intentionally treated as replaceable:

1. `scripts/radeon_tunnel_supervisor.sh` starts `cloudflared`.
2. It extracts the issued HTTPS `trycloudflare.com` origin and atomically writes
   `/workspace/rvsf-public-origin.txt`.
3. `scripts/radeon_origin_registrar.sh watch` detects a changed origin.
4. It validates `${origin}/api/health` through the public tunnel using
   `RVSF_API_TOKEN`.
5. It signs the canonical origin, timestamp, and Radeon runtime fields with
   HMAC-SHA256 using that API token.
6. It authenticates to the Pages-only `/internal/origin-recovery` endpoint.
7. Pages uses its server-held copy of `RVSF_API_TOKEN` to verify the HMAC,
   requires a three-minute timestamp window, and checks the Radeon runtime
   fields.
8. Only a valid fresh proof is written to KV as `radeon-api-origin`.
9. The normal `/api/*` proxy reads KV first and uses `RADEON_API_ORIGIN` only
   as a fallback.

Secret files on W7900:

```text
/workspace/.rvsf-api-token              mode 600
/workspace/.rvsf-origin-recovery-token  mode 600
```

Inspect the managed services:

```bash
supervisorctl -c /workspace/rvsf-supervisord.conf status
bash /workspace/radeon-voice-skill-foundry-live/scripts/radeon_origin_registrar.sh status
```

Production releases use immutable directories and one stable symlink:

```text
/workspace/radeon-voice-skill-foundry-release-<commit>
/workspace/radeon-voice-skill-foundry-current -> release-<commit>
```

Supervisor configuration is versioned at `deploy/rvsf-supervisord.conf`.

Controlled recovery test:

```bash
supervisorctl -c /workspace/rvsf-supervisord.conf restart rvsf-tunnel
watch -n 2 'cat /workspace/rvsf-public-origin.txt; curl -fsS https://radeon-voice-skill-foundry.pages.dev/api/health'
```

Success means the tunnel origin changes, the registrar reports the same origin,
and the stable Pages health endpoint returns the W7900 Radeon runtime without a
new Pages deployment.

## Data to record for submission

- GPU model, expected from group context: Radeon Pro W7900 if that is what your
  allocation shows.
- VRAM.
- ROCm version.
- Container image name.
- Whether vLLM or Transformers/PyTorch ROCm was used.
- Model name.
- TTFT.
- tokens/s.
- ASR real-time factor if Qwen3-ASR is tested.
- batch verification time versus sequential verification time.
- screenshot or terminal log showing execution on Radeon Cloud.

## Cleanup

When finished, destroy unused running instances from `Profile` ->
`Active Instance`.
