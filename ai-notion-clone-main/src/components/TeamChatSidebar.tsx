"use client";

import { useState, useEffect, useRef, useMemo, useCallback, memo, type ChangeEvent, type RefObject, type ClipboardEvent } from "react";
import { useUser } from "@clerk/nextjs";
import {
  getChatMessages,
  sendChatMessage,
  getChatChannelsAction,
  createChatGroupAction,
  updateChatGroupAction,
  inviteChannelMembersAction,
  kickChannelMemberAction,
  promoteChannelAdminAction,
  leaveChatGroupAction,
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
  MessageSquarePlus,
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
  Search,
  Trash2,
  User as UserIcon,
  MessageCircle,
  Loader2,
  Camera,
  Edit2,
  ExternalLink,
  Forward,
  Copy,
  Reply,
  RefreshCw,
  Settings,
  ShieldCheck,
  UserPlus,
  UserMinus,
  LogOut,
  Check,
  ArrowLeft
} from "lucide-react";

interface Attachment {
  name: string;
  size: string;
  type: "image" | "file";
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
  createdAtRaw?: string | Date;
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
  admins?: string[];
  createdById?: string | null;
  lastMessage?: {
    id: string;
    sender: string;
    senderId?: string | null;
    text?: string | null;
    fileType?: string | null;
    createdAt: string | Date;
  } | null;
  messageCount?: number;
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
// 2. HELPER: Download Media File (Foto / File)
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
          className={`underline break-all transition cursor-pointer font-medium inline-flex items-center gap-0.5 ${isSelf ? "text-orange-100 hover:text-white" : "text-[#C65921] hover:underline"
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
      ctx.resume().catch(() => { });
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(750, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch { }
};

// ==========================================
// SUB-COMPONENT: Memoized ChatInputBar (High Performance Mobile Keystrokes)
// ==========================================
interface ChatInputBarProps {
  onSendMessage: (text: string) => Promise<void> | void;
  isSending: boolean;
  editingMessage: { id: string; text: string } | null;
  onCancelEdit: () => void;
  replyingMessage: Message | null;
  onCancelReply: () => void;
  pendingFile: Attachment | null;
  onClearPendingFile: () => void;
  onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  onOpenCamera: () => void;
  onPasteImage: (file: File) => void;
  activeChannelId: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  cameraInputRef: RefObject<HTMLInputElement | null>;
}

const ChatInputBar = memo(function ChatInputBar({
  onSendMessage,
  isSending,
  editingMessage,
  onCancelEdit,
  replyingMessage,
  onCancelReply,
  pendingFile,
  onClearPendingFile,
  onFileSelect,
  onOpenCamera,
  onPasteImage,
  activeChannelId,
  fileInputRef,
  cameraInputRef,
}: ChatInputBarProps) {
  const [inputText, setInputText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingMessage) {
      setInputText(editingMessage.text);
      inputRef.current?.focus();
    } else {
      setInputText("");
    }
  }, [editingMessage]);

  useEffect(() => {
    setInputText("");
  }, [activeChannelId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !pendingFile) || isSending) return;
    const txt = inputText.trim();
    setInputText("");
    onSendMessage(txt);
  };

  const handleInputPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          onPasteImage(file);
          break;
        }
      }
    }
  };

  return (
    <div className="p-2 sm:p-2.5 bg-[#18181c] border-t border-zinc-800 shrink-0">
      {/* Replying Banner */}
      {replyingMessage && (
        <div className="mb-2 p-2 rounded-xl bg-[#202024] border-l-4 border-[#C65921] flex items-center justify-between text-xs">
          <div className="truncate min-w-0 flex-1 mr-2">
            <span className="text-[10px] text-[#C65921] font-semibold block">
              Replying to {replyingMessage.sender}:
            </span>
            <span className="text-zinc-300 truncate block text-[11px]">
              {replyingMessage.text || "[Attachment]"}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="text-zinc-400 hover:text-white p-1 cursor-pointer shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Editing Banner */}
      {editingMessage && (
        <div className="mb-2 p-2 rounded-xl bg-[#202024] border-l-4 border-amber-400 flex items-center justify-between text-xs">
          <div className="truncate min-w-0 flex-1 mr-2">
            <span className="text-[10px] text-amber-400 font-semibold block">
              Editing Message:
            </span>
            <span className="text-zinc-300 truncate block text-[11px]">
              "{editingMessage.text}"
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-zinc-400 hover:text-white p-1 cursor-pointer shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Pending File Banner */}
      {pendingFile && (
        <div className="mb-2 p-2 rounded-xl bg-[#202024] border border-zinc-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 truncate min-w-0 flex-1 mr-2">
            {pendingFile.type === "image" ? (
              <ImageIcon size={16} className="text-[#C65921] shrink-0" />
            ) : (
              <FileText size={16} className="text-[#C65921] shrink-0" />
            )}
            <span className="text-zinc-200 truncate text-[11px] font-medium">{pendingFile.name}</span>
            <span className="text-[9px] text-zinc-500 font-mono shrink-0">({pendingFile.size})</span>
          </div>
          <button
            type="button"
            onClick={onClearPendingFile}
            className="text-zinc-400 hover:text-white p-1 cursor-pointer shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5 sm:gap-2">
        <input
          type="file"
          ref={fileInputRef as any}
          onChange={onFileSelect}
          className="hidden"
        />
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={cameraInputRef as any}
          onChange={onFileSelect}
          className="hidden"
        />

        {/* Attach File Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer shrink-0"
          title="Attach file or photo"
        >
          <Paperclip size={18} />
        </button>

        {/* Camera Button */}
        <button
          type="button"
          onClick={onOpenCamera}
          className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer shrink-0"
          title="Take photo"
        >
          <Camera size={18} />
        </button>

        {/* Text Input (Dedicated local state to avoid latency drops on fast mobile typing) */}
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onPaste={handleInputPaste}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={editingMessage ? "Type new message..." : "Type a message..."}
          autoComplete="off"
          autoCorrect="off"
          className="min-w-0 flex-1 bg-[#1f1f23] text-zinc-200 placeholder:text-zinc-500 text-xs rounded-full px-3.5 py-2 sm:px-4 sm:py-2.5 focus:outline-none focus:border-[#C65921] border border-zinc-700/60"
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={(!inputText.trim() && !pendingFile) || isSending}
          className="p-2 sm:p-2.5 rounded-full bg-[#C65921] hover:bg-[#b04d1c] text-white disabled:opacity-40 transition cursor-pointer shadow active:scale-95 shrink-0"
          title={editingMessage ? "Update Message" : "Send Message"}
        >
          {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="fill-current" />}
        </button>
      </form>
    </div>
  );
});

// ==========================================
// MAIN COMPONENT: TeamChatSidebar (Soft Terracotta #C65921 Edition)
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
  const [activeChannelId, setActiveChannelId] = useState<string>("");
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [searchQuery, setSearchQuery] = useState("");

  // Input & Upload State
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

  // Modal Obrolan Baru (Pilih Kontak ala WhatsApp)
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatSearchQuery, setNewChatSearchQuery] = useState("");

  // Context Menu State
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

  // Modal Kelola Grup (Edit Info, Kick, Invite, Jadikan Admin)
  const [isManageGroupModalOpen, setIsManageGroupModalOpen] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupDesc, setEditGroupDesc] = useState("");
  const [inviteSelectedUsers, setInviteSelectedUsers] = useState<string[]>([]);
  const [isSavingGroupInfo, setIsSavingGroupInfo] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Camera State (NORMAL / TIDAK MIRROR)
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isCameraMirrored, setIsCameraMirrored] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevActiveMsgCountRef = useRef<number>(0);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const isFirstCheckRef = useRef(true);
  const mountTimeRef = useRef(Date.now());

  const channelsRef = useRef(channels);
  channelsRef.current = channels;
  const activeChannelIdRef = useRef(activeChannelId);
  activeChannelIdRef.current = activeChannelId;
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  // Kunci scroll halaman belakang pada layar mobile ketika chat terbuka
  useEffect(() => {
    if (isOpen) {
      const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
      if (isMobile) {
        const origOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
          document.body.style.overflow = origOverflow;
        };
      }
    }
  }, [isOpen]);

  // Load lastRead from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sika_chat_last_read");
      if (saved) {
        setLastReadPerChannel(JSON.parse(saved));
      }
    } catch { }
  }, []);

  const updateLastRead = (channelId: string) => {
    if (!channelId || channelId === "general") return;
    const now = Date.now();
    setLastReadPerChannel((prev) => {
      const updated = { ...prev, [channelId]: now };
      try {
        localStorage.setItem("sika_chat_last_read", JSON.stringify(updated));
      } catch { }
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

  // 1. Fetch real channels & registered users dari DB (Kecualikan general)
  const loadInitialChatData = async () => {
    try {
      await syncUserAction();
      const [fetchedChannels, fetchedUsers] = await Promise.all([
        getChatChannelsAction(currentUserId),
        getUsersAction(),
      ]);

      if (fetchedChannels && Array.isArray(fetchedChannels)) {
        const validChannels = (fetchedChannels as Channel[]).filter((c) => {
          if (c.id === "general" || c.name?.toLowerCase() === "general") return false;
          if (c.type === "group") {
            return (
              (Array.isArray(c.members) && c.members.includes(currentUserId)) ||
              c.createdById === currentUserId
            );
          }
          return true;
        });
        setChannels(validChannels);
        // Do not auto-open any chat; keep empty until user selects
        if (activeChannelId === "general") {
          setActiveChannelId("");
        }
      } else {
        setChannels([]);
        setActiveChannelId("");
      }

      if (fetchedUsers && Array.isArray(fetchedUsers)) {
        setTeamMembers(fetchedUsers);
      }
    } catch (error) {
      console.error("Failed to load chat channels / users:", error);
    }
  };

  useEffect(() => {
    loadInitialChatData();
  }, [currentUserId]);

  // Periodic heartbeat agar user terdeteksi online
  useEffect(() => {
    if (!user?.id) return;
    heartbeatAction().catch(() => { });
    const interval = setInterval(() => {
      heartbeatAction().catch(() => { });
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
        .catch(() => { });
    };

    const interval = setInterval(refreshPresence, isOpen ? 5000 : 25000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Tandai sudah dibaca saat channel dibuka
  useEffect(() => {
    if (isOpen && activeChannelId && activeChannelId !== "general") {
      updateLastRead(activeChannelId);
      loadMessages(activeChannelId);
    }
  }, [isOpen, activeChannelId]);

  // 2. Fetch Pesan untuk Saluran Aktif
  const loadMessages = async (channelId: string) => {
    if (!channelId || channelId === "general") return;
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
            attachment: m.fileUrl ? { name: "Attachment", size: "File", type: m.fileType || "file", url: m.fileUrl } : undefined,
          };
        });
        setMessages((prev) => ({ ...prev, [channelId]: formatted }));
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  // 3. Polling global & listener untuk deteksi notifikasi pesan masuk & sinkronisasi data
  const checkNewMessages = useCallback(async () => {
    try {
      if (!currentUserId || currentUserId === "guest") return;
      const latestMsgs = await getLatestChatUpdatesAction(currentUserId, 50);
      if (!latestMsgs || latestMsgs.length === 0) return;

      const isFirst = isFirstCheckRef.current;
      isFirstCheckRef.current = false;

      let hasNewIncoming = false;
      let lastIncomingMsg: any = null;

      // Format pesan yang masuk dari server
      const formattedIncoming: Record<string, Message[]> = {};

      for (const m of latestMsgs) {
        if (m.channelId === "general") continue;
        const isKnown = knownMessageIdsRef.current.has(m.id);
        const isSelf = m.senderId ? m.senderId === currentUserId : m.sender === currentUserName;
        knownMessageIdsRef.current.add(m.id);

        // Validasi kepemilikan pesan: HANYA jika pesan berasal dari saluran yang diikuti user
        const isMyDirect = m.channelId.startsWith("dm_") && m.channelId.includes(currentUserId);
        const isMyGroup = channelsRef.current.some(
          (c) => c.id === m.channelId && (c.members?.includes(currentUserId) || c.admins?.includes(currentUserId) || c.createdById === currentUserId)
        );

        // Jika bukan DM atau grup milik user, JANGAN proses dan JANGAN masukkan ke pesan
        if (!isMyDirect && !isMyGroup) {
          continue;
        }

        const msgTime = new Date(m.createdAt).getTime();
        const isAfterMount = !isNaN(msgTime) && msgTime >= mountTimeRef.current;

        if (!isKnown && !isSelf && !isFirst && isAfterMount) {
          hasNewIncoming = true;
          lastIncomingMsg = m;
        }

        if (!formattedIncoming[m.channelId]) {
          formattedIncoming[m.channelId] = [];
        }
        formattedIncoming[m.channelId].push({
          id: m.id,
          channelId: m.channelId,
          sender: m.sender,
          senderId: m.senderId,
          senderImage: m.senderImage,
          text: m.text || "",
          time: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          createdAtRaw: typeof m.createdAt === "string" ? m.createdAt : m.createdAt?.toISOString(),
          isSelf,
          isEdited: m.isEdited || false,
          isForwarded: m.isForwarded || false,
          replyToSender: m.replyToSender || null,
          replyToText: m.replyToText || null,
          attachment: m.fileUrl
            ? {
              name: "Attachment",
              size: "File",
              type: (m.fileType === "image" ? "image" : "file") as "image" | "file",
              url: m.fileUrl,
            }
            : undefined,
        });
      }

      // Merge langsung ke state messages per channel (agar obrolan & preview list langsung terupdate seketika tanpa harus dipencet dulu)
      setMessages((prev) => {
        let hasChange = false;
        const updated = { ...prev };

        for (const [chId, incMsgs] of Object.entries(formattedIncoming)) {
          const existing = updated[chId] || [];
          const existingIds = new Set(existing.map((x) => x.id));
          const newOnes = incMsgs.filter((x) => !existingIds.has(x.id));
          if (newOnes.length > 0) {
            hasChange = true;
            const combined = [...existing, ...newOnes].sort(
              (a, b) => new Date(a.createdAtRaw || 0).getTime() - new Date(b.createdAtRaw || 0).getTime()
            );
            updated[chId] = combined;
          }
        }
        return hasChange ? updated : prev;
      });

      // Update lastMessage di channels agar nama pengirim & cuplikan teks terupdate seketika
      setChannels((prevChannels) => {
        let hasChannelUpdates = false;
        const updatedChannels = prevChannels.map((c) => {
          const chIncoming = formattedIncoming[c.id];
          if (chIncoming && chIncoming.length > 0) {
            const newest = chIncoming[chIncoming.length - 1];
            if (!c.lastMessage || c.lastMessage.id !== newest.id) {
              hasChannelUpdates = true;
              return {
                ...c,
                lastMessage: {
                  id: newest.id,
                  sender: newest.sender,
                  senderId: newest.senderId,
                  text: newest.text,
                  fileType: newest.attachment?.type,
                  createdAt: newest.createdAtRaw || new Date().toISOString(),
                },
                messageCount: (c.messageCount || 0) + chIncoming.length,
              };
            }
          }
          return c;
        });

        // Jika ada channel baru yang belum ada di daftar channels (misal DM baru dari user lain)
        const hasMissingChannel = Object.keys(formattedIncoming).some(
          (chId) => !prevChannels.some((c) => c.id === chId)
        );
        if (hasMissingChannel) {
          getChatChannelsAction(currentUserId).then((fetched) => {
            if (fetched && Array.isArray(fetched)) {
              setChannels(fetched.filter((c: any) => {
                if (c.id === "general" || c.name?.toLowerCase() === "general") return false;
                if (c.type === "group") {
                  return (
                    (Array.isArray(c.members) && c.members.includes(currentUserId)) ||
                    c.createdById === currentUserId
                  );
                }
                return true;
              }));
            }
          }).catch(() => { });
        }

        return hasChannelUpdates ? updatedChannels : prevChannels;
      });

      // Notifikasi suara & popup jika ada pesan baru dari orang lain
      if (hasNewIncoming && lastIncomingMsg) {
        const isCurrentActive = isOpenRef.current && activeChannelIdRef.current === lastIncomingMsg.channelId;
        if (!isCurrentActive) {
          playNotificationChime();
          const targetCh = channelsRef.current.find((c) => c.id === lastIncomingMsg.channelId);
          const targetName = targetCh ? getChannelDisplayName(targetCh) : lastIncomingMsg.sender || "Team Chat";

          setUnreadNotification({
            id: lastIncomingMsg.id,
            sender: lastIncomingMsg.sender,
            senderImage: lastIncomingMsg.senderImage,
            text: lastIncomingMsg.text || (lastIncomingMsg.fileType === "image" ? "📷 Sent a photo" : "📎 Sent a file"),
            channelId: lastIncomingMsg.channelId,
            channelName: targetName,
            time: "Just now",
          });
        } else {
          // Jika channel yang aktif sedang dibuka, langsung tandai telah dibaca
          updateLastRead(activeChannelIdRef.current);
        }
      }
    } catch { }
  }, [currentUserId, currentUserName]);

  // Interval polling: 1500ms saat chat terbuka, 2500ms saat chat tertutup
  useEffect(() => {
    checkNewMessages();
    const interval = setInterval(checkNewMessages, isOpen ? 1500 : 2500);
    return () => clearInterval(interval);
  }, [checkNewMessages, isOpen]);

  // Saat chatbox dibuka oleh user, langsung segarkan data chat seketika
  useEffect(() => {
    if (isOpen) {
      loadInitialChatData();
      checkNewMessages();
    }
  }, [isOpen]);

  // Auto-dismiss popup notifikasi setelah 6 detik
  useEffect(() => {
    if (!unreadNotification) return;
    const timer = setTimeout(() => {
      setUnreadNotification(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [unreadNotification]);

  // Helper fungsi untuk scroll ke bawah HANYA pada container pesan langsung (TIDAK menggerakkan / kedut window browser)
  const scrollToBottom = useCallback((smooth = false) => {
    if (messagesContainerRef.current) {
      const el = messagesContainerRef.current;
      if (smooth) {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, []);

  // Scroll instan saat membuka chat, memilih saluran, atau berpindah tampilan di mobile
  useEffect(() => {
    if (isOpen && activeChannelId) {
      scrollToBottom(false);
      const timer = setTimeout(() => scrollToBottom(false), 50);
      return () => clearTimeout(timer);
    }
  }, [activeChannelId, isOpen, showMobileChat, scrollToBottom]);

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
    if (channel.type === "direct" || channel.id.startsWith("dm_")) {
      // Prioritaskan cari rekan bicara dari teamMembers
      const partner = teamMembers.find(
        (m) => m.id !== currentUserId && (channel.members?.includes(m.id) || channel.id.includes(m.id))
      );
      if (partner) {
        return partner.name || partner.email;
      }
      if (channel.name && channel.name.includes(" & ")) {
        const parts = channel.name.split(" & ");
        const isFirstMe = parts[0]?.trim().toLowerCase() === currentUserName?.trim().toLowerCase();
        return isFirstMe ? parts[1]?.trim() : parts[0]?.trim();
      }
      return channel.name ? channel.name.replace(/^dm_/, "") : "Direct Message";
    }
    const cleanName = channel.name.replace(/^#+/, "").trim();
    return cleanName;
  };

  // Identifikasi channel aktif
  const activeChannel = useMemo(() => {
    if (!activeChannelId || activeChannelId === "general") {
      return {
        id: "",
        name: "",
        type: "group",
        members: [],
        admins: [],
      };
    }
    const found = channels.find((c) => c.id === activeChannelId);
    if (found) return found;

    if (activeChannelId.startsWith("dm_")) {
      const partner = teamMembers.find(
        (m) => m.id !== currentUserId && activeChannelId.includes(m.id)
      );
      const partnerName = partner ? (partner.name || partner.email) : "Direct Message";
      return {
        id: activeChannelId,
        name: `${currentUserName} & ${partnerName}`,
        type: "direct" as const,
        members: [currentUserId, partner?.id || ""].filter(Boolean),
        admins: [],
      };
    }

    return {
      id: activeChannelId,
      name: activeChannelId,
      type: "group" as const,
      members: [],
      admins: [],
    };
  }, [channels, activeChannelId, teamMembers, currentUserId, currentUserName]);

  // Cek hak akses admin pada channel aktif
  const isCurrentUserAdmin = useMemo(() => {
    if (!activeChannel.id || activeChannel.type !== "group") return false;
    if (activeChannel.createdById === currentUserId) return true;
    return Array.isArray(activeChannel.admins) && activeChannel.admins.includes(currentUserId);
  }, [activeChannel, currentUserId]);

  const isCurrentUserOwner = useMemo(() => {
    return activeChannel.type === "group" && activeChannel.createdById === currentUserId;
  }, [activeChannel, currentUserId]);

  // Info rekan chat direct jika sedang membuka DM
  const activeDmPartner = useMemo(() => {
    if (!activeChannel.id || activeChannel.type !== "direct") return null;
    const otherId = activeChannel.members?.find((id) => id !== currentUserId);
    if (otherId) {
      return teamMembers.find((m) => m.id === otherId) || null;
    }
    const displayName = getChannelDisplayName(activeChannel);
    return teamMembers.find((m) => (m.name || m.email) === displayName) || null;
  }, [activeChannel, teamMembers, currentUserId, currentUserName]);

  const isDmPartnerOnline = activeDmPartner ? isUserOnline(activeDmPartner) : false;

  const activeMessages = activeChannelId && activeChannelId !== "general" ? (messages[activeChannelId] || []) : [];

  // Scroll otomatis jika ada pesan baru bertambah di saluran aktif (tanpa kedut / jitter)
  useEffect(() => {
    if (!isOpen || !activeChannelId) return;
    const currentCount = activeMessages.length;
    const prevCount = prevActiveMsgCountRef.current;
    prevActiveMsgCountRef.current = currentCount;

    if (currentCount > prevCount) {
      const el = messagesContainerRef.current;
      if (el) {
        const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 250;
        const lastMsg = activeMessages[activeMessages.length - 1];
        if (lastMsg?.isSelf || isNearBottom) {
          scrollToBottom(false);
        }
      }
    }
  }, [activeMessages.length, activeChannelId, isOpen, scrollToBottom]);

  // Hitung status Unread per channel & total
  const unreadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const validChannelIds = new Set(channels.map((c) => c.id));
    for (const [chId, msgList] of Object.entries(messages)) {
      if (chId === "general" || !validChannelIds.has(chId)) continue;
      const lastRead = lastReadPerChannel[chId] || 0;
      const unreadCount = msgList.filter((m) => {
        if (m.isSelf) return false;
        if (!m.createdAtRaw) return false;
        return new Date(m.createdAtRaw).getTime() > lastRead;
      }).length;
      if (unreadCount > 0) counts[chId] = unreadCount;
    }
    return counts;
  }, [messages, lastReadPerChannel, channels]);

  // Hitung jumlah percakapan/chat yang belum dibaca (ala badge WhatsApp di ikon aplikasi: dihitung dari jumlah user/grup yang chat masuk, bukan total pesan)
  const unreadConversationsCount = useMemo(() => {
    return Object.values(unreadCounts).filter((count) => count > 0).length;
  }, [unreadCounts]);

  // ==========================================
  // DAFTAR PERCAKAPAN AKTIF (HANYA YANG SUDAH PERNAH CHAT / GRUP YANG DIBUAT)
  // ==========================================
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

    // 1. Tambah Group Channels (general disaring bersih, hanya yang diikuti/dibuat)
    for (const ch of channels.filter((c) => {
      if (c.type !== "group" || c.id === "general" || c.name?.toLowerCase() === "general") return false;
      return (Array.isArray(c.members) && c.members.includes(currentUserId)) || c.createdById === currentUserId;
    })) {
      const msgs = messages[ch.id] || [];
      const lastMsg =
        msgs[msgs.length - 1] ||
        (ch.lastMessage
          ? ({
            id: ch.lastMessage.id,
            sender: ch.lastMessage.sender,
            senderId: ch.lastMessage.senderId,
            text:
              ch.lastMessage.text ||
              (ch.lastMessage.fileType === "image" ? "📷 Photo" : "📎 Attachment"),
            time: new Date(ch.lastMessage.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            createdAtRaw:
              typeof ch.lastMessage.createdAt === "string"
                ? ch.lastMessage.createdAt
                : ch.lastMessage.createdAt.toISOString(),
            isSelf: ch.lastMessage.senderId === currentUserId,
          } as Message)
          : undefined);
      const unread = unreadCounts[ch.id] || 0;
      items.push({
        id: ch.id,
        name: getChannelDisplayName(ch),
        subtitle: ch.description || "Team Group",
        type: "group",
        unread,
        lastMsg,
      });
    }

    // 2. Tambah Direct Channels (HANYA yang sudah ada riwayat pesan atau sedang dibuka)
    const directChannels = channels.filter((c) => c.type === "direct");
    for (const ch of directChannels) {
      const otherId = ch.members?.find((id) => id !== currentUserId);
      const partner = teamMembers.find((m) => m.id === otherId);
      const displayName = partner ? (partner.name || partner.email) : getChannelDisplayName(ch);
      const msgs = messages[ch.id] || [];
      const lastMsg =
        msgs[msgs.length - 1] ||
        (ch.lastMessage
          ? ({
            id: ch.lastMessage.id,
            sender: ch.lastMessage.sender,
            senderId: ch.lastMessage.senderId,
            text:
              ch.lastMessage.text ||
              (ch.lastMessage.fileType === "image" ? "📷 Photo" : "📎 Attachment"),
            time: new Date(ch.lastMessage.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            createdAtRaw:
              typeof ch.lastMessage.createdAt === "string"
                ? ch.lastMessage.createdAt
                : ch.lastMessage.createdAt.toISOString(),
            isSelf: ch.lastMessage.senderId === currentUserId,
          } as Message)
          : undefined);
      const unread = unreadCounts[ch.id] || 0;
      const online = partner ? isUserOnline(partner) : false;

      // KUNCI: Jangan tampilkan jika belum pernah ada pesan sama sekali dan tidak sedang aktif dipilih
      const hasMsgs = msgs.length > 0 || (typeof ch.messageCount === "number" && ch.messageCount > 0);
      if (!hasMsgs && activeChannelId !== ch.id) {
        continue;
      }

      items.push({
        id: ch.id,
        name: displayName,
        subtitle: online ? "Online" : "Team Member",
        type: "direct",
        avatarUrl: partner?.imageUrl,
        isOnline: online,
        unread,
        lastMsg,
      });
    }

    // Jika sedang membuka DM baru yang belum ada di list channels
    if (activeChannelId && activeChannelId.startsWith("dm_") && !items.some((i) => i.id === activeChannelId)) {
      const partner = teamMembers.find(
        (m) => m.id !== currentUserId && activeChannelId.includes(m.id)
      );
      if (partner) {
        items.unshift({
          id: activeChannelId,
          name: partner.name || partner.email,
          subtitle: isUserOnline(partner) ? "Online" : "New Chat",
          type: "direct",
          avatarUrl: partner.imageUrl,
          isOnline: isUserOnline(partner),
          unread: 0,
        });
      }
    }

    // Urutkan percakapan: chat dengan pesan terbaru selalu di atas (ala WhatsApp)
    items.sort((a, b) => {
      if (a.id === activeChannelId && (!a.lastMsg || !b.lastMsg)) return -1;
      if (b.id === activeChannelId && (!a.lastMsg || !b.lastMsg)) return 1;
      const timeA = a.lastMsg?.createdAtRaw ? new Date(a.lastMsg.createdAtRaw).getTime() : 0;
      const timeB = b.lastMsg?.createdAtRaw ? new Date(b.lastMsg.createdAtRaw).getTime() : 0;
      return timeB - timeA;
    });

    // Filter berdasarkan query & tab
    return items.filter((item) => {
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;
      if (activeTab === "groups") return item.type === "group";
      if (activeTab === "direct") return item.type === "direct";
      return true;
    });
  }, [channels, teamMembers, currentUserId, messages, unreadCounts, searchQuery, activeTab, activeChannelId]);

  // Anggota terdaftar pada grup aktif
  const currentGroupMembers = useMemo(() => {
    if (!activeChannel.id || activeChannel.type !== "group") return [];
    return teamMembers.filter((m) => activeChannel.members?.includes(m.id));
  }, [activeChannel, teamMembers]);

  // Kandidat user yang bisa diundang ke grup aktif
  const availableUsersToInvite = useMemo(() => {
    if (!activeChannel.id || activeChannel.type !== "group") return [];
    return teamMembers.filter((m) => !activeChannel.members?.includes(m.id));
  }, [activeChannel, teamMembers]);

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

  // Handler Paste Gambar dari Clipboard / File
  const handlePasteImage = useCallback(async (file: File) => {
    const { dataUrl, sizeFormatted } = await compressImage(file);
    setPendingFile({
      name: `screenshot-${new Date().toLocaleTimeString().replace(/:/g, "-")}.jpg`,
      size: sizeFormatted,
      type: "image",
      url: dataUrl,
    });
  }, []);

  // Handler Paste Screenshot (Ctrl + V)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          await handlePasteImage(file);
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
      console.warn("Failed to open webcam directly, falling back to camera input:", err);
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

  // Kirim Pesan Real ke Database
  const handleSendMessage = useCallback(async (textToSend: string) => {
    if (!activeChannelId || activeChannelId === "general") {
      alert("Please select a channel or conversation first.");
      return;
    }
    if ((!textToSend.trim() && !pendingFile) || isSending) return;

    // Jika sedang dalam mode edit pesan
    if (editingMessage) {
      const newText = textToSend.trim();
      const msgId = editingMessage.id;
      setEditingMessage(null);

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

    const fileToSend = pendingFile;
    const replySender = replyingMessage?.sender || undefined;
    const replyText = replyingMessage?.text || (replyingMessage?.attachment ? `[${replyingMessage.attachment.type}]` : undefined);

    setPendingFile(null);
    setReplyingMessage(null);
    setIsSending(true);

    // Optimistic UI update
    const optimisticMsg: Message = {
      id: "temp-" + Date.now(),
      sender: currentUserName,
      senderId: currentUserId,
      senderImage: currentUserImage,
      text: textToSend.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      createdAtRaw: new Date().toISOString(),
      isSelf: true,
      attachment: fileToSend || undefined,
      replyToSender: replySender,
      replyToText: replyText,
    };

    setMessages((prev) => ({
      ...prev,
      [activeChannelId]: [...(prev[activeChannelId] || []), optimisticMsg],
    }));

    setTimeout(() => scrollToBottom(false), 20);

    try {
      const res = await sendChatMessage({
        channelId: activeChannelId,
        sender: currentUserName,
        senderId: currentUserId,
        senderImage: currentUserImage,
        text: textToSend.trim(),
        fileUrl: fileToSend?.url,
        fileType: fileToSend?.type,
        replyToSender: replySender,
        replyToText: replyText,
      });

      if (!res.success) {
        console.error("Failed to send message:", res.error);
        alert("Failed to send message: " + (res.error || "Failed to save message to database"));
      } else {
        loadMessages(activeChannelId);
      }
    } catch (error: any) {
      console.error("Failed to send message:", error);
      alert("Failed to send message: " + (error?.message || "Connection lost"));
    } finally {
      setIsSending(false);
    }
  }, [
    activeChannelId,
    currentUserId,
    currentUserName,
    currentUserImage,
    editingMessage,
    isSending,
    pendingFile,
    replyingMessage,
    scrollToBottom,
  ]);

  // Mulai Edit Pesan
  const handleStartEditMessage = (msg: Message) => {
    setEditingMessage({ id: msg.id, text: msg.text });
    setContextMenuMsg(null);
  };

  const handleCancelEdit = useCallback(() => setEditingMessage(null), []);
  const handleCancelReply = useCallback(() => setReplyingMessage(null), []);
  const handleClearPendingFile = useCallback(() => setPendingFile(null), []);

  // Delete Message
  const handleDeleteMessage = async (msgId: string) => {
    setContextMenuMsg(null);
    if (!confirm("Are you sure you want to delete this message?")) return;

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
      alert("Failed to delete message: " + err?.message);
    }
  };

  // Copy Message Text
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setContextMenuMsg(null);
  };

  // Reply Message
  const handleReplyMessage = (msg: Message) => {
    setReplyingMessage(msg);
    setContextMenuMsg(null);
  };

  // Start Forward Message
  const handleStartForward = (msg: Message) => {
    setForwardingMessage(msg);
    setContextMenuMsg(null);
  };

  // Confirm Forward Message to Channel / DM
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
      alert("Failed to forward message: " + err?.message);
    } finally {
      setIsForwarding(false);
    }
  };

  // Pilih Obrolan Langsung dari Daftar Obrolan Baru
  const handleStartDirectChatWithUser = async (member: TeamMember) => {
    setIsNewChatModalOpen(false);
    const sortedIds = [currentUserId, member.id].sort();
    const dmChannelId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
    const targetName = member.name || member.email;

    // Optimistic channel insertion agar nama user seketika langsung muncul rapi tanpa nama acak
    const optimisticChannel: Channel = {
      id: dmChannelId,
      name: `${currentUserName} & ${targetName}`,
      type: "direct",
      members: [currentUserId, member.id],
      admins: [],
    };

    setChannels((prev) => {
      const existing = prev.find((c) => c.id === dmChannelId);
      if (existing) return prev;
      return [...prev, optimisticChannel];
    });

    setActiveChannelId(dmChannelId);
    setShowMobileChat(true);
    updateLastRead(dmChannelId);
    loadMessages(dmChannelId);

    try {
      const res = await getOrCreateDirectChannelAction(
        currentUserId,
        currentUserName,
        member.id,
        targetName
      );
      if (res && res.success && res.channel) {
        const ch = res.channel as Channel;
        setChannels((prev) => {
          const others = prev.filter((c) => c.id !== ch.id);
          return [...others, ch];
        });
      }
    } catch (e) {
      console.warn("Direct channel fetch fallback:", e);
    }
  };

  // Buka Direct Chat / Grup dari list utama
  const handleSelectConversation = async (item: { id: string; type: "group" | "direct"; name: string }) => {
    setActiveChannelId(item.id);
    setIsManageGroupModalOpen(false);
    setShowMobileChat(true);
    updateLastRead(item.id);
    loadMessages(item.id);

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
        } catch { }
      }
    }
  };

  // Klik notifikasi untuk langsung menuju chat
  const handleOpenFromNotification = (channelId: string) => {
    setActiveChannelId(channelId);
    setIsManageGroupModalOpen(false);
    setIsOpen(true);
    setShowMobileChat(true);
    setUnreadNotification(null);
    updateLastRead(channelId);
    loadMessages(channelId);
  };

  // Create New Group Chat
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
        const createdCh = res.channel as Channel;
        setChannels((prev) => [...prev, createdCh]);
        setActiveChannelId(createdCh.id);
        setShowMobileChat(true);
        setIsGroupModalOpen(false);
        setNewGroupName("");
        setNewGroupDesc("");
        updateLastRead(createdCh.id);
      } else {
        alert(res.error || "Failed to create group");
      }
    } catch (e: any) {
      alert("An error occurred: " + e?.message);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Delete Group (Creator Only)
  const handleDeleteGroup = async (channelId: string) => {
    if (!confirm("Are you sure you want to delete this group and all its messages permanently?")) return;
    try {
      const res = await deleteChatChannelAction(channelId, currentUserId);
      if (res.success) {
        const remaining = channels.filter((c) => c.id !== channelId);
        setChannels(remaining);
        setActiveChannelId(remaining[0]?.id || "");
        setShowMobileChat(false);
        setIsManageGroupModalOpen(false);
      } else {
        alert(res.error || "Failed to delete group");
      }
    } catch (e: any) {
      alert("Failed: " + e?.message);
    }
  };

  // Open Manage Group Modal
  const handleOpenManageGroup = () => {
    setEditGroupName(activeChannel.name);
    setEditGroupDesc(activeChannel.description || "");
    setInviteSelectedUsers([]);
    setIsManageGroupModalOpen(true);
  };

  // Save Group Info (Name & Description)
  const handleSaveGroupInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGroupName.trim() || isSavingGroupInfo) return;

    setIsSavingGroupInfo(true);
    try {
      const res = await updateChatGroupAction(activeChannel.id, currentUserId, {
        name: editGroupName,
        description: editGroupDesc,
      });

      if (res.success && res.channel) {
        setChannels((prev) =>
          prev.map((c) => (c.id === activeChannel.id ? (res.channel as Channel) : c))
        );
        alert("Group information updated successfully!");
      } else {
        alert(res.error || "Failed to update group");
      }
    } catch (err: any) {
      alert("An error occurred: " + err?.message);
    } finally {
      setIsSavingGroupInfo(false);
    }
  };

  // Remove Member from Group (Admin Only)
  const handleKickMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from this group?`)) return;
    setIsActionLoading(true);
    try {
      const res = await kickChannelMemberAction(activeChannel.id, currentUserId, memberId, memberName);
      if (res.success && res.channel) {
        setChannels((prev) =>
          prev.map((c) => (c.id === activeChannel.id ? (res.channel as Channel) : c))
        );
        const sysMsg: Message = {
          id: `sys-${Date.now()}`,
          sender: "System",
          senderId: "system",
          text: `${memberName} was removed`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          createdAtRaw: new Date().toISOString(),
          isSelf: false,
        };
        setMessages((prev) => ({
          ...prev,
          [activeChannel.id]: [...(prev[activeChannel.id] || []), sysMsg],
        }));
      } else {
        alert(res.error || "Failed to remove member");
      }
    } catch (err: any) {
      alert("Failed to remove member: " + err?.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Promote Member to Admin
  const handlePromoteAdmin = async (memberId: string, memberName: string) => {
    if (!confirm(`Make ${memberName} a group admin?`)) return;
    setIsActionLoading(true);
    try {
      const res = await promoteChannelAdminAction(activeChannel.id, currentUserId, memberId, memberName);
      if (res.success && res.channel) {
        setChannels((prev) =>
          prev.map((c) => (c.id === activeChannel.id ? (res.channel as Channel) : c))
        );
        const sysMsg: Message = {
          id: `sys-${Date.now()}`,
          sender: "System",
          senderId: "system",
          text: `${memberName} is now an admin`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          createdAtRaw: new Date().toISOString(),
          isSelf: false,
        };
        setMessages((prev) => ({
          ...prev,
          [activeChannel.id]: [...(prev[activeChannel.id] || []), sysMsg],
        }));
        alert(`${memberName} is now a group admin.`);
      } else {
        alert(res.error || "Failed to promote admin");
      }
    } catch (err: any) {
      alert("Failed to promote admin: " + err?.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Invite Members to Group (Admin Only)
  const handleInviteMembers = async () => {
    if (inviteSelectedUsers.length === 0 || isActionLoading) return;
    setIsActionLoading(true);
    try {
      const invitedNames = teamMembers
        .filter((m) => inviteSelectedUsers.includes(m.id))
        .map((m) => m.name || m.email);

      const res = await inviteChannelMembersAction(
        activeChannel.id,
        currentUserId,
        inviteSelectedUsers,
        currentUserName,
        invitedNames
      );
      if (res.success && res.channel) {
        setChannels((prev) =>
          prev.map((c) => (c.id === activeChannel.id ? (res.channel as Channel) : c))
        );
        setInviteSelectedUsers([]);
        if (invitedNames.length > 0) {
          const sysMsg: Message = {
            id: `sys-${Date.now()}`,
            sender: "System",
            senderId: "system",
            text: `${currentUserName} added ${invitedNames.join(", ")}`,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            createdAtRaw: new Date().toISOString(),
            isSelf: false,
          };
          setMessages((prev) => ({
            ...prev,
            [activeChannel.id]: [...(prev[activeChannel.id] || []), sysMsg],
          }));
        }
        alert("New members added successfully!");
      } else {
        alert(res.error || "Failed to invite members");
      }
    } catch (err: any) {
      alert("Failed to invite members: " + err?.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Leave Group (Members & Promoted Admins; Creator must delete)
  const handleLeaveGroup = async () => {
    if (!confirm("Are you sure you want to leave this group?")) return;
    setIsActionLoading(true);
    try {
      const res = await leaveChatGroupAction(activeChannel.id, currentUserId, currentUserName);
      if (res.success) {
        const remaining = channels.filter((c) => c.id !== activeChannel.id);
        setChannels(remaining);
        setActiveChannelId(remaining[0]?.id || "");
        setShowMobileChat(false);
        setIsManageGroupModalOpen(false);
      } else {
        alert(res.error || "Failed to leave group");
      }
    } catch (err: any) {
      alert("Failed to leave group: " + err?.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const toggleMemberSelection = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const toggleInviteSelection = (id: string) => {
    setInviteSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  return (
    <>
      {/* ========================================================= */}
      {/* 1. NOTIFIKASI POPUP MINIMALIS DI POJOK KIRI BAWAH         */}
      {/* ========================================================= */}
      {unreadNotification && !isOpen && (
        <div className="fixed bottom-36 left-4 sm:bottom-20 sm:left-5 z-50 max-w-sm w-auto animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div
            onClick={() => handleOpenFromNotification(unreadNotification.channelId)}
            className="bg-[#18181b] border border-zinc-800 text-white p-3.5 rounded-2xl shadow-xl flex items-start gap-3 cursor-pointer transition hover:border-[#C65921]"
          >
            <div className="relative shrink-0">
              {unreadNotification.senderImage ? (
                <img
                  src={unreadNotification.senderImage}
                  alt={unreadNotification.sender}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#C65921] flex items-center justify-center text-white font-bold text-sm">
                  {(unreadNotification.sender || "U").slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#C65921] ring-2 ring-[#18181b]" />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center justify-between gap-2">
                <h5 className="text-xs font-semibold text-white truncate">{unreadNotification.sender}</h5>
                <span className="text-[10px] text-zinc-400 shrink-0">{unreadNotification.time}</span>
              </div>
              {unreadNotification.channelName && (
                <span className="text-[10px] text-[#C65921] font-semibold block truncate">
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
              className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition -mr-1 -mt-1 cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. BACKDROP BLUR (MENUTUP LATAR & TASKBAR / BOTTOM NAV)    */}
      {/* ========================================================= */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto"
        />
      )}

      {/* ========================================================= */}
      {/* 3. FLOATING LOGO CHAT BUTTON (MATTE TERRACOTTA #C65921)   */}
      {/* ========================================================= */}
      <div className="fixed bottom-24 left-4 sm:bottom-5 sm:left-5 z-[56]">
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) setShowMobileChat(false);
          }}
          className={`relative group w-12 h-12 rounded-full shadow-lg transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer flex items-center justify-center active:scale-95 ${isOpen
            ? "bg-[#27272a] text-white border border-zinc-700 hover:bg-[#323238]"
            : "bg-[#C65921] hover:bg-[#b04d1c] text-white border border-[#C65921]/50 shadow-md"
            }`}
          title={isOpen ? "Close Chat" : "Open Team Chat"}
        >
          {isOpen ? (
            <X size={20} className="transition-transform rotate-0 group-hover:rotate-90 duration-200" />
          ) : (
            <MessageSquare size={20} className="fill-current text-white" />
          )}

          {/* Badge Unread Count (Dihitung dari jumlah user/grup yang chat masuk, bukan total pesan) */}
          {!isOpen && unreadConversationsCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[19px] h-[19px] px-1 rounded-full bg-white text-[#C65921] text-[10px] font-black flex items-center justify-center ring-2 ring-[#C65921] shadow">
              {unreadConversationsCount > 99 ? "99+" : unreadConversationsCount}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================= */}
      {/* 4. KOTAK CHATBOX ALA WHATSAPP DESKTOP (MATTE #C65921)     */}
      {/* ========================================================= */}
      <div
        className={`fixed inset-0 sm:inset-auto sm:bottom-20 sm:left-5 z-[60] w-full sm:w-[440px] md:w-[780px] h-[100dvh] sm:h-[600px] sm:max-h-[85vh] bg-[#141416] sm:border sm:border-zinc-800 sm:rounded-3xl rounded-none shadow-2xl overflow-hidden flex flex-col origin-bottom-left transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isOpen
          ? "scale-100 opacity-100 translate-y-0 pointer-events-auto"
          : "scale-90 opacity-0 translate-y-4 pointer-events-none"
          }`}
      >
        <div className="flex-1 flex overflow-hidden">

          {/* ======================================================= */}
          {/* KOLOM KIRI: DAFTAR CHAT / KONTAK                        */}
          {/* ======================================================= */}
          <div className={`w-full md:w-72 lg:w-80 flex flex-col border-r border-zinc-800 bg-[#141416] shrink-0 ${showMobileChat ? "hidden md:flex" : "flex"
            }`}>

            {/* Header Profil Sendiri & Tombol Aksi WhatsApp */}
            <div className="p-3 sm:p-3.5 bg-[#18181c] flex items-center justify-between border-b border-zinc-800 gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {currentUserImage ? (
                  <img src={currentUserImage} alt={currentUserName} className="w-9 h-9 rounded-full object-cover ring-1 ring-zinc-700 shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#C65921] flex items-center justify-center text-white font-bold text-xs ring-1 ring-zinc-700 shrink-0">
                    {(currentUserName || "U")[0]?.toUpperCase()}
                  </div>
                )}
                <div className="truncate min-w-0">
                  <h4 className="text-xs font-semibold text-white truncate leading-tight">{currentUserName}</h4>
                  <span className="text-[10px] text-[#C65921] font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C65921]" />
                    Online
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {/* Tombol Obrolan Baru (Pilih Kontak ala WA) */}
                <button
                  type="button"
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition cursor-pointer"
                  title="New Chat (Select Contact)"
                >
                  <MessageSquarePlus size={17} />
                </button>

                {/* Tombol Buat Grup Baru */}
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(true)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition cursor-pointer"
                  title="New Group"
                >
                  <Plus size={17} />
                </button>

                {/* Tombol Tutup Chatbox */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
                  title="Close Chat"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Search Input Bar */}
            <div className="p-2.5 bg-[#141416] border-b border-zinc-800/80 flex flex-col gap-2">
              <div className="relative flex items-center">
                <Search size={14} className="absolute left-3 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search or start new chat..."
                  className="w-full bg-[#1e1e22] border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-[#C65921]"
                />
              </div>

              {/* Filter Tabs: All, Groups, Direct */}
              <div className="flex items-center gap-1">
                {(["all", "groups", "direct"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium transition cursor-pointer ${activeTab === tab
                      ? "bg-[#C65921] text-white font-semibold"
                      : "bg-[#1e1e22] text-zinc-400 hover:text-zinc-200"
                      }`}
                  >
                    {tab === "all" ? "All" : tab === "groups" ? "Groups" : "Direct"}
                  </button>
                ))}
              </div>
            </div>

            {/* List Percakapan */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40 no-scrollbar">
              {conversationList.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-xs space-y-3">
                  <div className="w-10 h-10 rounded-full bg-[#241f1c] text-[#C65921] flex items-center justify-center mx-auto">
                    <MessageSquarePlus size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-200">No conversations yet</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                      Start a new chat with your teammates or create a group.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNewChatModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#C65921] hover:bg-[#b04d1c] text-white font-semibold text-xs transition cursor-pointer shadow-sm inline-flex items-center gap-1.5"
                  >
                    <MessageSquarePlus size={14} />
                    <span>New Chat</span>
                  </button>
                </div>
              ) : (
                conversationList.map((item) => {
                  const isCurrent = activeChannelId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectConversation(item)}
                      className={`px-3.5 py-3 flex items-center gap-3 cursor-pointer transition select-none ${isCurrent
                        ? "bg-[#1f1d1b] border-l-2 border-[#C65921]"
                        : "hover:bg-[#1a1a1e] active:bg-[#202024]"
                        }`}
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        {item.type === "group" ? (
                          <div className="w-11 h-11 rounded-full bg-[#241f1c] text-[#C65921] border border-[#382b24] flex items-center justify-center font-bold text-sm shadow-sm">
                            <Users size={17} />
                          </div>
                        ) : item.avatarUrl ? (
                          <img src={item.avatarUrl} alt={item.name} className="w-11 h-11 rounded-full object-cover" />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[#C65921] font-bold text-sm">
                            {(item.name || "U")[0]?.toUpperCase()}
                          </div>
                        )}

                        {item.type === "direct" && item.isOnline && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#C65921] ring-2 ring-[#141416]" />
                        )}
                      </div>

                      {/* Info & Last Message Snippet */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <h5 className="text-xs font-semibold text-white truncate">{item.name}</h5>
                          {item.lastMsg?.time && (
                            <span className="text-[10px] text-zinc-500 shrink-0 font-mono">
                              {item.lastMsg.time}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-zinc-400 truncate flex items-center gap-1">
                            <span className="truncate">
                              {item.lastMsg?.text || (item.lastMsg?.attachment?.type === "image" ? "📷 Photo" : item.subtitle)}
                            </span>
                          </p>

                          {item.unread > 0 && (
                            <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-[#C65921] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
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
          {/* KOLOM KANAN: RUANG CHAT AKTIF                           */}
          {/* ======================================================= */}
          <div className={`flex-1 flex flex-col bg-[#0e0e11] min-w-0 ${!showMobileChat ? "hidden md:flex" : "flex"
            }`}>

            {activeChannelId && activeChannelId !== "general" ? (
              isManageGroupModalOpen && activeChannel.type === "group" ? (
                /* ======================================================= */
                /* TAMPILAN INFO GRUP ALA WHATSAPP (INTEGRATED DI CHATBOX) */
                /* ======================================================= */
                <div className="flex-1 flex flex-col h-full bg-[#0e0e11] min-w-0 overflow-hidden animate-in fade-in duration-150">
                  {/* Header Info Grup dengan Tombol Kembali ← */}
                  <div className="p-3 bg-[#18181c] flex items-center justify-between border-b border-zinc-800 shrink-0 gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 truncate">
                      <button
                        type="button"
                        onClick={() => setIsManageGroupModalOpen(false)}
                        className="p-1.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition cursor-pointer shrink-0"
                        title="Back to chat"
                      >
                        <ArrowLeft size={17} />
                      </button>
                      <div className="truncate min-w-0">
                        <h3 className="text-xs font-bold text-white truncate leading-tight">Group Info</h3>
                        <span className="text-[10px] text-zinc-400 truncate block">
                          {getChannelDisplayName(activeChannel)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsManageGroupModalOpen(false)}
                      className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer shrink-0"
                      title="Close Info"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Isi Konten Info Grup */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                    {/* Profil Card Grup ala WhatsApp */}
                    <div className="bg-[#18181c] border border-zinc-800 rounded-2xl p-4 flex flex-col items-center text-center space-y-3">
                      <div className="w-16 h-16 rounded-full bg-[#241f1c] text-[#C65921] border-2 border-[#382b24] flex items-center justify-center font-bold text-2xl shadow-md">
                        <Users size={28} />
                      </div>

                      {/* Form Edit / Info Grup */}
                      <form onSubmit={handleSaveGroupInfo} className="w-full space-y-3 text-left">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-semibold text-zinc-400">Group Name</label>
                            {isCurrentUserAdmin && (
                              <span className="text-[10px] text-[#C65921] font-semibold flex items-center gap-1">
                                <ShieldCheck size={11} /> Admin
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            disabled={!isCurrentUserAdmin}
                            value={editGroupName}
                            onChange={(e) => setEditGroupName(e.target.value)}
                            className="w-full bg-[#131316] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C65921] disabled:opacity-60"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Group Description</label>
                          <textarea
                            rows={2}
                            disabled={!isCurrentUserAdmin}
                            value={editGroupDesc}
                            onChange={(e) => setEditGroupDesc(e.target.value)}
                            placeholder="Add a group description..."
                            className="w-full bg-[#131316] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C65921] disabled:opacity-60 resize-none"
                          />
                        </div>

                        {isCurrentUserAdmin && (
                          <div className="flex justify-end pt-1">
                            <button
                              type="submit"
                              disabled={isSavingGroupInfo}
                              className="px-3.5 py-1.5 rounded-xl bg-[#C65921] hover:bg-[#b04d1c] text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                            >
                              {isSavingGroupInfo ? "Saving..." : "Save Changes"}
                            </button>
                          </div>
                        )}
                      </form>
                    </div>

                    {/* Anggota Grup & Otoritas Admin (Jadikan Admin / Kick) */}
                    <div className="bg-[#18181c] border border-zinc-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-200">
                          Members ({currentGroupMembers.length})
                        </span>
                      </div>

                      <div className="space-y-1.5 max-h-52 overflow-y-auto no-scrollbar divide-y divide-zinc-800/40">
                        {currentGroupMembers.map((member) => {
                          const isMemberOwner = member.id === activeChannel.createdById;
                          const isMemberAdmin =
                            isMemberOwner ||
                            (activeChannel.admins && activeChannel.admins.includes(member.id));
                          const isSelf = member.id === currentUserId;

                          return (
                            <div
                              key={member.id}
                              className="pt-2 first:pt-0 flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2.5 truncate min-w-0 flex-1">
                                <div className="w-8 h-8 rounded-full bg-[#241f1c] text-[#C65921] border border-[#382b24] flex items-center justify-center font-bold text-xs shrink-0">
                                  {(member.name || member.email)[0]?.toUpperCase()}
                                </div>
                                <div className="truncate min-w-0">
                                  <span className="text-xs font-medium text-white block truncate">
                                    {member.name || member.email} {isSelf && "(You)"}
                                  </span>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    {isMemberOwner ? (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#C65921] text-white font-bold">
                                        Admin
                                      </span>
                                    ) : isMemberAdmin ? (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#C65921]/20 text-[#C65921] font-semibold border border-[#C65921]/40">
                                        Admin
                                      </span>
                                    ) : (
                                      <span className="text-[9px] text-zinc-500">Member</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Tombol Otoritas Admin */}
                              {isCurrentUserAdmin && !isSelf && (
                                <div className="flex items-center gap-1 shrink-0">
                                  {!isMemberAdmin && (
                                    <button
                                      type="button"
                                      disabled={isActionLoading}
                                      onClick={() =>
                                        handlePromoteAdmin(member.id, member.name || member.email)
                                      }
                                      className="p-1 rounded-lg bg-zinc-800 hover:bg-[#C65921]/20 text-zinc-400 hover:text-[#C65921] transition cursor-pointer text-[10px] flex items-center gap-1 px-2"
                                      title="Make Admin"
                                    >
                                      <ShieldCheck size={11} />
                                      <span>Make Admin</span>
                                    </button>
                                  )}

                                  {!isMemberOwner && (
                                    <button
                                      type="button"
                                      disabled={isActionLoading}
                                      onClick={() =>
                                        handleKickMember(member.id, member.name || member.email)
                                      }
                                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition cursor-pointer"
                                      title="Remove from group"
                                    >
                                      <UserMinus size={13} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Undang Rekan Tim ke Grup (Khusus Admin) */}
                    {isCurrentUserAdmin && availableUsersToInvite.length > 0 && (
                      <div className="bg-[#18181c] border border-zinc-800 rounded-2xl p-4 space-y-2.5">
                        <span className="text-xs font-semibold text-zinc-200 block">
                          Add Members to Group ({inviteSelectedUsers.length} selected)
                        </span>

                        <div className="flex flex-col gap-1 p-1 bg-[#131316] rounded-xl max-h-36 overflow-y-auto no-scrollbar border border-zinc-800">
                          {availableUsersToInvite.map((member) => {
                            const isSelected = inviteSelectedUsers.includes(member.id);
                            return (
                              <button
                                key={member.id}
                                type="button"
                                onClick={() => toggleInviteSelection(member.id)}
                                className={`w-full px-2.5 py-1.5 rounded-lg text-[11px] transition cursor-pointer flex items-center justify-between text-left ${isSelected
                                  ? "bg-[#C65921] text-white font-medium"
                                  : "bg-transparent text-zinc-300 hover:bg-white/5"
                                  }`}
                              >
                                <span className="truncate">{member.name || member.email}</span>
                                {isSelected && <Check size={12} className="text-white shrink-0" />}
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            disabled={inviteSelectedUsers.length === 0 || isActionLoading}
                            onClick={handleInviteMembers}
                            className="px-3.5 py-1.5 rounded-xl bg-[#C65921] hover:bg-[#b04d1c] text-white text-xs font-semibold transition cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                          >
                            <UserPlus size={13} />
                            <span>Add to Group</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Aksi Keluar / Hapus Grup */}
                    <div className="pt-2">
                      {!isCurrentUserOwner ? (
                        <button
                          type="button"
                          disabled={isActionLoading}
                          onClick={handleLeaveGroup}
                          className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2 border border-rose-500/20"
                        >
                          <LogOut size={14} />
                          <span>Exit Group</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isActionLoading}
                          onClick={() => handleDeleteGroup(activeChannel.id)}
                          className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2 border border-rose-500/20"
                        >
                          <Trash2 size={14} />
                          <span>Delete Group</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Header Saluran Aktif */}
                  <div className="p-2.5 sm:p-3 bg-[#18181c] flex items-center justify-between border-b border-zinc-800 shrink-0 gap-2">
                    <div
                      onClick={() => {
                        if (activeChannel.type === "group") handleOpenManageGroup();
                      }}
                      className={`flex items-center gap-2 min-w-0 flex-1 overflow-hidden ${activeChannel.type === "group" ? "cursor-pointer group/hdr hover:opacity-90" : ""
                        }`}
                    >
                      {/* Tombol Back di Mobile */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMobileChat(false);
                        }}
                        className="md:hidden p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer mr-0.5 shrink-0"
                        title="Back to chat list"
                      >
                        <ChevronLeft size={18} />
                      </button>

                      <div className="relative shrink-0">
                        {activeChannel.type === "group" ? (
                          <div className="w-10 h-10 rounded-full bg-[#241f1c] border border-[#382b24] text-[#C65921] flex items-center justify-center font-bold text-sm shadow-sm">
                            <Users size={16} />
                          </div>
                        ) : activeDmPartner?.imageUrl ? (
                          <img src={activeDmPartner.imageUrl} alt={activeDmPartner.name || ""} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[#C65921] font-bold text-sm">
                            {(getChannelDisplayName(activeChannel) || "U")[0]?.toUpperCase()}
                          </div>
                        )}

                        {activeChannel.type === "direct" && isDmPartnerOnline && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#C65921] ring-2 ring-[#18181c]" />
                        )}
                      </div>

                      <div className="truncate min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h4 className="text-xs font-semibold text-white truncate leading-tight group-hover/hdr:text-[#C65921] transition">
                            {getChannelDisplayName(activeChannel)}
                          </h4>
                          {activeChannel.type === "group" && (
                            <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                              ({activeChannel.members?.length || 1} members)
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 truncate">
                          {activeChannel.type === "direct"
                            ? isDmPartnerOnline ? "Online" : "Offline"
                            : activeChannel.description || "Click for group info"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Tombol Kelola Grup */}
                      {activeChannel.type === "group" && (
                        <button
                          type="button"
                          onClick={handleOpenManageGroup}
                          className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer shrink-0"
                          title="Group Info"
                        >
                          <Settings size={16} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer shrink-0"
                        title="Close Chat"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Area Pesan Chat Realtime */}
                  <div
                    ref={messagesContainerRef}
                    onPaste={handlePaste}
                    className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-0 bg-[#0e0e11] overscroll-contain"
                  >
                    {activeMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs gap-2 text-center px-6">
                        <div className="w-12 h-12 rounded-2xl bg-[#1c1c20] border border-zinc-800 flex items-center justify-center text-[#C65921]">
                          <MessageCircle size={24} />
                        </div>
                        <p className="font-semibold text-zinc-200">Start conversation</p>
                        <span className="text-[11px] text-zinc-400 max-w-xs">
                          Type a message below to start collaborating with {getChannelDisplayName(activeChannel)}.
                        </span>
                      </div>
                    ) : (
                      activeMessages.map((msg) => {
                        if (msg.senderId === "system" || msg.sender === "System") {
                          return (
                            <div key={msg.id} className="flex justify-center my-2 select-none">
                              <span className="text-[10.5px] px-3.5 py-0.5 rounded-full bg-[#1b1b1f] text-zinc-400 border border-zinc-800/80 shadow-xs max-w-[85%] text-center">
                                {msg.text}
                              </span>
                            </div>
                          );
                        }

                        const isImageOnly = msg.attachment?.type === "image" && !msg.text;
                        const isMenuOpen = contextMenuMsg?.id === msg.id;

                        return (
                          <div
                            key={msg.id}
                            className={`group relative flex flex-col ${msg.isSelf ? "items-end" : "items-start"}`}
                          >
                            {/* Sender Name in Group */}
                            {!msg.isSelf && activeChannel.type === "group" && (
                              <div className="flex items-center gap-1.5 mb-0.5 ml-2">
                                <span className="text-[10px] text-[#C65921] font-semibold">
                                  {msg.sender}
                                </span>
                              </div>
                            )}

                            {/* Message Bubble (Soft Terracotta #C65921 for self) */}
                            <div
                              className={`relative rounded-2xl text-xs leading-relaxed shadow-sm transition max-w-[85%] sm:max-w-[75%] ${isImageOnly
                                ? "p-1 bg-transparent"
                                : msg.isSelf
                                  ? "bg-[#C65921] text-white p-2.5 rounded-tr-xs"
                                  : "bg-[#1f1f23] text-zinc-100 border border-zinc-800/80 p-2.5 rounded-tl-xs"
                                }`}
                            >
                              {/* Dropdown Chevron */}
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
                                title="Message menu"
                              >
                                <ChevronDown size={12} />
                              </button>

                              {/* Forwarded Banner */}
                              {msg.isForwarded && (
                                <div className="flex items-center gap-1 text-[10px] italic opacity-80 mb-1 font-sans">
                                  <Forward size={11} className="inline rotate-0" />
                                  <span>Forwarded</span>
                                </div>
                              )}

                              {/* Reply Quote Box */}
                              {msg.replyToSender && (
                                <div className={`mb-1.5 p-1.5 px-2 rounded-lg border-l-3 text-[11px] select-none ${msg.isSelf ? "bg-black/20 border-white/80" : "bg-black/30 border-[#C65921]"
                                  }`}>
                                  <span className={`font-semibold block text-[10px] ${msg.isSelf ? "text-orange-100" : "text-[#C65921]"}`}>
                                    {msg.replyToSender}
                                  </span>
                                  <span className="text-white/80 line-clamp-1 italic text-[10px]">
                                    {msg.replyToText}
                                  </span>
                                </div>
                              )}

                              {/* Image Attachment */}
                              {msg.attachment?.type === "image" && (
                                <div className="relative group/img overflow-hidden rounded-xl mb-1">
                                  <img
                                    src={msg.attachment.url}
                                    alt={msg.attachment.name}
                                    className="max-h-72 w-auto object-cover rounded-xl cursor-pointer hover:opacity-95 transition"
                                    onClick={() => setPreviewImage({ url: msg.attachment!.url, name: msg.attachment!.name })}
                                  />
                                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/img:opacity-100 transition">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        downloadMedia(msg.attachment!.url, msg.attachment!.name || "photo.jpg");
                                      }}
                                      className="p-1.5 rounded-full bg-black/60 hover:bg-black text-white shadow backdrop-blur-sm transition cursor-pointer"
                                      title="Download Photo"
                                    >
                                      <Download size={13} />
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* File Attachment */}
                              {msg.attachment?.type === "file" && (
                                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-black/20 mb-1 border border-white/5">
                                  <FileText size={18} className="text-zinc-400" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-semibold text-white truncate">{msg.attachment.name}</p>
                                    <span className="text-[9px] opacity-70 font-mono">{msg.attachment.size}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => downloadMedia(msg.attachment!.url, msg.attachment!.name)}
                                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                                    title="Download File"
                                  >
                                    <Download size={13} />
                                  </button>
                                </div>
                              )}

                              {/* Message Text */}
                              {msg.text && (
                                <p className="whitespace-pre-wrap break-words pr-1 text-[12px]">
                                  {renderMessageTextWithLinks(msg.text, msg.isSelf)}
                                </p>
                              )}

                              {/* Footer: Time & Edited */}
                              <div className="flex items-center justify-end gap-1 mt-0.5 text-[9px] opacity-75 font-mono select-none">
                                {msg.isEdited && (
                                  <span className="italic font-sans">edited</span>
                                )}
                                <span>{msg.time}</span>
                              </div>
                            </div>

                            {/* Context Menu Options */}
                            {isMenuOpen && (
                              <div
                                ref={contextMenuRef}
                                className="absolute right-0 top-8 z-30 w-44 bg-[#1f1f23] border border-zinc-700/80 rounded-xl shadow-2xl py-1.5 text-xs text-zinc-200 space-y-0.5 animate-in fade-in zoom-in-95 duration-150"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleReplyMessage(msg)}
                                  className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-white/5 transition cursor-pointer text-left"
                                >
                                  <Reply size={14} className="text-zinc-400" />
                                  <span>Reply</span>
                                </button>

                                {msg.text && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopyText(msg.text)}
                                    className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-white/5 transition cursor-pointer text-left"
                                  >
                                    <Copy size={14} className="text-zinc-400" />
                                    <span>Copy Text</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleStartForward(msg)}
                                  className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-white/5 transition cursor-pointer text-left"
                                >
                                  <Forward size={14} className="text-zinc-400" />
                                  <span>Forward</span>
                                </button>

                                {msg.attachment?.type === "image" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      downloadMedia(msg.attachment!.url, msg.attachment!.name || "photo.jpg");
                                      setContextMenuMsg(null);
                                    }}
                                    className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-white/5 transition cursor-pointer text-left"
                                  >
                                    <Download size={14} className="text-zinc-400" />
                                    <span>Download Photo</span>
                                  </button>
                                )}

                                {msg.isSelf && msg.text && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditMessage(msg)}
                                    className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-white/5 transition cursor-pointer text-left text-amber-300"
                                  >
                                    <Edit2 size={14} />
                                    <span>Edit Message</span>
                                  </button>
                                )}

                                {msg.isSelf && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMessage(msg.id)}
                                    className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-rose-500/10 transition cursor-pointer text-left text-rose-400"
                                  >
                                    <Trash2 size={14} />
                                    <span>Delete Message</span>
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

                  {/* Input Bar */}
                  <ChatInputBar
                    onSendMessage={handleSendMessage}
                    isSending={isSending}
                    editingMessage={editingMessage}
                    onCancelEdit={handleCancelEdit}
                    replyingMessage={replyingMessage}
                    onCancelReply={handleCancelReply}
                    pendingFile={pendingFile}
                    onClearPendingFile={handleClearPendingFile}
                    onFileSelect={handleFileSelect}
                    onOpenCamera={openCamera}
                    onPasteImage={handlePasteImage}
                    activeChannelId={activeChannelId}
                    fileInputRef={fileInputRef}
                    cameraInputRef={cameraInputRef}
                  />
                </>
              )) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-[#1c1c20] border border-zinc-800 flex items-center justify-center text-[#C65921]">
                  <MessageSquare size={26} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Start a Conversation</h3>
                  <p className="text-xs text-zinc-400 max-w-xs mt-1 leading-relaxed">
                    Select a chat from the sidebar or click below to start a new chat.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="mt-1 px-4 py-2 rounded-xl bg-[#C65921] hover:bg-[#b04d1c] text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <MessageSquarePlus size={15} />
                  <span>New Chat</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. MODAL OBROLAN BARU (PILIH KONTAK ALA WHATSAPP)         */}
      {/* ========================================================= */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181c] border border-zinc-800 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <MessageSquarePlus size={17} className="text-[#C65921]" />
                <span>New Chat</span>
              </div>
              <button
                type="button"
                onClick={() => setIsNewChatModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Tombol Buat Grup Baru di bagian atas */}
            <button
              type="button"
              onClick={() => {
                setIsNewChatModalOpen(false);
                setIsGroupModalOpen(true);
              }}
              className="w-full p-2.5 rounded-2xl bg-[#202024] hover:bg-[#26262c] text-white flex items-center gap-3 transition cursor-pointer border border-zinc-800"
            >
              <div className="w-9 h-9 rounded-full bg-[#C65921] text-white flex items-center justify-center shrink-0">
                <Users size={16} />
              </div>
              <div className="text-left">
                <span className="text-xs font-semibold block text-white">New Group</span>
                <span className="text-[10px] text-zinc-400 block">Create a discussion group with your team</span>
              </div>
            </button>

            {/* Kolom Pencarian Kontak */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-zinc-500" />
              <input
                type="text"
                value={newChatSearchQuery}
                onChange={(e) => setNewChatSearchQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full bg-[#131316] border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#C65921]"
              />
            </div>

            {/* List Kontak Tim */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-zinc-400 block px-1">
                Team Contacts
              </span>
              <div className="space-y-1 max-h-56 overflow-y-auto no-scrollbar">
                {teamMembers
                  .filter((m) => m.id !== currentUserId && (m.name?.toLowerCase().includes(newChatSearchQuery.toLowerCase()) || m.email.toLowerCase().includes(newChatSearchQuery.toLowerCase())))
                  .map((member) => {
                    const online = isUserOnline(member);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => handleStartDirectChatWithUser(member)}
                        className="w-full p-2 rounded-xl flex items-center justify-between hover:bg-[#202024] transition cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="relative shrink-0">
                            {member.imageUrl ? (
                              <img src={member.imageUrl} alt={member.name || ""} className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-[#C65921]/20 text-[#C65921] border border-[#C65921]/40 flex items-center justify-center text-xs font-bold">
                                {(member.name || member.email)[0]?.toUpperCase()}
                              </div>
                            )}
                            {online && (
                              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#C65921] ring-2 ring-[#18181c]" />
                            )}
                          </div>
                          <div className="truncate">
                            <span className="text-xs font-medium text-white block truncate">
                              {member.name || member.email}
                            </span>
                            <span className="text-[10px] text-zinc-400 block truncate">
                              {online ? "Online" : "Team Member"}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. MODAL TERUSKAN PESAN (FORWARD MODAL)                   */}
      {/* ========================================================= */}
      {forwardingMessage && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181c] border border-zinc-800 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Forward size={17} className="text-[#C65921]" />
                <span>Forward message to</span>
              </div>
              <button
                type="button"
                onClick={() => setForwardingMessage(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-[#131316] text-xs text-zinc-300 max-h-20 overflow-y-auto italic border-l-3 border-[#C65921]">
              {forwardingMessage.text || (forwardingMessage.attachment ? `[Attachment: ${forwardingMessage.attachment.type}]` : "Message")}
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-zinc-500" />
              <input
                type="text"
                value={forwardSearchQuery}
                onChange={(e) => setForwardSearchQuery(e.target.value)}
                placeholder="Search chats or contacts..."
                className="w-full bg-[#131316] border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#C65921]"
              />
            </div>

            <div className="space-y-1 max-h-56 overflow-y-auto no-scrollbar">
              {conversationList
                .filter((item) => item.name.toLowerCase().includes(forwardSearchQuery.toLowerCase()))
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isForwarding}
                    onClick={() => handleConfirmForward(item.id)}
                    className="w-full p-2.5 rounded-xl flex items-center justify-between hover:bg-white/5 transition cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-8 h-8 rounded-full bg-[#C65921] flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {item.type === "group" ? <Users size={14} /> : item.name[0]?.toUpperCase()}
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-semibold text-white block truncate">{item.name}</span>
                        <span className="text-[10px] text-zinc-500 block truncate">{item.subtitle}</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-[#C65921] px-2.5 py-1 rounded-lg bg-[#C65921]/10 hover:bg-[#C65921]/20 transition shrink-0">
                      Send
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 8. MODAL KAMERA LANGSUNG (TIDAK MIRROR / NORMAL)          */}
      {/* ========================================================= */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181c] border border-zinc-800 rounded-3xl p-5 max-w-md w-full space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2 text-white text-sm font-semibold">
                <Camera size={16} className="text-[#C65921]" />
                <span>Take Photo (Normal)</span>
              </div>
              <button
                type="button"
                onClick={closeCamera}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-zinc-800">
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
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-white/5 transition cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>Mirror Camera: {isCameraMirrored ? "On" : "Off (Normal)"}</span>
              </button>

              <button
                type="button"
                onClick={capturePhoto}
                className="px-5 py-2.5 rounded-xl bg-[#C65921] hover:bg-[#b04d1c] text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer transition"
              >
                <Camera size={14} />
                <span>Capture Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 9. MODAL LIGHTBOX FOTO PREVIEW DENGAN TOMBOL DOWNLOAD     */}
      {/* ========================================================= */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
        >
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                downloadMedia(previewImage.url, previewImage.name || "photo.jpg");
              }}
              className="p-2.5 rounded-full bg-[#18181c] hover:bg-zinc-800 text-white shadow-lg cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            >
              <Download size={15} />
              <span>Download</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="p-2.5 rounded-full bg-[#18181c] hover:bg-zinc-800 text-white shadow-lg cursor-pointer"
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
      {/* 10. MODAL BUAT CHANNEL / GRUP BARU                        */}
      {/* ========================================================= */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181c] border border-zinc-800 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Users size={16} className="text-[#C65921]" />
                <span>New Group Chat</span>
              </div>
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-300 mb-1 font-medium">Group Name</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Project Branding, Creative Team"
                  className="w-full bg-[#131316] border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C65921]"
                />
              </div>

              <div>
                <label className="block text-zinc-300 mb-1 font-medium">Description (Optional)</label>
                <input
                  type="text"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="e.g. Daily team discussions"
                  className="w-full bg-[#131316] border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C65921]"
                />
              </div>

              <div>
                <label className="block text-zinc-300 mb-1.5 font-medium">
                  Select Members ({selectedMembers.length} selected)
                </label>
                <div className="flex flex-col gap-1 p-2 bg-[#131316] border border-zinc-800 rounded-xl max-h-36 overflow-y-auto no-scrollbar">
                  {teamMembers.length === 0 ? (
                    <span className="text-zinc-500 text-[11px] p-2 text-center">No members available</span>
                  ) : (
                    teamMembers.map((member) => {
                      const isSelected = selectedMembers.includes(member.id);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => toggleMemberSelection(member.id)}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-[11px] transition cursor-pointer border flex items-center justify-between text-left ${isSelected
                            ? "bg-[#C65921] text-white border-transparent font-medium"
                            : "bg-transparent text-zinc-300 border-transparent hover:bg-white/5"
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
                  className="flex-1 py-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingGroup || !newGroupName.trim()}
                  className="flex-1 py-2 rounded-xl bg-[#C65921] hover:bg-[#b04d1c] text-white font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isCreatingGroup ? "Creating..." : "Create Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
