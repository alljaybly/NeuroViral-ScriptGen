import React, { useRef, useState } from 'react';
import { Tone, VoiceProfile } from '../types';
import { TONES, SCRIPT_TEMPLATES } from '../constants';
import { Sparkles, Zap, Clock, Mic, Upload, Loader2, CheckCircle, Globe, Smartphone, Dumbbell, BookHeart, TrendingUp, Utensils } from 'lucide-react';
import { analyzeVoiceStyle } from '../services/geminiService';

interface InputFormProps {
  topic: string;
  setTopic: (t: string) => void;
  tone: Tone;
  setTone: (t: Tone) => void;
  duration: number;
  setDuration: (d: number) => void;
  useSearch: boolean;
  setUseSearch: (s: boolean) => void;
  onGenerate: () => void;
  isLoading: boolean;
  voiceProfile: VoiceProfile | null;
  setVoiceProfile: (vp: VoiceProfile | null) => void;
}

const getTemplateIcon = (name: string) => {
  switch (name) {
    case 'Smartphone': return <Smartphone className="w-4 h-4" aria-hidden="true" />;
    case 'Dumbbell': return <Dumbbell className="w-4 h-4" aria-hidden="true" />;
    case 'BookHeart': return <BookHeart className="w-4 h-4" aria-hidden="true" />;
    case 'Zap': return <Zap className="w-4 h-4" aria-hidden="true" />;
    case 'TrendingUp': return <TrendingUp className="w-4 h-4" aria-hidden="true" />;
    case 'Utensils': return <Utensils className="w-4 h-4" aria-hidden="true" />;
    default: return <Sparkles className="w-4 h-4" aria-hidden="true" />;
  }
};

