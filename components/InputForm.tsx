import React from 'react';
import { Tone } from '../types';
import { TONES } from '../constants';
import { Sparkles, Zap, Clock } from 'lucide-react';

interface InputFormProps {
  topic: string;
  setTopic: (t: string) => void;
  tone: Tone;
  setTone: (t: Tone) => void;
  duration: number;
  setDuration: (d: number) => void;
  onGenerate: () => void;
  isLoading: boolean;
}

export const InputForm: React.FC<InputFormProps> = ({
  topic,
  setTopic,
  tone,
  setTone,
  duration,
  setDuration,
  onGenerate,
  isLoading
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Topic Input - Full Width on mobile, Spans 2 cols on desktop if needed, but here we fit 3 items */}
        <div className="md:col-span-2 space-y-2">
          <label className="block text-sm font-medium text-slate-400">Topic</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., Anxiety Relief, Productivity Hack, Coding Tips"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            disabled={isLoading}
          />
        </div>

        {/* Tone Select */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-400">Tone & Style</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as Tone)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none transition-all"
            disabled={isLoading}
          >
            {TONES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Duration Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="block text-sm font-medium text-slate-400">Duration</label>
            <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded">
              {duration}s
            </span>
          </div>
          <div className="relative h-11 flex items-center">
            <input
              type="range"
              min="30"
              max="60"
              step="1"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={isLoading || !topic.trim()}
        className={`w-full mt-6 group relative flex items-center justify-center py-4 px-6 rounded-lg font-bold text-white overflow-hidden transition-all ${
          isLoading 
            ? 'bg-slate-800 cursor-not-allowed' 
            : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg hover:shadow-indigo-500/25'
        }`}
      >
        {isLoading ? (
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span>Constructing Viral Hook...</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            <span>Generate {duration}s Script</span>
            <Zap className="w-4 h-4 opacity-50" />
          </div>
        )}
      </button>
    </div>
  );
};