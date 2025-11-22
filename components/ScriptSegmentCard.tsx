import React, { useState, useRef, useEffect } from 'react';
import { ScriptSegment, Tone, VoiceProfile } from '../types';
import { Clock, Video, Mic, Play, Pause, Loader2, Image as ImageIcon, Pencil, Twitter, Mail, Captions, Music, Volume2 } from 'lucide-react';
import { generateSpeech, generateImage } from '../services/geminiService';

interface ScriptSegmentCardProps {
  segment: ScriptSegment;
  isLast: boolean;
  tone: Tone;
  voiceProfile?: VoiceProfile | null;
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

// --- Procedural Ambience Engine ---
const playProceduralAmbience = (ctx: AudioContext, tone: Tone, volume: number) => {
  const masterGain = ctx.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(ctx.destination);

  const nodes: AudioNode[] = [];
  
  const now = ctx.currentTime;
  
  const createOsc = (type: OscillatorType, freq: number, detune: number = 0, gainVal: number = 0.05) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    gain.gain.value = gainVal;
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    nodes.push(osc, gain);
    return { osc, gain };
  };

  switch (tone) {
    case Tone.URGENT:
      // Throbbing Low Drone (Theta waves tension)
      // A1 (55Hz)
      const osc1 = createOsc('sawtooth', 55, 0, 0.03); 
      const osc2 = createOsc('sawtooth', 55, 5, 0.03); 
      // LFO for tension
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 4; // 4Hz throb
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 50; 
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.osc.detune);
      lfo.start(now);
      nodes.push(lfo, lfoGain);
      break;

    case Tone.MOTIVATIONAL:
    case Tone.HUMOROUS:
      // Bright Major Pad - Slightly reduced gain for subtlety
      createOsc('triangle', 130.81, 0, 0.04); // C3
      createOsc('triangle', 164.81, 0, 0.04); // E3
      createOsc('triangle', 196.00, 0, 0.04); // G3
      break;

    case Tone.CALM:
    case Tone.PERSONAL:
      // Smooth Sine Binaural (Theta/Alpha)
      createOsc('sine', 220, 0, 0.05); // A3
      createOsc('sine', 224, 0, 0.05); // A3 + 4Hz binaural beat
      createOsc('sine', 110, 0, 0.03); // A2 Sub
      break;
    
    case Tone.AUTHORITATIVE:
      // Deep Sub Resonance
      createOsc('sine', 65.41, 0, 0.15); // C2
      createOsc('triangle', 130.81, 0, 0.02); // C3 low mix
      break;

    default: // STORYTELLING etc
      // Neutral Warm Pad
      createOsc('triangle', 146.83, 0, 0.04); // D3
      createOsc('sine', 293.66, 0, 0.04); // D4
      break;
  }

  return {
    stop: () => {
      const end = ctx.currentTime + 1.0; // 1s fade out
      masterGain.gain.linearRampToValueAtTime(0, end);
      nodes.forEach(node => {
        if (node instanceof OscillatorNode) {
          node.stop(end);
        }
      });
      setTimeout(() => {
        masterGain.disconnect();
      }, 1100);
    },
    gainNode: masterGain
  };
};

