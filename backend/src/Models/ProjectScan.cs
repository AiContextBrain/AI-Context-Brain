namespace AiContextBrain.Models;

public class ProjectScan
{
    // PostgreSQL: Use string (UUID) for Id
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public DateTime ScanDate { get; set; } = DateTime.UtcNow;
    public string ScanData { get; set; } = string.Empty;
    public string FolderStructureJson { get; set; } = "[]";
    public string? Framework { get; set; }
    public string? ArchitectureType { get; set; }
    public string? ScanFingerprint { get; set; }
    public string? SemanticSummary { get; set; }
    public int FilesCount { get; set; }
    public int LinesOfCode { get; set; }
    public int AddedFilesCount { get; set; }
    public int ModifiedFilesCount { get; set; }
    public int DeletedFilesCount { get; set; }
    public bool IsIncrementalScan { get; set; }
    public string? ChangedFilesJson { get; set; }
    public string ProjectId { get; set; } = string.Empty;

    // Navigation property
    public Project? Project { get; set; }
}
