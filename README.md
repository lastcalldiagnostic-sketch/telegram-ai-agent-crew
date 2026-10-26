# Telegram AI Agent Crew

A zero-cost, mobile-first automation framework that lets a Telegram chat act as the control plane for a multi-agent engineering system. The `Brain Agent` receives requests from your phone, plans tasks, and delegates work to specialized sub-agents such as GitHub automation, infrastructure setup, and code generation.

This project is designed to deploy instantly to Vercel's free tier with serverless functions and environment variables.

## Features

- Telegram bot webhook bridge for mobile input
- LangGraph-based project manager / brain agent
- Free model providers: Groq (Llama 3) or Gemini
- GitHub automation tools for repository creation, branch creation, file commits, and repo secrets
- Deployment-friendly structure for Vercel free tier

## Project layout

- `api/webhook.js` – Telegram webhook endpoint and orchestration layer
- `lib/agents.js` – LangGraph-based brain and worker toolset
- `lib/github-tools.js` – GitHub API automation functions
- `vercel.json` – Vercel routing and runtime configuration
- `.env.example` – required environment variables

## Quick start

1. Clone the repo
2. Copy `.env.example` to `.env`
3. Fill in your API keys
4. Install dependencies
5. Deploy to Vercel

```bash
npm install
cp .env.example .env
```

## Required free-tier environment variables

```bash
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
COMPOSIO_API_KEY=your_composio_key
GITHUB_ACCESS_TOKEN=your_github_pat
VERCEL_URL=https://your-project.vercel.app
GITHUB_OWNER=lastcalldiagnostic-sketch
```

## Telegram webhook registration

### Option A: direct URL call

```bash
export TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN"
export VERCEL_LIVE_URL="https://your-project.vercel.app"
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=${VERCEL_LIVE_URL}/api/webhook"
```

### Option B: verify webhook status

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

### Option C: BotFather configuration

1. Open Telegram and message `@BotFather`
2. Run:

```bash
/newbot
```

3. Choose a bot name and username.
4. Copy the token.
5. Set the webhook URL using the command above.
6. Optionally confirm with BotFather:

```bash
/mybots
```

## Vercel deployment

```bash
npm install
npx vercel login
npx vercel --prod
```

Then add the same env vars from `.env.example` inside Vercel Project → Settings → Environment Variables.

## GitHub automation commands

Use these GitHub CLI commands if you want to manage secrets or repo config from the terminal.

```bash
gh auth login
export GITHUB_OWNER="lastcalldiagnostic-sketch"
export GITHUB_REPO="telegram-ai-agent-crew"

gh repo view ${GITHUB_OWNER}/${GITHUB_REPO} --web

gh secret set TELEGRAM_BOT_TOKEN --body "$TELEGRAM_BOT_TOKEN" --repo ${GITHUB_OWNER}/${GITHUB_REPO}
gh secret set GROQ_API_KEY --body "$GROQ_API_KEY" --repo ${GITHUB_OWNER}/${GITHUB_REPO}
gh secret set GEMINI_API_KEY --body "$GEMINI_API_KEY" --repo ${GITHUB_OWNER}/${GITHUB_REPO}
gh secret set COMPOSIO_API_KEY --body "$COMPOSIO_API_KEY" --repo ${GITHUB_OWNER}/${GITHUB_REPO}
gh secret set GITHUB_ACCESS_TOKEN --body "$GITHUB_ACCESS_TOKEN" --repo ${GITHUB_OWNER}/${GITHUB_REPO}
```

## Example Telegram messages to try

```text
Create a new GitHub repo called mobile-agent-demo and initialize a FastAPI service with Telegram webhook support.
```

```text
Set up a Vercel-ready Node monorepo that includes a Telegram bot, LangGraph brain, and GitHub automation tools.
```

```text
Commit a README and package.json for an automation stack, then create a branch named feature/telegram-bot.
```

## Notes

- This stack is intentionally optimized for zero-cost experimentation.
- Groq is preferred when the bot needs faster reasoning with a small Llama model.
- Gemini is preferred when you want a strong long-context vision/assistant experience.
- GitHub and Vercel are both free for starter use cases.

## License

MIT