export const ScriptSegmentCard: React.FC<ScriptSegmentCardProps> = ({ segment, isLast, tone, voiceProfile, onShare }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [audioDuration, setAudioDuration] = useState(0);
  
  // Music State
  const [isBgMusicOn, setIsBgMusicOn] = useState(true);
  const [bgMusicVolume, setBgMusicVolume] = useState(0.15);
  
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bgMusicControlRef = useRef<{ stop: () => void, gainNode: GainNode } | null>(null);
  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(segment.visual);
  const [showPromptInput, setShowPromptInput] = useState(false);

  // Derived state for subtitles
  const words = segment.text.split(' ');
  const currentWordIndex = Math.min(
    Math.floor((progress / 100) * words.length),
    words.length - 1
  );

  useEffect(() => {
    setCustomPrompt(segment.visual);
    setImageSrc(null);
    if (isPlaying) stopAudio();
    setAudioBuffer(null);
    setAudioDuration(0);
    setProgress(0);
    setShowPromptInput(false);
  }, [segment]);

  useEffect(() => {
    return () => {
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch (e) {}
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (bgMusicControlRef.current) bgMusicControlRef.current.stop();
      if (activeStopCallback === stopAudio) activeStopCallback = null;
    };
  }, []);

  // Update music volume in real-time
  useEffect(() => {
    if (bgMusicControlRef.current && isPlaying) {
       bgMusicControlRef.current.gainNode.gain.setTargetAtTime(bgMusicVolume, getAudioContext().currentTime, 0.1);
    }
  }, [bgMusicVolume, isPlaying]);

  // Handle dynamic toggling of music while playing
  useEffect(() => {
    if (isPlaying) {
      const ctx = getAudioContext();
      if (isBgMusicOn && !bgMusicControlRef.current) {
        bgMusicControlRef.current = playProceduralAmbience(ctx, tone, bgMusicVolume);
      } else if (!isBgMusicOn && bgMusicControlRef.current) {
        bgMusicControlRef.current.stop();
        bgMusicControlRef.current = null;
      }
    }
  }, [isBgMusicOn, isPlaying, tone]); // bgMusicVolume handled by separate effect

  const stopAudio = () => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch (e) {}
      sourceRef.current = null;
    }
    if (bgMusicControlRef.current) {
      bgMusicControlRef.current.stop();
      bgMusicControlRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsPlaying(false);
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

  const base64ToBytes = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const pcmToAudioBuffer = (data: Uint8Array, ctx: AudioContext): AudioBuffer => {
    const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  };

  const toggleAudio = async () => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();

    if (isPlaying) {
      stopAudio();
      if (activeStopCallback === stopAudio) activeStopCallback = null;
      return;
    }

    if (activeStopCallback) activeStopCallback();
    activeStopCallback = stopAudio;

    setIsPlaying(true);

    try {
      let buffer = audioBuffer;

      if (!buffer) {
        setIsLoadingAudio(true);
        const voiceOverride = voiceProfile?.voiceName;
        const base64Audio = await generateSpeech(segment.text, tone, voiceOverride);
        const pcmBytes = base64ToBytes(base64Audio);
        buffer = pcmToAudioBuffer(pcmBytes, ctx);
        setAudioBuffer(buffer);
        setAudioDuration(buffer.duration);
        setIsLoadingAudio(false);
      } else {
        setAudioDuration(buffer.duration);
      }

      // Start Background Ambience (if on)
      if (isBgMusicOn) {
        bgMusicControlRef.current = playProceduralAmbience(ctx, tone, bgMusicVolume);
      }

      // Start Speech
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      
      source.onended = () => {
        setIsPlaying(false);
        sourceRef.current = null;
        setProgress(100);
        if (bgMusicControlRef.current) {
           bgMusicControlRef.current.stop();
           bgMusicControlRef.current = null;
        }
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (activeStopCallback === stopAudio) activeStopCallback = null;
      };

      startTimeRef.current = ctx.currentTime;
      source.start();
      sourceRef.current = source;
      
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

  return (
    <div className={`relative pl-8 pb-8 ${isLast ? '' : 'border-l-2 border-slate-800'}`}>
      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-900 border-2 border-slate-700 ring-4 ring-slate-950" aria-hidden="true"></div>

      <div className={`bg-slate-900/50 rounded-xl border-l-4 p-5 shadow-lg backdrop-blur-sm hover:bg-slate-800/50 transition-colors ${getBorderColor(segment.label)}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${getBadgeColor(segment.label)}`}>
            {segment.label}
          </span>
          <div className="flex items-center text-slate-400 font-mono text-xs bg-slate-950/50 px-2 py-1 rounded" aria-label={`Timestamp: ${segment.startTime} to ${segment.endTime} seconds`}>
            <Clock className="w-3 h-3 mr-1.5" aria-hidden="true" />
            {segment.startTime}s - {segment.endTime}s
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                <Mic className="w-3 h-3 mr-1.5" aria-hidden="true" />
                Voiceover
              </div>
              <div className="flex items-center gap-3">
                {(audioDuration > 0) && (
                  <span className="text-xs font-mono text-indigo-400" aria-label={`Playback time: ${formatTime(isPlaying ? (audioDuration * progress) / 100 : 0)} of ${formatTime(audioDuration)}`}>
                    {formatTime(isPlaying ? (audioDuration * progress) / 100 : 0)} / {formatTime(audioDuration)}
                  </span>
                )}
                <button
                  onClick={toggleAudio}
                  disabled={isLoadingAudio}
                  aria-label={isPlaying ? "Stop audio preview" : "Play audio preview"}
                  className={`flex items-center space-x-1 text-xs font-bold uppercase px-2 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isPlaying 
                      ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30' 
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                >
                  {isLoadingAudio ? (
                    <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                  ) : isPlaying ? (
                    <Pause className="w-3 h-3 fill-current" aria-hidden="true" />
                  ) : (
                    <Play className="w-3 h-3 fill-current" aria-hidden="true" />
                  )}
                  <span>{isLoadingAudio ? 'Loading...' : isPlaying ? 'Stop' : 'Preview'}</span>
                </button>
              </div>
            </div>

            {/* Background Music Controls */}
            <div className="flex items-center justify-end gap-3 mb-3 px-1">
               <div className="flex items-center bg-slate-950/50 rounded-lg p-1 gap-2 border border-slate-800/50">
                  <button 
                    onClick={() => setIsBgMusicOn(!isBgMusicOn)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500 ${isBgMusicOn ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-500 hover:text-slate-400'}`}
                    title="Toggle Background Music"
                    aria-pressed={isBgMusicOn}
                    aria-label="Toggle background music"
                  >
                    <Music className="w-3 h-3" aria-hidden="true" />
                    <span className="hidden sm:inline">{isBgMusicOn ? 'Music On' : 'Music Off'}</span>
                  </button>
                  
                  {isBgMusicOn && (
                    <div className="flex items-center gap-2 pr-2 border-l border-slate-800 pl-2">
                      <Volume2 className="w-3 h-3 text-slate-500" aria-hidden="true" />
                      <input 
                        type="range" 
                        min="0" 
                        max="0.5" 
                        step="0.01" 
                        value={bgMusicVolume}
                        onChange={(e) => setBgMusicVolume(parseFloat(e.target.value))}
                        className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        aria-label="Music Volume"
                        aria-valuemin={0}
                        aria-valuemax={50}
                        aria-valuenow={bgMusicVolume * 100}
                      />
                    </div>
                  )}
               </div>
            </div>

            {/* Progress Bar */}
            {(isPlaying || (audioBuffer && progress > 0)) && (
              <div 
                className="w-full h-1 bg-slate-800 rounded-full mb-3 overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
              >
                 <div 
                   className="h-full bg-indigo-500 transition-all duration-100 ease-linear"
                   style={{ width: `${progress}%` }}
                 />
              </div>
            )}

            <p className="text-lg leading-relaxed text-slate-200 font-medium">
              "{segment.text}"
            </p>
            
            {/* Subtitles */}
            {(isPlaying || progress > 0) && (
               <div 
                 className="mt-4 bg-black/80 rounded-xl p-4 border border-slate-700/50 relative overflow-hidden animate-in fade-in zoom-in-95 duration-300"
                 aria-hidden="true" // Hidden from SR as main text is already read
               >
                  <div className="absolute top-2 left-3 flex items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <Captions className="w-3 h-3 mr-1" aria-hidden="true" />
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

          {/* Visual Cue Section */}
          <div className="bg-slate-950/30 rounded-lg p-3 border border-white/5">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
                <Video className="w-3 h-3 mr-1.5" aria-hidden="true" />
                Visual Cue
              </div>
               {!imageSrc && (
                <div className="flex items-center gap-2">
                  <button
                     onClick={() => setShowPromptInput(!showPromptInput)}
                     disabled={isGeneratingImage}
                     aria-label={showPromptInput ? "Close visual prompt editor" : "Edit visual prompt"}
                     aria-expanded={showPromptInput}
                     className={`p-1.5 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${showPromptInput ? 'bg-slate-800 text-indigo-400' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    onClick={handleGenerateImage}
                    disabled={isGeneratingImage}
                    className={`flex items-center space-x-1 text-xs font-bold uppercase px-2 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                      isGeneratingImage 
                        ? 'bg-slate-800 text-slate-500' 
                        : 'bg-teal-500/10 text-teal-400 hover:bg-teal-500/20'
                    }`}
                  >
                    {isGeneratingImage ? (
                      <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <ImageIcon className="w-3 h-3" aria-hidden="true" />
                    )}
                    <span>{isGeneratingImage ? 'Generating...' : 'Generate Visual'}</span>
                  </button>
                </div>
               )}
            </div>

            {showPromptInput && !imageSrc && (
              <div className="mb-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <label htmlFor={`visual-prompt-${segment.startTime}`} className="sr-only">Edit Visual Prompt</label>
                <textarea
                  id={`visual-prompt-${segment.startTime}`}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                  rows={3}
                  placeholder="Describe the visual..."
                />
              </div>
            )}
            
            {imageSrc && (
              <div className="mb-3 rounded-lg overflow-hidden border border-slate-700 relative group bg-black">
                 <img 
                    src={imageSrc} 
                    alt={`Generated visual for segment: ${customPrompt}`} 
                    className="w-full h-auto object-cover max-h-80 mx-auto" 
                 />
                 <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setImageSrc(null)}
                      className="bg-black/60 hover:bg-black/80 text-white px-2 py-1 rounded text-xs font-bold backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-white"
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

          {/* Share Options */}
          {segment.label.toUpperCase() === 'CTA' && (
            <div className="mt-4 pt-4 border-t border-slate-800/50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Share Script
                </span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => onShare?.('twitter')}
                    aria-label="Share on Twitter"
                    className="flex items-center gap-1.5 bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 text-[#1DA1F2] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors group focus:outline-none focus:ring-2 focus:ring-[#1DA1F2]"
                  >
                    <Twitter className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" aria-hidden="true" />
                    Tweet
                  </button>
                  <button 
                    onClick={() => onShare?.('email')}
                    aria-label="Share via Email"
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors group focus:outline-none focus:ring-2 focus:ring-slate-500"
                  >
                    <Mail className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" aria-hidden="true" />
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