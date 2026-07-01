/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, ShieldAlert, Sparkles, Terminal, ArrowRight } from 'lucide-react';
import { CallStatus, AgentConfig } from '../types';

interface CallInterfaceProps {
  status: CallStatus;
  onStartCall: () => void;
  handleDisconnect: () => void;
  activeTranscript: string;
  onSendTextOverride: (text: string) => void;
  config: AgentConfig;
  errorMsg: string | null;
  mode: 'real' | 'simulation';
  onChangeMode: (mode: 'real' | 'simulation') => void;
  micPermission: 'pending' | 'granted' | 'denied';
  wsRef?: React.MutableRefObject<WebSocket | null>;
  micStreamRef?: React.MutableRefObject<MediaStream | null>;
  inputContextRef?: React.MutableRefObject<AudioContext | null>;
  outputContextRef?: React.MutableRefObject<AudioContext | null>;
  audioQueueRef?: React.MutableRefObject<Float32Array[]>;
  activeAudioSourceRef?: React.MutableRefObject<AudioBufferSourceNode | null>;
  setIsConnected?: (val: boolean) => void;
  setStatus?: (val: CallStatus) => void;
  onTestEscalation?: () => void;
  transcriptEntries?: Array<{
    id: number;
    role: 'user' | 'agent' | 'tool';
    text: string;
    timestamp: number;
    toolName?: string;
    toolArgs?: any;
    toolResult?: any;
    mcpServer?: string;
  }>;
}

