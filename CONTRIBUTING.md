# Contributing

This guide covers how changes get proposed in this repository and how we
format commit messages.

## Getting started

1. Create a branch from `main` for your change:
   ```bash
   git checkout -b feat/short-description
   ```
2. Make your changes, then commit using [Conventional Commits](#commit-messages).
3. Open a pull request against `main` describing what you changed and why.

### Branch naming

Use `<type>/<short-description>`, where `<type>` is one of the commit types
below and the description is kebab-case:

```
feat/volunteer-signup
fix/camera-offset
docs/setup-steps
```

Never commit directly to `main` — it only receives finished work via a
reviewed merge.

## Commit messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/)
specification. Every commit message should look like:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

| Type       | When to use it                                          |
| ---------- | ------------------------------------------------------- |
| `feat`     | A new feature                                           |
| `fix`      | A bug fix                                               |
| `docs`     | Documentation only                                      |
| `style`    | Formatting / whitespace (no code behavior change)       |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf`     | Performance improvement                                 |
| `test`     | Adding or updating tests                                |
| `build`    | Build system or external dependencies                   |
| `ci`       | CI configuration and scripts                            |
| `chore`    | Maintenance tasks that do not fit the above             |
| `revert`   | Reverts a previous commit                               |

### Scope (optional)

A scope narrows the change to an area of the codebase, for example:

```
feat(api): add volunteer registration endpoint
fix(ui): correct button alignment on mobile
docs(readme): clarify setup steps
```

### Description

- Use the imperative mood ("add", not "added" or "adds").
- Keep it short and focused on *what* changed.
- Do not capitalize the first letter after the colon.
- Do not end with a period.
- Say what changed, not that work happened — `update`, `fix stuff` and
  `wip` are not acceptable subjects.

### Body (optional)

Use the body to explain *why* the change was made when the subject alone
isn't enough — the reasoning, the tradeoff, or the measurement behind it.
Wrap at 72 characters and separate it from the subject with a blank line.

```
fix(sync): correct the IMU/video time base

The offset was computed against the nominal 30fps rather than the
measured 29.97, drifting ~1 frame every 33 seconds.
```

### Breaking changes

Mark a breaking change in one of these ways:

1. Append `!` after the type/scope:
   ```
   feat(api)!: change response shape for /events
   ```
2. Or add a footer:
   ```
   BREAKING CHANGE: /events no longer returns nested venue objects
   ```

### Examples

```
feat(fusion): model the wrist translation as Swing.pivot
fix(overlay): convert Z-up fusion world into OpenCV camera frame
refactor(sync): move video_probe.py file I/O into scripts/probe_videos.py
docs: move sync and fusion notes into findings/
chore: add test data
```

## Merging

- Prefer a fast-forward merge: `git merge --ff-only <branch>`.
- If history has diverged, use `git merge --no-ff <branch> -m "merge: <slug>"`.
  Keep real history — never rebase or squash silently.
- On conflicts, `git merge --abort` and resolve deliberately rather than
  guessing at a resolution.

## Pull requests

- Keep PRs focused on a single concern when possible.
- Reference related issues in the PR description.
- Ensure the commit history on the branch follows Conventional Commits.
- Be ready to update the PR based on review feedback.

## What not to commit

- Secrets and environment files — `.env`, keys, credentials. See
  `.gitignore`.
- Local editor, tooling and virtualenv directories.
- Generated or per-run output. Durable write-ups belong in `findings/`,
  which **is** committed.
- A number, threshold or default that was tuned purely to make a check
  pass. A failing check is a finding to report with evidence, not a value
  to adjust.
