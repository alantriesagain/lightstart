#!/usr/bin/env bash
#
# Build the site and refresh the `gh-pages` branch with the result, so GitHub
# Pages serves a static copy on the custom domain.
#
#   website/scripts/publish-pages.sh            # build and commit locally
#   website/scripts/publish-pages.sh --push     # ... and push to origin
#
# The branch is written from a temporary worktree, so the checkout you run
# this from is never touched. CUSTOM_DOMAIN overrides the domain written to
# CNAME (default: lightstart.dev).
set -euo pipefail

repo="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
website="$repo/website"
branch="gh-pages"
domain="${CUSTOM_DOMAIN:-lightstart.dev}"
push=0
for arg in "$@"; do
  case "$arg" in
    --push) push=1 ;;
    -h|--help) sed -n '2,11p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $arg" >&2; exit 64 ;;
  esac
done

echo "▸ building $website"
(cd "$website" && node scripts/static-export.mjs)

build="$(ls -1dt "$website"/.deployed/builds/*/ | head -1)"
[ -n "$build" ] || { echo "no build in $website/.deployed/builds" >&2; exit 1; }
echo "▸ publishing $(basename "${build%/}") to $branch"

tmp="$(mktemp -d)"
trap 'git -C "$repo" worktree remove --force "$tmp" >/dev/null 2>&1 || rm -rf "$tmp"' EXIT

git -C "$repo" worktree add --detach "$tmp" >/dev/null
if git -C "$tmp" rev-parse --verify --quiet "refs/heads/$branch" >/dev/null; then
  git -C "$tmp" checkout --quiet "$branch"
else
  git -C "$tmp" checkout --quiet --orphan "$branch"
fi

git -C "$tmp" rm -rqf . >/dev/null 2>&1 || true
find "$tmp" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a "${build%/}/." "$tmp/"
printf '%s\n' "$domain" > "$tmp/CNAME"
touch "$tmp/.nojekyll"

git -C "$tmp" add -A
if git -C "$tmp" diff --cached --quiet; then
  echo "▸ no changes to publish"
else
  git -C "$tmp" -c commit.gpgsign=false commit -q -m "Publish the built website for $domain"
  echo "▸ committed $(git -C "$tmp" rev-parse --short HEAD) on $branch"
fi

if [ "$push" -eq 1 ]; then
  git -C "$tmp" push origin "$branch"
  echo "▸ pushed $branch to origin"
fi
