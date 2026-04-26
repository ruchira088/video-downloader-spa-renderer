module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: ["health-check-app/", "/node_modules/", "build/"],
  detectOpenHandles: true,
  testTimeout: 60_000,
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },
}
