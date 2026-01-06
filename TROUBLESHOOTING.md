# Troubleshooting: Vite Not Reloading

## Quick Fix Steps

### 1. Restart the Dev Server
Run this in PowerShell:
```powershell
.\restart-dev.ps1
```

Or manually:
- Press `Ctrl+C` in the terminal running `npm run dev`
- Run `npm run dev` again

### 2. Clear Vite Cache
```powershell
Remove-Item -Recurse -Force "node_modules\.vite" -ErrorAction SilentlyContinue
npm run dev
```

### 3. Hard Refresh Browser
- Press `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
- Or open DevTools (F12) → Right-click refresh button → "Empty Cache and Hard Reload"

### 4. Check Browser Console
- Press F12 to open DevTools
- Look for errors in the Console tab
- Check the Network tab to see if files are loading

### 5. Verify File is Saved
- Make sure you press `Ctrl+S` after editing
- Check if the file shows as "unsaved" in Cursor (should have a dot next to filename)

### 6. Check File Path
Make sure you're editing:
- ✅ `src/components/NeonPitRoguelikeV3.jsx` (CORRECT)
- ❌ NOT any file in the root directory

### 7. Verify Dev Server is Running
- Check terminal for: `Local: http://localhost:3000/`
- Make sure you're viewing `http://localhost:3000` in browser
- Not `http://localhost:8000` (that's the old static server)

## Common Issues

### Issue: Changes don't appear
**Solution**: 
1. Save file (`Ctrl+S`)
2. Wait 1-2 seconds
3. Check browser console for errors
4. Hard refresh (`Ctrl+Shift+R`)

### Issue: "Cannot GET /" error
**Solution**: Make sure you're using Vite dev server (`npm run dev`), not the static server

### Issue: Port 3000 already in use
**Solution**: 
```powershell
.\restart-dev.ps1
```

### Issue: HMR shows "(x2)" or multiple updates
**This is normal** - React components sometimes trigger multiple updates. Just wait for it to finish.

## Still Not Working?

1. **Kill all Node processes:**
   ```powershell
   Get-Process node | Stop-Process -Force
   ```

2. **Clear everything:**
   ```powershell
   Remove-Item -Recurse -Force "node_modules\.vite"
   npm run dev
   ```

3. **Check if file is actually changing:**
   - Make a very obvious change (like change a number to 99999)
   - Save and check if browser shows the change
   - If yes, HMR is working but your changes might be getting overridden
   - If no, there's a deeper issue with file watching
