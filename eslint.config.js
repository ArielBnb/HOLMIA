// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions: Deno Edge Functions (npm: imports), type-checked separately.
    ignores: ['dist/*', 'supabase/functions/*'],
  },
]);
