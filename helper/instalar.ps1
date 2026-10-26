# Instala o LiquiSteam Helper para o seu usuário do Windows (não precisa de administrador).
#   Instalar:   powershell -ExecutionPolicy Bypass -File .\helper\instalar.ps1
#   Remover:    powershell -ExecutionPolicy Bypass -File .\helper\instalar.ps1 -Remover
param([switch]$Remover)

$dir = Join-Path $env:LOCALAPPDATA 'LiquiSteam'
$link = Join-Path ([Environment]::GetFolderPath('Startup')) 'LiquiSteam Helper.lnk'
$script = Join-Path $dir 'LiquiSteam-Helper.ps1'

# Encerra a cópia que estiver rodando, se houver.
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
    Where-Object { $_.CommandLine -like '*LiquiSteam-Helper.ps1*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

if ($Remover) {
    Remove-Item $link -Force -ErrorAction SilentlyContinue
    Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host 'LiquiSteam Helper removido.'
    exit
}

New-Item -ItemType Directory -Force $dir | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'LiquiSteam-Helper.ps1') $script -Force

$arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""

# Inicia junto com o Windows.
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($link)
$shortcut.TargetPath = 'powershell.exe'
$shortcut.Arguments = $arguments
$shortcut.WindowStyle = 7
$shortcut.Save()

# E já inicia agora.
Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WindowStyle Hidden

Write-Host 'LiquiSteam Helper instalado e em execução. Ele inicia sozinho com o Windows.'
