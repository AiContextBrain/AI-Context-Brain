import * as fs from 'fs';
import * as path from 'path';

export interface WizardScaffoldOptions {
    platforms?: string[];
    productTypes?: string[];
    languages?: string[];
    databases?: string[];
    auths?: string[];
    deployments?: string[];
    billings?: string[];
    automations?: string[];
    locales?: string[];
}

export interface WizardBlueprint {
    framework?: string;
    architectureType?: string;
    databaseType?: string;
    authSystem?: string;
    dependencies?: string[];
    folderStructure?: string[];
    scaffoldOptions?: WizardScaffoldOptions;
}

export interface ProjectScaffoldResult {
    projectName: string;
    createdDirectories: number;
    createdFiles: number;
    existingFiles: number;
    removedKeepFiles: number;
    skippedPaths: number;
}

type TemplateMap = Record<string, string>;

export class ProjectScaffoldService {
    create(projectPath: string, blueprint: WizardBlueprint): ProjectScaffoldResult {
        const root = path.resolve(projectPath);
        const projectName = path.basename(root);
        const result: ProjectScaffoldResult = {
            projectName,
            createdDirectories: 0,
            createdFiles: 0,
            existingFiles: 0,
            removedKeepFiles: 0,
            skippedPaths: 0
        };

        for (const folder of blueprint.folderStructure ?? []) {
            const normalized = String(folder ?? '').trim().replace(/[\\/]+$/, '');
            const target = this.safeChild(root, normalized);
            if (!target) {
                result.skippedPaths++;
                continue;
            }
            if (!fs.existsSync(target)) {
                fs.mkdirSync(target, { recursive: true });
                result.createdDirectories++;
            }
        }

        const templates = this.buildTemplates(projectName, blueprint);
        for (const [relativePath, content] of Object.entries(templates)) {
            const target = this.safeChild(root, relativePath);
            if (!target) {
                result.skippedPaths++;
                continue;
            }
            if (fs.existsSync(target)) {
                result.existingFiles++;
                continue;
            }
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, content.endsWith('\n') ? content : content + '\n', 'utf8');
            result.createdFiles++;
        }

        for (const folder of blueprint.folderStructure ?? []) {
            const keepFile = this.safeChild(root, path.join(String(folder), '.gitkeep'));
            if (!keepFile || !fs.existsSync(keepFile)) continue;
            try {
                if (fs.statSync(keepFile).isFile() && fs.readFileSync(keepFile, 'utf8').trim() === '') {
                    fs.unlinkSync(keepFile);
                    result.removedKeepFiles++;
                }
            } catch {
                result.skippedPaths++;
            }
        }

