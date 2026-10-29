# LiquiSteam Helper (Windows)
# Pequeno servico local que deixa o site LiquiSteam saber se a Steam esta aberta,
# qual jogo esta rodando e quais tem atualizacao pendente, e abrir/encerrar o cliente e os jogos. Escuta so em 127.0.0.1 e so aceita pedidos vindos do
# seu site. Fica parado ate alguem perguntar, entao nao consome processador.
#
# Se um dia voce usar um dominio proprio, acrescente-o em $AllowedOrigin.

$Port = 47231
$AllowedOrigin = '^(https://(liquisteam|liquisteam-[a-z0-9]+(-[a-z0-9]+)*-ryos3)\.vercel\.app|http://(localhost|127\.0\.0\.1):5173)$'

function Get-SteamState {
    $procs = [System.Diagnostics.Process]::GetProcessesByName('steam')
    $found = $procs.Count -gt 0
    foreach ($p in $procs) { $p.Dispose() }
    if (-not $found) { return 'not-running' }
    # ActiveUser e 0 enquanto a Steam ainda inicia ou espera o login.
    $user = 0
    try {
        $value = (Get-ItemProperty 'HKCU:\Software\Valve\Steam\ActiveProcess' -ErrorAction Stop).ActiveUser
        if ($null -ne $value) { $user = [int]$value }
    } catch { }
    if ($user -ne 0) { return 'running' }
    return 'starting'
}

# AppID do jogo em execucao (0 = nenhum). A Steam grava isso no registro enquanto o jogo roda.
function Get-RunningAppId {
    try {
        $value = (Get-ItemProperty 'HKCU:\Software\Valve\Steam' -ErrorAction Stop).RunningAppID
        if ($null -ne $value) { return [int64]$value }
    } catch { }
    return 0
}

function Get-SteamExe {
    try {
        $exe = (Get-ItemProperty 'HKCU:\Software\Valve\Steam' -ErrorAction Stop).SteamExe
        if ($exe -and (Test-Path $exe)) { return $exe }
    } catch { }
    # Instalacao padrao, caso o registro nao tenha o caminho.
    foreach ($base in @(${env:ProgramFiles(x86)}, $env:ProgramFiles)) {
        if ($base) {
            $candidate = Join-Path $base 'Steam\steam.exe'
            if (Test-Path $candidate) { return $candidate }
        }
    }
    return $null
}

# Esconde as janelas da Steam (loja, avisos) logo depois de abrir pelo site.
$script:canHide = $false
try {
    Add-Type -Namespace LiquiSteam -Name Win -UsingNamespace 'System.Collections.Generic' -MemberDefinition @'
public delegate bool EnumProc(IntPtr h, IntPtr l);
[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h, int cmd);
public static int HideWindows(int[] pids) {
    HashSet<uint> set = new HashSet<uint>();
    foreach (int id in pids) { set.Add((uint)id); }
    int count = 0;
    EnumWindows(delegate (IntPtr h, IntPtr l) {
        if (!IsWindowVisible(h)) { return true; }
        uint pid;
        GetWindowThreadProcessId(h, out pid);
        if (set.Contains(pid)) { ShowWindowAsync(h, 0); count++; }
        return true;
    }, IntPtr.Zero);
    return count;
}
'@
    $script:canHide = $true
} catch { }

