"use client";

import { useState } from "react";
import { recordAttendance } from "@/actions/ai-attendance";

export function AttendanceTracker() {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const handleCheckIn = (type: "CHECK_IN" | "CHECK_OUT") => {
    if (!navigator.geolocation) {
      setStatusMessage("Geolocation is not supported by your browser.");
      return;
    }

    setLoading(true);
    setStatusMessage("Getting your location...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Using a placeholder userId for now—we can hook this up to your auth session next!
          const res = await recordAttendance(type, latitude, longitude, "user_demo_123");
          setStatusMessage(res.message);
        } catch (err) {
          setStatusMessage("Failed to connect to server.");
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        setLoading(false);
        setStatusMessage("Unable to retrieve your location. Please allow GPS permissions.");
      }
    );
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md border border-gray-200 my-4 max-w-xl">
      <h3 className="font-semibold text-gray-800 mb-2">📍 Geolocation Attendance Tracker</h3>
      <p className="text-xs text-gray-500 mb-4">Check in or check out with your live GPS coordinates.</p>
      
      <div className="flex gap-3">
        <button
          onClick={() => handleCheckIn("CHECK_IN")}
          disabled={loading}
          className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "Processing..." : "Check In"}
        </button>
        <button
          onClick={() => handleCheckIn("CHECK_OUT")}
          disabled={loading}
          className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "Processing..." : "Check Out"}
        </button>
      </div>

      {statusMessage && (
        <p className="text-xs text-gray-600 mt-3 font-medium">{statusMessage}</p>
      )}
    </div>
  );
}
