"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
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
  ChevronDown, 
  Download,
  Users,
  Check,
  CheckCheck,
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
  Forward,
  Copy,
  Reply,
  Maximize2,
  Sparkles,
  RefreshCw
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
  isForwarded?: boolean;
  replyToSender?: string | null;
  replyToText?: string | null;
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
// 1. HELPER: Client-side Image Compression
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
// 2. HELPER: Download Media File (Foto / Audio / File)
// ==========================================
const downloadMedia = async (url: string, filename = "file") => {
  try {
    if (url.startsWith("data:")) {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (err) {
    window.open(url, "_blank");
  }
};

// ==========================================
// 3. HELPER: Auto-linkify URLs dalam Pesan Chat
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
            isSelf ? "text-emerald-200 hover:text-white" : "text-sky-400 hover:text-sky-300"
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
// 4. HELPER: Notifikasi Chime (Web Audio API)
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
// 5. SUBCOMPONENT: Audio Voice Note Player ala WhatsApp
// ==========================================
function AudioVoiceNotePlayer({ url, isSelf }: { url: string; isSelf: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onDurationChange = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("durationchange", onDurationChange);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("durationchange", onDurationChange);
    };
  }, [speed]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        console.warn("Gagal memutar audio:", err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleSpeed = () => {
    const nextSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0 || !isFinite(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className={`flex items-center gap-2 p-2 rounded-2xl min-w-[210px] sm:min-w-[250px] transition shadow-sm ${
      isSelf ? "bg-[#0b4d3f] text-emerald-50" : "bg-[#1f2c34] text-zinc-100"
    }`}>
      <audio ref={audioRef} src={url} preload="auto" />

      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition cursor-pointer shadow-md active:scale-95 ${
          isSelf 
            ? "bg-emerald-400 text-zinc-950 hover:bg-emerald-300" 
            : "bg-[#25d366] text-zinc-950 hover:bg-[#20bd5a]"
        }`}
        title={isPlaying ? "Jeda" : "Putar Voice Note"}
      >
        {isPlaying ? <Pause size={14} className="fill-current" /> : <Play size={14} className="fill-current ml-0.5" />}
      </button>

      <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
        <input
          type="range"
          min="0"
          max={duration || (currentTime > 0 ? currentTime : 1)}
          step="0.05"
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#25d366]"
        />
        <div className="flex items-center justify-between text-[10px] font-mono opacity-80">
          <span>{formatTime(currentTime)}</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleSpeed}
              className="px-1.5 py-0.5 rounded bg-black/20 hover:bg-black/30 font-semibold text-[9px] transition cursor-pointer"
              title="Kecepatan putar"
            >
              {speed}x
            </button>
            <Mic size={10} className="opacity-75" />
            <span>{formatTime(duration || currentTime)}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => downloadMedia(url, `voice-note-${Date.now()}.webm`)}
        className="p-1.5 rounded-full hover:bg-black/20 text-white/70 hover:text-white transition cursor-pointer shrink-0"
        title="Download Voice Note"
      >
        <Download size={13} />
      </button>
    </div>
  );
}

// ==========================================
// MAIN COMPONENT: TeamChatSidebar (WhatsApp Desktop Edition)
// ==========================================
export function TeamChatSidebar() {
  const { user } = useUser();
  const currentUserId = user?.id || "guest";
  const currentUserName = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || "You";
  const currentUserImage = user?.imageUrl || "";

  // Tampilan Utama Chat Box
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "groups" | "direct">("all");
  const [showMobileChat, setShowMobileChat] = useState(false);

  // Data Realtime dari Database
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

  // Reply Message State (Balas pesan)
  const [replyingMessage, setReplyingMessage] = useState<Message | null>(null);

  // Forward Message Modal State (Teruskan pesan)
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [forwardSearchQuery, setForwardSearchQuery] = useState("");
  const [isForwarding, setIsForwarding] = useState(false);

  // Context Menu State (Menu opsi titik tiga / chevron ala WhatsApp)
  const [contextMenuMsg, setContextMenuMsg] = useState<{ id: string; x: number; y: number } | null>(null);

  // Lightbox Image Preview
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

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

  // Camera State (TIDAK MIRROR / NORMAL)
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isCameraMirrored, setIsCameraMirrored] = useState(false); // Default: TIDAK mirror
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
  const contextMenuRef = useRef<HTMLDivElement>(null);
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

  // Tutup context menu saat klik luar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenuMsg(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  // Tandai sudah dibaca saat channel dibuka
  useEffect(() => {
    if (isOpen && activeChannelId) {
      updateLastRead(activeChannelId);
      loadMessages(activeChannelId);
    }
  }, [isOpen, activeChannelId]);

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
            isForwarded: m.isForwarded || false,
            replyToSender: m.replyToSender || null,
            replyToText: m.replyToText || null,
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
  }, [messages, activeChannelId, isOpen, showMobileChat]);

  // Cek apakah user sedang online
  const isUserOnline = (member: TeamMember) => {
    if (member.id === currentUserId) return true;
    if (!member.lastActiveAt) return false;
    const lastActive = new Date(member.lastActiveAt).getTime();
    if (isNaN(lastActive)) return false;
    return Date.now() - lastActive < 90 * 1000;
  };

  // Nama Tampilan Saluran
  const getChannelDisplayName = (channel: Channel) => {
    if (channel.type === "direct") {
      const parts = channel.name.split(" & ");
      if (parts.length === 2) {
        return parts[0] === currentUserName ? parts[1] : parts[0];
      }
      return channel.name;
    }
    const cleanName = channel.name.replace(/^#+/, "").trim();
    return cleanName;
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

  // Gabungan List Percakapan ala WhatsApp Desktop
  const conversationList = useMemo(() => {
    const items: Array<{
      id: string;
      name: string;
      subtitle: string;
      type: "group" | "direct";
      avatarUrl?: string;
      isOnline?: boolean;
      unread: number;
      lastMsg?: Message;
    }> = [];

    // Tambah group channels
    for (const ch of channels.filter((c) => c.type === "group")) {
      const msgs = messages[ch.id] || [];
      const lastMsg = msgs[msgs.length - 1];
      const unread = unreadCounts[ch.id] || 0;
      items.push({
        id: ch.id,
        name: getChannelDisplayName(ch),
        subtitle: ch.description || "Grup Tim",
        type: "group",
        unread,
        lastMsg,
      });
    }

    // Tambah direct conversations / users
    for (const member of teamMembers.filter((m) => m.id !== currentUserId)) {
      const sortedIds = [currentUserId, member.id].sort();
      const dmChannelId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
      const msgs = messages[dmChannelId] || [];
      const lastMsg = msgs[msgs.length - 1];
      const unread = unreadCounts[dmChannelId] || 0;
      const online = isUserOnline(member);
      items.push({
        id: dmChannelId,
        name: member.name || member.email,
        subtitle: online ? "Online" : "Rekan Tim",
        type: "direct",
        avatarUrl: member.imageUrl,
        isOnline: online,
        unread,
        lastMsg,
      });
    }

    // Filter berdasarkan query & tab
    return items.filter((item) => {
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;
      if (activeTab === "groups") return item.type === "group";
      if (activeTab === "direct") return item.type === "direct";
      return true;
    });
  }, [channels, teamMembers, currentUserId, messages, unreadCounts, searchQuery, activeTab]);

  // ==========================================
  // HANDLERS: Kirim, Edit, Hapus, Forward Pesan
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

  // Kamera Capture Handlers (NORMAL / TIDAK MIRROR)
  const openCamera = async () => {
    try {
      setIsCameraModalOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn("Gagal membuka webcam langsung, fallback ke input kamera:", err);
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
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Pastikan orientasi normal (TIDAK mirror)
    if (isCameraMirrored) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.drawImage(video, 0, 0, width, height);

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

  // Voice Note Recording Handlers (DIPERBAIKI AGAR ADA SUARANYA)
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Deteksi mimeType yang didukung browser
      let mimeType = "";
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
        "audio/aac",
      ];
      for (const candidate of candidates) {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(candidate)) {
          mimeType = candidate;
          break;
        }
      }

      const recorderOptions: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      // Mulai dengan timeslice 200ms agar data audio di-flush berkala
      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      alert("Akses mikrofon ditolak atau tidak tersedia. Pastikan izin mic diaktifkan di browser.");
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
    }
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const stopAndSendRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);

    const recorder = mediaRecorderRef.current;

    recorder.onstop = async () => {
      // Matikan audio tracks setelah data selesai terkumpul
      recorder.stream?.getTracks().forEach((t) => t.stop());

      const actualMime = recorder.mimeType || "audio/webm";
      const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });

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

    recorder.stop();
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
    const replySender = replyingMessage?.sender || undefined;
    const replyText = replyingMessage?.text || (replyingMessage?.attachment ? `[${replyingMessage.attachment.type}]` : undefined);

    setInputText("");
    setPendingFile(null);
    setReplyingMessage(null);
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
      replyToSender: replySender,
      replyToText: replyText,
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
        replyToSender: replySender,
        replyToText: replyText,
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
    setContextMenuMsg(null);
  };

  // Hapus Pesan
  const handleDeleteMessage = async (msgId: string) => {
    setContextMenuMsg(null);
    if (!confirm("Hapus pesan ini?")) return;

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

  // Salin Teks Pesan
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setContextMenuMsg(null);
  };

  // Balas Pesan
  const handleReplyMessage = (msg: Message) => {
    setReplyingMessage(msg);
    setContextMenuMsg(null);
  };

  // Mulai Teruskan Pesan
  const handleStartForward = (msg: Message) => {
    setForwardingMessage(msg);
    setContextMenuMsg(null);
  };

  // Kirim Teruskan Pesan ke Channel / DM Pilihan
  const handleConfirmForward = async (targetChannelId: string) => {
    if (!forwardingMessage || isForwarding) return;
    setIsForwarding(true);

    try {
      await sendChatMessage({
        channelId: targetChannelId,
        sender: currentUserName,
        senderId: currentUserId,
        senderImage: currentUserImage,
        text: forwardingMessage.text || "",
        fileUrl: forwardingMessage.attachment?.url,
        fileType: forwardingMessage.attachment?.type,
        isForwarded: true,
      });

      setActiveChannelId(targetChannelId);
      setShowMobileChat(true);
      setForwardingMessage(null);
      loadMessages(targetChannelId);
      updateLastRead(targetChannelId);
    } catch (err: any) {
      alert("Gagal meneruskan pesan: " + err?.message);
    } finally {
      setIsForwarding(false);
    }
  };

  // Buka Direct Chat dari list
  const handleSelectConversation = async (item: { id: string; type: "group" | "direct"; name: string }) => {
    setActiveChannelId(item.id);
    setShowMobileChat(true);
    updateLastRead(item.id);

    // Jika DM dan belum tersimpan di state channels
    if (item.type === "direct") {
      const member = teamMembers.find((m) => (m.name || m.email) === item.name);
      if (member) {
        try {
          const res = await getOrCreateDirectChannelAction(
            currentUserId,
            currentUserName,
            member.id,
            member.name || member.email
          );
          if (res.success && res.channel) {
            setChannels((prev) => {
              if (prev.some((c) => c.id === res.channel!.id)) return prev;
              return [...prev, res.channel as Channel];
            });
          }
        } catch {}
      }
    }
  };

  // Klik notifikasi untuk langsung menuju chat
  const handleOpenFromNotification = (channelId: string) => {
    setActiveChannelId(channelId);
    setIsOpen(true);
    setShowMobileChat(true);
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
        setShowMobileChat(true);
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
        setShowMobileChat(false);
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
      {/* 1. NOTIFIKASI POPUP MINIMALIS DI POJOK KIRI BAWAH         */}
      {/* ========================================================= */}
      {unreadNotification && !isOpen && (
        <div className="fixed bottom-20 left-5 z-50 max-w-sm w-auto animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div
            onClick={() => handleOpenFromNotification(unreadNotification.channelId)}
            className="bg-[#111b21] border border-[#222e35] hover:border-[#25d366]/50 text-white p-3.5 rounded-2xl shadow-2xl flex items-start gap-3 cursor-pointer transition hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="relative shrink-0">
              {unreadNotification.senderImage ? (
                <img
                  src={unreadNotification.senderImage}
                  alt={unreadNotification.sender}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white font-bold text-sm">
                  {(unreadNotification.sender || "U").slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#25d366] ring-2 ring-[#111b21] flex items-center justify-center">
                <MessageSquare size={8} className="text-black fill-current" />
              </span>
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center justify-between gap-2">
                <h5 className="text-xs font-semibold text-white truncate">{unreadNotification.sender}</h5>
                <span className="text-[10px] text-[#8696a0] shrink-0">{unreadNotification.time}</span>
              </div>
              {unreadNotification.channelName && (
                <span className="text-[10px] text-[#25d366] font-medium block truncate">
                  {unreadNotification.channelName}
                </span>
              )}
              <p className="text-xs text-[#d1d7db] line-clamp-2 mt-0.5 break-words">
                {unreadNotification.text}
              </p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setUnreadNotification(null);
              }}
              className="text-[#8696a0] hover:text-white p-1 rounded-lg hover:bg-white/10 transition -mr-1 -mt-1 cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. FLOATING LOGO CHAT BUTTON DI BAWAH KIRI (COLLAPSED)    */}
      {/* ========================================================= */}
      <div className="fixed bottom-5 left-5 z-40">
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) setShowMobileChat(false);
          }}
          className={`relative group flex items-center gap-2.5 px-3.5 py-2.5 rounded-full shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer active:scale-95 ${
            isOpen
              ? "bg-[#202c33] text-white border border-[#2a3942]"
              : "bg-gradient-to-r from-[#005c4b] to-[#008069] text-white border border-[#25d366]/40 hover:brightness-110 shadow-[0_4px_24px_rgba(0,128,105,0.4)]"
          }`}
          title={isOpen ? "Tutup Chat Tim" : "Buka Chat Tim (WhatsApp Style)"}
        >
          <div className="relative flex items-center justify-center">
            {isOpen ? (
              <X size={18} className="transition-transform rotate-0 group-hover:rotate-90 duration-200" />
            ) : (
              <MessageSquare size={18} className="fill-current text-white" />
            )}

            {/* Badge Notifikasi Unread */}
            {!isOpen && totalUnreadCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[#25d366] text-black text-[10px] font-bold flex items-center justify-center ring-2 ring-[#0b141a] shadow-lg animate-pulse">
                {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
              </span>
            )}
          </div>

          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-semibold tracking-wide">
              {isOpen ? "Tutup Chat" : "Team Chat"}
            </span>
            <span className="text-[9px] text-emerald-200/80 font-mono">
              WhatsApp OS
            </span>
          </div>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 3. KOTAK CHATBOX ALA WHATSAPP DESKTOP DENGAN SMOOTH TRANSISI */}
      {/* ========================================================= */}
      <div
        className={`fixed bottom-20 left-5 z-50 w-[calc(100vw-40px)] sm:w-[440px] md:w-[780px] h-[600px] max-h-[82vh] bg-[#111b21] border border-[#222e35] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col origin-bottom-left transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen
            ? "scale-100 opacity-100 translate-y-0 pointer-events-auto"
            : "scale-90 opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <div className="flex-1 flex overflow-hidden">
          
          {/* ======================================================= */}
          {/* KOLOM KIRI: DAFTAR CHAT / KONTAK ALA WA DESKTOP         */}
          {/* ======================================================= */}
          <div className={`w-full md:w-72 lg:w-80 flex flex-col border-r border-[#222e35] bg-[#111b21] shrink-0 ${
            showMobileChat ? "hidden md:flex" : "flex"
          }`}>
            
            {/* Header Profil Sendiri & Tombol Tambah Grup */}
            <div className="p-3.5 bg-[#202c33] flex items-center justify-between border-b border-[#222e35]">
              <div className="flex items-center gap-2.5 min-w-0">
                {currentUserImage ? (
                  <img src={currentUserImage} alt={currentUserName} className="w-9 h-9 rounded-full object-cover ring-1 ring-white/20" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center text-white font-bold text-xs ring-1 ring-white/20">
                    {(currentUserName || "U")[0]?.toUpperCase()}
                  </div>
                )}
                <div className="truncate">
                  <h4 className="text-xs font-semibold text-[#e9edef] truncate leading-tight">{currentUserName}</h4>
                  <span className="text-[10px] text-[#00a884] font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#25d366] shadow-[0_0_6px_#25d366]" />
                    Online
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(true)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-[#aebac1] hover:text-white transition cursor-pointer"
                  title="Buat Grup Baru"
                >
                  <Plus size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-[#aebac1] hover:text-white transition cursor-pointer"
                  title="Tutup Chat"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Search Input Bar ala WA */}
            <div className="p-2.5 bg-[#111b21] border-b border-[#222e35]/60 flex flex-col gap-2">
              <div className="relative flex items-center">
                <Search size={14} className="absolute left-3 text-[#8696a0]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari atau mulai chat baru..."
                  className="w-full bg-[#202c33] border-none rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#d1d7db] placeholder:text-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                />
              </div>

              {/* Filter Tabs: Semua, Grup, Pribadi */}
              <div className="flex items-center gap-1">
                {(["all", "groups", "direct"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium transition cursor-pointer ${
                      activeTab === tab
                        ? "bg-[#00a884] text-white font-semibold"
                        : "bg-[#202c33] text-[#8696a0] hover:text-[#d1d7db]"
                    }`}
                  >
                    {tab === "all" ? "Semua" : tab === "groups" ? "Grup" : "Pribadi"}
                  </button>
                ))}
              </div>
            </div>

            {/* List Percakapan */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#222e35]/40 no-scrollbar">
              {conversationList.length === 0 ? (
                <div className="p-8 text-center text-[#8696a0] text-xs space-y-1">
                  <p className="font-medium text-[#d1d7db]">Tidak ada chat ditemukan</p>
                  <p className="text-[11px]">Coba cari dengan kata kunci lain</p>
                </div>
              ) : (
                conversationList.map((item) => {
                  const isCurrent = activeChannelId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectConversation(item)}
                      className={`px-3.5 py-3 flex items-center gap-3 cursor-pointer transition select-none ${
                        isCurrent
                          ? "bg-[#2a3942]"
                          : "hover:bg-[#202c33]/70 active:bg-[#202c33]"
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        {item.type === "group" ? (
                          <div className="w-11 h-11 rounded-full bg-[#005c4b] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                            <Users size={17} />
                          </div>
                        ) : item.avatarUrl ? (
                          <img src={item.avatarUrl} alt={item.name} className="w-11 h-11 rounded-full object-cover" />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-[#202c33] border border-[#2a3942] flex items-center justify-center text-[#00a884] font-bold text-sm">
                            {(item.name || "U")[0]?.toUpperCase()}
                          </div>
                        )}

                        {item.type === "direct" && item.isOnline && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#25d366] ring-2 ring-[#111b21]" />
                        )}
                      </div>

                      {/* Info & Last Message Snippet */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <h5 className="text-xs font-semibold text-[#e9edef] truncate">{item.name}</h5>
                          {item.lastMsg?.time && (
                            <span className="text-[10px] text-[#8696a0] shrink-0 font-mono">
                              {item.lastMsg.time}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-[#8696a0] truncate flex items-center gap-1">
                            {item.lastMsg?.isSelf && (
                              <CheckCheck size={13} className="text-[#53bdeb] shrink-0" />
                            )}
                            <span className="truncate">
                              {item.lastMsg?.text || (item.lastMsg?.attachment?.type === "image" ? "📷 Foto" : item.lastMsg?.attachment?.type === "audio" ? "🎤 Voice Note" : item.subtitle)}
                            </span>
                          </p>

                          {item.unread > 0 && (
                            <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-[#25d366] text-black text-[10px] font-bold flex items-center justify-center shrink-0">
                              {item.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ======================================================= */}
          {/* KOLOM KANAN: RUANG CHAT AKTIF ALA WHATSAPP DESKTOP      */}
          {/* ======================================================= */}
          <div className={`flex-1 flex flex-col bg-[#0b141a] min-w-0 ${
            !showMobileChat ? "hidden md:flex" : "flex"
          }`}>
            
            {/* Header Saluran Aktif ala WhatsApp */}
            <div className="p-3 bg-[#202c33] flex items-center justify-between border-b border-[#222e35] shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Tombol Back di Mobile */}
                <button
                  type="button"
                  onClick={() => setShowMobileChat(false)}
                  className="md:hidden p-1.5 rounded-full hover:bg-white/10 text-[#aebac1] hover:text-white cursor-pointer mr-0.5"
                  title="Kembali ke Daftar Chat"
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="relative shrink-0">
                  {activeChannel.type === "group" ? (
                    <div className="w-10 h-10 rounded-full bg-[#005c4b] text-white flex items-center justify-center font-bold text-sm shadow">
                      <Users size={16} />
                    </div>
                  ) : activeDmPartner?.imageUrl ? (
                    <img src={activeDmPartner.imageUrl} alt={activeDmPartner.name || ""} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#111b21] border border-[#2a3942] flex items-center justify-center text-[#00a884] font-bold text-sm">
                      {(getChannelDisplayName(activeChannel) || "U")[0]?.toUpperCase()}
                    </div>
                  )}

                  {activeChannel.type === "direct" && isDmPartnerOnline && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#25d366] ring-2 ring-[#202c33]" />
                  )}
                </div>

                <div className="truncate">
                  <h4 className="text-xs font-semibold text-[#e9edef] truncate leading-tight">
                    {getChannelDisplayName(activeChannel)}
                  </h4>
                  <p className="text-[10px] text-[#8696a0] truncate">
                    {activeChannel.type === "direct"
                      ? isDmPartnerOnline ? "Online" : "Offline"
                      : activeChannel.description || "Grup Tim"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {activeChannel.id !== "general" && activeChannel.type === "group" && (
                  <button
                    type="button"
                    onClick={() => handleDeleteGroup(activeChannel.id)}
                    className="p-1.5 rounded-full hover:bg-rose-500/10 text-[#8696a0] hover:text-rose-400 transition cursor-pointer"
                    title="Hapus Grup Ini"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-[#aebac1] hover:text-white transition cursor-pointer"
                  title="Tutup Chat"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Area Pesan Chat Realtime (WhatsApp Background) */}
            <div
              onPaste={handlePaste}
              className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-0 bg-[#0b141a] bg-opacity-95"
              style={{
                backgroundImage: `radial-gradient(circle at 50% 50%, rgba(32, 44, 51, 0.25) 1px, transparent 1px)`,
                backgroundSize: "24px 24px",
              }}
            >
              {activeMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[#8696a0] text-xs gap-2 text-center px-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#202c33] flex items-center justify-center text-[#00a884]">
                    <MessageCircle size={24} />
                  </div>
                  <p className="font-medium text-[#e9edef]">Mulai obrolan WhatsApp</p>
                  <span className="text-[11px] text-[#8696a0] max-w-xs">
                    Kirim pesan pertama ke {getChannelDisplayName(activeChannel)}. Berbagi ide, tugas, foto & voice note secara realtime.
                  </span>
                </div>
              ) : (
                activeMessages.map((msg) => {
                  const isImageOnly = msg.attachment?.type === "image" && !msg.text;
                  const isMenuOpen = contextMenuMsg?.id === msg.id;

                  return (
                    <div
                      key={msg.id}
                      className={`group relative flex flex-col ${msg.isSelf ? "items-end" : "items-start"}`}
                    >
                      {/* Nama Pengirim untuk Pesan Orang Lain di Grup */}
                      {!msg.isSelf && activeChannel.type === "group" && (
                        <div className="flex items-center gap-1.5 mb-0.5 ml-2">
                          <span className="text-[10px] text-[#00a884] font-semibold">
                            {msg.sender}
                          </span>
                        </div>
                      )}

                      {/* Bubble Pesan WhatsApp */}
                      <div
                        className={`relative rounded-2xl text-xs leading-relaxed shadow-sm transition max-w-[85%] sm:max-w-[75%] ${
                          isImageOnly
                            ? "p-1 bg-transparent"
                            : msg.isSelf
                            ? "bg-[#005c4b] text-[#e9edef] p-2.5 rounded-tr-xs"
                            : "bg-[#202c33] text-[#e9edef] p-2.5 rounded-tl-xs"
                        }`}
                      >
                        {/* Tombol Chevron Dropdown Opsi WhatsApp di Pojok Atas */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setContextMenuMsg(
                              isMenuOpen ? null : { id: msg.id, x: rect.right, y: rect.bottom }
                            );
                          }}
                          className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 z-10 w-5 h-5 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition cursor-pointer"
                          title="Menu Pesan"
                        >
                          <ChevronDown size={12} />
                        </button>

                        {/* Banner "Diteruskan" (Forwarded) */}
                        {msg.isForwarded && (
                          <div className="flex items-center gap-1 text-[10px] italic text-[#8696a0] mb-1 font-sans">
                            <Forward size={11} className="inline rotate-0" />
                            <span>Diteruskan</span>
                          </div>
                        )}

                        {/* Quote Box Balasan (Reply To) */}
                        {msg.replyToSender && (
                          <div className={`mb-1.5 p-1.5 px-2 rounded-lg border-l-3 text-[11px] select-none ${
                            msg.isSelf ? "bg-black/20 border-[#25d366]" : "bg-black/30 border-[#00a884]"
                          }`}>
                            <span className="font-semibold block text-[#25d366] text-[10px]">
                              {msg.replyToSender}
                            </span>
                            <span className="text-white/80 line-clamp-1 italic text-[10px]">
                              {msg.replyToText}
                            </span>
                          </div>
                        )}

                        {/* Lampiran Gambar (BEBAS BORDER, DILENGKAPI TOMBOL DOWNLOAD & ZOOM) */}
                        {msg.attachment?.type === "image" && (
                          <div className="relative group/img overflow-hidden rounded-xl mb-1">
                            <img
                              src={msg.attachment.url}
                              alt={msg.attachment.name}
                              className="max-h-72 w-auto object-cover rounded-xl cursor-pointer hover:opacity-95 transition"
                              onClick={() => setPreviewImage({ url: msg.attachment!.url, name: msg.attachment!.name })}
                            />
                            {/* Hover Overlay Tombol Download Foto */}
                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/img:opacity-100 transition">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadMedia(msg.attachment!.url, msg.attachment!.name || "foto.jpg");
                                }}
                                className="p-1.5 rounded-full bg-black/60 hover:bg-black text-white shadow-lg backdrop-blur-sm transition cursor-pointer"
                                title="Download Foto"
                              >
                                <Download size={13} />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Lampiran Voice Note (Audio Player) */}
                        {msg.attachment?.type === "audio" && (
                          <div className="mb-1">
                            <AudioVoiceNotePlayer url={msg.attachment.url} isSelf={msg.isSelf} />
                          </div>
                        )}

                        {/* Lampiran Berkas Dokumen */}
                        {msg.attachment?.type === "file" && (
                          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-black/20 mb-1 border border-white/5">
                            <FileText size={18} className="text-[#8696a0]" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold text-white truncate">{msg.attachment.name}</p>
                              <span className="text-[9px] text-[#8696a0] font-mono">{msg.attachment.size}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => downloadMedia(msg.attachment!.url, msg.attachment!.name)}
                              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                              title="Download Berkas"
                            >
                              <Download size={13} />
                            </button>
                          </div>
                        )}

                        {/* Teks Pesan Chat */}
                        {msg.text && (
                          <p className="whitespace-pre-wrap break-words pr-1 text-[12px]">
                            {renderMessageTextWithLinks(msg.text, msg.isSelf)}
                          </p>
                        )}

                        {/* Footer Bubble: Waktu, Tulisan 'edited', dan Checklist WhatsApp */}
                        <div className="flex items-center justify-end gap-1 mt-0.5 text-[9px] text-[#8696a0] font-mono select-none">
                          {msg.isEdited && (
                            <span className="italic text-[#8696a0] font-sans">edited</span>
                          )}
                          <span>{msg.time}</span>
                          {msg.isSelf && (
                            <CheckCheck size={12} className="text-[#53bdeb]" />
                          )}
                        </div>
                      </div>

                      {/* CONTEXT MENU ALA WHATSAPP (Info, Balas, Salin, Teruskan, Edit, Hapus) */}
                      {isMenuOpen && (
                        <div
                          ref={contextMenuRef}
                          className="absolute right-0 top-8 z-30 w-44 bg-[#233138] border border-[#2a3942] rounded-xl shadow-2xl py-1.5 text-xs text-[#d1d7db] space-y-0.5 animate-in fade-in zoom-in-95 duration-150"
                        >
                          <button
                            type="button"
                            onClick={() => handleReplyMessage(msg)}
                            className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-[#182229] transition cursor-pointer text-left"
                          >
                            <Reply size={14} className="text-[#8696a0]" />
                            <span>Balas</span>
                          </button>

                          {msg.text && (
                            <button
                              type="button"
                              onClick={() => handleCopyText(msg.text)}
                              className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-[#182229] transition cursor-pointer text-left"
                            >
                              <Copy size={14} className="text-[#8696a0]" />
                              <span>Salin Teks</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleStartForward(msg)}
                            className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-[#182229] transition cursor-pointer text-left"
                          >
                            <Forward size={14} className="text-[#8696a0]" />
                            <span>Teruskan</span>
                          </button>

                          {msg.attachment?.type === "image" && (
                            <button
                              type="button"
                              onClick={() => {
                                downloadMedia(msg.attachment!.url, msg.attachment!.name || "foto.jpg");
                                setContextMenuMsg(null);
                              }}
                              className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-[#182229] transition cursor-pointer text-left"
                            >
                              <Download size={14} className="text-[#8696a0]" />
                              <span>Download Foto</span>
                            </button>
                          )}

                          {msg.isSelf && msg.text && (
                            <button
                              type="button"
                              onClick={() => handleStartEditMessage(msg)}
                              className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-[#182229] transition cursor-pointer text-left text-amber-300"
                            >
                              <Edit2 size={14} />
                              <span>Edit Pesan</span>
                            </button>
                          )}

                          {msg.isSelf && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-rose-500/10 transition cursor-pointer text-left text-rose-400"
                            >
                              <Trash2 size={14} />
                              <span>Hapus Pesan</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Bar WhatsApp */}
            <div className="p-2.5 bg-[#202c33] border-t border-[#222e35]">
              {/* Banner Membalas Pesan (Reply Banner) */}
              {replyingMessage && (
                <div className="mb-2 p-2 rounded-xl bg-[#182229] border-l-4 border-[#25d366] flex items-center justify-between text-xs">
                  <div className="truncate">
                    <span className="text-[10px] text-[#25d366] font-semibold block">
                      Membalas ke {replyingMessage.sender}:
                    </span>
                    <span className="text-[#d1d7db] truncate block text-[11px]">
                      {replyingMessage.text || "[Lampiran]"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingMessage(null)}
                    className="text-[#8696a0] hover:text-white p-1 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Banner Mengedit Pesan (Edit Banner) */}
              {editingMessage && (
                <div className="mb-2 p-2 rounded-xl bg-[#182229] border-l-4 border-amber-400 flex items-center justify-between text-xs">
                  <div className="truncate">
                    <span className="text-[10px] text-amber-400 font-semibold block">
                      Mengedit Pesan:
                    </span>
                    <span className="text-[#d1d7db] truncate block text-[11px]">
                      "{editingMessage.text}"
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMessage(null);
                      setInputText("");
                    }}
                    className="text-[#8696a0] hover:text-white p-1 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Banner Pending File / Foto */}
              {pendingFile && (
                <div className="mb-2 p-2 rounded-xl bg-[#182229] border border-[#2a3942] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    {pendingFile.type === "image" ? (
                      <ImageIcon size={16} className="text-[#00a884]" />
                    ) : (
                      <FileText size={16} className="text-[#00a884]" />
                    )}
                    <span className="text-[#d1d7db] truncate text-[11px] font-medium">{pendingFile.name}</span>
                    <span className="text-[9px] text-[#8696a0] font-mono">({pendingFile.size})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingFile(null)}
                    className="text-[#8696a0] hover:text-white p-1 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Baris Input / Voice Note Bar */}
              {isRecording ? (
                <div className="flex items-center gap-2 w-full bg-[#182229] border border-rose-500/40 rounded-full px-4 py-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-xs font-mono text-rose-400 font-bold">
                    {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}
                  </span>
                  <div className="flex-1 text-[11px] text-[#8696a0] italic truncate">
                    Merekam voice note...
                  </div>
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="p-1.5 rounded-full text-[#8696a0] hover:text-rose-400 transition cursor-pointer"
                    title="Batal Rekam"
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={stopAndSendRecording}
                    className="p-2 rounded-full bg-[#25d366] hover:bg-[#20bd5a] text-black transition cursor-pointer font-bold shadow"
                    title="Kirim Voice Note"
                  >
                    <Send size={14} className="fill-current" />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
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

                  {/* Tombol Lampiran Berkas */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-full hover:bg-white/10 text-[#8696a0] hover:text-white transition cursor-pointer"
                    title="Kirim Berkas atau Foto"
                  >
                    <Paperclip size={18} />
                  </button>

                  {/* Tombol Kamera Langsung */}
                  <button
                    type="button"
                    onClick={openCamera}
                    className="p-2 rounded-full hover:bg-white/10 text-[#8696a0] hover:text-white transition cursor-pointer"
                    title="Ambil Foto Kamera"
                  >
                    <Camera size={18} />
                  </button>

                  {/* Input Teks WhatsApp */}
                  <input
                    type="text"
                    value={inputText}
                    onPaste={handlePaste}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      editingMessage
                        ? "Ketik pesan baru..."
                        : "Ketik pesan..."
                    }
                    className="flex-1 bg-[#2a3942] text-[#d1d7db] placeholder:text-[#8696a0] text-xs rounded-full px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                  />

                  {/* Tombol Voice Note jika input kosong, atau Kirim jika ada teks */}
                  {!inputText.trim() && !pendingFile && !editingMessage ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="p-2.5 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-white transition cursor-pointer shadow active:scale-95"
                      title="Tahan / Klik untuk Rekam Voice Note"
                    >
                      <Mic size={16} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={(!inputText.trim() && !pendingFile) || isSending}
                      className="p-2.5 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-white disabled:opacity-40 transition cursor-pointer shadow active:scale-95"
                      title={editingMessage ? "Perbarui Pesan" : "Kirim Pesan"}
                    >
                      {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="fill-current" />}
                    </button>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. MODAL TERUSKAN PESAN (FORWARD MODAL ALA WHATSAPP)      */}
      {/* ========================================================= */}
      {forwardingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#111b21] border border-[#222e35] rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222e35] pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Forward size={17} className="text-[#00a884]" />
                <span>Teruskan pesan ke</span>
              </div>
              <button
                type="button"
                onClick={() => setForwardingMessage(null)}
                className="text-[#8696a0] hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Preview Pesan yang Diteruskan */}
            <div className="p-2.5 rounded-xl bg-[#202c33] text-xs text-[#d1d7db] max-h-20 overflow-y-auto italic border-l-3 border-[#00a884]">
              {forwardingMessage.text || (forwardingMessage.attachment ? `[Lampiran: ${forwardingMessage.attachment.type}]` : "Pesan")}
            </div>

            {/* Search Kontak / Saluran */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-[#8696a0]" />
              <input
                type="text"
                value={forwardSearchQuery}
                onChange={(e) => setForwardSearchQuery(e.target.value)}
                placeholder="Cari saluran atau rekan..."
                className="w-full bg-[#202c33] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#00a884]"
              />
            </div>

            {/* Daftar Pilihan Kontak & Saluran */}
            <div className="space-y-1 max-h-56 overflow-y-auto no-scrollbar">
              {conversationList
                .filter((item) => item.name.toLowerCase().includes(forwardSearchQuery.toLowerCase()))
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isForwarding}
                    onClick={() => handleConfirmForward(item.id)}
                    className="w-full p-2.5 rounded-xl flex items-center justify-between hover:bg-[#202c33] transition cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-8 h-8 rounded-full bg-[#00a884] flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {item.type === "group" ? <Users size={14} /> : item.name[0]?.toUpperCase()}
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-semibold text-white block truncate">{item.name}</span>
                        <span className="text-[10px] text-[#8696a0] block truncate">{item.subtitle}</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-[#00a884] px-2.5 py-1 rounded-lg bg-[#00a884]/10 hover:bg-[#00a884]/20 transition shrink-0">
                      Kirim
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. MODAL KAMERA LANGSUNG (TIDAK MIRROR / NORMAL)          */}
      {/* ========================================================= */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#111b21] border border-[#222e35] rounded-3xl p-5 max-w-md w-full space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#222e35]">
              <div className="flex items-center gap-2 text-white text-sm font-semibold">
                <Camera size={16} className="text-[#00a884]" />
                <span>Ambil Foto Kamera (Normal)</span>
              </div>
              <button
                type="button"
                onClick={closeCamera}
                className="text-[#8696a0] hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-[#222e35]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ transform: isCameraMirrored ? "scaleX(-1)" : "none" }}
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setIsCameraMirrored(!isCameraMirrored)}
                className="text-xs text-[#8696a0] hover:text-white flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-white/5 transition cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>Cermin Kamera: {isCameraMirrored ? "Aktif" : "Nonaktif (Normal)"}</span>
              </button>

              <button
                type="button"
                onClick={capturePhoto}
                className="px-5 py-2.5 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 cursor-pointer transition"
              >
                <Camera size={14} />
                <span>Jepret Foto</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. MODAL LIGHTBOX FOTO PREVIEW DENGAN TOMBOL DOWNLOAD      */}
      {/* ========================================================= */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
        >
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                downloadMedia(previewImage.url, previewImage.name || "foto.jpg");
              }}
              className="p-2.5 rounded-full bg-[#202c33] hover:bg-[#2a3942] text-white shadow-xl cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            >
              <Download size={15} />
              <span>Download</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="p-2.5 rounded-full bg-[#202c33] hover:bg-[#2a3942] text-white shadow-xl cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div 
            onClick={(e) => e.stopPropagation()} 
            className="max-w-4xl max-h-[85vh] flex items-center justify-center p-2"
          >
            <img
              src={previewImage.url}
              alt={previewImage.name}
              className="max-h-[80vh] w-auto object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. MODAL BUAT CHANNEL / GRUP BARU                         */}
      {/* ========================================================= */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#111b21] border border-[#222e35] rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222e35] pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Users size={16} className="text-[#00a884]" />
                <span>Buat Grup Chat Baru</span>
              </div>
              <button 
                type="button"
                onClick={() => setIsGroupModalOpen(false)} 
                className="text-[#8696a0] hover:text-white cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#d1d7db] mb-1 font-medium">Nama Grup</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Project Branding, Tim Kreatif"
                  className="w-full bg-[#202c33] border-none rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                />
              </div>

              <div>
                <label className="block text-[#d1d7db] mb-1 font-medium">Deskripsi (Opsional)</label>
                <input
                  type="text"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="e.g. Diskusi harian tim"
                  className="w-full bg-[#202c33] border-none rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                />
              </div>

              <div>
                <label className="block text-[#d1d7db] mb-1.5 font-medium">
                  Pilih Anggota ({selectedMembers.length} dipilih)
                </label>
                <div className="flex flex-col gap-1 p-2 bg-[#202c33] rounded-xl max-h-36 overflow-y-auto no-scrollbar">
                  {teamMembers.length === 0 ? (
                    <span className="text-[#8696a0] text-[11px] p-2 text-center">Belum ada anggota terdaftar</span>
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
                              ? "bg-[#00a884] text-white border-transparent font-medium"
                              : "bg-transparent text-[#d1d7db] border-transparent hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-5 h-5 rounded-full bg-white/10 text-[9px] flex items-center justify-center font-bold text-white shrink-0">
                              {(member.name || member.email).slice(0, 1).toUpperCase()}
                            </span>
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
                  className="flex-1 py-2 rounded-xl bg-[#202c33] text-[#8696a0] hover:text-white cursor-pointer font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingGroup || !newGroupName.trim()}
                  className="flex-1 py-2 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white font-semibold cursor-pointer disabled:opacity-50"
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
