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

- Node.js LTS (v18+)
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

| Setting | Default | Description |
|---------|---------|-------------|
| `httpConfiguration.host` | `0.0.0.0` | Server bind address |
| `httpConfiguration.port` | `8000` | Server port |

### Environment Variables

| Variable | Config Path | Description |
|----------|-------------|-------------|
| `HTTP_HOST` | `httpConfiguration.host` | Server host address |
| `HTTP_PORT` | `httpConfiguration.port` | Server port |

## Usage

### Development

```bash
# Run with ts-node (development)
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

Performs comprehensive health checks including internet connectivity and SPA rendering capability.

**Response (200 OK):**
```json
{
  "internetConnectivity": true,
  "spaRendering": true
}
```

**Response (503 Service Unavailable):**
```json
{
  "internetConnectivity": true,
  "spaRendering": false
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

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | URL to render |
| `readyCssSelectors` | string[] | No | CSS selectors to wait for before returning |

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

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | URL to render |
| `readyCssSelectors` | string[] | No | CSS selectors to wait for |
| `script` | string | Yes | JavaScript to execute |

**Response:** `application/json` - Result of the JavaScript execution

### Error Responses

All errors return appropriate HTTP status codes with a JSON body:

```json
{
  "errorMessages": ["Error description"]
}
```

## Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run development server with ts-node |
| `npm run compile` | Compile TypeScript to JavaScript |
| `npm run compile:watch` | Compile in watch mode |
| `npm run clean-compile` | Clean build directory and recompile |
| `npm run execute` | Run compiled production server |
| `npm run setup-config` | Copy config files and generate build info |
| `npm run lint` | Run ESLint |
| `npm run prettier` | Check code formatting |
| `npm run prettier:fix` | Auto-fix formatting issues |
| `npm test` | Run Jest tests |

### Code Quality

- **TypeScript** - Strict mode enabled
- **ESLint** - TypeScript-aware linting with strict and stylistic rules
- **Prettier** - Code formatting (2-space indent, double quotes, no semicolons)

### Testing

```bash
npm test
```

Tests use Jest with ts-jest, Supertest for HTTP testing, and Cheerio for HTML parsing. Test timeout is set to 25 seconds to accommodate browser operations.

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

- `namespace.yaml` - Namespace definition
- `deployment.yaml` - Deployment configuration
- `service.yaml` - Service definition
- `ingress.yaml` - Ingress configuration
- `certificate.yaml` - TLS certificate configuration

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
│   └── utils/                    # Helper utilities
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
