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
                    description: 'Storage for Antigravity Sync Extension',
                    auto_init: true // Initialize with README to avoid empty repo issues
                });
            }
            else {
                throw e;
            }
        }
    }
    async uploadFiles(files, message = 'Update settings') {
        const user = await this.getAuthenticatedUser();
        // 1. Get current commit SHA of main branch
        let ref;
        try {
            ref = await this.request('GET', `/repos/${user.login}/${REPO_NAME}/git/ref/heads/main`);
        }
        catch (e) {
            // Branch doesn't exist or repo is empty (409)
            // We will create a fresh commit.
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
            base_tree: baseTree, // If undefined, creates a new root tree works?, actually base_tree must be valid SHA or omitted
            tree: treeItems
        });
        // 3. Create a commit
        const commitPayload = {
            message: message,
            tree: tree.sha
        };
        if (baseTree) {
            commitPayload.parents = [baseTree]; // Actually use commit SHA not tree SHA for parents, request above gets ref object (commit)
            // Wait, ref.object.sha IS the commit SHA. 
            // BUT base_tree expects TREE sha?? No, request says:
            // "The SHA1 of an existing Git tree object which will be used as the base for the new tree."
            // ref.object.sha is a COMMIT. 
            // We need to get the tree of that commit first if we want to base off it?
            // Actually, if we pass base_tree, we merge with it.
            // If ref is a commit, we need commit.tree.sha.
        }
        // Logic correction:
        // Get ref -> Get Commit -> Get Tree SHA for base_tree
        let baseTreeSha;
        let parentCommitSha;
        if (ref) {
            parentCommitSha = ref.object.sha;
            const commitObj = await this.request('GET', `/repos/${user.login}/${REPO_NAME}/git/commits/${parentCommitSha}`);
            baseTreeSha = commitObj.tree.sha;
            commitPayload.parents = [parentCommitSha];
        }
        // Re-request tree with correct base
        let finalTree;
        try {
            finalTree = await this.request('POST', `/repos/${user.login}/${REPO_NAME}/git/trees`, {
                base_tree: baseTreeSha,
                tree: treeItems
            });
        }
        catch (e) {
            if (e.message && e.message.includes('Git Repository is empty')) {
                // Repo is empty, we must initialize it using the Contents API first
                await this.createInitialCommit(user.login);
                // After init, we need to restart the upload process to get the correct refs
                return this.uploadFiles(files, message);
            }
            throw e;
        }
        commitPayload.tree = finalTree.sha;
        const commit = await this.request('POST', `/repos/${user.login}/${REPO_NAME}/git/commits`, commitPayload);
        // 4. Update or Create the reference
        if (ref) {
            await this.request('PATCH', `/repos/${user.login}/${REPO_NAME}/git/refs/heads/main`, {
                sha: commit.sha,
                force: true
            });
        }
        else {
            // Create ref
            await this.request('POST', `/repos/${user.login}/${REPO_NAME}/git/refs`, {
                ref: 'refs/heads/main',
                sha: commit.sha
            });
        }
    }
    async createInitialCommit(owner) {
        // Create a README.md to initialize the repo
        const content = Buffer.from('# Antigravity Sync Data\n\nThis repository stores your settings.').toString('base64');
        await this.request('PUT', `/repos/${owner}/${REPO_NAME}/contents/README.md`, {
            message: 'Initial commit',
            content: content
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