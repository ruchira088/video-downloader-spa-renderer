
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testPathIgnorePatterns: [ "/health-check-app/" ],
    testTimeout: 10_000
}