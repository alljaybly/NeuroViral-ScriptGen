import React, { useState, useRef, useEffect } from 'react';
import { ScriptSegment, Tone } from '../types';
import { Clock, Video, Mic, Play, Pause, Loader2, Image as ImageIcon, Pencil, Twitter, Mail, Captions } from 'lucide-react';
import { generateSpeech, generateImage } from '../services/geminiService';

interface ScriptSegmentCardProps {
  segment: ScriptSegment;
  isLast: boolean;
  tone: Tone;
  onShare?: (platform: 'twitter' | 'email') => void;
}

const getBorderColor = (label: string) => {
  switch (label.toUpperCase()) {
    case 'HOOK': return 'border-l-rose-500';
    case 'PROBLEM': return 'border-l-orange-500';
    case 'SOLUTION': return 'border-l-indigo-500';
    case 'DEMONSTRATION': return 'border-l-emerald-500';
    case 'CTA': return 'border-l-blue-500';
    default: return 'border-l-slate-500';
  }
};

const getBadgeColor = (label: string) => {
  switch (label.toUpperCase()) {
    case 'HOOK': return 'bg-rose-500/10 text-rose-400';
    case 'PROBLEM': return 'bg-orange-500/10 text-orange-400';
    case 'SOLUTION': return 'bg-indigo-500/10 text-indigo-400';
    case 'DEMONSTRATION': return 'bg-emerald-500/10 text-emerald-400';
    case 'CTA': return 'bg-blue-500/10 text-blue-400';
    default: return 'bg-slate-500/10 text-slate-400';
  }
};

// Shared AudioContext singleton
let sharedAudioContext: AudioContext | null = null;

// Global callback to stop the currently playing segment
let activeStopCallback: (() => void) | null = null;

