$ErrorActionPreference='Stop'
$taskUrl='https://github.com/tianz88-bit/game-prototypes/releases/download/punchies-relaunch-lab-20261110/punchies-relaunch-assets-20261110.zip'
$taskHash='A003E3DD95F70946CAB50231335D29605A922808AF52AE1DB741D54523D3C2B8'
$taskZip=Join-Path ([System.IO.Path]::GetTempPath()) ('punchies-relaunch-'+[guid]::NewGuid().ToString()+'.zip')
try {
 Invoke-WebRequest -Uri $taskUrl -OutFile $taskZip
 if((Get-FileHash -LiteralPath $taskZip -Algorithm SHA256).Hash -ne $taskHash){throw 'Asset bundle checksum mismatch'}
 Expand-Archive -LiteralPath $taskZip -DestinationPath (Join-Path $PSScriptRoot 'rig-lab') -Force
 Write-Output 'Assets installed. Run: $env:PORT="5338"; node ./rig-lab/server.mjs'
} finally {
 if(Test-Path -LiteralPath $taskZip){Remove-Item -LiteralPath $taskZip}
}
