# Homemade Tools Co.

AI-powered tools business built on [Paperclip](https://github.com/paperclipai/paperclip) — an open-source orchestration platform for running teams of AI agents.

This repo serves two purposes:
1. **Workspace** — the codebase where AI agents build and ship tools
2. **Ops config** — company/agent definitions and deployment infrastructure

---

## Tools

| Tool | Description |
|------|-------------|
| [qr-code-generator](./qr-code-generator) | QR code generator (URL, phone, email, SMS, WiFi). Vite + React + TypeScript. |

---

## Running Paperclip locally

Paperclip orchestrates the AI agents that build and maintain this repo.

**Requirements:** Docker Desktop (or Docker + Compose plugin)

```bash
cd paperclip
bash setup.sh
```

Opens at **http://localhost:3100**. On first run:
1. Create your board account
2. Go to **Company > Import** and upload `.paperclip/company.yaml`
3. Add `ANTHROPIC_API_KEY` to `paperclip/.env`, then `docker compose restart`
4. Start the CEO agent and assign it a goal

---

## Agent company structure

Defined in [`.paperclip/company.yaml`](./.paperclip/company.yaml):

```
Board (you)
└── CEO           — strategy, task breakdown, delegation
    ├── Dev       — builds tools in this repo
    └── Client Ops — manages client Paperclip deployments
```

All agents use the `claude_local` adapter (runs the local `claude` CLI).
Make sure `claude` is installed: `npx @anthropic-ai/claude-code --version`

---

## Upgrading to production (client hosting)

When you're ready to offer managed Paperclip hosting to clients:

```bash
cd paperclip
cp .env.example .env
# Fill in: BETTER_AUTH_SECRET, POSTGRES_PASSWORD, PAPERCLIP_PUBLIC_URL, ANTHROPIC_API_KEY
docker compose -f docker-compose.prod.yml up -d
```

Point a domain at port 3100 (nginx/Caddy reverse proxy recommended).
Each client gets their own Paperclip instance or an isolated company on a shared instance.

---

## Repo structure

```
.paperclip/
  company.yaml          # Agent org chart (import into Paperclip)
paperclip/
  docker-compose.yml    # Local quickstart
  docker-compose.prod.yml  # Production / client hosting
  .env.example          # All env vars documented
  setup.sh              # One-command local setup
qr-code-generator/      # Tool: QR code generator
LICENSE
```
