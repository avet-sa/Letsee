# Letsee - Choose Your Storage Backend

You now have **two branches** with different storage solutions. Both have identical features, just different backends.

## Branch Comparison

### 🌿 `main` Branch - PocketBase
**Best for: Production use, multiple users, easy backups**

**Pros:**
- ✅ Unlimited storage (only limited by disk space)
- ✅ Professional SQLite database
- ✅ Easy backup (copy `pb_data` folder)
- ✅ Data portable between computers
- ✅ Admin UI for data inspection
- ✅ Can scale to multi-user with authentication
- ✅ REST API available for future integrations

**Cons:**
- ❌ Requires running `pocketbase.exe` server
- ❌ 10-minute initial setup
- ❌ Need to keep server running

**Use this if:**
- Multiple staff members use the app
- You want easy backups
- You need unlimited storage
- You're comfortable running a local server

---

### 🌿 `indexeddb` Branch - Browser Storage  
**Best for: Single user, quick setup, portable HTML**

**Pros:**
- ✅ Zero setup - just open `index.html`
- ✅ No server required
- ✅ Completely self-contained
- ✅ Works offline 100%
- ✅ Can run from USB drive
- ✅ ~50-100MB storage (way more than localStorage)

**Cons:**
- ❌ Data tied to specific browser
- ❌ Clearing browser cache deletes data
- ❌ No simple folder to backup
- ❌ Storage limit ~50-100MB (browser dependent)

**Use this if:**
- Single person uses the app
- You want instant setup
- 50-100MB is enough storage
- You don't mind browser-locked data

---

## Storage Comparison

| Feature | localStorage (old) | IndexedDB | PocketBase |
|---------|-------------------|-----------|------------|
| Storage Limit | 5-10MB | 50-100MB | Unlimited |
| Setup Time | 0 min | 0 min | 10 min |
| Server Required | No | No | Yes |
| Easy Backup | No | No | Yes |
| Binary Efficiency | Bad (base64) | Good (Blob) | Best (native) |
| Multi-Browser | No | No | Yes |
| Portable Data | No | No | Yes |

---

## How to Switch Branches

### Currently on `main` (PocketBase):
```bash
git checkout indexeddb
```
Opens the IndexedDB version. Just open `index.html` - no server needed!

### Currently on `indexeddb`:
```bash
git checkout main
```
Opens the PocketBase version. Run `start-letsee.bat` to start server + app.

---

## Migration Between Branches

### From localStorage → IndexedDB:
```bash
git checkout indexeddb
# Open migrate-indexeddb.html in browser
# Click "Start Migration"
```

### From localStorage → PocketBase:
```bash
git checkout main
# Follow SETUP.md to setup PocketBase
# Open migrate-data.html in browser
# Click "Start Migration"
```

### From IndexedDB → PocketBase:
1. Export IndexedDB data (see README-indexeddb.md)
2. Checkout main branch
3. Import manually or use migration script

---

## Recommendation

**For hotel front office use:**

**Single workstation, one browser:**
→ Use `indexeddb` branch
- Zero maintenance
- Just works
- Open `index.html` and go

**Shared workstation, multiple browsers, or need backups:**
→ Use `main` branch (PocketBase)
- Professional solution
- Easy backups
- Data safety
- Worth the 10-minute setup

---

## Current Branch

Run this to see which branch you're on:
```bash
git branch
```

The one with `*` is active.

---

## Files Per Branch

**`main` branch has:**
- `db.js` - PocketBase wrapper
- `pocketbase.exe` - Server executable
- `pb_data/` - Database folder
- `start-letsee.bat` - Launch script
- `migrate-data.html` - Migration tool
- `README.md` - PocketBase instructions
- `SETUP.md` - Detailed setup guide

**`indexeddb` branch has:**
- `db-indexeddb.js` - IndexedDB wrapper
- `migrate-indexeddb.html` - Migration tool
- `README-indexeddb.md` - IndexedDB instructions

**Both branches share:**
- `index.html`, `config.html` - UI
- `script.js`, `config-script.js` - App logic
- `style.css`, `config-style.css` - Styling

---

**Current Status:**
- `main` branch: PocketBase (commit 13dbd23)
- `indexeddb` branch: IndexedDB (commit 253b2eb)

Choose the branch that fits your workflow!