const getAudioContext = () => {
  if (!sharedAudioContext) {
    sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return sharedAudioContext;
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const ScriptSegmentCard: React.FC<ScriptSegmentCardProps> = ({ segment, isLast, tone, onShare }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [audioDuration, setAudioDuration] = useState(0);
  
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(segment.visual);
  const [showPromptInput, setShowPromptInput] = useState(false);

  // Derived state for subtitles
  const words = segment.text.split(' ');
  // Calculate which word is currently being spoken based on linear progress
  // This is an approximation since we don't have word-level timestamps from TTS
  const currentWordIndex = Math.min(
    Math.floor((progress / 100) * words.length),
    words.length - 1
  );

  // Reset state when segment changes
  useEffect(() => {
    setCustomPrompt(segment.visual);
    setImageSrc(null);
    
    // Stop any playing audio for this card if the segment data itself swaps completely
    if (isPlaying) {
      stopAudio();
    }
    setAudioBuffer(null);
    setAudioDuration(0);
    setProgress(0);
    setShowPromptInput(false);
  }, [segment]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sourceRef.current) {
        try {
          sourceRef.current.stop();
        } catch (e) { /* ignore */ }
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      // If this card was the active one, clear the global reference so we don't hold onto dead closures
      if (activeStopCallback === stopAudio) {
        activeStopCallback = null;
      }
    };
  }, []);

  const stopAudio = () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch (e) { /* ignore */ }
      sourceRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsPlaying(false);
    // We don't reset progress here so visual cues stay if paused/stopped, 
    // but for typical "stop" behavior we usually reset. 
    // Let's reset progress to 0 on full stop, but maybe keep it if we implement pause later.
    // For now, stop resets.
    setProgress(0);
  };

  const updateProgress = () => {
    if (!sourceRef.current || !sharedAudioContext) return;
    
    const elapsed = sharedAudioContext.currentTime - startTimeRef.current;
    const duration = audioBuffer?.duration || 0;
    
    if (duration > 0) {
      const p = Math.min((elapsed / duration) * 100, 100);
      setProgress(p);
      
      if (elapsed < duration) {
        rafRef.current = requestAnimationFrame(updateProgress);
      } else {
        setProgress(100);
      }
    }
  };

  // Decode base64 string to Uint8Array
  const base64ToBytes = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  // Decode raw PCM data into AudioBuffer
  const pcmToAudioBuffer = (
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number = 24000,
    numChannels: number = 1
  ): AudioBuffer => {
    const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const toggleAudio = async () => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();

    // If currently playing, stop it.
    if (isPlaying) {
      stopAudio();
      if (activeStopCallback === stopAudio) activeStopCallback = null;
      return;
    }

    // If another card is playing, stop it.
    if (activeStopCallback) {
      activeStopCallback();
    }
    // Register this card as the active one
    activeStopCallback = stopAudio;

    setIsPlaying(true);

    try {
      let buffer = audioBuffer;

      if (!buffer) {
        setIsLoadingAudio(true);
        const base64Audio = await generateSpeech(segment.text, tone);
        const pcmBytes = base64ToBytes(base64Audio);
        buffer = pcmToAudioBuffer(pcmBytes, ctx);
        setAudioBuffer(buffer);
        setAudioDuration(buffer.duration);
        setIsLoadingAudio(false);
      } else {
        setAudioDuration(buffer.duration);
      }

      // Create source
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      
      source.onended = () => {
        setIsPlaying(false);
        sourceRef.current = null;
        setProgress(100);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (activeStopCallback === stopAudio) activeStopCallback = null;
      };

      startTimeRef.current = ctx.currentTime;
      source.start();
      sourceRef.current = source;
      
      // Start progress loop
      updateProgress();

    } catch (error) {
      console.error("Audio playback error:", error);
      setIsPlaying(false);
      setIsLoadingAudio(false);
      if (activeStopCallback === stopAudio) activeStopCallback = null;
    }
  };

  const handleGenerateImage = async () => {
    setIsGeneratingImage(true);
    try {
      const promptToUse = showPromptInput ? customPrompt : segment.visual;
      const base64Image = await generateImage(promptToUse);
      setImageSrc(base64Image);
      setShowPromptInput(false);
    } catch (error) {
      console.error("Image generation error:", error);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleTogglePrompt = () => {
    setShowPromptInput(!showPromptInput);
  };

  return (
    <div className={`relative pl-8 pb-8 ${isLast ? '' : 'border-l-2 border-slate-800'}`}>
      {/* Timeline Node */}
      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-900 border-2 border-slate-700 ring-4 ring-slate-950"></div>

      <div className={`bg-slate-900/50 rounded-xl border-l-4 p-5 shadow-lg backdrop-blur-sm hover:bg-slate-800/50 transition-colors ${getBorderColor(segment.label)}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${getBadgeColor(segment.label)}`}>
            {segment.label}
          </span>
          <div className="flex items-center text-slate-400 font-mono text-xs bg-slate-950/50 px-2 py-1 rounded">
            <Clock className="w-3 h-3 mr-1.5" />
            {segment.startTime}s - {segment.endTime}s
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                <Mic className="w-3 h-3 mr-1.5" />
                Voiceover / Audio
              </div>
              <div className="flex items-center gap-3">
                {/* Time Display */}
                {(audioDuration > 0) && (
                  <span className="text-xs font-mono text-indigo-400">
                    {formatTime(isPlaying ? (audioDuration * progress) / 100 : 0)} / {formatTime(audioDuration)}
                  </span>
                )}
                <button
                  onClick={toggleAudio}
                  disabled={isLoadingAudio}
                  className={`flex items-center space-x-1 text-xs font-bold uppercase px-2 py-1 rounded transition-colors ${
                    isPlaying 
                      ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30' 
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                >
                  {isLoadingAudio ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-3 h-3 fill-current" />
                  ) : (
                    <Play className="w-3 h-3 fill-current" />
                  )}
                  <span>{isLoadingAudio ? 'Loading...' : isPlaying ? 'Stop' : 'Preview'}</span>
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            {(isPlaying || (audioBuffer && progress > 0)) && (
              <div className="w-full h-1 bg-slate-800 rounded-full mb-3 overflow-hidden">
                 <div 
                   className="h-full bg-indigo-500 transition-all duration-100 ease-linear"
                   style={{ width: `${progress}%` }}
                 />
              </div>
            )}

            <p className="text-lg leading-relaxed text-slate-200 font-medium">
              "{segment.text}"
            </p>
            
            {/* Synchronized Subtitles (Karaoke Effect) */}
            {(isPlaying || progress > 0) && (
               <div className="mt-4 bg-black/80 rounded-xl p-4 border border-slate-700/50 relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                  <div className="absolute top-2 left-3 flex items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <Captions className="w-3 h-3 mr-1" />
                    Subtitle Preview
                  </div>
                  <div className="pt-4 pb-1 text-center leading-relaxed text-lg font-bold tracking-tight">
                    {words.map((word, index) => (
                      <span 
                        key={index}
                        className={`inline-block mr-1.5 transition-all duration-200 ${
                          index === currentWordIndex 
                            ? 'text-yellow-400 scale-110 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]' 
                            : index < currentWordIndex 
                              ? 'text-white' 
                              : 'text-slate-600 blur-[0.5px]'
                        }`}
                      >
                        {word}
                      </span>
                    ))}
                  </div>
               </div>
            )}

          </div>

          <div className="bg-slate-950/30 rounded-lg p-3 border border-white/5">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
                <Video className="w-3 h-3 mr-1.5" />
                Visual Cue
              </div>
               {!imageSrc && (
                <div className="flex items-center gap-2">
                  <button
                     onClick={handleTogglePrompt}
                     disabled={isGeneratingImage}
                     className={`p-1.5 rounded-md transition-colors ${showPromptInput ? 'bg-slate-800 text-indigo-400' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
                     title={showPromptInput ? "Close Prompt Editor" : "Customize Image Prompt"}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleGenerateImage}
                    disabled={isGeneratingImage}
                    className={`flex items-center space-x-1 text-xs font-bold uppercase px-2 py-1 rounded transition-colors ${
                      isGeneratingImage 
                        ? 'bg-slate-800 text-slate-500' 
                        : 'bg-teal-500/10 text-teal-400 hover:bg-teal-500/20'
                    }`}
                  >
                    {isGeneratingImage ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <ImageIcon className="w-3 h-3" />
                    )}
                    <span>{isGeneratingImage ? 'Generating...' : 'Generate Visual'}</span>
                  </button>
                </div>
               )}
            </div>

            {/* Prompt Editor */}
            {showPromptInput && !imageSrc && (
              <div className="mb-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none placeholder-slate-600"
                  rows={3}
                  placeholder="Describe the image you want to generate..."
                  autoFocus
                />
              </div>
            )}
            
            {imageSrc && (
              <div className="mb-3 rounded-lg overflow-hidden border border-slate-700 relative group bg-black">
                 <img src={imageSrc} alt="Generated visual" className="w-full h-auto object-cover max-h-80 mx-auto" />
                 <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setImageSrc(null)}
                      className="bg-black/60 hover:bg-black/80 text-white px-2 py-1 rounded text-xs font-bold backdrop-blur-md"
                    >
                      Regenerate
                    </button>
                 </div>
              </div>
            )}

            {(!showPromptInput || imageSrc) && (
              <p className="text-sm text-slate-400 italic">
                [{segment.visual}]
              </p>
            )}
          </div>

          {/* Share Options for CTA */}
          {segment.label.toUpperCase() === 'CTA' && (
            <div className="mt-4 pt-4 border-t border-slate-800/50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Share Script
                </span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => onShare?.('twitter')}
                    className="flex items-center gap-1.5 bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 text-[#1DA1F2] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors group"
                  >
                    <Twitter className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                    Tweet
                  </button>
                  <button 
                    onClick={() => onShare?.('email')}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors group"
                  >
                    <Mail className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                    Email
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};