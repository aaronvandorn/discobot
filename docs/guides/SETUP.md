# Setup

Discobot runs entirely in the browser. There's no server, bot or login to configure.

## Requirements

- Node.js 18+ and npm (only for development and building)
- A Chromium-based browser for Web MIDI input (everything else works in Firefox and Safari too)

## Develop

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Build

```bash
npm run build
```

This builds the engine's type declarations, then the UI into `ui/dist`. The output is a static site with relative asset paths; `npm run preview` serves it locally.

## Deploy to GitHub Pages

1. Push to `main`.
2. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. `.github/workflows/deploy-pages.yml` builds and publishes `ui/dist`. The site appears at `https://<user>.github.io/<repo>/`.

Any other static host works the same way: upload the contents of `ui/dist`.

## Where data is stored

Everything is kept in the browser's local storage for the site:

| Key | Contents |
|-----|----------|
| `discobot_session` | The current working session, restored on reload |
| `discobot_saved_patterns` | Patterns saved with **+ Save** |
| synth presets key (see `App.tsx`) | User synth presets |

Data is per browser and per device. Clearing site data removes it.
