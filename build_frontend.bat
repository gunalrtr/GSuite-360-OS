@echo off
set PATH=C:\Program Files\nodejs;%PATH%
call npm run build --workspace=apps/frontend
