import { spawnSync } from "node:child_process";
for (const [command, args] of [
  ["npm", ["ci"]],
  ["npm", ["--prefix", "mobile", "ci"]],
  ["npm", ["--prefix", "portal", "ci"]],
  ["uv", ["sync", "--project", "backend", "--group", "dev"]],
]) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
