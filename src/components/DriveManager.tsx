import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  HardDrive,
  Folder,
  FileCode2,
  FileText,
  RefreshCw,
  Upload,
  Loader2,
  AlertCircle,
  X,
  ChevronRight,
  ArrowLeft,
  LogOut,
  CheckCircle2,
} from 'lucide-react';
import * as drive from '../lib/drive';

interface Props {
  files: any[];
  setFiles: (files: any[]) => void;
  activeFileId: string | null;
  setActiveFileId: (id: string) => void;
  onClose: () => void;
}

interface Crumb {
  id: string | null;
  name: string;
}

interface DriveMap {
  localToDrive: Record<string, string>;
  driveToLocal: Record<string, string>;
}

const MAP_KEY = 'vantaos_drive_map';

function loadMap(): DriveMap {
  try {
    const raw = localStorage.getItem(MAP_KEY);
    return raw ? (JSON.parse(raw) as DriveMap) : { localToDrive: {}, driveToLocal: {} };
  } catch {
    return { localToDrive: {}, driveToLocal: {} };
  }
}

function saveMap(map: DriveMap) {
  try {
    localStorage.setItem(MAP_KEY, JSON.stringify(map));
  } catch {
    // ignore — storage may be unavailable
  }
}

function languageFromName(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith('.ts') || n.endsWith('.tsx')) return 'typescript';
  if (n.endsWith('.js') || n.endsWith('.jsx')) return 'javascript';
  if (n.endsWith('.json')) return 'json';
  if (n.endsWith('.css')) return 'css';
  if (n.endsWith('.html')) return 'html';
  if (n.endsWith('.md') || n.endsWith('.markdown')) return 'markdown';
  if (n.endsWith('.py')) return 'python';
  return 'plaintext';
}

