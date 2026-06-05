# Experimental Branch Development Guide

## Background

Our repository is forked from the official repository [multica-ai/multica](https://github.com/multica-ai/multica). For a period of time, experimental features (mobile speech, Push Notification, crash reporting, etc.) were merged directly into the `main` branch, causing our `main` to diverge from the upstream repository and preventing normal synchronization with upstream updates.

To address this, we have reorganized the repository:

1. Experimental commits were extracted from `main` and placed into a separate `experimental` branch
2. Local `main` was reset to be identical to the official repository
3. `experimental` was rebased onto the latest official `main`

---

## Repository Remote Configuration

We maintain two remote addresses:

| Name       | Address | Purpose |
|------------|---------|---------|
| `origin`   | `https://github.com/Ericwong5021/multica` | Our own fork, for daily push/pull |
| `upstream` | `https://github.com/multica-ai/multica` | Official repository, used only for syncing updates, never push directly |

**After first clone, you need to manually add upstream:**

```bash
git remote add upstream https://github.com/multica-ai/multica.git
git fetch upstream
```

Verify configuration:

```bash
git remote -v
# origin    https://github.com/Ericwong5021/multica.git (fetch)
# origin    https://github.com/Ericwong5021/multica.git (push)
# upstream  https://github.com/multica-ai/multica.git (fetch)
# upstream  https://github.com/multica-ai/multica.git (push)
```

---

## Branch Structure

```
upstream/main  ──A──B──C──D──E──F  (official latest)
                                │
          origin/main  ─────────┘  (synced with official)
                                │
       origin/experimental  ────┴──X1──X2──X3──...  (our experimental features)
```

- **`main`**: Always tracks `upstream/main`, only for syncing — never develop here
- **`experimental`**: Collection of all experimental features, always rebased on top of `main`

### Commits on the experimental branch (as of 2026-06-05)

| Commit      | Description |
|-------------|-------------|
| `245eb3ddb` | Add Prompt Engineer onboarding template |
| `0381f79b9` | ci: add mobile EAS release workflow |
| `b6f45b755` | Add governance policy inspection surface |
| `b8b55023c` | LUM-242: add mobile chat speech MVP |
| `359b9eb17` | Productionize speech provider proxy |
| `c754cb9f7` | LUM-248: Mobile runtime backend URL config |
| `cdd58df78` | Add mobile crash reporting baseline |
| `9f9fa726d` | feat: add mobile push notifications |
| `b5cc0a96b` | LUM-240: Add mobile agent voice call flow |

---

## Day-to-Day Development Workflow

### Adding a new feature on the experimental branch

```bash
# 1. Switch to the experimental branch
git checkout experimental

# 2. Develop normally and commit
git add <files>
git commit -m "feat: your feature"

# 3. Push to origin
git push origin experimental
```

### Developing an independent feature (recommended)

For larger features, it is recommended to create a branch from `experimental`, develop there, and merge back:

```bash
git checkout -b feat/my-feature experimental
# ... develop ...
git checkout experimental
git merge feat/my-feature
git push origin experimental
```

---

## Syncing Upstream Updates (Most Important)

When the official repository has new commits:

1. Update local `main` to track official
2. Rebase `experimental` onto the new `main`

```bash
# Step 1: Fetch latest from upstream
git fetch upstream

# Step 2: Update local main (fast-forward, no conflicts)
git checkout main
git merge --ff-only upstream/main
git push origin main

# Step 3: Rebase experimental onto new main
git checkout experimental
git rebase upstream/main

# Step 4: Force-push the updated experimental (rebase rewrites history)
git push origin experimental --force-with-lease
```

> **Why `--force-with-lease` instead of `--force`?**
> `--force-with-lease` checks whether the remote has new commits that you don't have locally before force-pushing, preventing accidental overwrites of content that others have pushed.

---

## Handling Rebase Conflicts

During a rebase, Git will pause and show conflict markers:

```
CONFLICT (content): Merge conflict in server/internal/handler/handler.go
error: could not apply abc1234... your commit message
```

**Steps to resolve:**

```bash
# 1. See which files have conflicts
git diff --name-only --diff-filter=U

# 2. Open conflicted files and resolve manually
# <<<<<<< HEAD          ← content from upstream/main (official additions)
# ...official code...
# =======
# ...your experimental code...
# >>>>>>> abc1234       ← your commit

# 3. Edit the file, remove conflict markers, keep both sides as needed

# 4. Mark conflicts as resolved
git add <conflicted-files>

# 5. Continue rebase
git rebase --continue
```

**If a commit's conflict is too complex, you can skip it:**

```bash
git rebase --skip
```

**If you want to abandon the entire rebase and return to the pre-rebase state:**

```bash
git rebase --abort
```

### Common Conflict Types

**Struct/Type new fields**: Both official and we added fields to the same struct — keep both:

```go
// Resolution: merge fields from both sides, keep all
type Config struct {
    // Official new field
    AttachmentDownloadMode string
    // Our new field
    Speech SpeechConfig
}
```

**Changes in different parts of the same file**: Usually Git can auto-merge; when resolving manually, pay attention to logical integrity.

---

## Quick Reference Commands

```bash
# See what commits experimental has that upstream/main doesn't
git log upstream/main..experimental --oneline

# See the divergence point between the two branches
git merge-base experimental upstream/main

# Check current rebase progress
git rebase --show-current-patch

# Check if local main is synced with official
git fetch upstream && git log HEAD..upstream/main --oneline
# If no output, you're up to date
```

---

## Important Notes

1. **Never develop directly on `main`**. `main` only tracks official and stays clean for easy syncing.
2. **After every rebase, force-push `experimental`** because rebase rewrites commit history. Team members need to resync after a force-push:
   ```bash
   git fetch origin
   git checkout experimental
   git reset --hard origin/experimental
   ```
3. **Do not use `git merge upstream/main` to sync**. Merge creates extra merge commits that complicate history. Rebase keeps the commit history linear and clean.
