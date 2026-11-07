#!/usr/bin/env node
// Starts the native HeadlessMc executable for this platform, like esbuild or biome do.
// npm installs only the optional dependency that matches os, cpu and libc, which contains the executable.
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');

const DOCS = 'https://headlesshq.github.io/headlessmc/getting-started/';
// Newest glibc symbol version the Linux executables link against, keep in sync with MIN_GLIBC in scripts/install.sh of headlesshq/headlessmc
const MIN_GLIBC = '2.34';

const platform = `${process.platform}-${process.arch}`;
const executable = process.platform === 'win32' ? 'headlessmc.exe' : 'headlessmc';

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

let path;
try {
    path = require.resolve(`headlessmc-${platform}/bin/${executable}`);
} catch {
    let reason = `there is no HeadlessMc executable for ${platform}`;
    if (process.platform === 'linux' && !glibcVersion()) {
        reason += ' with musl libc (e.g. Alpine Linux)';
    }
    fail(`${reason}, or npm skipped the optional dependency headlessmc-${platform} (e.g. with --omit=optional).`);
}

if (process.platform === 'linux') {
    const glibc = glibcVersion();
    if (glibc && versionLessThan(glibc, MIN_GLIBC)) {
        fail(`this system has glibc ${glibc}, the HeadlessMc executable needs glibc ${MIN_GLIBC} or newer.`);
    }
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
