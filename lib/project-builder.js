const { createOctokit, githubTools } = require("./github-tools");

function slugify(value) {
  return String(value || "telegram-auto-project")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "telegram-auto-project";
}

function extractProjectName(prompt) {
  const match = String(prompt || "")
    .match(/(?:create|build|make|set up|launch|deploy)\s+(?:a|an|the)?\s*([a-zA-Z0-9][a-zA-Z0-9\s-]{2,40})/i);

  if (match?.[1]) {
    return slugify(match[1]);
  }

  const fallback = String(prompt || "")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .split(/\s+/)
    .slice(0, 4)
    .join("-")
    .trim();

  return fallback ? slugify(fallback) : "telegram-auto-project";
}

function inferProjectType(prompt) {
  const value = String(prompt || "").toLowerCase();

  if (/(fastapi|python|flask|django)/.test(value)) return "python-fastapi";
  if (/(next\.js|nextjs|react|vite|frontend|ui|web app)/.test(value)) return "nextjs-webapp";
  if (/(telegram bot|telegram webhook|bot)/.test(value)) return "node-express";
  if (/(api|service|backend|server)/.test(value)) return "node-express";

  return "node-express";
}

function inferEnvVars(prompt) {
  const value = String(prompt || "").toLowerCase();
  const vars = new Set([
    "PORT=3000",
    "NODE_ENV=development",
  ]);

  if (/(telegram|bot)/.test(value)) vars.add("TELEGRAM_BOT_TOKEN=");
  if (/(openai|gpt|chatgpt|ai)/.test(value)) vars.add("OPENAI_API_KEY=");
  if (/(github)/.test(value)) vars.add("GITHUB_TOKEN=");
  if (/(vercel|deploy|hosting)/.test(value)) vars.add("VERCEL_TOKEN=");
  if (/(database|postgres|supabase|mongodb|redis)/.test(value)) vars.add("DATABASE_URL=");
  if (/(stripe|payment)/.test(value)) vars.add("STRIPE_SECRET_KEY=");
  if (/(sendgrid|email)/.test(value)) vars.add("SMTP_HOST=");

  return [...vars];
}

function inferDeploymentPlatform(prompt) {
  const value = String(prompt || "").toLowerCase();

  if (/(vercel|render|railway|fly.io|flyio|docker)/.test(value)) {
    return /vercel/.test(value) ? "vercel" : /render/.test(value) ? "render" : /railway/.test(value) ? "railway" : /fly/.test(value) ? "fly.io" : "docker";
  }

  return "docker";
}

function inferProjectDescription(prompt) {
  const value = String(prompt || "").trim();
  return value || "Created by Telegram project builder.";
}

function buildDockerfile(spec) {
  return `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=${spec.port}

EXPOSE ${spec.port}

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \\
  CMD node -e "fetch('http://localhost:${spec.port}/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))" || exit 1

CMD ["npm", "start"]
`;
}

function buildDockerCompose(spec) {
  return `version: "3.9"
services:
  ${spec.projectName}:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ${spec.projectName}
    ports:
      - "${spec.port}:${spec.port}"
    env_file:
      - .env
    environment:
      PORT: ${spec.port}
      NODE_ENV: production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:${spec.port}/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 20s
`;
}

function buildEnvExample(spec) {
  const lines = [
    "# Auto-generated environment variables",
    `PORT=${spec.port}`,
    "NODE_ENV=development",
    ...spec.envVars,
    "",
    "# Add any other secrets from your provider here.",
  ];

  return `${lines.join("\n")}\n`;
}

function buildServer(spec) {
  return `const express = require("express");
const app = express();
const port = Number(process.env.PORT || ${spec.port});

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "${spec.projectName}",
    status: "healthy",
    port,
    stack: "${spec.stack}",
  });
});

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "${spec.projectName}",
    status: "running",
    description: "${spec.description.replace(/"/g, '\\"')}",
    deployment: "${spec.deploymentPlatform}",
  });
});

app.post("/webhook", (req, res) => {
  const payload = req.body || {};
  res.status(200).json({ ok: true, received: payload, service: "${spec.projectName}" });
});

app.listen(port, () => {
  console.log(\`\\${process.env.npm_package_name || "${spec.projectName}"} listening on port \\${port}\`);
});
`;
}

