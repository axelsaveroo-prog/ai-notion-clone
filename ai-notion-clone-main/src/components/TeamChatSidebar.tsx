"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { 
  getChatMessages, 
  sendChatMessage, 
  getChatChannelsAction, 
  createChatGroupAction, 
  getOrCreateDirectChannelAction, 
  deleteChatChannelAction, 
  getUsersAction, 
  syncUserAction,
  heartbeatAction,
  editChatMessageAction,
  deleteChatMessageAction,
  getLatestChatUpdatesAction
} from "@/actions/actions";
import { 
  MessageSquare, 
  Hash, 
  Plus, 
  Send, 
  Paperclip, 
  Image as ImageIcon, 
  FileText, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Download,
  Users,
  Check,
  Search,
  Trash2,
  User as UserIcon,
  MessageCircle,
  Loader2,
  Camera,
  Mic,
  Play,
  Pause,
  Edit2,
  ExternalLink,
  Volume2
} from "lucide-react";

interface Attachment {
  name: string;
  size: string;
  type: "image" | "file" | "audio";
  url: string;
}

interface Message {
  id: string;
  channelId?: string;
  sender: string;
  senderId?: string | null;
  senderImage?: string | null;
  text: string;
  time: string;
  createdAtRaw?: string;
  attachment?: Attachment;
  isSelf: boolean;
  isEdited?: boolean;
}

interface Channel {
  id: string;
  name: string;
  type: string; // "group" | "direct"
  description?: string | null;
  members: string[];
  createdById?: string | null;
}

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  imageUrl?: string;
  lastActiveAt?: string | null;
}

// ==========================================
// 1. HELPER: Client-side Image Compression (Mencegah Minified React error #441)
// ==========================================
const compressImage = (file: File | Blob, maxWidth = 1200, quality = 0.75): Promise<{ dataUrl: string; sizeFormatted: string }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const approxBytes = Math.round((dataUrl.length * 3) / 4);
        const sizeFormatted = (approxBytes / 1024).toFixed(1) + " KB";
        resolve({ dataUrl, sizeFormatted });
      };
      img.onerror = () => {
        resolve({ dataUrl: e.target?.result as string, sizeFormatted: "100 KB" });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

// ==========================================
// 2. HELPER: Auto-linkify URLs dalam Pesan Chat
// ==========================================
function renderMessageTextWithLinks(text: string, isSelf: boolean) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      const href = part.startsWith("http") ? part : `https://${part}`;
      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`underline break-all transition cursor-pointer font-medium inline-flex items-center gap-0.5 ${
            isSelf ? "text-blue-900 hover:text-blue-950 font-semibold" : "text-sky-400 hover:text-sky-300"
          }`}
        >
          <span>{part}</span>
          <ExternalLink size={10} className="shrink-0 opacity-70" />
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

// ==========================================
// 3. HELPER: Notifikasi Chime (Web Audio API)
// ==========================================
const playNotificationChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {}
};

