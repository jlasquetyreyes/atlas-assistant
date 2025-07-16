#!/usr/bin/env python3
"""
Script to trigger vector update endpoint and monitor its progress.
"""

import requests
import json
import time
import sys

# Configuration
BASE_URL = "https://atlas-node-232731001131.europe-west3.run.app"

def check_server_status():
    """Check if the server is running."""
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            print("✅ Server is running")
            return True
        else:
            print(f"❌ Server returned status code: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot connect to server: {e}")
        return False

def start_vector_update():
    """Start the vector update process."""
    try:
        print("🚀 Starting vector update process...")
        response = requests.post(
            f"{BASE_URL}/vector-update",
            headers={"Content-Type": "application/json"},
            json={}
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Vector update started: {data.get('message', 'Unknown')}")
            print(f"Status: {data.get('status', 'Unknown')}")
            return True
        else:
            print(f"❌ Failed to start vector update. Status code: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Error starting vector update: {e}")
        return False

def check_vector_update_status():
    """Check the current status of vector update process."""
    try:
        response = requests.get(f"{BASE_URL}/vector-update/status")
        
        if response.status_code == 200:
            data = response.json()
            is_running = data.get('isRunning', False)
            progress = data.get('progress', {})
            
            print(f"🔄 Vector update running: {is_running}")
            print(f"Status: {progress.get('status', 'Unknown')}")
            print(f"Progress: {progress.get('processed', 0)}/{progress.get('total', 0)}")
            print(f"Errors: {progress.get('errors', 0)}")
            
            return data
        else:
            print(f"❌ Failed to get status. Status code: {response.status_code}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Error checking status: {e}")
        return None

def monitor_progress(max_wait_time=3600):  # 1 hour max
    """Monitor the vector update progress until completion."""
    print("📊 Monitoring vector update progress...")
    start_time = time.time()
    
    while True:
        status_data = check_vector_update_status()
        
        if status_data is None:
            print("❌ Could not get status data")
            break
            
        is_running = status_data.get('isRunning', False)
        progress = status_data.get('progress', {})
        status = progress.get('status', 'Unknown')
        
        # Check if completed or failed
        if not is_running:
            if status == 'completed':
                print("✅ Vector update completed successfully!")
                print(f"Final stats: {progress.get('processed', 0)} processed, {progress.get('errors', 0)} errors")
            elif status == 'error':
                print("❌ Vector update failed!")
            else:
                print(f"ℹ️ Vector update status: {status}")
            break
            
        # Check timeout
        if time.time() - start_time > max_wait_time:
            print(f"⏰ Timeout reached ({max_wait_time} seconds). Stopping monitoring.")
            break
            
        # Wait before next check
        time.sleep(10)  # Check every 10 seconds

def main():
    """Main function to run the vector update trigger."""
    print("=" * 50)
    print("🔧 Vector Update Trigger Script")
    print("=" * 50)
    
    # Check server status first
    if not check_server_status():
        print("❌ Cannot proceed - server is not available")
        sys.exit(1)
    
    # Check current status
    print("\n📋 Current vector update status:")
    current_status = check_vector_update_status()
    
    if current_status and current_status.get('isRunning', False):
        print("\n⚠️ Vector update is already running!")
        response = input("Do you want to monitor the current progress? (y/n): ")
        if response.lower() == 'y':
            monitor_progress()
        return
    
    # Start vector update
    print("\n🚀 Starting new vector update...")
    if start_vector_update():
        print("\n📊 Starting progress monitoring...")
        monitor_progress()
    else:
        print("❌ Failed to start vector update")

if __name__ == "__main__":
    main() 