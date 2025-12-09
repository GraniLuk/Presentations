# Local Development with Marp

This guide explains how to run Marp locally to create presentations in different formats (HTML, PDF) with Mermaid diagram rendering.

## Prerequisites

- **Node.js** (version 18 or higher recommended)
- **npm** (comes with Node.js)
- **Git** (for cloning the repository)

### Check your Node.js version
```bash
node --version
npm --version
```

## Installation

### 1. Clone the repository
```bash
git clone https://github.com/GraniLuk/Presentations.git
cd Presentations
```

### 2. Install Marp CLI globally
```bash
npm install -g @marp-team/marp-cli
```

### 3. Install Mermaid CLI globally (for diagram rendering)
```bash
npm install -g @mermaid-js/mermaid-cli
```

### 4. Verify installations
```bash
marp --version
mmdc --version
```

## Project Structure

```
Presentations/
├── .github/
│   ├── scripts/
│   │   ├── render-mermaid.js    # Mermaid pre-rendering script
│   │   └── puppeteer-config.json # Puppeteer config for CI
│   └── workflows/
│       └── convert-md.yml       # GitHub Actions pipeline
├── docs/                       # Documentation
├── 1_CloudFlare/              # Presentation folders
│   ├── cloudflare_outage_2025.md
│   ├── cloudflare_outage_2025.rendered.md  # Auto-generated
│   ├── cloudflare_outage_2025.html         # Auto-generated
│   ├── cloudflare_outage_2025.pdf          # Auto-generated
│   └── assets/mermaid/                      # Auto-generated SVGs
└── README.md
```

## Creating Presentations

### Method 1: Automated Pipeline (Recommended)

The repository includes an automated script that pre-renders Mermaid diagrams and generates multiple formats.

#### For a single presentation:
```bash
# Pre-render Mermaid diagrams and create .rendered.md
node .github/scripts/render-mermaid.js "1_CloudFlare/cloudflare_outage_2025.md" "1_CloudFlare/cloudflare_outage_2025.rendered.md"

# Generate HTML
marp "1_CloudFlare/cloudflare_outage_2025.rendered.md" -o "1_CloudFlare/cloudflare_outage_2025.html"

# Generate PDF
marp --pdf --allow-local-files "1_CloudFlare/cloudflare_outage_2025.rendered.md" -o "1_CloudFlare/cloudflare_outage_2025.pdf"
```

#### For all presentations in the repository:
```bash
# Find all .md files (excluding .rendered.md and README.md)
find . -name "*.md" -not -name "*.rendered.md" -not -name "README.md" | while read -r file; do
  dir=$(dirname "$file")
  base=$(basename "$file" .md)

  echo "Processing: $file"

  # Pre-render mermaid diagrams
  node .github/scripts/render-mermaid.js "$file" "$dir/$base.rendered.md"

  # Generate HTML and PDF
  marp "$dir/$base.rendered.md" -o "$dir/$base.html"
  marp --pdf --allow-local-files "$dir/$base.rendered.md" -o "$dir/$base.pdf"
done
```

### Method 2: Direct Marp Commands (Without Pre-rendering)

If you want to work with live Mermaid diagrams (slower rendering):

#### HTML Output
```bash
marp "1_CloudFlare/cloudflare_outage_2025.md" -o "1_CloudFlare/cloudflare_outage_2025.html"
```

#### PDF Output
```bash
marp --pdf --allow-local-files "1_CloudFlare/cloudflare_outage_2025.md" -o "1_CloudFlare/cloudflare_outage_2025.pdf"
```

#### PowerPoint Output
```bash
marp --pptx --allow-local-files "1_CloudFlare/cloudflare_outage_2025.md" -o "1_CloudFlare/cloudflare_outage_2025.pptx"
```

## Marp Command Options

### Common Options

- `--pdf`: Generate PDF output
- `--html`: Generate HTML output (default)
- `--pptx`: Generate PowerPoint output
- `--allow-local-files`: Allow loading local files (required for images)
- `--theme`: Specify theme (default, gaia, uncover)
- `--size`: Slide size (16:9, 4:3, etc.)
- `-o, --output`: Output file path

### Preview and Development

#### Live Preview (with auto-reload)
```bash
marp --watch --preview "1_CloudFlare/cloudflare_outage_2025.md"
```

#### Server Mode
```bash
marp --server "1_CloudFlare/cloudflare_outage_2025.md"
```

## Mermaid Diagram Customization

### Default Dimensions
- **Width**: 800px (auto-adjusts to fit content)
- **Height**: 300px (fits on slides without scrolling)

### Override Dimensions in Markdown
Add comments inside Mermaid code blocks:

````markdown
```mermaid
%% width: 600
%% height: 400
flowchart LR
    A --> B --> C
```
````

### Available Mermaid Themes
```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#ff0000'}}}%%
flowchart LR
    A --> B
```

## Troubleshooting

### Common Issues

#### 1. "Command not found" errors
```bash
# Reinstall CLI tools
npm install -g @marp-team/marp-cli
npm install -g @mermaid-js/mermaid-cli
```

#### 2. PDF generation fails
```bash
# Add --allow-local-files flag
marp --pdf --allow-local-files input.md -o output.pdf
```

#### 3. Mermaid diagrams not rendering in PDF
- Use the pre-rendering script (Method 1) for reliable PDF output
- Ensure Puppeteer config is available for CI environments

#### 4. Images not loading
- Use absolute paths or paths relative to the output file
- For PDF: always use `--allow-local-files`

#### 5. Font rendering issues
- Marp uses system fonts
- For consistent fonts across systems, embed fonts in CSS

### Performance Tips

- **Pre-render diagrams** for faster PDF generation
- **Use SVG format** for diagrams (better quality than PNG)
- **Compress images** before including them
- **Test on target device** before presenting

## Development Workflow

### 1. Edit Markdown
Edit `.md` files in your preferred editor with Marp syntax.

### 2. Preview Changes
```bash
marp --watch --preview "1_CloudFlare/cloudflare_outage_2025.md"
```

### 3. Generate Final Outputs
```bash
# Pre-render diagrams
node .github/scripts/render-mermaid.js "1_CloudFlare/cloudflare_outage_2025.md" "1_CloudFlare/cloudflare_outage_2025.rendered.md"

# Generate all formats
marp "1_CloudFlare/cloudflare_outage_2025.rendered.md" -o "1_CloudFlare/cloudflare_outage_2025.html"
marp --pdf --allow-local-files "1_CloudFlare/cloudflare_outage_2025.rendered.md" -o "1_CloudFlare/cloudflare_outage_2025.pdf"
```

### 4. Commit Changes
```bash
git add .
git commit -m "Update presentation with new content"
git push
```

## CI/CD Pipeline

The repository includes GitHub Actions that automatically:
- Detects changed `.md` files
- Pre-renders Mermaid diagrams
- Generates HTML and PDF outputs
- Commits the generated files back to the repository

See `.github/workflows/convert-md.yml` for details.

## Additional Resources

- [Marp Documentation](https://marp.app/)
- [Mermaid Documentation](https://mermaid.js.org/)
- [Marp CLI on GitHub](https://github.com/marp-team/marp-cli)
- [Mermaid CLI on GitHub](https://github.com/mermaid-js/mermaid-cli)