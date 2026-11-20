# Emoji

> Cross-platform emoji, symbol, and kaomoji picker with AI-aware search.

`org.asyar.emoji` is a Tier 2 Asyar extension (utilities · macOS, Windows, Linux).

## What it does

The extension provides **2 commands**:

| Command | Mode | What it does |
| --- | --- | --- |
| **Emoji & Symbols** | `view` | Pick and insert an emoji, symbol, or kaomoji. |
| **Clear Emoji Recents** | `background` | Wipe your recently used emojis and frequency counts. |

It also exposes **1 tool** to AI agents:

| Tool | What the agent uses it for |
| --- | --- |
| `emoji_find` | Return a small ranked list of emojis matching a natural-language description. Use when the user describes a feeling, situation, or object and you need to suggest emojis — e.g. 'something for being burnt out' or 'celebration'. Returns char, name, and :shortcode: for each match. |

## Permissions

```json
"permissions": [
  "tools:register",
  "clipboard:write",
  "snippets:contribute"
]
```

## Install

Install from the [Asyar Store](https://asyar.org/extensions).

Then open the **Agent editor** in the launcher to enable its tools for any agent.

## Develop

```bash
# from this directory
pnpm install
pnpm dev          # vite dev server
pnpm test:run     # vitest
pnpm build        # emits dist/{worker,view}.js + assets
pnpm link         # registers the dev path with the launcher
asyar publish     # builds, packages, GitHub release, store submission
```

## License

[MIT](./LICENSE) © Khoshbin
