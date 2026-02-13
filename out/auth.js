"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const vscode = require("vscode");
const GITHUB_AUTH_PROVIDER_ID = 'github';
// Scopes: 'repo' is needed to read/write private repositories.
const SCOPES = ['repo', 'user:email'];
class AuthService {
    async initialize() {
        this.session = await vscode.authentication.getSession(GITHUB_AUTH_PROVIDER_ID, SCOPES, { createIfNone: false });
    }
    async login() {
        try {
            this.session = await vscode.authentication.getSession(GITHUB_AUTH_PROVIDER_ID, SCOPES, { createIfNone: true });
            return this.session.accessToken;
        }
        catch (e) {
            vscode.window.showErrorMessage(`Antigravity Sync Login Failed: ${e}`);
            return undefined;
        }
    }
    async getToken() {
        if (!this.session) {
            await this.initialize();
        }
        return this.session?.accessToken;
    }
    isAuthenticated() {
        return !!this.session;
    }
    getUserName() {
        return this.session?.account.label;
    }
    async logout() {
        this.session = undefined;
        // In a real scenario, we might want to tell VS Code to sign out, but that's complex.
        // Forcing a new session with createIfNone: true usually triggers a prompt if the token s bad.
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.js.map