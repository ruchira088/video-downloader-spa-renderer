// TypeScript 7 ships the native (Go) compiler and no longer exposes a JavaScript
// compiler API, so ts-jest can no longer be used. Babel strips the types instead
// and type checking runs separately via `npm run typecheck`.
const typescriptTransform = [
  "babel-jest",
  {
    babelrc: false,
    configFile: false,
    presets: ["@babel/preset-typescript"],
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  },
]

module.exports = {
  testEnvironment: "node",
  testPathIgnorePatterns: ["/node_modules/", "health-check-spa/"],
  // The compiled output under build/ mirrors the sources (including
  // package.json), which otherwise trips Jest's haste module collision check.
  modulePathIgnorePatterns: ["<rootDir>/build/"],
  detectOpenHandles: true,
  testTimeout: 60_000,
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.test.ts",
    // The entry point wires the process together (listen, SIGTERM) and is
    // covered by running the service rather than by Jest.
    "!src/main.ts",
    // Fixtures and helpers used by the tests themselves.
    "!src/test/**/*.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
  coverageThreshold: {
    global: {
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95,
    },
  },
  transform: {
    "^.+\\.tsx?$": typescriptTransform,
    // puppeteer v25 and config v5 ship ESM; transpile their `import`/`export`
    // syntax to CommonJS so Jest's runtime can load them.
    // The CommonJS transform also rewrites the dynamic `import()` calls that
    // puppeteer lazy-loads modules with into `require()`, which Jest's
    // CommonJS runtime can resolve.
    "^.+\\.m?js$": [
      "babel-jest",
      {
        babelrc: false,
        configFile: false,
        plugins: ["@babel/plugin-transform-modules-commonjs"],
      },
    ],
  },
  // By default Jest does not transform anything under node_modules. Allow the
  // ESM packages through so the transform above can reach them.
  transformIgnorePatterns: [
    "/node_modules/(?!(puppeteer|puppeteer-core|@puppeteer/browsers|chromium-bidi|config)/)",
    "\\.pnp\\.[^\\/]+$",
  ],
}
