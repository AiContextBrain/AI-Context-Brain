import { readFileSync, writeFileSync, readdirSync, statSync, renameSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = "c:\\Users\\Monster\\Desktop\\Project\\AI-Context-Memory";
const ignores = [
  "node_modules",
  ".git",
  "bin",
  "obj",
  ".brain-cache",
  "dist",
  ".vs",
  ".idea",
  "Cover.png",
  "logo.png",
  "project_brain_logo_1780403469565.png"
];

const replacements = [
  { from: /AI Context Brain/g, to: "AI Context Brain" },
  { from: /ai-context-brain/g, to: "ai-context-brain" },
  { from: /AiContextBrain/g, to: "AiContextBrain" },
  { from: /ai_context_brain/g, to: "ai_context_brain" },
  { from: /Context Brain/g, to: "Context Brain" },
  { from: /context-brain/g, to: "context-brain" },
  { from: /aiContextBrain/g, to: "aiContextBrain" }
];

function processDir(dir) {
  for (const name of readdirSync(dir)) {
    if (ignores.includes(name)) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    
    if (stat.isDirectory()) {
      processDir(full);
    } else {
      const ext = name.split('.').pop().toLowerCase();
      const textExtensions = ["cs", "ts", "tsx", "js", "jsx", "json", "html", "css", "md", "xml", "yml", "txt", "example", "csproj", "mjs"];
      if (textExtensions.includes(ext) || name === ".brainignore" || name === ".gitignore" || name === ".env" || name === "LICENSE" || name === "Dockerfile") {
        let content = readFileSync(full, "utf8");
        let modified = false;
        
        for (const rep of replacements) {
          if (rep.from.test(content)) {
            content = content.replace(rep.from, rep.to);
            modified = true;
          }
        }
        
        if (modified) {
          writeFileSync(full, content, "utf8");
          console.log(`Processed: ${full}`);
        }
      }
    }
  }
}

console.log("Starting search and replace...");
processDir(root);
console.log("Completed search and replace.");

// Rename project files
const oldCsproj = join(root, "backend", "AiContextBrain.csproj");
const newCsproj = join(root, "backend", "AiContextBrain.csproj");
if (existsSync(oldCsproj)) {
  renameSync(oldCsproj, newCsproj);
  console.log(`Renamed project file: ${oldCsproj} -> ${newCsproj}`);
}
