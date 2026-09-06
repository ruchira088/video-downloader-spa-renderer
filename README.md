# SPA Renderer

A Node.js/Express service that renders Single Page Applications (SPAs) using Puppeteer. It executes JavaScript on web pages, waits for specific DOM elements to be present, and returns the fully rendered HTML or extracted data.

## Features

- **SPA Rendering** - Server-side rendering of SPAs with Puppeteer/Chromium
- **CSS Selector Waiting** - Optionally wait for specific DOM elements before returning content
- **JavaScript Execution** - Execute custom scripts on rendered pages and return results
- **Health Monitoring** - Built-in health checks for internet connectivity and rendering capabilities
- **OpenAPI Documentation** - Full API specification in `openapi.yaml`
- **Docker & Kubernetes Ready** - Production-ready containerization and orchestration configs

## Prerequisites

- Node.js 22 or later (CI runs on 24)
- npm 10+
- Git

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd video-downloader-spa-renderer

# Install dependencies
npm install
```

## Configuration

Configuration is managed via the `config` npm package with JSON files in the `/config` directory.

### Default Configuration

| Setting                                      | Default                                                  | Description                                       |
| -------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------- |
| `httpConfiguration.host`                     | `0.0.0.0`                                                | Server bind address (an IPv4 address)             |
| `httpConfiguration.port`                     | `8000`                                                   | Server port                                       |
| `healthCheckConfiguration.url`               | `https://spa-health-check.ruchij.com`                    | SPA rendered by the health check                  |
| `healthCheckConfiguration.readyCssSelectors` | `["#text-field", ".class-name", ".deferred-class-name"]` | Selectors the health check waits for on that page |

### Environment Variables

| Variable           | Config Path                    | Description                      |
| ------------------ | ------------------------------ | -------------------------------- |
| `HTTP_HOST`        | `httpConfiguration.host`       | Server host address              |
| `HTTP_PORT`        | `httpConfiguration.port`       | Server port                      |
| `HEALTH_CHECK_URL` | `healthCheckConfiguration.url` | SPA rendered by the health check |

## Usage

### Development

```bash
# Run with tsx (development)
npm start

# Watch mode compilation
npm run compile:watch
```

### Production

```bash
# Compile TypeScript
npm run compile

# Run compiled version
npm run execute
```

The server starts on `http://localhost:8000` by default.

## API Endpoints

### Service Endpoints

#### `GET /service/information`

Returns application metadata.

**Response:**

```json
{
  "name": "video-downloader-spa-renderer",
  "timestamp": "2025-01-09T12:00:00.000Z",
  "gitBranch": "main",
  "gitCommit": "abc1234",
  "buildTimestamp": "2025-01-09T10:00:00.000Z"
}
```

#### `GET /service/health-check`

Checks internet connectivity (an HTTP GET of the health check SPA) and SPA rendering (rendering that SPA with Puppeteer and waiting for its selectors). The two checks run concurrently and give up after 5 and 10 seconds respectively. Each is reported as `healthy` or `unhealthy`; the status is 200 only when both are healthy.

**Response (200 OK):**

```json
{
  "internetConnectivity": "healthy",
  "spaRendering": "healthy"
}
```

**Response (503 Service Unavailable):**

```json
{
  "internetConnectivity": "healthy",
  "spaRendering": "unhealthy"
}
```

### Rendering Endpoints

#### `POST /render`

Renders an SPA and returns the HTML content.

**Request:**

```json
{
  "url": "https://example.com",
  "readyCssSelectors": ["#app", ".loaded"]
}
```

| Field               | Type     | Required | Description                                |
| ------------------- | -------- | -------- | ------------------------------------------ |
| `url`               | string   | Yes      | URL to render                              |
| `readyCssSelectors` | string[] | No       | CSS selectors to wait for before returning |

**Response:** `text/html` - The rendered HTML content

#### `POST /render/execute`

Executes JavaScript on a rendered page and returns the result.

**Request:**

```json
{
  "url": "https://example.com",
  "readyCssSelectors": ["#app"],
  "script": "document.querySelector('#data').textContent"
}
```

| Field               | Type     | Required | Description               |
| ------------------- | -------- | -------- | ------------------------- |
| `url`               | string   | Yes      | URL to render             |
| `readyCssSelectors` | string[] | No       | CSS selectors to wait for |
| `script`            | string   | Yes      | JavaScript to execute     |

**Response:** The result of the JavaScript execution. A string is returned as `text/html`; anything else is serialised as `application/json`.

### Error Responses

Errors return a JSON body:

```json
{
  "errorMessages": ["Error description"]
}
```

| Status | Cause                                                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 400    | The request could not be fulfilled: the URL was rejected, the page could not be reached, a selector never appeared, or the script threw    |
| 400    | The request body failed validation. `errorMessages` then holds the validation issues (`code`, `path`, `message`) rather than plain strings |
| 404    | Unknown endpoint                                                                                                                           |
| 413    | Request body too large                                                                                                                     |
| 500    | The renderer itself failed, for example Chromium could not be launched                                                                     |
| 503    | A health check failed (`GET /service/health-check` only; the body is the health check result)                                              |

