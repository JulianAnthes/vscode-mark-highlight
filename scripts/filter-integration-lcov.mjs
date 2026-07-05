// Trims the integration coverage report down to the vscode-coupled layer.
//
// The integration run measures the bundled dist/extension.js and remaps it back
// to src/*.ts via source map. That bundle also contains src/core/** and the
// inlined node_modules, and c8's line-granularity on the bundle is finer than
// vitest's v8 report. If those files stayed in the integration report, Codecov
// would merge two differently-grained reports for the same file and show false
// gaps on code the unit suite already covers fully.
//
// So: keep only the files that vitest CANNOT reach (the vscode-coupled layer),
// and let the unit report remain the sole source of truth for core/ and
// tsPlugin/. Usage: node scripts/filter-integration-lcov.mjs <path-to-lcov>
import { readFileSync, writeFileSync } from 'fs';

const path = process.argv[2];
if (!path) {
    console.error('usage: filter-integration-lcov.mjs <lcov-file>');
    process.exit(1);
}

const keep = (sf) =>
    /(^|\/)src\//.test(sf) &&
    !/(^|\/)src\/core\//.test(sf) &&
    !/(^|\/)src\/tsPlugin\//.test(sf) &&
    !/\.(test|spec)\.[cm]?[jt]s$/.test(sf);

const records = readFileSync(path, 'utf8')
    .split('end_of_record')
    .map((r) => r.replace(/^\s+/, ''))
    .filter((r) => r.includes('SF:'));

const kept = records.filter((r) => {
    const m = r.match(/^SF:(.*)$/m);
    return m && keep(m[1].trim());
});

writeFileSync(
    path,
    kept.map((r) => r.trimEnd() + '\nend_of_record\n').join(''),
);
console.error(
    `filter-integration-lcov: kept ${kept.length}/${records.length} files`,
);
