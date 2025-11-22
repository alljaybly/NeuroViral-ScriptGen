import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { BrainCircuit, Copy, CheckCircle2, PlayCircle, Download, FileText, FileJson, FileType, History, X, Trash2, CalendarClock, ChevronRight, Globe, BookOpen, ExternalLink, Captions } from 'lucide-react';
import { GeneratedScript, Tone, VoiceProfile, HistoryItem } from './types';
import { DEFAULT_SCRIPT } from './constants';
import { generateScript } from './services/geminiService';
import { ScriptSegmentCard } from './components/ScriptSegmentCard';
import { InputForm } from './components/InputForm';

const App: React.FC = () => {
  const [script, setScript] = useState<GeneratedScript>(DEFAULT_SCRIPT);
  const [topic, setTopic] = useState<string>('');
  const [tone, setTone] = useState<Tone>(Tone.URGENT);
  const [duration, setDuration] = useState<number>(45);
  const [useSearch, setUseSearch] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null);
  
  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // Load history from local storage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('neuroviral_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history:", e);
      }
    }
  }, []);

  const saveToHistory = (newScript: GeneratedScript, t: Tone, d: number) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      script: newScript,
      tone: t,
      duration: d
    };

    const updatedHistory = [newItem, ...history].slice(0, 20); // Keep last 20 items
    setHistory(updatedHistory);
    localStorage.setItem('neuroviral_history', JSON.stringify(updatedHistory));
  };

  const deleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('neuroviral_history', JSON.stringify(updatedHistory));
  };

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear all history?")) {
      setHistory([]);
      localStorage.removeItem('neuroviral_history');
    }
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setScript(item.script);
    setTopic(item.script.topic);
    setTone(item.tone);
    setDuration(item.duration);
    setShowHistory(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      const newScript = await generateScript(topic, tone, duration, useSearch);
      setScript(newScript);
      saveToHistory(newScript, tone, duration);
    } catch (err) {
      setError("Failed to generate script. Please check your API key and try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [topic, tone, duration, useSearch, history]);

  const handleCopy = useCallback(() => {
    const text = script.segments
      .map(s => `[${s.startTime}-${s.endTime}s] ${s.label}\nAUDIO: "${s.text}"\nVISUAL: [${s.visual}]`)
      .join('\n\n');
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [script]);

  const downloadScript = useCallback((format: 'txt' | 'md' | 'json' | 'srt') => {
    if (!script) return;
    
    let content = '';
    let mimeType = '';
    let extension = '';
    const filename = (script.topic || 'script').replace(/[^a-z0-9]/gi, '-').toLowerCase();

    const formatTimeSRT = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 1000);
      
      const pad = (n: number, width: number) => String(n).padStart(width, '0');
      return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
    };

    if (format === 'json') {
        content = JSON.stringify(script, null, 2);
        mimeType = 'application/json';
        extension = 'json';
    } else if (format === 'md') {
         content = `# ${script.topic}\n\n`;
         content += `**Total Duration:** ${duration}s\n`;
         content += `**Tone:** ${tone}\n`;
         if (voiceProfile) content += `**Voice Profile:** ${voiceProfile.voiceName} (${voiceProfile.analysis})\n`;
         content += `\n`;
         
         if (script.keyFacts && script.keyFacts.length > 0) {
             content += `## Key Research Facts\n`;
             script.keyFacts.forEach(fact => content += `- ${fact}\n`);
             content += `\n`;
         }

         if (script.sources && script.sources.length > 0) {
             content += `## Sources\n`;
             script.sources.forEach(src => content += `- [${src.title}](${src.uri})\n`);
             content += `\n`;
         }

         content += `## Script\n`;
         script.segments.forEach(s => {
            content += `### [${s.startTime}s-${s.endTime}s] ${s.label}\n`;
            content += `**Audio:** ${s.text}\n\n`;
            content += `> **Visual:** ${s.visual}\n\n`;
         });
         mimeType = 'text/markdown';
         extension = 'md';
    } else if (format === 'srt') {
        script.segments.forEach((s, index) => {
            content += `${index + 1}\n`;
            content += `${formatTimeSRT(s.startTime)} --> ${formatTimeSRT(s.endTime)}\n`;
            content += `${s.text}\n\n`;
        });
        mimeType = 'text/plain';
        extension = 'srt';
    } else {
         content = `TITLE: ${script.topic}\n`;
         content += `DURATION: ${duration}s\n`;
         content += `TONE: ${tone}\n`;
         if (voiceProfile) content += `VOICE PROFILE: ${voiceProfile.voiceName}\n`;
         content += `\n`;

         if (script.keyFacts && script.keyFacts.length > 0) {
            content += `KEY FACTS:\n`;
            script.keyFacts.forEach(fact => content += `- ${fact}\n`);
            content += `\n`;
         }

         if (script.sources && script.sources.length > 0) {
            content += `SOURCES:\n`;
            script.sources.forEach(src => content += `- ${src.title}: ${src.uri}\n`);
            content += `\n`;
         }

         script.segments.forEach(s => {
            content += `[${s.startTime}s-${s.endTime}s] ${s.label}\n`;
            content += `AUDIO: ${s.text}\n`;
            content += `VISUAL: ${s.visual}\n\n`;
         });
         mimeType = 'text/plain';
         extension = 'txt';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [script, tone, duration, voiceProfile]);

  const handleShare = useCallback((platform: 'twitter' | 'email') => {
    const textStr = script.segments
      .map(s => `[${s.label}]: ${s.text}`)
      .join('\n\n');
    
    if (platform === 'twitter') {
      // Twitter truncates content, so we share a teaser
      const tweetText = `Just generated a viral neuroscience-backed script about "${script.topic}"!\n\nHook: "${script.segments[0].text}"\n\n#ContentCreator #ScriptGen`;
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank');
    } else if (platform === 'email') {
      const subject = `Script Draft: ${script.topic}`;
      const body = `Here is the YouTube Short script for "${script.topic}":\n\n${textStr}\n\nGenerated by NeuroViral ScriptGen`;
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }
  }, [script]);

  // Calculate actual total duration from the script segments
  const currentDuration = useMemo(() => {
    if (!script.segments.length) return 0;
    const lastSegment = script.segments[script.segments.length - 1];
    return lastSegment.endTime;
  }, [script]);

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(new Date(timestamp));
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center p-4 sm:p-8 font-sans overflow-x-hidden relative">
      
      {/* Top Actions */}
      <div className="absolute top-4 right-4 z-50">
        <button 
          onClick={() => setShowHistory(true)}
          className="flex items-center gap-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Open History Panel"
          aria-expanded={showHistory}
        >
          <History className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">History</span>
        </button>
      </div>

      {/* Header */}
      <header className="w-full max-w-3xl mb-10 text-center space-y-4 pt-8">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl mb-2 ring-1 ring-indigo-500/20">
          <BrainCircuit className="w-8 h-8 text-indigo-400" aria-hidden="true" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 tracking-tight">
          NeuroViral <span className="text-indigo-500">ScriptGen</span>
        </h1>
        <p className="text-slate-300 text-lg max-w-xl mx-auto leading-relaxed">
          Generate high-retention YouTube Short scripts based on neuroscience principles. 
          <br className="hidden sm:block"/>
          Hook. Problem. Solution. Demo. CTA.
        </p>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-3xl">
        
        <InputForm 
          topic={topic} 
          setTopic={setTopic} 
          tone={tone} 
          setTone={setTone} 
          duration={duration}
          setDuration={setDuration}
          useSearch={useSearch}
          setUseSearch={setUseSearch}
          onGenerate={handleGenerate}
          isLoading={loading}
          voiceProfile={voiceProfile}
          setVoiceProfile={setVoiceProfile}
        />

        {error && (
          <div role="alert" className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-8 text-center">
            {error}
          </div>
        )}

        {/* Output Section */}
        <div className="relative" role="region" aria-label="Generated Script">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 px-2 gap-4">
            <h2 className="text-xl font-bold text-white flex items-center">
              <PlayCircle className="w-5 h-5 mr-2 text-indigo-400" aria-hidden="true" />
              Current Script: <span className="text-indigo-300 ml-2 font-normal truncate max-w-[200px]">{script.topic}</span>
            </h2>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Export Group */}
              <div role="group" aria-label="Export options" className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-800">
                 <button 
                    onClick={() => downloadScript('txt')} 
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    title="Export as Text"
                    aria-label="Export as Text file"
                 >
                    <FileText className="w-4 h-4" aria-hidden="true" />
                 </button>
                 <div className="w-px h-4 bg-slate-800 mx-1" aria-hidden="true"></div>
                 <button 
                    onClick={() => downloadScript('md')} 
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    title="Export as Markdown"
                    aria-label="Export as Markdown file"
                 >
                    <FileType className="w-4 h-4" aria-hidden="true" />
                 </button>
                 <div className="w-px h-4 bg-slate-800 mx-1" aria-hidden="true"></div>
                 <button 
                    onClick={() => downloadScript('json')} 
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    title="Export as JSON"
                    aria-label="Export as JSON file"
                 >
                    <FileJson className="w-4 h-4" aria-hidden="true" />
                 </button>
                 <div className="w-px h-4 bg-slate-800 mx-1" aria-hidden="true"></div>
                 <button 
                    onClick={() => downloadScript('srt')} 
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    title="Export as SRT (Subtitles)"
                    aria-label="Export as SRT file"
                 >
                    <Captions className="w-4 h-4" aria-hidden="true" />
                 </button>
              </div>

              <button 
                onClick={handleCopy}
                className="flex-1 sm:flex-none flex items-center justify-center space-x-2 text-sm font-medium text-slate-400 hover:text-white transition-colors bg-slate-900 hover:bg-slate-800 px-4 py-2 rounded-lg border border-slate-800 h-[42px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Copy script to clipboard"
              >
                {copied ? (
                  <div role="status" aria-live="polite" className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                    <span className="text-emerald-400">Copied</span>
                  </div>
                ) : (
                  <>
                    <Copy className="w-4 h-4" aria-hidden="true" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Grounding / Research Insights (Conditionally Rendered) */}
          {((script.keyFacts && script.keyFacts.length > 0) || (script.sources && script.sources.length > 0)) && (
            <div className="mb-8 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 p-6 animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center mb-4">
                <Globe className="w-5 h-5 text-emerald-400 mr-2" />
                <h3 className="text-lg font-bold text-emerald-300">Research Insights</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {script.keyFacts && script.keyFacts.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center">
                      <BookOpen className="w-3 h-3 mr-1.5" /> Key Facts
                    </h4>
                    <ul className="space-y-2">
                      {script.keyFacts.map((fact, idx) => (
                        <li key={idx} className="text-sm text-slate-300 flex items-start">
                          <span className="text-emerald-500 mr-2">•</span>
                          {fact}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {script.sources && script.sources.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center">
                       <ExternalLink className="w-3 h-3 mr-1.5" /> Sources
                    </h4>
                    <ul className="space-y-2">
                      {script.sources.map((source, idx) => (
                        <li key={idx}>
                          <a 
                            href={source.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-indigo-400 hover:text-indigo-300 hover:underline truncate block transition-colors"
                          >
                            {source.title || source.uri}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline Container */}
          <div className="bg-slate-950/50 rounded-3xl p-2 sm:p-8 border border-slate-800/50 shadow-2xl shadow-indigo-500/5">
            <div className="ml-4 sm:ml-2" role="list" aria-label="Script Segments">
              {script.segments.map((segment, index) => (
                <div role="listitem" key={index}>
                  <ScriptSegmentCard 
                    segment={segment} 
                    isLast={index === script.segments.length - 1}
                    tone={tone}
                    voiceProfile={voiceProfile}
                    onShare={handleShare}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 text-center text-slate-500 text-xs font-mono">
             TOTAL DURATION: {currentDuration}s • OPTIMIZED FOR RETENTION
          </div>
        </div>

      </main>

      {/* History Side Panel */}
      {showHistory && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          aria-hidden="true"
          onClick={() => setShowHistory(false)}
        ></div>
      )}

      <aside 
        id="history-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-slate-900/95 border-l border-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-[70] flex flex-col ${
          showHistory ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <h2 id="history-title" className="text-lg font-bold text-white flex items-center">
            <History className="w-5 h-5 mr-2 text-indigo-400" aria-hidden="true" />
            Generation History
          </h2>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button 
                onClick={clearHistory}
                className="text-xs text-slate-500 hover:text-red-400 transition-colors px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
                aria-label="Clear all history"
              >
                Clear All
              </button>
            )}
            <button 
              onClick={() => setShowHistory(false)}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Close history panel"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3" role="list">
          {history.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <History className="w-10 h-10 mx-auto mb-3 opacity-20" aria-hidden="true" />
              <p>No history yet.</p>
              <p className="text-sm">Generate your first script!</p>
            </div>
          ) : (
            history.map((item) => (
              <div 
                key={item.id} 
                role="listitem"
                onClick={() => loadHistoryItem(item)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') loadHistoryItem(item); }}
                tabIndex={0}
                className="group relative bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md hover:shadow-indigo-500/10 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label={`Load script: ${item.script.topic}`}
              >
                 <button 
                   onClick={(e) => deleteHistoryItem(e, item.id)}
                   className="absolute top-3 right-3 text-slate-600 hover:text-red-400 p-1 rounded hover:bg-red-500/10 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-all focus:outline-none focus:ring-2 focus:ring-red-500"
                   aria-label={`Delete ${item.script.topic} from history`}
                 >
                   <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                 </button>

                 <div className="flex items-start justify-between mb-2 pr-6">
                   <h3 className="font-bold text-slate-200 line-clamp-1 group-hover:text-indigo-300 transition-colors">
                     {item.script.topic}
                   </h3>
                 </div>

                 <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center">
                        <CalendarClock className="w-3 h-3 mr-1" aria-hidden="true" />
                        {formatDate(item.timestamp)}
                      </span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-indigo-500 transition-colors" aria-hidden="true" />
                 </div>
                 
                 <div className="mt-3 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-slate-400 px-2 py-0.5 rounded border border-slate-800">
                      {item.duration}s
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded truncate max-w-[120px]">
                      {item.tone}
                    </span>
                 </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
};

export default App;