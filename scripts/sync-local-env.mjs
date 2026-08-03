import { ensureLocalApplicationEnvironment } from "./lib/local-environment.mjs";

try {
  const result = ensureLocalApplicationEnvironment();
  console.log(
    result.created
      ? "Created ignored .env.local from local infrastructure settings."
      : "Existing .env.local preserved; no values were overwritten.",
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
