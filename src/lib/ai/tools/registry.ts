/**
 * VantaOS Omni-AI - Tool Registry.
 * 230+ tools across 15 categories.
 */

export interface ToolDef {
  id: string;
  name: string;
  description: string;
  category: string;
  autoTrigger: string[];
}

type T = [id: string, name: string, desc: string, ...triggers: string[]];

function build(category: string, tools: T[]): ToolDef[] {
  return tools.map(([id, name, desc, ...triggers]) => ({
    id, name, description: desc, category, autoTrigger: triggers,
  }));
}

// workspace
const workspaceTools = build('workspace', [
  ['ws-read-file', 'Read File', 'Read content of a file in the workspace', 'read', 'open', 'view', 'show file', 'cat', 'display file'],
  ['ws-write-file', 'Write File', 'Write or overwrite content in a file', 'write', 'save', 'create file', 'new file', 'overwrite'],
  ['ws-create-folder', 'Create Folder', 'Create a new folder in the workspace', 'create folder', 'mkdir', 'new folder', 'add folder'],
  ['ws-delete-file', 'Delete File', 'Delete a file from the workspace', 'delete file', 'remove file', 'rm', 'del', 'erase file'],
  ['ws-delete-folder', 'Delete Folder', 'Delete a folder and its contents', 'delete folder', 'remove folder', 'rmdir'],
  ['ws-rename', 'Rename', 'Rename a file or folder', 'rename', 'move', 'mv', 'restage'],
  ['ws-move', 'Move', 'Move a file or folder to another location', 'move file', 'move item', 'relocate'],
  ['ws-list-files', 'List Files', 'List files in a directory', 'list', 'ls', 'dir', 'tree', 'show files', 'browse'],
  ['ws-search-files', 'Search Files', 'Search for text across workspace files', 'grep', 'search', 'find text', 'find in files', 'locate'],
  ['ws-copy-file', 'Copy File', 'Copy a file within the workspace', 'copy', 'cp', 'duplicate file'],
  ['ws-copy-folder', 'Copy Folder', 'Copy a folder and its contents', 'copy folder', 'cp -r', 'duplicate folder'],
  ['ws-zip', 'Zip', 'Compress files or folders into an archive', 'zip', 'compress', 'archive', 'pack'],
  ['ws-unzip', 'Unzip', 'Extract a zip archive into the workspace', 'unzip', 'extract', 'decompress'],
  ['ws-get-path', 'Get Path', 'Return the full path of a file or folder', 'path', 'where is', 'location of'],
  ['ws-check-exists', 'Check Exists', 'Check if a file or folder exists', 'exists', 'check if', 'is there', 'file exists'],
  ['ws-watch', 'Watch File', 'Watch a file for changes and notify', 'watch', 'monitor', 'observe file'],
  ['ws-diff', 'Diff', 'Compare two files and show differences', 'diff', 'compare', 'difference', 'change'],
  ['ws-merge', 'Merge', 'Merge two files or branches', 'merge', 'combine', 'join files'],
  ['ws-git-status', 'Git Status', 'Show git status of the workspace', 'git status', 'status', 'what changed'],
  ['ws-git-log', 'Git Log', 'Show recent git commits', 'git log', 'commits', 'history', 'recent changes'],
  ['ws-git-diff', 'Git Diff', 'Show unstaged changes', 'git diff', 'unstaged', 'what changed'],
  ['ws-git-checkout', 'Git Checkout', 'Switch branches or restore files', 'git checkout', 'switch branch', 'restore'],
  ['ws-git-commit', 'Git Commit', 'Commit staged changes with a message', 'git commit', 'save changes', 'checkpoint'],
  ['ws-git-push', 'Git Push', 'Push commits to remote', 'git push', 'upload', 'publish'],
  ['ws-git-pull', 'Git Pull', 'Pull changes from remote', 'git pull', 'fetch updates', 'sync'],
  ['ws-git-branch', 'Git Branch', 'List or create branches', 'git branch', 'new branch', 'switch'],
  ['ws-format-code', 'Format Code', 'Format source code with prettier/eslint', 'format', 'prettier', 'lint fix', 'beautify'],
  ['ws-typecheck', 'Type Check', 'Run TypeScript type checking', 'type check', 'typescript', 'tsc', 'types'],
  ['ws-run-test', 'Run Test', 'Run test suite for the workspace', 'run test', 'test', 'pytest', 'jest', 'vitest', 'npm test'],
  ['ws-get-file-info', 'File Info', 'Get file size type modification date', 'file info', 'stat', 'metadata', 'file type'],
  ['ws-list-workspace', 'List Workspace', 'Show top-level workspace structure', 'workspace', 'tree', 'project'],
  ['ws-read-binary', 'Read Binary', 'Read binary file as hex or base64', 'read binary', 'hex dump', 'base64'],
  ['ws-search-code', 'Search Code', 'Find code symbols across workspace', 'find symbol', 'search code', 'grep code', 'locate function'],
  ['ws-get-directory-tree', 'Directory Tree', 'Show full directory tree', 'tree', 'directory', 'folder structure'],
  ['ws-validate', 'Validate', 'Validate file syntax or structure', 'validate', 'check syntax', 'lint', 'verify'],
  ['ws-open-url', 'Open URL', 'Open a URL in the browser', 'open url', 'browser', 'visit', 'go to'],
  ['ws-export', 'Export', 'Export workspace content to a format', 'export', 'download', 'output'],
  ['ws-import', 'Import', 'Import content into workspace', 'import', 'upload', 'ingest'],
  ['ws-snapshot', 'Snapshot', 'Take a snapshot of workspace state', 'snapshot', 'backup', 'save state'],
  ['ws-restore', 'Restore', 'Restore workspace from snapshot', 'restore', 'recover', 'undo'],
  ['ws-compare-files', 'Compare Files', 'Compare two files side by side', 'compare files', 'side by side', 'diff two'],
  ['ws-generate', 'Generate', 'Generate boilerplate code or config', 'generate', 'scaffold', 'boilerplate', 'create code'],
  ['ws-get-change-log', 'Change Log', 'Show changes since last commit', 'changes', 'changelog', 'what is new'],
  ['ws-set-permissions', 'Set Permissions', 'Set file permissions', 'permissions', 'chmod', 'access'],
  ['ws-share', 'Share', 'Share a file or folder with a link', 'share', 'link', 'send'],
]);

