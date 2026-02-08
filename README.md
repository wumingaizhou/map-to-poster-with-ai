# MapToPosterWithAI

**[English](./README.md)** | **[中文](./README.zh-CN.md)**

AI-powered map poster generator: Enter a place name → Choose a topic & theme → Server-side rendering → Iterate on style through conversation to create beautiful map posters.

- Data: OpenStreetMap (Overpass / Nominatim)
- Rendering: Server-side SVG → PNG (`@resvg/resvg-js`)
- AI: Mastra Agent + Tool (controllable theme override JSON)
- Interaction: SSE event stream (auto-refresh version on AI tool-result)

Inspired by: [originalankur/maptoposter](https://github.com/originalankur/maptoposter) (adds AI conversation on top of maptoposter for iterative poster style and theme adjustments).

## Screenshots

### User Interface

[![Home](./assets/user-interface.jpg)](./assets/user-interface.jpg)
[![Editor](./assets/user-interface2.jpg)](./assets/user-interface2.jpg)

### Poster Examples

[<img src="./assets/chang-sha.png" alt="Changsha" style="zoom: 33%;" />](./assets/chang-sha.png)
[<img src="./assets/beijing.png" alt="Beijing" style="zoom:33%;" />](./assets/beijing.png)
[<img src="./assets/washington.png" alt="Washington" style="zoom:33%;" />](./assets/washington.png)
[<img src="./assets/new-york.png" alt="New York" style="zoom:33%;" />](./assets/new-york.png)

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Repository Structure](#repository-structure)
- [Common Commands](#common-commands)
- [Troubleshooting](#troubleshooting)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## Features

- Location search & candidate selection (Nominatim)
- 4 poster topics: Green Spaces / Roads / Buildings / Water Systems
- Theme library (`themes-v1`): selectable & extensible
- Server-side rendering: OSM features + Theme → SVG → PNG
- Version management: each generation/iteration creates a version (v1/v2/v3…)
- AI design assistant: adjust `palette / tuning / typography` through conversation, generating new versions
- OSM data caching (SQLite): reduces Overpass requests and wait times

> Note: Session/version metadata is currently stored in memory (restarting the backend will lose the index); poster PNG artifacts are written to a local directory.

## Tech Stack

- Frontend: Vue 3 + Vite + TailwindCSS
- Backend: Node.js + Express + Mastra
- Map Data: Overpass API (OSM) + Nominatim (geocoding)
- Storage: OSM Cache (SQLite); poster artifacts on local disk; Agent/Mastra storage uses LibSQL (local file or remote)

## Getting Started

### 1) Prerequisites

- Node.js `>= 22.14.0`
- pnpm `>= 10.15.1` (Corepack recommended for version management)

### 2) Install Dependencies

```bash
pnpm install
```

### 3) Configure Environment Variables

Copy the example configs to `.env` for both apps:

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

Key variables to configure:

- `apps/backend/.env`
  - `AI_EXAMPLE_AGENT_*`: AI design assistant (optional; posters can still be generated without it, but AI conversation iteration won't be available)
  - Production deployment notes:
    - `POSTER_WORKER_POOL_SIZE`: Worker pool size for poster rendering (parallel threads), default 1; recommended 1 for 2G2C servers, 2 for 4G4C
    - `POSTER_WORKER_MEMORY_LIMIT_MB`: Max old-generation memory per worker (MB), default 256; recommended 256 for 2G2C, 512 for 4G+
  - Others:
    - `POSTER_MAX_FEATURES_PER_LAYER`: Max features per layer (prevents data explosion for large cities), default 50000
    - `GEOCODE_BBOX_CENTER_SCALE`: Geocode bbox center scale ratio, range 0–1, default 0.5
    - `GEOCODE_BBOX_MAX_RADIUS_KM`: Geocode bbox max radius (km), limits bbox range and reduces OSM data volume, default 50
    - `POSTER_PNG_DPI`: Poster export PNG DPI, default 300
- `apps/frontend/.env`
  - `VITE_DEV_API_PROXY_TARGET`: Dev API proxy target (default `http://localhost:3000`)

### 4) Start Development Environment

Open two terminals to start the backend and frontend respectively:

```bash
pnpm -C apps/backend dev
```

```bash
pnpm -C apps/frontend dev
```

Open the URL shown by Vite (typically `http://localhost:5173`).

## Usage

1. On the home page, select a poster topic (Green Spaces / Roads / Buildings / Water Systems) and enter a place name (city, region, address…)
2. Select the target location from the candidate list (the backend will fetch OSM data based on bbox and generate v1)
3. Enter the editor page:
   - Canvas area shows historical version previews
   - Right-side "Map Poster Design Assistant" chat panel — describe your style requests (e.g., higher contrast, bluer water, thinner roads, change font, move title to top…)
   - Each successful tool call generates a new version (v2/v3/…), auto-refreshed on the frontend
4. Select any version and download the PNG

## Repository Structure

```text
.
├─ apps/
│  ├─ backend/                 # Express + Mastra + Rendering/Caching
│  │  ├─ runtime-assets/       # themes-v1 / fonts
│  │  └─ src/
│  └─ frontend/                # Vue 3 + Vite UI
│     └─ src/
```

## Common Commands

- Root
  - `pnpm lint`: Prettier + ESLint + cspell
- Backend (`apps/backend`)
  - `pnpm dev`: Development (`tsx watch src/index.ts`)
  - `pnpm build`: Build to `dist/`
  - `pnpm start`: Run build artifacts
  - `pnpm mastra:dev`: Start Mastra Studio (optional)
- Frontend (`apps/frontend`)
  - `pnpm dev`: Development
  - `pnpm build`: Build
  - `pnpm preview`: Local preview of build artifacts

## Troubleshooting

- Overpass / Nominatim requests are slow or failing
  - Public instances may be rate-limited; consider switching to or self-hosting endpoints (see `OSM_OVERPASS_ENDPOINT` / `NOMINATIM_ENDPOINT`)
  - Backend enables SQLite caching by default to reduce redundant fetches (`OSM_CACHE_MAX_BYTES`)

## Acknowledgements

- Inspiration: [originalankur/maptoposter](https://github.com/originalankur/maptoposter) (adds AI conversation on top of maptoposter for iterative poster style and theme adjustments)
- Map Data: [OpenStreetMap (OSM)](https://www.openstreetmap.org/) (© OpenStreetMap contributors)
- Geocoding: [Nominatim](https://nominatim.org/) (location search, candidate list, and geocoding service)
- Data Fetching: [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) (querying and fetching OSM feature data by bbox/conditions)

## License

MIT (see `LICENSE`).
