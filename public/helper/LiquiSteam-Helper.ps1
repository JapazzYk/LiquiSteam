# LiquiSteam Helper (Windows)
# Pequeno servico local que deixa o site LiquiSteam saber se a Steam esta aberta
# e abrir/encerrar o cliente. Escuta so em 127.0.0.1 e so aceita pedidos vindos do
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

# So le os manifestos (appmanifest_*.acf): nao abre nem altera nada nos jogos.
function Get-InstalledGames {
    $games = @{}
    foreach ($dir in (Get-SteamLibraryDirs)) {
        $files = @()
        try { $files = Get-ChildItem -LiteralPath $dir -Filter 'appmanifest_*.acf' -File -ErrorAction Stop } catch { }
        foreach ($file in $files) {
            try {
                $text = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
                $appid = Get-AcfValue $text 'appid'
                if (-not $appid -or $appid -notmatch '^\d+$') { continue }
                if ($games.ContainsKey($appid)) { continue }
                $size = 0
                $rawSize = Get-AcfValue $text 'SizeOnDisk'
                if ($rawSize -match '^\d+$') { $size = [int64]$rawSize }
                $games[$appid] = [pscustomobject]@{
                    appid      = [int64]$appid
                    name       = (Get-AcfValue $text 'name')
                    installdir = (Get-AcfValue $text 'installdir')
                    size       = $size
                }
            } catch { }
        }
    }
    return @($games.Values | Sort-Object name)
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
        Send-Json $response 200 @{ app = 'liquisteam-helper'; version = 4; steam = (Get-SteamState) }
        return
    }

    # Lista de jogos instalados: so para o seu site (precisa de Origin).
    if ($method -eq 'GET' -and $origin -and $path -eq '/library') {
        Send-Json $response 200 @{ games = @(Get-InstalledGames) }
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
