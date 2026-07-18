# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An Express 5 service that renders SPAs with Puppeteer/Chromium: `POST /render` returns fully-rendered HTML, `POST /render/execute` runs a JS snippet on the rendered page and returns the result. API contract is in `openapi.yaml`.

The repo contains **two independent npm projects**:

- Root — the renderer service (TypeScript, CommonJS, Node 24 in CI)
- `health-check-spa/` — a React Router v8 + Vite SPA with its own `package.json`, deployed to AWS via Terraform; run npm commands for it from inside that directory

## Commands (root project)

```bash
npm start                # dev server via ts-node (http://localhost:8000)
npm run clean-compile    # rimraf build + tsc + copy config + generate build-info
npm run execute          # run compiled output (node src/main.js inside build/)
npm test                 # jest --runInBand (launches real Chromium; 60s timeout)
npx jest src/services/RenderingService.test.ts        # single test file
npx jest -t "test name"                               # single test by name
npm run lint             # eslint src
npm run prettier         # check formatting (fix with prettier:fix)
```

CI (`.github/workflows/build-pipeline.yml`) runs clean-compile, lint, prettier, and tests on every push, then publishes a Docker image. Tests need a Chromium; CI sets `PUPPETEER_EXECUTABLE_PATH` and installs with `PUPPETEER_SKIP_DOWNLOAD=true`.

`health-check-spa/` has its own scripts: `npm run build`, `npm start` (dev), `npm run typecheck`, `npm run lint`, `npm run prettier`.

## Architecture

- `src/main.ts` — entry point: parses the `config` package output through the Zod schema `ApplicationConfiguration` (fail-fast at startup), then calls `createAppFromConfig`.
- `src/app.ts` — two factories: `createAppFromConfig` wires real dependencies (`PuppeteerRenderingService`, `HealthServiceImpl`, axios); `createApp(renderingService, healthService)` builds the Express app from interfaces. Tests use `createApp` to inject mocks — keep new dependencies flowing through these factories.
- `src/routes/` — `ServiceRouter` (`/service/information`, `/service/health-check`) and `RenderRouter` (`/render`, `/render/execute`). Business logic lives in `src/services/`, not in routes.
- `src/services/RenderingService.ts` — launches a **fresh browser per request** (closed in `finally`), validates URLs to http/https only, and waits for each `readyCssSelectors` entry sequentially (30s timeout each) before capturing content.
- Errors funnel through `src/middleware/ErrorHandler.ts` / `NotFoundHandler.ts` and return `{ "errorMessages": [...] }`.
- Configuration: `config/*.json` via the `config` package; env overrides in `custom-environment-variables.json` (`HTTP_HOST`, `HTTP_PORT`). `buildInformation` in `config/default.json` holds placeholders that `scripts/build-info.ts` overwrites during `npm run compile` (via `setup-config`, which also copies `config/` into `build/`).

### Health check coupling

`HealthServiceImpl` verifies both internet connectivity (axios GET) and real rendering by rendering the **deployed** health-check SPA (`https://spa-health-check.ruchij.com`) and waiting for selectors defined in `config/default.json` (`#text-field`, `.class-name`, `.deferred-class-name` — the last one is rendered deferred on purpose). If you change elements/selectors in `health-check-spa/`, update `healthCheckConfiguration` to match; the SPA auto-deploys on push to `main` via `.github/workflows/health-check-app.yml`.

## Gotchas

- **Jest + puppeteer ESM**: puppeteer v25+ packages are ESM-only. `jest.config.js` transpiles them to CommonJS via babel (`transformIgnorePatterns` allowlist). If a puppeteer upgrade breaks Jest with `import`/`export` syntax errors, that config is the place to look.
- **`allowScripts` in `package.json`** pins exact versions (e.g. `puppeteer@25.3.0`); bump the entry when upgrading those packages or their postinstall scripts won't run.
- Prettier style: 2-space indent, double quotes, no semicolons.
- Deployment configs (Dockerfile, k8s manifests, Ansible playbooks) live under `playbooks/`. The Docker image uses system Chromium, not Puppeteer's download.
