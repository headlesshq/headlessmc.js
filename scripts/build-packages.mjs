// Creates the npm packages from the native executables of a HeadlessMc release: one package per platform with the
// executable, and the main package headlessmc (this repository) that starts it, see bin/headlessmc.js.
//
// Usage: node scripts/build-packages.mjs [--partial] <version> <dir with the release assets> <output dir>
//   --partial  skip platforms whose executable is missing, to test the packages without all release assets
//
// The release assets can be downloaded with
//   gh release download <version> --repo headlesshq/headlessmc --dir dist --pattern 'headlessmc-launcher-*'
// Publish the platform packages before the main package, which depends on them.

import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const partial = args[0] === '--partial';
const [version, dist, out] = partial ? args.slice(1) : args;
if (!version || !dist || !out) {
    console.error('Usage: node scripts/build-packages.mjs [--partial] <version> <dist> <out>');
    process.exit(1);
}

// HeadlessMc release tags are the plain version, e.g. 3.0.0-RC8, accept a leading v anyway
const npmVersion = version.replace(/^v/, '');
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(npmVersion)) {
    throw new Error(`${version} is not a valid semver version`);
}

const main = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

// npm platform (process.platform-process.arch) -> name of the release asset
const platforms = {
    'linux-x64': 'headlessmc-launcher-linux-x64',
    'linux-arm64': 'headlessmc-launcher-linux-arm64',
    'darwin-x64': 'headlessmc-launcher-macos-x64',
    'darwin-arm64': 'headlessmc-launcher-macos-arm64',
    'win32-x64': 'headlessmc-launcher-windows-x64.exe',
};

function write(file, json) {
    writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
}

rmSync(out, { recursive: true, force: true });
const optionalDependencies = {};
for (const [platform, asset] of Object.entries(platforms)) {
    const [os, cpu] = platform.split('-');
    const name = `${main.name}-${platform}`;
    // always depend on every platform, so that the main package is the same for --partial builds
    optionalDependencies[name] = npmVersion;

    const source = join(dist, asset);
    if (!existsSync(source)) {
        if (partial) {
            console.log(`Skipping ${name}, ${source} does not exist`);
            continue;
        }
        throw new Error(`Missing release asset ${source}`);
    }

    const dir = join(out, name);
    mkdirSync(join(dir, 'bin'), { recursive: true });
    const executable = join(dir, 'bin', os === 'win32' ? 'headlessmc.exe' : 'headlessmc');
    copyFileSync(source, executable);
    chmodSync(executable, 0o755);

    write(join(dir, 'package.json'), {
        name,
        version: npmVersion,
        description: `The ${platform} executable of ${main.name}.`,
        homepage: main.homepage,
        bugs: main.bugs,
        repository: main.repository,
        license: main.license,
        os: [os],
        cpu: [cpu],
        // the Linux executables link against glibc, see MIN_GLIBC in bin/headlessmc.js
        ...(os === 'linux' ? { libc: ['glibc'] } : {}),
        files: ['bin'],
    });
    writeFileSync(join(dir, 'README.md'), `# ${name}\n\nThe ${platform} executable of [${main.name}](https://www.npmjs.com/package/${main.name}), use that package instead.\n`);
    copyFileSync(join(root, 'LICENSE'), join(dir, 'LICENSE'));
}

if (Object.keys(optionalDependencies).every(name => !existsSync(join(out, name)))) {
    throw new Error(`No executables found in ${dist}`);
}

const dir = join(out, main.name);
mkdirSync(dir, { recursive: true });
cpSync(join(root, 'bin'), join(dir, 'bin'), { recursive: true });
copyFileSync(join(root, 'README.md'), join(dir, 'README.md'));
copyFileSync(join(root, 'LICENSE'), join(dir, 'LICENSE'));
const { private: _, scripts: __, devDependencies: ___, ...manifest } = main;
write(join(dir, 'package.json'), { ...manifest, version: npmVersion, optionalDependencies });

console.log(`Created the npm packages of version ${npmVersion} in ${out}`);
