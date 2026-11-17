# Ivy Piano Trainer

Version 1.0 prototype — a browser-based piano practice tool.

## Features

- Image and PDF page upload, contrast, rotation, crop and PNG export.
- Uncompressed score-partwise MusicXML import and manual note editing.
- Left/right hand display, octave labels and an 88-key visual keyboard.
- Countdown, tempo, speed, play, pause and reset.

## Run locally

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://localhost:8000 in a modern browser.

## Practice workflow

1. Upload and prepare sheet music; download the prepared PNG.
2. Recognize it locally with [Audiveris](https://audiveris.github.io/audiveris/) and export uncompressed MusicXML.
3. Import MusicXML and check the notes against the original score.
4. Set tempo, speed, countdown and hand selection; press Play.

Manual notes use one line per step: `beats | left hand | right hand`.
For example: `1 | C3 E3 | C4`. Use `-` for rests. C4 is middle C.

## GitHub Pages

Upload index.html, style.css, script.js and README.md to your repository. In Settings > Pages, choose Deploy from a branch, main, / (root), then Save.

## Privacy and limitations

Files are processed locally in the browser. PDF.js is downloaded from jsDelivr when needed. Automatic image-to-note recognition is not integrated. Playback is visual, with manual tempo; complex notation, repeats and hand crossings may require corrections. No guaranteed offline support. Check imported notes before practice.
