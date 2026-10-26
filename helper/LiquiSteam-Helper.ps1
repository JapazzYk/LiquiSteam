# LiquiSteam Helper (Windows)
# Pequeno serviço local que deixa o site LiquiSteam saber se a Steam está aberta
# e abrir/encerrar o cliente. Escuta só em 127.0.0.1 e só aceita pedidos vindos do
# seu site. Fica parado até alguém perguntar, então não consome processador.
#
# Se um dia você usar um domínio próprio, acrescente-o em $AllowedOrigin.

$Port = 47231
$AllowedOrigin = '^(https://(liquisteam|liquisteam-[a-z0-9]+(-[a-z0-9]+)*-ryos3)\.vercel\.app|http://(localhost|127\.0\.0\.1):5173)$'

function Get-SteamState {
    $procs = [System.Diagnostics.Process]::GetProcessesByName('steam')
    $found = $procs.Count -gt 0
    foreach ($p in $procs) { $p.Dispose() }
    if (-not $found) { return 'not-running' }
    # ActiveUser é 0 enquanto a Steam ainda inicia ou espera o login.
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
    return $null
}

function Send-Json($response, [int]$code, $body) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Compress))
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
        Send-Json $response 200 @{ app = 'liquisteam-helper'; version = 1; steam = (Get-SteamState) }
        return
    }

    # Ações só com Origin do seu site: um link ou formulário de outro lugar não consegue acioná-las.
    if ($method -eq 'POST' -and $origin -and ($path -eq '/open' -or $path -eq '/exit')) {
        $exe = Get-SteamExe
        if ($path -eq '/open') {
            if ($exe) { Start-Process -FilePath $exe } else { Start-Process 'steam://open/main' }
        } else {
            if ($exe) { Start-Process -FilePath $exe -ArgumentList '-shutdown' } else { Start-Process 'steam://exit' }
        }
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
    # Já existe outra cópia do helper rodando (ou a porta está ocupada).
    exit 0
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
        Handle-Request $context
    } catch {
        # Um pedido com problema não derruba o serviço.
    } finally {
        $context.Response.Close()
    }
}
