# Repository guide

Guidance for coding agents working in this repository. `CLAUDE.md` is the
source of truth; `AGENTS.md` is a symlink to it, so tools that look for
either name read the same file.

## What this is

An Express 5 service that renders SPAs with Puppeteer/Chromium: `POST /render` returns fully-rendered HTML, `POST /render/execute` runs a JS snippet on the rendered page and returns the result. API contract is in `openapi.yaml`.

The repo contains **two independent npm projects**:

- Root — the renderer service (TypeScript, CommonJS, Node 24 in CI)
- `health-check-spa/` — a React Router v8 + Vite SPA with its own `package.json`, deployed to AWS via Terraform; run npm commands for it from inside that directory

## Commands (root project)

```bash
npm start                # dev server via tsx (http://localhost:8000)
npm run clean-compile    # rimraf build + tsc + copy config + generate build-info
npm run execute          # run compiled output (node src/main.js inside build/)
npm test                 # jest --runInBand (launches real Chromium; 60s timeout)
npm run test:coverage    # same, plus the coverage report and its thresholds
npx jest src/services/RenderingService.test.ts        # single test file
npx jest -t "test name"                               # single test by name
npm run typecheck        # tsc --noEmit over the tests and scripts
npm run lint             # oxlint src scripts
npm run prettier         # check formatting (fix with prettier:fix)
```

CI (`.github/workflows/build-pipeline.yml`) runs clean-compile, typecheck, lint, prettier, and `test:coverage` on every push, then publishes a Docker image. Tests need a Chromium; CI sets `PUPPETEER_EXECUTABLE_PATH` and installs with `PUPPETEER_SKIP_DOWNLOAD=true`.

`health-check-spa/` has its own scripts: `npm run build`, `npm start` (dev), `npm run typecheck`, `npm run lint`, `npm run prettier`.

## Tests

Tests sit next to the code they cover. Three kinds, distinguished by suffix:

- `*.test.ts` — hermetic. Puppeteer is mocked in `RenderingService.test.ts` and `RenderingService.errors.test.ts`, so the suite covers navigation flow, sequential selector waits, error classification and browser cleanup without launching Chromium.
- `*.integration.test.ts` — launches a real Chromium against `startTestHttpServer` fixtures on `127.0.0.1` (`src/test/TestHttpServer.ts`). Local, so it stays deterministic.
- `*.smoke.test.ts` — the only tests that leave the machine. `app.smoke.test.ts` renders the deployed health-check SPA to guard the coupling described below, and calls `jest.retryTimes` to absorb transient network failures.

Shared fixtures and mocks live in `src/test/`; that directory is excluded from `tsconfig.json` so it never reaches `build/`.

`jest.config.js` enforces coverage thresholds (95% statements/functions/lines, 90% branches) over `src/`, excluding `src/main.ts` and `src/test/`. The suite currently sits at 100% on every metric — when adding code, add the tests that keep it there.

`src/logger/Logger.ts` silences its console transport when `NODE_ENV === "test"` (which Jest sets), keeping the test report readable; `Logger.test.ts` asserts the format by attaching its own stream transport.

## Architecture

