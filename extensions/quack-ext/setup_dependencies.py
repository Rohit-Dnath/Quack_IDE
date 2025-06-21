#!/usr/bin/env python3
"""
Quack-Ext dependency installer and setup script.
This script ensures mitmproxy and pytesseract are available for the extension.
"""
import subprocess
import sys
import os

def run_command(command, check=True):
    """Run a shell command and return the result."""
    try:
        result = subprocess.run(command, shell=True, check=check, capture_output=True, text=True)
        return result.stdout, result.stderr, result.returncode
    except subprocess.CalledProcessError as e:
        return e.stdout, e.stderr, e.returncode

def check_python():
    """Check if Python is available."""
    stdout, stderr, returncode = run_command("python --version", check=False)
    if returncode != 0:
        print("Error: Python is not installed or not in PATH")
        return False
    print(f"Found: {stdout.strip()}")
    return True

def check_pip():
    """Check if pip is available."""
    stdout, stderr, returncode = run_command("pip --version", check=False)
    if returncode != 0:
        print("Error: pip is not installed or not in PATH")
        return False
    print(f"Found: {stdout.strip()}")
    return True

def install_package(package_name):
    """Install a Python package using pip."""
    print(f"Installing {package_name}...")
    stdout, stderr, returncode = run_command(f"pip install {package_name}")
    if returncode == 0:
        print(f"✓ Successfully installed {package_name}")
        return True
    else:
        print(f"✗ Failed to install {package_name}")
        print(f"Error: {stderr}")
        return False

def check_mitmproxy():
    """Check if mitmproxy is installed and accessible."""
    # Try the specific path first
    mitmproxy_path = "C:\\Users\\rohit\\AppData\\Roaming\\Python\\Python313\\Scripts\\mitmproxy.exe"
    if os.path.exists(mitmproxy_path):
        print(f"✓ Found mitmproxy at: {mitmproxy_path}")
        return True

    # Try global path
    stdout, stderr, returncode = run_command("mitmproxy --version", check=False)
    if returncode == 0:
        print(f"✓ Found mitmproxy: {stdout.strip()}")
        return True

    return False

def main():
    """Main setup function."""
    print("=== Quack-Ext Dependency Setup ===")

    # Check prerequisites
    if not check_python():
        sys.exit(1)

    if not check_pip():
        sys.exit(1)

    # Install required packages
    packages = ["mitmproxy", "pytesseract"]
    failed_packages = []

    for package in packages:
        if not install_package(package):
            failed_packages.append(package)

    if failed_packages:
        print(f"\n✗ Failed to install: {', '.join(failed_packages)}")
        print("Please install these packages manually:")
        for package in failed_packages:
            print(f"  pip install {package}")
        sys.exit(1)

    # Verify mitmproxy installation
    if check_mitmproxy():
        print("\n✓ All dependencies are installed and accessible!")
        print("Quack-Ext is ready to use.")
    else:
        print("\n⚠ mitmproxy installed but not found in expected location")
        print("You may need to adjust the proxy command path in the extension")

    print("\n=== Setup Complete ===")

if __name__ == "__main__":
    main()
