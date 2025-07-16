@echo off
REM dbt runner batch file for Windows
REM Usage: run_dbt.bat [dbt_command] [options]
REM Example: run_dbt.bat debug
REM Example: run_dbt.bat run

REM Load .env file if it exists
if exist .env (
    for /f "tokens=1,2 delims==" %%a in (.env) do (
        set %%a=%%b
    )
    echo Loaded environment variables from .env
) else (
    echo Warning: .env file not found
)

REM Run dbt with all arguments
dbt %* 