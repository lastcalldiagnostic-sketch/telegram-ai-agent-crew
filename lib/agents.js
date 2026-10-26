const { ChatGroq } = require("@langchain/groq");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { MessagesAnnotation, StateGraph, END } = require("@langchain/langgraph");
const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { createOctokit, githubTools } = require("./github-tools");

const tools = [
  tool(
    async ({ name, description, visibility = "private" }) => {
      const octokit = createOctokit();
      const result = await githubTools.createRepository({
        octokit,
        name,
        description,
        visibility,
      });
      return JSON.stringify(result, null, 2);
    },
    {
      name: "create_github_repo",
      description: "Create a new GitHub repository for the project or environment.",
      schema: z.object({
        name: z.string().describe("Repository name."),
        description: z.string().optional().describe("Repository description."),
        visibility: z.enum(["private", "public"]).default("private").describe("Repository visibility."),
      }),
    }
  ),

  tool(
    async ({ owner, repo, branchName, baseBranch = "main" }) => {
      const octokit = createOctokit();
      const result = await githubTools.createBranch({ octokit, owner, repo, branchName, baseBranch });
      return JSON.stringify(result, null, 2);
    },
    {
      name: "create_github_branch",
      description: "Create a Git branch in an existing GitHub repository.",
      schema: z.object({
        owner: z.string().describe("GitHub repository owner."),
        repo: z.string().describe("GitHub repository name."),
        branchName: z.string().describe("New branch name."),
        baseBranch: z.string().default("main").describe("Base branch to branch from."),
      }),
    }
  ),

  tool(
    async ({ owner, repo, path, content, branch, message }) => {
      const octokit = createOctokit();
      const result = await githubTools.upsertFile({
        octokit,
        owner,
        repo,
        path,
        content,
        branch,
        message,
      });
      return JSON.stringify(result, null, 2);
    },
    {
      name: "upsert_github_file",
      description: "Create or update a file in a GitHub repository and commit it to a branch.",
      schema: z.object({
        owner: z.string().describe("GitHub repository owner."),
        repo: z.string().describe("GitHub repository name."),
        path: z.string().describe("Path to the file inside the repository."),
        content: z.string().describe("File content in UTF-8 text."),
        branch: z.string().default("main").describe("Target branch."),
        message: z.string().default("chore: update file").describe("Commit message."),
      }),
    }
  ),

  tool(
    async ({ owner, repo, secretName, secretValue }) => {
      const octokit = createOctokit();
      const result = await githubTools.setRepoSecret({ octokit, owner, repo, secretName, secretValue });
      return JSON.stringify(result, null, 2);
    },
    {
      name: "set_github_repo_secret",
      description: "Create or update a repository secret for CI/CD or deployment automation.",
      schema: z.object({
        owner: z.string().describe("GitHub repository owner."),
        repo: z.string().describe("GitHub repository name."),
        secretName: z.string().describe("Name of the repository secret."),
        secretValue: z.string().describe("Value to store in the secret."),
      }),
    }
  ),
];

function getModel() {
  if (process.env.GROQ_API_KEY) {
    return new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama-3.1-8b-instant",
      temperature: 0.2,
    });
  }

  if (process.env.GEMINI_API_KEY) {
    return new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      model: "gemini-1.5-flash",
      temperature: 0.2,
    });
  }

  throw new Error("Missing AI provider configuration. Add GROQ_API_KEY or GEMINI_API_KEY.");
}

function buildWorkflow() {
  const model = getModel().bindTools(tools);

  const workflow = new StateGraph({
    channels: {
      messages: MessagesAnnotation,
      status: { value: (x, y) => y ?? x, default: () => "pending" },
    },
  });

  workflow.addNode("brain_agent", async (state) => {
    const lastUserMessage = state.messages.filter((message) => message instanceof HumanMessage).at(-1)?.content || "";

    const prompt = `You are the Brain Agent for a mobile-first Telegram automation system. Your role is to plan work, call the right tools, and produce concise, actionable guidance.

Mission:
- Accept the user's request.
- Decide whether GitHub automation or a repo setup is needed.
- If a repo or environment update is needed, use the GitHub toolset.
- Keep the final response short, mobile-friendly, and action-oriented.

User request:
${lastUserMessage}`;

    const response = await model.invoke([
      new HumanMessage(prompt),
    ]);

    return { messages: [...state.messages, response], status: "reasoned" };
  });

  workflow.addNode("infra_agent", async (state) => {
    const lastMessage = state.messages.at(-1);

    if (!lastMessage || !lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
      const final = new AIMessage({
        content: "I analyzed the request and no external automation was required in this pass. I can help create repos, files, branches, or deployment steps next.",
      });
      return { messages: [...state.messages, final], status: "complete" };
    }

    const toolResults = [];

    for (const toolCall of lastMessage.tool_calls) {
      const match = tools.find((entry) => entry.name === toolCall.name);
      if (!match) {
        toolResults.push({ name: toolCall.name, status: "not_found" });
        continue;
      }

      const args = toolCall.args || {};
      const toolOutput = await match.invoke(args);
      toolResults.push({ name: toolCall.name, status: "ok", output: toolOutput });
    }

    const summary = new AIMessage({
      content: `Infrastructure update completed.\n${JSON.stringify(toolResults, null, 2)}`,
    });

    return { messages: [...state.messages, summary], status: "complete" };
  });

  workflow.setEntryPoint("brain_agent");
  workflow.addEdge("brain_agent", "infra_agent");
  workflow.addEdge("infra_agent", END);

  return workflow.compile();
}

async function initAgentSystem(userMessage) {
  const workflow = buildWorkflow();

  const result = await workflow.invoke({
    messages: [new HumanMessage(userMessage)],
  });

  const finalMessage = result.messages.at(-1);
  const content = typeof finalMessage?.content === "string" ? finalMessage.content : JSON.stringify(finalMessage?.content ?? {}, null, 2);

  return content;
}

module.exports = {
  initAgentSystem,
  buildWorkflow,
  getModel,
  tools,
};
