const { Octokit } = require("@octokit/rest");
const { ready, crypto_box_seal, from_base64 } = require("libsodium-wrappers");

function createOctokit() {
  const token = process.env.GITHUB_ACCESS_TOKEN || process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_ACCESS_TOKEN. Add it to your environment variables.");
  }

  return new Octokit({ auth: token });
}

async function createRepository({ octokit, name, description = "Created by Telegram AI Agent Crew", visibility = "private" }) {
  const response = await octokit.rest.repos.createForAuthenticatedUser({
    name,
    description,
    private: visibility === "private",
    auto_init: true,
    visibility,
  });

  return response.data;
}

async function createBranch({ octokit, owner, repo, branchName, baseBranch = "main" }) {
  const repoInfo = await octokit.rest.repos.get({ owner, repo });
  const defaultBranch = repoInfo.data.default_branch || baseBranch;

  const baseRef = await octokit.rest.git.getRef({ owner, repo, ref: `heads/${defaultBranch}` });

  const response = await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: baseRef.data.object.sha,
  });

  return response.data;
}

async function upsertFile({ octokit, owner, repo, path, content, branch = "main", message = "chore: update file" }) {
  const existing = await octokit.rest.repos.getContent({ owner, repo, path, ref: branch }).catch(() => null);

  const params = {
    owner,
    repo,
    path,
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch,
  };

  if (existing && existing.data && !Array.isArray(existing.data)) {
    params.sha = existing.data.sha;
  }

  const response = await octokit.rest.repos.createOrUpdateFileContents(params);
  return response.data;
}

async function setRepoSecret({ octokit, owner, repo, secretName, secretValue }) {
  await ready;

  const keyData = await octokit.rest.actions.getRepoPublicKey({ owner, repo });
  const publicKey = keyData.data.key;
  const keyId = keyData.data.key_id;

  const encryptedBytes = crypto_box_seal(Buffer.from(secretValue, "utf8"), from_base64(publicKey));
  const encryptedValue = Buffer.from(encryptedBytes).toString("base64");

  const response = await octokit.rest.actions.createOrUpdateRepoSecret({
    owner,
    repo,
    secret_name: secretName,
    encrypted_value: encryptedValue,
    key_id: keyId,
  });

  return response.data;
}

const githubTools = {
  createRepository,
  createBranch,
  upsertFile,
  setRepoSecret,
};

module.exports = {
  createOctokit,
  githubTools,
};

