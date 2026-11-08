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
