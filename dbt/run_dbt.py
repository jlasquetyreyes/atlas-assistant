#!/usr/bin/env python3
"""
dbt runner script that loads environment variables from .env file
Usage: python run_dbt.py [dbt_command] [options]
Example: python run_dbt.py debug
Example: python run_dbt.py run
"""

import os
import sys
import subprocess
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    print("Error: python-dotenv not installed. Please run: pip install python-dotenv")
    sys.exit(1)

def main():
    # Get the directory where this script is located
    script_dir = Path(__file__).parent
    
    # Load .env file from the same directory
    env_file = script_dir / '.env'
    if env_file.exists():
        load_dotenv(env_file)
        print(f"Loaded environment variables from {env_file}")
    else:
        print(f"Warning: .env file not found at {env_file}")
    
    # Get dbt command and arguments
    dbt_args = sys.argv[1:] if len(sys.argv) > 1 else ['--help']
    
    # Run dbt command
    try:
        result = subprocess.run(['dbt'] + dbt_args, cwd=script_dir)
        sys.exit(result.returncode)
    except FileNotFoundError:
        print("Error: dbt command not found. Please install dbt-core and dbt-postgres")
        sys.exit(1)

if __name__ == "__main__":
    main() 