// terminal
const terminalTools = build('terminal', [
  ['term-execute', 'Execute', 'Run a shell command', 'run', 'execute', 'command', 'shell', 'terminal', 'cmd', 'do'],
  ['term-execute-bg', 'Execute Background', 'Run a command in background', 'run background', 'background', 'detach'],
  ['term-cd', 'Change Dir', 'Change working directory', 'cd', 'directory', 'go to', 'switch dir'],
  ['term-pwd', 'Print Dir', 'Print current directory', 'pwd', 'where am i', 'current dir'],
  ['term-ls', 'List', 'List directory contents', 'list dir', 'ls', 'dir', 'contents'],
  ['term-cat', 'Cat', 'Display file contents', 'cat', 'show', 'print file', 'read file', 'display'],
  ['term-head', 'Head', 'Show first N lines', 'head', 'first lines', 'beginning'],
  ['term-tail', 'Tail', 'Show last N lines', 'tail', 'last lines', 'end'],
  ['term-grep', 'Grep', 'Search text with regex', 'grep', 'search', 'find', 'match', 'regex search'],
  ['term-find', 'Find', 'Find files by name or type', 'find', 'locate file', 'search file'],
  ['term-which', 'Which', 'Find path to executable', 'which', 'path to', 'locate exe'],
  ['term-echo', 'Echo', 'Print text or variable', 'echo', 'print', 'say', 'display text'],
  ['term-export', 'Export Var', 'Set environment variable', 'export', 'env', 'set env'],
  ['term-npm-install', 'Npm Install', 'Install npm dependencies', 'npm install', 'install deps', 'npm i'],
  ['term-npm-run', 'Npm Run', 'Run npm script', 'npm run', 'npm script', 'start', 'build', 'dev'],
  ['term-npm-init', 'Npm Init', 'Initialize npm project', 'npm init', 'new npm', 'setup project'],
  ['term-python', 'Python', 'Run Python script', 'python', 'py', 'run python', 'py script'],
  ['term-pip', 'Pip', 'Install Python package', 'pip', 'pip install', 'python package'],
  ['term-docker-build', 'Docker Build', 'Build Docker image', 'docker build', 'docker', 'image build'],
  ['term-docker-run', 'Docker Run', 'Run Docker container', 'docker run', 'container', 'docker start'],
  ['term-docker-ps', 'Docker Ps', 'List running containers', 'docker ps', 'containers', 'docker list'],
  ['term-docker-logs', 'Docker Logs', 'Show container logs', 'docker logs', 'logs', 'container logs'],
  ['term-kubectl', 'Kubectl', 'Run kubectl command', 'kubectl', 'k8s', 'kubernetes', 'pod', 'deployment'],
  ['term-curl', 'Curl', 'Make HTTP request from terminal', 'curl', 'http', 'request', 'fetch cmd'],
  ['term-wget', 'Wget', 'Download file via HTTP', 'wget', 'download', 'get file'],
  ['term-tar', 'Tar', 'Extract or create tar archive', 'tar', 'archive', 'extract archive'],
  ['term-chmod', 'Chmod', 'Change file permissions', 'chmod', 'permissions', 'access'],
  ['term-chown', 'Chown', 'Change file owner', 'chown', 'owner', 'user'],
  ['term-ps', 'Processes', 'List running processes', 'ps', 'process', 'running', 'task', 'top'],
  ['term-kill', 'Kill', 'Kill a process', 'kill', 'stop process', 'terminate'],
  ['term-sleep', 'Sleep', 'Wait for specified seconds', 'sleep', 'wait', 'delay'],
  ['term-date', 'Date', 'Show current date and time', 'date', 'time now', 'current time'],
  ['term-whoami', 'Whoami', 'Show current user', 'whoami', 'who', 'user'],
  ['term-uname', 'Uname', 'Show system info', 'uname', 'system info', 'os info'],
  ['term-free', 'Free', 'Show memory usage', 'free', 'memory', 'ram'],
  ['term-df', 'Disk Free', 'Show disk usage', 'df', 'disk', 'storage', 'space'],
  ['term-du', 'Disk Usage', 'Show directory size', 'du', 'directory size', 'folder size'],
]);