        return result;
    }

    private buildTemplates(projectName: string, blueprint: WizardBlueprint): TemplateMap {
        const templates: TemplateMap = {};
        const options = blueprint.scaffoldOptions ?? {};
        const framework = (blueprint.framework ?? '').toLowerCase();
        const languages = (options.languages ?? []).map(value => value.toLowerCase());
        const dependencies = new Set((blueprint.dependencies ?? []).map(value => value.toLowerCase()));
        const databases = (options.databases?.length ? options.databases : [blueprint.databaseType ?? ''])
            .map(value => value.toLowerCase());
        const auths = (options.auths?.length ? options.auths : [blueprint.authSystem ?? ''])
            .map(value => value.toLowerCase());
        const billings = (options.billings ?? []).map(value => value.toLowerCase());
        const automations = (options.automations ?? []).map(value => value.toLowerCase());
        const deployments = (options.deployments ?? []).map(value => value.toLowerCase());
        const locales = (options.locales ?? []).map(value => value.toLowerCase()).filter(Boolean);

        const has = (language: string, marker: string) =>
            languages.includes(language) || framework.includes(marker);
        const hasDependency = (name: string) => dependencies.has(name.toLowerCase());

        if (has('typescript', 'next.js') || has('javascript', 'node.js')) {
            Object.assign(templates, this.typescriptTemplates(
                projectName,
                databases,
                auths,
                billings,
                automations,
                locales,
                hasDependency
            ));
        }
        if (has('csharp', 'asp.net') || framework.includes('c#')) {
            Object.assign(templates, this.csharpTemplates(projectName, databases, auths));
        }
        if (has('python', 'fastapi')) {
            Object.assign(templates, this.pythonTemplates(projectName, databases));
        }
        if (has('go', 'go / gin')) {
            Object.assign(templates, this.goTemplates(projectName));
        }
        if (has('rust', 'rust / actix')) {
            Object.assign(templates, this.rustTemplates(projectName));
        }
        if (languages.includes('kotlin')) {
            Object.assign(templates, this.kotlinTemplates(projectName));
        } else if (has('java', 'spring boot')) {
            Object.assign(templates, this.javaTemplates(projectName));
        }
        if (has('swift', 'swift')) {
            Object.assign(templates, this.swiftTemplates(projectName));
        }
        if (has('cpp', 'c++')) {
            Object.assign(templates, this.cppTemplates(projectName));
        }
        
        if (Object.keys(templates).length === 0) {
            Object.assign(templates, this.genericTemplates(projectName, framework));
        }

        if (deployments.some(value => value.includes('docker'))) {
            templates['Dockerfile'] = this.dockerfileFor(blueprint.framework ?? '');
            templates['.dockerignore'] = 'node_modules\n.next\nbin\nobj\n.venv\n__pycache__\ntarget\n.git\n.env';
        }
        if (deployments.some(value => value.includes('github actions')) ||
            (blueprint.folderStructure ?? []).some(folder => folder.replace(/\\/g, '/') === '.github/workflows')) {
            templates['.github/workflows/ci.yml'] = this.ciWorkflowFor(blueprint.framework ?? '');
        }

        return templates;
    }

    private genericTemplates(projectName: string, framework: string): TemplateMap {
        const templates: TemplateMap = {};
        templates['README.md'] = `# ${projectName}\n\nProject initialized with AI Context Brain Wizard.\nFramework/Language: ${framework || 'Generic'}\n\n## Getting Started\n\n1. Install dependencies\n2. Run the application\n`;
        templates['.gitignore'] = `node_modules/\n.env\n.DS_Store\ncoverage/\nbuild/\ndist/\nbin/\nobj/\n.venv/\n__pycache__/\ntarget/\n`;
        templates['src/main.txt'] = `// Entry point for ${projectName}\n// Generated by AI Context Brain Wizard\n`;
        return templates;
    }

    private typescriptTemplates(
        projectName: string,
        databases: string[],
        auths: string[],
        billings: string[],
        automations: string[],
        locales: string[],
        hasDependency: (name: string) => boolean
    ): TemplateMap {
        const packageName = this.packageName(projectName);
        const deps: Record<string, string> = {
            next: '^16.2.9',
            react: '^19.2.7',
            'react-dom': '^19.2.7',
            zod: '^4.4.3',
            clsx: '^2.1.1',
            'tailwind-merge': '^3.6.0'
        };
        const devDeps: Record<string, string> = {
            '@types/node': '^22.19.21',
            '@types/react': '^19.2.17',
            '@types/react-dom': '^19.2.3',
            postcss: '^8.5.10',
            typescript: '^5.9.3',
            tsx: '^4.22.4'
        };
        const add = (name: string, version: string) => { deps[name] = version; };
        const usesPrisma = hasDependency('@prisma/client');
        const usesNextAuth = auths.some(value => value.includes('nextauth')) || hasDependency('next-auth');

        if (usesNextAuth) {
            add('next-auth', '5.0.0-beta.31');
            if (usesPrisma) add('bcryptjs', '^3.0.3');
        }
        if (auths.some(value => value.includes('jwt')) || hasDependency('jsonwebtoken')) {
            add('jsonwebtoken', '^9.0.2');
            devDeps['@types/jsonwebtoken'] = '^9.0.6';
        }
        if (usesPrisma) {
            add('@prisma/client', '^6.19.3');
            devDeps.prisma = '^6.19.3';
        }
        if (hasDependency('mongodb')) add('mongodb', '^6.8.1');
        if (billings.includes('stripe') || hasDependency('stripe')) add('stripe', '^22.2.2');
        if (billings.includes('paddle') || hasDependency('@paddle/paddle-js')) add('@paddle/paddle-js', '^1.3.3');
        if (automations.some(value => ['n8n', 'zapier', 'make'].includes(value)) || hasDependency('axios')) add('axios', '^1.7.7');
        if (automations.some(value => value.includes('worker')) || hasDependency('bullmq')) {
            add('bullmq', '^5.12.12');
            add('ioredis', '^5.4.1');
        }
        if (automations.includes('i18n') || hasDependency('i18next')) {
            add('i18next', '^23.14.0');
            add('react-i18next', '^15.0.1');
        }

        const templates: TemplateMap = {
            'package.json': JSON.stringify({
                name: packageName,
                version: '0.1.0',
                private: true,
                scripts: {
                    dev: 'next dev',
                    build: 'next build',
                    start: 'next start',
                    typecheck: 'tsc --noEmit',
                    test: 'node --import tsx --test tests/**/*.test.ts'
                },
                dependencies: deps,
                devDependencies: devDeps,
                overrides: {
                    postcss: '^8.5.10'
                }
            }, null, 2),
            'tsconfig.json': JSON.stringify({
                compilerOptions: {
                    target: 'ES2020',
                    lib: ['dom', 'dom.iterable', 'esnext'],
                    allowJs: false,
                    skipLibCheck: true,
                    strict: true,
                    noEmit: true,
                    esModuleInterop: true,
                    module: 'esnext',
                    moduleResolution: 'bundler',
                    resolveJsonModule: true,
                    isolatedModules: true,
                    jsx: 'react-jsx',
                    incremental: true,
                    plugins: [{ name: 'next' }],
                    paths: { '@/*': ['./src/*'] }
                },
                include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts', '.next/dev/types/**/*.ts'],
                exclude: ['node_modules']
            }, null, 2),
            'next-env.d.ts': '/// <reference types="next" />\n/// <reference types="next/image-types/global" />',
            'next.config.mjs': '/** @type {import(\'next\').NextConfig} */\nconst nextConfig = { reactStrictMode: true, turbopack: { root: process.cwd() } };\nexport default nextConfig;',
            'src/app/layout.tsx': `import "./globals.css";

export const metadata = {
  title: "${this.escape(projectName)}",
  description: "Generated with AI Context Brain",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`,
            'src/app/page.tsx': `import { AppShell } from "@/components/AppShell";

export default function HomePage() {
  return (
    <AppShell
      title="${this.escape(projectName)}"
      description="Your project scaffold is ready. Start building the domain from here."
    />
  );
}`,
            'src/app/globals.css': `:root {
  color-scheme: dark;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  background: #090b10;
  color: #f7f8fa;
}

* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; }
main { width: min(960px, calc(100% - 40px)); margin: 0 auto; padding: 96px 0; }
p { color: #a8afbf; line-height: 1.7; }`,
            'src/app/api/health/route.ts': `import { NextResponse } from "next/server";
import { getHealth } from "@/services/healthService";

export async function GET() {
  return NextResponse.json(getHealth());
}`,
            'src/components/AppShell.tsx': `import { Button } from "@/components/ui/Button";

export function AppShell({ title, description }: { title: string; description: string }) {
  return (
    <main>
      <p>AI Context Brain starter</p>
      <h1>{title}</h1>
      <p>{description}</p>
      <Button type="button">Create your first feature</Button>
    </main>
  );
}`,
            'src/components/ui/Button.tsx': `import type { ButtonHTMLAttributes } from "react";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{ background: "#f7f8fa", color: "#090b10", border: 0, padding: "10px 14px", cursor: "pointer" }}
    />
  );
}`,
            'src/lib/env.ts': `import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().optional(),
  AUTH_SECRET: z.string().min(32).optional(),
});

export const env = schema.parse(process.env);`,
            'src/services/healthService.ts': `export function getHealth() {
  return {
    status: "ok",
    service: "${packageName}",
    timestamp: new Date().toISOString(),
  };
}`,
            'tests/health.test.ts': `import assert from "node:assert/strict";
import test from "node:test";
import { getHealth } from "../src/services/healthService";

test("health service reports ready", () => {
  assert.equal(getHealth().status, "ok");
});`
        };

        const envLines = ['NODE_ENV=development', 'PORT=3000'];
        if (databases.some(value => value.includes('postgres'))) envLines.push('DATABASE_URL="postgresql://user:password@localhost:5432/app"');
        else if (databases.some(value => value.includes('mysql'))) envLines.push('DATABASE_URL="mysql://user:password@localhost:3306/app"');
        else if (databases.some(value => value.includes('sqlite'))) envLines.push('DATABASE_URL="file:./dev.db"');
        else if (databases.some(value => value.includes('mongo'))) envLines.push('DATABASE_URL="mongodb://localhost:27017/app"');
        if (usesNextAuth) envLines.push('AUTH_SECRET="replace-with-at-least-32-random-characters"', 'NEXTAUTH_URL="http://localhost:3000"');
        if (auths.some(value => value.includes('oauth'))) envLines.push('GITHUB_ID=""', 'GITHUB_SECRET=""');
        if (auths.some(value => value.includes('jwt'))) envLines.push('JWT_SECRET="replace-with-at-least-32-random-characters"');
        if (billings.includes('stripe') || hasDependency('stripe')) envLines.push('STRIPE_SECRET_KEY=""', 'STRIPE_WEBHOOK_SECRET=""');
        if (billings.includes('paddle') || hasDependency('@paddle/paddle-js')) envLines.push('PADDLE_WEBHOOK_SECRET=""');
        if (automations.some(value => value !== 'none')) envLines.push('WEBHOOK_SECRET=""');
        templates['.env.example'] = envLines.join('\n');

        if (usesPrisma) {
            const provider = databases.some(value => value.includes('mysql')) ? 'mysql'
                : databases.some(value => value.includes('sqlite')) ? 'sqlite'
                    : databases.some(value => value.includes('sql server')) ? 'sqlserver'
                        : 'postgresql';
            templates['prisma/schema.prisma'] = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}`;
            templates['src/lib/db/client.ts'] = `import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;`;
        }
        if (hasDependency('mongodb')) {
            templates['src/lib/mongodb/client.ts'] = `import { MongoClient } from "mongodb";

const uri = process.env.DATABASE_URL;
if (!uri) throw new Error("DATABASE_URL is required");
export const mongoClient = new MongoClient(uri);`;
        }
        if (usesNextAuth) {
            templates['src/lib/auth/index.ts'] = usesPrisma
                ? `import { compare } from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "@/lib/db/client";

const credentialsSchema = z.object({ email: z.string().email(), password: z.string().min(8) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
        if (!user || !(await compare(parsed.data.password, user.passwordHash))) return null;
        return { id: user.id, email: user.email };
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
});`
                : `import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub({ clientId: process.env.GITHUB_ID ?? "", clientSecret: process.env.GITHUB_SECRET ?? "" })],
  secret: process.env.AUTH_SECRET,
});`;
            templates['src/app/api/auth/[...nextauth]/route.ts'] = `import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;`;
            if (usesPrisma) {
                templates['src/app/api/auth/register/route.ts'] = `import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";