function buildPackageJson(spec) {
  return JSON.stringify({
    name: spec.projectName,
    version: "1.0.0",
    private: true,
    description: spec.description,
    main: "server.js",
    scripts: {
      dev: 'node --watch server.js',
      start: 'node server.js',
      health: 'node -e "fetch(\'http://localhost:${spec.port}/health\').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"',
      docker: 'docker build -t ${spec.projectName} .',
      "docker:up": 'docker compose up --build -d',
    },
    dependencies: {
      express: "^4.19.2",
    },
  }, null, 2) + "\n";
}

function buildReadme(spec) {
  return `# ${spec.projectName}

${spec.description}

## Stack

- Type: ${spec.stack}
- Deployment target: ${spec.deploymentPlatform}
- Port: ${spec.port}

## Quick start

1. Copy \`.env.example\` to \`.env\`
2. Fill in the environment variables required for your app
3. Install dependencies
4. Start the server

\`\`\`bash
npm install
cp .env.example .env
npm run dev
\`\`\`

## Docker

\`\`\`bash
docker compose up --build -d
\`\`\`

Then check health:

\`\`\`bash
curl http://localhost:${spec.port}/health
\`\`\`

## Required environment variables

\`\`\`bash
${spec.envVars.join("\n")}
\`\`\`

## Deployment notes

This app is designed to be auto-generated from a Telegram prompt. Provide the necessary service keys and the generated project can be deployed with Docker or another target platform.
`;
}

function buildProjectArtifacts(prompt, overrides = {}) {
  const spec = {
    projectName: overrides.projectName || extractProjectName(prompt),
    repoName: slugify(overrides.repoName || overrides.projectName || extractProjectName(prompt)),
    stack: overrides.stack || inferProjectType(prompt),
    deploymentPlatform: overrides.deploymentPlatform || inferDeploymentPlatform(prompt),
    port: Number(overrides.port || 3000),
    description: overrides.description || inferProjectDescription(prompt),
    envVars: overrides.envVars || inferEnvVars(prompt),
  };

  const files = {
    "Dockerfile": buildDockerfile(spec),
    "docker-compose.yml": buildDockerCompose(spec),
    ".env.example": buildEnvExample(spec),
    "README.md": buildReadme(spec),
  };

  if (spec.stack === "node-express") {
    files["package.json"] = buildPackageJson(spec);
    files["server.js"] = buildServer(spec);
  }

  if (spec.stack === "python-fastapi") {
    files["requirements.txt"] = "fastapi==0.115.0\nuvicorn==0.30.6\n";
    files["main.py"] = `from fastapi import FastAPI\n\napp = FastAPI(title="${spec.projectName}")\n\n@app.get("/health")\ndef health():\n    return {"ok": True, "service": "${spec.projectName}", "status": "healthy"}\n\n@app.get("/")\ndef root():\n    return {"ok": True, "service": "${spec.projectName}", "description": "${spec.description}"}\n`;
  }

  return {
    spec,
    files,
    deploymentPlan: {
      status: "ready_for_deployment",
      platform: spec.deploymentPlatform,
      steps: [
        "1. Copy .env.example to .env and fill all required keys.",
        "2. Build the container using docker compose up --build -d.",
        "3. Verify the service on /health and confirm it is responding.",
        "4. If the target platform is Vercel/Render/Railway, connect repo and set the same env values there.",
      ],
    },
  };
}

async function writeProjectArtifactsToRepo({ owner, repo, branch = "main", prompt, projectName, repoName, deploymentPlatform }) {
  const octokit = createOctokit();
  const artifacts = buildProjectArtifacts(prompt, { projectName, repoName, deploymentPlatform });

  for (const [filePath, content] of Object.entries(artifacts.files)) {
    await githubTools.upsertFile({
      octokit,
      owner,
      repo,
      path: filePath,
      content,
      branch,
      message: `chore: scaffold ${filePath}`,
    });
  }

  return artifacts;
}

module.exports = {
  buildProjectArtifacts,
  writeProjectArtifactsToRepo,
  inferProjectType,
  inferEnvVars,
  inferDeploymentPlatform,
  extractProjectName,
  slugify,
};

