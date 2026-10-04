# CV Builder

Browser-based CV builder with **live preview**, **Word (.docx)** export, and **install-as-app (PWA)** support.  
Everything runs **in your browser** — no server, no accounts, no uploads of your data.

## Install as an app (PWA)

After you open the site over **HTTPS** (GitHub Pages) or `localhost`:

| Platform | How |
|----------|-----|
| **Chrome / Edge (desktop)** | Click **Install app** in the header, or the ⊕ install icon in the address bar |
| **Android Chrome** | **Install app** button, or menu → *Install app* / *Add to Home screen* |
| **iPhone / iPad (Safari)** | Share → **Add to Home Screen** (iOS does not show a custom install button) |

Once installed it opens full-screen (standalone), works offline for the UI shell, and keeps drafts in this device’s browser storage.

## New in v2

- **CV health** score with fix-it links (email, length, action verbs, measurable results, page count)
- **Section jump bar** + progress line in a sticky header
- **Undo / redo** (Alt+Z / Alt+Shift+Z), **My CVs** (several saved versions + auto-backup)
- **Dark mode**, accent colour presets, preview zoom, page-break guides, live page count
- **Copy as plain text** for online application forms
- Shortcuts: Ctrl/⌘+S save Word, Ctrl/⌘+P print
- Faster: Word library loads on demand, preview skips unchanged renders, stale-while-revalidate offline cache
- Mobile preview opens as a full-screen sheet

## What’s included

- Inline section headings (✎ or double-click)
- Drag-and-drop + ▲▼ reorder
- Auto-save draft (`localStorage`)
- Auto-collapse empty sections
- Templates: Fresher, Professional, Europass-style, Academic, Minimal ATS
- Skill proficiency levels
- Export / import JSON
- Self-hosted `docx` library (offline Word generation after cache)
- Photo crop + resize presets
- Keyboard focus rings, reduced-motion support
- Responsive layout (sticky actions on mobile, safe-area insets)
- **PWA**: manifest, service worker, icons, install prompt

## What is *not* built (possible later)

These are common extras **not** in this version — say if you want any:

- Multi-column / creative visual templates  
- Cloud sync across devices  
- Real AI writing (current suggestions are rule-based)  
- LinkedIn import  
- Cover-letter companion  
- Multiple saved profiles in one browser  
- Collaboration / share link  

## Local run

```bash
npx serve .
# or
python3 -m http.server 8080
```

Open the printed URL (prefer a local server over `file://`).

## Deploy to GitHub Pages

```bash
git init
git add index.html styles.css app.js enhance.js sw.js manifest.webmanifest \
  lib/ icons/ README.md .gitignore
git commit -m "CV Builder PWA"
git branch -M main
git remote add origin https://github.com/YOUR_USER/cv-builder.git
git push -u origin main
```

**Settings → Pages → Deploy from branch → `main` / root**  
Site: `https://YOUR_USER.github.io/cv-builder/`

PWA install requires HTTPS (Pages provides that).

## Layout

```
.
├── index.html
├── styles.css
├── app.js
├── enhance.js            # v2 features
├── sw.js                 # service worker
├── manifest.webmanifest
├── icons/                # 192, 512, apple-touch, favicon
├── lib/docx.umd.js
├── README.md
└── .gitignore
```

## Privacy

No analytics backend. Drafts stay in `localStorage` on your device.  
Photos/signatures only appear in files **you** download.

## Credits

Md. Habib Hasan Himel — CV Builder.  
`docx`: [dolanmiu/docx](https://github.com/dolanmiu/docx). Not affiliated with Europass / EU.
