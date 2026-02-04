import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, Sparkles, MessageCircle, Image as ImageIcon, User, Send, 
  RefreshCw, ShieldAlert, BookOpen, Music, Smile, Frown, Meh, 
  Activity, Zap, Wind, Pause, Check, X, 
  Users, MessageSquare, LogOut, Plus, Trash2, Calendar, Edit2, Save, Layout, Lightbulb, Search, Settings, MapPin,
  Volume2, Wand2, Radio
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';

// --- CONFIG ---
// FIX: Set empty string to use environment variable
const apiKey = ""; 
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
const GEMINI_TTS_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

const firebaseConfig = {
  apiKey: "AIzaSyAwLMtcyXkGjmL1VKKZB3MCW9xtISCeuAU",
  authDomain: "the-thing-13d1b.firebaseapp.com",
  projectId: "the-thing-13d1b",
  storageBucket: "the-thing-13d1b.firebasestorage.app",
  messagingSenderId: "699215660803",
  appId: "1:699215660803:web:9e63a854a38f9d5511cb36",
  measurementId: "G-N7E87F8QPY"
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'mind-mirror-final-v10'; 

// --- ICONS & CONSTANTS ---
const ArrowRightCircle = ({size}:{size:number}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16l4-4-4-4"/><path d="M8 12h8"/></svg>;

const INITIAL_QUESTIONS = [
  { id: 'energy', question: "Nguồn năng lượng bên trong bạn hiện tại đang ở mức nào?", options: [{ value: 'low', label: "Cạn kiệt, nặng nề", icon: <Wind size={24}/> }, { value: 'medium', label: "Bình ổn, trôi chảy", icon: <Meh size={24}/> }, { value: 'high', label: "Dồi dào, rực cháy", icon: <Zap size={24}/> }] },
  { id: 'emotion', question: "Từ khóa nào chạm đúng vào cảm xúc của bạn lúc này?", options: [{ value: 'happy', label: "Hân hoan", icon: <Smile size={24}/> }, { value: 'anxious', label: "Chênh vênh", icon: <Activity size={24}/> }, { value: 'sad', label: "Trầm lắng", icon: <Frown size={24}/> }, { value: 'angry', label: "Bức bối", icon: <ShieldAlert size={24}/> }, { value: 'creative', label: "Bay bổng", icon: <Sparkles size={24}/> }] },
  { id: 'mindset', question: "Tâm trí bạn đang hướng về đâu?", options: [{ value: 'past', label: "Hoài niệm quá khứ", icon: <Calendar size={24}/> }, { value: 'present', label: "Tập trung hiện tại", icon: <Check size={24}/> }, { value: 'future', label: "Lo nghĩ tương lai", icon: <ArrowRightCircle size={24}/> }] },
  { id: 'topic', question: "Khía cạnh nào đang chiếm trọn suy nghĩ của bạn?", options: [{ value: 'study', label: "Sự nghiệp & Học vấn", icon: <BookOpen size={24}/> }, { value: 'friends', label: "Các mối quan hệ", icon: <Users size={24}/> }, { value: 'self', label: "Hành trình bản thân", icon: <Heart size={24}/> }] }
];

// --- TYPES ---
type EmotionType = 'happy' | 'sad' | 'anxious' | 'neutral' | 'angry' | 'creative';
type AuthMode = 'guest' | 'login' | 'register' | null;

interface UserState {
  emotion: EmotionType;
  topic: string | null;
  mindset?: string;
  name: string;
  username: string;
  bio?: string;
}

interface ChatSession { id: string; title: string; createdAt: any; preview: string; }
interface ChatMessage { id: string; text: string; sender: 'user' | 'ai'; timestamp: any; }
interface Post { id: string; author: string; content: string; emotion: EmotionType; timestamp: number; likes: number; comments: Comment[]; isAiApproved: boolean; }
interface Comment { id: string; author: string; content: string; isAi: boolean; timestamp?: number; }
interface ArtPiece { id: string; author: string; prompt: string; url: string; timestamp: number; emotion?: EmotionType; }
interface GratitudeEntry { id: string; text: string; date: string; }

// --- THEMES ---
const EMOTION_THEMES: Record<EmotionType, { bg: string, sidebar: string, accent: string, text: string, bubble: string, badge: string, fallbackImg: string }> = {
  happy: { bg: 'bg-gradient-to-br from-yellow-50 via-orange-50 to-amber-50', sidebar: 'bg-yellow-100/40', accent: 'bg-amber-500', text: 'text-amber-900', bubble: 'bg-amber-100', badge: 'bg-amber-100 text-amber-700', fallbackImg: 'https://images.unsplash.com/photo-1541535650810-10d26f5c2ab3?w=800&q=80' },
  sad: { bg: 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50', sidebar: 'bg-blue-100/40', accent: 'bg-blue-500', text: 'text-blue-900', bubble: 'bg-blue-100', badge: 'bg-blue-100 text-blue-700', fallbackImg: 'https://images.unsplash.com/photo-1518152006812-edab29b06cc4?w=800&q=80' },
  anxious: { bg: 'bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50', sidebar: 'bg-teal-100/40', accent: 'bg-teal-600', text: 'text-teal-900', bubble: 'bg-teal-100', badge: 'bg-teal-100 text-teal-700', fallbackImg: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=800&q=80' },
  angry: { bg: 'bg-gradient-to-br from-red-50 via-rose-50 to-orange-50', sidebar: 'bg-rose-100/40', accent: 'bg-rose-500', text: 'text-rose-900', bubble: 'bg-rose-100', badge: 'bg-rose-100 text-rose-700', fallbackImg: 'https://images.unsplash.com/photo-1542281286-9e0a16bb7366?w=800&q=80' },
  neutral: { bg: 'bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50', sidebar: 'bg-slate-200/40', accent: 'bg-slate-600', text: 'text-slate-800', bubble: 'bg-slate-100', badge: 'bg-slate-200 text-slate-700', fallbackImg: 'https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=800&q=80' },
  creative: { bg: 'bg-gradient-to-br from-violet-50 via-fuchsia-50 to-pink-50', sidebar: 'bg-fuchsia-100/40', accent: 'bg-fuchsia-600', text: 'text-fuchsia-900', bubble: 'bg-fuchsia-100', badge: 'bg-fuchsia-100 text-fuchsia-700', fallbackImg: 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=800&q=80' },
};

// --- LOGIC ---
const cleanText = (text: string) => text.replace(/<\/?[^>]+(>|$)/g, "").replace(/^\s*>\s?/gm, "").replace(/\(\d+\s*từ\)/gi, "").trim();

// Audio Utils
const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const pcmToWav = (pcmData: Uint8Array, sampleRate: number = 24000) => {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const totalDataLen = pcmData.length;
  const totalLen = totalDataLen + 36;

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalLen, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1 for Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, totalDataLen, true);

  const wavBuffer = new Uint8Array(header.byteLength + pcmData.length);
  wavBuffer.set(new Uint8Array(header), 0);
  wavBuffer.set(pcmData, 44);

  return wavBuffer;
};

// Generic helper for different Gemini modes
const runGemini = async (prompt: string, systemInstruction: string) => {
  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] }
      })
    });
    const data = await response.json();
    return cleanText(data.candidates?.[0]?.content?.parts?.[0]?.text || "....");
  } catch (e) {
    console.error("Gemini Error:", e);
    return "....";
  }
};

