# FileFlow - Professional Local File/Folder Transfer Automation

**FileFlow** is a modern, high-performance, and resilient **Node.js + Express + EJS** web application built specifically for Windows to automate repetitive **Copy**, **Cut**, and **Move** folder and file transfer operations across local directories and drives.

---

## Key Features

- 🚀 **Zero External Services / 100% Local**: Runs entirely on your local Windows machine (`127.0.0.1:3000`). No cloud dependencies, no external database servers required.
- 🗄️ **Self-Initializing Local JSON Database**: Automatic persistence of jobs, saved locations, settings, and run history in `data/database.json`.
- 📁 **Visual Windows Directory Explorer**: Interactive folder and drive browser (`C:\`, `D:\`, etc.) modal with breadcrumb navigation and instant path validation.
- ⚡ **Multi-Step Transfer Pipelines**: Configure sequential multi-step transfer jobs with independent sources, destinations, and operations.
- 🛡️ **Safety-First Move / Cut Engine**: Employs a verified `Copy -> Verify (Size/Integrity) -> Delete Source` model. Source files are never deleted unless the destination transfer is 100% confirmed.
- 🚫 **Advanced Exclusion Engine**: Skip unwanted files/directories recursively using exact names (`node_modules`, `.git`), relative paths (`src/test`), or wildcards (`*.log`, `*.tmp`, `*.bak`). Excluded directories are pruned during traversal for ultra-fast execution.
- 👁️ **Dry Run Simulation**: Simulate transfers without modifying any files. Accurately predicts what would be copied, skipped, replaced, or potential errors.
- 🔄 **Conflict Resolution Policies**: Choose between `Replace if source is newer` (default), `Always Overwrite`, or `Skip Existing`.
- 📊 **Real-Time Live Execution Monitor**: Streaming progress bar, animated file counters, transfer rate, duration timer, and live log terminal using **Server-Sent Events (SSE)**.
- 📜 **Audit History & Isolated Run Logs**: Every execution records comprehensive metrics and dedicated raw log files in `logs/executions/run_<id>.log`.
- 🎨 **Modern Desktop Aesthetics**: Curated Slate & Indigo interface with dark/light themes, responsive layout, glassmorphism cards, and glowing indicators.

---

## 1. System Requirements

- **Operating System**: Windows 10 / 11 / Windows Server (or macOS/Linux)
- **Runtime**: Node.js **v18.0.0** or higher (Recommended: v20+ / v22+)
- **Package Manager**: `npm` (bundled with Node.js)

---

## 2. Installation & Quick Start

1. Clone or extract the project folder:
   ```bash
   cd c:\Users\IS\Desktop\AUTO_FILE_TRANSFER
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

4. Open your web browser and navigate to:
   ```text
   http://localhost:3000
   ```

---

## 3. Creating & Running a Transfer Job

### Step 1: Create a Job
1. Click **+ New Transfer Job** in the top navigation or on the dashboard.
2. Enter a **Job Name** (e.g. `Daily Project Backup`).
3. Set your preferred **Conflict Resolution** mode.

### Step 2: Configure Transfer Steps
1. In **Step 1**, enter the **Source Path** (or click **Browse** to choose visually).
2. Enter the **Destination Path**.
3. Choose the **Operation**:
   - **Copy**: Preserves original files in the source.
   - **Move / Cut**: Safely moves files and cleans up source folders upon completion.
4. Add files/folders to exclude:
   - Click preset chips like `+ node_modules`, `+ .git`, `+ *.log`, `+ *.tmp`, `+ .env`, `+ temp`.
   - Or type custom filenames or wildcards and hit `Enter` or `,`.
5. Click **+ Add Transfer Step** if you want to chain multiple transfer tasks sequentially.

### Step 3: Run or Simulate
- **▶ Run Job**: Starts real-time transfer and redirects to the live execution monitor.
- **👁 Dry Run**: Runs an accurate simulation and displays what files would be copied, skipped, or replaced without writing to disk.

---

## 4. Exclusion System Guide

FileFlow features a multi-mode exclusion engine that operates recursively:

| Rule Type | Example | Behavior |
| :--- | :--- | :--- |
| **Exact Names** | `node_modules`, `.git`, `.env`, `Thumbs.db` | Skips any file or directory with this exact name anywhere in the source hierarchy. |
| **Wildcards** | `*.log`, `*.tmp`, `*.bak`, `temp*` | Skips files matching the glob pattern. |
| **Relative Paths** | `src/test`, `build/temp`, `cache/data` | Skips the specified path relative to the source root. |

When a folder matches an exclusion rule (like `node_modules`), FileFlow prunes the entire subtree without scanning its internal files, speeding up transfers significantly.

---

## 5. Conflict Resolution Modes

Configure conflict handling globally in **Settings** or customize it per transfer job:

1. **Replace if source is newer (Recommended)**:
   - Compares file modification timestamps (`mtime`) and byte sizes.
   - Files with newer timestamps or differing sizes are updated; identical files are skipped.
2. **Always Overwrite / Replace**:
   - Replaces destination files regardless of timestamp.
3. **Skip Existing**:
   - Preserves destination files; never overwrites if the file already exists.

---

## 6. Directory Structure

```text
fileflow/
├── app.js                      # Express application entry point
├── package.json                # Project manifest and scripts
├── README.md                   # Application documentation
├── .gitignore                  # Git ignore rules
│
├── config/
│   └── config.js               # Application configuration defaults and paths
│
├── data/
│   └── database.json           # Local JSON database (auto-created on startup)
│
├── routes/
│   ├── web.js                  # Frontend page routes (Dashboard, Jobs, Locations, History)
│   ├── jobs.js                 # REST API for Job CRUD, execution, dry-run, duplication
│   ├── locations.js            # REST API for Saved Locations management
│   ├── execution.js            # REST API for live SSE stream, stop controls, raw logs
│   ├── explorer.js             # Safe Windows Folder Explorer and path validation APIs
│   └── settings.js             # REST API for application settings
│
├── services/
│   ├── fileTransferService.js  # Recursive copy/move engine with stream pipelines and backpressure
│   ├── exclusionService.js     # Exact name, relative path, and wildcard glob matcher
│   ├── executionService.js     # Execution manager with Server-Sent Events (SSE) broadcaster
│   ├── databaseService.js      # Atomic JSON storage engine with mutex write queue
│   ├── jobService.js           # Business logic and validation for jobs
│   └── locationService.js      # Business logic for saved folder locations
│
├── utils/
│   ├── pathUtils.js            # Windows path normalization, drive detection, self-copy protection
│   ├── fileUtils.js            # Formatting, stream copying, integrity verification, safe deletion
│   └── logger.js               # App logging and isolated execution run logging
│
├── views/
│   ├── partials/
│   │   ├── header.ejs          # Sidebar, topbar, theme switcher, responsive navigation
│   │   └── footer.ejs          # Windows folder explorer modal, confirm dialogs, dry-run modal
│   ├── dashboard.ejs           # System overview, stats, recent executions, quick run list
│   ├── jobs/
│   │   ├── index.ejs           # Jobs list with search, filter, duplicate, delete
│   │   ├── create.ejs          # Dynamic multi-step job builder form
│   │   ├── edit.ejs            # Edit job form
│   │   └── details.ejs         # Job details, step flow diagram, job history
│   ├── locations.ejs           # Saved locations cards, path validation, quick add
│   ├── execution.ejs           # Real-time SSE monitor with progress bar, stats, live log stream
│   ├── history.ejs             # Historical runs table with search and filtering
│   ├── history-detail.ejs      # Run breakdown, step stats, error tables, raw log viewer
│   └── settings.ejs            # Concurrency, default conflict rules, theme, safety prompts
│
├── public/
│   ├── css/
│   │   └── style.css           # Modern design system (Dark & Light theme, glassmorphism)
│   └── js/
│       ├── app.js              # Theme switcher, global toast alerts, modal handlers
│       ├── folderPicker.js     # Windows drive & folder explorer modal logic
│       ├── dashboard.js        # Dashboard actions
│       ├── jobForm.js          # Multi-step dynamic form logic and exclusion tags
│       ├── jobsList.js         # Jobs table filtering and actions
│       ├── execution.js        # SSE consumer, progress animations, log autoscroll
│       └── history.js          # History table search and batch operations
│
├── logs/
│   ├── application.log         # General application event log
│   └── executions/             # Dedicated execution logs (run_<id>.log)
│
└── test/
    └── transfer.test.js        # Comprehensive automated test suite
```

---

## 7. Running the Automated Test Suite

To run the automated test suite verifying all copy, move, exclusion, conflict, and dry-run rules:

```bash
npm test
```

---

## 8. Security & Safety Principles

1. **Local Host Binding**: The server binds strictly to `127.0.0.1` by default to prevent unauthorized external network access.
2. **No Shell Injections**: The application does not execute arbitrary shell commands from user input. All filesystem operations use Node.js native `fs/promises` and `fs.createReadStream`.
3. **Self-Copy Prevention**: The path utility validates and blocks any step that attempts to copy a folder into itself or into one of its own subdirectories.
4. **Move Confirmation**: If configured in settings, jobs containing `move` steps display a safety warning before running.

---

## 9. Troubleshooting

- **Access Denied / Permission Errors**:
  - If copying from system-protected Windows folders (e.g. `C:\Program Files` or `C:\Windows`), run your terminal as Administrator.
- **Port 3000 in use**:
  - Run `PORT=3001 npm start` or change the `PORT` setting in `config/config.js`.
- **Locked File Warnings**:
  - Files locked exclusively by other Windows applications (e.g. open database files or active Office documents) will be safely reported as skipped/error without crashing the rest of the transfer job.

---

## License

MIT License. Designed and engineered for robust, production-quality local Windows automation.