// code
const codeTools = build('code', [
  ['code-review', 'Review Code', 'Review code for bugs and quality', 'review code', 'code review', 'inspect code', 'check code'],
  ['code-refactor', 'Refactor', 'Refactor code without changing behavior', 'refactor', 'clean up', 'restructure', 'improve'],
  ['code-lint', 'Lint', 'Run linter and show errors', 'lint', 'linter', 'check style', 'eslint', 'ruff'],
  ['code-format', 'Format', 'Format code to style rules', 'format', 'prettier', 'beautify', 'style fix'],
  ['code-test', 'Test', 'Run tests and show results', 'test', 'run test', 'pytest', 'jest', 'vitest', 'npm test'],
  ['code-debug', 'Debug', 'Debug code with breakpoints', 'debug', 'breakpoint', 'step through', 'trace'],
  ['code-typecheck', 'Type Check', 'Run TypeScript type checker', 'type check', 'typescript', 'tsc', 'types'],
  ['code-compile', 'Compile', 'Compile source code', 'compile', 'build', 'transpile', 'tsc'],
  ['code-run', 'Run Code', 'Execute code snippet', 'run code', 'execute code', 'run snippet'],
  ['code-explain', 'Explain Code', 'Explain what code does', 'explain', 'what does this do', 'describe', 'comment'],
  ['code-generate', 'Generate Code', 'Generate code from description', 'generate code', 'write code', 'scaffold', 'boilerplate'],
  ['code-summarize', 'Summarize', 'Summarize code changes', 'summarize', 'summary', 'what changed', 'diff summary'],
  ['code-search', 'Search Code', 'Find code by pattern', 'search code', 'find code', 'grep code', 'locate'],
  ['code-navigate', 'Navigate', 'Jump to definition or symbol', 'navigate', 'goto', 'find definition', 'go to'],
  ['code-autofix', 'Auto Fix', 'Auto-fix lint errors', 'autofix', 'auto fix', 'fix all', 'repair'],
  ['code-diff', 'Show Diff', 'Show diff between versions', 'diff', 'difference', 'compare code', 'changes'],
  ['code-merge', 'Merge', 'Merge code changes', 'merge', 'combine', 'conflict resolve'],
  ['code-extract', 'Extract', 'Extract method or variable', 'extract', 'pull out', 'method extract'],
  ['code-inline', 'Inline', 'Inline variable or method', 'inline', 'replace', 'simplify'],
  ['code-rename', 'Rename Symbol', 'Rename symbol across workspace', 'rename', 'rename symbol', 'refactor rename'],
  ['code-find-usage', 'Find Usages', 'Find where symbol is used', 'find usage', 'references', 'where used', 'find references'],
  ['code-hierarchy', 'Hierarchy', 'Show class/method hierarchy', 'hierarchy', 'inheritance', 'class tree', 'parent'],
  ['code-override', 'Override', 'Show override methods', 'override', 'overrides', 'implement'],
  ['code-source', 'Go to Source', 'Navigate to source definition', 'go to source', 'source', 'definition'],
  ['code-callers', 'Find Callers', 'Find functions that call this', 'callers', 'who calls', 'find callers'],
  ['code-callees', 'Find Callees', 'Find functions this calls', 'callees', 'calls', 'find callees'],
  ['code-diagram', 'Diagram', 'Generate code diagram', 'diagram', 'visualize', 'chart', 'flow'],
  ['code-validate', 'Validate', 'Validate code correctness', 'validate', 'verify code', 'check correctness'],
  ['code-snapshot', 'Code Snapshot', 'Take snapshot of code state', 'snapshot', 'save state', 'checkpoint'],
  ['code-suggest', 'Suggest', 'Suggest improvements', 'suggest', 'recommend', 'best practice'],
  ['code-warnings', 'Warnings', 'Show all compiler warnings', 'warnings', 'warn', 'compiler warnings'],
  ['code-errors', 'Errors', 'Show all compile errors', 'errors', 'error', 'compile errors'],
  ['code-type-info', 'Type Info', 'Show type of expression', 'type info', 'typeof', 'what type', 'type of'],
  ['code-hover', 'Hover Info', 'Show hover information for symbol', 'hover', 'info', 'tooltip', 'documentation'],
  ['code-doc', 'Documentation', 'Show documentation for symbol', 'doc', 'docs', 'documentation', 'help'],
  ['code-import', 'Fix Imports', 'Auto-add or fix imports', 'import', 'fix import', 'add import'],
  ['code-export', 'Export', 'Export code to file', 'export', 'save', 'write file', 'output file'],
]);


