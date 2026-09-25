// Bumps package.json's patch version before every production build (see
// package.json's "prebuild" script) - deliberately NOT wired into
// prestart/pretest, so local dev servers and test runs don't inflate the
// release version. generate-version.js runs right after this and stamps
// the new version (plus commit hash + build date) into version.ts.
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const parts = String(pkg.version || '0.0.0').split('.').map((part) => parseInt(part, 10) || 0);
parts[2] = (parts[2] || 0) + 1;
pkg.version = parts.join('.');

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Bumped package.json version to ${pkg.version}`);
