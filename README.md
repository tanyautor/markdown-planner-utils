# Markdown Planner Utils

This VS Code extension makes the Markdown preview interactive for planning and progress files. You turn a feature on by writing a **tag**, a Markdown link whose target is a feature name:

```markdown
[Name](Tag)
```

In the preview, tags show as plain text instead of links. You click things in the preview, and the extension edits and saves the `.md` file for you.

| Tag | Feature |
|---|---|
| `[Name](Counter): 0` | A number with − / + buttons |
| `- [Name](SequentialTickBoxes):` | The checkboxes below it form a rating scale |
| `- [ ] [Name](SyncHeader)` | A status item with ✅ ⏳ ⬜ |
| `- [ ] [Name](SyncSubheader)` | A sub-step under a `SyncHeader` |

Tag names are case-insensitive. Everything works only in the **Markdown preview** (Ctrl+Shift+V or Ctrl+K V). Typing in the source does not trigger anything.

The checkboxes are rendered by a task-list extension such as [Markdown Checkboxes](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-checkbox). This extension makes them clickable.

---

## Checkboxes

Every task-list box is clickable in the preview:

```markdown
- [ ] Unchecked
- [x] Checked
```

The line must start with `-` (not `*` or `+`), one space, then `[ ]`, `[x]` or `[X]`. A click saves the file, unless it already had unsaved changes.

---

## `Counter`

```markdown
- [Pages written](Counter): 0
```

The preview shows this as `Pages written: [−] 0 [+]`.

| Rule | Details |
|---|---|
| Format | `[Name](Counter)`, a colon, then a whole number (`-` allowed, no decimals). |
| Placement | Anywhere: a paragraph, a list item, after other text. Text after the number is fine. |
| One per line | Only the first `Counter` on a line gets buttons. |

The value stops at 0 unless `plannerUtils.counterAllowNegative` is on.

---

## `SequentialTickBoxes`: rating scales

```markdown
- [Confidence](SequentialTickBoxes):
  - [ ] Low
  - [ ] Medium
  - [ ] High
  - [ ] Very high
```

| Rule | Details |
|---|---|
| Header | A `-` bullet that contains `[Name](SequentialTickBoxes)`. The trailing `:` is optional. |
| Levels | Checkboxes on the lines directly below, all with the **same** indentation, deeper than the header. |
| Order | Lowest level first, highest last. |
| End | A blank line, a different indentation or a non-checkbox line ends the scale. |

**Behaviour**

- Checking a level also checks every level **above** it.
- Unchecking a level also unchecks every level **below** it.

```markdown
- [Confidence](SequentialTickBoxes):
  - [x] Low
  - [x] Medium
  - [x] High         ← clicked: everything above was checked too
  - [ ] Very high
```

Checkboxes under an untagged bullet are independent and do not cascade.

---

## `SyncHeader` / `SyncSubheader`: status tracking

```markdown
- [ ] [Write report](SyncHeader) ⬜
  - [ ] [Started](SyncSubheader)
```

| Rule | Details |
|---|---|
| Header | A checkbox item containing `[Name](SyncHeader)`. |
| Subheaders | Checkbox items containing `[Name](SyncSubheader)`, nested anywhere under the header, i.e. on the lines below it with deeper indentation until the next blank or less-indented line. A header can have several. |
| Emoji | Optional when you write it. The extension adds or replaces the trailing `✅`, `⏳` or `⬜`. |

**Behaviour**

| Header | Subheaders | Emoji |
|---|---|---|
| `[ ]` | none ticked | `⬜` not started |
| `[ ]` | at least one ticked | `⏳` in progress |
| `[x]` | all ticked automatically | `✅` done |

- Unticking the header does **not** untick its subheaders.
- In the preview, the subheaders are hidden while the header is ticked.

---

## Settings

| Setting | Default | Description |
|---|---|---|
| `plannerUtils.counterAllowNegative` | `false` | Allow counters to go below 0. |
| `plannerUtils.autoSave` | `true` | Save the file after a counter changes. |

## Full example

```markdown
# Project plan

## Milestones

- [ ] [Research](SyncHeader) ⏳
  - [x] [Started](SyncSubheader)
- [ ] [Prototype](SyncHeader) ⬜
  - [ ] [Started](SyncSubheader)

## Skills

- [Writing](SequentialTickBoxes):
  - [x] Beginner
  - [x] Intermediate
  - [ ] Advanced
  - [ ] Expert
- [Sources read](Counter): 3
```

## Install

Package the extension with [vsce](https://github.com/microsoft/vscode-vsce):

```sh
npx @vscode/vsce package
```

Then, in VS Code, run **Extensions: Install from VSIX…** and pick the generated `.vsix` file. Finally run **Developer: Reload Window**.

## License

[MIT](LICENSE)