// data
const dataTools = build('data', [
  ['data-csv', 'CSV', 'Parse and analyze CSV data', 'csv', 'spreadsheet', 'table data', 'comma sep'],
  ['data-json', 'JSON', 'Parse and query JSON data', 'json', 'query json', 'parse json', 'json path'],
  ['data-sql', 'SQL', 'Run SQL query on dataset', 'sql', 'query', 'database', 'select', 'insert', 'update', 'delete'],
  ['data-query', 'Query', 'Query data with natural language', 'query', 'ask data', 'what is in', 'find in data'],
  ['data-filter', 'Filter', 'Filter rows in dataset', 'filter', 'where', 'subset', 'condition'],
  ['data-sort', 'Sort', 'Sort data by column', 'sort', 'order', 'arrange', 'rank'],
  ['data-aggregate', 'Aggregate', 'Aggregate data sum avg count', 'aggregate', 'sum', 'average', 'count', 'group by', 'stats'],
  ['data-join', 'Join', 'Join two datasets', 'join', 'merge', 'combine', 'match', 'relate'],
  ['data-pivot', 'Pivot', 'Pivot data table', 'pivot', 'reshape', 'transpose', 'cross tab'],
  ['data-chart', 'Chart', 'Generate chart from data', 'chart', 'graph', 'plot', 'visualize', 'bar', 'line', 'pie'],
  ['data-table', 'Table', 'Display data as formatted table', 'table', 'display', 'grid', 'show data'],
  ['data-import-csv', 'Import CSV', 'Import CSV into workspace', 'import csv', 'load csv', 'csv upload'],
  ['data-export-csv', 'Export CSV', 'Export data as CSV', 'export csv', 'save csv', 'csv output'],
  ['data-fill-missing', 'Fill Missing', 'Fill missing values in dataset', 'fill', 'missing', 'na', 'null fill', 'impute'],
  ['data-remove-duplicates', 'Remove Duplicates', 'Remove duplicate rows', 'deduplicate', 'duplicates', 'unique', 'drop dup'],
  ['data-correlate', 'Correlate', 'Find correlations in data', 'correlation', 'relate', 'associate', 'stats'],
  ['data-regression', 'Regression', 'Run regression analysis', 'regression', 'fit', 'predict', 'trend', 'model'],
  ['data-clustering', 'Cluster', 'Cluster data points', 'cluster', 'group', 'kmeans', 'segment'],
  ['data-outliers', 'Outliers', 'Detect outliers in data', 'outlier', 'anomaly', 'detect', 'unusual'],
  ['data-profile', 'Profile', 'Profile dataset statistics', 'profile', 'statistics', 'summary', 'describe'],
])


