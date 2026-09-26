/**
 * Loads .env.local for the command-line scripts. Next does this itself for the
 * app, but `tsx` runs outside Next.
 */
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Missing file, or an environment that already has the variables set.
  }
}
