# PocketBase Setup Instructions

## Quick Start (5 minutes)

### 1. Download PocketBase
1. Go to https://pocketbase.io/docs/
2. Download the Windows version (pocketbase.exe)
3. Put `pocketbase.exe` in the `Letsee` folder

### 2. Run PocketBase
1. Open PowerShell in the Letsee folder
2. Run: `.\pocketbase.exe serve`
3. You'll see: `Server started at http://127.0.0.1:8090`

### 3. Create Admin Account
1. Open browser to http://127.0.0.1:8090/_/
2. Create admin email and password
3. You're now in the admin dashboard!

### 4. Create Collections (Database Tables)
Click "New collection" and create these 4 collections:

#### Collection 1: **people**
- Name: `people`
- Type: Base
- Fields:
  - `name` (Text, Required)
  - `color` (Text, Required)

#### Collection 2: **schedules**
- Name: `schedules`
- Type: Base
- Fields:
  - `date` (Text, Required, Unique)
  - `shift` (Text, Required)
  - `people` (JSON, Required)

#### Collection 3: **handovers**
- Name: `handovers`
- Type: Base
- Fields:
  - `date` (Text, Required)
  - `category` (Text, Required)
  - `room` (Text)
  - `guestName` (Text)
  - `text` (Text, Required)
  - `followup` (Bool)
  - `promised` (Bool)
  - `promiseText` (Text)
  - `attachments` (JSON)
  - `timestamp` (Date, Required)
  - `completed` (Bool)
  - `addedBy` (Text)
  - `shift` (Text)
  - `editedAt` (Date)
  - `editedBy` (Text)

#### Collection 4: **settings**
- Name: `settings`
- Type: Base
- Fields:
  - `key` (Text, Required, Unique)
  - `value` (Text, Required)

### 5. Set API Rules (Important!)
For each collection, click the collection → "API Rules" tab:
- **List/View Rule**: Leave empty (anyone can read)
- **Create Rule**: Leave empty (anyone can create)
- **Update Rule**: Leave empty (anyone can update)
- **Delete Rule**: Leave empty (anyone can delete)

Note: This is for local use. For production, add authentication.

### 6. Open the Application
1. Open `index.html` in your browser
2. Application will now use PocketBase database!

## Running PocketBase Automatically

### Option A: Manual (for testing)
Just run `.\pocketbase.exe serve` before using the app

### Option B: Windows Service (always running)
Create a batch file `start-letsee.bat`:
```batch
@echo off
cd /d "%~dp0"
start "" pocketbase.exe serve
timeout /t 2
start "" index.html
```
Double-click this file to start everything!

### Option C: Auto-start with Windows
1. Press Win+R, type `shell:startup`, press Enter
2. Create shortcut to `start-letsee.bat` in this folder
3. PocketBase starts when Windows starts

## Backup Your Data

Your database is in: `Letsee/pb_data/data.db`

To backup:
1. Stop PocketBase
2. Copy the entire `pb_data` folder
3. Store it somewhere safe

To restore:
1. Stop PocketBase
2. Replace `pb_data` folder with your backup
3. Start PocketBase

## Troubleshooting

**"Connection refused"**
- Make sure PocketBase is running (`.\pocketbase.exe serve`)
- Check it's on http://127.0.0.1:8090

**"Collection not found"**
- Go to admin UI (http://127.0.0.1:8090/_/)
- Make sure all 4 collections are created

**"Failed to create"**
- Check API Rules are empty (allow all for local use)
- Restart PocketBase

## Migrating Existing Data

Your old localStorage data is still in the browser. To migrate:
1. Open browser console (F12)
2. Run:
```javascript
// Export old data
const oldData = {
    people: localStorage.getItem('letsee_people'),
    schedule: localStorage.getItem('letsee_schedule'),
    handover: localStorage.getItem('letsee_handover')
};
console.log(oldData);
// Copy this output
```
3. Contact me with this data and I'll create a migration script

## Port Already in Use?

If port 8090 is taken, run:
```
.\pocketbase.exe serve --http=127.0.0.1:8091
```

Then update `db.js` line 2 to: `const pb = new PocketBase('http://127.0.0.1:8091');`
