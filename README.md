# Telegram AI Agent Crew

A zero-cost, mobile-first automation framework that lets a Telegram chat act as the control plane for a multi-agent engineering system. The `Brain Agent` receives requests from your phone, plans tasks, and can scaffold or update a project repository end-to-end.

This project now includes project-generation tooling that can turn a Telegram prompt into a deployable app skeleton with Docker files, environment template, health checks, and deployment instructions.

## Features

- Telegram bot webhook bridge for mobile input
- LangGraph-based brain and automation tools
- GitHub repository creation and file updates
- Project scaffolding from a natural-language prompt
- Docker + health-check configuration for deployment
- Environment variable templates for required credentials

## Project layout

- `api/webhook.js` – Telegram webhook endpoint and orchestration layer
- `lib/agents.js` – LangGraph-based brain and worker toolset
- `lib/github-tools.js` – GitHub API automation functions
- `lib/project-builder.js` – prompt-to-project scaffolding logic
- `Dockerfile` – container build config
- `docker-compose.yml` – local deployment config
- `vercel.json` – Vercel routing and runtime configuration
- `.env.example` – required environment variables

## Telegram project builder

You can send prompts like:

```text
Build a Node Telegram automation service with Docker, health checks, and a GitHub repo workflow.
```

```text
Create a FastAPI app for a CRM dashboard with Stripe and Postgres support, plus Docker deployment.
```

The project builder will infer the stack, required env vars, Docker config, and deployment instructions automatically.

## Required environment variables

```bash
TELEGRAM_BOT_TOKEN=
GROQ_API_KEY=
GEMINI_API_KEY=
GITHUB_ACCESS_TOKEN=
VERCEL_URL=https://your-project.vercel.app
GITHUB_OWNER=lastcalldiagnostic-sketch
```

## Docker

```bash
docker compose up --build -d
curl http://localhost:3000/health
```

## Vercel deployment

```bash
npm install
npx vercel login
npx vercel --prod
```

## License

MIT
