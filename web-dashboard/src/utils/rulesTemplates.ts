export interface RuleParams {
  framework: string;
  styling: string;
  target: string;
}

export function generateRules({ framework, styling, target }: RuleParams): string {
  let fileName = "";
  switch (target) {
    case "cursor":
      fileName = ".cursorrules";
      break;
    case "claude":
      fileName = "CLAUDE.md";
      break;
    case "windsurf":
      fileName = ".windsurfrules";
      break;
    case "copilot":
      fileName = ".github/copilot-instructions.md";
      break;
    default:
      fileName = ".cursorrules";
  }

  // Framework-specific logic
  let frameworkRules = "";
  if (framework === "nextjs") {
    frameworkRules = `
### React & Next.js (App Router) Guidelines
- Use React Server Components (RSC) by default. Only use "use client" when adding interactivity (event listeners, React hooks).
- Place pages under \`app/\` directory and leverage nested layouts.
- Keep components small, modular, and focused. Prefer functional components.
- Use TypeScript strictly. Avoid using \`any\` types.
- Ensure proper error boundaries (\`error.tsx\`) and loading indicators (\`loading.tsx\`) are implemented.
- Use next/image, next/link, and next/font for optimization.
`;
  } else if (framework === "express") {
    frameworkRules = `
### Node.js & Express Guidelines
- Use ES Modules (\`import/export\`) instead of CommonJS (\`require\`).
- Maintain a clear MVC directory structure (controllers, services, routes, models).
- Use async/await for asynchronous database operations and wrap handlers in try/catch or custom error handler middleware.
- Ensure all input request data is validated (e.g., using Joi, Zod, or express-validator).
- Log errors structurally using libraries like Winston or Pino instead of simple \`console.log\`.
`;
  } else if (framework === "dotnet") {
    frameworkRules = `
### ASP.NET Core & C# Guidelines
- Follow Clean Architecture principles (API/Controllers, Application, Domain, Infrastructure).
- Use dependency injection (DI) strictly for injecting services and database contexts.
- Write asynchronous code using \`async\` and \`await\` starting from controllers down to the database layers.
- Enforce strong typing, use record types for DTOs, and utilize AutoMapper or manual mappings cleanly.
- Maintain proper API responses using standard return types (e.g., \`ActionResult<T>\`, \`Ok()\`, \`BadRequest()\`).
`;
  } else if (framework === "fastapi") {
    frameworkRules = `
### Python & FastAPI Guidelines
- Use type hints strictly across all function declarations, routing arguments, and service outputs.
- Build request/response validation schemas using Pydantic (v2) models.
- Make route handler functions asynchronous using \`async def\` when dealing with asynchronous operations.
- Organize routers using \`APIRouter\` and register them modularly.
- Handle database sessions using dependency injection (e.g., FastAPI's \`Depends\`).
`;
  } else if (framework === "go") {
    frameworkRules = `
### Go Guidelines
- Enforce explicit error checking immediately after calls (\`if err != nil { return ... }\`). Avoid omitting errors.
- Structure your project following standard Go layouts (e.g., cmd/, pkg/, internal/).
- Use proper logging libraries (e.g., zerolog or zap) instead of standard library \`fmt\`.
- Keep structs simple and leverage interfaces for decoupling services.
- Prevent resource leaks by deferring \`.Close()\` operations immediately after opening.
`;
  }

  // Styling-specific logic
  let stylingRules = "";
  if (styling === "tailwind") {
    stylingRules = `
### Styling (TailwindCSS)
- Use Tailwind utility classes directly in the elements.
- Avoid writing custom inline CSS or external style sheets unless absolutely necessary.
- Maintain class ordering logically (layout -> spacing -> sizing -> border -> colors -> interactive).
- Use configuration file \`tailwind.config.js\` for custom theme colors, spacing, and font sizes.
`;
  } else if (styling === "modules") {
    stylingRules = `
### Styling (CSS Modules)
- Keep styles isolated using \`[component].module.css\` or \`[component].module.scss\`.
- Import styles objects cleanly (e.g., \`import styles from './Component.module.css'\`).
- Use camelCase for class names so they can be referenced as object properties (e.g., \`styles.className\`).
- Avoid global styles pollution unless specifying in a dedicated \`global.css\` file.
`;
  } else if (styling === "bootstrap") {
    stylingRules = `
### Styling (Bootstrap)
- Rely on standard Bootstrap utility classes for margins, paddings, and alignment.
- Implement responsive grids using \`.container\`, \`.row\`, and \`.col-*\` classes.
- Avoid custom overrides of styles; use theme customization variables when possible.
`;
  } else if (styling === "css") {
    stylingRules = `
### Styling (Vanilla CSS)
- Write clean, semantic Vanilla CSS in dedicated style sheets.
- Follow naming conventions (e.g., BEM or simple semantic lowercase names).
- Utilize CSS Custom Properties (variables) in \`:root\` for colors, fonts, and spacing.
- Keep style definitions organized with clear grouping comments.
`;
  }

  // Combine rules based on Target
  let finalContent = "";
  if (target === "cursor") {
    finalContent = `# Cursor Rules Configuration File (${fileName})

You are a senior assistant developer with deep context of this project. Follow these guidelines:

## Core Technical Stack & Rules
${frameworkRules}
${stylingRules}

## Development Principles
- Prioritize write-time readability and simplicity.
- Always implement comprehensive error handling and log errors.
- Ensure code compiles cleanly without warnings or TypeScript errors.

---
Generated by AI Context Brain (https://aicontextbrain.me)
Want to sync this automatically recursively across your workspace? Use our VS Code Extension!`;
  } else if (target === "claude") {
    finalContent = `# Claude Code Project Memory Guide (${fileName})

Guidelines and constraints for editing files in this codebase:

## Stack Specifics
${frameworkRules}
${stylingRules}

## Coding Style & Commands
- Ensure all files adhere strictly to project structure conventions.
- When generating code, make sure imports are correctly mapped.
- Test your changes locally before committing.

---
Generated by AI Context Brain (https://aicontextbrain.me)
Want to sync this automatically recursively across your workspace? Use our VS Code Extension!`;
  } else if (target === "windsurf") {
    finalContent = `# Windsurf AI Assistant Instructions (${fileName})

Instructions for Windsurf agents and coding tools:

## Workspace Guidelines
${frameworkRules}
${stylingRules}

## Agent Behaviors
- Do not make major structural modifications without reviewing project boundaries.
- Adhere strictly to the naming paradigms.
- Explain code modifications clearly before executing changes.

---
Generated by AI Context Brain (https://aicontextbrain.me)
Want to sync this automatically recursively across your workspace? Use our VS Code Extension!`;
  } else if (target === "copilot") {
    finalContent = `# GitHub Copilot Code Generation Instructions (${fileName})

Instruction parameters for Copilot autocomplete and chats:

## Project Stack Rules
${frameworkRules}
${stylingRules}

## Completion Constraints
- Avoid introducing legacy library methods or deprecated code formats.
- Follow custom project imports and folder restrictions.

---
Generated by AI Context Brain (https://aicontextbrain.me)
Want to sync this automatically recursively across your workspace? Use our VS Code Extension!`;
  }

  return finalContent.trim();
}
