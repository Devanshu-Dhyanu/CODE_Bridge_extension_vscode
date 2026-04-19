# Publishing the Extension

## Prerequisites

- Microsoft account
- Azure DevOps organization
- Marketplace publisher
- Personal Access Token for `vsce`

Official guide:
https://code.visualstudio.com/api/working-with-extensions/publishing-extension

## Package locally

```bash
cd extension
npm install
npm run build
npm run test
npm run package
```

## Publish

```bash
cd extension
npx @vscode/vsce login <your-publisher>
npx @vscode/vsce publish
```

Update the `publisher` field in `extension/package.json` before publishing under your own account.