## Development

### Available Scripts

| Command                 | Description                                        |
| ----------------------- | -------------------------------------------------- |
| `npm start`             | Run development server with tsx                    |
| `npm run compile`       | Compile TypeScript to JavaScript                   |
| `npm run compile:watch` | Compile in watch mode                              |
| `npm run clean-compile` | Clean build directory and recompile                |
| `npm run execute`       | Run compiled production server                     |
| `npm run setup-config`  | Copy config files and generate build info          |
| `npm run typecheck`     | Type check the tests and scripts that `tsc` skips  |
| `npm run lint`          | Run oxlint                                         |
| `npm run prettier`      | Check code formatting                              |
| `npm run prettier:fix`  | Auto-fix formatting issues                         |
| `npm test`              | Run Jest tests                                     |
| `npm run test:coverage` | Run Jest tests and enforce the coverage thresholds |

### Code Quality

- **TypeScript** - Strict mode enabled
- **oxlint** - Linting with the `correctness`, `suspicious` and `pedantic` rule sets
- **Prettier** - Code formatting (2-space indent, double quotes, no semicolons)

### Testing

```bash
npm test
```

Tests use Jest (types stripped by Babel), Supertest for HTTP testing, and Cheerio for HTML parsing. The test timeout is 60 seconds to accommodate browser operations, and coverage thresholds are enforced by `npm run test:coverage`.

Tests sit next to the code they cover and come in three kinds:

- `*.test.ts` - hermetic; Puppeteer is mocked where the rendering flow is under test
- `*.integration.test.ts` - a real Chromium against a local fixture server
- `*.smoke.test.ts` - renders the deployed health check SPA, so it needs internet access

## Docker

### Building the Image

```bash
docker build -f playbooks/docker/Dockerfile -t spa-renderer .
```

### Running the Container

```bash
docker run -p 8000:8000 spa-renderer
```

The Docker image:

- Uses Node.js LTS Alpine as the base
- Includes Chromium and required dependencies pre-installed
- Skips Puppeteer's Chromium download (uses system Chromium)
- Multi-stage build for minimal image size

### Environment Variables for Docker

```bash
docker run -p 8000:8000 \
  -e HTTP_HOST=0.0.0.0 \
  -e HTTP_PORT=8000 \
  spa-renderer
```

## Kubernetes Deployment

Kubernetes manifests are available in `playbooks/k8s/`:

- `Namespace.yaml` - Namespace definition
- `Deployment.yaml` - Deployment configuration
- `Service.yaml` - Service definition
- `Ingress.yaml` - Ingress configuration
- `DockerRegistryCredentials.yaml` - Image pull credentials

Deploy to Kubernetes:

```bash
kubectl apply -f playbooks/k8s/
```

## Project Structure

```
.
├── src/                          # TypeScript source code
│   ├── main.ts                   # Application entry point
│   ├── app.ts                    # Express app factory
│   ├── config/                   # Configuration schemas (Zod)
│   ├── services/                 # Business logic
│   │   ├── RenderingService.ts   # Puppeteer-based SPA rendering
│   │   └── HealthService.ts      # Health check logic
│   ├── routes/                   # Express route handlers
│   │   ├── ServiceRouter.ts      # /service/* endpoints
│   │   └── RenderRouter.ts       # /render/* endpoints
│   ├── middleware/               # Express middleware
│   ├── logger/                   # Winston logger setup
│   ├── utils/                    # Helper utilities
│   └── test/                     # Fixtures shared by the tests
├── config/                       # Configuration files
│   ├── default.json              # Default settings
│   └── custom-environment-variables.json
├── scripts/                      # Build scripts
│   └── build-info.ts             # Git/build info generator
├── health-check-spa/             # React app for health checks
├── playbooks/                    # Deployment configs
│   ├── docker/                   # Dockerfile
│   └── k8s/                      # Kubernetes manifests
├── openapi.yaml                  # OpenAPI 3.0 specification
├── package.json
├── tsconfig.json
└── jest.config.js
```

## Architecture

- **Express 5** - HTTP server framework
- **Puppeteer** - Headless browser automation
- **Zod** - Runtime configuration validation
- **Winston** - Structured logging
- **TypeScript** - Type-safe development with strict mode

### Design Patterns

- **Factory Pattern** - `createApp()` for dependency injection
- **Service Pattern** - Separation of routing and business logic
- **Middleware Pattern** - Global error handling and request processing

## Health Check SPA

The `health-check-spa/` directory contains a React Router-based SPA used for health checks. It includes specific CSS selectors that the health check service waits for, testing both rendering capabilities and CSS selector waiting functionality.

## License

MIT