- `src/main.ts` — entry point: parses the `config` package output through the Zod schema `ApplicationConfiguration` (fail-fast at startup), then calls `createAppFromConfig`.
- `src/app.ts` — two factories: `createAppFromConfig` wires real dependencies (`PuppeteerRenderingService`, `HealthServiceImpl`, axios); `createApp(renderingService, healthService)` builds the Express app from interfaces. Tests use `createApp` to inject mocks — keep new dependencies flowing through these factories.
- `src/routes/` — `ServiceRouter` (`/service/information`, `/service/health-check`) and `RenderRouter` (`/render`, `/render/execute`). Business logic lives in `src/services/`, not in routes.
- `src/services/RenderingService.ts` — launches a **fresh browser per request** (closed in `finally`), validates URLs to http/https only, and waits for each `readyCssSelectors` entry sequentially (30s timeout each, overridable through the constructor so the integration tests can use a short one) before capturing content.
- Rendering failures are classified: anything attributable to the request (bad URL, unreachable page, selector timeout, a script that throws) is wrapped in `RenderingError`, which carries a 400 status, while failures of the renderer itself (`puppeteer.launch`, `browser.newPage`) propagate untouched and become a 500. The routes let both propagate to `ErrorHandler`. Throw a `RenderingError` for new request-caused failures; leave everything else alone.
- Errors funnel through `src/middleware/ErrorHandler.ts` / `NotFoundHandler.ts` and return `{ "errorMessages": [...] }` — an array of strings, except for request body validation failures, which carry the Zod issue objects. `ErrorHandler` honours a 4xx `status`/`statusCode` carried by the error — Express attaches one to its own errors (a malformed JSON body is `entity.parse.failed` with a 400, an oversized one is 413) and `RenderingError` carries a 400; everything else is logged and reported as a 500.
- Configuration: `config/*.json` via the `config` package; env overrides in `custom-environment-variables.json` (`HTTP_HOST`, `HTTP_PORT`, `HEALTH_CHECK_URL`). `buildInformation` in `config/default.json` holds placeholders that `scripts/build-info.ts` overwrites during `npm run compile` (via `setup-config`, which also copies `config/` into `build/`).

### Health check coupling

`HealthServiceImpl` runs its two checks concurrently, each under its own timeout (5s for connectivity, 10s for rendering), so a health check never takes longer than 10s. It verifies both internet connectivity (axios GET) and real rendering by rendering the **deployed** health-check SPA (`https://spa-health-check.ruchij.com`) and waiting for selectors defined in `config/default.json` (`#text-field`, `.class-name`, `.deferred-class-name` — the last one is rendered deferred on purpose). If you change elements/selectors in `health-check-spa/`, update `healthCheckConfiguration` to match; the SPA auto-deploys on push to `main` via `.github/workflows/health-check-app.yml`.

## Toolchain (TypeScript 7)

Both projects are on **TypeScript 7**, the native (Go) compiler. It ships `tsc` as a platform binary and no longer exposes a JavaScript compiler API, which rules out every tool that used to drive `typescript` in-process:

- **ESLint → [oxlint](https://oxc.rs)**: `typescript-eslint` peer-caps at `typescript <6.1.0`, so it cannot run against TS 7. Rules live in `.oxlintrc.json` (one per project — the root config ignores `health-check-spa/`, which has its own). Config is JSONC, so comments are allowed. Rule set is `correctness` + `suspicious` + `pedantic`, roughly the old `tseslint.configs.strict`; the rules turned off there are annotated with why.
- **ts-node → tsx**: used by `npm start` and `npm run build-info`. Node 24's built-in type stripping is not an option because the source uses non-erasable syntax (`enum` in `HealthService.ts`, a parameter property in `RenderingService.ts`).
- **ts-jest → babel-jest**: `jest.config.js` strips types with `@babel/preset-typescript`. Babel does **not** type check, so `npm run typecheck` covers the tests and scripts that `tsc` skips during `npm run compile`. Run it after touching test files.

Type-aware lint rules (`oxlint --type-aware`, via `oxlint-tsgolint`) are not enabled: `tsconfig.json` excludes the test files, so tsgolint has no program for them and reports everything as `error`-typed. Enabling it would mean restructuring the tsconfigs first.

## Gotchas

- **Jest + ESM dependencies**: puppeteer v25+ and `config` v5 ship ESM. `jest.config.js` transpiles them to CommonJS via babel (`transformIgnorePatterns` allowlist). If a dependency upgrade breaks Jest with `import`/`export` syntax errors, add the package to that allowlist.
- **`allowScripts` in `package.json`** pins exact versions (e.g. `puppeteer@25.8.0`, `esbuild@0.28.2`); bump the entry when upgrading those packages or their postinstall scripts won't run.
- Prettier style: 2-space indent, double quotes, no semicolons.
- Deployment configs (Dockerfile, k8s manifests, Ansible playbooks) live under `playbooks/`. The Docker image uses system Chromium, not Puppeteer's download.
