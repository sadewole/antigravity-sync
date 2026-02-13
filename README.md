# Antigravity Sync

**Sync your VS Code settings, extensions, and Antigravity data across devices using GitHub.**

Antigravity Sync is a lightweight, secure extension designed to keep your development environment consistent, no matter where you work. It leverages a private GitHub repository to store your configuration, ensuring your data remains yours.

## Features

-   **🔄 Complete Sync**: Synchronizes your:
    -   VS Code Settings (`settings.json`)
    -   Keybindings (`keybindings.json`)
    -   User Snippets
    -   Tasks (`tasks.json`)
    -   UI State (`globalStorage/storage.json`)
    -   Installed Extensions list
    -   **Antigravity Data**: Syncs your history, configuration, and artifacts (`.gemini/antigravity`).
-   **🔒 Private & Secure**: Creates a private repository (`antigravity-sync-data`) on your GitHub account. No third-party servers.
-   **⚡ Auto-Sync**: Automatically uploads changes when you modify settings or install extensions.
-   **🚀 Seamless Setup**: Just login with GitHub, and the extension handles the rest.

## Getting Started

1.  Input `Antigravity Sync: Upload Settings` in the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).
2.  Follow the prompt to **Sign in with GitHub**.
3.  Grant the required permissions (to create/read the private repo).
4.  That's it! Your settings are now safe in the cloud.

To restore on a new device:
1.  Install Antigravity Sync.
2.  Run `Antigravity Sync: Download Settings`.

## Extension Settings

This extension contributes the following settings:

*   `antigravity.sync.autoUpload`: Automatically upload settings when they change. (Default: `true`)
*   `antigravity.sync.autoDownload`: Automatically check for and download updates on startup. (Default: `false`)

## Requirements

*   A GitHub account.

## Known Issues

*   First-time sync might take a few moments depending on the size of your Antigravity history.

## privacy

We value your privacy. Your data is stored exclusively in your own private GitHub repository. This extension does not transmit any data to any other servers.

---

**Enjoying Antigravity Sync?** [Rate it on the Marketplace](https://marketplace.visualstudio.com/items?itemName=samador.antigravity-sync) or [Star the repo](https://github.com/sadewole/antigravity-sync).