const callGeminiAI = async (prompt: string, context?: string): Promise<string> => {
  const system = `Vai trò: Bạn là Hiếu - tri kỷ sâu sắc. Trạng thái user: ${context}. Yêu cầu: Không HTML, không Markdown, không đếm từ. Nói ít hiểu nhiều, thấu cảm.`;
  return runGemini(prompt, system);
};

const callGeminiPolisher = async (draft: string): Promise<string> => {
  const system = `Role: Empathetic Editor. Task: Rewrite the user's social media post to be more poetic, gentle, and grammatically correct, while preserving the original core emotion and meaning. Output ONLY the rewritten text.`;
  return runGemini(draft, system);
};

const callGeminiFutureSelf = async (emotion: string, topic: string): Promise<string> => {
  const system = `Role: The user's Future Self (5 years later). Context: You have overcome the struggles of being ${emotion} about ${topic}. Tone: Reassuring, wise, mysterious but hopeful. Task: Write a short letter (max 50 words) to your past self (current user).`;
  return runGemini("Write the letter now.", system);
};

const generateDailyMessage = async (userState: UserState): Promise<string> => {
  try {
    const prompt = `Viết thông điệp ngắn (dưới 20 từ) cho người cảm thấy ${userState.emotion}, hướng về ${userState.mindset}. Sâu sắc, chữa lành. KHÔNG kèm số từ.`;
    const response = await fetch(GEMINI_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    const data = await response.json();
    return cleanText(data.candidates?.[0]?.content?.parts?.[0]?.text || "Hôm nay là một món quà.");
  } catch (e) { return "Bình yên tại tâm."; }
};

const playTextToSpeech = async (text: string) => {
  try {
    const response = await fetch(GEMINI_TTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Say kindly: ${text}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }
        }
      })
    });
    const data = await response.json();
    const base64Audio = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio) {
      const binaryString = window.atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
      }
      const wavBytes = pcmToWav(bytes);
      // FIX: Use wavBytes directly
      const audioBlob = new Blob([wavBytes], { type: 'audio/wav' }); 
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play().catch(e => console.error("Audio playback failed:", e));
    }
  } catch (e) {
    console.error("TTS Error:", e);
  }
};

