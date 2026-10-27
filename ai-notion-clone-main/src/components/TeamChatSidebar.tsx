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
  syncUserAction
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
  Loader2
} from "lucide-react";

interface Attachment {
  name: string;
  size: string;
  type: "image" | "file";
  url: string;
}

interface Message {
  id: string;
  sender: string;
  senderId?: string | null;
  senderImage?: string | null;
  text: string;
  time: string;
  attachment?: Attachment;
  isSelf: boolean;
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
}

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
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Input State
  const [inputText, setInputText] = useState("");
  const [pendingFile, setPendingFile] = useState<Attachment | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Modal Buat Grup
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

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

  // Refresh saat sidebar dibuka
  useEffect(() => {
    if (isOpen) {
      loadInitialChatData();
      if (activeChannelId) {
        loadMessages(activeChannelId);
      }
    }
  }, [isOpen]);

  // Set default selected member saat modal dibuka (termasuk user sendiri)
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
          return {
            id: m.id,
            sender: m.sender,
            senderId: m.senderId,
            senderImage: m.senderImage,
            text: m.text || "",
            time: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            isSelf,
            attachment: m.fileUrl ? { name: "File Attachment", size: "Storage", type: m.fileType || "file", url: m.fileUrl } : undefined,
          };
        });
        setMessages((prev) => ({ ...prev, [channelId]: formatted }));
      }
    } catch (error) {
      console.error("Gagal memuat pesan:", error);
    }
  };

  useEffect(() => {
    if (activeChannelId) {
      loadMessages(activeChannelId);
    }

    // Supabase Realtime Listener jika Supabase aktif
    let channelSubscription: any = null;
    try {
      channelSubscription = supabase
        .channel(`chat_${activeChannelId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "ChatMessage", filter: `channelId=eq.${activeChannelId}` },
          (payload) => {
            const newMsg = payload.new;
            const isSelf = newMsg.senderId ? newMsg.senderId === currentUserId : newMsg.sender === currentUserName;
            const formattedMsg: Message = {
              id: newMsg.id,
              sender: newMsg.sender,
              senderId: newMsg.senderId,
              senderImage: newMsg.senderImage,
              text: newMsg.text || "",
              time: new Date(newMsg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              isSelf,
              attachment: newMsg.fileUrl ? { name: "File Attachment", size: "Storage", type: newMsg.fileType || "file", url: newMsg.fileUrl } : undefined,
            };

            setMessages((prev) => {
              const currentList = prev[activeChannelId] || [];
              if (currentList.some((m) => m.id === newMsg.id)) return prev;
              return { ...prev, [activeChannelId]: [...currentList, formattedMsg] };
            });
          }
        )
        .subscribe();
    } catch (e) {
      console.warn("Supabase realtime tidak aktif, menggunakan fallback polling.");
    }

    // Polling cepat setiap 2.5 detik saat sidebar terbuka agar obrolan antar user real-time
    const interval = setInterval(() => {
      if (isOpen && activeChannelId) {
        loadMessages(activeChannelId);
      }
    }, 2500);

    // Refresh daftar user / grup baru setiap 6 detik
    const usersInterval = setInterval(() => {
      if (isOpen) {
        loadInitialChatData();
      }
    }, 6000);

    return () => {
      if (channelSubscription) {
        try { supabase.removeChannel(channelSubscription); } catch (e) {}
      }
      clearInterval(interval);
      clearInterval(usersInterval);
    };
  }, [activeChannelId, currentUserId, currentUserName, isOpen]);

  // Scroll otomatis ke bawah
  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeChannelId, isOpen]);

  // Identifikasi channel aktif
  const activeChannel = useMemo(() => {
    return channels.find((c) => c.id === activeChannelId) || {
      id: activeChannelId,
      name: activeChannelId,
      type: activeChannelId.startsWith("dm_") ? "direct" : "group",
      members: [],
    };
  }, [channels, activeChannelId]);

  const activeMessages = messages[activeChannelId] || [];

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

  // Handle Pilih File
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const sizeFormatted = (file.size / 1024).toFixed(1) + " KB";

    const reader = new FileReader();
    reader.onload = () => {
      setPendingFile({
        name: file.name,
        size: sizeFormatted,
        type: isImage ? "image" : "file",
        url: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Kirim Pesan Real ke Database
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !pendingFile) || isSending) return;

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
        setIsOpen(true);
      }
    } catch (err) {
      console.error("Gagal membuka obrolan langsung:", err);
    }
  };

  // Buat Grup Baru Real ke Database
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || isCreatingGroup) return;

    setIsCreatingGroup(true);
    try {
      const res = await createChatGroupAction({
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        members: selectedMembers,
        createdById: currentUserId,
      });

      if (res && res.success && res.channel) {
        const created = res.channel as Channel;
        setChannels((prev) => [...prev, created]);
        setActiveChannelId(created.id);
        setActiveTab("groups");
        setIsGroupModalOpen(false);
        setNewGroupName("");
        setNewGroupDesc("");
      } else {
        alert(res?.error || "Gagal membuat grup chat");
      }
    } catch (error: any) {
      alert("Error: " + error?.message);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const toggleMemberSelection = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleDeleteGroup = async (channelId: string) => {
    if (!confirm("Hapus grup chat ini beserta seluruh riwayat pesannya?")) return;
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

  // Nama Tampilan Saluran
  const getChannelDisplayName = (channel: Channel) => {
    if (channel.type === "direct") {
      // Hilangkan nama user sendiri dari judul DM jika ada
      const parts = channel.name.split(" & ");
      if (parts.length === 2) {
        return parts[0] === currentUserName ? parts[1] : parts[0];
      }
      return channel.name;
    }
    return `#${channel.name}`;
  };

  return (
    <>
      {/* SIDEBAR CONTAINER DI SISI KIRI LAYAR */}
      <aside
        className={`fixed top-0 left-0 h-full z-40 bg-[#111113] border-r border-zinc-800/80 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col shadow-2xl ${
          isOpen ? "w-80 sm:w-96" : "w-14"
        }`}
      >
        {/* Toggle Expand / Collapse Bar */}
        <div className="p-3 border-b border-zinc-800/70 flex items-center justify-between bg-[#141417]">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 text-zinc-300 hover:text-white p-1.5 rounded-xl hover:bg-zinc-800/60 transition cursor-pointer"
            title={isOpen ? "Sembunyikan Chat" : "Buka Chat Tim"}
          >
            <MessageSquare size={17} className="text-zinc-300" />
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

        {/* JIKA COLLAPSED: Tampilkan Ikon Vertikal Rapi */}
        {!isOpen && (
          <div className="flex-1 py-3 flex flex-col items-center gap-2.5 overflow-y-auto no-scrollbar">
            <button
              onClick={() => setIsOpen(true)}
              className="w-9 h-9 rounded-xl bg-zinc-800/60 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              title="Buka Chat Sidebar"
            >
              <ChevronRight size={15} />
            </button>

            <div className="w-6 h-[1px] bg-zinc-800 my-1" />

            {/* Quick General Channel */}
            <button
              onClick={() => {
                setActiveChannelId("general");
                setActiveTab("groups");
                setIsOpen(true);
              }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold border transition cursor-pointer ${
                activeChannelId === "general"
                  ? "bg-zinc-100 text-zinc-950 border-white shadow"
                  : "bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
              }`}
              title="Saluran #general"
            >
              <Hash size={15} />
            </button>

            {/* Quick Team Members (Avatars) */}
            {teamMembers.slice(0, 5).map((member) => (
              <button
                key={member.id}
                onClick={() => handleOpenDirectChat(member)}
                className="w-9 h-9 rounded-xl relative bg-zinc-900 border border-zinc-800/90 hover:border-zinc-700 flex items-center justify-center text-[11px] font-semibold text-zinc-300 hover:text-white transition cursor-pointer overflow-hidden"
                title={`Chat dengan ${member.name || member.email}`}
              >
                {member.imageUrl ? (
                  <img src={member.imageUrl} alt={member.name || "Member"} className="w-full h-full object-cover" />
                ) : (
                  <span>{(member.name || member.email || "M").slice(0, 2).toUpperCase()}</span>
                )}
              </button>
            ))}
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
                  groupChannels.map((c) => (
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
                    </button>
                  ))
                ) : (
                  filteredMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => handleOpenDirectChat(member)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 bg-zinc-900 text-zinc-300 border border-zinc-800 hover:text-white hover:border-zinc-700"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>{member.name || member.email}</span>
                    </button>
                  ))
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
                  <h4 className="text-xs font-semibold text-white leading-tight truncate">
                    {getChannelDisplayName(activeChannel)}
                  </h4>
                  {activeChannel.description && (
                    <p className="text-[10px] text-zinc-500 truncate">{activeChannel.description}</p>
                  )}
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
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 min-h-0 bg-[#0d0d0f]">
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
                    className={`flex flex-col ${msg.isSelf ? "items-end" : "items-start"}`}
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
                      className={`max-w-[85%] rounded-2xl p-2.5 text-xs leading-relaxed space-y-1.5 shadow-sm ${
                        msg.isSelf
                          ? "bg-zinc-100 text-zinc-950 font-normal rounded-tr-xs"
                          : "bg-[#19191d] text-zinc-200 border border-zinc-800/80 rounded-tl-xs"
                      }`}
                    >
                      {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}

                      {msg.attachment && (
                        <div className="pt-1">
                          {msg.attachment.type === "image" ? (
                            <img
                              src={msg.attachment.url}
                              alt={msg.attachment.name}
                              className="rounded-xl max-h-48 object-cover border border-black/10"
                            />
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

                    <span className="text-[9px] text-zinc-500 mt-0.5 font-mono px-1">
                      {msg.time}
                    </span>
                  </div>
                ))
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Bar Kirim Pesan Real */}
            <div className="p-2.5 border-t border-zinc-800/80 bg-[#121215]">
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

              <form onSubmit={handleSendMessage} className="flex items-center gap-1.5">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl bg-[#1a1a1e] hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition cursor-pointer"
                  title="Kirim File atau Foto"
                >
                  <Paperclip size={14} />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Tulis pesan ke ${getChannelDisplayName(activeChannel)}...`}
                  className="flex-1 bg-[#1a1a1e] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
                />

                <button
                  type="submit"
                  disabled={(!inputText.trim() && !pendingFile) || isSending}
                  className="p-2 rounded-xl bg-white hover:bg-zinc-200 disabled:opacity-40 disabled:hover:bg-white text-zinc-950 transition cursor-pointer shadow"
                >
                  {isSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                </button>
              </form>
            </div>
          </div>
        )}
      </aside>

      {/* MODAL BUAT CHANNEL / GRUP BARU */}
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
                  placeholder="e.g. project-branding, video-creators"
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
                            <span className="w-5 h-5 rounded-full bg-zinc-700/60 text-[9px] flex items-center justify-center font-bold text-zinc-200">
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