export const InputForm: React.FC<InputFormProps> = ({
  topic,
  setTopic,
  tone,
  setTone,
  duration,
  setDuration,
  useSearch,
  setUseSearch,
  onGenerate,
  isLoading,
  voiceProfile,
  setVoiceProfile
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzingVoice, setIsAnalyzingVoice] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setUploadError("File too large. Please upload under 5MB.");
      return;
    }

    setUploadError(null);
    setIsAnalyzingVoice(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const profile = await analyzeVoiceStyle(base64);
        setVoiceProfile(profile);
        setIsAnalyzingVoice(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setUploadError("Failed to analyze voice sample.");
      setIsAnalyzingVoice(false);
    }
  };

  const handleUploadKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  const applyTemplate = (template: typeof SCRIPT_TEMPLATES[0]) => {
    setTopic(template.topic);
    setTone(template.tone);
    setDuration(template.duration);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl" role="form" aria-label="Script Generation Form">
      {/* Templates Section */}
      <div className="mb-6">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Start Templates</label>
        <div className="flex flex-wrap gap-2" role="list" aria-label="Script Templates">
          {SCRIPT_TEMPLATES.map((template) => (
            <button
              key={template.label}
              onClick={() => !isLoading && applyTemplate(template)}
              disabled={isLoading}
              className="flex items-center gap-2 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800 text-slate-300 hover:text-indigo-400 px-3 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={`Use ${template.label} template: ${template.topic}`}
            >
              {getTemplateIcon(template.iconName)}
              <span>{template.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Topic Input */}
        <div className="md:col-span-2 space-y-2">
          <label htmlFor="topic-input" className="block text-sm font-medium text-slate-300">Topic</label>
          <input
            id="topic-input"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., Anxiety Relief, Productivity Hack, Coding Tips"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            disabled={isLoading}
            aria-required="true"
          />
        </div>

        {/* Tone Select & Voice Clone */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="tone-select" className="block text-sm font-medium text-slate-300">Tone & Style</label>
            <select
              id="tone-select"
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
              className={`w-full bg-slate-950 border rounded-lg px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none transition-all ${
                voiceProfile ? 'border-indigo-500/50 opacity-75' : 'border-slate-700'
              }`}
              disabled={isLoading || !!voiceProfile}
            >
              {TONES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {voiceProfile && (
               <div className="text-xs text-indigo-400 font-medium mt-1 flex items-center" role="status">
                 <Sparkles className="w-3 h-3 mr-1" aria-hidden="true" />
                 Tone overridden by matched voice
               </div>
            )}
          </div>
        </div>

        {/* Voice Matching Upload */}
        <div className="space-y-2">
          <label id="voice-clone-label" className="block text-sm font-medium text-slate-300">Voice Cloning (Style Match)</label>
          <div 
            role={!voiceProfile && !isAnalyzingVoice ? "button" : "region"}
            aria-labelledby="voice-clone-label"
            tabIndex={!voiceProfile && !isAnalyzingVoice ? 0 : -1}
            onKeyDown={!voiceProfile && !isAnalyzingVoice ? handleUploadKeyDown : undefined}
            className={`relative rounded-lg border border-dashed transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              voiceProfile ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700 bg-slate-950 hover:bg-slate-900'
            }`}
          >
            {!voiceProfile && !isAnalyzingVoice && (
              <div 
                className="flex flex-col items-center justify-center p-3 cursor-pointer h-[86px]"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex items-center text-slate-400 space-x-2 mb-1">
                  <Upload className="w-4 h-4" aria-hidden="true" />
                  <span className="text-sm font-medium">Upload Sample</span>
                </div>
                <span className="text-xs text-slate-500">MP3/WAV (Max 5MB)</span>
              </div>
            )}

            {isAnalyzingVoice && (
              <div className="flex flex-col items-center justify-center p-3 h-[86px]" role="status" aria-live="polite">
                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin mb-2" aria-hidden="true" />
                <span className="text-xs text-indigo-400 animate-pulse">Analyzing Voice Characteristics...</span>
              </div>
            )}

            {voiceProfile && (
              <div className="p-3 h-[86px] flex flex-col justify-center relative group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-emerald-400 flex items-center">
                    <CheckCircle className="w-3 h-3 mr-1" aria-hidden="true" />
                    Match: {voiceProfile.voiceName}
                  </span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setVoiceProfile(null); }}
                    className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label="Reset voice selection"
                  >
                    Reset
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight line-clamp-2">
                  {voiceProfile.analysis}
                </p>
              </div>
            )}

            <input 
              type="file" 
              id="voice-upload"
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept="audio/*"
              className="hidden" 
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>
          {uploadError && <p className="text-xs text-red-400" role="alert">{uploadError}</p>}
        </div>

        {/* Duration & Search Options */}
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Duration Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="duration-slider" className="block text-sm font-medium text-slate-300">Duration</label>
              <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded">
                {duration}s
              </span>
            </div>
            <div className="relative h-11 flex items-center">
              <input
                id="duration-slider"
                type="range"
                min="30"
                max="60"
                step="1"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                disabled={isLoading}
                aria-valuemin={30}
                aria-valuemax={60}
                aria-valuenow={duration}
                aria-valuetext={`${duration} seconds`}
              />
            </div>
          </div>

          {/* Search Grounding Toggle */}
          <div className="space-y-2">
             <label className="block text-sm font-medium text-slate-300">Research & Grounding</label>
             <button
               onClick={() => !isLoading && setUseSearch(!useSearch)}
               className={`w-full h-[44px] flex items-center justify-between px-4 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                 useSearch 
                  ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300' 
                  : 'bg-slate-950 border-slate-700 text-slate-400 hover:bg-slate-900'
               }`}
               aria-pressed={useSearch}
             >
                <div className="flex items-center">
                  <Globe className={`w-4 h-4 mr-2 ${useSearch ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span className="text-sm font-medium">Deep Research</span>
                </div>
                <div className={`w-10 h-5 rounded-full relative transition-colors ${useSearch ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                   <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${useSearch ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
             </button>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={isLoading || !topic.trim() || isAnalyzingVoice}
        className={`w-full mt-6 group relative flex items-center justify-center py-4 px-6 rounded-lg font-bold text-white overflow-hidden transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
          isLoading || isAnalyzingVoice
            ? 'bg-slate-800 cursor-not-allowed' 
            : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg hover:shadow-indigo-500/25'
        }`}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <div className="flex items-center space-x-2" role="status">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true"></div>
            <span>{useSearch ? "Researching & Constructing..." : "Constructing Viral Hook..."}</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" aria-hidden="true" />
            <span>Generate {duration}s Script</span>
            <Zap className="w-4 h-4 opacity-50" aria-hidden="true" />
          </div>
        )}
      </button>
    </div>
  );
};