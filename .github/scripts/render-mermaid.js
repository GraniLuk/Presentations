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

    // Use puppeteer config for CI environments (no-sandbox mode)
    const puppeteerConfigPath = path.join(__dirname, 'puppeteer-config.json');
    const mmcdArgs = ['-i', tmpFile, '-o', outPath];
    if (fs.existsSync(puppeteerConfigPath)) {
        mmcdArgs.push('-p', puppeteerConfigPath);
    }

    const res = spawnSync('mmdc', mmcdArgs, { encoding: 'utf8' });
    if (res.error) {
        console.error('Failed to run mmdc:', res.error);
        return m; // leave original block
    }
    if (res.status !== 0) {
        // mmdc failed (parser errors or unsupported diagram). Instead of
        // printing the full stderr (which clutters CI logs), write a small
        // placeholder SVG so the markdown still references an image.
        try {
            const placeholder = `<?xml version="1.0" encoding="UTF-8"?>\n` +
                `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="120">` +
                `<rect width="100%" height="100%" fill="#fff"/>` +
                `<text x="10" y="24" font-size="16" fill="#b00020">Mermaid render failed: diagram skipped</text>` +
                `<text x="10" y="48" font-size="12" fill="#333">File: ${filename}</text>` +
                `</svg>`;
            fs.writeFileSync(outPath, placeholder, 'utf8');
        } catch (e) {
            // If placeholder write fails, fallback to leaving original block.
            return m;
        }
        // don't log the full mmdc stderr to CI; only a short warning
        console.warn(`mmdc failed for ${filename}; inserted placeholder image.`);
        // remove tmp file
        try { fs.unlinkSync(tmpFile); } catch (e) { /* ignore */ }
        const relPath = path.relative(path.dirname(output), outPath).replace(/\\/g, '/');
        return `![](${relPath})`;
    }

    // remove tmp file
    try { fs.unlinkSync(tmpFile); } catch (e) { console.error(`Failed to delete temporary file ${tmpFile}:`, e); }

    // return markdown image link (relative path)
    const relPath = path.relative(path.dirname(output), outPath).replace(/\\/g, '/');
    return `![](${relPath})`;
});

fs.writeFileSync(output, rendered, 'utf8');
console.log(`Rendered mermaid diagrams to ${assetsDir} and wrote ${output}`);
