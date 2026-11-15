#!/usr/bin/env bash
# Checks the headlessmc installed from the npm packages, see .github/workflows/test.yml.
# Usage: scripts/test-installed.sh <HeadlessMc version> <HeadlessMc files directory>
set -euo pipefail

expected="${1#v}"
# --version prints "HeadlessMc <version>" (only "<version>" up to 3.0.0-RC8),
# followed by a notice if a newer release is available
version="$(headlessmc --version | head -n 1 | tr -d '\r')"
echo "$version"
version="${version#HeadlessMc }"
if [[ "$version" != "$expected" ]]; then
  echo "::error::expected '$expected', but got '$version'"
  exit 1
fi
headlessmc "-Dhmc.files.location=$2" help
