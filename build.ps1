Add-Type -Assembly "System.IO.Compression.FileSystem"

$manifest = Get-Content "manifest.json" | ConvertFrom-Json
$version = $manifest.version
$output = "$PSScriptRoot\RandomBookmark-$version.zip"

$include = @(
    "manifest.json",
    "background.js",
    "core.js",
    "shared.js",
    "options.css",
    "options.html",
    "options.js",
    "icons"
)

if (Test-Path $output) { Remove-Item $output }

$zip = [System.IO.Compression.ZipFile]::Open($output, "Create")

foreach ($item in $include) {
    $path = Join-Path $PSScriptRoot $item
    if (Test-Path $path -PathType Leaf) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $path, $item, "Optimal") | Out-Null
    } elseif (Test-Path $path -PathType Container) {
        Get-ChildItem $path -Recurse -File | ForEach-Object {
            $entryName = $_.FullName.Substring($PSScriptRoot.Length + 1).Replace("\", "/")
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entryName, "Optimal") | Out-Null
        }
    }
}

$zip.Dispose()
Write-Host "Created $output"
