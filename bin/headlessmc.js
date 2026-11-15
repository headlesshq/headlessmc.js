#!/usr/bin/env node
// Starts the native HeadlessMc executable for this platform, like esbuild or biome do.
// npm installs only the optional dependency that matches os, cpu and libc, which contains the executable.
// On musl systems (e.g. Alpine Linux) that is the fully static linux-x64-musl executable, which also runs where the
// glibc executable cannot, e.g. with an older glibc or without the glibc loader (NixOS), if it has been installed.
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');

const DOCS = 'https://headlesshq.github.io/headlessmc/getting-started/';
// Newest glibc symbol version the Linux executables link against, keep in sync with MIN_GLIBC in scripts/install.sh of headlesshq/headlessmc
const MIN_GLIBC = '2.34';

const platform = `${process.platform}-${process.arch}`;
// keep in sync with the scope in scripts/build-packages.mjs
const platformPackage = `@headlesshq/headlessmc-${platform}`;
// fully static, only built for linux-x64, see scripts/build-packages.mjs
const muslPackage = `${platformPackage}-musl`;
const executable = process.platform === 'win32' ? 'headlessmc.exe' : 'headlessmc';
// the dynamic loader the glibc executables are linked against, keep in sync with scripts/install.sh of headlesshq/headlessmc
const glibcLoaders = { x64: '/lib64/ld-linux-x86-64.so.2', arm64: '/lib/ld-linux-aarch64.so.1' };

function fail(message) {
    console.error(`headlessmc: ${message}
Instead, you can run the headlessmc.jar with Java 25 or newer, see ${DOCS}`);
    process.exit(1);
}

function glibcVersion() {
    try {
        process.report.excludeNetwork = true;
        return process.report.getReport().header.glibcVersionRuntime;
    } catch {
        return undefined;
    }
}

function versionLessThan(a, b) {
    const x = a.split('.').map(Number);
    const y = b.split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
        if ((x[i] || 0) !== (y[i] || 0)) {
            return (x[i] || 0) < (y[i] || 0);
        }
    }
    return false;
}

function resolve(name) {
    try {
        return require.resolve(`${name}/bin/${executable}`);
    } catch {
        return undefined;
    }
}

// node reports no glibc version if it has been built against musl
const musl = process.platform === 'linux' && !glibcVersion();

// why the glibc executable cannot run on this system, or undefined if it can
function glibcProblem() {
    if (musl) {
        return 'this system uses musl libc (e.g. Alpine Linux)';
    }
    const glibc = glibcVersion();
    if (versionLessThan(glibc, MIN_GLIBC)) {
        return `this system has glibc ${glibc}, the HeadlessMc executable needs glibc ${MIN_GLIBC} or newer`;
    }
    const loader = glibcLoaders[process.arch];
    if (loader && !fs.existsSync(loader)) {
        return `this system has no ${loader} (e.g. NixOS)`;
    }
    return undefined;
}

let path;
if (process.platform !== 'linux') {
    path = resolve(platformPackage);
} else {
    const problem = glibcProblem();
    // on musl systems npm only installs the musl package, on glibc systems only the glibc package,
    // unless the musl package has been installed explicitly, which is needed where glibc is too old or missing
    path = (problem ? undefined : resolve(platformPackage)) || resolve(muslPackage);
    if (!path && problem) {
        let hint = `there is no static musl executable for ${platform}.`;
        if (process.arch === 'x64') {
            const { version } = require('../package.json');
            hint = musl
                ? `npm skipped the optional dependency ${muslPackage} (e.g. with --omit=optional).`
                : `install the static musl executable where headlessmc is installed: npm install --force ${muslPackage}@${version} (with -g for a global headlessmc)`;
        }
        fail(`${problem}, ${hint}`);
    }
}

if (!path) {
    fail(`there is no HeadlessMc executable for ${platform}, or npm skipped the optional dependency ${platformPackage} (e.g. with --omit=optional).`);
}

// the executable bit can get lost, e.g. when a package is extracted by another tool
if (process.platform !== 'win32') {
    try {
        fs.accessSync(path, fs.constants.X_OK);
    } catch {
        fs.chmodSync(path, 0o755);
    }
}

// HeadlessMc is an interactive console, so stdin, stdout and stderr are passed through untouched
const child = spawn(path, process.argv.slice(2), { stdio: 'inherit' });

// Ctrl+C in a terminal reaches the whole process group, so the executable already receives SIGINT and SIGQUIT itself
// and decides what to do with them. Ignore them here, so that this wrapper does not exit before the executable.
const ignored = ['SIGINT', 'SIGQUIT'];
const forwarded = ['SIGTERM', 'SIGHUP'];
const handlers = new Map();
for (const signal of ignored) {
    handlers.set(signal, () => {});
}
for (const signal of forwarded) {
    handlers.set(signal, () => child.kill(signal));
}
for (const [signal, handler] of handlers) {
    process.on(signal, handler);
}

child.on('error', error => {
    console.error(`headlessmc: could not start ${path}: ${error.message}`);
    process.exit(1);
});

child.on('exit', (code, signal) => {
    if (signal) {
        // die by the same signal, so that callers see the same exit status as without this wrapper
        for (const [name, handler] of handlers) {
            process.off(name, handler);
        }
        process.kill(process.pid, signal);
        // fallback if the signal does not terminate this process, e.g. on Windows
        process.exit(128 + (os.constants.signals[signal] || 0));
    }
    process.exit(code ?? 1);
});
