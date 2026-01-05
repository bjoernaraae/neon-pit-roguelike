# Quick Setup Guide for Beginners

## 🚀 Get Live Preview Working in Cursor (5 minutes)

### Step 1: Install Node.js (One-time setup)

1. **Download Node.js:**
   - Go to: https://nodejs.org/
   - Click the big green "LTS" button (recommended version)
   - This downloads an installer

2. **Install Node.js:**
   - Double-click the downloaded file
   - Click "Next" through all the prompts (default settings are fine)
   - Click "Install"
   - Wait for it to finish
   - Click "Finish"

3. **Restart Cursor:**
   - Close Cursor completely
   - Open it again (this lets it find Node.js)

### Step 2: Install Project Dependencies

1. **Open Terminal in Cursor:**
   - Press `` Ctrl+` `` (backtick key) or go to Terminal → New Terminal

2. **Run this command:**
   ```bash
   npm install
   ```
   - Wait for it to finish (takes 1-2 minutes the first time)

### Step 3: Start the Live Preview Server

**Option A - Easy Way (Double-click):**
- Double-click `start-dev.bat` in your project folder

**Option B - Terminal Way:**
- In Cursor's terminal, type:
  ```bash
  npm run dev
  ```

### Step 4: View in Cursor's Browser

1. The server will start and your browser should open automatically
2. **OR** in Cursor, you can:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "Simple Browser: Show"
   - Enter: `http://localhost:3000`

## ✅ What You Get

- **Live Preview:** Changes to your code instantly appear in the browser
- **No Manual Refresh:** The page updates automatically when you save
- **Error Messages:** See errors directly in the browser
- **Fast Development:** Everything runs smoothly

## 🆘 Troubleshooting

**"npm is not recognized"**
- You need to restart Cursor after installing Node.js
- Or restart your computer

**Port 3000 already in use**
- Close other programs using that port
- Or the server will automatically try a different port

**Browser doesn't open automatically**
- Manually go to: `http://localhost:3000`

## 🎮 You're Ready!

Once the server is running, you'll see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

Your game is now running with live preview! 🎉
