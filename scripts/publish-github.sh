#!/usr/bin/env bash
set -euo pipefail

repo_name="${1:-hryes}"
description="${2:-HRYES desktop clients and shared resume analysis server.}"

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd -- "$script_dir/.." && pwd)"
cd "$repo_dir"

if ! command -v git >/dev/null 2>&1; then
  echo "Git is not installed or is not available in PATH." >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is not installed or is not available in PATH." >&2
  echo 'If it is already installed on Windows, run:' >&2
  echo 'export PATH="/c/Program Files/GitHub CLI:$PATH"' >&2
  exit 1
fi

git_cmd() {
  git -c "safe.directory=$repo_dir" "$@"
}

if [ ! -d ".git" ]; then
  git init
fi

git_cmd add .

if git_cmd diff --cached --quiet; then
  if ! git_cmd rev-parse --verify HEAD >/dev/null 2>&1; then
    echo "No files are staged for the first commit." >&2
    exit 1
  fi
else
  git_cmd commit -m "Initial public project cleanup"
fi

git_cmd branch -M main

if ! git_cmd remote get-url origin >/dev/null 2>&1; then
  gh repo create "$repo_name" --public --description "$description"
  owner="$(gh api user --jq .login)"
  git_cmd remote add origin "https://github.com/$owner/$repo_name.git"
fi

git_cmd push -u origin main

echo "Published public repository: $repo_name"
