# dsh-adrian-inject-context

Inject Context for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness): persist your own context entries and have them injected as a standalone **Remember:** row — right after the system prompt, before your message — on every turn.

## Features

- **Standalone sourced row** — never touches the initial system prompt or the shared runtime-context snapshot
- **Simple / Advanced datasets** — two independent context lists; the active mode's dataset is what gets injected (exclusive)
- **Per-entry checkboxes** — toggle any entry on/off, applies from the next request
- **Native Settings UI** — Settings → Inject Context: add, edit, delete, toggle, save
- **Persistent** — datasets and active mode survive sessions and restarts
- **Standalone manager page** — also available at `/adrian-inject-context`

## Install

```sh
dsh plugin --profile web add polohot/dsh-adrian-inject-context
```

## Usage

1. Open **Settings → Inject Context**
2. Add context entries, toggle checkboxes, **Save**
3. Pick the active tab (**Simple**/**Advanced**) — its dataset feeds the injection
4. Send any message and check the **Trajectory**: your `Remember:` block sits between SYSTEM and your message

## Configuration

Store: `~/.dsh/adrian-inject-context.json` (schema v2: mode + simple/advanced datasets, auto-migrated from v1)

## Requirements

- DeepSeek Harness `dsh` ≥ 0.1.2-rc.1 (tested on web profile)

## How it works

Host-side: an `agent/pre-step` waterfall listener prepends the plugin's own independently-sourced user-role message (the same pattern as `dsh-agent-instructions`), freshly read from the store on every step. Client-side: a settings-section module renders the manager against two host routes. Zero system-prompt modification.

## License

MIT
