const fs = require('fs');
let content = fs.readFileSync('README.md', 'utf8');

const githubSection = `
### Advanced GitHub Syncing
* **Real API Integration**: Authenticate with your GitHub account to sync repos securely using your OAuth tokens.
* **Clone & Edit**: Instantly load up to 30 files from any repository tree directly into your VantaOS workspace.
* **Visual Diffing & Commit**: Seamlessly review file changes side-by-side using the Diff tool before staging your commits and pushing back to the remote.
`;

if (!content.includes('Advanced GitHub Syncing')) {
    content = content.replace('## Core Capabilities', '## Core Capabilities' + githubSection);
    fs.writeFileSync('README.md', content);
}
