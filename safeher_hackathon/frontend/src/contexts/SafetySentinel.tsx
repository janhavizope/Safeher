import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface SafetySentinelContextType {
  loudness: number; // 0 to 100
  isListening: boolean;
  isShaking: boolean;
  setMonitoring: (active: boolean) => void;
  triggerEmergency: (reason: string) => Promise<void>;
  isMonitoring: boolean;
}

const SafetySentinelContext = createContext<SafetySentinelContextType | undefined>(undefined);

export const SafetySentinelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loudness, setLoudness] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  
  const submitIncident = trpc.incidents.submit.useMutation();
  
  // Refs for logic
  const voiceCounter = useRef<{ word: string; count: number; lastTime: number }>({ word: "", count: 0, lastTime: 0 });
  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);

  /**
   * Trigger SOS
   */
  const triggerEmergency = async (reason: string) => {
    try {
      // Get current location
      navigator.geolocation.getCurrentPosition(async (pos) => {
        await submitIncident.mutateAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          description: `[AUTOMATED SOS] Triggered by ${reason}. User may be in immediate distress.`,
          severity: "critical",
          incidentType: "other",
          reportedAt: new Date(),
        });
        
        toast.error("🚨 SOS SIGNAL SENT");
        toast("Automatic alarm triggered by " + reason + ". Authorities and nearby volunteers notified.");
      }, (err) => {
        console.error("Location access denied for SOS", err);
        // Still submit if possible with dummy loc or last known if we had it
      });
    } catch (err) {
      console.error("SOS Trigger failed:", err);
    }
  };

  /**
   * Loudness Detection (Volume Meter)
   */
  useEffect(() => {
    if (!isMonitoring || typeof window === "undefined") return;

    let animationFrame: number;
    let stream: MediaStream | null = null;

    const startAudio = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        audioContextRef.current = audioCtx;

        const checkVolume = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
          const average = sum / bufferLength;
          // Scale for display (average is 0-255)
          setLoudness(Math.min(100, Math.round((average / 128) * 100)));
          animationFrame = requestAnimationFrame(checkVolume);
        };
        checkVolume();
      } catch (err) {
        console.warn("Microphone access denied for Loudness Meter", err);
      }
    };

    startAudio();
    return () => {
      cancelAnimationFrame(animationFrame);
      audioContextRef.current?.close();
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [isMonitoring]);

  /**
   * Voice Trigger Identification (3-Shout Logic)
   */
  useEffect(() => {
    if (!isMonitoring || typeof window === "undefined") return;

    // Multi-language support (Hindi/English India)
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "hi-IN"; 

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1][0].transcript.toLowerCase();
      const keywords = ["help", "bachao", "madat", "save", "rescue", "emergency"];
      
      const found = keywords.find(k => result.includes(k));
      if (found) {
        const now = Date.now();
        // Counter logic: must repeat 3 times within 10 seconds
        if (voiceCounter.current.word !== found || now - voiceCounter.current.lastTime > 10000) {
          voiceCounter.current = { word: found, count: 1, lastTime: now };
        } else {
          voiceCounter.current.count += 1;
          voiceCounter.current.lastTime = now;
        }

        console.log(`[SafetySentinel] Keyword: ${found}, Count: ${voiceCounter.current.count}`);
        
        if (voiceCounter.current.count >= 3) {
          triggerEmergency(`Voice Trigger (${found} detected 3 times)`);
          voiceCounter.current.count = 0; 
        }
      }
    };

    recognition.onerror = (e: any) => {
      console.error("Speech Recognition Error", e);
      setIsListening(false);
    };
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);
      // Restart if we are still supposed to be monitoring
      if (isMonitoring) {
        try { recognition.start(); } catch {}
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start recognition", e);
    }
    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [isMonitoring]);

  /**
   * Shake Detection
   */
  useEffect(() => {
    if (!isMonitoring || typeof window === "undefined") return;

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;

      const threshold = 25; 
      const totalAcc = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);

      if (totalAcc > threshold && !isShaking) {
        setIsShaking(true);
        triggerEmergency("Device Shaking Detected");
        setTimeout(() => setIsShaking(false), 5000); // Debounce
      }
    };

    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [isMonitoring, isShaking]);

  return (
    <SafetySentinelContext.Provider value={{
      loudness,
      isListening,
      isShaking,
      isMonitoring,
      setMonitoring: setIsMonitoring,
      triggerEmergency
    }}>
      {children}
    </SafetySentinelContext.Provider>
  );
};

export const useSafetySentinel = () => {
  const context = useContext(SafetySentinelContext);
  if (!context) throw new Error("useSafetySentinel must be used within SafetySentinelProvider");
  return context;
};
