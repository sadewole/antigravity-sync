import * as vscode from 'vscode';

const GITHUB_AUTH_PROVIDER_ID = 'github';
// Scopes: 'repo' is needed to read/write private repositories.
const SCOPES = ['repo', 'user:email'];

export class AuthService {
    private session: vscode.AuthenticationSession | undefined;

    public async initialize(): Promise<void> {
        this.session = await vscode.authentication.getSession(GITHUB_AUTH_PROVIDER_ID, SCOPES, { createIfNone: false });
    }

    public async login(): Promise<string | undefined> {
        try {
            this.session = await vscode.authentication.getSession(GITHUB_AUTH_PROVIDER_ID, SCOPES, { createIfNone: true });
            return this.session.accessToken;
        } catch (e) {
            vscode.window.showErrorMessage(`Antigravity Sync Login Failed: ${e}`);
            return undefined;
        }
    }

    public async getToken(): Promise<string | undefined> {
        if (!this.session) {
            await this.initialize();
        }
        return this.session?.accessToken;
    }

    public isAuthenticated(): boolean {
        return !!this.session;
    }

    public getUserName(): string | undefined {
        return this.session?.account.label;
    }
    public async logout(): Promise<void> {
        this.session = undefined;
        // In a real scenario, we might want to tell VS Code to sign out, but that's complex.
        // Forcing a new session with createIfNone: true usually triggers a prompt if the token s bad.
    }
}