const schema = z.object({ email: z.string().email(), password: z.string().min(8).max(128) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid registration data" }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } })) {
    return NextResponse.json({ error: "Email is already registered" }, { status: 409 });
  }
  const user = await db.user.create({ data: { email, passwordHash: await hash(parsed.data.password, 12) } });
  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}`;
            }
        }
        if (auths.some(value => value.includes('jwt')) || hasDependency('jsonwebtoken')) {
            templates['src/services/auth/tokenService.ts'] = `import jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET;
if (!secret) throw new Error("JWT_SECRET is required");

export const signToken = (subject: string) => jwt.sign({}, secret, { subject, expiresIn: "15m" });
export const verifyToken = (token: string) => jwt.verify(token, secret);`;
        }
        if (billings.includes('stripe') || hasDependency('stripe')) {
            templates['src/services/billing/stripe.ts'] = `import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is required");
  return new Stripe(key);
}`;
            templates['src/app/api/webhooks/stripe/route.ts'] = `import { NextResponse } from "next/server";
import { getStripe } from "@/services/billing/stripe";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: "Invalid webhook configuration" }, { status: 400 });
  const stripe = getStripe();
  const event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  return NextResponse.json({ received: true, eventId: event.id });
}`;
        }
        if (billings.includes('paddle') || hasDependency('@paddle/paddle-js')) {
            templates['src/app/api/webhooks/paddle/route.ts'] = `import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("paddle-signature") ?? "";
  const secret = process.env.PADDLE_WEBHOOK_SECRET ?? "";
  const parts = Object.fromEntries(signature.split(";").map(part => part.split("=", 2)));
  const expected = createHmac("sha256", secret).update(\`\${parts.ts}:\${raw}\`).digest("hex");
  const received = parts.h1 ?? "";
  const valid = received.length === expected.length && timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  return valid ? NextResponse.json({ received: true }) : NextResponse.json({ error: "Invalid signature" }, { status: 401 });
}`;
        }
        for (const automation of automations.filter(value => ['n8n', 'zapier', 'make'].includes(value))) {
            templates[`src/app/api/webhooks/${automation}/route.ts`] = `import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const secret = request.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ received: true, payload: await request.json() });
}`;
        }
        if (automations.includes('i18n')) {
            for (const locale of locales.length ? locales : ['en']) {
                templates[`src/locales/${locale}/translation.json`] = JSON.stringify({
                    common: { welcome: `Welcome to ${projectName}` }
                }, null, 2);
            }
        }
        return templates;
    }

    private csharpTemplates(projectName: string, databases: string[], auths: string[]): TemplateMap {
        const ns = this.className(projectName);
        const provider = databases.some(value => value.includes('postgres')) ? 'Npgsql.EntityFrameworkCore.PostgreSQL'
            : databases.some(value => value.includes('sqlite')) ? 'Microsoft.EntityFrameworkCore.Sqlite'
                : 'Microsoft.EntityFrameworkCore.SqlServer';
        const useDatabase = !databases.some(value => value === 'none' || value === '') && databases.length > 0;
        const authPackage = auths.some(value => value.includes('jwt'))
            ? '<PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="9.0.0" />'
            : '';
        const dbPackage = useDatabase ? `<PackageReference Include="${provider}" Version="9.0.0" />` : '';
        return {
            'Directory.Build.props': `<Project>
  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
</Project>`,
            'src/Domain/Domain.csproj': '<Project Sdk="Microsoft.NET.Sdk" />',
            'src/Domain/Entities/SampleEntity.cs': `namespace ${ns}.Domain.Entities;

public sealed class SampleEntity
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Name { get; set; }
}`,
            'src/Domain/Common/Entity.cs': `namespace ${ns}.Domain.Common;

public abstract class Entity
{
    public Guid Id { get; protected init; } = Guid.NewGuid();
}`,
            'src/Application/Application.csproj': `<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup><ProjectReference Include="../Domain/Domain.csproj" /></ItemGroup>
</Project>`,
            'src/Application/Interfaces/IClock.cs': `namespace ${ns}.Application.Interfaces;
public interface IClock { DateTime UtcNow { get; } }`,
            'src/Application/Common/SystemClock.cs': `using ${ns}.Application.Interfaces;
namespace ${ns}.Application.Common;
public sealed class SystemClock : IClock { public DateTime UtcNow => DateTime.UtcNow; }`,
            'src/Infrastructure/Infrastructure.csproj': `<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <ProjectReference Include="../Application/Application.csproj" />
    <ProjectReference Include="../Domain/Domain.csproj" />
    <PackageReference Include="Microsoft.EntityFrameworkCore" Version="9.0.0" />
    ${dbPackage}
  </ItemGroup>
</Project>`,
            'src/Infrastructure/Persistence/AppDbContext.cs': `using Microsoft.EntityFrameworkCore;
using ${ns}.Domain.Entities;
namespace ${ns}.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<SampleEntity> SampleEntities => Set<SampleEntity>();
}`,
            'src/Infrastructure/Identity/CurrentUser.cs': `namespace ${ns}.Infrastructure.Identity;
public sealed record CurrentUser(string Id, string? Email);`,
            'src/WebApi/WebApi.csproj': `<Project Sdk="Microsoft.NET.Sdk.Web">
  <ItemGroup>
    <ProjectReference Include="../Application/Application.csproj" />
    <ProjectReference Include="../Infrastructure/Infrastructure.csproj" />
    ${authPackage}
  </ItemGroup>
</Project>`,
            'src/WebApi/Program.cs': `var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddHealthChecks();
var app = builder.Build();
app.MapControllers();
app.MapHealthChecks("/health");
app.Run();
public partial class Program;`,
            'src/WebApi/Controllers/HealthController.cs': `using Microsoft.AspNetCore.Mvc;
namespace ${ns}.WebApi.Controllers;

[ApiController]
[Route("api/health")]
public sealed class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new { status = "ok", service = "${this.escape(projectName)}" });
}`,
            'tests/Application.UnitTests/Application.UnitTests.csproj': `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup><IsPackable>false</IsPackable></PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.11.1" />
    <PackageReference Include="xunit" Version="2.9.2" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.8.2" />
    <ProjectReference Include="../../src/Application/Application.csproj" />
  </ItemGroup>
</Project>`,
            'tests/Application.UnitTests/SystemClockTests.cs': `using Xunit;
using ${ns}.Application.Common;
namespace ${ns}.Application.UnitTests;

public sealed class SystemClockTests
{
    [Fact]
    public void UtcNow_ReturnsCurrentTime() => Assert.True(new SystemClock().UtcNow <= DateTime.UtcNow);
}`
        };
    }

    private pythonTemplates(projectName: string, databases: string[]): TemplateMap {
        const dbDependency = databases.some(value => value.includes('postgres')) ? ', "psycopg[binary]>=3.2"'
            : databases.some(value => value.includes('mongo')) ? ', "pymongo>=4.8"' : '';
        return {
            'pyproject.toml': `[project]
name = "${this.packageName(projectName)}"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = ["fastapi>=0.112", "uvicorn[standard]>=0.30", "pydantic-settings>=2.4"${dbDependency}]

[project.optional-dependencies]
test = ["pytest>=8.3", "httpx>=0.27"]`,
            'src/__init__.py': '',
            'src/main.py': `from fastapi import FastAPI
from src.routers.health import router as health_router

app = FastAPI(title="${this.escape(projectName)}")
app.include_router(health_router)
`,
            'src/routers/__init__.py': '',
            'src/routers/health.py': `from fastapi import APIRouter
from src.schemas.health import HealthResponse
from src.services.health import health_status

router = APIRouter(prefix="/api", tags=["health"])

@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return health_status()
`,
            'src/schemas/__init__.py': '',
            'src/schemas/health.py': `from pydantic import BaseModel

class HealthResponse(BaseModel):
    status: str
    service: str
`,
            'src/services/__init__.py': '',
            'src/services/health.py': `from src.schemas.health import HealthResponse

def health_status() -> HealthResponse:
    return HealthResponse(status="ok", service="${this.escape(projectName)}")
`,
            'src/models/__init__.py': '',
            'src/models/base.py': `from dataclasses import dataclass

@dataclass(slots=True)
class Entity:
    id: str
`,
            'tests/test_health.py': `from fastapi.testclient import TestClient
from src.main import app

def test_health() -> None:
    response = TestClient(app).get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
`
        };
    }

    private goTemplates(projectName: string): TemplateMap {
        const moduleName = this.packageName(projectName);
        return {
            'go.mod': `module ${moduleName}

go 1.22

require github.com/gin-gonic/gin v1.10.0`,
            'main.go': `package main

import (
    "github.com/gin-gonic/gin"
    "${moduleName}/src/handler"
)

func main() {
    router := gin.Default()
    handler.RegisterHealth(router)
    _ = router.Run(":8080")
}`,
            'src/handler/health.go': `package handler
import "github.com/gin-gonic/gin"

func RegisterHealth(router *gin.Engine) {
    router.GET("/health", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })
}`,
            'src/domain/entity.go': 'package domain\ntype Entity struct { ID string `json:"id"` }',
            'src/repository/repository.go': 'package repository\ntype Repository interface { Ping() error }',
            'src/config/config.go': 'package config\nimport "os"\nfunc Port() string { if value := os.Getenv("PORT"); value != "" { return value }; return "8080" }',
            'tests/health_test.go': 'package tests\nimport "testing"\nfunc TestStarter(t *testing.T) { if false { t.Fatal("unreachable") } }'
        };
    }

    private rustTemplates(projectName: string): TemplateMap {
        return {
            'Cargo.toml': `[package]
name = "${this.packageName(projectName)}"
version = "0.1.0"
edition = "2021"

[dependencies]
actix-web = "4"
serde = { version = "1", features = ["derive"] }
serde_json = "1"`,
            'src/main.rs': `use actix_web::{get, App, HttpResponse, HttpServer, Responder};

#[get("/health")]
async fn health() -> impl Responder { HttpResponse::Ok().json(serde_json::json!({"status": "ok"})) }

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| App::new().service(health)).bind(("127.0.0.1", 8080))?.run().await
}`,
            'src/models/mod.rs': '#[derive(Debug)]\npub struct Entity { pub id: String }',
            'src/handlers/mod.rs': 'pub const HEALTH_PATH: &str = "/health";',
            'src/config/mod.rs': 'pub const DEFAULT_PORT: u16 = 8080;',
            'src/actors/mod.rs': 'pub struct BackgroundActor;',
            'tests/health.rs': '#[test]\nfn starter_is_ready() { assert_eq!(2 + 2, 4); }'
        };
    }

    private javaTemplates(projectName: string): TemplateMap {
        const className = this.className(projectName);
        const packageName = `com.example.${this.packageName(projectName).replace(/-/g, '')}`;
        const packagePath = packageName.replace(/\./g, '/');
        return {
            'pom.xml': `<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId><artifactId>${this.packageName(projectName)}</artifactId><version>0.1.0</version>
  <parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId><version>3.3.4</version></parent>
  <properties><java.version>21</java.version></properties>
  <dependencies>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-test</artifactId><scope>test</scope></dependency>
  </dependencies>
</project>`,
            [`src/main/java/${packagePath}/${className}Application.java`]: `package ${packageName};
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
@SpringBootApplication
public class ${className}Application {
  public static void main(String[] args) { SpringApplication.run(${className}Application.class, args); }
}`,
            [`src/main/java/${packagePath}/HealthController.java`]: `package ${packageName};
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
@RestController
public class HealthController {
  @GetMapping("/health") public Map<String, String> health() { return Map.of("status", "ok"); }
}`,
            'src/main/resources/application.yml': 'spring:\n  application:\n    name: ' + this.packageName(projectName),
            [`src/test/java/${packagePath}/StarterTest.java`]: `package ${packageName};
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertTrue;
class StarterTest { @Test void starts() { assertTrue(true); } }`
        };
    }

    private kotlinTemplates(projectName: string): TemplateMap {
        const className = this.className(projectName);
        return {
            'settings.gradle.kts': `rootProject.name = "${projectName}"`,
            'build.gradle.kts': `plugins {
  kotlin("jvm") version "2.0.20"
  kotlin("plugin.spring") version "2.0.20"
  id("org.springframework.boot") version "3.3.4"
}
repositories { mavenCentral() }
dependencies { implementation("org.springframework.boot:spring-boot-starter-web"); testImplementation(kotlin("test")) }`,
            [`src/main/kotlin/com/example/${className}Application.kt`]: `package com.example
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
@SpringBootApplication class ${className}Application
fun main(args: Array<String>) { runApplication<${className}Application>(*args) }`,
            'src/main/kotlin/com/example/HealthController.kt': `package com.example
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
@RestController class HealthController { @GetMapping("/health") fun health() = mapOf("status" to "ok") }`,
            'src/test/kotlin/com/example/StarterTest.kt': 'package com.example\nimport kotlin.test.Test\nimport kotlin.test.assertTrue\nclass StarterTest { @Test fun starts() = assertTrue(true) }'
        };
    }

    private swiftTemplates(projectName: string): TemplateMap {
        const moduleName = this.className(projectName);
        return {
            'Package.swift': `// swift-tools-version: 5.10
import PackageDescription
let package = Package(name: "${moduleName}", targets: [.executableTarget(name: "${moduleName}"), .testTarget(name: "${moduleName}Tests", dependencies: ["${moduleName}"])])`,
            [`Sources/${moduleName}/main.swift`]: `import Foundation
print("${this.escape(projectName)} is ready")`,
            [`Tests/${moduleName}Tests/StarterTests.swift`]: `import XCTest
@testable import ${moduleName}
final class StarterTests: XCTestCase { func testStarter() { XCTAssertTrue(true) } }`
        };
    }

    private cppTemplates(projectName: string): TemplateMap {
        const executable = this.packageName(projectName).replace(/-/g, '_');
        return {
            'CMakeLists.txt': `cmake_minimum_required(VERSION 3.20)
project(${executable} LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 20)
add_executable(${executable} src/main.cpp)`,
            'src/main.cpp': `#include <iostream>
int main() { std::cout << "${this.escape(projectName)} is ready\\n"; return 0; }`,
            'tests/starter_test.cpp': '#include <cassert>\nint main() { assert(2 + 2 == 4); }'
        };
    }

    private dockerfileFor(framework: string): string {
        const value = framework.toLowerCase();
        if (value.includes('asp.net')) return 'FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build\nWORKDIR /src\nCOPY . .\nRUN dotnet publish src/WebApi/WebApi.csproj -c Release -o /app\nFROM mcr.microsoft.com/dotnet/aspnet:9.0\nWORKDIR /app\nCOPY --from=build /app .\nENTRYPOINT ["dotnet", "WebApi.dll"]';
        if (value.includes('fastapi')) return 'FROM python:3.12-slim\nWORKDIR /app\nCOPY . .\nRUN pip install .\nEXPOSE 8000\nCMD ["uvicorn", "src.main:app", "--host", "0.0.0.0"]';
        if (value.includes('go / gin')) return 'FROM golang:1.22 AS build\nWORKDIR /src\nCOPY . .\nRUN go build -o /app/server .\nFROM gcr.io/distroless/base-debian12\nCOPY --from=build /app/server /server\nENTRYPOINT ["/server"]';
        return 'FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\nCOPY . .\nRUN npm run build\nEXPOSE 3000\nCMD ["npm", "start"]';
    }

    private ciWorkflowFor(framework: string): string {
        const value = framework.toLowerCase();
        if (value.includes('asp.net')) return 'name: CI\non: [push, pull_request]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-dotnet@v4\n        with:\n          dotnet-version: 9.0.x\n      - run: dotnet test';
        if (value.includes('fastapi')) return 'name: CI\non: [push, pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-python@v5\n        with:\n          python-version: "3.12"\n      - run: pip install .[test]\n      - run: pytest';
        return 'name: CI\non: [push, pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n          cache: npm\n      - run: npm install\n      - run: npm test\n      - run: npm run build';
    }

    private safeChild(root: string, relativePath: string): string | null {
        if (!relativePath || path.isAbsolute(relativePath)) return null;
        const target = path.resolve(root, relativePath);
        const relative = path.relative(root, target);
        if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
        return target;
    }

    private packageName(value: string): string {
        return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app';
    }

    private className(value: string): string {
        const name = value.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
        return /^[A-Za-z]/.test(name) ? name : `App${name || 'Project'}`;
    }

    private escape(value: string): string {
        return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }
}
