import subprocess
import time
import sys
from pathlib import Path

def main():
    print("==========================================================")
    print("   Starting Unified Portal Control Agent Subsystem...    ")
    print("==========================================================")
    
    backend_dir = Path(__file__).resolve().parent
    
    # 1. Start the Mock Portal API in a background process
    print("[1/2] Launching Mock Corporate Portal on http://127.0.0.1:8081...")
    # On Windows, we run the python executable from the venv if it exists
    python_exe = str(backend_dir / "venv" / "Scripts" / "python.exe")
    if not Path(python_exe).exists():
        python_exe = sys.executable
        
    mock_process = subprocess.Popen(
        [python_exe, "mock_portal/main.py"],
        cwd=str(backend_dir),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    
    # Wait a moment for mock portal to bind port
    time.sleep(2.0)
    
    # 2. Start the main FastAPI application server
    print("[2/2] Launching Main Agent WebSocket Server on http://127.0.0.1:8000...")
    main_process = subprocess.Popen(
        [python_exe, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=str(backend_dir)
    )
    
    try:
        # Wait for the main web server process to conclude
        main_process.wait()
    except KeyboardInterrupt:
        print("\n[!] Keyboard interrupt received. Shutting down servers gracefully...")
        main_process.terminate()
        mock_process.terminate()
        print("[*] All processes terminated. Goodbye!")

if __name__ == "__main__":
    main()
