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

    const widthRegex = /%%\s*width:\s*(\d+)/;
    const widthMatch = code.match(widthRegex);
    let width = 800; // Default width is narrower to fit slides
    if (widthMatch) {
        width = parseInt(widthMatch[1], 10);
        code = code.replace(widthRegex, '').trim(); // also remove the comment
    }

    let height = 300; // Default height keeps diagrams visible without scrolling
    const heightRegex = /%%\s*height:\s*(\d+)/;
    const heightMatch = code.match(heightRegex);
    if (heightMatch) {
        height = parseInt(heightMatch[1], 10);
        code = code.replace(heightRegex, '').trim();
    }

    const tmpFile = path.join(assetsDir, `tmp-${idx}.mmd`);
    fs.writeFileSync(tmpFile, code.trim());

    // Use puppeteer config for CI environments (no-sandbox mode)
    const puppeteerConfigPath = path.join(__dirname, 'puppeteer-config.json');
    const mmcdArgs = ['-i', tmpFile, '-o', outPath, '-w', width.toString(), '-H', height.toString()];
    if (fs.existsSync(puppeteerConfigPath)) {
        mmcdArgs.push('-p', puppeteerConfigPath);
    }
    if (fs.existsSync(puppeteerConfigPath)) {
        mmcdArgs.push('-p', puppeteerConfigPath);
    }

    const res = spawnSync('mmdc', mmcdArgs, { encoding: 'utf8' });
    if (res.error) {
        console.error('Failed to run mmdc:', res.error);
        return m; // leave original block
    }
    if (res.status !== 0) {
        console.error(`mmdc failed for ${filename}:`);
        console.error(res.stderr);
        // remove tmp file
        try { fs.unlinkSync(tmpFile); } catch (e) { /* ignore */ }
        return m; // leave original block
    }

    // remove tmp file
    try { fs.unlinkSync(tmpFile); } catch (e) { console.error(`Failed to delete temporary file ${tmpFile}:`, e); }

    // return markdown image link (relative path)
    const relPath = path.relative(path.dirname(output), outPath).replace(/\\/g, '/');
    return `![](${relPath})`;
});

fs.writeFileSync(output, rendered, 'utf8');
console.log(`Rendered mermaid diagrams to ${assetsDir} and wrote ${output}`);
