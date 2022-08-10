/** @type {import("ts-jest/dist/types").InitialOptionsTsJest} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testPathIgnorePatterns: [ "/health-check-app/" ],
    testTimeout: 10000
}