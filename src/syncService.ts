import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AuthService } from './auth';
import { GitHubService } from './githubService';

export class SyncService {
    constructor(
        private authService: AuthService,
        private githubService: GitHubService
    ) {}

    private getAntigravityPath(): string {
        const home = process.env.HOME || process.env.USERPROFILE || '';
        return path.join(home, '.gemini', 'antigravity');
    }

    private getVSCodeUserSettingsPath(): string {
         // This is OS specific, simplifying for Mac (User's OS) for now, but should be generic.
         // Mac: ~/Library/Application Support/Code/User
         const home = process.env.HOME || '';
         return path.join(home, 'Library', 'Application Support', 'Code', 'User');
    }

    private async collectFiles(dir: string, base: string = ''): Promise<{path: string, content: string}[]> {
        let results: {path: string, content: string}[] = [];
        if (!fs.existsSync(dir)) return results;

        const list = fs.readdirSync(dir);
        for (const file of list) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            const relativePath = path.join(base, file);

            if (stat && stat.isDirectory()) {
                // Skip some folders like 'node_modules', '.git'
                if (file === 'node_modules' || file === '.git' || file === 'workspaceStorage') continue;
                results = results.concat(await this.collectFiles(filePath, relativePath));
            } else {
                // Read file content
                try {
                     const content = fs.readFileSync(filePath, 'utf-8');
                     results.push({ path: relativePath, content });
                } catch (e) {
                    console.error(`Failed to read file ${filePath}: ${e}`);
                }
            }
        }
        return results;
    }

    public async upload(): Promise<void> {
        const token = await this.authService.getToken() || await this.authService.login();
        if (!token) {
            vscode.window.showErrorMessage('Antigravity Sync: Not logged in to GitHub.');
            return;
        }
        this.githubService.setToken(token);
        
        const filesToUpload: {path: string, content: string}[] = [];

        // 1. VS Code Settings
        const vscodePath = this.getVSCodeUserSettingsPath();
        const vscodeSettings = ['settings.json', 'keybindings.json', 'snippets/'];
        
        for (const item of vscodeSettings) {
             const fullPath = path.join(vscodePath, item);
             if (fs.existsSync(fullPath)) {
                 if (fs.statSync(fullPath).isDirectory()) {
                     const snippets = await this.collectFiles(fullPath, `vscode/${item}`);
                     filesToUpload.push(...snippets);
                 } else {
                     filesToUpload.push({
                         path: `vscode/${item}`,
                         content: fs.readFileSync(fullPath, 'utf-8')
                     });
                 }
             }
        }

        // 2. Extensions List
        const extensions = vscode.extensions.all
            .filter(e => !e.packageJSON.isBuiltin)
            .map(e => e.id);
        filesToUpload.push({
            path: 'vscode/extensions.json',
            content: JSON.stringify(extensions, null, 2)
        });

        // 3. Antigravity Data
        const agPath = this.getAntigravityPath();
        if (fs.existsSync(agPath)) {
            // Collecting specific directories to avoid syncing too much junk
            const agDirs = ['brain', 'conversations', 'mcp_config.json']; // mcp_config is file
            for (const item of agDirs) {
                const fullPath = path.join(agPath, item);
                 if (fs.existsSync(fullPath)) {
                     if (fs.statSync(fullPath).isDirectory()) {
                         const agFiles = await this.collectFiles(fullPath, `antigravity/${item}`);
                         filesToUpload.push(...agFiles);
                     } else {
                         filesToUpload.push({
                             path: `antigravity/${item}`,
                             content: fs.readFileSync(fullPath, 'utf-8')
                         });
                    }
                 }
            }
        }

        await this.githubService.ensureRepoExists();
        await this.githubService.uploadFiles(filesToUpload, `Sync: ${new Date().toISOString()}`);
        vscode.window.showInformationMessage('Antigravity Sync: Upload Complete');
    }

    public async download(): Promise<void> {
        const token = await this.authService.getToken() || await this.authService.login();
        if (!token) {
             vscode.window.showErrorMessage('Antigravity Sync: Not logged in to GitHub.');
             return;
        }
        this.githubService.setToken(token);

        const files = await this.githubService.downloadFiles();
        if (files.length === 0) {
            vscode.window.showInformationMessage('Antigravity Sync: No remote settings found.');
            return;
        }

        const vscodePath = this.getVSCodeUserSettingsPath();
        const agPath = this.getAntigravityPath();

        for (const file of files) {
            let targetPath = '';
            if (file.path.startsWith('vscode/')) {
                if (file.path === 'vscode/extensions.json') {
                    // Handle extensions installation
                    const remoteExtensions: string[] = JSON.parse(file.content);
                    const currentExtensions = vscode.extensions.all.map(e => e.id);
                    const missing = remoteExtensions.filter(id => !currentExtensions.includes(id));
                    
                    if (missing.length > 0) {
                        vscode.window.showInformationMessage(`Installing ${missing.length} missing extensions...`);
                        for (const extId of missing) {
                            // Execute command to install
                            await vscode.commands.executeCommand('workbench.extensions.installExtension', extId);
                        }
                    }
                    continue; 
                }
                targetPath = path.join(vscodePath, file.path.replace('vscode/', ''));
            } else if (file.path.startsWith('antigravity/')) {
                targetPath = path.join(agPath, file.path.replace('antigravity/', ''));
            }

            if (targetPath) {
                const dir = path.dirname(targetPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(targetPath, file.content, 'utf-8');
            }
        }
        vscode.window.showInformationMessage('Antigravity Sync: Download Complete. Please restart VS Code to apply all changes.');
    }
}