// communication
const communicationTools = build('communication', [
  ['comm-email', 'Email', 'Send an email', 'email', 'send email', 'mail', 'message'],
  ['comm-send-sms', 'Send SMS', 'Send a text message', 'sms', 'text', 'send text', 'phone'],
  ['comm-slack', 'Slack', 'Send Slack message', 'slack', 'send slack', 'channel', 'workspace'],
  ['comm-discord', 'Discord', 'Send Discord message', 'discord', 'send discord', 'server', 'bot'],
  ['comm-teams', 'Teams', 'Send Teams message', 'teams', 'send teams', 'microsoft', 'work chat'],
  ['comm-notification', 'Notification', 'Send desktop notification', 'notify', 'notification', 'alert', 'message'],
  ['comm-toast', 'Toast', 'Show toast message', 'toast', 'popup', 'brief message', 'snackbar'],
  ['comm-twitter', 'Twitter', 'Post to Twitter', 'twitter', 'tweet', 'post', 'x'],
  ['comm-linkedin', 'LinkedIn', 'Post to LinkedIn', 'linkedin', 'post linkedin', 'professional'],
  ['comm-webhook', 'Webhook', 'Send webhook notification', 'webhook', 'http hook', 'callback', 'trigger'],
  ['comm-zulip', 'Zulip', 'Send Zulip message', 'zulip', 'send zulip', 'topic'],
  ['comm-email-draft', 'Email Draft', 'Draft an email', 'draft email', 'compose email', 'write email'],
  ['comm-email-send', 'Email Send', 'Send drafted email', 'send email', 'dispatch', 'deliver'],
  ['comm-reply', 'Reply', 'Reply to last message', 'reply', 'respond', 'answer'],
  ['comm-forward', 'Forward', 'Forward a message', 'forward', 'resend', 'redirect'],
])


// media
const mediaTools = build('media', [
  ['media-image-gen', 'Image Gen', 'Generate image from description', 'generate image', 'image', 'art', 'picture', 'draw'],
  ['media-image-edit', 'Image Edit', 'Edit an image', 'edit image', 'modify image', 'change image'],
  ['media-image-resize', 'Resize Image', 'Resize an image', 'resize image', 'smaller', 'bigger image', 'scale'],
  ['media-image-ocr', 'OCR', 'Extract text from image', 'ocr', 'text from image', 'read image', 'scan'],
  ['media-audio-gen', 'Audio Gen', 'Generate audio from text', 'generate audio', 'audio', 'sound', 'speak', 'tts', 'voice'],
  ['media-audio-transcribe', 'Transcribe', 'Transcribe audio to text', 'transcribe', 'speech to text', 'stt', 'audio to text'],
  ['media-video-gen', 'Video Gen', 'Generate video from description', 'generate video', 'video', 'create video'],
  ['media-video-edit', 'Video Edit', 'Edit a video', 'edit video', 'trim', 'clip', 'merge video'],
  ['media-convert', 'Convert', 'Convert file format', 'convert', 'format', 'transcode', 'to'],
  ['media-compress', 'Compress', 'Compress media file', 'compress', 'reduce size', 'smaller file', 'zip media'],
  ['media-thumbnail', 'Thumbnail', 'Generate thumbnail from video or image', 'thumbnail', 'preview', 'snapshot'],
  ['media-remove-bg', 'Remove Background', 'Remove background from image', 'remove background', 'bg remove', 'transparent', 'cutout'],
  ['media-upscale', 'Upscale', 'Upscale image resolution', 'upscale', 'enhance', '4k', 'sharpen', 'improve'],
  ['media-colorize', 'Colorize', 'Colorize grayscale image', 'colorize', 'color', 'colour', 'paint'],
  ['media-stabilize', 'Stabilize', 'Stabilize shaky video', 'stabilize', 'smooth video', 'steady'],
])


