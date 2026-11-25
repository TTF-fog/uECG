function FindHistoryExporter(Workspace);
var
    I, Project, Path;
begin
    Result := '';
    for I := 0 to Workspace.DM_ProjectCount - 1 do
    begin
        Project := Workspace.DM_Projects(I);
        Path := Project.DM_ProjectFullPath;
        if UpperCase(ExtractFileName(Path)) = 'ALTIUMHISTORYEXPORT.PRJSCR' then
        begin
            Path := ExtractFilePath(Path) + 'ExportLocalHistory.ps1';
            if FileExists(Path) then
            begin
                Result := Path;
                Exit;
            end;
        end;
    end;
end;

function SavedPcbProjectPath(Project);
var
    Path;
begin
    Result := '';
    if Project = Nil then Exit;
    Path := Project.DM_ProjectFullPath;
    if (UpperCase(ExtractFileExt(Path)) = '.PRJPCB') and FileExists(Path) then
        Result := Path;
end;

function GetHistoryProjectPath(Workspace);
var
    Path, I;
begin
    Result := SavedPcbProjectPath(Workspace.DM_FocusedProject);
    if Result <> '' then Exit;

    // Running from the script editor can give focus to the script project.
    for I := 0 to Workspace.DM_ProjectCount - 1 do
    begin
        Path := SavedPcbProjectPath(Workspace.DM_Projects(I));
        if Path <> '' then
        begin
            if Result <> '' then
            begin
                Result := '';
                Exit;
            end;
            Result := Path;
        end;
    end;
end;

procedure RunHistoryExporter(BrowseOnly);
var
    Workspace, ProjectPath, ExporterPath, Command, ErrorCode;
begin
    Workspace := GetWorkspace;
    if Workspace = Nil then Exit;
    ProjectPath := GetHistoryProjectPath(Workspace);
    if ProjectPath = '' then
    begin
        ShowMessage('Open a saved PCB project and activate one of its SchDoc or PcbDoc tabs before running this script.');
        Exit;
    end;
    ExporterPath := FindHistoryExporter(Workspace);
    if ExporterPath = '' then
    begin
        ShowMessage('Open AltiumHistoryExport.PrjScr and keep ExportLocalHistory.ps1 beside it.');
        Exit;
    end;

    Command := 'powershell.exe -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "' +
               ExporterPath + '" -ProjectFile "' + ProjectPath + '" -Gui';
    if BrowseOnly then Command := Command + ' -Browse';
    ErrorCode := RunApplication(Command);
    if ErrorCode <> 0 then
        ShowMessage('Could not start Windows PowerShell: ' + GetErrorMessage(ErrorCode));
end;

procedure ExportLocalHistory;
begin
    RunHistoryExporter(False);
end;

procedure BrowseLocalHistory;
begin
    RunHistoryExporter(True);
end;
