import { ensureLocalApplicationEnvironment } from "./lib/local-environment.mjs";

try {
  const result = ensureLocalApplicationEnvironment();
  if (result.created) {
    console.log(
      "Created ignored .env.local from local infrastructure settings.",
    );
  } else if (result.updatedKeys.length > 0) {
    console.log(
      `Added or repaired local secrets: ${result.updatedKeys.join(", ")}.`,
    );
  } else {
    console.log("Existing .env.local is complete; no values were changed.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
