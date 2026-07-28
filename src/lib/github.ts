export class GitHubError extends Error {
  constructor(public message: string, public status?: number) {
    super(message);
    this.name = 'GitHubError';
  }
}

async function fetchGitHub(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('github_token');
  if (!token) throw new GitHubError('No GitHub token found. Please sign in with GitHub.', 401);

  const res = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('github_token');
      throw new GitHubError('GitHub session expired. Please sign in again.', 401);
    }
    const rateLimit = res.headers.get('X-RateLimit-Remaining');
    if (rateLimit === '0') {
      const reset = res.headers.get('X-RateLimit-Reset');
      const time = reset ? new Date(parseInt(reset) * 1000).toLocaleTimeString() : 'later';
      throw new GitHubError(`GitHub API rate limit exceeded. Try again at ${time}.`, 403);
    }
    let errorMsg = 'GitHub API Error';
    try {
      const data = await res.json();
      errorMsg = data.message || errorMsg;
    } catch (e) {}
    throw new GitHubError(errorMsg, res.status);
  }
  return res.json();
}

export async function getUserRepos() {
  return fetchGitHub('/user/repos?sort=updated&per_page=100');
}

export async function getRepoTree(owner: string, repo: string, branch: string) {
  return fetchGitHub(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
}

export async function getFileContent(owner: string, repo: string, path: string) {
  const data = await fetchGitHub(`/repos/${owner}/${repo}/contents/${path}`);
  if (data.content && data.encoding === 'base64') {
    return decodeURIComponent(escape(atob(data.content)));
  }
  return '';
}

export async function getDefaultBranch(owner: string, repo: string) {
  const data = await fetchGitHub(`/repos/${owner}/${repo}`);
  return data.default_branch;
}

export async function getLatestCommit(owner: string, repo: string, branch: string) {
  const data = await fetchGitHub(`/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  return data.object.sha;
}

export async function getCommitTree(owner: string, repo: string, commitSha: string) {
  const data = await fetchGitHub(`/repos/${owner}/${repo}/git/commits/${commitSha}`);
  return data.tree.sha;
}

export async function createBlob(owner: string, repo: string, content: string) {
  const data = await fetchGitHub(`/repos/${owner}/${repo}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({
      content: btoa(unescape(encodeURIComponent(content))),
      encoding: 'base64'
    })
  });
  return data.sha;
}

export async function createTree(owner: string, repo: string, baseTreeSha: string, tree: any[]) {
  const data = await fetchGitHub(`/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree
    })
  });
  return data.sha;
}

export async function createCommit(owner: string, repo: string, message: string, treeSha: string, parentSha: string) {
  const data = await fetchGitHub(`/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: treeSha,
      parents: [parentSha]
    })
  });
  return data.sha;
}

export async function updateRef(owner: string, repo: string, branch: string, commitSha: string) {
  return fetchGitHub(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({
      sha: commitSha,
      force: false
    })
  });
}
