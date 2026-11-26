; Ashen Oath — Windows installer (per-user, no administrator rights needed). Built by pc/build.py.
Unicode true
SetCompressor /SOLID lzma
!include "MUI2.nsh"

!define APP "Ashen Oath"
!define VERSION "1.0"
!define UNINST "Software\Microsoft\Windows\CurrentVersion\Uninstall\AshenOath"

Name "${APP}"
OutFile "AshenOath-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\Ashen Oath"
InstallDirRegKey HKCU "Software\AshenOath" "InstallDir"
RequestExecutionLevel user
BrandingText "${APP} ${VERSION}"

!define MUI_ICON "ashen.ico"
!define MUI_UNICON "ashen.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Welcome to ${APP}"
!define MUI_WELCOMEPAGE_TEXT "This will install ${APP}, a grimdark turn-based strategy game, on your computer.$\r$\n$\r$\nThe game runs in its own window (press F11 for full screen). No internet connection is needed to play.$\r$\n$\r$\nClick Next to continue."
!define MUI_FINISHPAGE_RUN "$INSTDIR\AshenOath.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Play ${APP} now"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "$INSTDIR"
  RMDir /r "$INSTDIR\game"
  File /r "dist\AshenOath\*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\${APP}"
  CreateShortcut "$SMPROGRAMS\${APP}\${APP}.lnk" "$INSTDIR\AshenOath.exe" "" "$INSTDIR\ashen.ico"
  CreateShortcut "$SMPROGRAMS\${APP}\Uninstall ${APP}.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\${APP}.lnk" "$INSTDIR\AshenOath.exe" "" "$INSTDIR\ashen.ico"
  WriteRegStr HKCU "Software\AshenOath" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINST}" "DisplayName" "${APP}"
  WriteRegStr HKCU "${UNINST}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST}" "DisplayIcon" "$INSTDIR\ashen.ico"
  WriteRegStr HKCU "${UNINST}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "${UNINST}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\${APP}.lnk"
  RMDir /r "$SMPROGRAMS\${APP}"
  RMDir /r "$INSTDIR\game"
  Delete "$INSTDIR\AshenOath.exe"
  Delete "$INSTDIR\ashen.ico"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "${UNINST}"
  DeleteRegKey HKCU "Software\AshenOath"
  ; saved games and options stay in %LOCALAPPDATA%\AshenOath unless the player removes them
SectionEnd
