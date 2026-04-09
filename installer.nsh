; ═══════════════════════════════════════════════════════
;  DOOM Optimizer — NSIS Installer Customization
; ═══════════════════════════════════════════════════════

!macro customHeader
  !system "echo Installing DOOM Optimizer..."
!macroend

!macro customInit
  ; Check Windows 10/11
  ${If} ${AtLeastWin10}
    ; Good
  ${Else}
    MessageBox MB_OK|MB_ICONEXCLAMATION "DOOM Optimizer requires Windows 10 or later."
    Abort
  ${EndIf}
!macroend

!macro customInstall
  ; Add Windows Firewall exception
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="DOOM Optimizer" dir=in action=allow program="$INSTDIR\DOOM Optimizer.exe" enable=yes'
  
  ; Show post-install info
  MessageBox MB_OK|MB_ICONINFORMATION \
    "DOOM Optimizer installed successfully!$\r$\n$\r$\n\
⚠ IMPORTANT:$\r$\n\
• Run as Administrator for all optimizations to work.$\r$\n\
• Create a Restore Point BEFORE applying tweaks.$\r$\n\
• HAGS and BCD tweaks require a reboot to take effect.$\r$\n\
• All tweaks are reversible — use Revert buttons or System Restore.$\r$\n$\r$\n\
Happy fragging! ☠"
!macroend

!macro customUnInstall
  ; Remove firewall rule
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="DOOM Optimizer"'
!macroend
