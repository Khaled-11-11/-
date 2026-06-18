import React, { useState, useEffect, useMemo } from "react";
import confetti from "canvas-confetti";
import {
  Trophy,
  Skull,
  Lock,
  Unlock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Flame,
  ShieldAlert,
  Coins,
  Users,
  RefreshCw,
  Crown,
  ChevronLeft,
  ChevronRight,
  Info,
  Check,
  X,
  User,
  ShieldCheck,
  Zap,
  RotateCcw,
  Gauge
} from "lucide-react";

// Day state schema based exactly on the user's concept/HTML
export interface DayState {
  id: string; // YYYY-MM-DD
  timestamp: number;
  dateString: string;
  status: "none" | "success" | "failed";
  progress: number;
  completedCount: number;
  reasons: string; // " || " separated detailed reasons
  penalty: number;
  firstModifyTimestamp: number | null;
  finalCommitTimestamp: number | null;
  tasks: boolean[];
}

const SYSTEM_YEAR = 2026;

// 5 Chores List
const CHALLENGE_TASKS = [
  "كورس أبو هدهود (ساعتان)",
  "شهادة CC (فيديو واحد)",
  "كورس Red Team - حسام شادي (فيديو واحد)",
  "الإنجليزي (ساعة)",
  "Meeting مع الطرف الآخر"
];

// Helper to get task list for a given day
const getDayTasksList = (dayId: string): string[] => {
  if (dayId === "2026-07-20") {
    return ["موعد امتحان CC"];
  }
  return CHALLENGE_TASKS;
};

// Month names in Arabic for the pagination filter
const ARABIC_MONTHS = [
  { id: "all", name: "كل الأشهر" },
  { id: "06", name: "يونيو" },
  { id: "07", name: "يوليو" },
  { id: "08", name: "أغسطس" },
  { id: "09", name: "سبتمبر" },
  { id: "10", name: "أكتوبر" },
  { id: "11", name: "نوفمبر" },
  { id: "12", name: "ديسمبر" }
];

