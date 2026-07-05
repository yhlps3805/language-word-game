const fs = require("fs");

const token = process.env.GITHUB_TOKEN;
const htmlPath = "C:/Users/yhlps/OneDrive/文件/遊戲網頁製作/index.html";
const repoName = "language-word-game";

if (!token) {
  console.error("Missing GITHUB_TOKEN");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28"
};

async function api(method, path, body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      ...headers,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message = data && data.message ? data.message : text;
    const error = new Error(`${method} ${path} failed: ${response.status} ${message}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function main() {
  const user = await api("GET", "/user");
  const owner = user.login;
  let repo;
  let created = false;

  try {
    repo = await api("GET", `/repos/${owner}/${repoName}`);
  } catch (error) {
    if (error.status !== 404) throw error;
    repo = await api("POST", "/user/repos", {
      name: repoName,
      description: "神秘單字翻牌遊戲",
      private: false,
      auto_init: false,
      has_issues: false,
      has_projects: false,
      has_wiki: false
    });
    created = true;
  }

  const branch = repo.default_branch || "main";
  let sha;

  try {
    const existing = await api(
      "GET",
      `/repos/${owner}/${repoName}/contents/index.html?ref=${encodeURIComponent(branch)}`
    );
    sha = existing.sha;
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  const content = fs.readFileSync(htmlPath).toString("base64");
  const putBody = {
    message: created ? "Add language word game" : "Update language word game",
    content,
    branch
  };

  if (sha) {
    putBody.sha = sha;
  }

  await api("PUT", `/repos/${owner}/${repoName}/contents/index.html`, putBody);

  let pages;
  let pagesAction = "enabled";

  try {
    pages = await api("GET", `/repos/${owner}/${repoName}/pages`);
    pagesAction = "already enabled";
    try {
      pages = await api("PUT", `/repos/${owner}/${repoName}/pages`, {
        source: { branch, path: "/" }
      });
    } catch {
      // The source is already configured, or GitHub does not need an update.
    }
  } catch (error) {
    if (error.status !== 404) throw error;
    pages = await api("POST", `/repos/${owner}/${repoName}/pages`, {
      source: { branch, path: "/" }
    });
  }

  const repoUrl = `https://github.com/${owner}/${repoName}`;
  const pagesUrl = (pages && pages.html_url) || `https://${owner}.github.io/${repoName}/`;

  console.log(JSON.stringify({
    owner,
    repo: repoName,
    created,
    branch,
    pagesAction,
    repoUrl,
    pagesUrl
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  if (error.data) {
    console.error(JSON.stringify(error.data, null, 2));
  }
  process.exit(1);
});
