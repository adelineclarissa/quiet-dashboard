Option Explicit
Dim shell, files, folder, command
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
folder = files.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = folder
command = "node.exe """ & files.BuildPath(folder, "dashboard-server.mjs") & """"
On Error Resume Next
shell.Run command, 0, False
If Err.Number <> 0 Then
  MsgBox "Quiet could not start. Install Node.js 24 or newer and ensure node.exe is on PATH, then try again.", 48, "Quiet Dashboard"
End If
