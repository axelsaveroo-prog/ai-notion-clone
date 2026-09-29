"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getChatMessages, sendChatMessage } from "@/actions/actions";
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
  Users
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
  text: string;
  time: string;
  attachment?: Attachment;
  isSelf: boolean;
}

interface Channel {
  id: string;
  name: string;
  type: "group" | "direct";
  members: string[];
}

const AVAILABLE_MEMBERS = [
  "KING AXEL",
  "Keyzia",
  "Ben",
  "Teresa Ivo",
  "Jessica",
  "Shafia",
  "Vila",
  "Monica",
  "Anin",
  "Bri"
];

export function TeamChatSidebar() {
  const [isOpen, setIsOpen] = useState(false); // default collapsed

  const [channels, setChannels] = useState<Channel[]>([
    { id: "ch-1", name: "general-internal", type: "group", members: ["You", "KING AXEL", "Keyzia", "Ben"] },
    { id: "ch-2", name: "project-aperio", type: "group", members: ["You", "KING AXEL", "Keyzia"] },
    { id: "dm-1", name: "Keyzia (Lead)", type: "direct", members: ["You", "Keyzia"] },
    { id: "dm-2", name: "KING AXEL (Design)", type: "direct", members: ["You", "KING AXEL"] },
  ]);

  const [activeChannelId, setActiveChannelId] = useState<string>("ch-1");
  const [messages, setMessages] = useState<Record<string, Message[]>>({});

  const [inputText, setInputText] = useState("");
  const [pendingFile, setPendingFile] = useState<Attachment | null>(null);

  // Modal Grup
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>(["You"]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // 1. Fetch pesan dari Supabase DB & aktifkan Listener Realtime
  useEffect(() => {
    async function loadMessages() {
      try {
        const dbMsgs = await getChatMessages(activeChannelId);
        if (dbMsgs) {
          const formatted = dbMsgs.map((m: any) => ({
            id: m.id,
            sender: m.sender,
            text: m.text || "",
            time: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            isSelf: m.sender === "You",
            attachment: m.fileUrl ? { name: "File Attachment", size: "Storage", type: m.fileType || "file", url: m.fileUrl } : undefined,
          }));
          setMessages((prev) => ({ ...prev, [activeChannelId]: formatted }));
        }
      } catch (error) {
        console.error("Gagal memuat pesan:", error);
      }
    }

    loadMessages();

    // Supabase Realtime Subscription
    const channel = supabase
      .channel(`chat_${activeChannelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ChatMessage", filter: `channelId=eq.${activeChannelId}` },
        (payload) => {
          const newMsg = payload.new;
          const formattedMsg: Message = {
            id: newMsg.id,
            sender: newMsg.sender,
            text: newMsg.text || "",
            time: new Date(newMsg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            isSelf: newMsg.sender === "You",
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannelId]);

  // Auto Scroll ke pesan paling bawah
  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeChannelId, isOpen]);

  const activeChannel = channels.find((c) => c.id === activeChannelId) || channels[0];
  const activeMessages = messages[activeChannelId] || [];

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

  // Kirim Pesan ke Database via Server Actions
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !pendingFile) return;

    const textToSend = inputText.trim();
    const fileToSend = pendingFile;

    setInputText("");
    setPendingFile(null);

    try {
      await sendChatMessage({
        channelId: activeChannelId,
        sender: "You",
        text: textToSend,
        fileUrl: fileToSend?.url,
        fileType: fileToSend?.type,
      });
    } catch (error) {
      console.error("Gagal mengirim pesan:", error);
    }
  };

  // Buat Channel Baru
  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const newCh: Channel = {
      id: "ch-" + Date.now(),
      name: newGroupName.trim().toLowerCase().replace(/\s+/g, "-"),
      type: "group",
      members: selectedMembers,
    };

    setChannels([...channels, newCh]);
    setActiveChannelId(newCh.id);
    setIsGroupModalOpen(false);
    setNewGroupName("");
    setSelectedMembers(["You"]);
  };

  const toggleMemberSelection = (name: string) => {
    setSelectedMembers((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]
    );
  };

  return (
    <>
      {/* SIDEBAR CONTAINER DI SISI KIRI LAYAR */}
      <aside
        className={`fixed top-0 left-0 h-full z-40 bg-[#121214] border-r border-zinc-800 transition-all duration-300 flex flex-col shadow-2xl ${
          isOpen ? "w-80 sm:w-96" : "w-14"
        }`}
      >
        {/* Toggle Expand / Collapse Bar */}
        <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 text-white hover:text-zinc-300 p-1.5 rounded-xl hover:bg-zinc-800/80 transition cursor-pointer"
            title={isOpen ? "Sembunyikan Chat" : "Buka Chat"}
          >
            <MessageSquare size={18} className="text-amber-400" />
            {isOpen && <span className="text-xs font-bold tracking-wide">Team Chat</span>}
          </button>

          {isOpen && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsGroupModalOpen(true)}
                className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition cursor-pointer"
                title="Buat Channel Baru"
              >
                <Plus size={14} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          )}
        </div>

        {/* JIKA COLLAPSED: Hanya Tampilkan Ikon Vertikal */}
        {!isOpen && (
          <div className="flex-1 py-4 flex flex-col items-center gap-3">
            <button
              onClick={() => setIsOpen(true)}
              className="w-9 h-9 rounded-xl bg-zinc-800/60 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              title="Buka Chat Sidebar"
            >
              <ChevronRight size={16} />
            </button>
            {channels.slice(0, 4).map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setActiveChannelId(c.id);
                  setIsOpen(true);
                }}
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-bold border transition cursor-pointer ${
                  activeChannelId === c.id
                    ? "bg-white text-black border-white"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                }`}
                title={c.name}
              >
                {c.type === "group" ? "#" : c.name.slice(0, 2).toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* JIKA OPEN: Tampilkan Channel List & Live Chat Canvas */}
        {isOpen && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Tab Pilihan Channel / DM Ringkas */}
            <div className="px-3 py-2 border-b border-zinc-800/70 overflow-x-auto flex gap-1.5 no-scrollbar bg-[#141416]">
              {channels.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveChannelId(c.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1 shrink-0 ${
                    activeChannelId === c.id
                      ? "bg-white text-black font-semibold shadow-sm"
                      : "bg-zinc-900 text-zinc-400 border border-zinc-800/80 hover:text-white"
                  }`}
                >
                  {c.type === "group" ? <Hash size={11} /> : <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                  <span>{c.name}</span>
                </button>
              ))}
            </div>

            {/* Area Pesan Chat */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 bg-[#0F0F11]">
              {activeMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs gap-1.5 text-center px-4">
                  <MessageSquare size={22} className="opacity-40" />
                  <span>Belum ada pesan di channel ini. Ketik sesuatu untuk mulai!</span>
                </div>
              ) : (
                activeMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.isSelf ? "items-end" : "items-start"}`}
                  >
                    {!msg.isSelf && (
                      <span className="text-[10px] text-zinc-400 font-medium mb-0.5 ml-1">
                        {msg.sender}
                      </span>
                    )}

                    <div
                      className={`max-w-[85%] rounded-2xl p-2.5 text-xs leading-relaxed space-y-1.5 shadow-md ${
                        msg.isSelf
                          ? "bg-zinc-100 text-black font-normal rounded-tr-xs"
                          : "bg-[#1E1E22] text-zinc-200 border border-zinc-800/80 rounded-tl-xs"
                      }`}
                    >
                      {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}

                      {msg.attachment && (
                        <div className="pt-1">
                          {msg.attachment.type === "image" ? (
                            <img
                              src={msg.attachment.url}
                              alt={msg.attachment.name}
                              className="rounded-xl max-h-40 object-cover border border-black/10"
                            />
                          ) : (
                            <div className={`flex items-center gap-2 p-2 rounded-xl border ${
                              msg.isSelf ? "bg-zinc-200/80 border-zinc-300" : "bg-zinc-900 border-zinc-800"
                            }`}>
                              <FileText size={14} />
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

            {/* Input Bar Kirim Pesan & Lampirkan File */}
            <div className="p-2.5 border-t border-zinc-800 bg-[#141416]">
              {pendingFile && (
                <div className="mb-2 p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 truncate">
                    {pendingFile.type === "image" ? <ImageIcon size={14} className="text-amber-400" /> : <FileText size={14} className="text-sky-400" />}
                    <span className="text-[11px] text-zinc-300 truncate">{pendingFile.name}</span>
                  </div>
                  <button onClick={() => setPendingFile(null)} className="text-zinc-400 hover:text-white p-0.5">
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
                  className="p-2 rounded-xl bg-[#1c1c1f] hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition cursor-pointer"
                  title="Kirim File / Foto"
                >
                  <Paperclip size={14} />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Chat #${activeChannel.name}...`}
                  className="flex-1 bg-[#1c1c1f] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() && !pendingFile}
                  className="p-2 rounded-xl bg-white hover:bg-zinc-200 disabled:opacity-40 disabled:hover:bg-white text-black transition cursor-pointer shadow"
                >
                  <Send size={13} />
                </button>
              </form>
            </div>
          </div>
        )}
      </aside>

      {/* MODAL BUAT CHANNEL / GRUP BARU */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#141416] border border-zinc-800 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-white" />
                <h3 className="text-xs font-bold text-white">Buat Channel Baru</h3>
              </div>
              <button onClick={() => setIsGroupModalOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Nama Channel</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. project-campaign, video-editors"
                  className="w-full bg-[#1c1c1f] border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-zinc-600"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1.5 font-medium">Pilih Anggota</label>
                <div className="flex flex-wrap gap-1 p-2 bg-[#1c1c1f] border border-zinc-800 rounded-xl max-h-28 overflow-y-auto">
                  {AVAILABLE_MEMBERS.map((member) => {
                    const isSelected = selectedMembers.includes(member);
                    return (
                      <button
                        key={member}
                        type="button"
                        onClick={() => toggleMemberSelection(member)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer border ${
                          isSelected
                            ? "bg-white text-black border-white font-semibold"
                            : "bg-zinc-800/80 text-zinc-400 border-zinc-700/60 hover:text-zinc-200"
                        }`}
                      >
                        {member} {isSelected && "✓"}
                      </button>
                    );
                  })}
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
                  className="flex-1 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 font-bold cursor-pointer"
                >
                  Buat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}