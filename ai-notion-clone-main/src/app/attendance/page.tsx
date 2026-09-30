"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { 
  submitAttendanceAction, 
  getTodayAttendanceStatusAction 
} from "@/actions/actions";
import { MobileContainer } from "@/components/MobileContainer";
import { 
  Camera, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  LogIn, 
  LogOut, 
  RefreshCw,
  XCircle
} from "lucide-react";

export default function AttendancePage() {
  const { user, isLoaded } = useUser();

  // State Presensi
  const [hasClockedIn, setHasClockedIn] = useState(false);
  const [hasClockedOut, setHasClockedOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // State Kamera & Foto
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // State GPS Terkunci
  const [gettingGPS, setGettingGPS] = useState(false);

  // 1. Matikan Kamera Secara Sempurna (Cleanup)
  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Matikan kamera jika user berpindah halaman
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // 2. Cek Status Presensi Hari Ini (Reset Otomatis Harian)
  const checkTodayStatus = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const status = await getTodayAttendanceStatusAction(user.id);
      setHasClockedIn(status.hasClockedIn);
      setHasClockedOut(status.hasClockedOut);
    } catch (err) {
      console.error("Gagal mengecek status presensi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && user) {
      checkTodayStatus();
    }
  }, [isLoaded, user]);

  // 3. Buka Kamera
  const startCamera = async () => {
    try {
      stopCamera(); // Pastikan kamera lama dimatikan dulu
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Gagal mengakses kamera:", err);
      alert("Harap izinkan akses kamera untuk melakukan presensi.");
      setIsCameraActive(false);
    }
  };

  // 4. Ambil Foto & LANGSUNG MATIKAN KAMERA
  const takePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const photoData = canvas.toDataURL("image/jpeg", 0.7);
      setCapturedPhoto(photoData);
      
      // KAMERA LANGSUNG DIMATIKAN SETELAH FOTO DIAMBIL
      stopCamera();
    }
  };

  // 5. LOCK GPS & KAN KAN DATA PRESENSI
  const handleAttendanceSubmit = async (type: "CLOCK_IN" | "CLOCK_OUT") => {
    if (!user) return;
    if (!capturedPhoto) {
      alert("Harap ambil foto presensi terlebih dahulu!");
      return;
    }

    if (!navigator.geolocation) {
      alert("Browser Anda tidak mendukung Geolocation GPS.");
      return;
    }

    setSubmitting(true);
    setGettingGPS(true);

    // KUNCI LOKASI GPS TEPAT SAAT TOMBOL DIKLIK
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const lockedGpsString = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
        
        setGettingGPS(false);

        const userName = user.fullName || user.username || "Karyawan";
        const userEmail = user.primaryEmailAddress?.emailAddress || "";

        // Kirim ke server
        const result = await submitAttendanceAction({
          userId: user.id,
          userName,
          userEmail,
          type,
          imageUrl: capturedPhoto,
          location: lockedGpsString, // Lokasi terkunci
        });

        if (result.success) {
          alert(`Presensi ${type === "CLOCK_IN" ? "Masuk" : "Keluar"} Berhasil Terrekam!`);
          setCapturedPhoto(null);
          stopCamera(); // Pastikan kamera mati total
          await checkTodayStatus();
        } else {
          alert("Gagal menyimpan presensi. Silakan coba lagi.");
        }
        setSubmitting(false);
      },
      (error) => {
        console.error("Gagal mengunci GPS:", error);
        alert("Harap izinkan & aktifkan GPS lokasi di HP/Browser Anda.");
        setGettingGPS(false);
        setSubmitting(false);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 15000, 
        maximumAge: 0 // Wajib mengambil posisi terbaru, bukan cache
      }
    );
  };

  if (!isLoaded || loading) {
    return (
      <MobileContainer>
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 text-xs gap-2 py-20">
          <RefreshCw size={20} className="animate-spin text-zinc-500" />
          <span>Memuat status presensi harian...</span>
        </div>
      </MobileContainer>
    );
  }

  return (
    <MobileContainer>
      {/* CSS Override untuk Menyembunyikan Floating Chatbox yang Mengganggu di Mobile */}
      <style jsx global>{`
        #chat-widget-container, 
        .floating-chat-button, 
        [class*="chat-widget"],
        [id*="chat-box"] {
          display: none !important;
        }
      `}</style>

      <div className="flex-1 flex flex-col gap-5 py-5 pb-28 text-zinc-200">
        
        {/* Header */}
        <div className="border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
              Live Attendance
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white mt-1">
            Presensi Harian
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Ambil swafoto dan kunci lokasi GPS Anda untuk melakukan presensi.
          </p>
        </div>

        {/* Status Card Hari Ini */}
        <div className="bg-[#141414] border border-zinc-800 rounded-2xl p-4 space-y-3 shadow-lg">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 border-b border-zinc-800 pb-2">
            <span>Status Presensi Hari Ini</span>
            <span className="font-mono text-[10px] text-zinc-500">Reset Tiap 00:00</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 rounded-xl border flex flex-col gap-1 ${
              hasClockedIn 
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-zinc-900 border-zinc-800 text-zinc-500"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold">Clock In</span>
                {hasClockedIn && <CheckCircle2 size={14} className="text-emerald-400" />}
              </div>
              <span className="text-[10px] opacity-80">
                {hasClockedIn ? "Sudah Presensi Masuk" : "Belum Clock In"}
              </span>
            </div>

            <div className={`p-3 rounded-xl border flex flex-col gap-1 ${
              hasClockedOut 
                ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                : "bg-zinc-900 border-zinc-800 text-zinc-500"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold">Clock Out</span>
                {hasClockedOut && <CheckCircle2 size={14} className="text-rose-400" />}
              </div>
              <span className="text-[10px] opacity-80">
                {hasClockedOut ? "Sudah Presensi Keluar" : "Belum Clock Out"}
              </span>
            </div>
          </div>
        </div>

        {/* Swafoto Kamera */}
        <div className="bg-[#141414] border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Camera size={14} className="text-zinc-400" />
              <span>Swafoto Kamera</span>
            </span>
            {isCameraActive && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 animate-pulse">
                • Kamera Aktif
              </span>
            )}
          </div>

          <div className="relative w-full h-60 rounded-xl bg-black border border-zinc-800 overflow-hidden flex items-center justify-center">
            {capturedPhoto ? (
              <img 
                src={capturedPhoto} 
                alt="Captured Presensi" 
                className="w-full h-full object-cover" 
              />
            ) : isCameraActive ? (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover" 
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-zinc-600 text-xs">
                <Camera size={32} className="opacity-40" />
                <span>Kamera Mati</span>
              </div>
            )}
          </div>

          {/* Tombol Kontrol Kamera */}
          <div className="flex items-center gap-2">
            {!capturedPhoto ? (
              !isCameraActive ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold border border-zinc-700 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Camera size={14} />
                  <span>Buka Kamera</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2 w-full">
                  <button
                    type="button"
                    onClick={takePhoto}
                    className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
                  >
                    <Camera size={14} />
                    <span>Ambil Foto</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <XCircle size={14} />
                    <span>Tutup Kamera</span>
                  </button>
                </div>
              )
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCapturedPhoto(null);
                  startCamera();
                }}
                className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw size={13} />
                <span>Foto Ulang</span>
              </button>
            )}
          </div>
        </div>

        {/* Tombol Clock In & Clock Out */}
        <div className="space-y-3">
          {gettingGPS && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-2 font-mono">
              <MapPin size={14} className="animate-bounce shrink-0" />
              <span>Mengunci posisi GPS lokasi Anda...</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={hasClockedIn || submitting || !capturedPhoto}
              onClick={() => handleAttendanceSubmit("CLOCK_IN")}
              className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold text-xs transition shadow cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <LogIn size={15} />
              <span>{hasClockedIn ? "Sudah Clock In" : "Clock In (Masuk)"}</span>
            </button>

            <button
              type="button"
              disabled={!hasClockedIn || hasClockedOut || submitting || !capturedPhoto}
              onClick={() => handleAttendanceSubmit("CLOCK_OUT")}
              className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold text-xs transition shadow cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <LogOut size={15} />
              <span>{hasClockedOut ? "Sudah Clock Out" : "Clock Out (Keluar)"}</span>
            </button>
          </div>
        </div>

      </div>
    </MobileContainer>
  );
}