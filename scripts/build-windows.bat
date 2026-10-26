@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0.."
echo ==============================================
echo 한수 Windows 설치 파일 만들기
echo ==============================================
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js가 필요합니다. https://nodejs.org 에서 LTS 버전을 설치하세요.
  pause
  exit /b 1
)
echo 필요한 패키지를 설치합니다. 최초 1회 인터넷 연결이 필요합니다.
call npm install
if errorlevel 1 goto :error
call npm run dist:win
if errorlevel 1 goto :error
echo.
echo 완료: release 폴더 안의 한수 설치 파일을 확인하세요.
pause
exit /b 0
:error
echo 빌드에 실패했습니다. 위 오류 내용을 확인하세요.
pause
exit /b 1