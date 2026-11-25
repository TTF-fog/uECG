# Export Altium Local History

1. In Altium Designer, open `AltiumHistoryExport.PrjScr` alongside the PCB project. Keep the `.PrjScr`, `.pas`, and `.ps1` files together.
2. Activate a schematic or PCB tab in the PCB project. From the **File** menu, choose **Run Script**, then select `ExportLocalHistory`. Select `BrowseLocalHistory` instead to open the project's `History` folder in Explorer.
3. Pick an output folder. The script creates a dated subfolder with one folder per schematic and PCB document. It keeps Altium's revision suffixes and copies each current saved file if available.

The script reads the saved `.PrjPcb` and its local `History` folder. It does not include unsaved edits, restore files in place, or fetch Git or Altium 365 revisions. If an archive or current file fails to export, the script logs the error in `export-errors.txt` and continues with the remaining files.

To run from PowerShell, use the command below from the uECG project directory. If you use a global history repository, add `-HistoryRoot 'C:\path\to\this-projects-history'` pointing at the project's folder inside that repository.

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\AltiumHistoryExport\ExportLocalHistory.ps1 -ProjectFile .\uECG.PrjPcb -Destination '.\History Export'
```
