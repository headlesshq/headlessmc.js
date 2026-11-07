# headlessmc

<img src="https://raw.githubusercontent.com/headlesshq/headlessmc/main/logo.svg" alt="HeadlessMc logo" width="160">

[HeadlessMc](https://github.com/headlesshq/headlessmc) is a command line launcher for Minecraft: Java Edition.
It can run the Minecraft client in headless mode, e.g. on CI/CD runners, handles mod loaders, modpacks, mods,
resourcepacks, shaderpacks and datapacks, and manages servers.

```shell
npm install -g headlessmc
headlessmc login
headlessmc launch fabric 26.3
```

Or run it without installing:

```shell
npx headlessmc launch fabric 26.3 -lwjgl
```

This package starts the native HeadlessMc executable for your platform (Windows x64, Linux x64/arm64 with glibc
2.34 or newer, macOS x64/arm64), which npm installs as an optional dependency, so no Java installation is needed for
HeadlessMc itself. On other platforms, run the `headlessmc.jar` from the
[GitHub releases](https://github.com/headlesshq/headlessmc/releases) with Java 25 or newer.

See the [documentation](https://headlesshq.github.io/headlessmc/getting-started/) to get started.
Issues with HeadlessMc itself belong in [headlesshq/headlessmc](https://github.com/headlesshq/headlessmc/issues),
issues with the npm package in [headlesshq/headlessmc.js](https://github.com/headlesshq/headlessmc.js/issues).

## Development

This repository only contains the npm wrapper, the executables come from the
[HeadlessMc releases](https://github.com/headlesshq/headlessmc/releases).
Every release of HeadlessMc gets published to npm with the same version by the
[publish workflow](.github/workflows/publish.yml): HeadlessMc dispatches a `headlessmc-release` event to this
repository, a daily check catches releases whose dispatch got lost, and it can be started manually for a tag.

To build and try the packages locally:

```shell
gh release download 3.0.0-RC8 --repo headlesshq/headlessmc --dir dist --pattern 'headlessmc-launcher-*'
node scripts/build-packages.mjs 3.0.0-RC8 dist npm-out
for package in npm-out/*/; do npm pack "$package" --pack-destination npm-tgz; done
npm install -g --prefix /tmp/hmc-npm npm-tgz/*.tgz
/tmp/hmc-npm/bin/headlessmc --version
```

### Publishing setup

Packages: `headlessmc`, `headlessmc-linux-x64`, `headlessmc-linux-arm64`, `headlessmc-darwin-x64`,
`headlessmc-darwin-arm64` and `headlessmc-win32-x64`.

1. Create the GitHub environment `npm` in this repository (optionally restricted to `main`).
2. First publish: npm trusted publishing can only be configured for existing packages, so add an
   [npm granular access token](https://docs.npmjs.com/creating-and-viewing-access-tokens) with publish rights as the
   secret `NPM_TOKEN` of the `npm` environment and run the publish workflow once.
3. For each of the six packages, configure a trusted publisher on npmjs.com (package settings → Trusted Publisher →
   GitHub Actions): organization `headlesshq`, repository `headlessmc.js`, workflow `publish.yml`, environment `npm`.
4. Delete the `NPM_TOKEN` secret (and revoke the token), afterwards the workflow publishes via OIDC with provenance.
   Optionally set "Require two-factor authentication and disallow tokens" in the package settings.
5. In headlesshq/headlessmc, add the secret `HEADLESSMC_JS_TOKEN`: a fine-grained token with
   "Contents: read and write" on headlesshq/headlessmc.js, used to dispatch the release event.
