import * as vscode from 'vscode';
import { AuthService } from './auth';
import { SyncService } from './syncService';
import { GitHubService } from './githubService';

let syncService: SyncService;
let authService: AuthService;
let githubService: GitHubService;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Antigravity Sync is now active!');

    authService = new AuthService();
    await authService.initialize();

    // We can't immediately get the token here if not logged in, but GitHubService will handle auth errors or we force login on first sync.
    // For simplicity, we assume token is available or will be requested.
    // Ideally we should wait for login or have a prompt.
    // We'll lazy load the token in GitHubService or SyncService.
    githubService = new GitHubService();
    syncService = new SyncService(authService, githubService);

    // Commands
    let uploadDisposable = vscode.commands.registerCommand('antigravity-sync.upload', async () => {
        await syncService.upload();
    });

    let downloadDisposable = vscode.commands.registerCommand('antigravity-sync.download', async () => {
        await syncService.download();
    });

    context.subscriptions.push(uploadDisposable);
    context.subscriptions.push(downloadDisposable);

    // Auto-Sync Download on Startup
    const config = vscode.workspace.getConfiguration('antigravity.sync');
    if (config.get('autoDownload')) {
        vscode.window.setStatusBarMessage('Antigravity Sync: Checking for remote updates...', 3000);
        await syncService.download();
    }

    // Auto-Sync Upload on Change
    if (config.get('autoUpload')) {
        // Watch for settings changes
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async (e) => {
             if (e.affectsConfiguration('antigravity.sync')) return; // Ignore our own config changes
             // Debounce this in a real app
             console.log('Settings changed, uploading...');
             await syncService.upload();
        }));

        // Watch for extension changes
        context.subscriptions.push(vscode.extensions.onDidChange(async () => {
             console.log('Extensions changed, uploading...');
             await syncService.upload();
        }));
    }
}

export function deactivate() {}
