# AI Context Brain - Database Schema

## Overview
PostgreSQL database designed to store project intelligence, architecture rules, and coding conventions.

## Tables

### Projects
Stores project metadata and configuration.
```sql
CREATE TABLE Projects (
    Id SERIAL PRIMARY KEY,
    Name VARCHAR(200) NOT NULL,
    Path VARCHAR(500) NOT NULL UNIQUE,
    Framework VARCHAR(100),
    ArchitectureType VARCHAR(100),
    DatabaseType VARCHAR(100),
    AuthSystem VARCHAR(100),
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    IsActive BOOLEAN DEFAULT TRUE
);
```

### ArchitectureRules
Defines architectural patterns and validation rules.
```sql
CREATE TABLE ArchitectureRules (
    Id SERIAL PRIMARY KEY,
    Name VARCHAR(200) NOT NULL,
    Pattern TEXT NOT NULL,
    Description VARCHAR(1000),
    FolderPath VARCHAR(500),
    IsActive BOOLEAN DEFAULT TRUE,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ProjectId INTEGER REFERENCES Projects(Id) ON DELETE CASCADE
);
```

### CodingConventions
Stores coding standards and conventions.
```sql
CREATE TABLE CodingConventions (
    Id SERIAL PRIMARY KEY,
    Name VARCHAR(200) NOT NULL,
    Rule TEXT NOT NULL,
    Example VARCHAR(1000),
    Language VARCHAR(50),
    IsActive BOOLEAN DEFAULT TRUE,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ProjectId INTEGER REFERENCES Projects(Id) ON DELETE CASCADE
);
```

### SystemDecisions
Records important architectural and technical decisions.
```sql
CREATE TABLE SystemDecisions (
    Id SERIAL PRIMARY KEY,
    Title VARCHAR(300) NOT NULL,
    Decision TEXT NOT NULL,
    Reasoning VARCHAR(2000),
    Category VARCHAR(100),
    DecisionDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ProjectId INTEGER REFERENCES Projects(Id) ON DELETE CASCADE
);
```

### ProjectScans
Maintains scan history and project metrics.
```sql
CREATE TABLE ProjectScans (
    Id SERIAL PRIMARY KEY,
    ScanDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ScanData JSONB,
    Framework VARCHAR(100),
    ArchitectureType VARCHAR(100),
    FilesCount INTEGER,
    LinesOfCode INTEGER,
    ProjectId INTEGER REFERENCES Projects(Id) ON DELETE CASCADE
);
```

### FrameworkPatterns
Predefined patterns for framework detection.
```sql
CREATE TABLE FrameworkPatterns (
    Id SERIAL PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    DetectionRules JSONB,
    FolderStructure JSONB,
    CommonDependencies VARCHAR(1000),
    TypicalCommands VARCHAR(1000),
    IsActive BOOLEAN DEFAULT TRUE,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Indexes
- Projects.Path (unique)
- ArchitectureRules.ProjectId
- CodingConventions.ProjectId
- SystemDecisions.ProjectId
- ProjectScans.ProjectId
- ProjectScans.ScanDate

## Relationships
- Projects 1:N ArchitectureRules
- Projects 1:N CodingConventions
- Projects 1:N SystemDecisions
- Projects 1:N ProjectScans
