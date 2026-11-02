const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests",
  testMatch: "*.spec.js",
  use: { baseURL: "http://127.0.0.1:4181" },
  webServer: {
    command: "python3 -m http.server 4181",
    port: 4181,
    reuseExistingServer: false
  }
});
