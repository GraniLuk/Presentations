#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

if (process.argv.length < 4) {
    console.error('Usage: render-mermaid.js <input.md> <output.rendered.md>');
    process.exit(2);
}

const input = process.argv[2];
const output = process.argv[3];

const content = fs.readFileSync(input, 'utf8');
const mermaidRegex = /```mermaid([\s\S]*?)```/g;
let match;
let idx = 0;
const assetsDir = path.join(path.dirname(output), 'assets', 'mermaid');
fs.mkdirSync(assetsDir, { recursive: true });

let rendered = content.replace(mermaidRegex, (m, code) => {
    idx += 1;
    const filename = `mermaid-${idx}.svg`;
    const outPath = path.join(assetsDir, filename);

    const tmpFile = path.join(assetsDir, `tmp-${idx}.mmd`);
    fs.writeFileSync(tmpFile, code.trim());

    const res = spawnSync('mmdc', ['-i', tmpFile, '-o', outPath], { encoding: 'utf8' });
    if (res.error) {
        console.error('Failed to run mmdc:', res.error);
        return m; // leave original block
    }
    if (res.status !== 0) {
        console.error('mmdc stderr:', res.stderr);
        return m;
    }

    // remove tmp file
    try { fs.unlinkSync(tmpFile); } catch (e) { console.error(`Failed to delete temporary file ${tmpFile}:`, e); }

    // return markdown image link (relative path)
    const relPath = path.relative(path.dirname(output), outPath).replace(/\\/g, '/');
    return `![](${relPath})`;
});

fs.writeFileSync(output, rendered, 'utf8');
console.log(`Rendered mermaid diagrams to ${assetsDir} and wrote ${output}`);
