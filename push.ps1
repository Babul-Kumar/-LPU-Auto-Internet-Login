# push.ps1 — Run as Administrator to fix IPv6 and push to GitHub
# Usage: Right-click → "Run with PowerShell" (as Admin)

$hostsFile = "C:\Windows\System32\drivers\etc\hosts"
$repoDir   = Split-Path -Parent $MyInvocation.MyCommand.Definition

# GitHub IPv4 addresses (as of Aug 2026)
$entries = @(
    "20.207.73.82    github.com",
    "185.199.108.133 objects.githubusercontent.com",
    "185.199.109.133 objects.githubusercontent.com",
    "140.82.112.3    api.github.com"
)

Write-Host "`n[1/3] Patching hosts file to force GitHub IPv4..." -ForegroundColor Cyan

$current = Get-Content $hostsFile -Raw
foreach ($entry in $entries) {
    $host = ($entry -split '\s+')[1]
    if ($current -notmatch [regex]::Escape($host)) {
        Add-Content $hostsFile "`n$entry"
        Write-Host "  Added: $entry" -ForegroundColor Green
    } else {
        Write-Host "  Already exists: $host" -ForegroundColor Yellow
    }
}

Write-Host "`n[2/3] Flushing DNS cache..." -ForegroundColor Cyan
ipconfig /flushdns | Out-Null
Write-Host "  DNS cache flushed." -ForegroundColor Green

Write-Host "`n[3/3] Pushing to GitHub..." -ForegroundColor Cyan
Set-Location $repoDir
git push origin main

Write-Host "`nDone! You can now remove the hosts entries if you want:" -ForegroundColor Green
Write-Host "  notepad C:\Windows\System32\drivers\etc\hosts" -ForegroundColor Gray
