
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  AudioStatus, 
  Segment, 
  GenerationSettings, 
  VoiceOption, 
  VoiceName 
} from './types';
import { VOICES, EMOTIONS, LANGUAGES } from './constants.tsx';
import { splitTextIntoSegments, generateAudioForSegment } from './services/geminiService';
import { mergeAudioBlobs } from './utils/audioUtils';
import { db, SavedAudio } from './db';
import { format } from 'date-fns';
import { 
  Save, 
  Download, 
  Trash2, 
  Play, 
  Pause, 
  Settings, 
  Library as LibraryIcon, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ChevronRight,
  MoreVertical,
  Search,
  Plus,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Standard declaration for external scripts
declare const JSZip: any;

const App: React.FC = () => {
  const [script, setScript] = useState('');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [settings, setSettings] = useState<GenerationSettings>({
    voice: 'Kore',
    speed: 1.0,
    pitch: 1.0,
    emotion: 'Neutral',
    language: 'en-US',
    voiceContext: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState('v1');
  const [activeTab, setActiveTab] = useState<'input' | 'processing' | 'library'>('input');
  
  // Library state
  const [savedAudios, setSavedAudios] = useState<SavedAudio[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [audioToSave, setAudioToSave] = useState<{ blob: Blob; defaultName: string } | null>(null);
  const [customName, setCustomName] = useState('');

  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleSegmentPlayback = (blob: Blob, id: string) => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setPlayingSegmentId(null);
    }

    if (playingSegmentId === id) {
      audioRef.current.pause();
      setPlayingSegmentId(null);
    } else {
      if (audioRef.current.src) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      const url = URL.createObjectURL(blob);
      audioRef.current.src = url;
      audioRef.current.play();
      setPlayingSegmentId(id);
    }
  };

  const processingRef = useRef<boolean>(false);

  // Load library on mount
  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    const list = await db.savedAudios.reverse().toArray();
    setSavedAudios(list);
  };

  const handleSaveToLibrary = async () => {
    if (!audioToSave || !customName.trim()) return;

    try {
      await db.savedAudios.add({
        uid: crypto.randomUUID(),
        name: customName.trim(),
        blob: audioToSave.blob,
        createdAt: Date.now(),
        settings: { ...settings }
      });
      setIsSaveModalOpen(false);
      setAudioToSave(null);
      setCustomName('');
      loadLibrary();
      // Optional: show toast message
    } catch (error) {
      console.error("Failed to save audio:", error);
      alert("Failed to save to library. Storage might be full.");
    }
  };

  const openSaveModal = (blob: Blob, name: string) => {
    setAudioToSave({ blob, defaultName: name });
    setCustomName(name);
    setIsSaveModalOpen(true);
  };

  const deleteSavedAudio = async (id: number) => {
    if (confirm("Are you sure you want to delete this recording?")) {
      await db.savedAudios.delete(id);
      loadLibrary();
    }
  };

  const handleSplitScript = () => {
    if (!script.trim()) return;
    const textSegments = splitTextIntoSegments(script);
    const newSegments: Segment[] = textSegments.map((text, index) => ({
      id: `seg-${Date.now()}-${index}`,
      name: `Segment ${index + 1}`,
      text,
      status: AudioStatus.IDLE,
      progress: 0
    }));
    setSegments(newSegments);
    setActiveTab('processing');
  };

  const stopProcessing = () => {
    processingRef.current = false;
    setIsProcessing(false);
  };

  const generateSingleSegment = async (segId: string) => {
    const seg = segments.find(s => s.id === segId);
    if (!seg) return;

    setSegments(prev => prev.map(s => 
      s.id === segId ? { ...s, status: AudioStatus.PROCESSING, error: undefined } : s
    ));

    try {
      const audioBlob = await generateAudioForSegment(seg.text, settings);
      setSegments(prev => prev.map(s => 
        s.id === segId ? { ...s, status: AudioStatus.COMPLETED, audioBlob, error: undefined } : s
      ));
    } catch (error: any) {
      console.error(`Error processing ${seg.name}:`, error);
      setSegments(prev => prev.map(s => 
        s.id === segId ? { ...s, status: AudioStatus.FAILED, error: error.message } : s
      ));
    }
  };

  const processAllSegments = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    processingRef.current = true;

    // Process in batches of 3 to avoid rate limits while maintaining speed
    const batchSize = 3;
    const segmentsToProcess = segments.filter(s => s.status !== AudioStatus.COMPLETED);

    for (let i = 0; i < segmentsToProcess.length; i += batchSize) {
      if (!processingRef.current) break;

      const currentBatch = segmentsToProcess.slice(i, i + batchSize);
      await Promise.all(currentBatch.map(seg => generateSingleSegment(seg.id)));
    }

    setIsProcessing(false);
    processingRef.current = false;
  };

  const retrySegment = (segId: string) => {
    generateSingleSegment(segId);
  };

  const formatError = (error: string) => {
    try {
      if (error.startsWith('{')) {
        const parsed = JSON.parse(error);
        if (parsed.error && parsed.error.message) return parsed.error.message;
      }
      return error;
    } catch {
      return error;
    }
  };

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    const completed = segments.filter(s => s.status === AudioStatus.COMPLETED && s.audioBlob);
    
    if (completed.length === 0) return;

    completed.forEach(s => {
      zip.file(`${s.name.replace(/\s+/g, '_').toLowerCase()}.wav`, s.audioBlob!);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice_generation_${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveMerged = async () => {
    const completed = segments.filter(s => s.status === AudioStatus.COMPLETED && s.audioBlob);
    if (completed.length === 0) return;
    try {
      const mergedBlob = await mergeAudioBlobs(completed.map(s => s.audioBlob!));
      openSaveModal(mergedBlob, `Full_Narration_${Date.now()}`);
    } catch (err) {
      console.error("Merge failed:", err);
      alert("Failed to merge audio segments.");
    }
  };

  const handleDownloadMerged = async () => {
    const completed = segments.filter(s => s.status === AudioStatus.COMPLETED && s.audioBlob);
    if (completed.length === 0) return;

    try {
      const mergedBlob = await mergeAudioBlobs(completed.map(s => s.audioBlob!));
      const url = URL.createObjectURL(mergedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `full_narration_${Date.now()}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Merge download failed:", err);
      alert("Failed to merge audio segments. Try downloading as ZIP.");
    }
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const vId = e.target.value;
    setSelectedVoiceId(vId);
    const voice = VOICES.find(v => v.id === vId);
    if (voice) {
      setSettings(prev => ({ ...prev, voice: voice.baseVoice }));
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-slate-800 mb-2">Text To Space Studio</h1>
        <p className="text-slate-500">Long-form narration made easy with AI</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Settings Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              Settings
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Voice</label>
                <select 
                  value={selectedVoiceId}
                  onChange={handleVoiceChange}
                  className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3 border"
                >
                  {VOICES.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.gender}, {v.description})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Emotion / Style</label>
                <select 
                  value={settings.emotion}
                  onChange={(e) => setSettings(s => ({ ...s, emotion: e.target.value }))}
                  className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3 border"
                >
                  {EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
                  <select 
                    value={settings.language}
                    onChange={(e) => setSettings(s => ({ ...s, language: e.target.value }))}
                    className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3 border text-sm"
                  >
                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Batch Size</label>
                  <input type="number" value="3" readOnly className="w-full rounded-lg border-slate-300 shadow-sm bg-slate-50 py-2 px-3 border text-sm cursor-not-allowed" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                  Custom Voice Context
                  <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea 
                  value={settings.voiceContext}
                  onChange={(e) => setSettings(s => ({ ...s, voiceContext: e.target.value }))}
                  placeholder="e.g. Steady, efficient, and unhurried. Tone is empathetic, crisp, and reassuring."
                  className="w-full h-20 rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border text-xs resize-none"
                />
              </div>
            </div>
          </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Stats
              </h2>
              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span>Total Segments:</span>
                  <span className="font-semibold">{segments.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Completed:</span>
                  <span className="font-semibold text-green-600">
                    {segments.filter(s => s.status === AudioStatus.COMPLETED).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Library Size:</span>
                  <span className="font-semibold text-indigo-600">{savedAudios.length} files</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="flex border-b border-slate-200 gap-8">
              <button 
                onClick={() => setActiveTab('input')}
                className={`pb-3 text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'input' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <FileText className="w-4 h-4" />
                Script Input
              </button>
              <button 
                onClick={() => setActiveTab('processing')}
                className={`pb-3 text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'processing' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Settings className="w-4 h-4" />
                Generation
              </button>
              <button 
                onClick={() => setActiveTab('library')}
                className={`pb-3 text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'library' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <LibraryIcon className="w-4 h-4" />
                Saved Files
              </button>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'input' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  key="input-tab"
                  className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[600px]"
                >
                  <label className="block text-sm font-medium text-slate-700 mb-2">Paste your long-form script here</label>
                  <textarea 
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    placeholder="Once upon a time in a galaxy far, far away..."
                    className="flex-1 w-full rounded-lg border-slate-300 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-4 border resize-none mb-4 outline-none transition-all"
                  />
                  <div className="flex gap-4">
                    <button 
                      onClick={handleSplitScript}
                      disabled={!script.trim()}
                      className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-md shadow-indigo-100"
                    >
                      <Plus className="w-5 h-5" />
                      Segment Script
                    </button>
                  </div>
                </motion.div>
              )}

              {activeTab === 'processing' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  key="processing-tab"
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex gap-2">
                      {!isProcessing ? (
                        <button 
                          onClick={processAllSegments}
                          disabled={segments.length === 0}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          Generate All
                        </button>
                      ) : (
                        <button 
                          onClick={stopProcessing}
                          className="px-4 py-2 bg-rose-600 text-white rounded-lg font-medium hover:bg-rose-700 flex items-center gap-2 animate-pulse"
                        >
                          <Pause className="w-4 h-4 fill-current" />
                          Stop
                        </button>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={handleSaveMerged}
                        disabled={segments.filter(s => s.status === AudioStatus.COMPLETED).length === 0}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2"
                        title="Save full narration to your library"
                      >
                        <Save className="w-4 h-4" />
                        Save Merged
                      </button>
                      <button 
                        onClick={handleDownloadMerged}
                        disabled={segments.filter(s => s.status === AudioStatus.COMPLETED).length === 0}
                        className="px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg font-medium hover:bg-indigo-100 disabled:opacity-50 flex items-center gap-2"
                        title="Download full narration as a single WAV file"
                      >
                        <Download className="w-4 h-4" />
                        Download Merged
                      </button>
                      <button 
                        onClick={handleDownloadZip}
                        disabled={segments.filter(s => s.status === AudioStatus.COMPLETED).length === 0}
                        className="p-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-50 group"
                        title="Download ZIP with all segments"
                      >
                        <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-100">
                      {segments.length === 0 && (
                        <div className="p-12 text-center text-slate-400">
                          No segments generated. Go back to the "Script Input" tab to segment your text.
                        </div>
                      )}
                      {segments.map((seg, idx) => (
                        <div key={seg.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                          <div className="flex flex-col min-w-0 pr-4">
                            <span className="font-semibold text-slate-800 text-sm">{seg.name}</span>
                            <p className="text-xs text-slate-500 truncate max-w-md">{seg.text}</p>
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0">
                            {seg.status === AudioStatus.PROCESSING && (
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs text-indigo-600 font-medium">Generating...</span>
                              </div>
                            )}
                            {seg.status === AudioStatus.COMPLETED && seg.audioBlob && (
                              <div className="flex items-center gap-3">
                                <button 
                                  onClick={() => toggleSegmentPlayback(seg.audioBlob!, seg.id)}
                                  className={`p-2 rounded-full transition-colors ${playingSegmentId === seg.id ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                                  title={playingSegmentId === seg.id ? "Pause" : "Play Preview"}
                                >
                                  {playingSegmentId === seg.id ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                                </button>
                                <button 
                                  onClick={() => openSaveModal(seg.audioBlob!, seg.name)}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                                  title="Save to Library"
                                >
                                  <Save className="w-4 h-4" />
                                </button>
                                <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded hidden sm:block">Ready</span>
                              </div>
                            )}
                            {seg.status === AudioStatus.FAILED && (
                              <div className="flex flex-col items-end">
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => retrySegment(seg.id)}
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                    title="Retry this segment"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                  <div className="flex items-center gap-1 text-rose-600">
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="text-xs font-medium">Failed</span>
                                  </div>
                                </div>
                                {seg.error && (
                                  <span className="text-[10px] text-rose-500 max-w-[200px] text-right" title={seg.error}>
                                    {formatError(seg.error)}
                                  </span>
                                )}
                              </div>
                            )}
                            {seg.status === AudioStatus.IDLE && (
                              <span className="text-xs text-slate-400 italic">Queued</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'library' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  key="library-tab"
                  className="space-y-4"
                >
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3">
                    <Search className="w-5 h-5 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search saved files..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700"
                    />
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100">
                      {savedAudios.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                          {searchQuery ? "No matching files found." : "No saved files yet. Generate some audio and save it to your library!"}
                        </div>
                      ) : (
                        savedAudios
                          .filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map((audio) => (
                            <div key={audio.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                  <Play className="w-5 h-5 fill-current" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-semibold text-slate-800 text-sm">{audio.name}</span>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                    <span>{format(audio.createdAt, 'MMM d, yyyy • h:mm a')}</span>
                                    <span>•</span>
                                    <span className="uppercase">{audio.settings.voice}</span>
                                    <span>•</span>
                                    <span>{(audio.blob.size / 1024).toFixed(1)} KB</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <audio src={URL.createObjectURL(audio.blob)} controls className="h-8 w-40 hidden sm:block" />
                                <button 
                                  onClick={() => {
                                    const url = URL.createObjectURL(audio.blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${audio.name.replace(/\s+/g, '_')}.wav`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                  }}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                  title="Download"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => audio.id && deleteSavedAudio(audio.id)}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Save Modal */}
        <AnimatePresence>
          {isSaveModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSaveModalOpen(false)}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
              >
                <div className="p-6">
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Save to Library</h3>
                  <p className="text-sm text-slate-500 mb-6">Enter a name to save this audio recording permanently in your library.</p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">File Name</label>
                      <input 
                        autoFocus
                        type="text" 
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        className="w-full rounded-xl border-slate-200 bg-slate-50 p-4 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
                        placeholder="e.g. Intro Scene 1"
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveToLibrary()}
                      />
                    </div>
                  </div>

                  <div className="mt-8 flex gap-3">
                    <button 
                      onClick={() => setIsSaveModalOpen(false)}
                      className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveToLibrary}
                      disabled={!customName.trim()}
                      className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      Save Audio
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <footer className="mt-12 pt-8 border-t border-slate-200 text-center text-slate-400 text-sm">
          <p>Uses Gemini 2.5 Flash Preview TTS for high-fidelity long-form narration.</p>
        </footer>
      </div>
    );
  };

export default App;
