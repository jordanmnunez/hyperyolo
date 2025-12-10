# AI CLI Tools: Autonomous Execution Comparison

A comparison of headless/autonomous execution modes across Codex, Claude Code, and Gemini CLI for use in automation workflows like Beads Runner.

## Quick Reference

| Feature | Codex | Claude Code | Gemini CLI |
|---------|-------|-------------|------------|
| Auto-approve flag | `--dangerously-bypass-approvals-and-sandbox` | `--dangerously-skip-permissions` | `--yolo` or `-y` |
| Non-interactive flag | `exec <prompt>` | `-p <prompt>` | `-p <prompt>` |
| JSON output | `--json` | `--output-format json` | `--output-format json` |
| Streaming output | `--json` (line-delimited events) | `--output-format stream-json --verbose` | `--output-format stream-json` |
| Iteration limit | N/A | `--max-turns N` | N/A |
| Tool restrictions | N/A | `--allowedTools "..."` | `--allowed-tools "..."` |
| Sandbox mode | `--sandbox` (read-only available) | N/A | `--sandbox` (Docker) |

---

## Codex CLI

**Current implementation in Beads Runner.**

### Autonomous Execution
```bash
codex exec --dangerously-bypass-approvals-and-sandbox "your prompt"
```

### Key Flags
| Flag | Purpose |
|------|---------|
| `exec <prompt>` | Run a single prompt non-interactively |
| `--dangerously-bypass-approvals-and-sandbox` | Auto-approve all tool calls (note: also disables sandbox) |
| `--json` | Output JSON events (line-delimited) |
| `--skip-git-repo-check` | Allow running outside a git repository |
| `--model <name>` | Select model (default: `gpt-5.1-codex-max`; fallback to `gpt-5.1-codex` if the max tier is unavailable) |
| `-c key=value` | Config overrides |

**Note:** Codex does not have a `--yolo` flag. Use `--dangerously-bypass-approvals-and-sandbox` for full auto mode. For sandboxed auto-approve, use `--full-auto --sandbox read-only` instead.

### Example
```bash
codex exec --dangerously-bypass-approvals-and-sandbox --json --skip-git-repo-check "Complete the task and commit"
```

---

## Claude Code CLI

### Autonomous Execution
```bash
claude -p "your prompt" --dangerously-skip-permissions
```

### Key Flags
| Flag | Purpose |
|------|---------|
| `-p, --print <prompt>` | Non-interactive mode, exits after response |
| `--dangerously-skip-permissions` | Skip all permission prompts (YOLO equivalent) |
| `--output-format json` | Structured JSON output |
| `--output-format stream-json` | Streaming newline-delimited JSON (**requires `--verbose`**) |
| `--verbose` | Enable verbose output (required for `stream-json`) |
| `--max-turns N` | Limit agentic iterations |
| `--allowedTools "Tool1,Tool2"` | Restrict available tools |
| `--permission-mode acceptEdits` | Auto-accept edits only |
| `--append-system-prompt "..."` | Add system instructions |
| `--resume <session-id>` | Continue a previous session |
| `--model <alias|full name>` | Model override; aliases like `opus`, `sonnet`, and `haiku` resolve to the latest tier (default is `sonnet`, which currently points to `claude-3-7-sonnet-latest`) |

### Output Formats

**Plain text (default):**
```bash
claude -p "Summarize this file"
```

**JSON (for parsing):**
```bash
claude -p "Analyze code" --output-format json
# Returns: { "result": "...", "total_cost_usd": 0.05, ... }
```

**Streaming JSON:**
```bash
claude -p "Long task" --output-format stream-json --verbose
# Returns newline-delimited JSON events
# Note: --verbose is REQUIRED for stream-json or CLI exits with code 1
```

### Examples

**Full autonomous mode:**
```bash
claude -p "Complete the task" \
  --dangerously-skip-permissions \
  --max-turns 10 \
  --output-format json
```

**Controlled permissions:**
```bash
claude -p "Fix the bug" \
  --permission-mode acceptEdits \
  --allowedTools "Bash,Read,Edit" \
  --max-turns 5
```

**Piping content:**
```bash
cat logs.txt | claude -p "Analyze these logs for errors"
```

