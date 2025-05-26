# TradeMaster Launcher - PowerShell Script
# Uruchamia aplikację handlową jednym kliknięciem

Write-Host "🚀 TradeMaster Launcher" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host ""

$projectPath = "c:\Users\Gigabyte\Documents\TradeMaster\trade-master"
$url = "http://localhost:3000"

# Sprawdź czy projekt istnieje
if (-Not (Test-Path $projectPath)) {
    Write-Host "❌ BŁĄD: Nie można znaleźć katalogu projektu!" -ForegroundColor Red
    Write-Host "📁 Ścieżka: $projectPath" -ForegroundColor Yellow
    Read-Host "Naciśnij Enter aby zakończyć"
    exit
}

# Sprawdź czy port 3000 jest już używany
Write-Host "🔍 Sprawdzam czy aplikacja już działa..." -ForegroundColor Yellow

try {
    $portCheck = netstat -an | Select-String "3000" | Select-String "LISTENING"
    if ($portCheck) {
        Write-Host "✅ Aplikacja już działa! Otwieranie przeglądarki..." -ForegroundColor Green
        Start-Process $url
        Write-Host "🌐 URL: $url" -ForegroundColor Cyan
        Read-Host "Naciśnij Enter aby zakończyć"
        exit
    }
} catch {
    Write-Host "⚠️ Nie można sprawdzić portów, kontynuuję..." -ForegroundColor Yellow
}

Write-Host "📂 Przechodzę do katalogu projektu..." -ForegroundColor Yellow
Set-Location $projectPath

if (-Not (Test-Path "package.json")) {
    Write-Host "❌ BŁĄD: Nie można znaleźć pliku package.json!" -ForegroundColor Red
    Write-Host "📍 Aktualna lokalizacja: $(Get-Location)" -ForegroundColor Yellow
    Read-Host "Naciśnij Enter aby zakończyć"
    exit
}

Write-Host "✅ Znaleziono projekt!" -ForegroundColor Green
Write-Host "🚀 Uruchamianie TradeMaster..." -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  UWAGA: Nie zamykaj tego okna dopóki korzystasz z aplikacji!" -ForegroundColor Red
Write-Host "🌐 Aplikacja otworzy się automatycznie w przeglądarce za chwilę." -ForegroundColor Yellow
Write-Host ""

# Uruchom aplikację w tle
Write-Host "⚡ Startowanie serwera..." -ForegroundColor Cyan
Start-Process -FilePath "npm" -ArgumentList "start" -WindowStyle Hidden

# Animowany licznik oczekiwania
Write-Host "⏳ Czekam na uruchomienie serwera:" -ForegroundColor Yellow -NoNewline
for ($i = 1; $i -le 8; $i++) {
    Write-Host " [$i/8]" -ForegroundColor Green -NoNewline
    Start-Sleep 1
}
Write-Host ""

Write-Host "🌐 Otwieranie przeglądarki..." -ForegroundColor Cyan
Start-Process $url

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ TradeMaster uruchomiony pomyślnie!" -ForegroundColor Green
Write-Host "🌐 URL: $url" -ForegroundColor Cyan
Write-Host "📊 Dziennik tradingu jest gotowy do użycia" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  Aby zatrzymać aplikację, zamknij to okno" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Read-Host "Naciśnij Enter aby zminimalizować okno"

# Minimalizuj okno ale zostaw działające
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); }'
$hwnd = (Get-Process -Id $PID).MainWindowHandle
[Win32]::ShowWindow($hwnd, 2) # 2 = SW_SHOWMINIMIZED