export default function DriveManager({ files, setFiles, activeFileId, setActiveFileId, onClose }: Props) {
  const configured = drive.isDriveConfigured();
  const [connected, setConnected] = useState(drive.isDriveConnected());
  const [items, setItems] = useState<drive.DriveFile[]>([]);
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: null, name: 'My Drive' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [map, setMap] = useState<DriveMap>(loadMap());

  const currentFolderId = crumbs[crumbs.length - 1]?.id ?? null;

  const loadFolder = async (folderId: string | null) => {
    try {
      setLoading(true);
      setError('');
      const list = await drive.listFiles(folderId);
      setItems(list);
    } catch (err: any) {
      setError(err.message);
      if (err.status === 401) setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (connected && configured) {
      loadFolder(currentFolderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, currentFolderId, configured]);

  const handleConnect = async () => {
    setError('');
    setStatus('');
    try {
      await drive.connectDrive();
      setConnected(true);
      setCrumbs([{ id: null, name: 'My Drive' }]);
      setStatus('Connected to Google Drive.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDisconnect = () => {
    drive.clearDriveAccessToken();
    setConnected(false);
    setItems([]);
    setStatus('');
  };

  const handleOpenFolder = async () => {
    setError('');
    try {
      const folderId = await drive.ensureVantaosFolder();
      setCrumbs([{ id: folderId, name: drive.VANTAOS_FOLDER_NAME }]);
      await loadFolder(folderId);
    } catch (err: any) {
      setError(err.message);
      if (err.status === 401) setConnected(false);
    }
  };

  const handleNavigate = async (file: drive.DriveFile) => {
    setCrumbs(prev => [...prev, { id: file.id, name: file.name }]);
  };

  const handleOpenFile = async (file: drive.DriveFile) => {
    if (!drive.canOpenInEditor(file)) {
      setError(`"${file.name}" is not a text file VantaOS can open.`);
      return;
    }
    setError('');
    setStatus('');
    setLoading(true);
    try {
      const content = await drive.downloadText(file);
      const localId = `drive-${file.id}`;
      const existing = files.find(f => f.id === localId);
      if (existing) {
        setActiveFileId(localId);
        setStatus(`Opened "${file.name}" (loaded earlier).`);
      } else {
        const node = {
          id: localId,
          name: file.name,
          content,
          language: languageFromName(file.name),
        };
        setFiles([...files, node]);
        setActiveFileId(localId);
        const nextMap = { ...map };
        nextMap.driveToLocal[file.id] = localId;
        nextMap.localToDrive[localId] = file.id;
        setMap(nextMap);
        saveMap(nextMap);
        setStatus(`Opened "${file.name}" from Drive.`);
      }
    } catch (err: any) {
      setError(err.message);
      if (err.status === 401) setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveActive = async () => {
    const file = files.find(f => f.id === activeFileId);
    if (!file) {
      setError('No active file to save. Open a file first.');
      return;
    }
    setError('');
    setStatus('');
    setLoading(true);
    try {
      const linkedDriveId = map.localToDrive[file.id];
      const saved = await drive.saveTextToDrive(file.name, file.content, linkedDriveId);
      const nextMap = { ...map };
      nextMap.localToDrive[file.id] = saved.id;
      nextMap.driveToLocal[saved.id] = file.id;
      setMap(nextMap);
      saveMap(nextMap);
      setStatus(
        linkedDriveId
          ? `Updated "${file.name}" in VantaOS.`
          : `Saved "${file.name}" to your VantaOS folder.`
      );
    } catch (err: any) {
      setError(err.message);
      if (err.status === 401) setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute top-16 right-4 w-[min(24rem,calc(100vw-2rem))] bg-[#0a0a0c]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden max-h-[80vh]"
    >
      <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
        <h3 className="font-bold text-white flex items-center gap-2">
          <HardDrive className="w-5 h-5" /> Google Drive
        </h3>
        <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-white/10 rounded text-slate-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 overflow-y-auto flex-1">
        {!configured ? (
          <div className="text-center py-6">
            <HardDrive className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <p className="text-sm text-slate-400 mb-2">Drive needs cloud credentials configured.</p>
            <p className="text-xs text-slate-500">
              Add your cloud credentials to the environment, enable the Google Drive API in Google Cloud, and rebuild.
            </p>
          </div>
        ) : !connected ? (
          <div className="text-center py-8">
            <HardDrive className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400 text-sm mb-2">Connect Google Drive to browse your files.</p>
            <p className="text-slate-500 text-xs mb-6 leading-relaxed">
              You can open anything in your Drive read-only. Files you save here go into a VantaOS folder the app creates — your own files are never overwritten.
            </p>
            <button
              onClick={handleConnect}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors w-full flex items-center justify-center gap-2"
            >
              <HardDrive className="w-4 h-4" /> Connect Drive
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-sm min-h-7">
              {crumbs.length > 1 && (
                <button
                  onClick={() => setCrumbs(prev => prev.slice(0, -1))}
                  aria-label="Back"
                  className="p-1 rounded text-slate-400 hover:bg-white/10 hover:text-slate-200"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              {crumbs.map((crumb, i) => (
                <span key={`${i}-${crumb.id}`} className="flex items-center gap-1.5 min-w-0">
                  {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                  <button
                    onClick={() => setCrumbs(crumbs.slice(0, i + 1))}
                    className="text-slate-300 hover:text-white truncate max-w-40"
                    title={crumb.name}
                  >
                    {crumb.name}
                  </button>
                </span>
              ))}
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={() => handleOpenFolder()}
                  title="Open the VantaOS app folder"
                  className="px-2 py-1 rounded text-xs bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-600/30 hover:text-indigo-200 transition-colors whitespace-nowrap"
                >
                  VantaOS folder
                </button>
                <button
                  onClick={() => loadFolder(currentFolderId)}
                  aria-label="Refresh"
                  className="p-1 rounded text-slate-400 hover:bg-white/10 hover:text-slate-200"
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={handleDisconnect}
                  title="Disconnect Drive"
                  className="p-1 rounded text-slate-400 hover:bg-white/10 hover:text-rose-400"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {status && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-start gap-2 text-emerald-400 text-sm">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{status}</span>
              </div>
            )}

            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
              {items.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 bg-slate-800/30 hover:bg-slate-800/80 border border-slate-700/30 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {item.mimeType === 'application/vnd.google-apps.folder' ? (
                      <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : drive.canOpenInEditor(item) ? (
                      <FileCode2 className="w-4 h-4 text-indigo-400 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <button
                      onClick={() =>
                        item.mimeType === 'application/vnd.google-apps.folder'
                          ? handleNavigate(item)
                          : handleOpenFile(item)
                      }
                      className="text-sm text-slate-200 hover:text-white truncate text-left"
                      title={item.name}
                    >
                      {item.name}
                    </button>
                  </div>
                  {item.mimeType === 'application/vnd.google-apps.folder' ? (
                    <ChevronRight className="w-4 h-4 text-slate-600 shrink-0 ml-2" />
                  ) : drive.canOpenInEditor(item) ? (
                    <button
                      onClick={() => handleOpenFile(item)}
                      className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors shrink-0 ml-2"
                    >
                      Open
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-500 shrink-0 ml-2">non-text</span>
                  )}
                </div>
              ))}
              {!loading && items.length === 0 && (
                <div className="text-center py-4 text-sm text-slate-500">This folder is empty.</div>
              )}
            </div>

            <div className="pt-3 border-t border-white/10">
              <button
                onClick={handleSaveActive}
                disabled={loading}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Save Active File to VantaOS
              </button>
              <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
                Saves into the VantaOS folder. Your other Drive files stay read-only.
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}