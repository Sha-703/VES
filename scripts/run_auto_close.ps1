param(
    [string]$ProjectPath = "f:/MES PROJETS/elections_project/backend",
    [string]$VenvPath = "",
    [string]$PythonExe = "python"
)

# Ensure paths use Windows-style separators
$ProjectPath = $ProjectPath -replace '/', '\'
if ($VenvPath) { $VenvPath = $VenvPath -replace '/', '\' }

$logDir = Join-Path $ProjectPath 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logFile = Join-Path $logDir "auto_close_$(Get-Date -Format yyyyMMdd).log"

function Write-Log { param($msg) $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $msg"; Add-Content -Path $logFile -Value $line }

try {
    Write-Log "Starting auto-close task. ProjectPath=$ProjectPath VenvPath=$VenvPath"

    Push-Location $ProjectPath

    if ($VenvPath -and (Test-Path $VenvPath)) {
        $activate = Join-Path $VenvPath 'Scripts\Activate.ps1'
        if (Test-Path $activate) {
            Write-Log "Activating virtualenv at $VenvPath"
            . $activate
        } elseif (Test-Path (Join-Path $VenvPath 'Scripts\activate')) {
            # fallback to batch activate using cmd
            Write-Log "Activating virtualenv (cmd) at $VenvPath"
            & cmd.exe /c "\"$VenvPath\Scripts\activate.bat\""
        } else {
            Write-Log "Virtualenv activate script not found; proceeding without activation"
        }
    }

    # Run the management command
    Write-Log "Running: $PythonExe manage.py auto_close_elections"
    & $PythonExe manage.py auto_close_elections 2>&1 | ForEach-Object { Write-Log $_ }
    $exitCode = $LASTEXITCODE
    Write-Log "auto_close_elections finished with exit code $exitCode"

    Pop-Location
} catch {
    Write-Log "Exception: $_"
    Pop-Location
    exit 1
}

exit 0