export default function CallInterface({
  status,
  onStartCall,
  handleDisconnect,
  activeTranscript,
  onSendTextOverride,
  config,
  errorMsg,
  mode,
  onChangeMode,
  micPermission,
  wsRef,
  micStreamRef,
  inputContextRef,
  outputContextRef,
  audioQueueRef,
  activeAudioSourceRef,
  setIsConnected,
  setStatus,
  onTestEscalation,
  transcriptEntries
}: CallInterfaceProps) {
  const [inputText, setInputText] = useState('');
  const [volLevel, setVolLevel] = useState(70);
  const [micState, setMicState] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Generate dynamic canvas waveform animation based on call status
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let offset = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2.5;

      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#3b82f6'); // Royal Blue
      gradient.addColorStop(0.5, '#60a5fa'); // Light Blue
      gradient.addColorStop(1, '#2563eb'); // Deep Blue

      ctx.strokeStyle = gradient;
      ctx.beginPath();

      const numBars = 40;
      const barWidth = canvas.width / numBars;

      for (let i = 0; i < numBars; i++) {
        let amplitude = 0;
        if (status === 'speaking') {
          // Large undulating server talking waves
          amplitude = Math.sin(i * 0.3 + offset) * 16 + Math.cos(i * 0.15 - offset * 1.5) * 8 + 20;
        } else if (status === 'listening') {
          // Smaller rapid user mic wave simulation
          amplitude = Math.sin(i * 0.6 + offset * 3) * 8 + 4;
        } else if (status === 'connecting') {
          // Rotating loop logic
          amplitude = Math.sin(i * 0.1 + offset * 5) * 3 + 2;
        } else if (status === 'connected') {
          // Ambient static breathing wave
          amplitude = Math.sin(i * 0.15 + offset * 0.5) * 3 + 1;
        }

        // Apply visual margin constraints
        const x = i * barWidth;
        const centerY = canvas.height / 2;
        ctx.lineTo(x, centerY + amplitude / 2);
        ctx.lineTo(x, centerY - amplitude / 2);
      }

      ctx.stroke();
      offset += 0.08;
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [status]);

  const handleSubmitOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendTextOverride(inputText.trim());
    setInputText('');
  };

  const getStatusColor = () => {
    switch (status) {
      case 'disconnected': return 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750';
      case 'connecting': return 'bg-amber-950 text-amber-400 border-amber-600 animate-pulse';
      case 'connected': return 'bg-blue-950/40 text-blue-400 border-blue-500/40';
      case 'listening': return 'bg-blue-950 text-blue-400 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.35)]';
      case 'speaking': return 'bg-blue-600 text-white border-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.4)]';
      case 'errored': return 'bg-rose-950 text-rose-400 border-rose-500';
      default: return 'bg-slate-800 border-slate-700 text-slate-400';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl relative overflow-hidden select-none">
      
      {/* Decorative Top Mesh Grid representing custom terminal interfaces */}
      <div className="absolute inset-x-0 top-0 h-32 bg-grid-dense opacity-[0.03] pointer-events-none"></div>

      {/* Mode Control Bar */}
      <div className="flex items-center justify-between mb-6 z-10">
        <div className="flex items-center space-x-2">
          <Terminal id="term-icon" className="w-4 h-4 text-blue-500" />
          <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-slate-400">Operational Mode</span>
        </div>
        
        {/* Toggle Mode Segment */}
        <div className="flex bg-slate-950 p-1 border border-slate-800 rounded-lg gap-1">
          <button
            type="button"
            onClick={() => {
              onChangeMode('real');
              if (status !== 'disconnected') handleDisconnect();
            }}
            className={`px-2 py-1 text-[9px] font-mono font-bold rounded uppercase tracking-wider transition-all duration-200 ${
              mode === 'real'
                ? 'text-blue-400 bg-blue-950/40 border border-blue-900/40'
                : 'text-slate-500 hover:text-slate-300 border border-transparent'
            }`}
          >
            Real WS
          </button>
          <button
            type="button"
            onClick={() => {
              onChangeMode('simulation');
              if (status !== 'disconnected') handleDisconnect();
            }}
            className={`px-2 py-1 text-[9px] font-mono font-bold rounded uppercase tracking-wider transition-all duration-200 ${
              mode === 'simulation'
                ? 'text-blue-400 bg-blue-950/40 border border-blue-900/40'
                : 'text-slate-500 hover:text-slate-300 border border-transparent'
            }`}
          >
            Simulation
          </button>
        </div>
      </div>

      {/* Call Telephony Details */}
      <div className="flex flex-col space-y-1 mb-6 text-center border-b border-slate-800 pb-5 z-10">
        <h2 className="text-xs font-mono font-bold tracking-widest text-slate-500 uppercase">Logistic Inbound Desk</h2>
        <p className="font-mono text-lg text-blue-400 font-bold tracking-widest">{config.inboundPhoneNumber}</p>
        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest leading-none">Inbound Router Interface</span>
      </div>

      {/* Core Microphone HUD Screen */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-4 z-10">
        
        {/* Microphone Permission Status Indicator */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono select-none">
          <Mic className={`w-3.5 h-3.5 ${
            micPermission === 'granted' ? 'text-emerald-400' :
            micPermission === 'denied' ? 'text-rose-500 animate-pulse' : 'text-slate-400 animate-pulse'
          }`} />
          <span className="text-slate-500 font-medium tracking-wide">Mic Permission: </span>
          {micPermission === 'granted' ? (
            <span className="text-emerald-400 font-bold uppercase tracking-wider">Granted</span>
          ) : micPermission === 'denied' ? (
            <span className="text-rose-500 font-bold uppercase tracking-wider">Denied</span>
          ) : (
            <span className="text-slate-500 font-medium uppercase tracking-wider">Awaiting Stream</span>
          )}
        </div>

        {/* Large Glowing Status Ring */}
        <div className="relative flex items-center justify-center">
          
          {/* Animated Background Pulsing Aura */}
          {status !== 'disconnected' && (
            <div className={`absolute -inset-6 rounded-full filter blur-xl opacity-20 transition-all duration-700 ${
              status === 'speaking' ? 'bg-blue-500 scale-125' : 
              status === 'listening' ? 'bg-blue-400' :
              status === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
            }`}></div>
          )}

          {/* Actual Circular Trigger Button */}
          <button
            onClick={status === 'disconnected' || status === 'errored' ? onStartCall : handleDisconnect}
            className={`w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-300 transform active:scale-95 ${getStatusColor()} border-slate-900/60 shadow-lg pointer-events-auto z-[9999]`}
            style={{ pointerEvents: 'all', zIndex: 9999 }}
          >
            {status === 'disconnected' || status === 'errored' ? (
              <>
                <Phone className="w-8 h-8 text-white mb-1.5 animate-pulse" />
                <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-white">TAP TO CALL</span>
              </>
            ) : (
              <>
                <PhoneOff className="w-8 h-8 text-neutral-100 mb-1.5" />
                <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-neutral-200">DISCONNECT</span>
              </>
            )}
          </button>
        </div>

        {/* Current Call State readout */}
        <div className="text-center space-y-1">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">TRANSCEIVER HUD LINK</p>
          <p className={`text-base font-sans font-bold tracking-widest uppercase ${
            status === 'speaking' ? 'text-blue-400' :
            status === 'listening' ? 'text-blue-300' :
            status === 'connected' ? 'text-emerald-400' :
            status === 'connecting' ? 'text-amber-500 animate-pulse' : 'text-slate-400'
          }`}>
             {status === 'speaking' ? 'Agent is speaking...' : status}
          </p>
        </div>

        {/* Test Outbound Escalation Button */}
        {onTestEscalation && (
          <button
            onClick={onTestEscalation}
            className="px-4 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-600/30 rounded-lg text-[10px] font-mono font-bold tracking-wider uppercase transition-all"
          >
            ⚡ Test Escalation
          </button>
        )}

        {/* Visualized Audio Waveform Box */}
        <div className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center">
          <div className="flex items-center justify-between w-full mb-1.5">
            <span className="font-mono text-[9px] text-slate-500 uppercase tracking-widest">DEMODULATOR STREAM</span>
            {status !== 'disconnected' && (
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
            )}
          </div>
          <canvas ref={canvasRef} width={280} height={50} className="w-full h-12 rounded opacity-90"></canvas>
        </div>

      </div>

      {/* Continuous Sub-Session Live Transcript */}
      <div className="mt-4 bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col space-y-2 select-text z-10">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></span> Live Audio Transcript
          </span>
          {status !== 'disconnected' && status !== 'connecting' && (
            <span className="text-[9px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">VAD ACTIVE</span>
          )}
        </div>
        
        <div className="h-16 overflow-y-auto text-xs text-slate-300 font-mono italic pr-1 bg-slate-950 p-2 rounded border border-slate-800">
          {activeTranscript || (
            <span className="text-slate-500 tracking-wide font-sans">
              [No incoming speech detected. Please initiate support call...]
            </span>
          )}
        </div>
      </div>

      {/* Operator Text Override / Console Bypass Section */}
      <div className="mt-4 border-t border-slate-800 pt-4 z-10">
        <span className="font-mono text-[9px] text-slate-500 uppercase tracking-widest mb-2 block">Developer Keypad Bypass (Iframe friendly)</span>
        <form onSubmit={handleSubmitOverride} className="relative flex items-center">
          <input
            type="text"
            placeholder="Type speech bypass query here..."
            disabled={status === 'disconnected' || status === 'connecting'}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg text-xs font-mono py-2.5 pl-3 pr-10 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={status === 'disconnected' || status === 'connecting' || !inputText.trim()}
            className="absolute right-1 text-blue-500 hover:text-blue-400 p-1.5 disabled:text-slate-700 cursor-pointer disabled:cursor-not-allowed"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Physical Line Knobs for operator look */}
      <div className="mt-4 border-t border-slate-800 pt-4 flex justify-between text-xs font-mono text-slate-500 z-10">
        <div className="flex items-center space-x-2">
          <Volume2 className="w-3.5 h-3.5 text-slate-400" />
          <span>AUDIO LEVEL: {volLevel}%</span>
        </div>
        <div className="flex items-center space-x-1">
          <button 
            type="button" 
            onClick={() => setMicState(!micState)} 
            className={`p-1 rounded hover:bg-slate-800 ${micState ? 'text-slate-400' : 'text-rose-500 bg-rose-950/20'}`}
          >
            {micState ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Global Live Transceiver Error Reporting Banner */}
      {errorMsg && (
        <div className="absolute inset-x-0 bottom-1 mx-4 bg-rose-950/90 border border-rose-800/80 text-rose-300 p-2.5 rounded-lg flex items-start gap-2 text-[11px] animate-bounce z-20 font-mono shadow-2xl">
          <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block uppercase tracking-wide text-rose-200">Gateway Error:</span>
            <span className="block mb-1">{errorMsg}</span>
            {(errorMsg.toLowerCase().includes('key') || errorMsg.toLowerCase().includes('handshake') || errorMsg.toLowerCase().includes('credential')) && (
              <span className="text-[10px] text-amber-400 font-semibold block mt-1.5 leading-normal border-t border-rose-900/60 pt-1.5">
                💡 **Running locally?** Make sure you copied <code className="bg-rose-950 px-1 py-0.5 rounded border border-rose-800/50 font-mono">.env.example</code> to <code className="bg-rose-950 px-1 py-0.5 rounded border border-rose-800/50 font-mono">.env</code> and filled in your real <code className="bg-rose-950 px-1 py-0.5 rounded border border-rose-800/50 font-mono">GEMINI_API_KEY</code>. You can also toggle the mode to **Simulation** above to run the AI voice call without an API key!
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
