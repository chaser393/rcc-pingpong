$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node.exe -ErrorAction Stop
$major = [int]((& $nodeCommand.Source -p 'process.versions.node.split(".")[0]') | Select-Object -Last 1)
if ($major -lt 24) { throw 'Install Node.js 24 or newer, then run this file again.' }
if (-not (Test-Path -LiteralPath '.env')) {
  $secretBytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($secretBytes)
  $rng.Dispose()
  $setupSecret = [BitConverter]::ToString($secretBytes).Replace('-', '').ToLowerInvariant()
  @("HOST=127.0.0.1", "PORT=3000", "SETUP_KEY=$setupSecret", 'PONG_DATA_DIR=./data') | Set-Content -LiteralPath '.env'
}
Write-Output 'RCC PINGPONG NIGHT is starting at http://localhost:3000.'
Write-Output 'The first-manager setup key is stored in .env. Hosting instructions are in HOSTING.md.'
& $nodeCommand.Source --env-file-if-exists=.env server.js
