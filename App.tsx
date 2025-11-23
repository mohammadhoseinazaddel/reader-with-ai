import React, { useState, useRef, useEffect } from 'react';
import { Monitor, Upload, RefreshCw, Volume2, XCircle, Loader2, StopCircle, Mic, Share2, Play } from 'lucide-react';
import { AppState } from './types';
import { generateSpeechFromSelection } from './services/geminiService';
import { CropOverlay } from './components/CropOverlay';
import { Button } from './components/Button';
import { audioBufferToWav } from './utils/audioUtils';

const voices = [
  { id: 'Kore', label: 'Kore (Female - Balanced)' },
  { id: 'Zephyr', label: 'Zephyr (Female - Soft)' },
  { id: 'Puck', label: 'Puck (Male - Neutral)' },
  { id: 'Charon', label: 'Charon (Male - Deep)' },
  { id: 'Fenrir', label: 'Fenrir (Male - Strong)' },
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Audio Context on user interaction
  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const reset = () => {
    stopAudio();
    setState(AppState.IDLE);
    setCapturedImage(null);
    setAudioBuffer(null);
    setErrorMsg(null);
  };

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.onended = null; // Prevent triggering state change loop
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleStopUser = () => {
    stopAudio();
    setState(AppState.FINISHED);
  };

  const handleScreenShare = async () => {
    initAudio();
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as any,
        audio: false
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;

      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          resolve();
        };
      });

      await video.play();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/png');
        setCapturedImage(base64);
        setState(AppState.CROPPING);
      }

      stream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    } catch (err: any) {
      console.error("Screen share failed", err);
      
      let message = "دسترسی به صفحه نمایش امکان‌پذیر نیست یا لغو شد. لطفا از گزینه آپلود استفاده کنید.";
      
      if (err.name === 'NotAllowedError') {
         message = "شما اجازه دسترسی به صفحه نمایش را ندادید.";
      } else if (err.toString().includes("permissions policy")) {
         message = "مرورگر یا محیط اجرا اجازه ضبط صفحه را نمی‌دهد (خطای Policy). لطفا از دکمه آپلود استفاده کنید.";
      }

      setErrorMsg(message);
      setState(AppState.ERROR);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    initAudio();
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setCapturedImage(ev.target.result as string);
          setState(AppState.CROPPING);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleProcessing = async (croppedBase64: string) => {
    setState(AppState.PROCESSING);
    setCapturedImage(null);
    
    try {
      const buffer = await generateSpeechFromSelection(croppedBase64, selectedVoice);
      setAudioBuffer(buffer);
      playAudio(buffer);
    } catch (err: any) {
      console.error(err);
      const message = err.message || "متاسفانه در پردازش تصویر مشکلی پیش آمد.";
      setErrorMsg(message);
      setState(AppState.ERROR);
    }
  };

  const playAudio = (buffer: AudioBuffer) => {
    if (!audioContextRef.current) initAudio();
    stopAudio();

    const ctx = audioContextRef.current!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      setIsPlaying(false);
      setState(AppState.FINISHED);
    };
    sourceNodeRef.current = source;
    source.start(0);
    setIsPlaying(true);
    setState(AppState.PLAYING);
  };

  const handleShare = async () => {
    if (!audioBuffer) return;
    try {
      const blob = audioBufferToWav(audioBuffer);
      const file = new File([blob], 'screen-reader-audio.wav', { type: 'audio/wav' });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'صوت خوانده شده',
          text: 'این متن توسط هوش مصنوعی ScreenReader خوانده شده است.',
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'screen-reader-audio.wav';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-50 font-sans">
      
      {/* Header */}
      <header className="w-full max-w-2xl mx-auto flex justify-between items-center p-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Volume2 className="text-white w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400" dir="ltr">
            ScreenReader AI
          </h1>
        </div>
        {state !== AppState.IDLE && (
          <button onClick={reset} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition">
            <RefreshCw className="w-5 h-5 text-slate-300" />
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-2xl mx-auto flex-1 flex flex-col justify-center items-center px-6">
        
        {/* State: IDLE */}
        {state === AppState.IDLE && (
          <div className="flex flex-col gap-6 w-full animate-fade-in">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white mb-3">متن‌خوان هوشمند</h2>
              <p className="text-slate-400 text-lg">قسمتی از صفحه را انتخاب کنید تا برایتان بخوانم</p>
            </div>

            {/* Voice Selection */}
            <div className="w-full bg-slate-900/50 p-4 rounded-xl border border-slate-800">
              <label className="text-slate-400 text-sm mb-2 flex items-center gap-2">
                <Mic className="w-4 h-4" />
                انتخاب صدای گوینده
              </label>
              <div className="relative">
                 <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-xl p-3 pl-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                    dir="ltr"
                 >
                    {voices.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                 </select>
                 <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                   <Volume2 className="w-4 h-4 text-slate-500" />
                 </div>
              </div>
            </div>

            <Button 
              onClick={handleScreenShare} 
              icon={<Monitor />} 
              className="w-full hidden md:flex"
            >
              انتخاب صفحه نمایش (کامپیوتر)
            </Button>

            <div className="relative w-full">
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                icon={<Upload />} 
                variant="secondary"
                className="w-full"
              >
                آپلود اسکرین‌شات / عکس
              </Button>
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </div>
            
            <p className="text-xs text-center text-slate-500 mt-2">
              نکته: در موبایل، ابتدا اسکرین‌شات بگیرید و سپس دکمه آپلود را بزنید.
            </p>
          </div>
        )}

        {/* State: PROCESSING */}
        {state === AppState.PROCESSING && (
          <div className="flex flex-col items-center gap-6 animate-pulse">
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
            <h3 className="text-xl text-white font-medium">در حال خواندن تصویر...</h3>
            <p className="text-slate-400">هوش مصنوعی در حال تحلیل متن است</p>
          </div>
        )}

        {/* State: PLAYING */}
        {state === AppState.PLAYING && (
          <div className="flex flex-col items-center gap-8 w-full">
            <div className="w-32 h-32 rounded-full bg-blue-500/10 flex items-center justify-center relative">
              <div className="absolute inset-0 rounded-full border-4 border-blue-500/30 animate-ping"></div>
              <Volume2 className="w-12 h-12 text-blue-400" />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white mb-2">در حال پخش</h3>
              <p className="text-slate-400">صدا توسط مدل Gemini تولید شده است</p>
              <p className="text-slate-500 text-sm mt-1" dir="ltr">{selectedVoice}</p>
            </div>
            <div className="flex gap-4">
               <Button onClick={handleStopUser} variant="danger" icon={<StopCircle />}>
                 توقف
               </Button>
            </div>
          </div>
        )}

        {/* State: FINISHED (Replay/Share) */}
        {state === AppState.FINISHED && (
          <div className="flex flex-col items-center gap-8 w-full">
            <div className="w-32 h-32 rounded-full bg-slate-800 flex items-center justify-center">
              <Volume2 className="w-12 h-12 text-slate-400" />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white mb-2">پایان پخش</h3>
              <p className="text-slate-400">می‌توانید فایل صوتی را ذخیره کنید یا دوباره گوش دهید</p>
            </div>
            
            <div className="flex flex-col w-full gap-3 max-w-sm">
               <div className="flex gap-3 w-full">
                 {audioBuffer && (
                   <Button onClick={() => playAudio(audioBuffer)} variant="primary" icon={<Play />} className="flex-1">
                     پخش مجدد
                   </Button>
                 )}
                 <Button onClick={handleShare} variant="secondary" icon={<Share2 />} className="flex-1">
                   اشتراک / دانلود
                 </Button>
               </div>
               <Button onClick={reset} variant="secondary" className="bg-slate-800 border-none hover:bg-slate-700">
                 انتخاب تصویر جدید
               </Button>
            </div>
          </div>
        )}

        {/* State: ERROR */}
        {state === AppState.ERROR && (
          <div className="flex flex-col items-center gap-6 text-center">
             <XCircle className="w-16 h-16 text-red-500" />
             <p className="text-white text-lg px-4">{errorMsg}</p>
             <Button onClick={reset}>بازگشت</Button>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="w-full text-center py-8 text-slate-600 text-sm" dir="ltr">
        Powered by Google Gemini 2.5 Flash
      </footer>

      {/* Overlays */}
      {state === AppState.CROPPING && capturedImage && (
        <CropOverlay 
          imageSrc={capturedImage}
          onConfirm={handleProcessing}
          onCancel={reset}
        />
      )}

    </div>
  );
};

export default App;