// security
const securityTools = build('security', [
  ['sec-scan', 'Scan', 'Scan code for vulnerabilities', 'scan', 'security', 'vulnerability', 'audit'],
  ['sec-secret-scan', 'Secret Scan', 'Scan for exposed secrets', 'secret scan', 'api key', 'token', 'credential', 'leak'],
  ['sec-dependency-check', 'Dependency Check', 'Check dependencies for known CVEs', 'dependency', 'cve', 'package audit', 'npm audit'],
  ['sec-encryption', 'Encryption', 'Encrypt data', 'encrypt', 'cipher', 'encode', 'secure', 'aes'],
  ['sec-decryption', 'Decryption', 'Decrypt data', 'decrypt', 'decode', 'unscramble', 'restore encrypted'],
  ['sec-hash', 'Hash', 'Generate hash of data', 'hash', 'sha', 'md5', 'checksum', 'digest'],
  ['sec-verify', 'Verify', 'Verify file integrity', 'verify', 'checksum', 'integrity', 'match', 'validate hash'],
  ['sec-password', 'Password', 'Generate strong password', 'password', 'passphrase', 'credential', 'generate password'],
  ['sec-token', 'Token', 'Generate API token', 'token', 'api key', 'auth token', 'bearer'],
  ['sec-certificate', 'Certificate', 'Check SSL certificate', 'certificate', 'ssl', 'tls', 'https', 'cert'],
  ['sec-firewall', 'Firewall', 'Check firewall rules', 'firewall', 'port', 'network', 'access control'],
  ['sec-auth', 'Auth', 'Check authentication setup', 'auth', 'login', 'session', 'oauth', 'jwt', 'sso'],
  ['sec-pentest', 'Pentest', 'Run penetration test', 'pentest', 'penetration', 'exploit', 'attack', 'offensive'],
  ['sec-remediate', 'Remediate', 'Suggest security fixes', 'remediate', 'fix security', 'patch', 'hardening'],
  ['sec-compliance', 'Compliance', 'Check compliance status', 'compliance', 'audit', 'standard', 'hipaa', 'gdpr', 'soc2'],
])


// devops
const devopsTools = build('devops', [
  ['devops-deploy', 'Deploy', 'Deploy application', 'deploy', 'publish', 'release', 'push', 'ship'],
  ['devops-ci', 'CI', 'Run CI pipeline', 'ci', 'pipeline', 'build test', 'github actions', 'workflow'],
  ['devops-cd', 'CD', 'Run CD pipeline', 'cd', 'continuous deploy', 'release', 'promote'],
  ['devops-monitor', 'Monitor', 'Monitor application health', 'monitor', 'health', 'uptime', 'metric', 'watch'],
  ['devops-alert', 'Alert', 'Set up alert', 'alert', 'notify', 'warning', 'threshold', 'trigger'],
  ['devops-log', 'Log', 'View application logs', 'log', 'logs', 'console', 'trace', 'debug log'],
  ['devops-metrics', 'Metrics', 'View application metrics', 'metrics', 'dashboard', 'stat', 'performance', 'grafana'],
  ['devops-rollback', 'Rollback', 'Rollback to previous version', 'rollback', 'revert', 'previous', 'undo deploy'],
  ['devops-scale', 'Scale', 'Scale application instances', 'scale', 'resize', 'more instances', 'replica'],
  ['devops-container', 'Container', 'Manage container', 'container', 'docker', 'pod', 'runtime'],
  ['devops-orchestrate', 'Orchestrate', 'Orchestrate services', 'orchestrate', 'kubernetes', 'k8s', 'helm', 'service mesh'],
  ['devops-infra', 'Infrastructure', 'Provision infrastructure', 'infrastructure', 'terraform', 'iac', 'provision'],
  ['devops-env', 'Environment', 'Manage environment variables', 'env', 'environment', 'variable', 'config', 'secret'],
  ['devops-secrets', 'Secrets', 'Manage secrets', 'secret', 'vault', 'credential', 'key', 'password'],
  ['devops-nginx', 'Nginx', 'Configure nginx', 'nginx', 'reverse proxy', 'web server', 'config'],
  ['devops-certbot', 'Certbot', 'Manage SSL certificates', 'certbot', 'ssl', 'letsencrypt', 'certificate', 'https'],
  ['devops-backup', 'Backup', 'Backup application data', 'backup', 'snapshot', 'save', 'archive data'],
  ['devops-restore', 'Restore', 'Restore from backup', 'restore', 'recover', 'load backup', 'snapshot restore'],
  ['devops-db', 'Database', 'Manage database', 'database', 'db', 'sql', 'migrate', 'schema'],
  ['devops-cache', 'Cache', 'Manage cache', 'cache', 'redis', 'memcached', 'invalidate', 'flush'],
])


