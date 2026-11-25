[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ProjectFile,
    [string]$Destination,
    [string]$HistoryRoot,
    [switch]$Browse,
    [switch]$Gui
)

$ErrorActionPreference = 'Stop'

function Show-Result($Message, $Icon) {
    if ($Gui) {
        [void][Windows.Forms.MessageBox]::Show($Message, 'Altium Local History', 'OK', $Icon)
    } else {
        Write-Host $Message
    }
}

if ($Gui) { Add-Type -AssemblyName System.Windows.Forms }

try {
    $project = Get-Item -LiteralPath $ProjectFile
    if ($project -isnot [IO.FileInfo] -or $project.Extension -ine '.PrjPcb') {
        throw 'Select a saved PCB project (.PrjPcb).'
    }
    $projectFolder = $project.DirectoryName
    if (-not $HistoryRoot) { $HistoryRoot = Join-Path $projectFolder 'History' }
    $HistoryRoot = (Get-Item -LiteralPath $HistoryRoot).FullName
    if (-not [IO.Directory]::Exists($HistoryRoot)) { throw "Not a History folder: $HistoryRoot" }

    if ($Browse) {
        Invoke-Item -LiteralPath $HistoryRoot
        return
    }

    $isSourceDocument = $false
    $documents = @(foreach ($line in Get-Content -LiteralPath $project.FullName) {
        if ($line -match '^\s*\[([^\]]+)\]') { $isSourceDocument = $Matches[1] -match '^Document\d+$' }
        if ($isSourceDocument -and $line -match '^\s*DocumentPath\s*=\s*(.+\.(?:SchDoc|PcbDoc))\s*$') {
            $path = $Matches[1]
            if (-not [IO.Path]::IsPathRooted($path)) { $path = Join-Path $projectFolder $path }
            [IO.Path]::GetFullPath($path)
        }
    }) | Sort-Object -Unique
    if (-not $documents) { throw "No SchDoc or PcbDoc entries found in $($project.Name)." }

    if (-not $Destination) {
        if (-not $Gui) { throw 'Specify -Destination to select the export parent folder.' }
        $picker = New-Object Windows.Forms.FolderBrowserDialog
        try {
            $picker.Description = 'Choose where to save the Altium Local History export.'
            $picker.SelectedPath = $projectFolder
            if ($picker.ShowDialog() -ne 'OK') { return }
            $Destination = $picker.SelectedPath
        } finally {
            $picker.Dispose()
        }
    }

    Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
    $output = Join-Path $Destination ("{0}-history-{1}" -f $project.BaseName, (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
    $output = (New-Item -ItemType Directory -Path $output).FullName
    $issues = New-Object 'Collections.Generic.List[string]'
    $totals = New-Object 'Collections.Generic.List[string]'
    $projectPrefix = $projectFolder.TrimEnd('\') + '\'

    foreach ($path in $documents) {
        $name = [IO.Path]::GetFileName($path)
        $base = [IO.Path]::GetFileNameWithoutExtension($name)
        $extension = [IO.Path]::GetExtension($name)
        $pattern = '^' + [regex]::Escape($base) + '(?:\.\~\(\d+\))+(?:\.#\([^)]*\))*' + [regex]::Escape($extension) + '\.zip$'
        if ($path.StartsWith($projectPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            $relative = $path.Substring($projectPrefix.Length)
            $subfolder = [IO.Path]::GetDirectoryName($relative)
            $sourceFolder = $HistoryRoot
            if ($subfolder) { $sourceFolder = Join-Path $sourceFolder $subfolder }
            $documentOutput = Join-Path $output $relative
        } else {
            $sourceFolder = Join-Path ([IO.Path]::GetDirectoryName($path)) 'History'
            $documentOutput = Join-Path $output ('External\{0}-{1}' -f $totals.Count, $name)
        }

        [void][IO.Directory]::CreateDirectory($documentOutput)
        $count = 0
        if ([IO.Directory]::Exists($sourceFolder)) {
            foreach ($archive in Get-ChildItem -LiteralPath $sourceFolder -File -Filter '*.zip') {
                if ($archive.Name -notmatch $pattern) { continue }
                $versionName = $archive.BaseName
                $target = Join-Path $documentOutput $versionName
                $partial = $target + '.partial'
                try {
                    $zip = [IO.Compression.ZipFile]::OpenRead($archive.FullName)
                    try {
                        $entries = @($zip.Entries | Where-Object { [IO.Path]::GetExtension($_.Name) -ieq $extension })
                        $entry = $entries | Where-Object { $_.Name -ieq $versionName } | Select-Object -First 1
                        if (-not $entry -and $entries.Count -eq 1) { $entry = $entries[0] }
                        if (-not $entry) { throw "Could not identify a single $extension document in the ZIP." }
                        [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $partial)
                        [IO.File]::Move($partial, $target)
                        $count++
                    } finally {
                        $zip.Dispose()
                    }
                } catch {
                    if ([IO.File]::Exists($partial)) { [IO.File]::Delete($partial) }
                    $issues.Add("$($archive.FullName): $($_.Exception.Message)")
                }
            }
        }

        try {
            [IO.File]::Copy($path, (Join-Path $documentOutput $name))
            $current = 'current saved file copied'
        } catch {
            $current = 'current saved file unavailable'
            $issues.Add("${path}: $($_.Exception.Message)")
        }
        $totals.Add("${name}: $count archived versions, $current")
    }

    $summary = "Export folder: $output`r`n`r`n" + ($totals -join "`r`n")
    if ($issues.Count) {
        Set-Content -LiteralPath (Join-Path $output 'export-errors.txt') -Value $issues -Encoding UTF8
        Show-Result "$summary`r`n`r`n$($issues.Count) errors. See export-errors.txt." 'Warning'
        exit 1
    }
    Show-Result $summary 'Information'
} catch {
    if (-not $Gui) { throw }
    Show-Result $_.Exception.Message 'Error'
    exit 1
}
