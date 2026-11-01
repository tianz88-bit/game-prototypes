param([Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{40}$')][string]$ReviewedSha,[Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{40}$')][string]$ProductionSha,[switch]$OwnerApproved)
$ErrorActionPreference='Stop'
if (!$OwnerApproved) { throw 'Explicit owner itch approval is required. Stage READY is not approval.' }
$live=Invoke-RestMethod -Uri "https://tianz88-bit.github.io/game-prototypes/staging/punchies/stage.json?promotion=$ReviewedSha"
if ($live.sha -ne $ReviewedSha) { throw 'SHA must match the current reviewed public staging source.' }
$ghCommand=Get-Command gh -ErrorAction SilentlyContinue
$ghExecutable=if($ghCommand){$ghCommand.Source}else{Join-Path $env:USERPROFILE 'Documents/Codex/playdate-bootstrap/gh/bin/gh.exe'}
if(!(Test-Path -LiteralPath $ghExecutable)){throw 'GitHub CLI is unavailable. Install gh or add it to PATH.'}
& $ghExecutable workflow run promote-punchies-reviewed.yml --repo tianz88-bit/game-prototypes --ref main -f "production_sha=$ProductionSha" -f "reviewed_sha=$ReviewedSha" -f "owner_approved_sha=$ReviewedSha"
if ($LASTEXITCODE -ne 0) { throw 'Promotion dispatch failed.' }
Write-Host "Dispatched approved source $ReviewedSha; CI production safety/compatibility checks run before upload."