export default function App() {
  // Active state player ("محمد" | "خالد" | null)
  const [activePlayer, setActivePlayer] = useState<"محمد" | "خالد" | null>(() => {
    const saved = localStorage.getItem("pay_law_active_player");
    if (saved === "محمد" || saved === "خالد") return saved as "محمد" | "خالد";
    return null;
  });

  // Time-travel simulated date (Defaults dynamically to current actual date, e.g., "2026-06-18")
  const [simulatedDate, setSimulatedDate] = useState<string>(() => {
    const saved = localStorage.getItem("pay_law_simulated_date");
    if (saved) return saved;
    const now = new Date();
    const yStr = now.getFullYear();
    const mStr = String(now.getMonth() + 1).padStart(2, "0");
    const dStr = String(now.getDate()).padStart(2, "0");
    return `${yStr}-${mStr}-${dStr}`;
  });

  // Databases for both players
  const [mohamedDb, setMohamedDb] = useState<Record<string, DayState>>({});
  const [khaledDb, setKhaledDb] = useState<Record<string, DayState>>({});
  
  // Selected Day ID for modal info
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  // Month filter for the calendar grid to avoid cluttering human eyes with 195 items
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>("all");

  // Real countdown till local midnight
  const [countdownStr, setCountdownStr] = useState<string>("00:00:00");
  const [countdownColorClass, setCountdownColorClass] = useState<string>("text-emerald-400");

  // Custom alert notifications inside the app
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sparkles effect state when we hit Success
  const [showCelebration, setShowCelebration] = useState<boolean>(false);

  // Password-related states for login/setup
  const [selectedLoginPlayer, setSelectedLoginPlayer] = useState<"محمد" | "خالد" | null>(null);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [newPasswordInput, setNewPasswordInput] = useState<string>("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Helper to trigger custom Toast Alert
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Build or pull databases for both players
  useEffect(() => {
    const loadOrCreateDb = (player: "محمد" | "خالد") => {
      const storageKey = `pay_law_db_${player}`;
      const saved = localStorage.getItem(storageKey);
      
      let db: Record<string, DayState> = {};
      let needsSave = false;

      if (saved) {
        try {
          db = JSON.parse(saved) as Record<string, DayState>;
        } catch (e) {
          console.error("Local database corrupt, rebuilding...", e);
        }
      }

      // Rebuild or backfill days from June 18, 2026, to December 31, 2026
      const start = new Date(2026, 5, 18); // 18 June 2026
      const end = new Date(2026, 11, 31); // 31 Dec 2026
      const tempDate = new Date(start);

      while (tempDate <= end) {
        const yStr = tempDate.getFullYear();
        const mStr = String(tempDate.getMonth() + 1).padStart(2, "0");
        const dStr = String(tempDate.getDate()).padStart(2, "0");
        const dayId = `${yStr}-${mStr}-${dStr}`;

        if (!db[dayId]) {
          needsSave = true;
          const options: Intl.DateTimeFormatOptions = {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
          };
          const dateString = tempDate.toLocaleDateString("ar-EG", options);

          db[dayId] = {
            id: dayId,
            timestamp: tempDate.getTime(),
            dateString,
            status: "none",
            progress: 0,
            completedCount: 0,
            reasons: "",
            penalty: 0,
            firstModifyTimestamp: null,
            finalCommitTimestamp: null,
            tasks: [false, false, false, false, false]
          };
        }

        tempDate.setDate(tempDate.getDate() + 1);
      }

      if (needsSave || !saved) {
        localStorage.setItem(storageKey, JSON.stringify(db));
      }
      return db;
    };

    setMohamedDb(loadOrCreateDb("محمد"));
    setKhaledDb(loadOrCreateDb("خالد"));
  }, []);

  // Sync / write changes
  const saveState = (player: "محمد" | "خالد", data: Record<string, DayState>) => {
    localStorage.setItem(`pay_law_db_${player}`, JSON.stringify(data));
    if (player === "محمد") setMohamedDb(data);
    if (player === "خالد") setKhaledDb(data);
  };

  // Perform automated past days lock & auto-failure review
  // Run this whenever simulatedDate, mohamedDb, or khaledDb values update
  useEffect(() => {
    if (Object.keys(mohamedDb).length === 0 || Object.keys(khaledDb).length === 0) return;

    let mohamedChanged = false;
    let khaledChanged = false;

    const autoEval = (db: Record<string, DayState>) => {
      let isMutated = false;
      const updated = { ...db };

      Object.keys(updated).forEach((dayId) => {
        const dayData = { ...updated[dayId] };
        // If the day is strictly in the past relative to the simulatedDate and is still unevaluated:
        if (dayId < simulatedDate && dayData.status === "none") {
          dayData.status = "failed";
          dayData.penalty = 50;

          const uncompleted: string[] = [];
          const currentDayTasks = getDayTasksList(dayId);
          currentDayTasks.forEach((taskName, i) => {
            const isChecked = !!dayData.tasks[i];
            if (!isChecked) {
              uncompleted.push(`❌ لم يتم بنجاح: ${taskName}`);
            }
          });
          if (uncompleted.length === 0) {
            uncompleted.push("❌ لم يضغط اللاعب على زر اعتماد النتيجة المعتمد قبل منتصف الليل.");
          }
          dayData.reasons = uncompleted.join(" || ");
          
          updated[dayId] = dayData;
          isMutated = true;
        }
      });

      return { updated, isMutated };
    };

    const mohResult = autoEval(mohamedDb);
    if (mohResult.isMutated) {
      mohamedChanged = true;
      saveState("محمد", mohResult.updated);
    }

    const khaResult = autoEval(khaledDb);
    if (khaResult.isMutated) {
      khaledChanged = true;
      saveState("خالد", khaResult.updated);
    }

    if (mohamedChanged || khaledChanged) {
      console.log("Auto-fail evaluation completed for elapsed days relative to", simulatedDate);
    }
  }, [simulatedDate, mohamedDb, khaledDb]);

  // Countdown timer to midnight (12:00 AM local clock)
  useEffect(() => {
    const runTicker = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);

      const diff = midnight.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdownStr("00:00:00");
        return;
      }

      const hrs = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const mins = Math.floor((diff / (1000 * 60)) % 60);
      const secs = Math.floor((diff / 1000) % 60);

      const hStr = String(hrs).padStart(2, "0");
      const mStr = String(mins).padStart(2, "0");
      const sStr = String(secs).padStart(2, "0");

      setCountdownStr(`${hStr}:${mStr}:${sStr}`);

      if (hrs < 1) {
        setCountdownColorClass("text-red-500 font-extrabold animate-pulse");
      } else if (hrs < 2) {
        setCountdownColorClass("text-amber-400 font-semibold");
      } else {
        setCountdownColorClass("text-emerald-400");
      }
    };

    runTicker();
    const clockInterval = setInterval(runTicker, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Helper to check if a password is set for a player
  const hasPasswordSet = (player: "محمد" | "خالد" | null) => {
    if (!player) return false;
    const pwd = localStorage.getItem(`pay_law_pwd_${player}`);
    return pwd !== null && pwd.trim() !== "";
  };

  // Click on a player card
  const handlePlayerCardClick = (playerName: "محمد" | "خالد") => {
    setSelectedLoginPlayer(playerName);
    setPasswordInput("");
    setNewPasswordInput("");
    setConfirmPasswordInput("");
    setPasswordError(null);
  };

  // Cancel login selection
  const cancelLoginSelection = () => {
    setSelectedLoginPlayer(null);
    setPasswordInput("");
    setNewPasswordInput("");
    setConfirmPasswordInput("");
    setPasswordError(null);
  };

  // Handle setting a password for the first time
  const handlePasswordSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoginPlayer) return;
    
    if (newPasswordInput.trim().length === 0) {
      setPasswordError("كلمة المرور لا يمكن أن تكون فارغة.");
      return;
    }
    
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError("كلمتا المرور غير متطابقتين. يرجى التأكيد بشكل صحيح.");
      return;
    }

    // Save password
    localStorage.setItem(`pay_law_pwd_${selectedLoginPlayer}`, newPasswordInput);
    
    // Log the user in
    setActivePlayer(selectedLoginPlayer);
    localStorage.setItem("pay_law_active_player", selectedLoginPlayer);
    
    // Reset wizard states
    setSelectedLoginPlayer(null);
    setNewPasswordInput("");
    setConfirmPasswordInput("");
    setPasswordError(null);

    showToast(`🔒 مرحباً بك يا ${selectedLoginPlayer}! تم تعيين كلمة المرور وبدء الجلسة بنجاح.`);
  };

  // Handle password login
  const handlePasswordLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoginPlayer) return;

    const savedPwd = localStorage.getItem(`pay_law_pwd_${selectedLoginPlayer}`);
    if (passwordInput === savedPwd) {
      // Correct password
      setActivePlayer(selectedLoginPlayer);
      localStorage.setItem("pay_law_active_player", selectedLoginPlayer);
      
      // Reset wizard status
      setSelectedLoginPlayer(null);
      setPasswordInput("");
      setPasswordError(null);

      showToast(`🚪 مرحباً بك مجدداً يا ${selectedLoginPlayer}! تم الدخول بنجاح.`);
    } else {
      setPasswordError("كلمة المرور غير صحيحة! يرجى إعادة المحاولة.");
    }
  };

  // Handle player login session (Fallback/Backward compatibility helper)
  const loginPlayerSession = (playerName: "محمد" | "خالد") => {
    handlePlayerCardClick(playerName);
  };

  const handleLogout = () => {
    setActivePlayer(null);
    localStorage.removeItem("pay_law_active_player");
  };

  // Change simulated date for sandbox timeline traveler
  const handleSimulatedDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      setSimulatedDate(val);
      localStorage.setItem("pay_law_simulated_date", val);
      showToast(`📅 تم تغيير اليوم المحاكي نشطاً إلى ${val}`);
    }
  };

  // Metrics computation helper for a particular database
  const getMetrics = (db: Record<string, DayState>) => {
    let successDays = 0;
    let failedDays = 0;
    let penalties = 0;
    let currentStreak = 0;
    let longestStreak = 0;
    let evaluatedCount = 0;

    // Sort to trace sequential streaks
    const sortedKeys = Object.keys(db).sort();

    sortedKeys.forEach((k) => {
      const day = db[k];
      if (k <= simulatedDate) {
        if (day.status !== "none") {
          evaluatedCount++;
          if (day.status === "success") {
            successDays++;
            currentStreak++;
            if (currentStreak > longestStreak) {
              longestStreak = currentStreak;
            }
          } else {
            failedDays++;
            penalties += day.penalty;
            currentStreak = 0; // streak broken
          }
        }
      }
    });

    const activeTotalDays = sortedKeys.length;
    const ratio = evaluatedCount > 0 ? Math.round((successDays / evaluatedCount) * 100) : 0;

    return {
      successDays,
      failedDays,
      penalties,
      ratio,
      longestStreak,
      activeTotalDays,
      evaluatedCount
    };
  };

  // Memoized metrics of each player
  const mohamedMetrics = useMemo(() => getMetrics(mohamedDb), [mohamedDb, simulatedDate]);
  const khaledMetrics = useMemo(() => getMetrics(khaledDb), [khaledDb, simulatedDate]);

  // Metrics specifically for the currently logged-in player
  const activeMetrics = useMemo(() => {
    if (!activePlayer) return null;
    return activePlayer === "محمد" ? mohamedMetrics : khaledMetrics;
  }, [activePlayer, mohamedMetrics, khaledMetrics]);

  // Current logged in DB
  const activePlayerDb = useMemo<Record<string, DayState>>(() => {
    if (!activePlayer) return {};
    return activePlayer === "محمد" ? mohamedDb : khaledDb;
  }, [activePlayer, mohamedDb, khaledDb]);

  // Dynamic ranking logic
  const leaderInfo = useMemo(() => {
    const m = mohamedMetrics;
    const k = khaledMetrics;

    if (m.successDays === 0 && k.successDays === 0) {
      return { name: "السباق لم يبدأ بعد 🏁", highlight: false };
    }

    if (m.successDays > k.successDays) {
      return { name: "محمد (الملتزم الحالي) 👑", highlight: true };
    } else if (k.successDays > m.successDays) {
      return { name: "خالد (الملتزم الحالي) 👑", highlight: true };
    } else {
      // Tie breaker based on penalties (fewer is better)
      if (m.penalties < k.penalties) {
        return { name: "محمد 👑 (بفضل قلة الغرامات)", highlight: true };
      } else if (k.penalties < m.penalties) {
        return { name: "خالد 👑 (بفضل قلة الغرامات)", highlight: true };
      } else {
        return { name: "تعادل ناري كلي ومادي مطلق! ⚔️", highlight: false };
      }
    }
  }, [mohamedMetrics, khaledMetrics]);

  // Reset database tool for testing
  const masterResetChallenge = () => {
    if (window.confirm("⚠️ هل أنت متأكد تماماً من تصفير وإعادة تعيين كافة الأيام والإحصائيات لكل اللاعبين؟")) {
      localStorage.removeItem("pay_law_db_محمد");
      localStorage.removeItem("pay_law_db_خالد");
      localStorage.removeItem("pay_law_simulated_date");
      localStorage.removeItem("pay_law_active_player");
      window.location.reload();
    }
  };

  // Toggle tasks check
  const toggleTaskCheckbox = (taskIdx: number) => {
    if (!selectedDayId || !activePlayer) return;
    const db = activePlayer === "محمد" ? { ...mohamedDb } : { ...khaledDb };
    const day = { ...db[selectedDayId] };

    if (!day) return;

    const isFuture = selectedDayId > simulatedDate;
    const isPast = selectedDayId < simulatedDate;

    if (isFuture) {
      showToast("🔒 هذا اليوم مستقبلي! لا يمكنك إنجاز أو تحضير مهامه مسبقاً.");
      return;
    }
    if (isPast || day.status !== "none") {
      showToast("🔒 هذا اليوم مقفل للقراءة فقط ولا يمكن تعديله.");
      return;
    }

    if (day.firstModifyTimestamp === null) {
      day.firstModifyTimestamp = Date.now();
    }

    // Toggle specific indices
    const updatedTasks = [...day.tasks];
    updatedTasks[taskIdx] = !updatedTasks[taskIdx];
    day.tasks = updatedTasks;

    // Recalculate dynamic progress
    const dayTaskList = getDayTasksList(selectedDayId);
    const checkedCount = updatedTasks.slice(0, dayTaskList.length).filter(Boolean).length;
    day.completedCount = checkedCount;
    day.progress = Math.round((checkedCount / dayTaskList.length) * 100);

    db[selectedDayId] = day;
    saveState(activePlayer, db);
  };

  // Click Submit/Approve for the active simulated day
  const submitDayAssessment = () => {
    if (!selectedDayId || !activePlayer) return;
    const db = activePlayer === "محمد" ? { ...mohamedDb } : { ...khaledDb };
    const day = { ...db[selectedDayId] };

    if (!day) return;

    if (selectedDayId !== simulatedDate) {
      showToast("🔒 يمكنك فقط اعتماد وحسم اليوم الحالي النشط.");
      return;
    }

    const dayTaskList = getDayTasksList(selectedDayId);
    const checkedCount = day.tasks.slice(0, dayTaskList.length).filter(Boolean).length;
    day.completedCount = checkedCount;
    day.progress = Math.round((checkedCount / dayTaskList.length) * 100);
    day.finalCommitTimestamp = Date.now();

    if (checkedCount === dayTaskList.length) {
      day.status = "success";
      day.penalty = 0;
      day.reasons = "🎉 نجوت بكفاءة واعتمدت اليوم بنجاح!";
      
      // trigger custom visual celebrations
      try {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#6366f1", "#00ff9d", "#fbbf24", "#3b82f6", "#ec4899"]
        });
      } catch (err) {
        console.error("Confetti error", err);
      }
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 5000);
      showToast("🏆 بطل خارق! لقد أنهيت كافة الالتزامات بنجاح وتم الاعتماد كلياً.");
    } else {
      day.status = "failed";
      day.penalty = 50;

      // Extract raw uncompleted tasks
      const failedList: string[] = [];
      dayTaskList.forEach((taskName, i) => {
        const isChecked = !!day.tasks[i];
        if (!isChecked) {
          failedList.push(`❌ لم يكتمل: ${taskName}`);
        }
      });
      day.reasons = failedList.join(" || ");
      showToast("💀 مسجل غرامة! تم فرض غرامة قدرها 50 جنيهاً لتقصيرك في الالتزازات اليومية.");
    }

    db[selectedDayId] = day;
    saveState(activePlayer, db);
  };

  // Filter keys according to chosen month tab
  const filteredDayKeys = useMemo(() => {
    const keys = Object.keys(activePlayerDb).sort();
    if (selectedMonthFilter === "all") return keys;
    return keys.filter((k) => {
      const parts = k.split("-");
      return parts[1] === selectedMonthFilter;
    });
  }, [activePlayerDb, selectedMonthFilter]);

  // Read-only logs of evaluated elements
  const historicalEvaluatedDays = useMemo(() => {
    const list = (Object.values(activePlayerDb) as DayState[]).filter((d) => d.status !== "none");
    // Sort reverse chronological
    return list.sort((a, b) => b.id.localeCompare(a.id));
  }, [activePlayerDb]);

  return (
    <div className="min-h-screen bg-[#05070f] text-[#f8fafc] p-3 md:p-6 select-none relative" dir="rtl">
      
      {/* Decorative top cyberpunk accent light bar */}
      <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-indigo-500 via-amber-500 to-red-500 shadow-[0_0_15px_#4f46e5] z-10"></div>

      {/* Celebration Overlay */}
      {showCelebration && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="text-8xl animate-bounce">🏆</div>
          <div className="text-3xl font-extrabold text-[#00FF9D] mt-4 tracking-wider text-center drop-shadow-[0_0_10px_rgba(0,255,157,0.3)]">
            عمل مشرف ومثال للالتزام المالي! 🎉
          </div>
          <p className="text-xs text-gray-300 mt-2">تم الإفلات الرسمي والنجاة من الـ 50 ج لهذا اليوم!</p>
        </div>
      )}

      {/* Toast Alert Popups */}
      {toastMessage && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
          <div className="glass-panel text-white rounded-xl shadow-2xl p-4 border-r-4 border-red-500 bg-[#0d1426]/90 glow-red flex items-center gap-3">
            <span className="text-lg">🚨</span>
            <p className="text-xs font-semibold leading-relaxed text-gray-100">{toastMessage}</p>
          </div>
        </div>
      )}

      {/* 2026 CYBERPUNK USER SELECTION CARD CARD IF NOT CHOSEN */}
      {!activePlayer ? (
        <div className="fixed inset-0 bg-[#04060b]/98 z-50 flex flex-col justify-center items-center p-4 overflow-y-auto">
          <div className="text-center max-w-lg w-full my-auto">
            <style>{`
              @keyframes skull-pulse {
                0%, 100% { transform: scale(1); filter: drop-shadow(0 0 12px rgba(239,68,68,0.7)); }
                50% { transform: scale(1.04); filter: drop-shadow(0 0 25px rgba(239,68,68,1)); }
              }
              @keyframes text-glitch {
                0%, 100% { text-shadow: 0 0 10px rgba(239, 68, 68, 0.8), 0 0 20px rgba(239, 68, 68, 0.4); }
                33% { text-shadow: 2px 2px 0px rgba(244, 63, 94, 0.9), -2px -2px 0px rgba(99, 102, 241, 0.9); }
                66% { text-shadow: -1px 2px 0px rgba(16, 185, 129, 0.9), 1px -2px 0px rgba(245, 158, 11, 0.9); }
              }
              .animate-skull-glow {
                animation: skull-pulse 2.5s infinite ease-in-out;
              }
              .animate-cyber-text {
                animation: text-glitch 5s infinite linear;
              }
            `}</style>
            <div className="welcome-title text-3xl md:text-5xl font-black leading-tight select-none animate-skull-glow mb-4">
              <span className="text-white font-black">💀 هتدفع هوريك اللي </span>
              <span className="text-red-500 font-black animate-cyber-text">عمرك ما شفته 💀</span>
            </div>
            
            {!selectedLoginPlayer ? (
              <>
                <p className="text-gray-400 font-medium text-xs md:text-sm mt-4 px-6 leading-relaxed">
                  قانون الدفع والمنافسة اليومية الصارمة للمذاكرة والامتحانات لعام 2026. اختر حسابك المعتمد للدخول والمزامنة:
                </p>

                <div className="player-cards-box mt-10 flex flex-col sm:flex-row gap-5 justify-center w-full max-w-xl px-4">
                  {/* MOHAMED CARD */}
                  <div 
                    id="select-user-mohamed"
                    onClick={() => handlePlayerCardClick("محمد")}
                    className="player-card flex-1 bg-[#0d1428]/60 border border-white/5 backdrop-blur rounded-2xl p-8 text-center cursor-pointer hover:border-indigo-500 hover:shadow-[0_0_30px_rgba(99,102,241,0.2)] hover:-translate-y-1 transition duration-300"
                  >
                    <div className="player-avatar w-16 h-16 rounded-full bg-indigo-500/5 border border-indigo-500/10 hover:border-indigo-500/30 flex items-center justify-center text-3xl mx-auto mb-4">
                      ⚔️
                    </div>
                    <h2 className="text-xl font-black text-white">محمد</h2>
                    <p className="text-[11px] text-gray-500 mt-2 font-medium">لوحة المراقبة والالتزام اليومي الفعلي لمحمد</p>
                  </div>

                  {/* KHALED CARD */}
                  <div 
                    id="select-user-khaled"
                    onClick={() => handlePlayerCardClick("خالد")}
                    className="player-card flex-1 bg-[#0d1428]/60 border border-white/5 backdrop-blur rounded-2xl p-8 text-center cursor-pointer hover:border-pink-500 hover:shadow-[0_0_30px_rgba(244,114,182,0.2)] hover:-translate-y-1 transition duration-300"
                  >
                    <div className="player-avatar w-16 h-16 rounded-full bg-pink-500/5 border border-pink-500/10 hover:border-pink-500/30 flex items-center justify-center text-3xl mx-auto mb-4">
                      ⚡
                    </div>
                    <h2 className="text-xl font-black text-white">خالد</h2>
                    <p className="text-[11px] text-gray-500 mt-2 font-medium">لوحة المراقبة والالتزام اليومي الفعلي لخالد</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-8 bg-[#0d1428]/80 border border-white/10 backdrop-blur rounded-2xl p-6 md:p-8 text-right shadow-[0_0_40px_rgba(30,41,59,0.3)]">
                <div className="flex items-center justify-between pb-3 mb-6 border-b border-white/5">
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <span className="text-2xl">{selectedLoginPlayer === "محمد" ? "⚔️" : "⚡"}</span>
                    <span>حساب اللاعب: {selectedLoginPlayer}</span>
                  </h3>
                  <button 
                    onClick={cancelLoginSelection}
                    className="text-xs text-red-400 hover:text-red-300 font-bold flex items-center gap-1 cursor-pointer transition bg-transparent border-none"
                    type="button"
                  >
                    <span>رجوع لتغيير اللاعب ↩️</span>
                  </button>
                </div>

                {passwordError && (
                  <div className="p-3 mb-4 rounded bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold">
                    ⚠️ {passwordError}
                  </div>
                )}

                {hasPasswordSet(selectedLoginPlayer) ? (
                  <form onSubmit={handlePasswordLoginSubmit}>
                    <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                      هذا الحساب محمي بكلمة مرور. يرجى إدخال كلمة المرور للمتابعة:
                    </p>
                    <div className="mb-5">
                      <label className="block text-xs font-bold text-gray-300 mb-2">كلمة المرور:</label>
                      <input 
                        type="password"
                        placeholder="••••••••"
                        autoFocus
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="w-full bg-black/50 border border-white/15 rounded-lg text-sm p-3 text-white font-bold outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                    <button 
                      type="submit"
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs cursor-pointer transition shadow-lg shadow-indigo-950/50"
                    >
                      تسجيل الدخول والتفتيش الفوري 🚪
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handlePasswordSetupSubmit}>
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded p-3 mb-5 text-amber-300 text-[11px] leading-relaxed">
                      💡 <strong>دخولك الأول للنظام:</strong> يرجى تعيين كلمة مرور خاصة ومحفوظة لحسابك الخاص الآن لتأمين لوحة التزامك من تلاعب الطرف الآخر!
                    </div>
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-300 mb-2">كلمة المرور الجديدة:</label>
                      <input 
                        type="password"
                        placeholder="أدخل كلمة مرور قوية"
                        autoFocus
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                        className="w-full bg-black/50 border border-white/15 rounded-lg text-sm p-3 text-white font-bold outline-none focus:border-[#4fd1c5] transition"
                      />
                    </div>
                    <div className="mb-5">
                      <label className="block text-xs font-bold text-gray-300 mb-2">تأكيد كلمة المرور:</label>
                      <input 
                        type="password"
                        placeholder="أعد كتابة كلمة المرور للتأكيد"
                        value={confirmPasswordInput}
                        onChange={(e) => setConfirmPasswordInput(e.target.value)}
                        className="w-full bg-black/50 border border-white/15 rounded-lg text-sm p-3 text-white font-bold outline-none focus:border-[#4fd1c5] transition"
                      />
                    </div>
                    <button 
                      type="submit"
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs cursor-pointer transition shadow-lg shadow-emerald-950/50"
                    >
                      حفظ كلمة المرور والولوج للتحدي 🔒
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Bottom Credit */}
            <p className="text-[10px] text-gray-400 mt-12 select-none tracking-wider opacity-70">
              نظام محكم إلكتروني باللوحة التشاركية الكلية • تحدي عام 2026 💀
            </p>
          </div>
        </div>
      ) : (
        <div className="container mx-auto block max-w-7xl animate-fade-in" id="main-app-container">
          
          {/* TOP CONTROLS & HEADER METADATA */}
          <header className="flex flex-col md:flex-row justify-between items-center gap-4 bg-[#0d1426]/60 backdrop-blur border border-white/5 p-4 rounded-2xl mb-6">
            
            <div className="text-right">
              <h1 className="text-lg md:text-xl font-black tracking-tight flex items-center gap-1.5 select-none animate-skull-glow">
                <span className="text-white">💀 هتدفع هوريك اللي</span>
                <span className="text-red-500 animate-cyber-text">عمرك ما شفته 💀</span>
              </h1>
              <p className="text-[10px] text-gray-400 mt-0.5">ميثاق الالتزام الحتمي اليومي الصارم لعام 2026</p>
            </div>

            {/* Countdown timer & Active badge switcher */}
            <div className="header-controls flex flex-wrap items-center justify-center gap-3">
              
              {/* COUNTDOWN TIMER */}
              <div id="countdown-timer" className="flex items-center gap-2 bg-black/40 border border-white/5 px-4 py-2 rounded-xl text-xs md:text-sm font-bold">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>المتبقي لمنتصف الليل:</span>
                <span id="clock-digits" className={`font-mono ${countdownColorClass}`}>{countdownStr}</span>
              </div>

              {/* ACTIVE SESSION BADGE */}
              <div className="active-player-badge flex items-center gap-2.5 bg-white/2 px-3 py-1.5 rounded-xl border border-white/5 text-xs text-gray-200">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span>اللاعب النشط: <strong id="lbl-active-player" className="text-indigo-400 font-extrabold">{activePlayer}</strong></span>
                <button 
                  onClick={handleLogout}
                  className="btn-switch px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer transition"
                >
                  تبديل
                </button>
              </div>

            </div>
          </header>

          {/* DYNAMIC METRIC CARDS GRID */}
          {activeMetrics && (
            <div className="dashboard-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              
              <div className="dash-card bg-[#0d1426]/60 backdrop-blur border border-white/5 p-4 rounded-xl text-center">
                <div className="dash-label text-[10px] text-gray-400 font-extrabold mb-1">الأيام الناجحة 🟢</div>
                <div className="dash-value text-xl md:text-2xl font-black text-[#00FF9D]" id="d-succ">
                  {activeMetrics.successDays}
                </div>
              </div>

              <div className="dash-card bg-[#0d1426]/60 backdrop-blur border border-white/5 p-4 rounded-xl text-center">
                <div className="dash-label text-[10px] text-gray-400 font-extrabold mb-1">الأيام الخاسرة 🔴</div>
                <div className="dash-value text-xl md:text-2xl font-black text-red-500" id="d-fail">
                  {activeMetrics.failedDays}
                </div>
              </div>

              <div className="dash-card bg-[#0d1426]/60 backdrop-blur border border-white/5 p-4 rounded-xl text-center">
                <div className="dash-label text-[10px] text-gray-400 font-extrabold mb-1">إجمالي الغرامات 💸</div>
                <div className="dash-value text-xl md:text-2xl font-black text-amber-500" id="d-money">
                  {activeMetrics.penalties} ج
                </div>
              </div>

              <div className="dash-card bg-[#0d1426]/60 backdrop-blur border border-white/5 p-4 rounded-xl text-center">
                <div className="dash-label text-[10px] text-gray-400 font-extrabold mb-1">نسبة الالتزام 📊</div>
                <div className="dash-value text-xl md:text-2xl font-black text-indigo-400" id="d-ratio">
                  {activeMetrics.ratio}%
                </div>
              </div>

              <div className="dash-card bg-[#0d1426]/60 backdrop-blur border border-white/5 p-4 rounded-xl text-center">
                <div className="dash-label text-[10px] text-gray-400 font-extrabold mb-1">أطول سلسلة نجاح 🔥</div>
                <div className="dash-value text-xl md:text-2xl font-black text-orange-500 animate-pulse" id="d-streak">
                  {activeMetrics.longestStreak} يوم
                </div>
              </div>

              <div className="dash-card bg-[#0d1426]/60 backdrop-blur border border-white/5 p-4 rounded-xl text-center">
                <div className="dash-label text-[10px] text-gray-400 font-extrabold mb-1">الأيام الإجمالية 📝</div>
                <div className="dash-value text-xl md:text-2xl font-black text-gray-300" id="d-total">
                  {activeMetrics.activeTotalDays}
                </div>
              </div>

            </div>
          )}

          {/* TWO COLUMN GRID MAIN SYSTEM */}
          <div className="main-layout grid grid-cols-1 lg:grid-cols-12 gap-5 mb-8">
            
            {/* COLUMN 1: MITHAQ & THE ANNUAL GRID JOURNAL (7/12 width) */}
            <main className="lg:col-span-8 flex flex-col gap-5">
              
              {/* MITHAQ LAW CARD */}
              <div className="section-card bg-[#0d1426]/60 backdrop-blur border border-white/5 p-5 rounded-2xl">
                <h2 className="section-title text-sm md:text-base font-extrabold text-white pb-3 mb-4 border-b border-white/5 flex items-center gap-2">
                  <span>⚖️ ميثاق وبنود قانون الدفع التاريخي (منذ 18 يونيو 2026)</span>
                </h2>
                
                <div className="law-grid grid grid-cols-1 sm:grid-cols-2 gap-4 bg-black/20 p-4 rounded-xl border border-white/5 text-xs text-gray-300">
                  <div className="law-item leading-relaxed">
                    🎯 <strong>الهدف الأسمى:</strong> الالتزام اليومي المطلق بالمذاكرة والعمل الهادف دون أي ركون أو تسويف.
                  </div>
                  <div className="law-item leading-relaxed">
                    🔒 <strong>قفل الأيام الكوني:</strong> ينتهي اليوم برمجياً عند 12:00 AM؛ وتتحول الأيام السابقة فوراً لـ Read-Only مغلق ويقفل المستقبل تلقائياً.
                  </div>
                  <div className="law-item leading-relaxed">
                    ❌ <strong>الخسارة التلقائية:</strong> عدم ضغط زر (اعتماد النتيجة) قبل ميقات منتصف الليل يسجل خسارة وغرامة بـ 50 جنيهاً تلقائياً.
                  </div>
                  <div className="law-item leading-relaxed">
                    💸 <strong>العقوبة الفورية:</strong> دفع <strong className="text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">50 جنيهاً مصرياً كاش</strong> لللاعب المنافس الفائز عن كل يوم غياب أو تقصير.
                  </div>
                </div>
              </div>

              {/* THE TIMELINE TRAVELER CONTROL CARD */}
              <div className="section-card bg-[#0d1426]/60 backdrop-blur border border-white/10 p-5 rounded-2xl relative overflow-hidden">
                <div className="absolute right-0 top-0 h-full w-1.5 bg-amber-500"></div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="text-xs font-black text-amber-500 uppercase font-mono tracking-wider flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5 text-amber-500" />
                      <span>محاكي خط الزمن الافتراضي لعام 2026 (لتجربة الآب واستعراضه)</span>
                    </h3>
                    <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                      بما أن التحدي الفعلي يبدأ في 18 يونيو 2026 واليوم تلمس التاريخ فلكياً، قمنا ببناء محاكي زمن كامل لتجربة الأيام واختبار التحفيل الآلي والاعتماد والغرامات.
                    </p>
                  </div>
                  
                  {/* INPUT CONTROLLER */}
                  <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <span className="text-[10px] text-gray-400 font-bold shrink-0">محاكي اليوم:</span>
                    <input 
                      type="date"
                      min="2026-06-18"
                      max="2026-12-31"
                      value={simulatedDate}
                      onChange={handleSimulatedDateInputChange}
                      className="bg-black/50 border border-white/15 rounded-lg text-xs p-2 text-white font-bold tracking-wide outline-none text-right cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* ANNUAL CHALLENGE GRID JOURNAL */}
              <div className="section-card bg-[#0d1426]/60 backdrop-blur border border-white/5 p-5 rounded-2xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 mb-4 border-b border-white/5">
                  <div>
                    <h2 className="section-title text-sm md:text-base font-extrabold text-white flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-indigo-400" />
                      <span>📅 شبكة التحدي والـ Journal السنوي للالتزام</span>
                    </h2>
                    <p className="text-[10px] text-gray-400 mt-1">اضغط على أي كارت يوم مفتوح لتفعيل المهام الخمس وحسم النتيجة قبل الساعة 12:00 م</p>
                  </div>

                  {/* RESET BUTTON */}
                  <button 
                    onClick={masterResetChallenge}
                    title="فرمتة كاملة للنظام كلياً"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/10 hover:bg-red-600 border border-red-500/20 text-red-400 hover:text-white rounded-lg text-[10px] font-bold cursor-pointer transition shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>تصفير كلي للنظام</span>
                  </button>
                </div>

                {/* MONTH SELECTION NAV TABS */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-4 scrollbar-thin">
                  {ARABIC_MONTHS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMonthFilter(m.id)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer transition ${
                        selectedMonthFilter === m.id
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/40"
                          : "bg-black/30 text-gray-400 hover:text-gray-100 hover:bg-black/55"
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>

                {/* DAYS BOX GRID */}
                <div className="days-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[500px] overflow-y-auto pr-1">
                  {filteredDayKeys.map((dayId, idx) => {
                    const dayData = activePlayerDb[dayId];
                    if (!dayData) return null;

                    const isCurrent = dayId === simulatedDate;
                    const isFuture = dayId > simulatedDate;
                    const isPast = dayId < simulatedDate;

                    // Compute dynamic display styling
                    let cardBorder = "border-white/5 bg-[#162040]/40";
                    let statusLabel = "⏳ قيد المراقبة";
                    
                    if (isFuture) {
                      cardBorder = "border-white/5 opacity-35 bg-black/30 cursor-not-allowed";
                      statusLabel = "🔒 غدا ومستقبلي";
                    } else if (isCurrent) {
                      cardBorder = "border-indigo-500/50 hover:border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.15)] bg-indigo-950/20";
                      statusLabel = dayData.status === "none" ? "⚡ مفتوح للحسم" : (dayData.status === "success" ? "🏆 ناجح" : "💀 خسران");
                    } else if (isPast) {
                      if (dayData.status === "success") {
                        cardBorder = "border-emerald-500/30 hover:border-emerald-500 bg-emerald-950/10 hover:bg-emerald-950/20";
                        statusLabel = "🏆 ناجح مقفل";
                      } else {
                        cardBorder = "border-red-500/30 hover:border-red-500 bg-red-950/10 hover:bg-red-950/20";
                        statusLabel = "💀 خسران مقفل";
                      }
                    }

                    return (
                      <div
                        key={dayId}
                        onClick={() => {
                          if (isFuture) {
                            showToast("🔒 هذا اليوم لم يأتِ بعد! لا يمكنك فتحه أو مراجعته مسبقاً.");
                          } else {
                            setSelectedDayId(dayId);
                          }
                        }}
                        className={`p-3 md:p-4 rounded-xl border flex flex-col justify-between cursor-pointer transition transform hover:-translate-y-0.5 duration-200 ${cardBorder}`}
                      >
                        <div className="text-right">
                          <span className="text-[9px] text-[#888888] font-bold block">اليوم {idx + 1}</span>
                          <span className="text-xs font-black tracking-wide text-gray-150 block mt-0.5 font-mono">
                            {dayId.split("-").reverse().join("/")}
                          </span>
                        </div>

                        {/* Middle progress percentage indicator */}
                        <div className="my-3">
                          <div className="flex justify-between items-center text-[10px] text-gray-400 mb-1">
                            <span>المهام: {dayData.completedCount}/{getDayTasksList(dayId).length}</span>
                            <span className="font-bold">{dayData.progress}%</span>
                          </div>
                          <div className="w-full bg-black/40 h-[4px] rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${
                                dayData.status === "success" 
                                  ? "bg-[#00FF9D]" 
                                  : dayData.status === "failed" 
                                  ? "bg-red-500" 
                                  : "bg-indigo-500"
                              }`}
                              style={{ width: `${dayData.progress}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Status Label Indicator */}
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold ${
                            dayData.status === "success" 
                              ? "text-emerald-400" 
                              : dayData.status === "failed" 
                              ? "text-red-400" 
                              : isCurrent 
                              ? "text-indigo-400 animate-pulse font-extrabold" 
                              : "text-gray-500"
                          }`}>
                            {statusLabel}
                          </span>
                          
                          {dayData.penalty > 0 && (
                            <span className="text-[10px] font-black text-rose-500">
                              (50 ج 💸)
                            </span>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>

              </div>

            </main>

            {/* COLUMN 2: SPORTY HEAD-TO-HEAD VS SCORES ARENA (5/12 width) */}
            <aside className="lg:col-span-4 flex flex-col gap-5">
              
              {/* COMPETITION VS HEALTHY BOX BOARD */}
              <div className="section-card bg-[#0d1426]/60 backdrop-blur border border-white/5 p-5 rounded-2xl flex flex-col justify-between">
                <div>
                  <h2 className="section-title text-sm md:text-base font-extrabold text-white pb-3 mb-4 border-b border-white/5 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-400" />
                    <span>⚔️ لوحة التنافس والمواجهة المباشرة H2H</span>
                  </h2>

                  {/* Sport header names bar */}
                  <div className="h2h-header-vs grid grid-cols-3 items-center bg-gradient-to-b from-[#0f172a] to-[#1e293b]/40 py-4 px-2 rounded-xl border border-white/5 mb-6 text-center shadow-inner">
                    <div className="h2h-player-tab text-sm font-black text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.2)]">محمد</div>
                    <div className="flex justify-center">
                      <div className="h2h-vs-badge bg-red-500 text-white font-black text-[10px] uppercase px-3 py-1 rounded-md rotate-[-3deg] border border-white/20 shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                        VS
                      </div>
                    </div>
                    <div className="h2h-player-tab text-sm font-black text-pink-400 drop-shadow-[0_0_15px_rgba(244,114,182,0.2)]">خالد</div>
                  </div>

                  {/* SUCCESS DAYS ROW */}
                  <div className="h2h-stat-row bg-white/[0.01] border border-white/[0.03] rounded-xl p-3.5 mb-3 hover:bg-white/[0.02] hover:border-white/[0.05] transition">
                    <div className="h2h-values-grid grid grid-cols-2 text-center text-xl font-extrabold font-mono mb-1 leading-none">
                      <div className="h2h-val-m text-emerald-400 font-bold text-right pl-6 border-l border-white/5">
                        {mohamedMetrics.successDays}
                      </div>
                      <div className="h2h-val-k text-emerald-400 font-bold text-left pr-6">
                        {khaledMetrics.successDays}
                      </div>
                    </div>
                    <div className="h2h-stat-label text-center text-[10px] text-gray-400 font-extrabold tracking-wider">الأيام الناجحة ✅</div>
                  </div>

                  {/* FAILED DAYS ROW */}
                  <div className="h2h-stat-row bg-white/[0.01] border border-white/[0.03] rounded-xl p-3.5 mb-3 hover:bg-white/[0.02] hover:border-white/[0.05] transition">
                    <div className="h2h-values-grid grid grid-cols-2 text-center text-xl font-extrabold font-mono mb-1 leading-none">
                      <div className="h2h-val-m text-red-400 font-bold text-right pl-6 border-l border-white/5">
                        {mohamedMetrics.failedDays}
                      </div>
                      <div className="h2h-val-k text-red-400 font-bold text-left pr-6">
                        {khaledMetrics.failedDays}
                      </div>
                    </div>
                    <div className="h2h-stat-label text-center text-[10px] text-gray-400 font-extrabold tracking-wider">الأيام الخاسرة ❌</div>
                  </div>

                  {/* COMPLIANCE RATIO */}
                  <div className="h2h-stat-row bg-white/[0.01] border border-white/[0.03] rounded-xl p-3.5 mb-3 hover:bg-white/[0.02] hover:border-white/[0.05] transition">
                    <div className="h2h-values-grid grid grid-cols-2 text-center text-xl font-extrabold font-mono mb-1 leading-none">
                      <div className="h2h-val-m text-sky-400 font-bold text-right pl-6 border-l border-white/5">
                        {mohamedMetrics.ratio}%
                      </div>
                      <div className="h2h-val-k text-pink-400 font-bold text-left pr-6">
                        {khaledMetrics.ratio}%
                      </div>
                    </div>
                    <div className="h2h-stat-label text-center text-[10px] text-gray-400 font-extrabold tracking-wider">نسبة الالتزام الإجمالية 📊</div>
                  </div>

                  {/* TOTAL PENALTY CASH */}
                  <div className="h2h-stat-row bg-white/[0.01] border border-white/[0.03] rounded-xl p-3.5 mb-3 hover:bg-white/[0.02] hover:border-white/[0.05] transition">
                    <div className="h2h-values-grid grid grid-cols-2 text-center text-xl font-extrabold font-mono mb-1 leading-none">
                      <div className="h2h-val-m text-amber-500 font-bold text-right pl-6 border-l border-white/5">
                        {mohamedMetrics.penalties} ج
                      </div>
                      <div className="h2h-val-k text-amber-500 font-bold text-left pr-6">
                        {khaledMetrics.penalties} ج
                      </div>
                    </div>
                    <div className="h2h-stat-label text-center text-[10px] text-gray-400 font-extrabold tracking-wider">الغرامات والمدفوعات المتراكمة 💸</div>
                  </div>

                  {/* STREAK */}
                  <div className="h2h-stat-row bg-white/[0.01] border border-white/[0.03] rounded-xl p-3.5 mb-6 hover:bg-white/[0.02] hover:border-white/[0.05] transition">
                    <div className="h2h-values-grid grid grid-cols-2 text-center text-xl font-extrabold font-mono mb-1 leading-none">
                      <div className="h2h-val-m text-orange-400 font-bold text-right pl-6 border-l border-white/5">
                        {mohamedMetrics.longestStreak}
                      </div>
                      <div className="h2h-val-k text-orange-400 font-bold text-left pr-6">
                        {khaledMetrics.longestStreak}
                      </div>
                    </div>
                    <div className="h2h-stat-label text-center text-[10px] text-gray-400 font-extrabold tracking-wider">أطول سلسلة التزام متواصل 🔥</div>
                  </div>

                </div>

                {/* VISUAL CROWN HIGHLIGHT LEADER BANNER */}
                <div 
                  className={`leader-banner p-4 rounded-xl text-center text-xs font-black border transition-all duration-300 ${
                    leaderInfo.highlight
                      ? "bg-amber-500/10 border-amber-500 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                      : "bg-white/[0.02] border-white/10 text-gray-300"
                  }`}
                  id="vs-leader-zone"
                >
                  🏆 المتصدر والملتزم الحالي بالسباق: <span id="vs-leader-name" className="text-sm font-black text-rose block mt-1">{leaderInfo.name}</span>
                </div>

              </div>

            </aside>

          </div>

          {/* READ ONLY TABULAR HISTORY OF COMPLETED EVALUATED DAYS */}
          <div className="section-card bg-[#0d1426]/60 backdrop-blur border border-white/5 p-5 rounded-2xl mb-12">
            
            <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
              <div>
                <h3 className="text-sm md:text-base font-extrabold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                  <span>📋 السجل والأرشيف التاريخي التراكمي الموثق (للأيام السابقة المقفلة)</span>
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">يحتوي على تفاصيل قرارات كسر الالتزام وأسباب فرض الغرامات لكلا المحاربين</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 font-bold">
                    <th className="py-2.5 font-extrabold">التاريخ</th>
                    <th className="py-2.5 font-extrabold">حالة التقييم النهائية</th>
                    <th className="py-2.5 font-extrabold">معدل إنجاز المهام</th>
                    <th className="py-2.5 font-extrabold">مسببات الخسارة المفصلة</th>
                    <th className="py-2.5 font-extrabold">الغرامة المستحقة</th>
                  </tr>
                </thead>
                <tbody id="history-table-body" className="divide-y divide-white/5">
                  {historicalEvaluatedDays.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500 font-bold">
                        لا توجد أي سجلات مقفلة أو غرامات سابقة مسجلة لخط التتبع الافتراضي الحالي.
                      </td>
                    </tr>
                  ) : (
                    historicalEvaluatedDays.map((day) => {
                      const isSuccess = day.status === "success";
                      return (
                        <tr key={day.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="py-3 font-mono font-bold text-gray-200">
                            {day.id.split("-").reverse().join("/")}
                          </td>
                          <td className="py-3 font-bold">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                              isSuccess 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                                : "bg-red-500/10 text-red-400 border-red-500/30"
                            }`}>
                              {isSuccess ? "🏆 ناجح معتمد" : "💀 خسران"}
                            </span>
                          </td>
                          <td className="py-3 font-bold font-mono">
                            {day.progress}%
                          </td>
                          <td className="py-3 text-[11px] leading-relaxed max-w-[280px]">
                            {isSuccess ? (
                              <span className="text-emerald-400 font-bold">نجح في الموعد والالتزام واعتمد 🟢</span>
                            ) : (
                              <div className="space-y-1">
                                {day.reasons.split(" || ").map((r, rIdx) => (
                                  <p key={rIdx} className="text-red-400 font-medium text-[10px]">{r}</p>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className={`py-3 font-mono font-black ${isSuccess ? "text-gray-400" : "text-amber-500"}`}>
                            {day.penalty} ج
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>

          {/* OVERLAY MODAL FOR DAY DETAIL INSPECTION & EDIT */}
          {selectedDayId && (() => {
            const dayData = activePlayerDb[selectedDayId];
            if (!dayData) return null;

            const isCurrent = selectedDayId === simulatedDate;
            const isFuture = selectedDayId > simulatedDate;
            const isPast = selectedDayId < simulatedDate;
            const isReadOnly = isPast || dayData.status !== "none";

            return (
              <div 
                className="overlay fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex justify-center items-center p-4 animate-fade-in" 
                id="day-modal-overlay"
                onClick={() => setSelectedDayId(null)}
              >
                <div 
                  className="modal-content bg-[#0b101f] border border-white/10 rounded-2xl max-w-lg w-full p-6 text-right relative shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  
                  {/* CLOSE MODAL BUTTON */}
                  <button 
                    className="close-btn absolute top-5 left-5 bg-white/5 hover:bg-red-600 hover:text-white rounded-full w-8 h-8 flex items-center justify-center text-white cursor-pointer transition-colors duration-150"
                    onClick={() => setSelectedDayId(null)}
                  >
                    ✕
                  </button>

                  <div className="modal-header mb-5">
                    <h2 className="modal-title text-base font-black text-white">{dayData.dateString}</h2>
                    <p className="modal-subtitle text-[10px] text-gray-400 mt-1" id="m-subtitle">
                      {isReadOnly 
                        ? "🔒 وضع القراءة فقط (تم الإغلاق والتقييم النهائي لهذا اليوم ولا يمكن التعديل عليه)" 
                        : "⚡ هذا اليوم متاح حالياً للتعديل والاعتماد قبل منتصف الليل"}
                    </p>
                  </div>

                  {/* PROGRESS BAR BAR */}
                  <div className="mb-6">
                    <div className="flex justify-between items-center text-[11px] text-gray-300 mb-2">
                      <span>شريط تقدم مهام اليوم الفعلي:</span>
                      <span id="m-progress-txt" className="font-extrabold text-indigo-400">{dayData.progress}%</span>
                    </div>
                    <div className="progress-container w-full bg-black/50 h-[8px] rounded-full overflow-hidden">
                      <div 
                        className="progress-bar h-full bg-gradient-to-l from-indigo-500 to-emerald-400 rounded-full transition-all duration-300"
                        id="m-progress-bar"
                        style={{ width: `${dayData.progress}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* CHECKBOX CHORES LIST */}
                  <div className="tasks-wrapper mb-6 space-y-2.5" id="m-tasks-container">
                    {getDayTasksList(selectedDayId).map((taskText, tIdx) => {
                      const isChecked = !!dayData.tasks[tIdx];
                      return (
                        <div 
                          key={tIdx}
                          onClick={() => toggleTaskCheckbox(tIdx)}
                          className={`task-item flex items-center gap-3 p-3 bg-white/[0.02] border rounded-xl cursor-pointer transition-colors ${
                            isReadOnly ? "cursor-not-allowed opacity-80" : "hover:bg-white/[0.04]"
                          } ${isChecked ? "border-[#00FF9D]/30" : "border-white/5"}`}
                        >
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            disabled={isReadOnly}
                            onChange={() => {}} // toggled via parent div click
                            className="w-4 h-4 accent-[#00FF9D] shrink-0 cursor-pointer disabled:cursor-not-allowed"
                            id={`chk-task-${tIdx}`}
                          />
                          <span className={`text-xs text-gray-200 ${isChecked ? "line-through text-gray-450" : ""}`}>
                            {taskText}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* ACTIONS BAR */}
                  {isCurrent && !isReadOnly ? (
                    <button 
                      onClick={submitDayAssessment}
                      className="btn-submit-day w-full py-3 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg cursor-pointer transform active:scale-98 transition duration-150"
                      id="m-btn-submit"
                    >
                      ✅ اعتماد اليوم الحالي
                    </button>
                  ) : null}

                  {/* VERDICT FEEDBACK FEED */}
                  {dayData.status !== "none" && (
                    <div 
                      className={`alert-box p-3.5 rounded-xl text-xs leading-relaxed mt-4 border ${
                        dayData.status === "success" 
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" 
                          : "bg-red-500/10 border-red-500 text-red-300"
                      }`}
                      style={{ display: "block" }}
                    >
                      {dayData.status === "success" ? (
                        <p>🟢 ناجح وملتزم: لقد نجوت من غرامة الـ 50 جنيهاً لهذا اليوم! تم الحسم والاعتماد بنجاح.</p>
                      ) : (
                        <div>
                          <strong>💀 خسران - تم فرض عقوبة غرامية 50 جنيهاً مصرياً بسبب:</strong>
                          <div className="space-y-1 mt-2.5">
                            {dayData.reasons.split(" || ").map((r, rIdx) => (
                              <p key={rIdx} className="text-red-400 text-[10px] font-bold">{r}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            );
          })()}

          {/* FOOTER METADATA */}
          <footer className="w-full max-w-7xl mx-auto py-8 border-t border-white/5 text-center text-[10px] text-gray-550 flex flex-col items-center justify-center gap-1">
            <p>💀 هتدفع هوريك اللي عمرك ما شفته © {SYSTEM_YEAR}</p>
            <p className="mt-1">نظام تتبع الوعي المالي المدارسي والعمل الفعلي لتدعيم الاستمرارية الفائقة ومنع النوم قبل الحفظ والمذاكرة.</p>
          </footer>

        </div>
      )}

    </div>
  );
}