$script:stealth = $null
function Start-Stealth {
    if (-not $script:canHide) { return }
    if ($script:stealth) { try { $script:stealth.Stop(); $script:stealth.Dispose() } catch { } }
    $ps = [powershell]::Create()
    [void]$ps.AddScript({
        $end = (Get-Date).AddSeconds(45)
        $lastHide = $null
        while ((Get-Date) -lt $end) {
            Start-Sleep -Milliseconds 300
            # Depois de esconder, para quando nada mais aparece por 12 segundos.
            if ($lastHide -and ((Get-Date) - $lastHide).TotalSeconds -gt 12) { break }
            $ids = @(Get-Process -Name 'steam', 'steamwebhelper' -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
            if ($ids.Count -eq 0) { continue }
            # So esconde depois do login: a tela de entrada precisa continuar visivel.
            $user = 0
            try {
                $value = (Get-ItemProperty 'HKCU:\Software\Valve\Steam\ActiveProcess' -ErrorAction Stop).ActiveUser
                if ($null -ne $value) { $user = [int]$value }
            } catch { }
            if ($user -eq 0) { continue }
            if ([LiquiSteam.Win]::HideWindows([int[]]$ids) -gt 0) { $lastHide = Get-Date }
        }
    })
    [void]$ps.BeginInvoke()
    $script:stealth = $ps
}

# Raiz da Steam e todas as bibliotecas (cada HD ou pasta de jogos), lidas de libraryfolders.vdf.
function Get-SteamLibraryDirs {
    $steam = $null
    try { $steam = (Get-ItemProperty 'HKCU:\Software\Valve\Steam' -ErrorAction Stop).SteamPath } catch { }
    if (-not $steam) {
        foreach ($base in @(${env:ProgramFiles(x86)}, $env:ProgramFiles)) {
            if ($base -and (Test-Path -LiteralPath (Join-Path $base 'Steam'))) { $steam = Join-Path $base 'Steam'; break }
        }
    }
    $seen = @{}
    $dirs = New-Object System.Collections.ArrayList
    if (-not $steam) { return @() }
    $steam = $steam -replace '/', '\'
    $candidates = New-Object System.Collections.ArrayList
    [void]$candidates.Add((Join-Path $steam 'steamapps'))
    $vdf = Join-Path $steam 'steamapps\libraryfolders.vdf'
    if (Test-Path -LiteralPath $vdf) {
        $text = [System.IO.File]::ReadAllText($vdf)
        foreach ($m in [regex]::Matches($text, '"path"\s+"([^"]+)"')) {
            $path = $m.Groups[1].Value -replace '\\\\', '\'
            [void]$candidates.Add((Join-Path $path 'steamapps'))
        }
    }
    foreach ($dir in $candidates) {
        $key = $dir.ToLowerInvariant()
        if (-not $seen.ContainsKey($key) -and (Test-Path -LiteralPath $dir)) {
            $seen[$key] = $true
            [void]$dirs.Add($dir)
        }
    }
    return $dirs.ToArray()
}

function Get-AcfValue([string]$text, [string]$key) {
    $m = [regex]::Match($text, '"' + $key + '"\s+"((?:[^"\\]|\\.)*)"', 'IgnoreCase')
    if ($m.Success) { return ($m.Groups[1].Value -replace '\\(["\\])', '$1') }
    return $null
}

# Le o arquivo mesmo que a Steam esteja gravando nele agora.
function Read-SharedText([string]$path) {
    $stream = New-Object System.IO.FileStream($path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    try {
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
        return $reader.ReadToEnd()
    } finally {
        $stream.Dispose()
    }
}

function Get-AcfNumber([string]$text, [string]$key) {
    $raw = Get-AcfValue $text $key
    if ($raw -match '^\d+$') { return [int64]$raw }
    return [int64]0
}

# So le os manifestos (appmanifest_*.acf): nao abre nem altera nada nos jogos.
# Cada manifesto traz o estado do jogo (instalado, atualizacao pendente...).
function Get-GameManifests {
    $games = @{}
    foreach ($dir in (Get-SteamLibraryDirs)) {
        $files = @()
        try { $files = Get-ChildItem -LiteralPath $dir -Filter 'appmanifest_*.acf' -File -ErrorAction Stop } catch { }
        foreach ($file in $files) {
            try {
                $text = Read-SharedText $file.FullName
                $appid = Get-AcfValue $text 'appid'
                if (-not $appid -or $appid -notmatch '^\d+$') { continue }
                if ($games.ContainsKey($appid)) { continue }
                $installdir = Get-AcfValue $text 'installdir'
                $gamePath = $null
                if ($installdir) { $gamePath = Join-Path (Join-Path $dir 'common') $installdir }
                $games[$appid] = [pscustomobject]@{
                    appid           = [int64]$appid
                    name            = (Get-AcfValue $text 'name')
                    installdir      = $installdir
                    path            = $gamePath
                    size            = (Get-AcfNumber $text 'SizeOnDisk')
                    stateFlags      = (Get-AcfNumber $text 'StateFlags')
                    buildId         = (Get-AcfNumber $text 'buildid')
                    targetBuildId   = (Get-AcfNumber $text 'TargetBuildID')
                    bytesToDownload = (Get-AcfNumber $text 'BytesToDownload')
                }
            } catch { }
        }
    }
    return @($games.Values | Sort-Object name)
}

function Get-InstalledGames {
    return @(Get-GameManifests | Select-Object appid, name, installdir, size)
}

# Estado de atualizacao de cada jogo, como a Steam anota no manifesto (sem o caminho da pasta).
function Get-GameUpdates {
    return @(Get-GameManifests | Select-Object appid, name, stateFlags, buildId, targetBuildId, bytesToDownload)
}

# Encerra o jogo: pede para fechar as janelas dos processos que rodam da pasta do jogo e, se ainda
# estiverem de pe depois de alguns segundos, finaliza. Responde na hora (a finalizacao roda a parte).
function Stop-GameProcesses([string]$appid) {
    $game = Get-GameManifests | Where-Object { "$($_.appid)" -eq $appid } | Select-Object -First 1
    if (-not $game -or -not $game.path) { return 'unknown-game' }
    $root = $game.path.TrimEnd('\') + '\'
    $targets = New-Object System.Collections.ArrayList
    foreach ($p in (Get-Process -ErrorAction SilentlyContinue)) {
        $exe = $null
        try { $exe = $p.Path } catch { }
        if ($exe -and $exe.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { [void]$targets.Add($p) }
    }
    if ($targets.Count -eq 0) { return 'no-process' }
    $ids = New-Object System.Collections.ArrayList
    foreach ($p in $targets) {
        [void]$ids.Add([int]$p.Id)
        try { [void]$p.CloseMainWindow() } catch { }
    }
    $list = ($ids.ToArray() -join ',')
    $kill = "Start-Sleep -Seconds 4; foreach (`$id in @($list)) { Stop-Process -Id `$id -Force -ErrorAction SilentlyContinue }"
    $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($kill))
    Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', $encoded)
    return 'ok'
}

function Send-Json($response, [int]$code, $body) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Compress -Depth 5))
    $response.StatusCode = $code
    $response.ContentType = 'application/json; charset=utf-8'
    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Handle-Request($context) {
    $request = $context.Request
    $response = $context.Response
    $origin = $request.Headers['Origin']
    $hostHeader = $request.Headers['Host']

    # Defesa contra outros sites e contra DNS rebinding.
    if (@("127.0.0.1:$Port", "localhost:$Port") -notcontains $hostHeader) {
        Send-Json $response 403 @{ error = 'host' }
        return
    }
    if ($origin -and ($origin -notmatch $AllowedOrigin)) {
        Send-Json $response 403 @{ error = 'origin' }
        return
    }
    if ($origin) {
        $response.Headers.Add('Access-Control-Allow-Origin', $origin)
        $response.Headers.Add('Vary', 'Origin')
        $response.Headers.Add('Access-Control-Allow-Private-Network', 'true')
        $response.Headers.Add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        $response.Headers.Add('Access-Control-Allow-Headers', 'Content-Type')
        $response.Headers.Add('Access-Control-Max-Age', '600')
    }

    $method = $request.HttpMethod
    $path = $request.Url.AbsolutePath

    if ($method -eq 'OPTIONS') {
        $response.StatusCode = 204
        return
    }

    if ($method -eq 'GET' -and $path -eq '/status') {
        $steamState = Get-SteamState
        $game = 0
        if ($steamState -eq 'running') { $game = Get-RunningAppId }
        Send-Json $response 200 @{ app = 'liquisteam-helper'; version = 5; steam = $steamState; game = $game }
        return
    }

    # Lista de jogos instalados: so para o seu site (precisa de Origin).
    if ($method -eq 'GET' -and $origin -and $path -eq '/library') {
        Send-Json $response 200 @{ games = @(Get-InstalledGames) }
        return
    }

    # Estado das atualizacoes (lido dos manifestos): so para o seu site.
    if ($method -eq 'GET' -and $origin -and $path -eq '/updates') {
        Send-Json $response 200 @{ games = @(Get-GameUpdates) }
        return
    }

    # Encerra o jogo em execucao.
    if ($method -eq 'POST' -and $origin -and $path -eq '/stop-game') {
        $appid = $request.QueryString['appid']
        if ($appid -notmatch '^\d{1,10}$') {
            Send-Json $response 400 @{ error = 'appid' }
            return
        }
        $result = Stop-GameProcesses $appid
        if ($result -eq 'ok') {
            Send-Json $response 202 @{ ok = $true }
        } else {
            Send-Json $response 404 @{ error = $result }
        }
        return
    }

    # Acoes so com Origin do seu site: um link ou formulario de outro lugar nao consegue aciona-las.
    if ($method -eq 'POST' -and $origin -and ($path -eq '/open' -or $path -eq '/exit')) {
        $exe = Get-SteamExe
        if ($path -eq '/open') {
            # -silent: abre a Steam direto na bandeja, sem janela da loja nem avisos na tela.
            if ($exe) { Start-Process -FilePath $exe -ArgumentList '-silent' } else { Start-Process 'steam://open/main' }
            Start-Stealth
        } else {
            if ($exe) { Start-Process -FilePath $exe -ArgumentList '-shutdown' } else { Start-Process 'steam://exit' }
        }
        Send-Json $response 202 @{ ok = $true }
        return
    }

    # Desinstalacao pelo site: remove o atalho de inicializacao, agenda a exclusao da pasta e encerra.
    if ($method -eq 'POST' -and $origin -and $path -eq '/uninstall') {
        $link = Join-Path ([Environment]::GetFolderPath('Startup')) 'LiquiSteam Helper.lnk'
        Remove-Item -LiteralPath $link -Force -ErrorAction SilentlyContinue
        $dir = $PSScriptRoot
        $cleanup = "Start-Sleep -Seconds 3; Remove-Item -LiteralPath '$dir' -Recurse -Force -ErrorAction SilentlyContinue"
        Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $cleanup)
        $script:quit = $true
        Send-Json $response 202 @{ ok = $true }
        return
    }

    Send-Json $response 404 @{ error = 'not-found' }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
try {
    $listener.Start()
} catch {
    # Ja existe outra copia do helper rodando (ou a porta esta ocupada).
    exit 0
}

$script:quit = $false
while ($listener.IsListening -and -not $script:quit) {
    $context = $listener.GetContext()
    try {
        Handle-Request $context
    } catch {
        # Um pedido com problema nao derruba o servico.
    } finally {
        $context.Response.Close()
    }
}

$listener.Stop()
exit 0
