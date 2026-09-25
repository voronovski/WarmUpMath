# Warm Up Math (WarmUpMath)

A lightweight, installable web app for practicing elementary school arithmetic. No build step, no dependencies — just static HTML/CSS/JS.

## Features

- **Session mode** — a timed quiz with a chosen rubric (addition, subtraction, multiplication, division) and difficulty, with a configurable number of questions and time per question.
- **Marathon mode** — runs a 15-question set for each rubric in turn (Addition, Multiplication, Subtraction, Division — 60 questions total) at a chosen difficulty, timed per question using the same time limit as Session mode, then grades each rubric and the run overall.
- **Generate mode** — build a custom worksheet from your own formula sets (e.g. `a + b`, `a * b - c`) and check the answers.
- **Progress tracking** — error-rate history, marathon grade history, and a table of recent attempts, all stored locally in the browser (`localStorage`).
- **Results screen** — per-question breakdown, score, elapsed time, and a small fireworks celebration on a good result.

## Privacy & offline use

- No personal data is collected.
- All history (error rates, marathon grades, recent attempts) is stored only on the device, in the browser's `localStorage`.
- Once installed, the app works fully offline — no internet connection is needed after the first visit.

## Progressive Web App (PWA)

The app can be installed to a phone's home screen or a desktop and used offline.

- [`manifest.json`](manifest.json) — app name, theme colors, and icons used when installed.
- [`service-worker.js`](service-worker.js) — caches the app shell (`index.html`, `styles.css`, `script.js`, icons) so it loads and works without a network connection after the first visit.
- [`icons/`](icons) — generated app icons (192×192, 512×512, Apple touch icon, favicon).

**Note:** installation and offline caching require the site to be served over **HTTPS** (or `localhost`) — a service worker will not register over plain HTTP.

To install:
- **Android/Chrome:** the browser shows an "Install" prompt automatically, or use the menu → "Install app".
- **iOS/Safari:** Share → "Add to Home Screen".
- **Desktop (Chrome/Edge):** an install icon appears in the address bar.

## Project structure

```
index.html          Markup for all three screens (start, quiz, results)
styles.css           Styling
script.js            App logic, quiz/marathon/generate flows, charts, localStorage persistence
manifest.json        PWA manifest
service-worker.js    Offline caching (app shell)
icons/               PWA icons
```

## Contributing

This is a non-commercial project. Pull requests are welcome — whether it's a bug fix, an improvement, or a new idea for the app. Feel free to open one.
