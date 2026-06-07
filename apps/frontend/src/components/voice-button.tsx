"use client";

import React, { useState } from "react";
import { Mic, MicOff } from "lucide-react";

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
}

export function VoiceButton({ onTranscript, className = "" }: VoiceButtonProps) {
  const [listening, setListening] = useState(false);

  const toggleListening = () => {
    const SpeechRecognition = 
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Safari.");
      return;
    }

    if (listening) {
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-IN"; // Configured for Indian accents and Tanglish phonetics

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        onTranscript(transcript);
      }
    };

    recognition.onerror = (err: any) => {
      console.warn("Speech recognition error:", err);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  };

  return (
    <button
      type="button"
      onClick={toggleListening}
      className={`touch-active flex items-center justify-center p-2 rounded-xl transition-all duration-200 active:scale-95 ${
        listening 
          ? "bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse" 
          : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
      } ${className}`}
      title={listening ? "Stop listening" : "Start voice input"}
    >
      {listening ? <MicOff className="w-4 h-4 animate-bounce" /> : <Mic className="w-4 h-4" />}
    </button>
  );
}
