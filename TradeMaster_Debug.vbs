Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Ścieżka do projektu
projectPath = "c:\Users\Gigabyte\Documents\TradeMaster\trade-master"
url = "http://localhost:3000"

MsgBox "Debug: Sprawdzam katalog: " & projectPath

' Sprawdź czy projekt istnieje
If Not objFSO.FolderExists(projectPath) Then
    MsgBox "Błąd: Nie można znaleźć katalogu projektu!" & vbCrLf & projectPath, vbCritical, "TradeMaster - Błąd"
    WScript.Quit
Else
    MsgBox "OK: Katalog projektu istnieje!"
End If

' Sprawdź czy port 3000 jest już używany
MsgBox "Sprawdzam czy port 3000 jest używany..."

On Error Resume Next
Set objExec = objShell.Exec("netstat -an")
If Err.Number <> 0 Then
    MsgBox "Błąd podczas sprawdzania portów: " & Err.Description
    Err.Clear
End If

output = ""
If Not objExec Is Nothing Then
    output = objExec.StdOut.ReadAll()
End If

If InStr(output, ":3000") > 0 And InStr(output, "LISTENING") > 0 Then
    MsgBox "Port 3000 jest już używany - otwieranie przeglądarki..."
    objShell.Run "cmd /c start """" """ & url & """", 0, False
Else
    MsgBox "Port 3000 jest wolny - uruchamiam aplikację..."
    objShell.CurrentDirectory = projectPath
    objShell.Run "cmd /c npm start", 0, False
    
    MsgBox "Czekam 8 sekund na uruchomienie serwera..."
    WScript.Sleep 8000
    
    MsgBox "Otwieranie przeglądarki..."
    objShell.Run "cmd /c start """" """ & url & """", 0, False
End If

MsgBox "Skrypt zakończony!"
