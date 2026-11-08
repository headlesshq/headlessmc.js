# headlessmc.js

<img src="https://raw.githubusercontent.com/headlesshq/headlessmc/main/logo.svg" alt="HeadlessMc logo" width="160">

[HeadlessMc](https://github.com/headlesshq/headlessmc) is a command line launcher for Minecraft: Java Edition.
It can run the Minecraft client in headless mode, e.g. on CI/CD runners, handles mod loaders, modpacks, mods,
resourcepacks, shaderpacks and datapacks, and manages servers.
This Javascript package allows you to install and run HeadlessMc through node.

```shell
npm install -g headlessmc
headlessmc login
headlessmc launch fabric 26.3
```

Or:

```shell
npx headlessmc launch fabric 26.3 -lwjgl
```

## Development container

The repository contains a [development container](https://containers.dev/) in `.devcontainer/devcontainer.json`
with Node 24, the version used by CI. HeadlessMc is started through its native executables, so Java is not needed.
Open the repository in an editor that supports development containers, or use the
[devcontainer CLI](https://github.com/devcontainers/cli):

```shell
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . bash
```

The npm cache is kept in the `headlessmc-js-npm-cache` volume. Inside the container, the packages can be built from
the executables of a HeadlessMc release and tested like in `.github/workflows/test.yml`:

```shell
TAG=<release tag of headlesshq/headlessmc>
mkdir -p dist
curl -fL -o dist/headlessmc-launcher-linux-x64 \
  "https://github.com/headlesshq/headlessmc/releases/download/$TAG/headlessmc-launcher-linux-x64"
npm run build -- --partial "$TAG" dist npm-out
mkdir -p npm-tgz
for package in npm-out/*/; do npm pack "$package" --pack-destination npm-tgz; done
npm install -g --prefix /tmp/npm ./npm-tgz/*.tgz
/tmp/npm/bin/headlessmc --version
```

Use `headlessmc-launcher-linux-arm64` on arm64 machines.