const generateImage = async (prompt: string): Promise<string> => {
  const seed = Math.floor(Math.random() * 999999);
  const finalPrompt = `photorealistic, high quality, ${prompt}`;
  const encodedPrompt = encodeURIComponent(finalPrompt); 
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=1024&height=1024&nologo=true&model=flux`;
};

// --- TOAST ---
const Toast = ({ msg, onClose }: { msg: string, onClose: () => void }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return <div className="fixed top-4 right-4 bg-slate-800 text-white px-6 py-3 rounded-xl shadow-2xl z-[100] animate-in slide-in-from-right-10 fade-in duration-300 flex items-center gap-2"><Check size={18} className="text-green-400"/> {msg}</div>
}

// --- HELPER COMPONENTS ---
// FIX: Added explicit interfaces to prevent "implicit any" build errors
interface AuthFormProps {
  onLogin: (u: string, p: string) => void;
  onRegister: (u: string, p: string, n: string) => void;
  onGuest: () => void;
}
const AuthForm = ({onLogin, onRegister, onGuest}: AuthFormProps) => {
  const [isLogin, setIsLogin] = useState(true); const [u, setU] = useState(''); const [p, setP] = useState(''); const [n, setN] = useState('');
  return (
    <>
      {!isLogin && <input value={n} onChange={e=>setN(e.target.value)} placeholder="Tên hiển thị" className="w-full p-4 rounded-2xl bg-white/20 border border-white/30 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 transition-all"/>}
      <input value={u} onChange={e=>setU(e.target.value)} placeholder="Tên đăng nhập" className="w-full p-4 rounded-2xl bg-white/20 border border-white/30 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 transition-all"/>
      <input type="password" value={p} onChange={e=>setP(e.target.value)} placeholder="Mật khẩu" className="w-full p-4 rounded-2xl bg-white/20 border border-white/30 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 transition-all"/>
      <button onClick={()=>isLogin?onLogin(u,p):onRegister(u,p,n)} className="w-full py-4 bg-white text-indigo-900 rounded-2xl font-bold hover:bg-indigo-50 shadow-lg hover:shadow-xl transition-all text-lg mt-4">{isLogin?'Đăng Nhập':'Đăng Ký'}</button>
      <div className="mt-6 text-center">
        <button onClick={()=>setIsLogin(!isLogin)} className="text-white/80 font-bold hover:text-white hover:underline text-sm mb-4 block">{isLogin?'Chưa có tài khoản? Đăng ký ngay':'Đã có tài khoản? Đăng nhập'}</button>
        <button onClick={onGuest} className="text-white/60 hover:text-white text-sm font-medium flex items-center justify-center gap-2 w-full py-2 transition-all"><User size={16}/> Tiếp tục với chế độ Khách</button>
      </div>
    </>
  )
}

interface NavBtnProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label?: string;
  color?: string;
}
const NavBtn = ({active, onClick, icon, label, color}: NavBtnProps) => (
  <button onClick={onClick} className={`p-4 rounded-2xl transition-all duration-300 group relative flex items-center justify-center ${active ? `bg-white shadow-xl scale-110 ${color}` : 'text-slate-400 hover:bg-white/50 hover:text-slate-600'}`}>
    {icon} <span className="absolute left-16 bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap pointer-events-none md:block hidden transform translate-x-2 group-hover:translate-x-0 z-50">{label}</span>
  </button>
);

interface IconButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  active?: boolean;
}
const IconButton = ({onClick, icon, active}: IconButtonProps) => (
  <button onClick={onClick} className={`p-3 rounded-full transition-all duration-300 ${active ? 'bg-indigo-100 text-indigo-600 ring-2 ring-indigo-200 shadow-inner' : 'bg-white/40 text-slate-600 hover:bg-white hover:shadow-md'}`}>{icon}</button>
);

const DailyMessageModal = ({message, onClose}: {message: string, onClose: () => void}) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-500" onClick={onClose}>
    <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in duration-300 relative text-center" onClick={e=>e.stopPropagation()}>
      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-500"><Lightbulb size={32}/></div>
      <h3 className="text-xl font-bold text-slate-800 mb-4">Thông điệp hôm nay</h3>
      <p className="text-slate-600 text-lg font-medium italic leading-relaxed">"{message}"</p>
      <div className="flex justify-center gap-4 mt-8">
        <button onClick={() => playTextToSpeech(message)} className="px-6 py-3 bg-indigo-100 text-indigo-600 rounded-xl font-bold hover:bg-indigo-200 transition-all flex items-center gap-2"><Volume2 size={20}/> Nghe</button>
        <button onClick={onClose} className="px-8 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-all">Đã nhận</button>
      </div>
    </div>
  </div>
);

const BreathingExercise = ({ onClose }: {onClose: () => void}) => {
  const [phase, setPhase] = useState('Hít vào'); const [scale, setScale] = useState(1);
  useEffect(() => {
    const runCycle = () => {
      setPhase('Hít vào'); setScale(1.5); 
      setTimeout(() => { setPhase('Giữ hơi'); setScale(1.5); setTimeout(() => { setPhase('Thở ra'); setScale(1); }, 4000); }, 4000);
    };
    runCycle(); const interval = setInterval(runCycle, 12000); return () => clearInterval(interval);
  }, []);
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[70] flex items-center justify-center p-4 animate-in fade-in duration-500">
      <div className="relative flex flex-col items-center justify-center w-full h-full">
        <button onClick={onClose} className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors"><X size={32}/></button>
        <div className="w-64 h-64 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center shadow-[0_0_100px_rgba(99,102,241,0.5)] transition-all duration-[4000ms] ease-in-out" style={{ transform: `scale(${scale})` }}><div className="text-white text-2xl font-bold animate-pulse">{phase}</div></div>
        <p className="text-white/60 mt-12 text-lg font-medium">Thả lỏng tâm trí...</p>
      </div>
    </div>
  );
};

const GratitudeModal = ({ onClose, onSave, entries, onDelete }: {onClose: () => void, onSave: (t: string) => void, entries: any[], onDelete: (id: string) => void}) => {
  const [t, setT] = useState('');
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
      <div className="bg-white rounded-[2rem] p-8 max-w-lg w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[80vh]">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-300 to-orange-400"></div>
        <div className="flex justify-between mb-6 items-center flex-none"><h3 className="text-2xl font-bold text-amber-700 flex items-center gap-2"><BookOpen/> Nhật Ký Biết Ơn</h3><button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all"><X/></button></div>
        <div className="flex-none space-y-4 mb-4">
          <textarea value={t} onChange={e=>setT(e.target.value)} className="w-full p-5 bg-amber-50/50 rounded-2xl focus:outline-none h-32 border border-amber-100 focus:bg-white focus:ring-2 focus:ring-amber-200 transition-all resize-none text-slate-700 placeholder:text-amber-300" placeholder="Hôm nay bạn biết ơn điều gì?"/>
          <button onClick={()=>{if(t){onSave(t);setT('')}}} className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 shadow-md hover:shadow-lg transition-all transform active:scale-95">Lưu lại khoảnh khắc</button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 min-h-0">{entries.map((e:any)=><div key={e.id} className="p-4 bg-white border border-slate-100 shadow-sm rounded-2xl text-sm flex justify-between items-start group hover:border-amber-200 transition-colors"><div><p className="text-slate-700 leading-relaxed font-medium">{e.text}</p><span className="text-[11px] text-slate-400 mt-1 block font-bold">{e.date}</span></div>
        {/* FIX: Removed opacity-0 so button is visible on mobile */}
        <button onClick={()=>onDelete(e.id)} className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={18}/></button></div>)}</div>
      </div>
    </div>
  );
}

// --- MAIN COMPONENT ---
export default function MindMirrorApp() {
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'art' | 'social' | 'profile'>('chat');
  const [userState, setUserState] = useState<UserState>({ emotion: 'neutral', topic: null, name: 'Bạn', username: 'guest', bio: 'Chưa có tiểu sử...' });

  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [dailyMessage, setDailyMessage] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);

  const [socialPosts, setSocialPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [commentInputs, setCommentInputs] = useState<{[key:string]: string}>({});
  const [isPosting, setIsPosting] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false); // State for polishing post

  // Profile Edit & Features
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempBio, setTempBio] = useState('');
  const [futureLetter, setFutureLetter] = useState<string | null>(null); // State for Future Self letter
  const [isGeneratingFuture, setIsGeneratingFuture] = useState(false);

  const [gallery, setGallery] = useState<ArtPiece[]>([]);
  const [artPrompt, setArtPrompt] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [gratitudeEntries, setGratitudeEntries] = useState<GratitudeEntry[]>([]);
  
  const [showBreathing, setShowBreathing] = useState(false);
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [showGratitude, setShowGratitude] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isAdmin = userState.username === 'admin';

  const showToast = (msg: string) => setToastMsg(msg);

  useEffect(() => { signInAnonymously(auth).catch(console.error); return onAuthStateChanged(auth, setFirebaseUser); }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsubSocial = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'posts'), orderBy('timestamp', 'desc')), (s) => setSocialPosts(s.docs.map(d => ({ id: d.id, ...d.data() } as Post))));
    const unsubGallery = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'arts'), orderBy('timestamp', 'desc')), (s) => setGallery(s.docs.map(d => ({ id: d.id, ...d.data() } as ArtPiece))));

    if (authMode === 'login' && userState.username !== 'guest') {
       const userPath = `artifacts/${appId}/users/${userState.username}`;
       const unsubSessions = onSnapshot(query(collection(db, userPath, 'sessions'), orderBy('createdAt', 'desc')), (s) => {
         const list = s.docs.map(d => ({id: d.id, ...d.data()} as ChatSession));
         setSessions(list);
         if (!currentSessionId && list.length > 0) setCurrentSessionId(list[0].id);
       });
       const unsubGrat = onSnapshot(collection(db, userPath, 'gratitudes'), s => setGratitudeEntries(s.docs.map(d => ({id:d.id,...d.data()} as GratitudeEntry))));
       return () => { unsubSocial(); unsubGallery(); unsubSessions(); unsubGrat(); }
    }
    return () => { unsubSocial(); unsubGallery(); };
  }, [firebaseUser, authMode, userState.username]);

  useEffect(() => {
    if (!currentSessionId || authMode !== 'login') { if (authMode !== 'guest') setMessages([]); return; }
    const unsubMsgs = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userState.username}/sessions/${currentSessionId}/messages`), orderBy('timestamp', 'asc')), (s) => setMessages(s.docs.map(d => ({id: d.id, ...d.data()} as ChatMessage))));
    return () => unsubMsgs();
  }, [currentSessionId, authMode]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isAiThinking]);
  useEffect(() => { 
    if(audioRef.current) {
        if (isPlayingMusic) {
            audioRef.current.play().catch(e => console.log("Music play error (interaction needed?):", e));
        } else {
            audioRef.current.pause(); 
        }
    }
  }, [isPlayingMusic]);

  const handleOnboardingSelect = async (key: keyof UserState, value: any) => {
    const newState = { ...userState, [key]: value };
    setUserState(newState);
    if (onboardingStep < INITIAL_QUESTIONS.length - 1) { setOnboardingStep(prev => prev + 1); } 
    else {
      setHasOnboarded(true);
      const message = await generateDailyMessage(newState);
      setDailyMessage(message);
      if (authMode === 'login') {
        const newSessionRef = await addDoc(collection(db, `artifacts/${appId}/users/${userState.username}/sessions`), { title: "Thông điệp ngày mới", createdAt: serverTimestamp(), preview: "Bắt đầu..." });
        setCurrentSessionId(newSessionRef.id);
        await addDoc(collection(db, `artifacts/${appId}/users/${userState.username}/sessions/${newSessionRef.id}/messages`), { text: message, sender: 'ai', timestamp: serverTimestamp() });
      }
    }
  };

  const handleCreateSession = async () => {
    if (authMode !== 'login') return;
    const newSessionRef = await addDoc(collection(db, `artifacts/${appId}/users/${userState.username}/sessions`), { title: "Đối thoại mới", createdAt: serverTimestamp(), preview: "..." });
    setCurrentSessionId(newSessionRef.id);
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation(); if (!confirm("Xóa dòng suy nghĩ này?")) return;
    await deleteDoc(doc(db, `artifacts/${appId}/users/${userState.username}/sessions`, sessionId));
    if (currentSessionId === sessionId) setCurrentSessionId(null);
    showToast("Đã xóa cuộc trò chuyện");
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const txt = chatInput; setChatInput(''); setIsAiThinking(true);
    if (authMode === 'login') {
      let sessionId = currentSessionId;
      if (!sessionId) {
        const ref = await addDoc(collection(db, `artifacts/${appId}/users/${userState.username}/sessions`), { title: txt.substring(0, 20) + "...", createdAt: serverTimestamp(), preview: txt });
        sessionId = ref.id; setCurrentSessionId(sessionId);
      }
      const sessionPath = `artifacts/${appId}/users/${userState.username}/sessions/${sessionId}`;
      await addDoc(collection(db, `${sessionPath}/messages`), { text: txt, sender: 'user', timestamp: serverTimestamp() });
      updateDoc(doc(db, sessionPath), { preview: txt });
      const reply = await callGeminiAI(txt, userState.emotion);
      await addDoc(collection(db, `${sessionPath}/messages`), { text: reply, sender: 'ai', timestamp: serverTimestamp() });
      updateDoc(doc(db, sessionPath), { preview: reply });
    } else {
      setMessages(p => [...p, {id: Date.now()+'', text: txt, sender: 'user', timestamp: Date.now()}]);
      const reply = await callGeminiAI(txt, userState.emotion);
      setMessages(p => [...p, {id: Date.now()+'1', text: reply, sender: 'ai', timestamp: Date.now()}]);
    }
    setIsAiThinking(false);
  };

  const handlePolishPost = async () => {
    if (!newPostContent.trim()) return;
    setIsPolishing(true);
    const polished = await callGeminiPolisher(newPostContent);
    setNewPostContent(polished);
    setIsPolishing(false);
    showToast("Đã trau chuốt lại câu từ!");
  };

  const handlePost = async () => {
    if (authMode === 'guest') return alert("Đăng nhập để chia sẻ.");
    if (!newPostContent.trim()) return;
    setIsPosting(true);
    const postRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'posts'), { author: userState.name, content: newPostContent, emotion: userState.emotion, timestamp: Date.now(), likes: 0, comments: [], isAiApproved: true });
    setNewPostContent(''); setIsPosting(false);
    const reply = await callGeminiAI(newPostContent, "User vừa đăng bài");
    if((await getDoc(postRef)).exists()) await updateDoc(postRef, { comments: [{ id: 'ai-init', author: 'Hiếu', content: reply, isAi: true, timestamp: Date.now() }] });
    showToast("Đã đăng bài viết mới!");
  };

  const handleSocialInteraction = async (postId: string, type: 'like' | 'comment') => {
    if (authMode === 'guest') return alert("Đăng nhập để tương tác.");
    const postRef = doc(db, 'artifacts', appId, 'public', 'data', 'posts', postId);
    const postSnap = await getDoc(postRef); if (!postSnap.exists()) return;
    const postData = postSnap.data() as Post;
    if (type === 'like') await updateDoc(postRef, { likes: (postData.likes || 0) + 1 });
    else if (type === 'comment') {
      const text = commentInputs[postId]; if (!text?.trim()) return;
      const newComment: Comment = { id: Date.now().toString(), author: userState.name, content: text, isAi: false, timestamp: Date.now() };
      await updateDoc(postRef, { comments: [...(postData.comments || []), newComment] });
      setCommentInputs(p => ({...p, [postId]: ''}));
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!confirm("Xóa bình luận này?")) return;
    const postRef = doc(db, 'artifacts', appId, 'public', 'data', 'posts', postId);
    const postSnap = await getDoc(postRef); if (!postSnap.exists()) return;
    const comments = postSnap.data().comments || [];
    await updateDoc(postRef, { comments: comments.filter((c: Comment) => c.id !== commentId) });
    showToast("Đã xóa bình luận");
  };

  const handleCreateArt = async () => {
    if (!artPrompt.trim()) return;
    if (authMode === 'guest') return alert("Đăng nhập để lưu tác phẩm.");
    setIsDrawing(true);
    const url = await generateImage(artPrompt);
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'arts'), { prompt: artPrompt, url, author: userState.name, timestamp: Date.now(), emotion: userState.emotion });
    setIsDrawing(false); setArtPrompt('');
    showToast("Đã tạo ảnh thành công!");
  };

  const handleGenerateFutureLetter = async () => {
    setIsGeneratingFuture(true);
    const letter = await callGeminiFutureSelf(userState.emotion, userState.topic || "cuộc sống");
    setFutureLetter(letter);
    setIsGeneratingFuture(false);
  };

  const handleDeletePost = async (postId: string) => { if (!confirm("Xóa bài viết?")) return; await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'posts', postId)); showToast("Đã xóa bài viết"); };
  // FIX: Added confirmation logic to deletion
  const handleDeleteGratitude = async (entryId: string) => { if (!confirm("Bạn muốn xóa dòng nhật ký này?")) return; await deleteDoc(doc(db, `artifacts/${appId}/users/${userState.username}/gratitudes`, entryId)); showToast("Đã xóa nhật ký"); };
  
  const startEditingProfile = () => {
    setTempName(userState.name);
    setTempBio(userState.bio || '');
    setIsEditingProfile(true);
  };

  const saveProfile = async () => {
    if (!tempName.trim()) return;
    await updateDoc(doc(db, 'artifacts', appId, 'accounts', userState.username), { name: tempName, bio: tempBio });
    setUserState(prev => ({ ...prev, name: tempName, bio: tempBio }));
    setIsEditingProfile(false);
    showToast("Đã cập nhật hồ sơ");
  };

  const theme = EMOTION_THEMES[userState.emotion];

  if (!authMode) return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-6 font-sans bg-slate-900 bg-[url('https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=2072&auto=format&fit=crop')] bg-cover bg-center`}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
      <div className="relative max-w-md w-full bg-white/10 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl p-10 border border-white/20 animate-in fade-in zoom-in duration-500 overflow-y-auto max-h-full">
        <div className="text-center mb-10"><div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-3xl mx-auto flex items-center justify-center text-white mb-6 shadow-xl transform rotate-3"><Sparkles size={40}/></div><h1 className="text-4xl font-bold text-white mb-2 tracking-tight">MindMirror</h1><p className="text-white/80 font-medium">Soi chiếu nội tâm, tìm về an yên</p></div>
        <div className="space-y-4"><AuthForm onLogin={async(u:string,p:string)=>{const s=await getDoc(doc(db,'artifacts',appId,'accounts',u));if(s.exists()&&s.data().password===p){setUserState(prev=>({...prev,name:s.data().name,username:u, bio: s.data().bio}));setAuthMode('login');}else alert("Thông tin chưa chính xác.");}} onRegister={async(u:string,p:string,n:string)=>{const ref=doc(db,'artifacts',appId,'accounts',u);if((await getDoc(ref)).exists())return alert("Tên đăng nhập đã tồn tại.");await setDoc(ref,{username:u,password:p,name:n, bio: "Người bạn mới của MindMirror"});alert("Chào mừng bạn mới!");}} onGuest={()=>{setAuthMode('guest');setUserState(p=>({...p,name:'Khách',username:'guest'}))}}/></div>
      </div>
    </div>
  );

  if (!hasOnboarded) return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-6 font-sans ${theme.bg} transition-colors duration-1000`}>
      <div className="max-w-md w-full bg-white/80 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl p-10 animate-in fade-in slide-in-from-bottom-4 duration-500 border border-white/60 overflow-y-auto max-h-full">
        <div className="flex justify-between items-center mb-10"><h2 className="text-2xl font-bold text-slate-800 tracking-tight">Thấu Hiểu</h2><div className="flex gap-2">{INITIAL_QUESTIONS.map((_, idx) => (<div key={idx} className={`h-1.5 rounded-full transition-all duration-300 ${idx === onboardingStep ? 'bg-indigo-600 w-8' : idx < onboardingStep ? 'bg-indigo-300 w-2' : 'bg-slate-200 w-2'}`} />))}</div></div>
        <h3 className="text-xl mb-8 font-medium text-slate-700 leading-relaxed text-center">{INITIAL_QUESTIONS[onboardingStep].question}</h3>
        <div className="space-y-4">{INITIAL_QUESTIONS[onboardingStep].options.map((opt) => (<button key={opt.value} onClick={() => handleOnboardingSelect(INITIAL_QUESTIONS[onboardingStep].id as keyof UserState, opt.value)} className="w-full flex items-center gap-5 p-5 rounded-[1.5rem] border border-white/50 bg-white/60 hover:bg-white hover:border-indigo-100 hover:shadow-lg transition-all text-left group transform hover:-translate-y-1"><div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-sm">{opt.icon}</div><span className="font-semibold text-slate-700 group-hover:text-slate-900 text-lg flex-1">{opt.label}</span></button>))}</div>
      </div>
    </div>
  );

  return (
    <div className={`fixed inset-0 ${theme.bg} font-sans transition-colors duration-1000 flex flex-col h-[100dvh]`}>
      <audio ref={audioRef} loop src="https://assets.mixkit.co/music/preview/mixkit-sleepy-cat-135.mp3" onError={(e) => console.log("Audio load error (often due to CORS/network, music skipped)", e)} />
      {showBreathing && <BreathingExercise onClose={() => setShowBreathing(false)} />}
      {showGratitude && <GratitudeModal onClose={() => setShowGratitude(false)} entries={gratitudeEntries} onDelete={handleDeleteGratitude} onSave={async(t: string)=>{ if(authMode==='login') await addDoc(collection(db,`artifacts/${appId}/users/${userState.username}/gratitudes`),{text:t,date:new Date().toLocaleDateString()})}} />}
      {dailyMessage && <DailyMessageModal message={dailyMessage} onClose={() => setDailyMessage(null)} />}
      {toastMsg && <Toast msg={toastMsg} onClose={() => setToastMsg(null)} />}

      <header className={`h-20 px-8 flex items-center justify-between z-30 bg-white/60 backdrop-blur-xl border-b border-white/40 shadow-sm flex-none`}>
        <div className="flex items-center gap-4"><div className={`p-3 rounded-2xl text-white shadow-lg ${theme.accent} transform hover:rotate-12 transition-transform duration-300`}><Sparkles size={24}/></div><div className="flex flex-col"><h1 className="font-bold text-slate-800 text-2xl tracking-tight leading-none">MindMirror</h1><div className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full w-fit mt-1.5 ${theme.badge}`}>{userState.emotion} Mode</div></div></div>
        <div className="flex items-center gap-3"><IconButton onClick={()=>setIsPlayingMusic(!isPlayingMusic)} active={isPlayingMusic} icon={isPlayingMusic?<Pause size={20}/>:<Music size={20}/>} /><IconButton onClick={()=>setShowBreathing(true)} icon={<Wind size={20}/>} /><div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/60 rounded-full text-sm font-bold text-slate-700 border border-white/60 shadow-sm">{userState.name}</div></div>
      </header>

      <div className="flex-1 flex overflow-hidden w-full max-w-[1920px] mx-auto">
        <nav className="hidden md:flex flex-col w-24 bg-white/30 backdrop-blur-xl border-r border-white/40 items-center py-8 gap-8 z-20">
          <NavBtn active={activeTab==='chat'} onClick={()=>setActiveTab('chat')} icon={<MessageCircle size={28}/>} label="Chat" color="text-indigo-600" />
          <NavBtn active={activeTab==='social'} onClick={()=>setActiveTab('social')} icon={<Users size={28}/>} label="Cộng đồng" color="text-teal-600" />
          <NavBtn active={activeTab==='art'} onClick={()=>setActiveTab('art')} icon={<ImageIcon size={28}/>} label="Sáng tạo" color="text-pink-600" />
          <NavBtn active={activeTab==='profile'} onClick={()=>setActiveTab('profile')} icon={<User size={28}/>} label="Cá nhân" color="text-blue-600" />
        </nav>
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-white/90 backdrop-blur-xl border-t border-slate-200 flex justify-around items-center z-50 pb-2">
          <NavBtn active={activeTab==='chat'} onClick={()=>setActiveTab('chat')} icon={<MessageCircle size={24}/>} color="text-indigo-600" />
          <NavBtn active={activeTab==='social'} onClick={()=>setActiveTab('social')} icon={<Users size={24}/>} color="text-teal-600" />
          <NavBtn active={activeTab==='art'} onClick={()=>setActiveTab('art')} icon={<ImageIcon size={24}/>} color="text-pink-600" />
          <NavBtn active={activeTab==='profile'} onClick={()=>setActiveTab('profile')} icon={<User size={24}/>} color="text-blue-600" />
        </nav>

        <main className="flex-1 overflow-hidden relative flex flex-col">
          {activeTab === 'chat' && (
            <div className="flex h-full w-full">
              <div className={`${theme.sidebar} w-80 flex-none border-r border-white/20 hidden lg:flex flex-col backdrop-blur-md transition-colors duration-700`}>
                <div className="p-6 border-b border-white/20"><button onClick={handleCreateSession} className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-white font-bold shadow-lg transition-all hover:opacity-90 active:scale-95 ${theme.accent}`}><Plus size={20}/> Cuộc đối thoại mới</button></div>
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar">
                  {sessions.map(s => (<div key={s.id} onClick={()=>setCurrentSessionId(s.id)} className={`group p-4 rounded-2xl cursor-pointer transition-all border ${currentSessionId===s.id ? 'bg-white border-white/60 shadow-md scale-[1.02]' : 'hover:bg-white/40 border-transparent text-slate-600 hover:scale-[1.01]'}`}><div className="flex justify-between items-start mb-1"><div className="font-bold text-sm truncate text-slate-800 flex-1 pr-2">{s.title}</div><button onClick={(e)=>handleDeleteSession(e, s.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all p-1 hover:bg-red-50 rounded-full"><Trash2 size={14}/></button></div><div className="text-xs text-slate-500 truncate font-medium opacity-80">{s.preview}</div></div>))}
                </div>
              </div>
              <div className="flex-1 flex flex-col h-full relative bg-white/40 backdrop-blur-sm">
                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar scroll-smooth">
                  {messages.length === 0 && <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60"><MessageCircle size={80} strokeWidth={1} /><p className="mt-6 text-lg font-medium">Bắt đầu hành trình...</p></div>}
                  {messages.map((msg) => (<div key={msg.id} className={`flex ${msg.sender==='user'?'justify-end':'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}><div className={`max-w-[85%] md:max-w-[70%] p-6 rounded-[2rem] shadow-sm text-[16px] leading-relaxed relative group ${msg.sender==='user'?'bg-white text-slate-800 rounded-tr-sm ml-12 border border-white/60':`${theme.bubble} text-slate-800 rounded-tl-sm border border-white/50 mr-12`}`}>{msg.sender==='ai'&&<div className={`absolute -top-3 -left-3 w-10 h-10 rounded-full flex items-center justify-center text-white text-[12px] font-bold shadow-md ring-4 ring-white/50 ${theme.accent}`}>Hiếu</div>}{msg.text}</div></div>))}
                  {isAiThinking && <div className="flex items-center gap-2 text-slate-500 text-sm ml-4 animate-pulse p-2">Hiếu đang ngẫm nghĩ...</div>}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-6 bg-white/70 backdrop-blur-xl border-t border-white/40 mb-20 md:mb-0 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]"><div className="flex gap-3 max-w-4xl mx-auto items-end"><textarea value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())} placeholder="Viết những gì đang trĩu nặng..." className="flex-1 bg-white rounded-3xl px-6 py-4 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-300/50 resize-none h-[60px] min-h-[60px] max-h-[120px] text-slate-700 placeholder:text-slate-400 border border-slate-200"/><button onClick={handleSendMessage} disabled={!chatInput.trim()} className={`p-4 rounded-full text-white shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 ${theme.accent}`}><Send size={24}/></button></div></div>
              </div>
            </div>
          )}

          {activeTab === 'social' && (
            <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-32">
              <div className="max-w-2xl mx-auto space-y-8">
                <div className="bg-white/80 backdrop-blur rounded-[2.5rem] p-8 shadow-lg border border-white/60">
                  <textarea value={newPostContent} onChange={e=>setNewPostContent(e.target.value)} placeholder="Trải lòng cùng cộng đồng..." className="w-full bg-slate-50/80 rounded-3xl p-5 focus:outline-none focus:ring-2 focus:ring-teal-300/50 resize-none h-32 mb-4 text-slate-700 placeholder:text-slate-400 border border-slate-100 transition-all focus:bg-white"/>
                  <div className="flex justify-between items-center">
                    <button onClick={handlePolishPost} disabled={isPolishing || !newPostContent.trim()} className="text-indigo-600 hover:text-indigo-800 text-sm font-bold flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-indigo-50 transition-all disabled:opacity-50">
                      {isPolishing ? <RefreshCw className="animate-spin" size={16}/> : <Wand2 size={16}/>} ✨ Trau chuốt
                    </button>
                    <button onClick={handlePost} disabled={isPosting || !newPostContent.trim()} className="bg-teal-600 text-white px-8 py-3 rounded-2xl font-bold shadow-md hover:bg-teal-700 transition-all disabled:opacity-50 hover:shadow-lg">{isPosting ? 'Đang gửi...' : 'Chia sẻ'}</button>
                  </div>
                </div>
                {socialPosts.map(post => (
                  <div key={post.id} className="bg-white/90 backdrop-blur rounded-[2.5rem] p-8 shadow-sm border border-white/60 animate-in slide-in-from-bottom-4 duration-500 relative group hover:shadow-lg transition-all">
                    {isAdmin && <button onClick={()=>handleDeletePost(post.id)} className="absolute top-6 right-6 p-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18}/></button>}
                    <div className="flex justify-between items-center mb-5">
                      <div className="flex items-center gap-4"><div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-xl">👤</div><div><div className="font-bold text-slate-800 text-lg">{post.author}</div><div className="text-xs text-slate-400 font-medium">{new Date(post.timestamp).toLocaleString()}</div></div></div>
                      <span className={`px-4 py-1.5 rounded-full text-[11px] uppercase font-bold tracking-wider bg-slate-100 text-slate-500`}>{post.emotion}</span>
                    </div>
                    <p className="text-slate-700 mb-6 leading-relaxed whitespace-pre-wrap pl-1 text-[15px]">{post.content}</p>
                    <div className="flex items-center gap-8 pt-5 border-t border-slate-100/80">
                      <button onClick={() => handleSocialInteraction(post.id, 'like')} className="flex items-center gap-2 text-slate-500 hover:text-pink-500 transition-all font-medium"><Heart size={22} className={post.likes > 0 ? "fill-pink-500 text-pink-500" : ""}/> {post.likes}</button>
                      <div className="flex items-center gap-2 text-slate-500 font-medium"><MessageSquare size={22}/> {post.comments.length}</div>
                    </div>
                    <div className="mt-5 space-y-4 bg-slate-50/50 p-5 rounded-3xl">
                      {post.comments.map((c) => (<div key={c.id} className="text-[14px] flex gap-3 items-start group/cmt"><span className={`font-bold whitespace-nowrap ${c.isAi ? 'text-indigo-600' : 'text-slate-700'}`}>{c.author}:</span><span className="text-slate-600 leading-snug flex-1">{c.content}</span>{(c.author === userState.name || isAdmin) && (<button onClick={()=>handleDeleteComment(post.id, c.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover/cmt:opacity-100 transition-opacity"><Trash2 size={12}/></button>)}</div>))}
                      <div className="flex gap-2 mt-4 pt-2"><input value={commentInputs[post.id] || ''} onChange={e => setCommentInputs({...commentInputs, [post.id]: e.target.value})} placeholder="Viết bình luận..." className="flex-1 bg-white border border-slate-200 rounded-xl px-5 py-2.5 text-sm focus:outline-none focus:border-teal-400" onKeyDown={e => e.key === 'Enter' && handleSocialInteraction(post.id, 'comment')}/><button onClick={() => handleSocialInteraction(post.id, 'comment')} className="text-teal-600 p-2.5 hover:bg-teal-50 rounded-xl"><Send size={20}/></button></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'art' && (
            <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-32">
              <div className="max-w-7xl mx-auto">
                <div className={`bg-white/80 backdrop-blur rounded-[2.5rem] p-10 shadow-xl mb-12 border border-white/60 text-center`}>
                  <h2 className="text-3xl font-bold text-slate-800 mb-3 flex items-center justify-center gap-3"><Sparkles className="text-pink-500" size={32}/> Triển Lãm Tâm Hồn</h2>
                  <p className="text-slate-500 mb-8 max-w-lg mx-auto">Vẽ nên những điều không thể nói thành lời.</p>
                  <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto">
                    <input value={artPrompt} onChange={e=>setArtPrompt(e.target.value)} placeholder="Một nỗi buồn màu xanh..." className="flex-1 bg-white rounded-2xl px-6 py-4 focus:outline-none focus:ring-4 focus:ring-pink-200 shadow-inner text-lg border border-pink-100"/>
                    <button onClick={handleCreateArt} disabled={isDrawing} className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white px-10 py-4 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 text-lg disabled:opacity-70">{isDrawing ? <RefreshCw className="animate-spin"/> : <Search/>} Tạo Ảnh Minh Họa</button>
                  </div>
                </div>
                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
                  {gallery.map(art => (
                    <div key={art.id} className="group relative rounded-3xl overflow-hidden shadow-md bg-slate-200 break-inside-avoid hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2">
                      <img src={art.url} className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-110" 
                        onError={(e)=>{e.currentTarget.src = art.emotion ? EMOTION_THEMES[art.emotion].fallbackImg : EMOTION_THEMES['neutral'].fallbackImg}} 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-6">
                        <p className="text-white text-sm font-medium line-clamp-3 mb-3 leading-relaxed">"{art.prompt}"</p>
                        <div className="flex items-center gap-3 pt-3 border-t border-white/20"><div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] text-white">👤</div><p className="text-white/90 text-xs font-bold">{art.author || 'Ẩn danh'}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-transparent">
              <div className="max-w-5xl mx-auto space-y-8">
                {/* Header Profile */}
                <div className="relative rounded-[3rem] overflow-hidden bg-white/80 backdrop-blur-xl shadow-2xl border border-white/60">
                  <div className={`h-48 w-full ${theme.bg}`}></div>
                  <div className="px-10 pb-10 flex flex-col md:flex-row items-center md:items-end gap-6 -mt-16 relative z-10">
                    <div className="w-32 h-32 rounded-full bg-white p-1.5 shadow-xl">
                      <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center text-6xl">😎</div>
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <div className="flex items-center justify-center md:justify-start gap-3">
                        {isEditingProfile ? (
                          <div className="flex gap-2">
                            <input className="text-2xl font-bold bg-white/50 border rounded px-2 w-48" value={tempName} onChange={e=>setTempName(e.target.value)}/>
                            <button onClick={saveProfile} className="p-2 bg-green-500 text-white rounded-lg"><Save size={18}/></button>
                            <button onClick={()=>setIsEditingProfile(false)} className="p-2 bg-red-500 text-white rounded-lg"><X size={18}/></button>
                          </div>
                        ) : (
                          <h2 className="text-3xl font-bold text-slate-800">{userState.name}</h2>
                        )}
                        {!isEditingProfile && authMode === 'login' && <button onClick={startEditingProfile} className="text-slate-400 hover:text-indigo-600"><Edit2 size={18}/></button>}
                      </div>
                      <p className="text-slate-500 font-medium">@{userState.username}</p>
                      {isEditingProfile ? <textarea className="w-full mt-2 p-2 border rounded" value={tempBio} onChange={e=>setTempBio(e.target.value)}/> : <p className="text-slate-600 mt-2 italic">"{userState.bio}"</p>}
                    </div>
                    
                    {/* Stats Grid */}
                    <div className="flex gap-4">
                      <div className="text-center bg-white/50 p-3 rounded-2xl min-w-[80px]">
                        <div className="text-2xl font-bold text-indigo-600">85%</div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Cân bằng</div>
                      </div>
                      <div className="text-center bg-white/50 p-3 rounded-2xl min-w-[80px]">
                        <div className="text-2xl font-bold text-teal-600">{gratitudeEntries.length}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Biết ơn</div>
                      </div>
                      <div className="text-center bg-white/50 p-3 rounded-2xl min-w-[80px]">
                        <div className="text-2xl font-bold text-pink-600">{gallery.length}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Tranh</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left Column: Tools */}
                  <div className="md:col-span-1 space-y-6">
                    <div className="bg-white/80 backdrop-blur rounded-[2.5rem] p-6 shadow-lg border border-white/60">
                      <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Layout size={20}/> Công cụ</h3>
                      <div className="space-y-3">
                        <button onClick={()=>setShowBreathing(true)} className="w-full p-4 rounded-2xl bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 transition-all flex items-center gap-3"><Wind/> Hít thở 4-7-8</button>
                        <button onClick={()=>setShowGratitude(true)} className="w-full p-4 rounded-2xl bg-amber-50 text-amber-700 font-bold hover:bg-amber-100 transition-all flex items-center gap-3"><BookOpen/> Nhật ký</button>
                      </div>
                    </div>
                    <div className="bg-white/80 backdrop-blur rounded-[2.5rem] p-6 shadow-lg border border-white/60">
                      <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Settings size={20}/> Cài đặt</h3>
                      <button onClick={()=>{setAuthMode(null);window.location.reload()}} className="w-full p-4 rounded-2xl bg-red-50 text-red-500 font-bold hover:bg-red-100 transition-all flex items-center gap-3"><LogOut/> Đăng xuất</button>
                    </div>
                  </div>

                  {/* Right Column: Journey & Future Letter */}
                  <div className="md:col-span-2 space-y-6">
                    {/* Future Self Letter Feature */}
                    <div className="bg-white/80 backdrop-blur rounded-[2.5rem] p-8 shadow-lg border border-white/60 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-20"><Radio size={100}/></div>
                      <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2 text-xl"><Sparkles size={24} className="text-indigo-500"/> Tín Hiệu Tương Lai</h3>
                      <p className="text-indigo-800/70 mb-6 text-sm">Gửi một tín hiệu đến vũ trụ để nhận lời nhắn từ chính bạn ở 5 năm sau.</p>
                      
                      {futureLetter ? (
                        <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 animate-in zoom-in duration-500">
                          <p className="text-indigo-900 italic font-medium leading-relaxed mb-4">"{futureLetter}"</p>
                          <div className="flex gap-3">
                            <button onClick={()=>playTextToSpeech(futureLetter)} className="px-4 py-2 bg-white text-indigo-600 rounded-lg text-xs font-bold shadow-sm hover:shadow flex items-center gap-2"><Volume2 size={14}/> Nghe</button>
                            <button onClick={()=>setFutureLetter(null)} className="px-4 py-2 bg-indigo-200 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-300">Đóng lại</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={handleGenerateFutureLetter} disabled={isGeneratingFuture} className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-70 flex items-center justify-center gap-2">
                          {isGeneratingFuture ? <RefreshCw className="animate-spin"/> : <Radio/>} Kết nối với Tương Lai
                        </button>
                      )}
                    </div>

                    <div className="bg-white/80 backdrop-blur rounded-[2.5rem] p-8 shadow-lg border border-white/60 flex flex-col min-h-[300px]">
                      <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2 text-xl"><MapPin size={24} className="text-teal-500"/> Hành trình cảm xúc</h3>
                      {gratitudeEntries.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 opacity-60">
                          <BookOpen size={48} className="mb-2"/>
                          <p>Chưa có dòng nhật ký nào...</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {gratitudeEntries.slice(0, 5).map(entry => (
                            <div key={entry.id} className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 flex gap-4">
                              <div className="flex-none flex flex-col items-center justify-center bg-indigo-50 w-16 h-16 rounded-xl text-indigo-600">
                                <span className="text-xs font-bold uppercase">{new Date().toLocaleString('default', { month: 'short' })}</span>
                                <span className="text-xl font-bold">{new Date().getDate()}</span>
                              </div>
                              <div className="flex-1">
                                <p className="text-slate-700 italic">"{entry.text}"</p>
                                <p className="text-xs text-slate-400 mt-2 font-medium">Nhật ký biết ơn</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}