"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubService = void 0;
const https = require("https");
const REPO_NAME = 'antigravity-sync-data';
class GitHubService {
    constructor() { }
    setToken(token) {
        this.token = token;
    }
    async request(method, path, body) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.github.com',
                path: path,
                method: method,
                headers: {
                    'User-Agent': 'Antigravity-Sync-Extension',
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                }
            };
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(data));
                        }
                        catch (e) {
                            resolve(data); // Handle non-JSON responses if any
                        }
                    }
                    else {
                        reject(new Error(`GitHub API Error: ${res.statusCode} ${data}`));
                    }
                });
            });
            req.on('error', (e) => reject(e));
            if (body) {
                req.write(JSON.stringify(body));
            }
            req.end();
        });
    }
    async getAuthenticatedUser() {
        return this.request('GET', '/user');
    }
    async ensureRepoExists() {
        try {
            const user = await this.getAuthenticatedUser();
            await this.request('GET', `/repos/${user.login}/${REPO_NAME}`);
            // console.log('Repo exists');
        }
        catch (e) {
            if (e.message && e.message.includes('404')) {
                // Create repo
                //  console.log('Creating repo...');
                await this.request('POST', '/user/repos', {
                    name: REPO_NAME,
                    private: true,
                    description: 'Storage for Antigravity Sync Extension'
                });
            }
            else {
                throw e;
            }
        }
    }
    async uploadFiles(files, message = 'Update settings') {
        const user = await this.getAuthenticatedUser();
        // For simplicity in this v1, we'll uploading files one by one or using tree API. 
        // Using the Tree API is better for batching.
        // 1. Get current commit SHA of main branch
        let ref;
        try {
            ref = await this.request('GET', `/repos/${user.login}/${REPO_NAME}/git/ref/heads/main`);
        }
        catch (e) {
            // If branch doesn't exist (empty repo), we might need to create it with a dummy commit or handle differently.
            // For now assume initialized or handle initial commit.
            // If completely empty, we need to create a commit first.
            // Simplified: Put a file directly if specific flow is hard.
            // Let's rely on standard flow:
            // If 409 (conflict) or 404, we might need to init.
            // Simplest: Create a README if it doesn't exist?
        }
        const baseTree = ref ? ref.object.sha : undefined;
        // 2. Create a Tree
        const treeItems = files.map(file => ({
            path: file.path,
            mode: '100644',
            type: 'blob',
            content: file.content
        }));
        const tree = await this.request('POST', `/repos/${user.login}/${REPO_NAME}/git/trees`, {
            base_tree: baseTree,
            tree: treeItems
        });
        // 3. Create a commit
        const commit = await this.request('POST', `/repos/${user.login}/${REPO_NAME}/git/commits`, {
            message: message,
            tree: tree.sha,
            parents: baseTree ? [baseTree] : []
        });
        // 4. Update the reference
        await this.request('PATCH', `/repos/${user.login}/${REPO_NAME}/git/refs/heads/main`, {
            sha: commit.sha,
            force: true
        });
    }
    async downloadFiles() {
        const user = await this.getAuthenticatedUser();
        // Get the tree recursively
        try {
            const ref = await this.request('GET', `/repos/${user.login}/${REPO_NAME}/git/ref/heads/main`);
            const treeSha = ref.object.sha;
            const tree = await this.request('GET', `/repos/${user.login}/${REPO_NAME}/git/trees/${treeSha}?recursive=1`);
            const files = [];
            for (const item of tree.tree) {
                if (item.type === 'blob') {
                    // Fetch blob content
                    const blob = await this.request('GET', item.url); // url is blob url
                    // blob content is base64 encoded
                    const content = Buffer.from(blob.content, 'base64').toString('utf-8');
                    files.push({
                        path: item.path,
                        content: content
                    });
                }
            }
            return files;
        }
        catch (e) {
            // If repo empty or branch missing
            return [];
        }
    }
}
exports.GitHubService = GitHubService;
//# sourceMappingURL=githubService.js.map