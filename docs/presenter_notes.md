# Presenter Notes in Marp Presentations

This document explains how to add presenter notes to your Marp slide decks. Presenter notes are useful for providing additional information, reminders, or scripts that are visible only to the presenter and not to the audience.

## Adding Notes to Slides

To add presenter notes to a slide, place them at the end of the slide content using HTML comments:

```markdown
# Slide Title

Your slide content here.

<!-- 
Your presenter notes here.
These notes will not appear on the slide.
You can include multiple lines.
-->
```

### Important Notes:
- Notes must be placed at the very end of the slide (after all other content).
- Use HTML comment syntax: `<!--` to start and `-->` to end.
- Notes are hidden from the audience view.

## Viewing Notes in Different Formats

### Live Presentation
- When using `marp --preview` or `marp --server`, notes appear in the presenter view.
- The preview window shows the current slide with notes in a separate panel.

### PDF Export
- To include notes in PDF: `marp --pdf --pdf-notes yourfile.md`
- Notes are added as PDF annotations (comments).
- Viewers can toggle annotations in PDF readers like Adobe Acrobat.

### HTML Export
- Notes are not included in HTML exports, as they are for audience viewing.
- Use PDF export if you need notes preserved.

### PPTX Export
- Notes are not directly embedded in PPTX.
- Use `marp --pptx --notes yourfile.md` to export notes to a separate text file.
- The text file will contain all notes from the presentation.

## Example

Here's a complete slide with notes:

```markdown
---
marp: true
---

# Introduction

Welcome to our presentation on Cloudflare outages.

<!-- 
- Start with a brief overview
- Mention the date: December 9, 2025
- Transition to next slide smoothly
-->
```

## Tips
- Keep notes concise and relevant.
- Use bullet points for easy reading during presentation.
- Test your notes in preview mode before final export.