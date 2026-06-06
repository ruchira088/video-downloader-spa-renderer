module.exports = {
  preset: "ts-jest",
  testPathIgnorePatterns: ["/node_modules/", "health-check-spa/"],
  detectOpenHandles: true,
  testTimeout: 60_000,
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
    // puppeteer v25 and its sibling packages are ESM-only; transpile their
    // `import`/`export` syntax to CommonJS so Jest's runtime can load them.
    "^.+\\.m?js$": [
      "babel-jest",
      {
        babelrc: false,
        configFile: false,
        plugins: [
          "@babel/plugin-transform-modules-commonjs",
          // puppeteer lazy-loads some modules via dynamic import(); rewrite
          // those to require() so they work under Jest's CommonJS runtime
          // (which has no --experimental-vm-modules dynamic-import callback).
          "dynamic-import-node",
        ],
      },
    ],
  },
  // By default Jest does not transform anything under node_modules. Allow the
  // ESM-only puppeteer packages through so the transform above can reach them.
  transformIgnorePatterns: [
    "/node_modules/(?!(puppeteer|puppeteer-core|@puppeteer/browsers|chromium-bidi)/)",
    "\\.pnp\\.[^\\/]+$",
  ],
}
