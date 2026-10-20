# OpenShelf one-line installer for Windows.
#
#   irm https://raw.githubusercontent.com/sidvashisth2005/OpenShelf/main/install.ps1 | iex
#
# Downloads the latest OpenShelf.exe from GitHub Releases, verifies its SHA-256
# against the published checksum, and runs it in this window. Nothing runs if
# the checksum does not match.

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"   # much faster downloads in Windows PowerShell 5.1
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$base = "https://github.com/sidvashisth2005/OpenShelf/releases/latest/download"
$work = Join-Path $env:TEMP ("OpenShelf-setup-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $work | Out-Null
$exe = Join-Path $work "OpenShelf.exe"
$sum = Join-Path $work "OpenShelf.exe.sha256"

try {
    Write-Host ""
    Write-Host "  OpenShelf" -ForegroundColor Magenta
    Write-Host "  Downloading the installer from GitHub..."
    Invoke-WebRequest -Uri "$base/OpenShelf.exe" -OutFile $exe -UseBasicParsing
    Invoke-WebRequest -Uri "$base/OpenShelf.exe.sha256" -OutFile $sum -UseBasicParsing

    $expected = ((Get-Content $sum -Raw).Trim() -split "\s+")[0].ToLower()
    $actual = (Get-FileHash $exe -Algorithm SHA256).Hash.ToLower()
    if ($actual -ne $expected) {
        throw "Checksum mismatch (expected $expected, got $actual). The download may be corrupted or tampered with."
    }
    Write-Host "  Checksum verified." -ForegroundColor Green

    # Optional extra installer flags for automation, e.g. $env:OPENSHELF_INSTALL_ARGS = "--dir D:\Apps\OpenShelf"
    $extra = @()
    if ($env:OPENSHELF_INSTALL_ARGS) { $extra = $env:OPENSHELF_INSTALL_ARGS -split "\s+" | Where-Object { $_ } }
    & $exe @extra
    if ($LASTEXITCODE -ne 0) { throw "The installer exited with code $LASTEXITCODE." }
}
catch {
    Write-Host ""
    Write-Host "  OpenShelf could not be installed: $($_.Exception.Message)" -ForegroundColor Red
}
finally {
    Start-Sleep -Milliseconds 500
    Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
}
