// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Build-time files run under Node, not Metro, so they legitimately use
    // Node globals (__dirname, require, process).
    files: ['app.config.js', 'metro.config.js', 'scripts/**/*.js', 'plugins/**/*.js'],
    languageOptions: {
      globals: { __dirname: 'readonly', require: 'readonly', module: 'writable', process: 'readonly' },
    },
  },
]);