// ==========================================
// 4. SUBCOMPONENT: Audio Voice Note Player ala WhatsApp
// ==========================================
function AudioVoiceNotePlayer({ url, isSelf }: { url: string; isSelf: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };
    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [url]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className={`flex items-center gap-2.5 p-2 rounded-xl min-w-[200px] sm:min-w-[240px] ${
      isSelf ? "bg-zinc-200/90 text-zinc-950" : "bg-[#1f1f24] text-zinc-200 border border-zinc-800"
    }`}>
      <button
        type="button"
        onClick={togglePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition shadow-sm cursor-pointer ${
          isSelf ? "bg-zinc-900 text-white hover:bg-zinc-800" : "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
        }`}
      >
        {isPlaying ? <Pause size={13} className="fill-current" /> : <Play size={13} className="fill-current ml-0.5" />}
      </button>

      <div className="flex-1 flex flex-col justify-center gap-1">
        <input
          type="range"
          min="0"
          max={duration || 1}
          step="0.05"
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1 bg-zinc-600/40 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
        <div className="flex items-center justify-between text-[10px] opacity-75 font-mono">
          <span>{formatTime(currentTime)}</span>
          <div className="flex items-center gap-1">
            <Mic size={10} />
            <span>{formatTime(duration || currentTime)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================
export function TeamChatSidebar() {
  const { user } = useUser();
  const currentUserId = user?.id || "guest";
  const currentUserName = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || "You";
  const currentUserImage = user?.imageUrl || "";

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"groups" | "direct">("groups");

  // Real Database Data
  const [channels, setChannels] = useState<Channel[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>("general");
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [searchQuery, setSearchQuery] = useState("");

  // Input & Upload State
  const [inputText, setInputText] = useState("");
  const [pendingFile, setPendingFile] = useState<Attachment | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Edit Message State
  const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);

  // Unread & Notification State
  const [lastReadPerChannel, setLastReadPerChannel] = useState<Record<string, number>>({});
  const [unreadNotification, setUnreadNotification] = useState<{
    id: string;
    sender: string;
    senderImage?: string;
    text: string;
    channelId: string;
    channelName: string;
    time: string;
  } | null>(null);

  // Modal Buat Grup
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Camera State
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Voice Note State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());

  // Load lastRead from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sika_chat_last_read");
      if (saved) {
        setLastReadPerChannel(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const updateLastRead = (channelId: string) => {
    const now = Date.now();
    setLastReadPerChannel((prev) => {
      const updated = { ...prev, [channelId]: now };
      try {
        localStorage.setItem("sika_chat_last_read", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // 1. Fetch real channels & registered users dari DB
  const loadInitialChatData = async () => {
    try {
      await syncUserAction();
      const [fetchedChannels, fetchedUsers] = await Promise.all([
        getChatChannelsAction(currentUserId),
        getUsersAction(),
      ]);

      if (fetchedChannels && fetchedChannels.length > 0) {
        setChannels(fetchedChannels as Channel[]);
        if (!activeChannelId || activeChannelId === "general") {
          setActiveChannelId(fetchedChannels[0].id);
        }
      }

      if (fetchedUsers && fetchedUsers.length > 0) {
        setTeamMembers(fetchedUsers);
      }
    } catch (error) {
      console.error("Gagal memuat saluran / pengguna chat:", error);
    }
  };

  useEffect(() => {
    loadInitialChatData();
  }, [currentUserId]);

  // Periodic heartbeat agar user terdeteksi online
  useEffect(() => {
    if (!user?.id) return;
    heartbeatAction().catch(() => {});
    const interval = setInterval(() => {
      heartbeatAction().catch(() => {});
    }, 25000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Refresh user presence secara berkala
  useEffect(() => {
    const refreshPresence = () => {
      getUsersAction()
        .then((fetchedUsers) => {
          if (fetchedUsers && fetchedUsers.length > 0) {
            setTeamMembers(fetchedUsers as TeamMember[]);
          }
        })
        .catch(() => {});
    };

    const interval = setInterval(refreshPresence, isOpen ? 5000 : 25000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Saat sidebar dibuka atau ganti channel, tandai sudah dibaca
  useEffect(() => {
    if (isOpen && activeChannelId) {
      updateLastRead(activeChannelId);
      loadMessages(activeChannelId);
    }
  }, [isOpen, activeChannelId]);

  // Set default selected member saat modal dibuka
  useEffect(() => {
    if (user?.id) {
      setSelectedMembers([user.id]);
    }
  }, [user]);

  // 2. Fetch Pesan untuk Saluran Aktif
  const loadMessages = async (channelId: string) => {
    if (!channelId) return;
    try {
      const dbMsgs = await getChatMessages(channelId);
      if (dbMsgs) {
        const formatted: Message[] = dbMsgs.map((m: any) => {
          const isSelf = m.senderId ? m.senderId === currentUserId : m.sender === currentUserName;
          knownMessageIdsRef.current.add(m.id);
          return {
            id: m.id,
            channelId: m.channelId,
            sender: m.sender,
            senderId: m.senderId,
            senderImage: m.senderImage,
            text: m.text || "",
            time: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            createdAtRaw: m.createdAt,
            isSelf,
            isEdited: m.isEdited || false,
            attachment: m.fileUrl ? { name: "Lampiran", size: "File", type: m.fileType || "file", url: m.fileUrl } : undefined,
          };
        });
        setMessages((prev) => ({ ...prev, [channelId]: formatted }));
      }
    } catch (error) {
      console.error("Gagal memuat pesan:", error);
    }
  };

  // 3. Polling global & listener untuk deteksi notifikasi pesan masuk
  useEffect(() => {
    const checkNewMessages = async () => {
      try {
        const latestMsgs = await getLatestChatUpdatesAction(25);
        if (!latestMsgs || latestMsgs.length === 0) return;

        let hasNewIncoming = false;
        let lastIncomingMsg: any = null;

        for (const m of latestMsgs) {
          const isKnown = knownMessageIdsRef.current.has(m.id);
          const isSelf = m.senderId ? m.senderId === currentUserId : m.sender === currentUserName;
          knownMessageIdsRef.current.add(m.id);

          if (!isKnown && !isSelf) {
            hasNewIncoming = true;
            lastIncomingMsg = m;
          }
        }

        // Jika ada pesan baru dari orang lain dan chat tidak sedang dibuka di saluran tersebut
        if (hasNewIncoming && lastIncomingMsg) {
          const isCurrentActive = isOpen && activeChannelId === lastIncomingMsg.channelId;
          if (!isCurrentActive) {
            playNotificationChime();
            const targetCh = channels.find((c) => c.id === lastIncomingMsg.channelId);
            const targetName = targetCh ? getChannelDisplayName(targetCh) : "Chat Tim";

            setUnreadNotification({
              id: lastIncomingMsg.id,
              sender: lastIncomingMsg.sender,
              senderImage: lastIncomingMsg.senderImage,
              text: lastIncomingMsg.text || (lastIncomingMsg.fileType === "image" ? "📷 Mengirim foto" : lastIncomingMsg.fileType === "audio" ? "🎤 Mengirim voice note" : "📎 Mengirim berkas"),
              channelId: lastIncomingMsg.channelId,
              channelName: targetName,
              time: "Baru saja",
            });
          }
        }

        // Perbarui pesan channel aktif jika sedang dibuka
        if (activeChannelId) {
          loadMessages(activeChannelId);
        }
      } catch {}
    };

    const interval = setInterval(checkNewMessages, isOpen ? 2500 : 4500);
    return () => clearInterval(interval);
  }, [activeChannelId, channels, currentUserId, currentUserName, isOpen]);

  // Auto-dismiss popup notifikasi setelah 6 detik
  useEffect(() => {
    if (!unreadNotification) return;
    const timer = setTimeout(() => {
      setUnreadNotification(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [unreadNotification]);

  // Scroll otomatis ke bawah
  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeChannelId, isOpen]);

  // Cek apakah user sedang online
  const isUserOnline = (member: TeamMember) => {
    if (member.id === currentUserId) return true;
    if (!member.lastActiveAt) return false;
    const lastActive = new Date(member.lastActiveAt).getTime();
    if (isNaN(lastActive)) return false;
    return Date.now() - lastActive < 90 * 1000;
  };

  // Nama Tampilan Saluran (Menghapus duplikasi # dan tidak memaksakan tanda -)
  const getChannelDisplayName = (channel: Channel) => {
    if (channel.type === "direct") {
      const parts = channel.name.split(" & ");
      if (parts.length === 2) {
        return parts[0] === currentUserName ? parts[1] : parts[0];
      }
      return channel.name;
    }
    const cleanName = channel.name.replace(/^#+/, "").trim();
    return `#${cleanName}`;
  };

  // Identifikasi channel aktif
  const activeChannel = useMemo(() => {
    return channels.find((c) => c.id === activeChannelId) || {
      id: activeChannelId,
      name: activeChannelId,
      type: activeChannelId.startsWith("dm_") ? "direct" : "group",
      members: [],
    };
  }, [channels, activeChannelId]);

  // Info rekan chat direct jika sedang membuka DM
  const activeDmPartner = useMemo(() => {
    if (activeChannel.type !== "direct") return null;
    const otherId = activeChannel.members?.find((id) => id !== currentUserId);
    if (otherId) {
      return teamMembers.find((m) => m.id === otherId) || null;
    }
    const displayName = getChannelDisplayName(activeChannel);
    return teamMembers.find((m) => (m.name || m.email) === displayName) || null;
  }, [activeChannel, teamMembers, currentUserId, currentUserName]);

  const isDmPartnerOnline = activeDmPartner ? isUserOnline(activeDmPartner) : false;

  const activeMessages = messages[activeChannelId] || [];

  // Hitung status Unread per channel & total
  const unreadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [chId, msgList] of Object.entries(messages)) {
      const lastRead = lastReadPerChannel[chId] || 0;
      const unreadCount = msgList.filter((m) => {
        if (m.isSelf) return false;
        if (!m.createdAtRaw) return false;
        return new Date(m.createdAtRaw).getTime() > lastRead;
      }).length;
      if (unreadCount > 0) counts[chId] = unreadCount;
    }
    return counts;
  }, [messages, lastReadPerChannel]);

  const totalUnreadCount = useMemo(() => {
    return Object.values(unreadCounts).reduce((a, b) => a + b, 0);
  }, [unreadCounts]);

  // Filter Channels & Direct Messages berdasarkan pencarian
  const groupChannels = useMemo(() => {
    return channels.filter((c) => c.type === "group" && c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [channels, searchQuery]);

  const filteredMembers = useMemo(() => {
    return teamMembers.filter((m) => 
      m.id !== currentUserId && 
      (m.name?.toLowerCase().includes(searchQuery.toLowerCase()) || m.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [teamMembers, currentUserId, searchQuery]);

  // ==========================================
  // HANDLERS: Kirim, Edit, Hapus Pesan
  // ==========================================

  // Pilih file atau gambar dari disk
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      const { dataUrl, sizeFormatted } = await compressImage(file);
      setPendingFile({
        name: file.name,
        size: sizeFormatted,
        type: "image",
        url: dataUrl,
      });
    } else {
      const sizeFormatted = (file.size / 1024).toFixed(1) + " KB";
      const reader = new FileReader();
      reader.onload = () => {
        setPendingFile({
          name: file.name,
          size: sizeFormatted,
          type: "file",
          url: reader.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  // Handler Paste Screenshot (Ctrl + V)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          const { dataUrl, sizeFormatted } = await compressImage(file);
          setPendingFile({
            name: `screenshot-${new Date().toLocaleTimeString().replace(/:/g, "-")}.jpg`,
            size: sizeFormatted,
            type: "image",
            url: dataUrl,
          });
          break;
        }
      }
    }
  };

  // Kamera Capture Handlers
  const openCamera = async () => {
    try {
      setIsCameraModalOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn("Gagal membuka webcam, fallback ke pemilih kamera sistem:", err);
      setIsCameraModalOpen(false);
      cameraInputRef.current?.click();
    }
  };

  const closeCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraModalOpen(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (blob) {
        const { dataUrl, sizeFormatted } = await compressImage(blob);
        setPendingFile({
          name: `camera-${Date.now()}.jpg`,
          size: sizeFormatted,
          type: "image",
          url: dataUrl,
        });
      }
      closeCamera();
    }, "image/jpeg", 0.85);
  };

  // Voice Note Recording Handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      alert("Akses mikrofon ditolak atau tidak tersedia.");
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current.stop();
    }
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const stopAndSendRecording = () => {
    if (!mediaRecorderRef.current) return;
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = reader.result as string;
        setIsSending(true);
        try {
          const res = await sendChatMessage({
            channelId: activeChannelId,
            sender: currentUserName,
            senderId: currentUserId,
            senderImage: currentUserImage,
            text: "",
            fileUrl: base64Audio,
            fileType: "audio",
          });
          if (res.success) {
            loadMessages(activeChannelId);
          }
        } catch (e: any) {
          alert("Gagal mengirim voice note: " + e?.message);
        } finally {
          setIsSending(false);
          setRecordingSeconds(0);
        }
      };
      reader.readAsDataURL(audioBlob);
    };

    mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current.stop();
  };

  // Kirim Pesan Real ke Database
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !pendingFile) || isSending) return;

    // Jika sedang dalam mode edit pesan
    if (editingMessage) {
      const newText = inputText.trim();
      const msgId = editingMessage.id;
      setEditingMessage(null);
      setInputText("");

      setMessages((prev) => {
        const currentList = prev[activeChannelId] || [];
        return {
          ...prev,
          [activeChannelId]: currentList.map((m) =>
            m.id === msgId ? { ...m, text: newText, isEdited: true } : m
          ),
        };
      });

      await editChatMessageAction(msgId, newText, currentUserId);
      return;
    }

    const textToSend = inputText.trim();
    const fileToSend = pendingFile;

    setInputText("");
    setPendingFile(null);
    setIsSending(true);

    // Optimistic UI update
    const optimisticMsg: Message = {
      id: "temp-" + Date.now(),
      sender: currentUserName,
      senderId: currentUserId,
      senderImage: currentUserImage,
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isSelf: true,
      attachment: fileToSend || undefined,
    };

    setMessages((prev) => ({
      ...prev,
      [activeChannelId]: [...(prev[activeChannelId] || []), optimisticMsg],
    }));

    try {
      const res = await sendChatMessage({
        channelId: activeChannelId,
        sender: currentUserName,
        senderId: currentUserId,
        senderImage: currentUserImage,
        text: textToSend,
        fileUrl: fileToSend?.url,
        fileType: fileToSend?.type,
      });

      if (!res.success) {
        console.error("Gagal mengirim pesan:", res.error);
        alert("Gagal mengirim pesan: " + (res.error || "Gagal menyimpan pesan ke database"));
      } else {
        loadMessages(activeChannelId);
      }
    } catch (error: any) {
      console.error("Gagal mengirim pesan:", error);
      alert("Gagal mengirim pesan: " + (error?.message || "Koneksi terputus"));
    } finally {
      setIsSending(false);
    }
  };

  // Mulai Edit Pesan
  const handleStartEditMessage = (msg: Message) => {
    setEditingMessage({ id: msg.id, text: msg.text });
    setInputText(msg.text);
  };

  // Hapus Pesan
  const handleDeleteMessage = async (msgId: string) => {
    setMessages((prev) => {
      const currentList = prev[activeChannelId] || [];
      return {
        ...prev,
        [activeChannelId]: currentList.filter((m) => m.id !== msgId),
      };
    });

    try {
      await deleteChatMessageAction(msgId, currentUserId);
    } catch (err: any) {
      alert("Gagal menghapus pesan: " + err?.message);
    }
  };

  // Buka atau Buat Direct Message dengan User Lain
  const handleOpenDirectChat = async (targetMember: TeamMember) => {
    const targetName = targetMember.name || targetMember.email;
    try {
      const res = await getOrCreateDirectChannelAction(
        currentUserId,
        currentUserName,
        targetMember.id,
        targetName
      );

      if (res && res.success && res.channel) {
        const directCh = res.channel as Channel;
        setChannels((prev) => {
          if (prev.some((c) => c.id === directCh.id)) return prev;
          return [...prev, directCh];
        });
        setActiveChannelId(directCh.id);
        setActiveTab("direct");
        updateLastRead(directCh.id);
      }
    } catch (e: any) {
      console.error("Gagal membuka chat:", e);
    }
  };

  // Klik notifikasi untuk langsung menuju chat
  const handleOpenFromNotification = (channelId: string) => {
    setActiveChannelId(channelId);
    setIsOpen(true);
    setUnreadNotification(null);
    updateLastRead(channelId);
  };

  // Buat Grup Chat Baru
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    setIsCreatingGroup(true);
    try {
      const membersToInclude = Array.from(new Set([...selectedMembers, currentUserId]));
      const res = await createChatGroupAction({
        name: newGroupName,
        description: newGroupDesc,
        members: membersToInclude,
        createdById: currentUserId,
      });

      if (res.success && res.channel) {
        setChannels((prev) => [...prev, res.channel as Channel]);
        setActiveChannelId(res.channel.id);
        setActiveTab("groups");
        setIsGroupModalOpen(false);
        setNewGroupName("");
        setNewGroupDesc("");
        updateLastRead(res.channel.id);
      } else {
        alert(res.error || "Gagal membuat grup");
      }
    } catch (e: any) {
      alert("Terjadi kesalahan: " + e?.message);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Hapus Grup
  const handleDeleteGroup = async (channelId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus grup ini beserta semua riwayat chatnya?")) return;
    try {
      const res = await deleteChatChannelAction(channelId);
      if (res.success) {
        setChannels((prev) => prev.filter((c) => c.id !== channelId));
        setActiveChannelId("general");
      } else {
        alert(res.error || "Gagal menghapus saluran");
      }
    } catch (e: any) {
      alert("Gagal: " + e?.message);
    }
  };

  const toggleMemberSelection = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  return (
    <>
      {/* ========================================================= */}
      {/* NOTIFIKASI MINIMALIS ALA WHATSAPP DI POJOK KIRI BAWAH     */}
      {/* ========================================================= */}
      {unreadNotification && (
        <div className="fixed bottom-20 left-4 z-50 sm:bottom-6 sm:left-16 max-w-sm w-auto animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div
            onClick={() => handleOpenFromNotification(unreadNotification.channelId)}
            className="bg-[#18181b]/95 backdrop-blur-xl border border-zinc-700/80 hover:border-emerald-500/70 text-white p-3 rounded-2xl shadow-2xl flex items-start gap-3 cursor-pointer transition hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="relative shrink-0">
              {unreadNotification.senderImage ? (
                <img
                  src={unreadNotification.senderImage}
                  alt={unreadNotification.sender}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center text-emerald-400 font-bold text-sm">
                  {(unreadNotification.sender || "U").slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-[#18181b] flex items-center justify-center">
                <MessageSquare size={8} className="text-black" />
              </span>
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center justify-between gap-2">
                <h5 className="text-xs font-semibold text-white truncate">{unreadNotification.sender}</h5>
                <span className="text-[10px] text-zinc-400 shrink-0">{unreadNotification.time}</span>
              </div>
              {unreadNotification.channelName && (
                <span className="text-[10px] text-emerald-400 font-medium block truncate">
                  {unreadNotification.channelName}
                </span>
              )}
              <p className="text-xs text-zinc-300 line-clamp-2 mt-0.5 break-words">
                {unreadNotification.text}
              </p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setUnreadNotification(null);
              }}
              className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition -mr-1 -mt-1 cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SIDEBAR CONTAINER DI SISI KIRI LAYAR                      */}
      {/* ========================================================= */}
      <aside
        className={`fixed top-0 left-0 h-full z-40 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col ${
          isOpen
            ? "w-80 sm:w-96 bg-[#111113] border-r border-zinc-800/80 shadow-2xl"
            : "w-11 bg-[#0a0a0d]/60 hover:bg-[#0c0c10]/90 backdrop-blur-md border-r border-zinc-800/30"
        }`}
      >
        {/* Toggle Expand / Collapse Bar */}
        <div className={`p-3 border-b border-zinc-800/70 flex items-center justify-between bg-[#141417] ${!isOpen ? "justify-center p-2.5" : ""}`}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="relative flex items-center gap-2 text-zinc-300 hover:text-white p-1.5 rounded-xl hover:bg-zinc-800/60 transition cursor-pointer"
            title={isOpen ? "Sembunyikan Chat" : "Buka Chat Tim"}
          >
            <div className="relative">
              <MessageSquare
                size={17}
                className={totalUnreadCount > 0 ? "text-emerald-400" : "text-zinc-300"}
              />
              {/* Logo Chat dengan warna / indikator jika ada pesan masuk belum dibuka */}
              {totalUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#141417] animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              )}
            </div>

            {isOpen && (
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-white tracking-wide">Team Chat</span>
                <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[150px]">
                  {currentUserName}
                </span>
              </div>
            )}
          </button>

          {isOpen && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsGroupModalOpen(true)}
                className="h-7 px-2 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700/60 flex items-center gap-1 text-[11px] font-medium transition cursor-pointer"
                title="Buat Grup Baru"
              >
                <Plus size={13} />
                <span>Grup</span>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-zinc-800/80 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                title="Tutup Chat"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          )}
        </div>

        {/* JIKA COLLAPSED: Tampilan super minimalis & "sepi" */}
        {!isOpen && (
          <div className="flex-1 py-4 flex flex-col items-center justify-start gap-4">
            <button
              onClick={() => setIsOpen(true)}
              className={`relative w-8 h-8 rounded-xl flex items-center justify-center transition cursor-pointer ${
                totalUnreadCount > 0
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)] animate-pulse"
                  : "bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
              title={totalUnreadCount > 0 ? `${totalUnreadCount} pesan belum dibaca` : "Buka Chat"}
            >
              <ChevronRight size={14} />
              {totalUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[#0a0a0d]" />
              )}
            </button>
          </div>
        )}

        {/* JIKA OPEN: Tampilkan Channel List, Tab DM & Live Chat */}
        {isOpen && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#0e0e10]">
            
            {/* Header Tabs: Grup vs DM */}
            <div className="p-2 border-b border-zinc-800/70 bg-[#131316] flex flex-col gap-2">
              <div className="flex items-center gap-1 bg-[#1a1a1e] p-1 rounded-xl border border-zinc-800/60">
                <button
                  onClick={() => setActiveTab("groups")}
                  className={`flex-1 py-1 px-2 rounded-lg text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === "groups"
                      ? "bg-zinc-800 text-white font-semibold shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Hash size={13} />
                  <span>Saluran ({groupChannels.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab("direct")}
                  className={`flex-1 py-1 px-2 rounded-lg text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === "direct"
                      ? "bg-zinc-800 text-white font-semibold shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Users size={13} />
                  <span>Obrolan ({teamMembers.length})</span>
                </button>
              </div>

              {/* Search Bar Ringkas */}
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-2.5 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={activeTab === "groups" ? "Cari saluran..." : "Cari rekan kerja..."}
                  className="w-full bg-[#18181c] border border-zinc-800/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-700"
                />
              </div>

              {/* Daftar Horizontal / Chips Pilihan */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {activeTab === "groups" ? (
                  groupChannels.map((c) => {
                    const hasUnread = (unreadCounts[c.id] || 0) > 0;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setActiveChannelId(c.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1 shrink-0 ${
                          activeChannelId === c.id
                            ? "bg-white text-zinc-950 font-semibold shadow-sm"
                            : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white"
                        }`}
                      >
                        <Hash size={11} />
                        <span>{c.name}</span>
                        {hasUnread && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] shrink-0 ml-0.5" />
                        )}
                      </button>
                    );
                  })
                ) : (
                  filteredMembers.map((member) => {
                    const online = isUserOnline(member);
                    return (
                      <button
                        key={member.id}
                        onClick={() => handleOpenDirectChat(member)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 bg-zinc-900 text-zinc-300 border border-zinc-800 hover:text-white hover:border-zinc-700"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full transition-colors ${
                            online
                              ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                              : "bg-zinc-500"
                          }`}
                        />
                        <span>{member.name || member.email}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Active Channel Header Info */}
            <div className="px-3.5 py-2 border-b border-zinc-800/60 bg-[#121215] flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="p-1 rounded-md bg-zinc-800 text-zinc-300">
                  {activeChannel.type === "direct" ? <UserIcon size={12} /> : <Hash size={12} />}
                </span>
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-semibold text-white leading-tight truncate">
                      {getChannelDisplayName(activeChannel)}
                    </h4>
                    {activeChannel.type === "direct" && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${
                          isDmPartnerOnline
                            ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                            : "bg-zinc-500"
                        }`}
                        title={isDmPartnerOnline ? "Online" : "Offline"}
                      />
                    )}
                  </div>
                  {activeChannel.type === "direct" ? (
                    <p className={`text-[10px] truncate ${isDmPartnerOnline ? "text-emerald-400/80" : "text-zinc-500"}`}>
                      {isDmPartnerOnline ? "Online" : "Offline"}
                    </p>
                  ) : activeChannel.description ? (
                    <p className="text-[10px] text-zinc-500 truncate">{activeChannel.description}</p>
                  ) : null}
                </div>
              </div>

              {activeChannel.id !== "general" && activeChannel.type === "group" && (
                <button
                  onClick={() => handleDeleteGroup(activeChannel.id)}
                  className="text-zinc-500 hover:text-rose-400 p-1 transition cursor-pointer"
                  title="Hapus Grup Ini"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            {/* Area Pesan Chat Realtime */}
            <div
              onPaste={handlePaste}
              className="flex-1 overflow-y-auto p-3.5 space-y-3 min-h-0 bg-[#0d0d0f]"
            >
              {activeMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs gap-2 text-center px-6">
                  <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                    <MessageCircle size={20} />
                  </div>
                  <p className="font-medium text-zinc-300">Belum ada obrolan</p>
                  <span className="text-[11px] text-zinc-500">
                    Kirim pesan pertama ke {getChannelDisplayName(activeChannel)} untuk memulai kolaborasi.
                  </span>
                </div>
              ) : (
                activeMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`group relative flex flex-col ${msg.isSelf ? "items-end" : "items-start"}`}
                  >
                    {!msg.isSelf && (
                      <div className="flex items-center gap-1.5 mb-1 ml-1">
                        {msg.senderImage ? (
                          <img src={msg.senderImage} alt={msg.sender} className="w-4 h-4 rounded-full object-cover" />
                        ) : (
                          <span className="w-4 h-4 rounded-full bg-zinc-800 border border-zinc-700 text-[8px] flex items-center justify-center text-zinc-300 font-bold">
                            {(msg.sender || "M").slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span className="text-[11px] text-zinc-400 font-medium">
                          {msg.sender}
                        </span>
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] rounded-2xl p-2.5 text-xs leading-relaxed space-y-1.5 shadow-sm relative ${
                        msg.isSelf
                          ? "bg-zinc-100 text-zinc-950 font-normal rounded-tr-xs"
                          : "bg-[#19191d] text-zinc-200 border border-zinc-800/80 rounded-tl-xs"
                      }`}
                    >
                      {/* Teks Pesan dengan Auto-Link URLs */}
                      {msg.text && (
                        <p className="whitespace-pre-wrap break-words">
                          {renderMessageTextWithLinks(msg.text, msg.isSelf)}
                        </p>
                      )}

                      {/* Lampiran Gambar, Voice Note, atau Berkas */}
                      {msg.attachment && (
                        <div className="pt-1">
                          {msg.attachment.type === "image" ? (
                            <img
                              src={msg.attachment.url}
                              alt={msg.attachment.name}
                              className="rounded-xl max-h-56 w-auto object-cover border border-black/10 cursor-pointer hover:opacity-95 transition"
                              onClick={() => window.open(msg.attachment!.url, "_blank")}
                            />
                          ) : msg.attachment.type === "audio" ? (
                            <AudioVoiceNotePlayer url={msg.attachment.url} isSelf={msg.isSelf} />
                          ) : (
                            <div className={`flex items-center gap-2 p-2 rounded-xl border ${
                              msg.isSelf ? "bg-zinc-200/80 border-zinc-300" : "bg-zinc-900 border-zinc-800"
                            }`}>
                              <FileText size={14} className={msg.isSelf ? "text-zinc-800" : "text-zinc-300"} />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold truncate">{msg.attachment.name}</p>
                                <span className="text-[8px] opacity-70 font-mono">{msg.attachment.size}</span>
                              </div>
                              <a
                                href={msg.attachment.url}
                                download={msg.attachment.name}
                                className="p-1 rounded-lg hover:bg-black/10 transition"
                              >
                                <Download size={12} />
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Footer: Waktu & Aksi Edit/Hapus */}
                    <div className="flex items-center gap-1.5 mt-0.5 px-1">
                      <span className="text-[9px] text-zinc-500 font-mono">
                        {msg.time} {msg.isEdited && "(diedit)"}
                      </span>

                      {/* Tombol Aksi Edit & Hapus untuk Pesan Sendiri */}
                      {msg.isSelf && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-1">
                          {msg.text && (
                            <button
                              type="button"
                              onClick={() => handleStartEditMessage(msg)}
                              className="text-zinc-500 hover:text-white p-0.5 rounded cursor-pointer"
                              title="Edit Pesan"
                            >
                              <Edit2 size={10} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="text-zinc-500 hover:text-rose-400 p-0.5 rounded cursor-pointer"
                            title="Hapus Pesan"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Bar Kirim Pesan Real */}
            <div className="p-2.5 border-t border-zinc-800/80 bg-[#121215]">
              {/* Banner Edit Pesan */}
              {editingMessage && (
                <div className="mb-2 p-1.5 px-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 truncate">
                    <Edit2 size={12} className="text-amber-400 shrink-0" />
                    <span className="text-[11px] text-zinc-300 truncate">
                      Mengedit: <span className="text-white italic">"{editingMessage.text}"</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMessage(null);
                      setInputText("");
                    }}
                    className="text-zinc-400 hover:text-white p-0.5 cursor-pointer ml-2"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Banner Pending File */}
              {pendingFile && (
                <div className="mb-2 p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 truncate">
                    {pendingFile.type === "image" ? (
                      <ImageIcon size={14} className="text-zinc-300" />
                    ) : (
                      <FileText size={14} className="text-zinc-300" />
                    )}
                    <span className="text-[11px] text-zinc-300 truncate">{pendingFile.name}</span>
                  </div>
                  <button onClick={() => setPendingFile(null)} className="text-zinc-400 hover:text-white p-0.5 cursor-pointer">
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Baris Input / Voice Note Recording Bar */}
              {isRecording ? (
                <div className="flex items-center gap-2 w-full bg-[#1b1b1f] border border-rose-500/40 rounded-xl px-3 py-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-xs font-mono text-rose-400 font-semibold">
                    {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}
                  </span>
                  <div className="flex-1 text-[11px] text-zinc-400 italic truncate">
                    Merekam voice note...
                  </div>
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition cursor-pointer"
                    title="Batal Rekam"
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={stopAndSendRecording}
                    className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition cursor-pointer font-bold shadow"
                    title="Kirim Voice Note"
                  >
                    <Send size={13} />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="flex items-center gap-1.5">
                  {/* Hidden inputs untuk file & native camera */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={cameraInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {/* Tombol Berkas */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-xl bg-[#1a1a1e] hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition cursor-pointer"
                    title="Kirim File atau Foto"
                  >
                    <Paperclip size={14} />
                  </button>

                  {/* Tombol Kamera Langsung */}
                  <button
                    type="button"
                    onClick={openCamera}
                    className="p-2 rounded-xl bg-[#1a1a1e] hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition cursor-pointer"
                    title="Ambil Foto Kamera"
                  >
                    <Camera size={14} />
                  </button>

                  {/* Tombol Voice Note */}
                  <button
                    type="button"
                    onClick={startRecording}
                    className="p-2 rounded-xl bg-[#1a1a1e] hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 border border-zinc-800 transition cursor-pointer"
                    title="Rekam Voice Note"
                  >
                    <Mic size={14} />
                  </button>

                  {/* Input Teks (dengan support Paste Ctrl+V) */}
                  <input
                    type="text"
                    value={inputText}
                    onPaste={handlePaste}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      editingMessage
                        ? "Ketik untuk memperbarui pesan..."
                        : `Tulis pesan ke ${getChannelDisplayName(activeChannel)}... (Ctrl+V screenshot)`
                    }
                    className="flex-1 bg-[#1a1a1e] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
                  />

                  {/* Tombol Kirim / Update */}
                  <button
                    type="submit"
                    disabled={(!inputText.trim() && !pendingFile) || isSending}
                    className="p-2 rounded-xl bg-white hover:bg-zinc-200 disabled:opacity-40 disabled:hover:bg-white text-zinc-950 transition cursor-pointer shadow"
                    title={editingMessage ? "Perbarui Pesan" : "Kirim Pesan"}
                  >
                    {isSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* ========================================================= */}
      {/* MODAL KAMERA LANGSUNG                                     */}
      {/* ========================================================= */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#141417] border border-zinc-800 rounded-2xl p-4 max-w-md w-full space-y-3 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2 text-white text-sm font-semibold">
                <Camera size={16} />
                <span>Ambil Foto Kamera</span>
              </div>
              <button
                onClick={closeCamera}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="relative aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center border border-zinc-800">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  closeCamera();
                  cameraInputRef.current?.click();
                }}
                className="text-xs text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
              >
                Buka kamera bawaan HP / OS
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                className="px-5 py-2 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 font-semibold text-xs flex items-center gap-1.5 shadow cursor-pointer"
              >
                <Camera size={14} />
                <span>Jepret Foto</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL BUAT CHANNEL / GRUP BARU                            */}
      {/* ========================================================= */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#141417] border border-zinc-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-white" />
                <h3 className="text-sm font-bold text-white">Buat Grup Chat Baru</h3>
              </div>
              <button 
                onClick={() => setIsGroupModalOpen(false)} 
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-300 mb-1 font-medium">Nama Grup</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Project Branding, Tim Kreatif Sika"
                  className="w-full bg-[#1b1b1f] border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-zinc-600"
                />
              </div>

              <div>
                <label className="block text-zinc-300 mb-1 font-medium">Deskripsi (Opsional)</label>
                <input
                  type="text"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="e.g. Diskusi harian tim kreatif"
                  className="w-full bg-[#1b1b1f] border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-zinc-600"
                />
              </div>

              <div>
                <label className="block text-zinc-300 mb-1.5 font-medium">
                  Pilih Anggota ({selectedMembers.length} dipilih)
                </label>
                <div className="flex flex-col gap-1 p-2 bg-[#1b1b1f] border border-zinc-800 rounded-xl max-h-36 overflow-y-auto no-scrollbar">
                  {teamMembers.length === 0 ? (
                    <span className="text-zinc-500 text-[11px] p-2 text-center">Belum ada anggota terdaftar</span>
                  ) : (
                    teamMembers.map((member) => {
                      const isSelected = selectedMembers.includes(member.id);
                      const online = isUserOnline(member);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => toggleMemberSelection(member.id)}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-[11px] transition cursor-pointer border flex items-center justify-between text-left ${
                            isSelected
                              ? "bg-zinc-800 text-white border-zinc-700 font-medium"
                              : "bg-transparent text-zinc-400 border-transparent hover:bg-zinc-900 hover:text-zinc-200"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <div className="relative shrink-0">
                              <span className="w-5 h-5 rounded-full bg-zinc-700/60 text-[9px] flex items-center justify-center font-bold text-zinc-200">
                                {(member.name || member.email).slice(0, 1).toUpperCase()}
                              </span>
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-[#1b1b1f] ${
                                  online ? "bg-emerald-400" : "bg-zinc-500"
                                }`}
                              />
                            </div>
                            <span className="truncate">{member.name || member.email}</span>
                          </div>
                          {isSelected && <Check size={12} className="text-white shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingGroup || !newGroupName.trim()}
                  className="flex-1 py-2 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isCreatingGroup ? "Membuat..." : "Buat Grup"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}