### Sources
- [Claude Code Headless Mode](https://docs.anthropic.com/en/docs/claude-code/headless)
- [Claude Code CLI Reference](https://docs.anthropic.com/en/docs/claude-code/cli-reference)

---

## Gemini CLI

### Autonomous Execution
```bash
gemini -p "your prompt" --yolo
```

### Key Flags
| Flag | Purpose |
|------|---------|
| `-p <prompt>` | Non-interactive/headless mode |
| `-y, --yolo` | Auto-approve all tool calls |
| `-m, --model <name>` | Select model (default `auto` resolves to `gemini-2.5-pro`, or `gemini-3-pro-preview` when preview features are enabled; aliases include `pro`, `flash`, `flash-lite`) |
| `--output-format json` | Structured JSON output |
| `--output-format stream-json` | Streaming newline-delimited JSON |
| `-s, --sandbox` | Run tools in Docker sandbox |
| `--allowed-tools "..."` | Restrict/allow specific tools |
| `--approval-mode <mode>` | `default`, `auto_edit`, or `yolo` |
| `-d, --debug` | Enable debug output |
| `--checkpointing` | Save snapshots before file changes |
| `-a, --all-files` | Include all files in context |

### Approval Modes
| Mode | Behavior |
|------|----------|
| `default` | Prompt for each tool call |
| `auto_edit` | Auto-approve edits, prompt for others |
| `yolo` | Auto-approve everything |

### Sandbox Mode

YOLO mode automatically enables sandbox by default for safety:
```bash
gemini -p "task" --yolo  # Runs in Docker sandbox
```

Explicit sandbox control:
```bash
gemini -p "task" --yolo --sandbox  # Force sandbox
```

Configure in `settings.json`:
```json
{
  "sandbox": "docker",
  "approval_mode": "yolo"
}
```

### Examples

**Full autonomous mode:**
```bash
gemini -p "Complete the task" --yolo --output-format json
```

**With sandbox isolation:**
```bash
gemini -p "Dangerous operation" --yolo --sandbox
```

**Batch processing:**
```bash
for file in src/*.py; do
  cat "$file" | gemini -p "Review this code" --output-format json
done
```

**File references:**
```bash
gemini -p "Summarize @./README.md and @./src/"
```

### Installation
```bash
# NPX (no install)
npx https://github.com/google-gemini/gemini-cli

# NPM global
npm install -g @google/gemini-cli

# Homebrew
brew install gemini-cli
```

### Sources
- [Gemini CLI Headless Mode](https://google-gemini.github.io/gemini-cli/docs/cli/headless.html)
- [Gemini CLI GitHub](https://github.com/google-gemini/gemini-cli)
- [Gemini CLI Sandbox](https://geminicli.com/docs/cli/sandbox/)
- [Gemini CLI Tips & Tricks](https://addyo.substack.com/p/gemini-cli-tips-and-tricks)
- [Gemini CLI Cheatsheet](https://www.philschmid.de/gemini-cli-cheatsheet)

---

## Beads Runner Integration Patterns

### Current (Codex)
```typescript
// src/services/codex.ts
const args = ['exec', '--yolo', '--model', model, prompt];
const subprocess = execa('codex', args);
```

### Claude Code Equivalent
```typescript
// Hypothetical src/services/claude.ts
const args = [
  '-p', prompt,
  '--dangerously-skip-permissions',
  '--max-turns', '10',
  '--output-format', 'stream-json'
];
const subprocess = execa('claude', args);
```

### Gemini CLI Equivalent
```typescript
// Hypothetical src/services/gemini.ts
const args = [
  '-p', prompt,
  '--yolo',
  '--output-format', 'stream-json'
];
const subprocess = execa('gemini', args);
```

---

## Safety Considerations

| Tool | Auto-Approve Safety |
|------|---------------------|
| Codex | None built-in |
| Claude | Flag name warns user (`--dangerously-skip-permissions`) |
| Gemini | Auto-enables Docker sandbox in YOLO mode |

### Recommendations for Automation

1. **Use iteration limits** - Prevent runaway execution
   - Claude: `--max-turns 10`
   - Codex/Gemini: Implement in wrapper

2. **Restrict tools** - Only allow necessary capabilities
   - Claude: `--allowedTools "Bash,Read,Edit"`
   - Gemini: `--allowed-tools "ShellTool,EditTool"`

3. **Run in containers** - Isolate from host system
   - Gemini: `--sandbox` (built-in)
   - Others: Run in Docker manually

4. **Use checkpointing** - Enable rollback
   - Gemini: `--checkpointing`
   - Others: Use git commits as checkpoints

---

## Feature Comparison Matrix

| Capability | Codex | Claude | Gemini |
|------------|-------|--------|--------|
| Non-interactive mode | Yes | Yes | Yes |
| YOLO/auto-approve | Yes | Yes | Yes |
| JSON output | Yes | Yes | Yes |
| Streaming JSON | Yes | Yes | Yes |
| Iteration limits | No | Yes | No |
| Tool restrictions | No | Yes | Yes |
| Built-in sandbox | No | No | Yes |
| Session resume | Yes | Yes | Yes |
| File references | No | No | Yes (`@./file`) |
| Stdin piping | ? | Yes | Yes |
| Cost tracking in output | ? | Yes | Yes |

---

## Session Resume / Multi-Turn Headless Workflows

All three CLIs support continuing conversations across multiple headless invocations.

### Codex

**Syntax:** `codex exec <prompt> resume <session-id>`

The `resume` keyword goes *after* the prompt, followed by the session ID.

**Example workflow:**
```bash
# First command - note the session ID in output
$ codex exec --yolo "print hi"
# Output includes: session id: 019b03f2-b811-7d33-85b2-08cbd8a69a02
# ...
# hi

# Follow-up command - resume the session
$ codex exec --yolo "what did you print last" resume 019b03f2-b811-7d33-85b2-08cbd8a69a02
# Output: I printed `hi`.
```

**Scripting pattern:**
```bash
#!/bin/bash
# Extract session ID from first run
SESSION_ID=$(codex exec --yolo "analyze the codebase" 2>&1 | grep "session id:" | awk '{print $3}')

# Continue with follow-up
codex exec --yolo "now fix the issues you found" resume "$SESSION_ID"
```

Sessions are stored in `~/.codex/sessions/` as JSONL files.

---

### Claude Code

**Syntax:** `claude --resume <session-id> -p <prompt>` or `claude --continue -p <prompt>`

Flags go *before* the `-p` prompt.

**Example workflow:**
```bash
# First command - capture session ID from JSON output
$ claude -p "analyze the codebase" --output-format json > step1.json
# JSON includes session_id field

# Continue most recent session
$ claude --continue -p "now fix the issues you found"

# Or resume specific session by ID
$ claude --resume abc123def -p "continue the refactor"
```

**Scripting pattern:**
```bash
#!/bin/bash
# First command with JSON output
RESULT=$(claude -p "analyze the codebase" --output-format json)
SESSION_ID=$(echo "$RESULT" | jq -r '.session_id')

# Continue with the session
claude --resume "$SESSION_ID" -p "fix the bugs you found" --dangerously-skip-permissions
```

**Convenience flags:**
- `--continue` / `-c` - automatically continues most recent session (no ID needed)
- `--resume <id>` / `-r <id>` - resume specific session by ID

---

### Gemini CLI

**Syntax:** `gemini -p "prompt" -r <session-id>` or `gemini --resume <session-id>`

The `-r` flag works with `-p` for headless session chaining.

**Example workflow:**
```bash
# First command - note the session_id in stream-json output
$ gemini -y "print hi" -o stream-json
# Output includes: {"type":"init",...,"session_id":"6e1cc1b0-14d5-42c5-ac38-112a5995c2aa",...}
# ...
# {"type":"message",...,"content":"hi",...}

# Follow-up command - resume the session with -r
$ gemini -y "what did i print last?" -o stream-json -r 6e1cc1b0-14d5-42c5-ac38-112a5995c2aa
# Output: {"type":"message",...,"content":"hi",...}
```

**Scripting pattern:**
```bash
#!/bin/bash
# Extract session ID from stream-json output
SESSION_ID=$(gemini -y "analyze the codebase" -o stream-json 2>&1 | grep '"type":"init"' | jq -r '.session_id')

# Continue with follow-up
gemini -y "now fix the issues you found" -o stream-json -r "$SESSION_ID"
```

**Interactive checkpoints** (alternative approach):
```bash
# In interactive session, save a checkpoint
/chat save mytag

# Later, resume from checkpoint
/chat resume mytag
```

Sessions are stored in `~/.gemini/tmp/<project-hash>/`.

---

### Comparison: Session Resume Syntax

| CLI | First Command | Resume Command |
|-----|---------------|----------------|
| Codex | `codex exec --yolo "prompt"` | `codex exec --yolo "follow-up" resume <session-id>` |
| Claude | `claude -p "prompt"` | `claude --resume <id> -p "follow-up"` or `claude --continue -p "follow-up"` |
| Gemini | `gemini -y "prompt" -o stream-json` | `gemini -y "follow-up" -r <session-id>` |

---

## System Prompt Customization

| Feature | Claude Code | Codex | Gemini CLI |
|---------|-------------|-------|------------|
| Append system prompt | `--append-system-prompt "..."` | No direct flag | Not yet (requested) |
| System prompt file | `--system-prompt-file path` | `-c experimental_instructions_file="path"` | Not yet |
| Project instructions | `CLAUDE.md` | `AGENTS.md` | `GEMINI.md` |

### Claude Code
```bash
# Inline system prompt
claude -p "your query" --append-system-prompt "You are a code reviewer"

# From file
claude -p "your query" --system-prompt-file ./prompts/reviewer.md
```

### Codex
```bash
# Via config override (experimental, may reject some prompts)
codex -c experimental_instructions_file="/path/to/prompt.md" exec "your prompt"

# Or use AGENTS.md in repo root (auto-loaded)
```

### Gemini CLI
```bash
# No CLI flag yet - use GEMINI.md files
# ~/.gemini/GEMINI.md (global)
# ./.gemini/GEMINI.md (project)

# Generate starter file
gemini /init
```

---

*Last updated: December 2025*
