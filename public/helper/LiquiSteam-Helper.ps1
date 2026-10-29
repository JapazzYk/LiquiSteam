# LiquiSteam Helper (Windows)
# Pequeno servico local que deixa o site LiquiSteam saber se a Steam esta aberta,
# qual jogo esta rodando e quais tem atualizacao pendente, e abrir/encerrar o cliente e os jogos.
# Tambem guarda a lista de jogos de fora da Steam (executaveis comuns) que voce adiciona pelo site. Escuta so em 127.0.0.1 e so aceita pedidos vindos do
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
    return (Stop-ProcessesUnder ($game.path.TrimEnd('\') + '\'))
}

# Processos que rodam de dentro de uma pasta.
function Find-ProcessesUnder([string]$root) {
    $found = New-Object System.Collections.ArrayList
    foreach ($p in (Get-Process -ErrorAction SilentlyContinue)) {
        $exe = $null
        try { $exe = $p.Path } catch { }
        if ($exe -and $exe.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { [void]$found.Add($p) }
    }
    return $found
}

# Pede para fechar as janelas dos processos e, se ainda estiverem de pe depois de alguns segundos,
# finaliza. Responde na hora (a finalizacao roda a parte).
function Stop-ProcessList($targets) {
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

function Stop-ProcessesUnder([string]$root) {
    return (Stop-ProcessList (Find-ProcessesUnder $root))
}

# ---------------------------------------------------------------------------------------------
# Jogos de fora da Steam (executaveis comuns)
# A lista fica so neste computador, em %LOCALAPPDATA%\LiquiSteam. O site nunca envia um caminho:
# o caminho vem de uma janela de escolha de arquivo do proprio Windows e fica guardado aqui; o
# site so pede para abrir um jogo da lista pelo identificador dele.
# ---------------------------------------------------------------------------------------------
$script:dataDir = Join-Path $env:LOCALAPPDATA 'LiquiSteam'
$script:gamesFile = Join-Path $script:dataDir 'custom-games.json'
$script:coversDir = Join-Path $script:dataDir 'covers'
$script:picks = @{}

function Get-CustomGames {
    if (-not (Test-Path -LiteralPath $script:gamesFile)) { return @() }
    try {
        $raw = [System.IO.File]::ReadAllText($script:gamesFile, [System.Text.Encoding]::UTF8)
        if (-not $raw.Trim()) { return @() }
        return @($raw | ConvertFrom-Json)
    } catch { return @() }
}

function Save-CustomGames($games) {
    New-Item -ItemType Directory -Force $script:dataDir | Out-Null
    $json = ConvertTo-Json -InputObject @($games) -Depth 4
    [System.IO.File]::WriteAllText($script:gamesFile, $json, (New-Object System.Text.UTF8Encoding($false)))
}

# Abre uma janela de escolha de arquivo em outro processo (nao trava o servico) e grava a escolha
# num arquivo temporario. Devolve um identificador para consultar o resultado.
function Start-Pick([string]$kind) {
    $id = [guid]::NewGuid().ToString('N')
    $out = Join-Path ([System.IO.Path]::GetTempPath()) ("liquisteam-pick-$id.txt")
    if ($kind -eq 'exe') {
        $title = 'Escolha o executavel do jogo'
        $filter = 'Programas (*.exe)|*.exe'
    } else {
        $title = 'Escolha a imagem da capa'
        $filter = 'Imagens (*.png;*.jpg;*.jpeg;*.bmp)|*.png;*.jpg;*.jpeg;*.bmp'
    }
    $template = @'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -Namespace LiquiSteam -Name Front -MemberDefinition '[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool SetForegroundWindow(System.IntPtr h); [System.Runtime.InteropServices.DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, System.UIntPtr extra); [System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode)] public static extern System.IntPtr FindWindow(string cls, string title); [System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool SetWindowPos(System.IntPtr h, System.IntPtr after, int x, int y, int cx, int cy, uint flags);'
$script:pickTitle = '__TITLE__'
$script:pickTries = 0
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.Opacity = 0
$owner.Width = 1
$owner.Height = 1
$owner.StartPosition = 'CenterScreen'
$owner.Show()
# O Windows nao deixa um programa em segundo plano passar na frente do navegador. Apertar e soltar a tecla
# Alt solta esse bloqueio, e so entao a janela e trazida para a frente.
[LiquiSteam.Front]::keybd_event(0x12, 0, 0, [System.UIntPtr]::Zero)
[void][LiquiSteam.Front]::SetForegroundWindow($owner.Handle)
[LiquiSteam.Front]::keybd_event(0x12, 0, 2, [System.UIntPtr]::Zero)
$owner.Activate()
# Garantia: assim que a janela de escolha existe, marca como "sempre por cima" e traz para a frente.
# O temporizador roda enquanto a janela esta aberta.
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 150
$timer.Add_Tick({
    $script:pickTries = $script:pickTries + 1
    $h = [LiquiSteam.Front]::FindWindow($null, $script:pickTitle)
    if ($h -ne [System.IntPtr]::Zero) {
        [void][LiquiSteam.Front]::SetWindowPos($h, [System.IntPtr]::new(-1), 0, 0, 0, 0, 0x43)
        [void][LiquiSteam.Front]::SetForegroundWindow($h)
        if ($script:pickTries -gt 6) { $timer.Stop() }
    }
    if ($script:pickTries -gt 80) { $timer.Stop() }
})
$timer.Start()
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = '__TITLE__'
$dialog.Filter = '__FILTER__'
$result = ''
if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { $result = $dialog.FileName }
$timer.Stop()
$owner.Close()
[System.IO.File]::WriteAllText('__OUT__', $result, (New-Object System.Text.UTF8Encoding($false)))
'@
    $code = $template.Replace('__TITLE__', $title).Replace('__FILTER__', $filter).Replace('__OUT__', $out.Replace("'", "''"))
    $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($code))
    Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList @('-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', $encoded)
    $script:picks[$id] = @{ kind = $kind; out = $out; path = $null; done = $false; cover = $null }
    return $id
}

# Reduz a imagem escolhida (no maximo 900 px no lado maior) e devolve JPEG em base64.
function ConvertTo-CoverData([string]$path) {
    Add-Type -AssemblyName System.Drawing
    $image = [System.Drawing.Image]::FromFile($path)
    try {
        $scale = [Math]::Min(1.0, 900.0 / [Math]::Max($image.Width, $image.Height))
        $w = [Math]::Max(1, [int]($image.Width * $scale))
        $h = [Math]::Max(1, [int]($image.Height * $scale))
        $bitmap = New-Object System.Drawing.Bitmap($w, $h)
        try {
            $g = [System.Drawing.Graphics]::FromImage($bitmap)
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.DrawImage($image, 0, 0, $w, $h)
            $g.Dispose()
            $stream = New-Object System.IO.MemoryStream
            $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
            $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
            $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]86)
            $bitmap.Save($stream, $codec, $params)
            return [Convert]::ToBase64String($stream.ToArray())
        } finally { $bitmap.Dispose() }
    } finally { $image.Dispose() }
}

# Consulta uma escolha de arquivo. status: pending, cancelled ou ok.
function Get-PickResult([string]$id) {
    if (-not $script:picks.ContainsKey($id)) { return @{ status = 'unknown' } }
    $pick = $script:picks[$id]
    if ($pick.done) { return @{ status = 'ok'; id = $id } }
    if (-not (Test-Path -LiteralPath $pick.out)) { return @{ status = 'pending' } }
    $chosen = ''
    try { $chosen = [System.IO.File]::ReadAllText($pick.out, [System.Text.Encoding]::UTF8).Trim() } catch { return @{ status = 'pending' } }
    Remove-Item -LiteralPath $pick.out -Force -ErrorAction SilentlyContinue
    if (-not $chosen -or -not (Test-Path -LiteralPath $chosen)) {
        $script:picks.Remove($id)
        return @{ status = 'cancelled' }
    }
    if ($pick.kind -eq 'exe') {
        if (-not $chosen.EndsWith('.exe', [System.StringComparison]::OrdinalIgnoreCase)) {
            $script:picks.Remove($id)
            return @{ status = 'cancelled' }
        }
        $name = ''
        try { $name = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($chosen).ProductName } catch { }
        if (-not $name -or -not $name.Trim()) { $name = [System.IO.Path]::GetFileNameWithoutExtension($chosen) }
        $pick.path = $chosen
        $pick.done = $true
        return @{ status = 'ok'; id = $id; name = $name.Trim() }
    }
    try {
        $pick.cover = ConvertTo-CoverData $chosen
    } catch {
        $script:picks.Remove($id)
        return @{ status = 'cancelled' }
    }
    $pick.done = $true
    return @{ status = 'ok'; id = $id; cover = ('data:image/jpeg;base64,' + $pick.cover) }
}

function Get-CoverDataUrl([string]$gameId) {
    $file = Join-Path $script:coversDir ("$gameId.jpg")
    if (-not (Test-Path -LiteralPath $file)) { return $null }
    try { return 'data:image/jpeg;base64,' + [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($file)) } catch { return $null }
}

# Lista para o site (sem o caminho do executavel).
function Get-CustomGamesForSite {
    $list = @()
    foreach ($g in (Get-CustomGames)) {
        $list += [pscustomobject]@{
            id    = $g.id
            name  = $g.name
            added = [int64]$g.added
            cover = (Get-CoverDataUrl $g.id)
        }
    }
    return $list
}

# Cria ou atualiza um jogo. exePick/coverPick sao identificadores de escolhas feitas nas janelas acima.
function Save-CustomGame($body) {
    $name = ('' + $body.name).Trim()
    if (-not $name -or $name.Length -gt 120) { return $null }
    $games = @(Get-CustomGames)
    $existing = $null
    if ($body.id) { $existing = $games | Where-Object { $_.id -eq $body.id } | Select-Object -First 1 }
    $exe = $null
    if ($body.exePick -and $script:picks.ContainsKey($body.exePick) -and $script:picks[$body.exePick].kind -eq 'exe' -and $script:picks[$body.exePick].done) {
        $exe = $script:picks[$body.exePick].path
    }
    if (-not $existing -and -not $exe) { return $null }
    if ($existing) {
        $id = $existing.id
        $existing.name = $name
        if ($exe) { $existing.exe = $exe }
    } else {
        $id = [guid]::NewGuid().ToString('N')
        $games += [pscustomobject]@{ id = $id; name = $name; exe = $exe; added = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }
    }
    if ($body.coverPick -and $script:picks.ContainsKey($body.coverPick) -and $script:picks[$body.coverPick].kind -eq 'image' -and $script:picks[$body.coverPick].done) {
        New-Item -ItemType Directory -Force $script:coversDir | Out-Null
        [System.IO.File]::WriteAllBytes((Join-Path $script:coversDir "$id.jpg"), [Convert]::FromBase64String($script:picks[$body.coverPick].cover))
    }
    Save-CustomGames $games
    foreach ($key in @($body.exePick, $body.coverPick)) { if ($key -and $script:picks.ContainsKey($key)) { $script:picks.Remove($key) } }
    return $id
}

function Remove-CustomGame([string]$id) {
    $games = @(Get-CustomGames)
    $kept = @($games | Where-Object { $_.id -ne $id })
    if ($kept.Count -eq $games.Count) { return $false }
    Save-CustomGames $kept
    Remove-Item -LiteralPath (Join-Path $script:coversDir "$id.jpg") -Force -ErrorAction SilentlyContinue
    return $true
}

function Find-CustomGame([string]$id) {
    return (Get-CustomGames | Where-Object { $_.id -eq $id } | Select-Object -First 1)
}

# Abre o jogo na pasta dele.
function Start-CustomGame([string]$id) {
    $game = Find-CustomGame $id
    if (-not $game) { return 'unknown-game' }
    if (-not (Test-Path -LiteralPath $game.exe)) { return 'missing-file' }
    Start-Process -FilePath $game.exe -WorkingDirectory (Split-Path -Parent $game.exe)
    return 'ok'
}

# Ids dos jogos de fora da Steam que estao rodando (pelo nome do processo).
function Get-RunningCustomIds {
    $ids = @()
    foreach ($g in (Get-CustomGames)) {
        $name = [System.IO.Path]::GetFileNameWithoutExtension($g.exe)
        if (-not $name) { continue }
        $procs = [System.Diagnostics.Process]::GetProcessesByName($name)
        if ($procs.Count -gt 0) { $ids += [string]$g.id }
        foreach ($p in $procs) { $p.Dispose() }
    }
    return $ids
}

# Encerra o jogo: o processo do executavel e, se a pasta dele for propria do jogo, os que rodam de dentro dela.
# Pastas comuns (Desktop, Downloads, raiz do disco...) nao entram, para nao fechar outros programas.
function Stop-CustomGame([string]$id) {
    $game = Find-CustomGame $id
    if (-not $game) { return 'unknown-game' }
    $targets = New-Object System.Collections.ArrayList
    foreach ($p in (Get-Process -ErrorAction SilentlyContinue)) {
        $exe = $null
        try { $exe = $p.Path } catch { }
        if ($exe -and ($exe -ieq $game.exe)) { [void]$targets.Add($p) }
    }
    $folder = (Split-Path -Parent $game.exe).TrimEnd('\')
    $leaf = Split-Path -Leaf $folder
    $shared = @('Desktop', 'Downloads', 'Documents', 'Program Files', 'Program Files (x86)', 'Users', 'Windows')
    if ($folder -notmatch '^[A-Za-z]:$' -and ($shared -notcontains $leaf)) {
        foreach ($p in (Find-ProcessesUnder ($folder + '\'))) {
            $already = $false
            foreach ($t in $targets) { if ($t.Id -eq $p.Id) { $already = $true } }
            if (-not $already) { [void]$targets.Add($p) }
        }
    }
    return (Stop-ProcessList $targets)
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
        $custom = @(Get-RunningCustomIds)
        Send-Json $response 200 @{ app = 'liquisteam-helper'; version = 6; steam = $steamState; game = $game; custom = $custom }
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

    # Jogos de fora da Steam: lista e escolhas de arquivo (so para o seu site).
    if ($method -eq 'GET' -and $origin -and $path -eq '/custom-games') {
        Send-Json $response 200 @{ games = @(Get-CustomGamesForSite) }
        return
    }

    if ($method -eq 'POST' -and $origin -and $path -eq '/pick') {
        $kind = $request.QueryString['kind']
        if ($kind -ne 'exe' -and $kind -ne 'image') {
            Send-Json $response 400 @{ error = 'kind' }
            return
        }
        Send-Json $response 202 @{ id = (Start-Pick $kind) }
        return
    }

    if ($method -eq 'GET' -and $origin -and $path -eq '/pick-result') {
        $pickId = $request.QueryString['id']
        if ($pickId -notmatch '^[0-9a-f]{32}$') {
            Send-Json $response 400 @{ error = 'id' }
            return
        }
        Send-Json $response 200 (Get-PickResult $pickId)
        return
    }

    # Cria ou atualiza um jogo: {name, exePick, coverPick, id?}. O caminho vem da escolha, nunca do site.
    if ($method -eq 'POST' -and $origin -and $path -eq '/custom-games') {
        if ($request.ContentLength64 -gt 4096) {
            Send-Json $response 413 @{ error = 'too-large' }
            return
        }
        $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
        $body = $null
        try { $body = $reader.ReadToEnd() | ConvertFrom-Json } catch { }
        if (-not $body) {
            Send-Json $response 400 @{ error = 'body' }
            return
        }
        $savedId = Save-CustomGame $body
        if ($savedId) {
            Send-Json $response 200 @{ ok = $true; id = $savedId }
        } else {
            Send-Json $response 400 @{ error = 'invalid' }
        }
        return
    }

    if ($method -eq 'POST' -and $origin -and ($path -eq '/custom-games/remove' -or $path -eq '/launch-custom' -or $path -eq '/stop-custom')) {
        $gameId = $request.QueryString['id']
        if ($gameId -notmatch '^[0-9a-f]{32}$') {
            Send-Json $response 400 @{ error = 'id' }
            return
        }
        if ($path -eq '/custom-games/remove') {
            if (Remove-CustomGame $gameId) { Send-Json $response 200 @{ ok = $true } } else { Send-Json $response 404 @{ error = 'unknown-game' } }
            return
        }
        if ($path -eq '/launch-custom') { $outcome = Start-CustomGame $gameId } else { $outcome = Stop-CustomGame $gameId }
        if ($outcome -eq 'ok') {
            Send-Json $response 202 @{ ok = $true }
        } else {
            Send-Json $response 404 @{ error = $outcome }
        }
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
