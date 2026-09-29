"use client";

import { useState, useEffect, useRef } from "react";
import { 
  MapPin, 
  Camera, 
  Clock, 
  CheckCircle2, 
  LogOut, 
  X, 
  Navigation, 
  RefreshCw, 
  ExternalLink, 
  ImageIcon 
} from "lucide-react";

// Titik acuan alamat kantor (Jalan Rambutan Raya No 2B, Semarang)
const OFFICE_COORDINATES = {
  address: "Jl. Rambutan Raya No. 2B",
  lat: -7.0036,
  lng: 110.4388,
  radiusMeters: 200
};

// Hitung jarak meter dengan Haversine Formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export function AttendanceTracker() {
  // State Live GPS Preview
  const [liveLocation, setLiveLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [liveAddress, setLiveAddress] = useState<string>("Mendeteksi lokasi...");
  const [isGettingGps, setIsGettingGps] = useState<boolean>(true);
  const [liveDistance, setLiveDistance] = useState<number | null>(null);

  // State Riwayat Presensi yang Terkunci
  const [attendanceState, setAttendanceState] = useState<"checked_out" | "checked_in">("checked_out");
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<string | null>(null);
  const [checkInPhoto, setCheckInPhoto] = useState<string | null>(null);
  const [checkOutPhoto, setCheckOutPhoto] = useState<string | null>(null);
  const [recordedGpsIn, setRecordedGpsIn] = useState<string | null>(null);
  const [recordedGpsOut, setRecordedGpsOut] = useState<string | null>(null);

  // State Modal Kamera & Preview Snapshot
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<"check_in" | "check_out" | null>(null);
  const [tempPhoto, setTempPhoto] = useState<string | null>(null);
  const [isCapturingLocation, setIsCapturingLocation] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Baca GPS saat ini
  const fetchCurrentLocation = () => {
    setIsGettingGps(true);
    if (!navigator.geolocation) {
      setLiveAddress("Browser tidak mendukung GPS");
      setIsGettingGps(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = Math.round(pos.coords.accuracy);

        setLiveLocation({ lat, lng, accuracy: acc });
        const dist = calculateDistance(lat, lng, OFFICE_COORDINATES.lat, OFFICE_COORDINATES.lng);
        setLiveDistance(dist);

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`
          );
          const data = await res.json();
          const cityOrDistrict = 
            data.address.city || 
            data.address.town || 
            data.address.county || 
            data.address.suburb || 
            "Kota Semarang";
          setLiveAddress(`${cityOrDistrict} (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        } catch {
          setLiveAddress(`Kota Semarang (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        } finally {
          setIsGettingGps(false);
        }
      },
      (err) => {
        setLiveAddress(err.code === 1 ? "Izin GPS ditolak browser" : "Gagal membaca titik GPS");
        setIsGettingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Muat data tersimpan
  useEffect(() => {
    fetchCurrentLocation();

    const savedIn = localStorage.getItem("TODAY_CHECK_IN");
    const savedOut = localStorage.getItem("TODAY_CHECK_OUT");
    const savedPhotoIn = localStorage.getItem("TODAY_PHOTO_IN");
    const savedPhotoOut = localStorage.getItem("TODAY_PHOTO_OUT");
    const savedGpsIn = localStorage.getItem("TODAY_GPS_IN");
    const savedGpsOut = localStorage.getItem("TODAY_GPS_OUT");

    if (savedIn && !savedOut) {
      setAttendanceState("checked_in");
      setCheckInTime(savedIn);
      setCheckInPhoto(savedPhotoIn);
      setRecordedGpsIn(savedGpsIn);
    } else if (savedIn && savedOut) {
      setAttendanceState("checked_out");
      setCheckInTime(savedIn);
      setCheckOutTime(savedOut);
      setCheckInPhoto(savedPhotoIn);
      setCheckOutPhoto(savedPhotoOut);
      setRecordedGpsIn(savedGpsIn);
      setRecordedGpsOut(savedGpsOut);
    }
  }, []);

  // Buka Modal Kamera (Wajib Foto)
  const openAttendanceModal = async (action: "check_in" | "check_out") => {
    setPendingAction(action);
    setTempPhoto(null);
    setIsCameraOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      alert("Akses kamera dibutuhkan untuk bukti foto presensi. Mohon izinkan kamera.");
      setIsCameraOpen(false);
    }
  };

  const closeAttendanceModal = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
    setPendingAction(null);
    setTempPhoto(null);
  };

  // Step 1: Ambil Jepretan Foto Sementara
  const snapPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg");
      setTempPhoto(dataUrl);
    }
  };

  const retakePhoto = () => {
    setTempPhoto(null);
  };

  // Step 2: Konfirmasi Presensi (Kunci GPS Saat Ini + Foto Bersama)
  const submitAttendance = () => {
    if (!tempPhoto) {
      alert("Wajib mengambil foto selfie terlebih dahulu sebelum presensi!");
      return;
    }

    setIsCapturingLocation(true);

    // Dapatkan GPS real-time tepat saat tombol konfirmasi ditekan
    const finalizeRecord = (lat: number, lng: number) => {
      const dist = calculateDistance(lat, lng, OFFICE_COORDINATES.lat, OFFICE_COORDINATES.lng);
      const isOffice = dist <= OFFICE_COORDINATES.radiusMeters;
      const locationLabel = isOffice ? "Kantor" : "Luar Kantor";
      const gpsRecord = `${locationLabel} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

      const now = new Date();
      const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

      if (pendingAction === "check_in") {
        setAttendanceState("checked_in");
        setCheckInTime(timeStr);
        setCheckInPhoto(tempPhoto);
        setRecordedGpsIn(gpsRecord);

        // Reset data out bila presensi hari baru
        setCheckOutTime(null);
        setCheckOutPhoto(null);
        setRecordedGpsOut(null);

        localStorage.setItem("TODAY_CHECK_IN", timeStr);
        localStorage.setItem("TODAY_PHOTO_IN", tempPhoto);
        localStorage.setItem("TODAY_GPS_IN", gpsRecord);
        localStorage.removeItem("TODAY_CHECK_OUT");
        localStorage.removeItem("TODAY_PHOTO_OUT");
        localStorage.removeItem("TODAY_GPS_OUT");
      } else if (pendingAction === "check_out") {
        setAttendanceState("checked_out");
        setCheckOutTime(timeStr);
        setCheckOutPhoto(tempPhoto);
        setRecordedGpsOut(gpsRecord);

        localStorage.setItem("TODAY_CHECK_OUT", timeStr);
        localStorage.setItem("TODAY_PHOTO_OUT", tempPhoto);
        localStorage.setItem("TODAY_GPS_OUT", gpsRecord);
      }

      setIsCapturingLocation(false);
      closeAttendanceModal();
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          finalizeRecord(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          // Fallback ke posisi terakhir jika gagal
          const lat = liveLocation?.lat ?? OFFICE_COORDINATES.lat;
          const lng = liveLocation?.lng ?? OFFICE_COORDINATES.lng;
          finalizeRecord(lat, lng);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      const lat = liveLocation?.lat ?? OFFICE_COORDINATES.lat;
      const lng = liveLocation?.lng ?? OFFICE_COORDINATES.lng;
      finalizeRecord(lat, lng);
    }
  };

  const isAtOffice = liveDistance !== null && liveDistance <= OFFICE_COORDINATES.radiusMeters;

  return (
    <div className="space-y-4">
      {/* Box Info Live GPS Tracker */}
      <div className="bg-[#1c1c1f] border border-[#27272a] p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#27272a] flex items-center justify-center text-zinc-300 shrink-0">
            {isGettingGps ? (
              <RefreshCw size={15} className="animate-spin text-zinc-400" />
            ) : (
              <Navigation size={15} className="text-zinc-200" />
            )}
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
              <span>{liveAddress}</span>
              {liveLocation && (
                <span className="text-[10px] text-zinc-500 font-mono">
                  (akurasi ±{liveLocation.accuracy}m)
                </span>
              )}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1.5">
              <MapPin size={12} className="text-zinc-400" />
              <span>
                {isAtOffice ? (
                  <span className="text-zinc-200 font-medium">Kantor (Jl. Rambutan Raya No 2B)</span>
                ) : (
                  <span className="text-zinc-400">Luar Kantor</span>
                )}
                {liveDistance !== null && (
                  <span className="text-[10px] text-zinc-500 font-mono ml-1">
                    ({liveDistance}m dari kantor)
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {liveLocation && (
            <a
              href={`https://www.google.com/maps?q=${liveLocation.lat},${liveLocation.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-medium px-2.5 py-1.5 bg-[#27272a] hover:bg-[#323236] text-zinc-300 rounded-xl border border-[#3f3f46] transition flex items-center gap-1"
            >
              <ExternalLink size={12} /> Buka Peta
            </a>
          )}
          <button
            onClick={fetchCurrentLocation}
            disabled={isGettingGps}
            className="text-[11px] font-medium px-2.5 py-1.5 bg-[#27272a] hover:bg-[#323236] text-zinc-300 rounded-xl border border-[#3f3f46] transition flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw size={12} className={isGettingGps ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Grid Kartu Jam Masuk & Jam Pulang */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* KARTU CHECK IN */}
        <div className="bg-[#1c1c1f] border border-[#27272a] p-4 rounded-2xl flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#27272a] text-zinc-300 flex items-center justify-center">
                <Clock size={16} />
              </div>
              <div>
                <div className="text-[10px] text-zinc-400 tracking-wider uppercase font-semibold">JAM MASUK (IN)</div>
                <div className="text-sm font-bold text-white mt-0.5 font-mono">{checkInTime || "--:--"}</div>
              </div>
            </div>
            {checkInTime && <CheckCircle2 size={15} className="text-zinc-300" />}
          </div>

          <div className="border-t border-[#27272a] pt-2.5">
            {checkInPhoto ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span className="flex items-center gap-1"><Camera size={11} /> Bukti Foto Masuk:</span>
                  {recordedGpsIn && <span className="font-mono text-[9px] text-zinc-500">{recordedGpsIn}</span>}
                </div>
                <div className="w-full max-w-[150px] aspect-[4/3] rounded-xl overflow-hidden border border-[#27272a] bg-black">
                  <img src={checkInPhoto} alt="Foto Masuk" className="w-full h-full object-cover" />
                </div>
              </div>
            ) : (
              <div className="h-16 rounded-xl border border-dashed border-[#2b2b30] flex flex-col items-center justify-center text-zinc-500 gap-1 text-[11px]">
                <ImageIcon size={14} className="opacity-40" />
                <span>Belum ada foto masuk</span>
              </div>
            )}
          </div>
        </div>

        {/* KARTU CHECK OUT */}
        <div className="bg-[#1c1c1f] border border-[#27272a] p-4 rounded-2xl flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#27272a] text-zinc-300 flex items-center justify-center">
                <LogOut size={16} />
              </div>
              <div>
                <div className="text-[10px] text-zinc-400 tracking-wider uppercase font-semibold">JAM PULANG (OUT)</div>
                <div className="text-sm font-bold text-white mt-0.5 font-mono">{checkOutTime || "--:--"}</div>
              </div>
            </div>
            {checkOutTime && <CheckCircle2 size={15} className="text-zinc-300" />}
          </div>

          <div className="border-t border-[#27272a] pt-2.5">
            {checkOutPhoto ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span className="flex items-center gap-1"><Camera size={11} /> Bukti Foto Pulang:</span>
                  {recordedGpsOut && <span className="font-mono text-[9px] text-zinc-500">{recordedGpsOut}</span>}
                </div>
                <div className="w-full max-w-[150px] aspect-[4/3] rounded-xl overflow-hidden border border-[#27272a] bg-black">
                  <img src={checkOutPhoto} alt="Foto Pulang" className="w-full h-full object-cover" />
                </div>
              </div>
            ) : (
              <div className="h-16 rounded-xl border border-dashed border-[#2b2b30] flex flex-col items-center justify-center text-zinc-500 gap-1 text-[11px]">
                <ImageIcon size={14} className="opacity-40" />
                <span>Belum ada foto pulang</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Baris Status & Tombol Aksi Presensi (Wajib Kamera) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-1 gap-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            attendanceState === "checked_in" ? "bg-zinc-200" : "bg-zinc-500"
          }`} />
          <span className="text-xs text-zinc-300">
            Status: {attendanceState === "checked_in" ? "Checked In (Aktif Bekerja)" : "Checked Out"}
          </span>
        </div>

        <div>
          {attendanceState === "checked_out" ? (
            <button
              onClick={() => openAttendanceModal("check_in")}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-zinc-200 transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Camera size={14} /> Presensi Masuk (Wajib Foto)
            </button>
          ) : (
            <button
              onClick={() => openAttendanceModal("check_out")}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#27272a] hover:bg-[#323236] text-zinc-200 border border-[#3f3f46] transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Camera size={14} /> Presensi Pulang (Wajib Foto)
            </button>
          )}
        </div>
      </div>

      {/* Modal Dialog Kamera Wajib Selfie */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#161618] border border-[#27272a] rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-zinc-300" />
                <h3 className="text-sm font-semibold text-white">
                  {pendingAction === "check_in" ? "Verifikasi Presensi Masuk" : "Verifikasi Presensi Pulang"}
                </h3>
              </div>
              <button onClick={closeAttendanceModal} className="text-zinc-400 hover:text-white transition cursor-pointer">
                <X size={16} />
              </button>
            </div>

            {/* Kamera View atau Preview Snapshot */}
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3] border border-[#27272a]">
              {tempPhoto ? (
                <img src={tempPhoto} alt="Snapshot Preview" className="w-full h-full object-cover" />
              ) : (
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover -scale-x-100" 
                />
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            {/* Aksi Modal: Jepret atau Kirim */}
            {!tempPhoto ? (
              <div className="flex gap-2.5">
                <button
                  onClick={closeAttendanceModal}
                  className="flex-1 py-2.5 rounded-xl border border-[#27272a] text-xs font-medium text-zinc-300 hover:bg-[#27272a] transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={snapPhoto}
                  className="flex-1 py-2.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Camera size={13} /> Jepret Foto
                </button>
              </div>
            ) : (
              <div className="flex gap-2.5">
                <button
                  onClick={retakePhoto}
                  className="flex-1 py-2.5 rounded-xl border border-[#27272a] text-xs font-medium text-zinc-300 hover:bg-[#27272a] transition cursor-pointer"
                >
                  Ulangi Foto
                </button>
                <button
                  onClick={submitAttendance}
                  disabled={isCapturingLocation}
                  className="flex-1 py-2.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isCapturingLocation ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={13} />
                  )}
                  {isCapturingLocation ? "Mengunci..." : "Kirim Presensi"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}