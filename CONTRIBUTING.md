# Development

Use Node.js 22.14 or newer and VS Code 1.100 or newer. With nvm, run `nvm use` before installing dependencies.

```sh
npm ci
npm run check
```

The check command runs type checking, ESLint, Jest regression tests, and a production webpack build. The extension targets the Node.js 20 APIs available in the minimum supported VS Code version; the newer Node requirement applies to development tools.

Press F5 in VS Code to compile and launch an Extension Development Host. Use `npm run dev` for webpack watch mode and `npm test` to run the tests independently.

```sh
npm run package
```

Packaging creates a local VSIX using the project's own packaging tool. Install it with VS Code's **Extensions: Install from VSIX** command. Marketplace publishing is a separate action.

Keep fixes and features on `bugfix/` and `feature/` branches, with focused commits and regression coverage for behavior changes. Push branches and open pull requests in [this fork](https://github.com/luckyshot/vscode-sftp-xavi).

Check existing issues before opening a new report, describe reproducible steps, and document new features. Pull request titles should describe the resulting behavior; include the checks you ran in the description.
