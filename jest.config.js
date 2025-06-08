
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testPathIgnorePatterns: [ "/health-check-app/" ],
    detectOpenHandles: true,
    testTimeout: 25_000
}