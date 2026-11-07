$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    if (-not (Test-Path -LiteralPath 'node_modules')) {
        & npm ci --ignore-scripts
        if ($LASTEXITCODE -ne 0) { throw 'Could not install discovery dependencies.' }
    }
    & npm start
    if ($LASTEXITCODE -ne 0) { throw 'Discovery service stopped with an error.' }
} finally {
    Pop-Location
}
