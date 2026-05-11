#!/usr/bin/env python3
"""
Bootstrap script to create the first admin user.

Usage:
    python create_admin.py

Or with custom credentials:
    python create_admin.py --email admin@example.com --name "Admin User" --password SecurePass123

This script:
1. Checks if the database is empty (no users)
2. Creates the first admin user automatically
3. The first user gets is_admin=True automatically (bootstrap behavior)
"""

import argparse
import sys
import requests
import json

# Configuration
API_BASE_URL = "http://localhost:8000/api"

def create_admin_user(email: str, password: str, full_name: str, color: str = "#3498db"):
    """Create the first admin user via the registration endpoint."""
    
    url = f"{API_BASE_URL}/auth/register"
    
    payload = {
        "email": email,
        "password": password,
        "full_name": full_name,
        "color": color
    }
    
    print(f"Attempting to create admin user: {full_name} ({email})")
    
    try:
        response = requests.post(url, json=payload)
        
        if response.status_code == 200:
            user_data = response.json()
            print("\n✅ Success! Admin user created:")
            print(f"   ID: {user_data.get('id')}")
            print(f"   Email: {user_data.get('email')}")
            print(f"   Name: {user_data.get('full_name')}")
            print(f"   Is Admin: {user_data.get('is_admin')}")
            print(f"   Color: {user_data.get('color')}")
            print(f"\n🔑 You can now log in at: http://localhost:3000/login.html")
            return True
            
        elif response.status_code == 400:
            error = response.json()
            print(f"\n❌ Error: {error.get('detail', 'Bad request')}")
            return False
            
        elif response.status_code == 403:
            print("\n⚠️  Registration is disabled. This usually means:")
            print("   - A user already exists in the database")
            print("   - You need to ask an existing admin to create your account")
            return False
            
        else:
            print(f"\n❌ Unexpected error: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("\n❌ Could not connect to the API.")
        print("   Make sure the backend is running at http://localhost:8000")
        print("   Start it with: cd backend && uvicorn app.main:app --reload")
        return False
        
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Create the first admin user for Letsee",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Create admin with default values
  python create_admin.py
  
  # Create admin with custom credentials
  python create_admin.py --email admin@example.com --name "John Doe" --password MySecurePass123
        """
    )
    
    parser.add_argument(
        "--email", 
        default="admin@letsee.com",
        help="Admin email address (default: admin@letsee.com)"
    )
    parser.add_argument(
        "--name", 
        default="System Admin",
        help="Admin full name (default: System Admin)"
    )
    parser.add_argument(
        "--password", 
        default="Admin@123456",
        help="Admin password (min 8 characters, default: Admin@123456)"
    )
    parser.add_argument(
        "--color", 
        default="#3498db",
        help="Admin color for schedule visualization (default: #3498db)"
    )
    
    args = parser.parse_args()
    
    # Validate password length
    if len(args.password) < 8:
        print("❌ Password must be at least 8 characters long")
        sys.exit(1)
    
    # Create the admin user
    success = create_admin_user(
        email=args.email,
        password=args.password,
        full_name=args.name,
        color=args.color
    )
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()