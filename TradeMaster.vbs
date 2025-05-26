Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Ścieżka do projektu
projectPath = "c:\Users\Gigabyte\Documents\TradeMaster\trade-master"
url = "http://localhost:3000"

' Sprawdź czy projekt istnieje
If Not objFSO.FolderExists(projectPath) Then
    MsgBox "Błąd: Nie można znaleźć katalogu projektu!" & vbCrLf & projectPath, vbCritical, "TradeMaster - Błąd"
    WScript.Quit
End If

' Sprawdź czy port 3000 jest już używany
Set objExec = objShell.Exec("netstat -an")
output = objExec.StdOut.ReadAll()
If InStr(output, ":3000") > 0 And InStr(output, "LISTENING") > 0 Then
    ' Aplikacja już działa - otwórz tylko przeglądarkę
    objShell.Run "cmd /c start """" """ & url & """", 0, False
    MsgBox "TradeMaster już działa!" & vbCrLf & "Otwieranie przeglądarki...", vbInformation, "TradeMaster"
Else
    ' Uruchom aplikację
    objShell.CurrentDirectory = projectPath
    objShell.Run "cmd /c npm start", 0, False
    
    ' Poczekaj chwilę i otwórz przeglądarkę
    WScript.Sleep 8000
    objShell.Run "cmd /c start """" """ & url & """", 0, False
    
    MsgBox "TradeMaster uruchomiony!" & vbCrLf & "URL: " & url & vbCrLf & vbCrLf & "Aby zatrzymać aplikację, użyj Task Manager", vbInformation, "TradeMaster"
End If
