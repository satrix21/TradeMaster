@echo off
title TradeMaster Launcher
color 0A
echo.
echo  ████████╗██████╗  █████╗ ██████╗ ███████╗███╗   ███╗ █████╗ ███████╗████████╗███████╗██████╗ 
echo  ╚══██╔══╝██╔══██╗██╔══██╗██╔══██╗██╔════╝████╗ ████║██╔══██╗██╔════╝╚══██╔══╝██╔════╝██╔══██╗
echo     ██║   ██████╔╝███████║██║  ██║█████╗  ██╔████╔██║███████║███████╗   ██║   █████╗  ██████╔╝
echo     ██║   ██╔══██╗██╔══██║██║  ██║██╔══╝  ██║╚██╔╝██║██╔══██║╚════██║   ██║   ██╔══╝  ██╔══██╗
echo     ██║   ██║  ██║██║  ██║██████╔╝███████╗██║ ╚═╝ ██║██║  ██║███████║   ██║   ███████╗██║  ██║
echo     ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
echo.
echo                                   🚀 Trading Journal 🚀
echo.

REM Sprawdź czy port 3000 jest już używany
echo [INFO] Sprawdzam czy aplikacja już działa...
netstat -an 2>nul | find "3000" | find "LISTENING" >nul
if %errorlevel% == 0 (
    echo [✓] Aplikacja już działa! Otwieranie przeglądarki...
    start "" "http://localhost:3000"
    echo.
    echo [!] Jeśli aplikacja nie działa poprawnie, zamknij to okno i uruchom ponownie.
    timeout /t 3 /nobreak >nul
    exit
)

echo [INFO] Przechodzę do katalogu aplikacji...
cd /d "c:\Users\Gigabyte\Documents\TradeMaster\trade-master"

if not exist "package.json" (
    echo [✗] BŁĄD: Nie można znaleźć pliku package.json!
    echo [!] Sprawdź czy ścieżka jest poprawna.
    echo [!] Aktualna lokalizacja: %CD%
    pause
    exit
)

echo [✓] Znaleziono projekt!
echo [INFO] Uruchamianie aplikacji TradeMaster...
echo.
echo [⚠] UWAGA: Nie zamykaj tego okna dopóki korzystasz z aplikacji!
echo [⚠] Aplikacja otworzy się automatycznie w przeglądarce za chwilę.
echo.

REM Uruchom aplikację w tle
echo [INFO] Startowanie serwera...
start /b npm start

echo [INFO] Czekam na uruchomienie serwera (8 sekund)...
for /l %%i in (1,1,8) do (
    echo [%%i/8] Ładowanie...
    timeout /t 1 /nobreak >nul
)

echo [INFO] Otwieranie przeglądarki...
start "" "http://localhost:3000"

echo.
echo ========================================
echo [✓] TradeMaster uruchomiony pomyślnie!
echo [🌐] URL: http://localhost:3000
echo [📝] Dziennik tradingu jest gotowy do użycia
echo.
echo [⚠] Aby zatrzymać aplikację, zamknij to okno
echo ========================================
echo.
echo Naciśnij dowolny klawisz aby zminimalizować okno...
pause >nul

REM Minimalizuj okno ale nie zamykaj
powershell -command "(New-Object -comObject Shell.Application).MinimizeAll()"
