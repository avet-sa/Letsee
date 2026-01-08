# Letsee - Hotel Front Office Shift Handover

✅ **PocketBase Migration Complete!**

## What Changed?
- ✅ Unlimited storage for image attachments (no more 5-10MB localStorage limit)
- ✅ Professional SQLite database backend
- ✅ All your features intact: dark theme, Russian support, search/filter, etc.
- ✅ Runs completely offline on hotel PC

## Quick Start (First Time)

### Step 1: Download PocketBase
1. Go to https://pocketbase.io/docs/
2. Download **Windows version** (`pocketbase_X.X.X_windows_amd64.zip`)
3. Extract `pocketbase.exe` to the `Letsee` folder (same folder as this file)

### Step 2: Double-click `start-letsee.bat`
This will:
- Start PocketBase server
- Open the app in your browser
- First time: Create admin account at http://127.0.0.1:8090/_/

### Step 3: Setup Collections (One-time only)
Open http://127.0.0.1:8090/_/ and create 4 collections:

#### 1. **people** Collection
- Field: `name` (Text, Required)
- Field: `color` (Text, Required)
- API Rules: All empty (allow all)

#### 2. **schedules** Collection
- Field: `date` (Text, Required)
- Field: `shift` (Text, Required)
- Field: `people` (JSON, Required)
- API Rules: All empty (allow all)

#### 3. **handovers** Collection
- Field: `date` (Text, Required)
- Field: `category` (Text, Required)
- Field: `room` (Text)
- Field: `guestName` (Text)
- Field: `text` (Text, Required)
- Field: `followup` (Bool)
- Field: `promised` (Bool)
- Field: `promiseText` (Text)
- Field: `attachments` (JSON)
- Field: `timestamp` (Date, Required)
- Field: `completed` (Bool)
- Field: `addedBy` (Text)
- Field: `shift` (Text)
- Field: `editedAt` (Date)
- Field: `editedBy` (Text)
- API Rules: All empty (allow all)

#### 4. **settings** Collection
- Field: `key` (Text, Required)
- Field: `value` (Text, Required)
- API Rules: All empty (allow all)

### Step 4: Migrate Old Data (If you have existing data)
1. Open `migrate-data.html` in your browser
2. Click "Start Migration"
3. Wait for "Migration completed successfully!"

### Step 5: Use the App!
Open `index.html` - everything works the same, but now with unlimited storage!

---

## Daily Use

**Every day:** Just double-click `start-letsee.bat`

The app will open and PocketBase runs in the background.

---

## Auto-Start with Windows (Optional)

1. Press `Win + R`, type `shell:startup`, press Enter
2. Right-click in the Startup folder → New → Shortcut
3. Browse to `start-letsee.bat` in your Letsee folder
4. Click OK

Now Letsee starts automatically when Windows starts!

---

## Backup Your Data

Your database is in: `Letsee/pb_data/data.db`

**To backup:**
1. Stop PocketBase (close the server window)
2. Copy the entire `pb_data` folder
3. Store it somewhere safe (USB drive, network folder, etc.)

**To restore:**
1. Stop PocketBase
2. Replace `pb_data` folder with your backup
3. Start PocketBase again

---

## Troubleshooting

### "Connection refused" or app not loading
- Make sure PocketBase is running (you should see a window with server output)
- Check it's on http://127.0.0.1:8090
- Restart: Close PocketBase window, run `start-letsee.bat` again

### "Collection not found"
- Open http://127.0.0.1:8090/_/
- Create all 4 collections (see Step 3 above)

### Port 8090 already in use
- Some other program is using port 8090
- Edit `db.js` line 2: change `8090` to `8091`
- Run: `.\pocketbase.exe serve --http=127.0.0.1:8091`

### Can't save notes
- Check PocketBase is running
- Check API Rules are empty (allow all) for all collections

---

## What's Under the Hood?

- **Frontend:** HTML/CSS/JavaScript (no frameworks, pure web standards)
- **Database:** PocketBase (SQLite backend, professional and battle-tested)
- **Storage:** Unlimited (only limited by disk space)
- **Network:** Runs locally, no internet needed
- **Files:** Attachments stored efficiently in database (no base64 bloat)

---

## Files

- `index.html` - Main app
- `config.html` - People management
- `db.js` - Database layer (PocketBase API wrapper)
- `script.js` - App logic
- `style.css` - Styling
- `start-letsee.bat` - Launch script
- `migrate-data.html` - One-time data migration tool
- `pocketbase.exe` - Database server (download separately)
- `pb_data/` - Database files (created on first run)

---

## Support

Need help? Check `SETUP.md` for detailed instructions.

Found a bug? The code is clean and well-commented - you can fix it yourself or ask for help!

---

**Version:** PocketBase Migration (Jan 2026)
**Commit:** 13c7558
