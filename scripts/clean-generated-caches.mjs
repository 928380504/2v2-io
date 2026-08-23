import { cleanGeneratedCaches } from "./generated-cache-tools.mjs";

try {
  const removed = cleanGeneratedCaches(process.cwd());
  if (removed.length) {
    console.log(`Generated caches cleared: ${removed.join(", ")}`);
  } else {
    console.log("Generated caches are already clean.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