// search
const searchTools = build('search', [
  ['search-web', 'Web Search', 'Search the web', 'search', 'google', 'find', 'lookup', 'lookup web', 'www'],
  ['search-docs', 'Docs Search', 'Search documentation', 'docs search', 'documentation', 'manual', 'help', 'wiki'],
  ['search-wiki', 'Wiki Search', 'Search wiki', 'wiki', 'encyclopedia', 'knowledge base'],
  ['search-github', 'GitHub Search', 'Search GitHub repositories', 'github', 'repo', 'repository', 'code search'],
  ['search-stackoverflow', 'Stack Overflow', 'Search Stack Overflow', 'stackoverflow', 'stack', 'overflow', 'programming', 'qa'],
  ['search-paper', 'Paper Search', 'Search academic papers', 'paper', 'arxiv', 'research', 'academic', 'citation'],
  ['search-news', 'News Search', 'Search news articles', 'news', 'article', 'headline', 'current events'],
  ['search-files', 'File Search', 'Search workspace files', 'file search', 'find file', 'search workspace', 'locate file'],
  ['search-code', 'Code Search', 'Search codebase', 'code search', 'grep code', 'find code', 'symbol search'],
  ['search-youtube', 'YouTube Search', 'Search YouTube videos', 'youtube', 'video', 'watch', 'tutorial'],
])


// system
const systemTools = build('system', [
  ['sys-info', 'System Info', 'Show system information', 'info', 'system', 'about', 'specs', 'version'],
  ['sys-cpu', 'CPU', 'Show CPU usage and stats', 'cpu', 'processor', 'usage', 'load', 'cores'],
  ['sys-memory', 'Memory', 'Show memory usage', 'memory', 'ram', 'mem', 'usage', 'free'],
  ['sys-disk', 'Disk', 'Show disk usage', 'disk', 'storage', 'hdd', 'ssd', 'usage'],
  ['sys-network', 'Network', 'Show network status', 'network', 'interface', 'ip', 'connection', 'bandwidth'],
  ['sys-process', 'Process', 'List running processes', 'process', 'ps', 'running', 'task', 'top'],
  ['sys-battery', 'Battery', 'Show battery status', 'battery', 'charge', 'power', 'laptop'],
  ['sys-temperature', 'Temperature', 'Show system temperature', 'temperature', 'temp', 'thermal', 'cpu temp'],
  ['sys-users', 'Users', 'Show active users', 'users', 'login', 'session', 'account'],
  ['sys-services', 'Services', 'List system services', 'services', 'daemon', 'service', 'background'],
])


// model
const modelTools = build('model', [
  ['model-list', 'List Models', 'List available models', 'models', 'list models', 'available', 'catalog'],
  ['model-info', 'Model Info', 'Show model information', 'model info', 'details', 'specs', 'parameters'],
  ['model-load', 'Load Model', 'Load a model into memory', 'load model', 'use model', 'run model'],
  ['model-unload', 'Unload Model', 'Unload model from memory', 'unload model', 'remove model', 'free model'],
  ['model-download', 'Download Model', 'Download model files', 'download model', 'fetch model', 'get model'],
  ['model-install', 'Install Model', 'Install a model for use', 'install model', 'setup model', 'prepare model'],
  ['model-quantize', 'Quantize', 'Quantize model for smaller size', 'quantize', 'compress model', 'smaller model'],
  ['model-export', 'Export Model', 'Export model to different format', 'export model', 'convert model', 'format model'],
  ['model-benchmark', 'Benchmark', 'Benchmark model performance', 'benchmark', 'bench', 'speed', 'latency', 'throughput'],
  ['model-compare', 'Compare Models', 'Compare model performance', 'compare', 'benchmark compare', 'vs', 'versus'],
])


