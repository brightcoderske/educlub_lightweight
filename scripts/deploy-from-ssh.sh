#!/usr/bin/env bash
#
# Manual deploy from the HostAfrica (cPanel) shell.
#
# Use this when the code is pushed to GitHub and cPanel's Git Version Control
# has not pulled it. It performs the same steps as .cpanel.yml, plus the fetch
# that cPanel would normally do, then hands over to deploy-cpanel-git.sh.
#
#   bash scripts/deploy-from-ssh.sh
#
# Only the backend is deployed here. The React app lives on Vercel and ships
# from GitHub on its own; see docs/PRODUCTION_DEPLOYMENT.md.

set -Eeuo pipefail

GIT_DIR_PATH="/home/codecham/domains/learn.educlub.co.ke/educlub-lightweight.git"
WORK_TREE="/home/codecham/domains/learn.educlub.co.ke/educlub-source"
BRANCH="main"
SSH_KEY="$HOME/.ssh/github_educlub"

git_bare() {
  git --git-dir="$GIT_DIR_PATH" "$@"
}

if [[ ! -d "$GIT_DIR_PATH" ]]; then
  echo "Repository not found at $GIT_DIR_PATH" >&2
  exit 1
fi

if [[ ! -d "$WORK_TREE" ]]; then
  echo "Work tree not found at $WORK_TREE" >&2
  exit 1
fi

# Persisted in the repo config, so this is a no-op after the first run. Without
# IdentitiesOnly the agent may offer a different key and GitHub rejects it.
if [[ -f "$SSH_KEY" ]]; then
  git_bare config core.sshCommand "ssh -i $SSH_KEY -o IdentitiesOnly=yes"
fi

before="$(git_bare rev-parse --short "$BRANCH" 2>/dev/null || echo none)"

# The refspec matters. Plain "git fetch origin main" only writes FETCH_HEAD and
# leaves refs/heads/main where it was, so the checkout below would redeploy the
# commit already on the server. "main:main" moves the local branch itself.
git_bare fetch origin "$BRANCH:$BRANCH"

after="$(git_bare rev-parse --short "$BRANCH")"
echo "branch $BRANCH: $before -> $after"

if [[ "$before" == "$after" ]]; then
  echo "Already at $after; nothing new was fetched."
fi

git_bare --work-tree="$WORK_TREE" checkout -f "$BRANCH"

# deploy-cpanel-git.sh reads its source from the current directory and refuses
# to run anywhere that is not the repository root.
cd "$WORK_TREE"
echo "deploying $(git_bare rev-parse --short "$BRANCH") from $WORK_TREE"
bash scripts/deploy-cpanel-git.sh
