import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["backend/src", "vscode-extension/src", "web-dashboard/src"];
const blocked = [
  { pattern: /AllowAnyOrigin\(\)/, message: "Avoid AllowAnyOrigin in production code." },
  { pattern: /return\s+true;\s*\/\/\s*dev mode/i, message: "Do not bypass production verification with dev-mode returns." },
  { pattern: /PasswordHash\s*!=\s*HashPassword/, message: "Avoid direct password hash comparison." },
  { pattern: /localStorage\.setItem\(['"]user['"]/, message: "Avoid persisting auth user tokens in localStorage." },
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (/\.(cs|ts|tsx|js|jsx)$/.test(name)) out.push(full);
  }
  return out;
}

let warnings = 0;
for (const root of roots) {
  for (const file of walk(root)) {
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    for (const rule of blocked) {
      const index = lines.findIndex(line => rule.pattern.test(line));
      if (index >= 0) {
        warnings++;
        console.log(`::warning file=${file},line=${index + 1}::${rule.message}`);
      }
    }
  }
}

console.log(`Architecture guard source scan complete. warnings=${warnings}`);
