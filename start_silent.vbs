Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

strPath = fso.GetParentFolderName(WScript.ScriptFullName)

' 1. 清理可能残留的 8099 端口占用
WshShell.Run "cmd /c for /f ""tokens=5"" %a in ('netstat -ano ^| findstr "":8099 "" ^| findstr ""LISTENING""') do taskkill /F /PID %a", 0, True

' 等待 1 秒释放
WScript.Sleep 1000

' 2. 静默后台启动 Python 程序（0 表示完全隐藏黑窗口）
WshShell.CurrentDirectory = strPath
WshShell.Run """" & strPath & "\.venv\Scripts\python.exe"" main.py", 0, False

' 3. 等待 2 秒打开浏览器前端看板
WScript.Sleep 2000
WshShell.Run "http://127.0.0.1:8099"