// math
const mathTools = build('math', [
  ['math-calc', 'Calculator', 'Evaluate mathematical expression', 'calc', 'calculate', 'math', 'evaluate', 'compute', 'arithmetic'],
  ['math-solve', 'Solve', 'Solve equation', 'solve', 'equation', 'root', 'find x', 'unknown'],
  ['math-derivative', 'Derivative', 'Compute derivative', 'derivative', 'differentiate', 'd/dx', 'calculus'],
  ['math-integral', 'Integral', 'Compute integral', 'integral', 'integrate', 'area', 'calculus'],
  ['math-statistics', 'Statistics', 'Compute statistics', 'statistics', 'stats', 'mean', 'median', 'stddev', 'variance'],
  ['math-matrix', 'Matrix', 'Matrix operations', 'matrix', 'linear algebra', 'determinant', 'inverse'],
  ['math-plot', 'Plot', 'Plot a graph', 'plot', 'graph', 'chart', 'draw', 'visualize math'],
  ['math-unit', 'Unit Convert', 'Convert units', 'convert', 'unit', 'metric', 'imperial', 'feet to cm'],
  ['math-base', 'Base Convert', 'Convert between number bases', 'base', 'binary', 'hex', 'octal', 'decimal', 'convert base'],
  ['math-complex', 'Complex', 'Complex number operations', 'complex', 'imaginary', 'i', 'real part', 'phase'],
])


// text
const textTools = build('text', [
  ['text-counter', 'Word Count', 'Count words and characters', 'count', 'word count', 'characters', 'length', 'stats'],
  ['text-find', 'Find', 'Find and replace text', 'find', 'replace', 'search text', 'substitute'],
  ['text-format', 'Format', 'Format text markdown or html', 'format text', 'markdown', 'html', 'beautify'],
  ['text-convert', 'Convert', 'Convert text format', 'convert text', 'transcode', 'encode', 'decode'],
  ['text-extract', 'Extract', 'Extract text from content', 'extract text', 'pull text', 'parse text'],
  ['text-normalize', 'Normalize', 'Normalize text lowercase trim', 'normalize', 'clean', 'tidy', 'standardize'],
  ['text-split', 'Split', 'Split text into chunks', 'split', 'chunk', 'break', 'divide text'],
  ['text-join', 'Join', 'Join text chunks', 'join', 'merge text', 'combine', 'concatenate'],
  ['text-sort', 'Sort Lines', 'Sort lines alphabetically', 'sort lines', 'sort', 'alphabetical', 'order'],
  ['text-uniq', 'Unique Lines', 'Remove duplicate lines', 'unique', 'deduplicate', 'remove dup', 'distinct'],
])


// time
const timeTools = build('time', [
  ['time-now', 'Current Time', 'Show current time', 'time', 'current time', 'now', 'clock'],
  ['time-date', 'Date', 'Show current date', 'date', 'today', 'calendar', 'day'],
  ['time-schedule', 'Schedule', 'Schedule a task', 'schedule', 'timer', 'remind', 'later', 'at time'],
  ['time-countdown', 'Countdown', 'Start a countdown', 'countdown', 'timer', 'count', 'tick'],
  ['time-timezone', 'Timezone', 'Convert timezone', 'timezone', 'convert', 'local', 'utc', 'offset'],
])

// ASSEMBLE
export const TOOL_REGISTRY: ToolDef[] = [
  ...dataTools,
  ...communicationTools,
  ...mediaTools,
  ...securityTools,
  ...devopsTools,
  ...searchTools,
  ...systemTools,
  ...modelTools,
  ...mathTools,
  ...textTools,
  ...timeTools,
];

const TOOL_INDEX = new Map<string, ToolDef>();
for (const t of TOOL_REGISTRY) TOOL_INDEX.set(t.id, t);

export function getToolById(id: string): ToolDef | undefined {
  return TOOL_INDEX.get(id);
}

export function getToolsByCategory(category: string): ToolDef[] {
  return TOOL_REGISTRY.filter((t) => t.category === category);
}

export function countTools(): number {
  return TOOL_REGISTRY.length;
}
