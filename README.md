# Ivy Piano Trainer

Version 1.2 — write or paste notes, then practice on piano or guitar.

## New in 1.2

- No Audiveris needed: type or paste notes in a simple text format (guide built into the page).
- Format guide for piano and guitar, plus example songs (original "Yahweh" melody,
  Ode to Joy, Twinkle Twinkle).
- Guitar can be written as letters or tab style `string/fret` (e.g. `2/1`).
- Real piano (sampled grand) and nylon guitar sounds via smplr; synth fallback if offline.

## Note format

One line per step: `beats | left hand | right hand`

- Letters C D E F G A B, `#` sharp, `b` flat, number = octave (C4 = middle C).
- No octave: left hand 3, right hand 4. `-` = rest. Lines starting with `#` are comments.
- Guitar tab style: `string/fret`, string 1 = high E ... 6 = low E, e.g. `1 | - | 2/1`.

## Run locally

    python3 -m http.server 8000 --bind 127.0.0.1

Open http://localhost:8000 in a modern browser.

## GitHub Pages

Upload index.html, style.css, script.js and README.md. In Settings > Pages choose
Deploy from a branch, main, / (root), then Save.

## Privacy and limitations

Notes and pictures stay in your browser. Sound samples (smplr, from unpkg and a sample CDN)
and PDF.js (jsDelivr) are downloaded when needed, so real sounds need internet.
No automatic picture-to-notes recognition. The built-in "Yahweh" melody is original and simple.