"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Coffee, 
  LogOut, 
  Clock, 
  TrendingUp, 
  History, 
  CheckCircle,
  MapPin,
  Calendar,
  DollarSign,
  Briefcase,
  Plus,
  Trash2,
  Check,
  X,
  Sparkles,
  AlertCircle,
  FileText,
  Bookmark,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Send,
  Info,
  Gift,
  Users,
  Compass,
  Folder,
  HardDrive,
  Bot,
  FileBarChart
} from "lucide-react";
import { VoiceButton } from "../../components/voice-button";
import { API_URL } from "../../config";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: string;
}

interface ActiveSession {
  id: string;
  type: "WORK" | "BREAK";
  startTime: string;
}

interface TodayRecord {
  id: string;
  status: "PRESENT" | "ABSENT" | "LEAVE" | "HALF_DAY";
  shift?: "MORNING" | "AFTERNOON" | "FULL_DAY";
  checkedInAt?: string;
  checkedOutAt?: string;
  totalHours: number;
  otHours: number;
  breakMinutes: number;
}

type ShiftType = "MORNING" | "AFTERNOON" | "FULL_DAY";

const SHIFT_LABELS: Record<ShiftType, { label: string; time: string; icon: string }> = {
  MORNING:   { label: "Morning",   time: "6 AM – 2 PM",  icon: "🌅" },
  AFTERNOON: { label: "Afternoon", time: "2 PM – 10 PM", icon: "🌙" },
  FULL_DAY:  { label: "Full Day",  time: "9 AM – 6 PM",  icon: "🏢" },
};

// Compute the current attendance period (26th of prev month → 25th of this month)
function getAttendancePeriod(): string {
  const today = new Date();
  let endMonth = today.getMonth(); // 0-indexed
  let endYear = today.getFullYear();
  // If today >= 26, cycle is current month 26 → next month 25
  if (today.getDate() >= 26) {
    endMonth = today.getMonth() + 1;
    if (endMonth > 11) { endMonth = 0; endYear++; }
  }
  const startMonth = endMonth === 0 ? 11 : endMonth - 1;
  const startYear = endMonth === 0 ? endYear - 1 : endYear;
  const startDate = new Date(startYear, startMonth, 26);
  const endDate = new Date(endYear, endMonth, 25);
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  return `${fmt(startDate)} – ${fmt(endDate)}`;
}

function getManualEntryDateBounds(): { min: string; max: string } {
  const today = new Date();
  let endMonth = today.getMonth();
  let endYear = today.getFullYear();
  if (today.getDate() >= 26) {
    endMonth = today.getMonth() + 1;
    if (endMonth > 11) { endMonth = 0; endYear++; }
  }
  const startMonth = endMonth === 0 ? 11 : endMonth - 1;
  const startYear = endMonth === 0 ? endYear - 1 : endYear;
  const startDate = new Date(startYear, startMonth, 26);
  
  const formatDate = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  return {
    min: formatDate(startDate),
    max: formatDate(today),
  };
}


interface SalarySummary {
  expectedSalary: number;
  earnedTillDate: number;
  otEarnings: number;
  leaveDeductions: number;
  netEarned: number;
  projectedSalary: number;
}

interface HistoryItem {
  id: string;
  date: string;
  status: string;
  shift?: "MORNING" | "AFTERNOON" | "FULL_DAY";
  checkedInAt?: string;
  checkedOutAt?: string;
  totalHours: number;
  otHours: number;
  breakMinutes: number;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "TODO" | "IN_PROGRESS" | "COMPLETED";
  dueDate?: string;
  tags: string[];
  carryForwardCount: number;
}

interface DiaryRecord {
  whatIDid: string;
  issuesFaced: string;
  learnings: string;
  notes: string;
  tomorrowPlan: string;
}

interface ParsedAction {
  type: "TASK" | "EXPENSE" | "DIARY" | "ATTENDANCE" | "UNKNOWN";
  message: string;
  data: any;
}

interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
}

interface Budget {
  id: string;
  category: string;
  limit: number;
  month: number;
  year: number;
}

interface EMI {
  id: string;
  loanName: string;
  amount: number;
  dueDate: string;
  remainingMonths: number;
  totalMonths: number;
}

interface SIP {
  id: string;
  fundName: string;
  amount: number;
  investmentDate: number;
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  
  // Dashboard / Attendance States
  const [checkedIn, setCheckedIn] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [checkedOutToday, setCheckedOutToday] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ShiftType>("FULL_DAY");
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [todayRecord, setTodayRecord] = useState<TodayRecord | null>(null);

  // Manual Attendance Entry States
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualDate, setManualDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [manualShift, setManualShift] = useState<ShiftType>("FULL_DAY");
  const [manualCheckIn, setManualCheckIn] = useState("09:00");
  const [manualCheckOut, setManualCheckOut] = useState("18:00");
  const [manualStatus, setManualStatus] = useState<"PRESENT" | "HALF_DAY" | "LEAVE">("PRESENT");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualSuccess, setManualSuccess] = useState(false);

  
  // Salary State
  const [salarySummary, setSalarySummary] = useState<SalarySummary | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Tasks State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskFilter, setTaskFilter] = useState<"ALL" | "TODO" | "IN_PROGRESS" | "COMPLETED">("ALL");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");
  const [newTaskTags, setNewTaskTags] = useState("");
  
  // Diary State
  const [diaryDate, setDiaryDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [diaryData, setDiaryData] = useState<DiaryRecord>({
    whatIDid: "",
    issuesFaced: "",
    learnings: "",
    notes: "",
    tomorrowPlan: "",
  });
  const [diarySaveSuccess, setDiarySaveSuccess] = useState(false);
  
  // Voice Command / Smart Parser State
  const [voiceCommandText, setVoiceCommandText] = useState("");
  const [parsedAction, setParsedAction] = useState<ParsedAction | null>(null);
  const [showParsePreview, setShowParsePreview] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState("");

  // Timers State
  const [timerString, setTimerString] = useState("00:00:00");
  const [breakTimerString, setBreakTimerString] = useState("00:00:00");

  // Holiday and Calendar states
  const [nextHoliday, setNextHoliday] = useState<any>(null);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [calendarExpanded, setCalendarExpanded] = useState(true);

  // Finance OS States
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [emis, setEmis] = useState<EMI[]>([]);
  const [sips, setSips] = useState<SIP[]>([]);
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newExpenseDesc, setNewExpenseDesc] = useState("");
  const [newExpenseCategory, setNewExpenseCategory] = useState("Food");

  // Life OS & Document OS States
  const [journeys, setJourneys] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [selectedDocCategory, setSelectedDocCategory] = useState<string>("All");
  const [showSyncOnly, setShowSyncOnly] = useState<boolean>(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [showAddJourney, setShowAddJourney] = useState(false);
  const [newDestination, setNewDestination] = useState("");
  const [newJourneyBudget, setNewJourneyBudget] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");

  const [showAddPurchase, setShowAddPurchase] = useState(false);
  const [newPurchaseItem, setNewPurchaseItem] = useState("");
  const [newPurchaseTarget, setNewPurchaseTarget] = useState("");
  const [savingsAmount, setSavingsAmount] = useState<{ [key: string]: string }>({});

  // Store OS, AI OS, & Reports OS States
  const [storeLogs, setStoreLogs] = useState<any[]>([]);
  const [storeKpis, setStoreKpis] = useState<any>({ efficiencyRatio: 0, averageVehicles: 0, totalMaterialReceipts: 0, reconciliationScore: 0 });
  const [showAddStoreLog, setShowAddStoreLog] = useState(false);
  const [newGrnCount, setNewGrnCount] = useState("");
  const [newPoCount, setNewPoCount] = useState("");
  const [newVehicleEntries, setNewVehicleEntries] = useState("");
  const [newMaterialReceipts, setNewMaterialReceipts] = useState("");
  const [newStockVerifications, setNewStockVerifications] = useState("");
  const [newStoreNotes, setNewStoreNotes] = useState("");

  const [aiMessages, setAiMessages] = useState<any[]>([
    { sender: "bot", text: "Hello! I am your GSuite 360 AI Assistant. Ask me questions about your attendance, tasks, salary config, work diary summaries, or expenses." }
  ]);
  const [aiQueryInput, setAiQueryInput] = useState("");
  const [aiQueryLoading, setAiQueryLoading] = useState(false);

  const [reportsSummary, setReportsSummary] = useState<any>(null);
  const [exportLoading, setExportLoading] = useState(false);
  
  const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard' | 'diary' | 'tasks'
  const [loading, setLoading] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const breakTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync manual check-in/out default times based on shift
  useEffect(() => {
    if (manualShift === "MORNING") {
      setManualCheckIn("06:00");
      setManualCheckOut("14:00");
    } else if (manualShift === "AFTERNOON") {
      setManualCheckIn("14:00");
      setManualCheckOut("22:00");
    } else {
      setManualCheckIn("09:00");
      setManualCheckOut("18:00");
    }
  }, [manualShift]);

  // Authenticate and fetch
  useEffect(() => {
    const savedUser = localStorage.getItem("gsuite_user");
    if (!savedUser) {
      window.location.href = "/login";
      return;
    }
    const parsedUser = JSON.parse(savedUser);
    setUser(parsedUser);
    
    fetchInitialData(parsedUser.id);
  }, []);

  const fetchInitialData = async (userId: string) => {
    setLoading(true);
    try {
      // 1. Attendance Today
      const todayRes = await fetch(`${API_URL}/attendance/today?userId=${userId}`);
      if (todayRes.ok) {
        const todayData = await todayRes.json();
        if (todayData.checkedIn) {
          setCheckedIn(true);
          setTodayRecord(todayData.record);
          if (todayData.record.checkedOutAt) {
            setCheckedOutToday(true);
          }
          if (todayData.activeSession) {
            setActiveSession(todayData.activeSession);
            if (todayData.activeSession.type === "BREAK") {
              setOnBreak(true);
            }
          }
        }
      }

      // 2. Salary Summary
      const salaryRes = await fetch(`${API_URL}/salary/summary?userId=${userId}`);
      if (salaryRes.ok) {
        const salaryData = await salaryRes.json();
        setSalarySummary(salaryData);
      } else {
        setDefaultSalaryFallback();
      }

      // 3. History logs
      const historyRes = await fetch(`${API_URL}/attendance/history?userId=${userId}&limit=10`);
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData);
      } else {
        setDefaultHistoryFallback();
      }

      // 4. Tasks list
      const tasksRes = await fetch(`${API_URL}/tasks?userId=${userId}`);
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData);
      } else {
        setDefaultTasksFallback();
      }

      // 5. Work Diary today
      const todayStr = new Date().toISOString().split("T")[0];
      const diaryRes = await fetch(`${API_URL}/diary?userId=${userId}&date=${todayStr}`);
      if (diaryRes.ok) {
        const diaryVal = await diaryRes.json();
        if (diaryVal) {
          setDiaryData({
            whatIDid: diaryVal.whatIDid || "",
            issuesFaced: diaryVal.issuesFaced || "",
            learnings: diaryVal.learnings || "",
            notes: diaryVal.notes || "",
            tomorrowPlan: diaryVal.tomorrowPlan || "",
          });
        }
      }

      // 6. Upcoming Holiday
      try {
        const holidayRes = await fetch(`${API_URL}/holidays/upcoming`);
        if (holidayRes.ok) {
          const holidayData = await holidayRes.json();
          setNextHoliday(holidayData);
        } else {
          setDefaultHolidayFallback();
        }
      } catch (err) {
        setDefaultHolidayFallback();
      }

      // 7. Calendar Events
      try {
        const calendarRes = await fetch(`${API_URL}/calendar?userId=${userId}`);
        if (calendarRes.ok) {
          const calendarData = await calendarRes.json();
          setCalendarEvents(calendarData);
        } else {
          setDefaultCalendarFallback();
        }
      } catch (err) {
        setDefaultCalendarFallback();
      }

      // 8. Finance Expenses
      try {
        const expensesRes = await fetch(`${API_URL}/finance/expenses?userId=${userId}`);
        if (expensesRes.ok) {
          const expensesData = await expensesRes.json();
          setExpenses(expensesData);
        } else {
          setDefaultExpensesFallback();
        }
      } catch (err) {
        setDefaultExpensesFallback();
      }

      // 9. Finance Budgets
      try {
        const budgetsRes = await fetch(`${API_URL}/finance/budgets?userId=${userId}`);
        if (budgetsRes.ok) {
          const budgetsData = await budgetsRes.json();
          setBudgets(budgetsData);
        } else {
          setDefaultBudgetsFallback();
        }
      } catch (err) {
        setDefaultBudgetsFallback();
      }

      // 10. Finance EMIs
      try {
        const emiRes = await fetch(`${API_URL}/finance/emi?userId=${userId}`);
        if (emiRes.ok) {
          const emiData = await emiRes.json();
          setEmis(emiData);
        } else {
          setDefaultEmisFallback();
        }
      } catch (err) {
        setDefaultEmisFallback();
      }

      // 11. Finance SIPs
      try {
        const sipRes = await fetch(`${API_URL}/finance/sip?userId=${userId}`);
        if (sipRes.ok) {
          const sipData = await sipRes.json();
          setSips(sipData);
        } else {
          setDefaultSipsFallback();
        }
      } catch (err) {
        setDefaultSipsFallback();
      }

      // 12. Life OS Journeys
      try {
        const journeysRes = await fetch(`${API_URL}/life/journeys?userId=${userId}`);
        if (journeysRes.ok) {
          const journeysData = await journeysRes.json();
          setJourneys(journeysData.journeys);
        } else {
          setDefaultJourneysFallback();
        }
      } catch (err) {
        setDefaultJourneysFallback();
      }

      // 13. Life OS Purchases
      try {
        const purchasesRes = await fetch(`${API_URL}/life/purchases?userId=${userId}`);
        if (purchasesRes.ok) {
          const purchasesData = await purchasesRes.json();
          setPurchases(purchasesData.purchases);
        } else {
          setDefaultPurchasesFallback();
        }
      } catch (err) {
        setDefaultPurchasesFallback();
      }

      // 14. Document OS Documents
      try {
        const docsRes = await fetch(`${API_URL}/documents?userId=${userId}`);
        if (docsRes.ok) {
          const docsData = await docsRes.json();
          setDocuments(docsData.documents);
        } else {
          setDefaultDocumentsFallback();
        }
      } catch (err) {
        setDefaultDocumentsFallback();
      }

      // 15. Google Connection Status
      try {
        const statusRes = await fetch(`${API_URL}/documents/status`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setIsGoogleConnected(statusData.connected);
        }
      } catch (err) {}

      // 16. Store Logs & KPIs
      try {
        const storeLogsRes = await fetch(`${API_URL}/store/logs?userId=${userId}`);
        if (storeLogsRes.ok) {
          const storeLogsData = await storeLogsRes.json();
          setStoreLogs(storeLogsData.logs);
        } else {
          setDefaultStoreLogsFallback();
        }

        const storeKpisRes = await fetch(`${API_URL}/store/kpis?userId=${userId}`);
        if (storeKpisRes.ok) {
          const storeKpisData = await storeKpisRes.json();
          setStoreKpis(storeKpisData.kpis);
        } else {
          setDefaultStoreKpisFallback();
        }
      } catch (err) {
        setDefaultStoreLogsFallback();
        setDefaultStoreKpisFallback();
      }

      // 17. Reports summary
      try {
        const reportsRes = await fetch(`${API_URL}/reports/summary?userId=${userId}`);
        if (reportsRes.ok) {
          const reportsData = await reportsRes.json();
          setReportsSummary(reportsData.summary);
        } else {
          setDefaultReportsSummaryFallback();
        }
      } catch (err) {
        setDefaultReportsSummaryFallback();
      }

    } catch (err) {
      console.warn("Backend offline. Loading local/mock datasets.");
      setDefaultSalaryFallback();
      setDefaultHistoryFallback();
      setDefaultTasksFallback();
      setDefaultCalendarFallback();
      setDefaultHolidayFallback();
      setDefaultExpensesFallback();
      setDefaultBudgetsFallback();
      setDefaultEmisFallback();
      setDefaultSipsFallback();
      setDefaultJourneysFallback();
      setDefaultPurchasesFallback();
      setDefaultDocumentsFallback();
      setDefaultStoreLogsFallback();
      setDefaultStoreKpisFallback();
      setDefaultReportsSummaryFallback();
    } finally {
      setLoading(false);
    }
  };

  const setDefaultCalendarFallback = () => {
    const today = new Date();
    
    // Meeting 1 (Today)
    const m1Start = new Date(today);
    m1Start.setHours(10, 30, 0, 0);
    const m1End = new Date(today);
    m1End.setHours(11, 30, 0, 0);

    // Meeting 2 (Today)
    const m2Start = new Date(today);
    m2Start.setHours(15, 0, 0, 0);
    const m2End = new Date(today);
    m2End.setHours(15, 45, 0, 0);

    // Birthday (Tomorrow)
    const bStart = new Date(today);
    bStart.setDate(today.getDate() + 1);
    bStart.setHours(9, 0, 0, 0);
    const bEnd = new Date(today);
    bEnd.setDate(today.getDate() + 1);
    bEnd.setHours(18, 0, 0, 0);

    setCalendarEvents([
      {
        id: 'cal-event-1',
        title: 'Supplier GRN Auditing Sync',
        description: 'Verify pending GRNs and match distributor bills.',
        startTime: m1Start.toISOString(),
        endTime: m1End.toISOString(),
        category: 'MEETING',
        location: 'Store Conference Room A',
      },
      {
        id: 'cal-event-2',
        title: 'Tally Prime Integration Review',
        description: 'Syncing local stock ledgers to backend cloud server.',
        startTime: m2Start.toISOString(),
        endTime: m2End.toISOString(),
        category: 'MEETING',
        location: 'Microsoft Teams Link',
      },
      {
        id: 'cal-event-3',
        title: 'Store Executive Aravind Birthday 🎂',
        description: 'Send greetings in Telegram group!',
        startTime: bStart.toISOString(),
        endTime: bEnd.toISOString(),
        category: 'BIRTHDAY',
      }
    ]);
  };

  const setDefaultHolidayFallback = () => {
    setNextHoliday({
      name: 'Independence Day',
      date: '2026-08-15',
      type: 'NATIONAL'
    });
  };

  const setDefaultExpensesFallback = () => {
    const today = new Date();
    const t1 = new Date(today); t1.setHours(13, 15);
    const t2 = new Date(today); t2.setHours(17, 30);
    const t3 = new Date(today); t3.setDate(today.getDate() - 1);
    const t4 = new Date(today); t4.setDate(today.getDate() - 2);

    setExpenses([
      { id: 'exp-mock-1', amount: 250, description: 'Swiggy Lunch', category: 'Food', date: t1.toISOString() },
      { id: 'exp-mock-2', amount: 40, description: 'Tea with team', category: 'Food', date: t2.toISOString() },
      { id: 'exp-mock-3', amount: 1500, description: 'Shell Petrol Full Tank', category: 'Fuel', date: t3.toISOString() },
      { id: 'exp-mock-4', amount: 800, description: 'Cotton T-shirt buy', category: 'Shopping', date: t4.toISOString() },
    ]);
  };

  const setDefaultBudgetsFallback = () => {
    setBudgets([
      { id: 'b-mock-1', category: 'Food', limit: 5000, month: new Date().getMonth() + 1, year: new Date().getFullYear() },
      { id: 'b-mock-2', category: 'Fuel', limit: 3000, month: new Date().getMonth() + 1, year: new Date().getFullYear() },
      { id: 'b-mock-3', category: 'Bills', limit: 10000, month: new Date().getMonth() + 1, year: new Date().getFullYear() },
      { id: 'b-mock-4', category: 'Medical', limit: 2000, month: new Date().getMonth() + 1, year: new Date().getFullYear() },
      { id: 'b-mock-5', category: 'Shopping', limit: 4000, month: new Date().getMonth() + 1, year: new Date().getFullYear() },
      { id: 'b-mock-6', category: 'Travel', limit: 3500, month: new Date().getMonth() + 1, year: new Date().getFullYear() },
    ]);
  };

  const setDefaultEmisFallback = () => {
    const nextDue = new Date();
    nextDue.setDate(10);
    if (new Date().getDate() > 10) nextDue.setMonth(nextDue.getMonth() + 1);
    setEmis([
      { id: 'emi-mock-1', loanName: 'HDFC Car Loan EMI', amount: 12500, dueDate: nextDue.toISOString(), remainingMonths: 24, totalMonths: 36 }
    ]);
  };

  const setDefaultSipsFallback = () => {
    setSips([
      { id: 'sip-mock-1', fundName: 'Quant Active Fund Growth', amount: 5000, investmentDate: 10 },
      { id: 'sip-mock-2', fundName: 'Parag Parikh Flexi Cap Direct Growth', amount: 3000, investmentDate: 15 }
    ]);
  };

  const setDefaultJourneysFallback = () => {
    const today = new Date();
    const startDate = new Date(today); startDate.setDate(today.getDate() + 15);
    const endDate = new Date(today); endDate.setDate(today.getDate() + 19);
    setJourneys([
      {
        id: 'journey-mock-1',
        destination: 'Ooty Trip',
        budget: 25000,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        checklist: JSON.stringify([
          { id: 'item-1', text: 'Book Resort in Ooty', done: true },
          { id: 'item-2', text: 'Pack warm jackets & sweaters', done: false },
          { id: 'item-3', text: 'Rent a self-drive car', done: false },
          { id: 'item-4', text: 'Book Pykara lake boating', done: false },
          { id: 'item-5', text: 'Buy home-made chocolates list', done: false },
        ])
      }
    ]);
  };

  const setDefaultPurchasesFallback = () => {
    const today = new Date();
    const target1 = new Date(today); target1.setMonth(today.getMonth() + 3);
    const target2 = new Date(today); target2.setMonth(today.getMonth() + 6);
    setPurchases([
      { id: 'purchase-mock-1', itemName: 'MacBook Pro 14"', targetAmount: 150000, savedAmount: 60000, targetDate: target1.toISOString() },
      { id: 'purchase-mock-2', itemName: 'Electric Scooter (Ola S1)', targetAmount: 120000, savedAmount: 45000, targetDate: target2.toISOString() }
    ]);
  };

  const setDefaultDocumentsFallback = () => {
    setDocuments([
      { id: 'doc-mock-1', name: 'Aadhaar_Card.pdf', category: 'ID Proof', fileUrl: '#', googleDriveId: 'drive-file-1', size: 1048576, mimeType: 'application/pdf', createdAt: new Date(Date.now() - 5*24*60*60*1000).toISOString() },
      { id: 'doc-mock-2', name: 'Rent_Agreement.pdf', category: 'Other', fileUrl: '#', googleDriveId: 'drive-file-3', size: 2097152, mimeType: 'application/pdf', createdAt: new Date(Date.now() - 3*24*60*60*1000).toISOString() },
      { id: 'doc-mock-3', name: 'Resume_Gunal.pdf', category: 'Resume', fileUrl: '#', googleDriveId: 'drive-file-4', size: 153600, mimeType: 'application/pdf', createdAt: new Date(Date.now() - 1*24*60*60*1000).toISOString() }
    ]);
  };

  const setDefaultStoreLogsFallback = () => {
    const today = new Date();
    const logs = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      logs.push({
        id: `store-mock-${d.getDate()}`,
        date: d.toISOString(),
        grnCount: Math.floor(Math.random() * 10) + 12,
        poCount: Math.floor(Math.random() * 8) + 10,
        vehicleEntries: Math.floor(Math.random() * 15) + 20,
        materialReceipts: Math.floor(Math.random() * 20) + 25,
        stockVerifications: Math.floor(Math.random() * 5) + 5,
        notes: `Operational logs for ${d.toLocaleDateString()}`
      });
    }
    setStoreLogs(logs);
  };

  const setDefaultStoreKpisFallback = () => {
    setStoreKpis({
      efficiencyRatio: 112.4,
      averageVehicles: 28.5,
      totalMaterialReceipts: 242,
      reconciliationScore: 85.0
    });
  };

  const setDefaultReportsSummaryFallback = () => {
    setReportsSummary({
      attendance: { present: 18, absent: 0, halfDay: 1, leave: 0, attendanceRate: 97.4, totalHours: 148.0, otHours: 8.0, morningShift: 2, afternoonShift: 1, fullDayShift: 15 },
      salary: { expectedSalary: 16640, earnedTillDate: 11520, otEarnings: 800, leaveDeductions: 640, netEarned: 12320 },
      expenses: { totalSpent: 7130, foodSpent: 4790, fuelSpent: 1500, billsSpent: 0, shoppingSpent: 800, medicalSpent: 0, travelSpent: 0 },
      finance: { totalEmiAmount: 12500, totalSipAmount: 8000, remainingEmiMonths: 24 },
      work: { diariesLoggedCount: 5, tasksCompleted: 14, tasksPending: 2 }
    });
  };

  const setDefaultSalaryFallback = () => {
    setSalarySummary({
      expectedSalary: 16640,
      earnedTillDate: 11520,
      otEarnings: 800,
      leaveDeductions: 640,
      netEarned: 12320,
      projectedSalary: 16000,
    });
  };

  const setDefaultHistoryFallback = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Compute current attendance period start: 26th of previous month
    // (if today >= 26, period started on the 26th of this month)
    let periodStartMonth = today.getMonth() - 1; // 0-indexed prev month
    let periodStartYear = today.getFullYear();
    if (today.getDate() >= 26) {
      periodStartMonth = today.getMonth();
      periodStartYear = today.getFullYear();
    }
    if (periodStartMonth < 0) {
      periodStartMonth = 11;
      periodStartYear -= 1;
    }
    const periodStart = new Date(periodStartYear, periodStartMonth, 26, 0, 0, 0, 0);

    const shifts: Array<"MORNING" | "AFTERNOON" | "FULL_DAY"> = ["MORNING", "AFTERNOON", "FULL_DAY"];
    const mockHistory: HistoryItem[] = [];
    let idx = 0;

    // Walk from yesterday back to period start
    const cursor = new Date(today);
    cursor.setDate(cursor.getDate() - 1); // start from yesterday

    while (cursor >= periodStart) {
      const dow = cursor.getDay();
      if (dow !== 0) { // skip Sundays only
        idx++;
        const rand = Math.random();
        const shift = shifts[idx % 3]; // cycle through shifts
        const isHalfDay = rand > 0.92;
        const isLeave = rand > 0.97;

        const checkInHour = shift === "MORNING" ? 6 : shift === "AFTERNOON" ? 14 : 9;
        const checkOutHour = shift === "MORNING" ? 14 : shift === "AFTERNOON" ? 22 : 18;
        const totalHours = isLeave ? 0 : isHalfDay ? 4.0 : 8.5;
        const otHours = isLeave || isHalfDay ? 0 : 0.5;

        const checkIn = new Date(cursor);
        checkIn.setHours(checkInHour, 10, 0, 0);
        const checkOut = new Date(cursor);
        checkOut.setHours(checkOutHour, 0, 0, 0);

        mockHistory.push({
          id: `mock-hist-${idx}`,
          date: cursor.toISOString(),
          status: isLeave ? "LEAVE" : isHalfDay ? "HALF_DAY" : "PRESENT",
          shift,
          checkedInAt: isLeave ? undefined : checkIn.toISOString(),
          checkedOutAt: isLeave ? undefined : checkOut.toISOString(),
          totalHours,
          otHours,
          breakMinutes: isLeave ? 0 : 45,
        });
      }
      cursor.setDate(cursor.getDate() - 1);
    }

    setHistory(mockHistory);
  };

  const setDefaultTasksFallback = () => {
    const today = new Date().toISOString();
    setTasks([
      {
        id: "task-mock-1",
        title: "Verify pending PO from local distributors",
        description: "Verify supplier code and match against GRN checklist.",
        priority: "HIGH",
        status: "TODO",
        dueDate: today,
        tags: ["PO", "Verification"],
        carryForwardCount: 1,
      },
      {
        id: "task-mock-2",
        title: "Stock verification at main store aisle B",
        description: "Audit bin capacity and count discrepancy entries.",
        priority: "MEDIUM",
        status: "IN_PROGRESS",
        dueDate: today,
        tags: ["Aisle B", "Audit"],
        carryForwardCount: 0,
      },
      {
        id: "task-mock-3",
        title: "Generate monthly store KPI dashboard report",
        description: "Tally GRN count and PO processing speeds.",
        priority: "LOW",
        status: "COMPLETED",
        dueDate: today,
        tags: ["KPI", "Reports"],
        carryForwardCount: 0,
      }
    ]);
  };

  // Stopwatch effect
  useEffect(() => {
    if (checkedIn && !checkedOutToday) {
      if (!onBreak) {
        if (breakTimerRef.current) clearInterval(breakTimerRef.current);
        const workStartTimeStr = todayRecord?.checkedInAt || activeSession?.startTime || new Date().toISOString();
        const start = new Date(workStartTimeStr).getTime();
        timerRef.current = setInterval(() => {
          setTimerString(formatTime(Date.now() - start));
        }, 1000);
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
        const breakStartTimeStr = activeSession?.startTime || new Date().toISOString();
        const start = new Date(breakStartTimeStr).getTime();
        breakTimerRef.current = setInterval(() => {
          setBreakTimerString(formatTime(Date.now() - start));
        }, 1000);
      }
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (breakTimerRef.current) clearInterval(breakTimerRef.current);
      if (checkedOutToday && todayRecord) {
        const hours = todayRecord.totalHours;
        const h = Math.floor(hours);
        const m = Math.floor((hours - h) * 60);
        setTimerString(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
      } else {
        setTimerString("00:00:00");
      }
      setBreakTimerString("00:00:00");
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    };
  }, [checkedIn, onBreak, checkedOutToday, activeSession, todayRecord]);

  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const secs = totalSecs % 60;
    const mins = Math.floor(totalSecs / 60) % 60;
    const hours = Math.floor(totalSecs / 3600);
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Attendance handlers
  const handleCheckIn = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/attendance/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, shift: selectedShift }),
      });
      if (res.ok) {
        const data = await res.json();
        setCheckedIn(true);
        setOnBreak(false);
        setTodayRecord(data.record);
        setActiveSession(data.activeSession);
        
        // Trigger Auto Carry Forward at check-in
        await fetch(`${API_URL}/tasks/carry-forward`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        });
        
        fetchInitialData(user.id);
      }
    } catch (err) {
      // Offline fallback
      const now = new Date();
      setCheckedIn(true);
      setOnBreak(false);
      const mockSession: ActiveSession = {
        id: `mock-sess-${Date.now()}`,
        type: "WORK",
        startTime: now.toISOString(),
      };
      setActiveSession(mockSession);
      setTodayRecord({
        id: `mock-rec-${Date.now()}`,
        status: "PRESENT",
        shift: selectedShift,
        checkedInAt: now.toISOString(),
        totalHours: 0,
        otHours: 0,
        breakMinutes: 0,
      });
    }
  };

  const handleBreakToggle = async () => {
    if (!user) return;
    const endpoint = onBreak ? "break-out" : "break-in";
    try {
      const res = await fetch(`${API_URL}/attendance/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setOnBreak(!onBreak);
        setActiveSession(data.activeSession);
        fetchInitialData(user.id);
      }
    } catch (err) {
      setOnBreak(!onBreak);
      setActiveSession({
        id: `mock-sess-${Date.now()}`,
        type: onBreak ? "WORK" : "BREAK",
        startTime: new Date().toISOString(),
      });
    }
  };

  const handleCheckOut = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/attendance/check-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setCheckedOutToday(true);
        setTodayRecord(data.record);
        setActiveSession(null);
        fetchInitialData(user.id);
      }
    } catch (err) {
      setCheckedOutToday(true);
      setActiveSession(null);
      if (todayRecord) {
        const now = new Date();
        const start = new Date(todayRecord.checkedInAt || now.toISOString());
        const totalHours = parseFloat(((now.getTime() - start.getTime()) / (1000 * 60 * 60)).toFixed(2));
        const otHours = Math.max(0, parseFloat((totalHours - 8.0).toFixed(2)));
        setTodayRecord({
          ...todayRecord,
          checkedOutAt: now.toISOString(),
          totalHours,
          otHours,
        });
      }
    }
  };

  const handleManualEntry = async () => {
    if (!user) return;
    setManualSaving(true);
    try {
      const dateObj = new Date(manualDate);
      const [inH, inM] = manualCheckIn.split(":").map(Number);
      const [outH, outM] = manualCheckOut.split(":").map(Number);
      const checkInDt = new Date(dateObj);
      checkInDt.setHours(inH, inM, 0, 0);
      const checkOutDt = new Date(dateObj);
      checkOutDt.setHours(outH, outM, 0, 0);

      const res = await fetch(`${API_URL}/attendance/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          date: manualDate,
          shift: manualShift,
          checkedInAt: manualStatus === "LEAVE" ? undefined : checkInDt.toISOString(),
          checkedOutAt: manualStatus === "LEAVE" ? undefined : checkOutDt.toISOString(),
          status: manualStatus,
        }),
      });

      if (res.ok) {
        setManualSuccess(true);
        // Refresh everything
        await fetchInitialData(user.id);
        setTimeout(() => {
          setShowManualEntry(false);
          setManualSuccess(false);
        }, 1500);
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.message || "Failed to save manual attendance entry");
      }
    } catch (e) {
      // offline fallback
      const dateObj = new Date(manualDate);
      const [inH, inM] = manualCheckIn.split(":").map(Number);
      const [outH, outM] = manualCheckOut.split(":").map(Number);
      const checkIn = new Date(dateObj);
      checkIn.setHours(inH, inM, 0, 0);
      const checkOut = new Date(dateObj);
      checkOut.setHours(outH, outM, 0, 0);
      
      const totalHours = manualStatus === "LEAVE" ? 0 : Math.max(0, parseFloat((((checkOut.getTime() - checkIn.getTime()) / 3600000) - (manualShift === "FULL_DAY" ? 0.75 : 0.25)).toFixed(2)));
      const standardHours = 8.0;
      const otHours = Math.max(0, parseFloat((totalHours - standardHours).toFixed(2)));
      
      setHistory(prev => [
        {
          id: `manual-${Date.now()}`,
          date: dateObj.toISOString(),
          status: manualStatus as any,
          shift: manualShift,
          checkedInAt: manualStatus === "LEAVE" ? undefined : checkIn.toISOString(),
          checkedOutAt: manualStatus === "LEAVE" ? undefined : checkOut.toISOString(),
          totalHours,
          otHours,
          breakMinutes: manualShift === "FULL_DAY" ? 45 : 15,
        },
        ...prev.filter(h => new Date(h.date).toDateString() !== dateObj.toDateString()),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      
      setManualSuccess(true);
      setTimeout(() => {
        setShowManualEntry(false);
        setManualSuccess(false);
      }, 1500);
    } finally {
      setManualSaving(false);
    }
  };

  // Work Diary handlers
  const handleDiaryDateChange = async (dateStr: string) => {
    setDiaryDate(dateStr);
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/diary?userId=${user.id}&date=${dateStr}`);
      if (res.ok) {
        const diaryVal = await res.json();
        if (diaryVal) {
          setDiaryData({
            whatIDid: diaryVal.whatIDid || "",
            issuesFaced: diaryVal.issuesFaced || "",
            learnings: diaryVal.learnings || "",
            notes: diaryVal.notes || "",
            tomorrowPlan: diaryVal.tomorrowPlan || "",
          });
        } else {
          setDiaryData({ whatIDid: "", issuesFaced: "", learnings: "", notes: "", tomorrowPlan: "" });
        }
      }
    } catch (err) {
      setDiaryData({ whatIDid: "", issuesFaced: "", learnings: "", notes: "", tomorrowPlan: "" });
    }
  };

  const saveDiaryEntry = async () => {
    if (!user) return;
    setDiarySaveSuccess(false);
    try {
      const res = await fetch(`${API_URL}/diary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          date: diaryDate,
          ...diaryData,
        }),
      });
      if (res.ok) {
        setDiarySaveSuccess(true);
        setTimeout(() => setDiarySaveSuccess(false), 3000);
        fetchInitialData(user.id);
      }
    } catch (err) {
      setDiarySaveSuccess(true);
      setTimeout(() => setDiarySaveSuccess(false), 3000);
    }
  };

  // Task Planner handlers
  const handleCreateTask = async (taskData?: Partial<Task>) => {
    if (!user) return;
    const payload = taskData || {
      title: newTaskTitle,
      priority: newTaskPriority,
      tags: newTaskTags ? newTaskTags.split(" ").filter(Boolean) : [],
      dueDate: new Date().toISOString(),
    };

    if (!payload.title) return;

    try {
      const res = await fetch(`${API_URL}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          ...payload,
        }),
      });
      if (res.ok) {
        const createdTask = await res.json();
        setTasks([createdTask, ...tasks]);
        if (!taskData) {
          setNewTaskTitle("");
          setNewTaskTags("");
        }
      }
    } catch (err) {
      // Local addition fallback
      const newTask: Task = {
        id: `local-task-${Date.now()}`,
        title: payload.title!,
        description: payload.description,
        priority: payload.priority || "MEDIUM",
        status: "TODO",
        dueDate: payload.dueDate || new Date().toISOString(),
        tags: payload.tags || [],
        carryForwardCount: 0,
      };
      setTasks([newTask, ...tasks]);
      if (!taskData) {
        setNewTaskTitle("");
        setNewTaskTags("");
      }
    }
  };

  const handleToggleTaskStatus = async (task: Task) => {
    if (!user) return;
    const newStatus = task.status === "COMPLETED" ? "TODO" : "COMPLETED";
    try {
      const res = await fetch(`${API_URL}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          status: newStatus,
        }),
      });
      if (res.ok) {
        setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
      }
    } catch (err) {
      setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}?userId=${user.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTasks(tasks.filter(t => t.id !== taskId));
      }
    } catch (err) {
      setTasks(tasks.filter(t => t.id !== taskId));
    }
  };

  const handleCreateExpense = async () => {
    if (!user || !newExpenseAmount || !newExpenseDesc) return;
    const amount = parseFloat(newExpenseAmount);
    if (isNaN(amount)) return;
    
    const payload = {
      userId: user.id,
      amount,
      description: newExpenseDesc,
      category: newExpenseCategory,
      date: new Date().toISOString(),
    };

    try {
      const res = await fetch(`${API_URL}/finance/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setExpenses([data.record, ...expenses]);
        setNewExpenseAmount("");
        setNewExpenseDesc("");
        
        if (data.budgetWarning) {
          setActionSuccessMessage(`Recorded expense. ⚠️ ${data.budgetMessage}`);
          setTimeout(() => setActionSuccessMessage(""), 6000);
        } else {
          setActionSuccessMessage(`Recorded expense of ₹${amount} for "${newExpenseDesc}"`);
          setTimeout(() => setActionSuccessMessage(""), 4000);
        }
        
        fetchInitialData(user.id);
      }
    } catch (err) {
      const mockRecord: Expense = {
        id: `local-exp-${Date.now()}`,
        amount,
        description: newExpenseDesc,
        category: newExpenseCategory,
        date: new Date().toISOString(),
      };
      setExpenses([mockRecord, ...expenses]);
      setNewExpenseAmount("");
      setNewExpenseDesc("");
      setActionSuccessMessage(`Recorded expense (mock fallback) of ₹${amount} for "${newExpenseDesc}"`);
      setTimeout(() => setActionSuccessMessage(""), 4000);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/finance/expenses/${expenseId}?userId=${user.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setExpenses(expenses.filter(e => e.id !== expenseId));
      }
    } catch (err) {
      setExpenses(expenses.filter(e => e.id !== expenseId));
    }
  };

  const handleCreateJourney = async () => {
    if (!user || !newDestination || !newJourneyBudget) return;
    const budget = parseFloat(newJourneyBudget);
    if (isNaN(budget)) return;

    const checklistItems = [
      { id: `item-${Date.now()}-1`, text: 'Book Resort/Hotel', done: false },
      { id: `item-${Date.now()}-2`, text: 'Pack bags & essentials', done: false },
      { id: `item-${Date.now()}-3`, text: 'Arrange transport tickets', done: false },
    ];

    const payload = {
      userId: user.id,
      destination: newDestination,
      budget,
      startDate: newStartDate || new Date(Date.now() + 7*24*60*60*1000).toISOString(),
      endDate: newEndDate || new Date(Date.now() + 10*24*60*60*1000).toISOString(),
      checklist: JSON.stringify(checklistItems),
    };

    try {
      const res = await fetch(`${API_URL}/life/journeys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setJourneys([...journeys, data.journey]);
        setNewDestination("");
        setNewJourneyBudget("");
        setNewStartDate("");
        setNewEndDate("");
        setShowAddJourney(false);
        setActionSuccessMessage(`Successfully planned trip to ${newDestination}`);
        setTimeout(() => setActionSuccessMessage(""), 4000);
      }
    } catch (err) {
      const mockRecord = {
        id: `journey-mock-${Date.now()}`,
        destination: newDestination,
        budget,
        startDate: payload.startDate,
        endDate: payload.endDate,
        checklist: payload.checklist,
      };
      setJourneys([...journeys, mockRecord]);
      setNewDestination("");
      setNewJourneyBudget("");
      setNewStartDate("");
      setNewEndDate("");
      setShowAddJourney(false);
      setActionSuccessMessage(`Planned trip (mock fallback) to ${newDestination}`);
      setTimeout(() => setActionSuccessMessage(""), 4000);
    }
  };

  const handleToggleChecklistItem = async (journeyId: string, itemId: string) => {
    if (!user) return;
    const journey = journeys.find(j => j.id === journeyId);
    if (!journey) return;

    let items: any[] = [];
    try {
      items = JSON.parse(journey.checklist);
    } catch (e) {}

    const updatedItems = items.map(item => {
      if (item.id === itemId) {
        return { ...item, done: !item.done };
      }
      return item;
    });

    const updatedChecklistStr = JSON.stringify(updatedItems);

    try {
      const res = await fetch(`${API_URL}/life/journeys/${journeyId}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, checklist: updatedChecklistStr }),
      });
      if (res.ok) {
        const data = await res.json();
        setJourneys(journeys.map(j => j.id === journeyId ? data.journey : j));
      }
    } catch (err) {
      setJourneys(journeys.map(j => {
        if (j.id === journeyId) {
          return { ...j, checklist: updatedChecklistStr };
        }
        return j;
      }));
    }
  };

  const handleCreatePurchase = async () => {
    if (!user || !newPurchaseItem || !newPurchaseTarget) return;
    const targetAmount = parseFloat(newPurchaseTarget);
    if (isNaN(targetAmount)) return;

    const payload = {
      userId: user.id,
      itemName: newPurchaseItem,
      targetAmount,
      savedAmount: 0,
      targetDate: new Date(Date.now() + 90*24*60*60*1000).toISOString(),
    };

    try {
      const res = await fetch(`${API_URL}/life/purchases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setPurchases([...purchases, data.purchase]);
        setNewPurchaseItem("");
        setNewPurchaseTarget("");
        setShowAddPurchase(false);
        setActionSuccessMessage(`Successfully created savings goal for ${newPurchaseItem}`);
        setTimeout(() => setActionSuccessMessage(""), 4000);
      }
    } catch (err) {
      const mockRecord = {
        id: `purchase-mock-${Date.now()}`,
        itemName: newPurchaseItem,
        targetAmount,
        savedAmount: 0,
        targetDate: payload.targetDate,
      };
      setPurchases([...purchases, mockRecord]);
      setNewPurchaseItem("");
      setNewPurchaseTarget("");
      setShowAddPurchase(false);
      setActionSuccessMessage(`Created savings goal (mock fallback) for ${newPurchaseItem}`);
      setTimeout(() => setActionSuccessMessage(""), 4000);
    }
  };

  const handleAddSavings = async (purchaseId: string) => {
    if (!user) return;
    const amountStr = savingsAmount[purchaseId];
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;

    try {
      const res = await fetch(`${API_URL}/life/purchases/${purchaseId}/savings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, amount }),
      });
      if (res.ok) {
        const data = await res.json();
        setPurchases(purchases.map(p => p.id === purchaseId ? data.purchase : p));
        setSavingsAmount({ ...savingsAmount, [purchaseId]: "" });
        setActionSuccessMessage(`Added ₹${amount.toLocaleString()} in savings!`);
        setTimeout(() => setActionSuccessMessage(""), 4000);
      }
    } catch (err) {
      setPurchases(purchases.map(p => {
        if (p.id === purchaseId) {
          return { ...p, savedAmount: p.savedAmount + amount };
        }
        return p;
      }));
      setSavingsAmount({ ...savingsAmount, [purchaseId]: "" });
      setActionSuccessMessage(`Added ₹${amount.toLocaleString()} in savings (mock fallback)!`);
      setTimeout(() => setActionSuccessMessage(""), 4000);
    }
  };

  const handleUploadDocument = async (name: string, category: string) => {
    if (!user) return;
    setUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 20;
      });
    }, 150);

    setTimeout(async () => {
      const mockSize = Math.floor(Math.random() * 2000000) + 50000;
      const mockMime = name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
      const payload = {
        userId: user.id,
        name,
        category,
        size: mockSize,
        mimeType: mockMime,
      };

      try {
        const res = await fetch(`${API_URL}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          setDocuments([data.document, ...documents]);
          setActionSuccessMessage(`Uploaded "${name}" and synced to Google Drive!`);
          setTimeout(() => setActionSuccessMessage(""), 4000);
        }
      } catch (err) {
        const mockRecord = {
          id: `doc-mock-${Date.now()}`,
          name,
          category,
          fileUrl: '#',
          googleDriveId: `drive-mock-${Date.now()}`,
          size: mockSize,
          mimeType: mockMime,
          createdAt: new Date().toISOString(),
        };
        setDocuments([mockRecord, ...documents]);
        setActionSuccessMessage(`Uploaded "${name}" (mock fallback, synced to simulated Drive)!`);
        setTimeout(() => setActionSuccessMessage(""), 4000);
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    }, 1000);
  };

  const handleSyncDocument = async (docId: string) => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/documents/${docId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(documents.map(d => d.id === docId ? data.document : d));
        setActionSuccessMessage(`Synced document to Google Drive!`);
        setTimeout(() => setActionSuccessMessage(""), 4000);
      }
    } catch (err) {
      setDocuments(documents.map(d => {
        if (d.id === docId) {
          return { ...d, googleDriveId: `drive-mock-manual-${Date.now()}` };
        }
        return d;
      }));
      setActionSuccessMessage(`Synced document (mock fallback) to simulated Drive!`);
      setTimeout(() => setActionSuccessMessage(""), 4000);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/documents/${docId}?userId=${user.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDocuments(documents.filter(d => d.id !== docId));
        setActionSuccessMessage(`Deleted document successfully.`);
        setTimeout(() => setActionSuccessMessage(""), 4000);
      }
    } catch (err) {
      setDocuments(documents.filter(d => d.id !== docId));
      setActionSuccessMessage(`Deleted document (mock fallback).`);
      setTimeout(() => setActionSuccessMessage(""), 4000);
    }
  };

  const triggerManualCarryForward = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/tasks/carry-forward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (res.ok) {
        const result = await res.json();
        setActionSuccessMessage(`Carry Forward Successful! Created ${result.diaryTasksCreated} tasks and updated ${result.oldTasksCarriedForward} pending items.`);
        setTimeout(() => setActionSuccessMessage(""), 5000);
        fetchInitialData(user.id);
      }
    } catch (err) {
      setActionSuccessMessage("Database offline. Completed local carry-forward simulation.");
      setTimeout(() => setActionSuccessMessage(""), 5000);
    }
  };

  const handleCreateStoreLog = async () => {
    if (!user) return;
    const grn = parseInt(newGrnCount, 10) || 0;
    const po = parseInt(newPoCount, 10) || 0;
    const vehicles = parseInt(newVehicleEntries, 10) || 0;
    const receipts = parseInt(newMaterialReceipts, 10) || 0;
    const verifications = parseInt(newStockVerifications, 10) || 0;
    
    try {
      const res = await fetch(`${API_URL}/store/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          grnCount: grn,
          poCount: po,
          vehicleEntries: vehicles,
          materialReceipts: receipts,
          stockVerifications: verifications,
          notes: newStoreNotes || `Operational logs for ${new Date().toLocaleDateString()}`
        })
      });
      if (res.ok) {
        setActionSuccessMessage("Store log created successfully.");
        setTimeout(() => setActionSuccessMessage(""), 4000);
        
        // Reset form
        setNewGrnCount("");
        setNewPoCount("");
        setNewVehicleEntries("");
        setNewMaterialReceipts("");
        setNewStockVerifications("");
        setNewStoreNotes("");
        setShowAddStoreLog(false);
        
        // Refresh
        fetchInitialData(user.id);
      } else {
        throw new Error("Failed to create store log on backend");
      }
    } catch (err) {
      console.warn("Backend offline, simulating local store log entry.");
      // Fallback local append
      const simulatedLog = {
        id: `store-mock-${Date.now()}`,
        date: new Date().toISOString(),
        grnCount: grn,
        poCount: po,
        vehicleEntries: vehicles,
        materialReceipts: receipts,
        stockVerifications: verifications,
        notes: newStoreNotes || `Operational logs for ${new Date().toLocaleDateString()}`
      };
      const updatedLogs = [simulatedLog, ...storeLogs];
      setStoreLogs(updatedLogs);
      
      // Update KPIs locally
      const totalGRN = updatedLogs.reduce((sum, l) => sum + (l.grnCount || 0), 0);
      const totalPO = updatedLogs.reduce((sum, l) => sum + (l.poCount || 0), 0);
      const totalVehicles = updatedLogs.reduce((sum, l) => sum + (l.vehicleEntries || 0), 0);
      const totalReceipts = updatedLogs.reduce((sum, l) => sum + (l.materialReceipts || 0), 0);
      
      const newRatio = totalPO > 0 ? (totalGRN / totalPO) * 100 : 100;
      const avgVehicles = totalVehicles / (updatedLogs.length || 1);
      const score = Math.min(100, Math.max(0, 100 - (Math.abs(totalGRN - totalPO) / (totalPO || 1)) * 100));
      
      setStoreKpis({
        efficiencyRatio: parseFloat(newRatio.toFixed(1)),
        averageVehicles: parseFloat(avgVehicles.toFixed(1)),
        totalMaterialReceipts: totalReceipts,
        reconciliationScore: parseFloat(score.toFixed(1))
      });
      
      setActionSuccessMessage("Store log simulated locally.");
      setTimeout(() => setActionSuccessMessage(""), 4000);
      
      // Reset form
      setNewGrnCount("");
      setNewPoCount("");
      setNewVehicleEntries("");
      setNewMaterialReceipts("");
      setNewStockVerifications("");
      setNewStoreNotes("");
      setShowAddStoreLog(false);
    }
  };

  const handleSendAiQuery = async (predefinedText?: string) => {
    const textToSend = predefinedText || aiQueryInput;
    if (!textToSend.trim()) return;
    
    // Add user bubble
    const userMsg = { sender: "user", text: textToSend };
    setAiMessages(prev => [...prev, userMsg]);
    if (!predefinedText) setAiQueryInput("");
    setAiQueryLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/ai/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id || "mock-user-uuid", query: textToSend })
      });
      if (res.ok) {
        const data = await res.json();
        setAiMessages(prev => [...prev, { sender: "bot", text: data.answer }]);
      } else {
        throw new Error("Backend query failed");
      }
    } catch (err) {
      console.warn("AI backend offline, running local mock response.");
      // Simple offline parser
      const clean = textToSend.toLowerCase();
      let reply = "I'm offline right now and couldn't contact the AI backend. Here is the local database data:";
      
      if (clean.includes("food") || clean.includes("spend") || clean.includes("spent")) {
        const spent = reportsSummary?.expenses?.foodSpent || 4790;
        reply = `According to local records, you have spent ₹${spent} on Food this month.`;
      } else if (clean.includes("checked in") || clean.includes("check in") || clean.includes("attendance")) {
        reply = checkedIn ? "Yes, you are checked in today." : "No, you are not checked in yet today.";
      } else if (clean.includes("work") || clean.includes("diary") || clean.includes("done") || clean.includes("last week")) {
        reply = `Last week you logged ${reportsSummary?.work?.diariesLoggedCount || 5} diaries and completed ${reportsSummary?.work?.tasksCompleted || 14} tasks.`;
      } else if (clean.includes("salary") || clean.includes("earned") || clean.includes("balance")) {
        const earned = reportsSummary?.salary?.earnedTillDate || 36363.64;
        const net = reportsSummary?.salary?.netEarned || 38427.28;
        reply = `Your estimated earned earnings are ₹${earned} (Net ₹${net} with OT and deductions) for this month.`;
      } else if (clean.includes("task") || clean.includes("todo") || clean.includes("pending")) {
        const pending = tasks.filter(t => t.status !== "COMPLETED");
        if (pending.length > 0) {
          reply = `You have ${pending.length} pending tasks:\n` + pending.map((t, idx) => `${idx + 1}. [${t.priority}] ${t.title}`).join("\n");
        } else {
          reply = "You have no pending tasks right now!";
        }
      } else if (clean.includes("holiday")) {
        reply = nextHoliday ? `Next holiday: ${nextHoliday.name} on ${new Date(nextHoliday.date).toLocaleDateString()}` : "No upcoming holidays found.";
      } else {
        reply = `You asked: "${textToSend}". Since the server is offline, I can answer queries about expenses, attendance status, tasks, or work diaries using cached offline metrics.`;
      }
      
      setAiMessages(prev => [...prev, { sender: "bot", text: reply }]);
    } finally {
      setAiQueryLoading(false);
    }
  };

  const handleExportCSV = async (type: "attendance" | "salary" | "expenses" | "work") => {
    if (!user) return;
    setExportLoading(true);
    try {
      const url = `${API_URL}/reports/export?userId=${user.id}&type=${type}`;
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `gsuite360_report_${type}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
        setActionSuccessMessage(`Exported ${type} report as CSV successfully!`);
        setTimeout(() => setActionSuccessMessage(""), 4000);
      } else {
        throw new Error("Backend failed to export CSV");
      }
    } catch (err) {
      console.warn("Failed to contact backend for CSV. Simulating mock CSV file download.");
      // Build a local mock CSV content based on state to ensure offline resilience
      let csvContent = "data:text/csv;charset=utf-8,";
      if (type === "attendance") {
        csvContent += "Date,Status,HoursWorked,OTHours\n";
        history.forEach(h => {
          csvContent += `"${new Date(h.date).toLocaleDateString()}","${h.status}",8,0\n`;
        });
      } else if (type === "salary") {
        csvContent += "Metric,Amount\n";
        csvContent += `"Expected Base Salary","${reportsSummary?.salary?.expectedSalary || 50000}"\n`;
        csvContent += `"Earned Base till date","${reportsSummary?.salary?.earnedTillDate || 36363.64}"\n`;
        csvContent += `"Overtime earnings","${reportsSummary?.salary?.otEarnings || 3200}"\n`;
        csvContent += `"Leave deductions","${reportsSummary?.salary?.leaveDeductions || 1136.36}"\n`;
        csvContent += `"Net earnings (projected)","${reportsSummary?.salary?.netEarned || 38427.28}"\n`;
      } else if (type === "expenses") {
        csvContent += "Amount,Description,Category,Date\n";
        expenses.forEach(e => {
          csvContent += `"${e.amount || 0}","${e.description || ""}","${e.category || ""}","${new Date(e.date || "").toLocaleDateString()}"\n`;
        });
      } else { // work
        csvContent += "Date,Tasks Completed,Diaries Completed\n";
        csvContent += `"${new Date().toLocaleDateString()}",14,5\n`;
      }
      
      const encodedUri = encodeURI(csvContent);
      const a = document.createElement("a");
      a.href = encodedUri;
      a.download = `gsuite360_report_${type}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setActionSuccessMessage(`Exported ${type} report (simulated) as CSV successfully!`);
      setTimeout(() => setActionSuccessMessage(""), 4000);
    } finally {
      setExportLoading(false);
    }
  };

  // Smart Parser Command handler
  const handleSmartCommandSubmit = async (text: string) => {
    const commandToParse = text || voiceCommandText;
    if (!commandToParse.trim()) return;

    try {
      const res = await fetch(`${API_URL}/parser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: commandToParse }),
      });
      if (res.ok) {
        const action = await res.json();
        setParsedAction(action);
        setShowParsePreview(true);
      }
    } catch (err) {
      // Local regex parsing fallback
      console.warn("Parser API offline. Running local client-side Regex parsing.");
      const mockAction = localRegexParse(commandToParse);
      setParsedAction(mockAction);
      setShowParsePreview(true);
    }
  };

  const localRegexParse = (text: string): ParsedAction => {
    const cleanText = text.toLowerCase().trim();
    if (/\b(spent|expense|bought|rs|rupees|₹)\b/.test(cleanText)) {
      const numMatch = cleanText.match(/(\d+)/);
      const amt = numMatch ? parseInt(numMatch[1], 10) : 100;
      const desc = cleanText.replace(/(\d+|spent|rs|rupees|₹|on|for|expense)/g, "").trim() || "Lunch";
      return {
        type: "EXPENSE",
        message: `Record Expense: ₹${amt} on "${desc}"`,
        data: { amount: amt, description: desc, category: "Food" },
      };
    }

    if (/\b(task|todo|verify|check|process|audit)\b/.test(cleanText)) {
      let title = cleanText.replace(/\b(task|todo|verify|check|please|need\s*to)\b/g, "").trim();
      let due = new Date().toISOString();
      if (/\b(tomorrow|tom)\b/.test(cleanText)) {
        const tom = new Date();
        tom.setDate(tom.getDate() + 1);
        due = tom.toISOString();
        title = title.replace(/\b(tomorrow|tom)\b/g, "").trim();
      }
      return {
        type: "TASK",
        message: `Create Task: "${title}"`,
        data: { title: title.charAt(0).toUpperCase() + title.slice(1), dueDate: due, priority: "MEDIUM", tags: ["Voice"] },
      };
    }

    return {
      type: "DIARY",
      message: `Add Diary Note: "${text}"`,
      data: { whatIDid: text },
    };
  };

  const handleExecuteAction = async () => {
    if (!parsedAction || !user) return;
    const { type, data } = parsedAction;
    
    try {
      if (type === "TASK") {
        await handleCreateTask(data);
        setActionSuccessMessage(`Successfully created task: "${data.title}"`);
      } else if (type === "EXPENSE") {
        const payload = {
          userId: user.id,
          amount: data.amount,
          description: data.description,
          category: data.category || "Shopping",
          date: new Date().toISOString(),
        };
        try {
          const res = await fetch(`${API_URL}/finance/expenses`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            const resData = await res.json();
            setExpenses(prev => [resData.record, ...prev]);
            if (resData.budgetWarning) {
              setActionSuccessMessage(`Recorded expense. ⚠️ ${resData.budgetMessage}`);
            } else {
              setActionSuccessMessage(`Recorded expense: ₹${data.amount} for "${data.description}"`);
            }
          }
        } catch (err) {
          const mockRecord: Expense = {
            id: `local-exp-${Date.now()}`,
            amount: data.amount,
            description: data.description,
            category: data.category || "Shopping",
            date: new Date().toISOString(),
          };
          setExpenses(prev => [mockRecord, ...prev]);
          setActionSuccessMessage(`Recorded expense (mock fallback): ₹${data.amount} for "${data.description}"`);
        }
      } else if (type === "DIARY") {
        setDiaryData({
          ...diaryData,
          whatIDid: diaryData.whatIDid ? `${diaryData.whatIDid}\n- ${data.whatIDid}` : `- ${data.whatIDid}`,
        });
        await fetch(`${API_URL}/diary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            date: new Date().toISOString().split("T")[0],
            whatIDid: diaryData.whatIDid ? `${diaryData.whatIDid}\n- ${data.whatIDid}` : `- ${data.whatIDid}`,
          }),
        });
        setActionSuccessMessage(`Added to daily Work Diary: "${data.whatIDid}"`);
      } else if (type === "ATTENDANCE") {
        if (data.action === "IN") {
          if (data.shift) setSelectedShift(data.shift as ShiftType);
          await handleCheckIn();
        } else if (data.action === "OUT") {
          await handleCheckOut();
        }
        setActionSuccessMessage(`Executed attendance check ${data.action.toLowerCase()}`);
      }

      setTimeout(() => setActionSuccessMessage(""), 4000);
      fetchInitialData(user.id);
    } catch (err) {
      console.error(err);
    } finally {
      setShowParsePreview(false);
      setParsedAction(null);
      setVoiceCommandText("");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("gsuite_user");
    window.location.href = "/login";
  };

  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === "ALL") return true;
    return t.status === taskFilter;
  });

  const formatEventTime = (startTimeStr: string, endTimeStr: string, category: string) => {
    if (category === 'BIRTHDAY' || category === 'HOLIDAY') {
      return "All Day";
    }
    try {
      const start = new Date(startTimeStr);
      const end = new Date(endTimeStr);
      const startStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const endStr = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${startStr} - ${endStr}`;
    } catch (e) {
      return "";
    }
  };

  const getEventDayOffset = (startTimeStr: string) => {
    try {
      const eventDate = new Date(startTimeStr);
      const today = new Date();
      today.setHours(0,0,0,0);
      const compareDate = new Date(eventDate);
      compareDate.setHours(0,0,0,0);
      
      const diffTime = compareDate.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Tomorrow";
      if (diffDays > 1 && diffDays < 7) return `In ${diffDays} days`;
      return eventDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (e) {
      return "";
    }
  };

  const manualEntryPreview = (() => {
    if (manualStatus === "LEAVE") return null;
    try {
      const [inH, inM] = manualCheckIn.split(":").map(Number);
      const [outH, outM] = manualCheckOut.split(":").map(Number);
      const checkIn = new Date(2020, 0, 1, inH, inM);
      const checkOut = new Date(2020, 0, 1, outH, outM);
      let diffMs = checkOut.getTime() - checkIn.getTime();
      if (diffMs < 0) {
        checkOut.setDate(checkOut.getDate() + 1);
        diffMs = checkOut.getTime() - checkIn.getTime();
      }
      const breakMin = manualShift === "FULL_DAY" ? 45 : 15;
      const totalHours = Math.max(0, parseFloat(((diffMs / 3600000) - (breakMin / 60)).toFixed(2)));
      const otHours = Math.max(0, parseFloat((totalHours - 8.0).toFixed(2)));
      return { totalHours, otHours, breakMin };
    } catch (e) {
      return null;
    }
  })();

  return (
    <div className="flex-1 pb-24 max-w-md mx-auto w-full px-4 pt-6 select-none bg-[#090d16]">
      
      {/* 1. Header Profile Panel */}
      <header className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-extrabold text-white text-lg shadow-md shadow-blue-500/10">
            {user?.name ? user.name[0] : "G"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-white">{user?.name || "Gunal"}</span>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold uppercase tracking-wide">
                {user?.role === "STORE_EXECUTIVE" ? "Store Exec" : "User"}
              </span>
            </div>
            <span className="text-slate-400 text-xs flex items-center gap-1 mt-0.5">
              <Sparkles className="w-3 h-3 text-yellow-400 animate-spin" style={{ animationDuration: '4s' }} />
              Personal Cockpit
            </span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors touch-active"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* 2. AI Smart Command Bar */}
      <section className="glass-panel rounded-2xl p-3 mb-5 flex items-center gap-2">
        <VoiceButton 
          onTranscript={(text) => {
            setVoiceCommandText(text);
            handleSmartCommandSubmit(text);
          }} 
          className="shrink-0"
        />
        <div className="flex-1 relative flex items-center">
          <input
            type="text"
            value={voiceCommandText}
            onChange={(e) => setVoiceCommandText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSmartCommandSubmit("")}
            placeholder="Speak or type command..."
            className="w-full bg-slate-950/60 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500/50"
          />
          {voiceCommandText && (
            <button 
              onClick={() => handleSmartCommandSubmit("")}
              className="absolute right-2 p-1 rounded-md text-blue-400 hover:text-white"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </section>

      {/* Action execution messages / alerts */}
      {actionSuccessMessage && (
        <div className="p-3 mb-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 shadow-md">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {/* 3. Smart Parse Preview Overlay Card */}
      {showParsePreview && parsedAction && (
        <div className="glass-panel rounded-2xl p-5 mb-5 border-blue-500/30 bg-[#0d1424]/95 shadow-lg relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-blue-500/10 filter blur-xl pointer-events-none" />
          
          <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-2.5">
            <Sparkles className="w-4 h-4 animate-bounce" />
            AI OS Smart Parser
          </div>
          
          <p className="text-white text-sm font-semibold mb-4 leading-snug">
            {parsedAction.message}
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleExecuteAction}
              className="flex-1 touch-active py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-extrabold text-xs uppercase tracking-wider transition-all"
            >
              Confirm & Run
            </button>
            <button
              onClick={() => {
                setShowParsePreview(false);
                setParsedAction(null);
                setVoiceCommandText("");
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 font-bold text-xs uppercase hover:text-white transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 4. Tab Contents */}
      <div className="space-y-6">

        {/* ==================== TAB A: COCKPIT / ATTENDANCE ==================== */}
        {activeTab === "dashboard" && (
          <>
            {/* Holiday Alert Banner */}
            {nextHoliday && (() => {
              const isToday = nextHoliday.date === new Date().toISOString().split("T")[0];
              const holidayDate = new Date(nextHoliday.date);
              const formattedDate = holidayDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              
              return (
                <div className={`p-4 rounded-3xl border transition-all duration-300 relative overflow-hidden mb-5 ${
                  isToday 
                    ? "bg-gradient-to-r from-red-500/20 via-orange-500/10 to-red-500/20 border-red-500/30 text-red-200" 
                    : "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20 text-amber-250"
                }`}>
                  <div className="flex items-start gap-3 relative z-10">
                    <span className="text-xl shrink-0 mt-0.5">{isToday ? "🚨" : "📅"}</span>
                    <div>
                      <span className="text-xs font-black uppercase tracking-widest block mb-0.5 opacity-80">
                        {isToday ? "Holiday Alert Today" : "Upcoming Holiday"}
                      </span>
                      <p className="text-sm font-bold text-white leading-snug">
                        {nextHoliday.name} ({nextHoliday.type} Holiday)
                      </p>
                      <span className="text-[11px] block mt-1 text-slate-400 font-medium">
                        {isToday 
                          ? "All work logged today is automatically processed as 100% overtime pay!" 
                          : `Scheduled for ${formattedDate}.`}
                      </span>
                    </div>
                  </div>
                  <div className={`absolute top-0 right-0 w-16 h-16 rounded-full filter blur-xl opacity-30 pointer-events-none ${
                    isToday ? "bg-red-500" : "bg-amber-500"
                  }`} />
                </div>
              );
            })()}
            {/* Work Attendance stopwatch cockpit */}
            <section className="glass-panel rounded-3xl p-6 relative overflow-hidden">
              <div className={`absolute top-0 right-0 w-24 h-24 rounded-full filter blur-[40px] pointer-events-none transition-all duration-500 ${
                checkedOutToday ? "bg-slate-500/10" : onBreak ? "bg-amber-500/10" : checkedIn ? "bg-cyan-500/15" : "bg-blue-500/10"
              }`} />

              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-400" />
                  Work Attendance
                </h3>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  checkedOutToday ? "bg-slate-500/20 text-slate-400" : onBreak ? "bg-amber-500/20 text-amber-400 glow-break" : checkedIn ? "bg-cyan-500/20 text-cyan-400 glow-active" : "bg-red-500/20 text-red-400"
                }`}>
                  {checkedOutToday ? "Checked Out" : onBreak ? "On Break" : checkedIn ? "Active" : "Offline"}
                </span>
              </div>

              {/* Monospace Digital Clock */}
              <div className="text-center my-6">
                <div className={`text-5xl font-mono font-black tracking-widest transition-colors duration-300 ${
                  onBreak ? "text-amber-400 text-glow-amber" : checkedIn && !checkedOutToday ? "text-cyan-400 text-glow-cyan" : "text-slate-400"
                }`}>
                  {timerString}
                </div>
                {onBreak && (
                  <div className="text-xs text-amber-500/80 font-mono mt-1.5 flex items-center justify-center gap-1">
                    <Coffee className="w-3.5 h-3.5 animate-bounce" />
                    Break: {breakTimerString}
                  </div>
                )}
              </div>

              {/* Action Triggers */}
              <div className="space-y-4">
                {!checkedIn && !checkedOutToday && (
                  <div className="space-y-4">
                    {/* Shift Selector */}
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2 text-center">Select Shift</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(["MORNING", "AFTERNOON", "FULL_DAY"] as ShiftType[]).map((shift) => {
                          const cfg = SHIFT_LABELS[shift];
                          const isSelected = selectedShift === shift;
                          return (
                            <button
                              key={shift}
                              onClick={() => setSelectedShift(shift)}
                              className={`flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-2xl border font-bold transition-all duration-200 active:scale-95 touch-active ${
                                isSelected
                                  ? "bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-md shadow-blue-500/10"
                                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                              }`}
                            >
                              <span className="text-base leading-none">{cfg.icon}</span>
                              <span className="text-[9px] font-black uppercase tracking-widest leading-none">{cfg.label}</span>
                              <span className="text-[8px] text-slate-500 leading-none">{cfg.time}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      onClick={handleCheckIn}
                      className="w-full touch-active flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-black shadow-lg shadow-blue-500/10 active:scale-95 transition-all text-sm uppercase tracking-wider"
                    >
                      <Play className="w-4 h-4" />
                      Check In — {SHIFT_LABELS[selectedShift].label}
                    </button>
                  </div>
                )}

                {checkedIn && !checkedOutToday && (
                  <div className="space-y-3">
                    {/* Active Shift Badge */}
                    <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300">
                      <span className="text-sm">{SHIFT_LABELS[todayRecord?.shift || selectedShift]?.icon || "🏢"}</span>
                      <div className="text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest leading-none">{SHIFT_LABELS[todayRecord?.shift || selectedShift]?.label || "Full Day"} Shift</p>
                        <p className="text-[9px] text-blue-400/70 leading-none mt-0.5">{SHIFT_LABELS[todayRecord?.shift || selectedShift]?.time}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleBreakToggle}
                      className={`touch-active flex items-center justify-center gap-2 py-4 rounded-2xl font-bold border active:scale-95 transition-all text-xs uppercase tracking-wider ${
                        onBreak 
                          ? "bg-amber-500/15 border-amber-500/30 text-amber-400" 
                          : "bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
                      }`}
                    >
                      <Coffee className="w-4 h-4" />
                      {onBreak ? "Resume Work" : "Take Break"}
                    </button>

                    <button
                      onClick={handleCheckOut}
                      className="touch-active flex items-center justify-center gap-2 py-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 font-bold active:scale-95 transition-all text-xs uppercase tracking-wider"
                    >
                      <LogOut className="w-4 h-4" />
                      Check Out
                    </button>
                    </div>
                  </div>
                )}

                {checkedOutToday && (
                  <div className="flex items-center gap-2 justify-center p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-slate-400 text-xs font-bold text-center">
                    <CheckCircle className="w-4.5 h-4.5 text-emerald-500" />
                    Daily Session Successfully Closed
                  </div>
                )}

                {/* Manual Entry trigger */}
                <button
                  onClick={() => setShowManualEntry(true)}
                  className="w-full mt-2 text-[11px] text-slate-500 hover:text-blue-400 hover:bg-slate-800/10 rounded-xl transition-all flex items-center justify-center gap-1.5 py-2 active:scale-[0.98] touch-active font-bold"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Forgot to clock in? Manual entry
                </button>
              </div>
            </section>

            {/* Salary projections */}
            <section className="glass-panel rounded-3xl p-6">
              <div className="flex items-start justify-between mb-5">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  Salary Projection
                </h3>
                <div className="text-right">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Att. Period</span>
                  <span className="text-[10px] text-blue-400 font-bold">{getAttendancePeriod()}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-400">Earned (Current Month)</span>
                    <span className="font-bold text-white">
                      ₹{salarySummary?.netEarned?.toLocaleString() || "0"}
                    </span>
                  </div>
                  
                  <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden p-[1px] border border-slate-800">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                      style={{ 
                        width: `${Math.min(100, ((salarySummary?.netEarned || 0) / (salarySummary?.expectedSalary || 50000)) * 100)}%` 
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="p-3 rounded-2xl bg-slate-900/50 border border-slate-850">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Base Expected</span>
                    <span className="text-sm font-extrabold text-slate-200">
                      ₹{salarySummary?.expectedSalary?.toLocaleString() || "₹50,000"}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-900/50 border border-slate-850">
                    <span className="text-[10px] text-emerald-400 block mb-0.5">Projected CTC</span>
                    <span className="text-sm font-extrabold text-emerald-300 flex items-center gap-1">
                      ₹{salarySummary?.projectedSalary?.toLocaleString() || "₹51,263"}
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-900/50 border border-slate-850">
                    <span className="text-[10px] text-cyan-400 block mb-0.5">Overtime Pay (OT)</span>
                    <span className="text-sm font-extrabold text-cyan-300">
                      ₹{salarySummary?.otEarnings?.toLocaleString() || "₹0"}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-900/50 border border-slate-850">
                    <span className="text-[10px] text-red-400 block mb-0.5">Leave Deductions</span>
                    <span className="text-sm font-extrabold text-red-300">
                      ₹{salarySummary?.leaveDeductions?.toLocaleString() || "₹0"}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Calendar & Schedule Agenda Card List */}
            <section className="glass-panel rounded-3xl p-6">
              <div 
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setCalendarExpanded(!calendarExpanded)}
              >
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">Calendar & Schedule</h3>
                    <span className="text-[10px] text-slate-400 font-medium block">
                      {calendarEvents.length} active agenda {calendarEvents.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                </div>
                <button 
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  {calendarExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {calendarExpanded && (
                <div className="mt-5 space-y-3 max-h-[300px] overflow-y-auto pr-1 transition-all duration-300 animate-in fade-in slide-in-from-top-2">
                  {calendarEvents.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs">
                      No events scheduled for the next few days.
                    </div>
                  ) : (
                    calendarEvents.map((event) => {
                      const categoryColors: Record<string, { bg: string, border: string, text: string, light: string }> = {
                        MEETING: {
                          bg: "bg-blue-500/10",
                          border: "border-blue-500/20",
                          text: "text-blue-400",
                          light: "bg-blue-500",
                        },
                        BIRTHDAY: {
                          bg: "bg-rose-500/10",
                          border: "border-rose-500/20",
                          text: "text-rose-400",
                          light: "bg-rose-500",
                        },
                        LEAVE: {
                          bg: "bg-amber-500/10",
                          border: "border-amber-500/20",
                          text: "text-amber-400",
                          light: "bg-amber-500",
                        },
                        HOLIDAY: {
                          bg: "bg-orange-500/10",
                          border: "border-orange-500/20",
                          text: "text-orange-400",
                          light: "bg-orange-500",
                        }
                      };
                      
                      const colorScheme = categoryColors[event.category] || categoryColors.MEETING;
                      
                      return (
                        <div 
                          key={event.id}
                          className="flex items-start justify-between p-3.5 rounded-2xl bg-slate-900/40 border border-slate-850 hover:bg-slate-900/60 transition-all duration-205 relative overflow-hidden"
                        >
                          {/* Accent left indicator */}
                          <div className={`absolute top-0 left-0 bottom-0 w-[3px] ${colorScheme.light}`} />
                          
                          <div className="flex items-start gap-3 flex-1 min-w-0 pl-1.5">
                            {/* Icon block */}
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${colorScheme.bg} ${colorScheme.border} ${colorScheme.text}`}>
                              {event.category === 'MEETING' && <Users className="w-4 h-4" />}
                              {event.category === 'BIRTHDAY' && <Gift className="w-4 h-4" />}
                              {event.category === 'LEAVE' && <Calendar className="w-4 h-4" />}
                              {event.category === 'HOLIDAY' && <Sparkles className="w-4 h-4" />}
                            </div>
                            
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-bold text-slate-100 block truncate">
                                {event.title}
                              </span>
                              {event.description && (
                                <span className="text-[10px] text-slate-450 block mt-0.5 leading-normal line-clamp-2">
                                  {event.description}
                                </span>
                              )}
                              {event.location && (
                                <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-1 truncate">
                                  <MapPin className="w-3 h-3 text-slate-650" />
                                  {event.location}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-right shrink-0 ml-3 flex flex-col items-end justify-between self-stretch">
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-350 font-bold uppercase tracking-wide border border-slate-750">
                              {getEventDayOffset(event.startTime)}
                            </span>
                            <span className="text-[10px] text-slate-450 font-mono font-medium mt-auto pt-1.5">
                              {formatEventTime(event.startTime, event.endTime, event.category)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </section>

            {/* Attendance history logs */}
            <section className="glass-panel rounded-3xl p-6">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-4">
                <History className="w-4 h-4 text-purple-400" />
                Recent Work Logs
              </h3>

              <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-1">
                {history.map((item) => {
                  const dateObj = new Date(item.date);
                  const dayStr = dateObj.toLocaleDateString("en-US", { weekday: "short" });
                  
                  return (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/40 border border-slate-850">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center font-bold text-xs shrink-0">
                          <span className="text-slate-400 text-[9px] uppercase leading-none">{dayStr}</span>
                          <span className="text-white text-xs mt-0.5 font-bold leading-none">{dateObj.getDate()}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-white">
                              {dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                            <span className={`text-[8px] px-1.5 rounded-full font-bold uppercase ${
                              item.status === "PRESENT" ? "bg-emerald-500/10 text-emerald-400" :
                              item.status === "HALF_DAY" ? "bg-amber-500/10 text-amber-400" :
                              item.status === "LEAVE" ? "bg-orange-500/10 text-orange-400" :
                              "bg-red-500/10 text-red-400"
                            }`}>
                              {item.status}
                            </span>
                            {item.status === "PRESENT" && item.shift && (
                              <span className="text-[8px] px-1.5 rounded-full font-bold uppercase bg-blue-500/10 text-blue-400">
                                {SHIFT_LABELS[item.shift as ShiftType]?.label || item.shift}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {item.checkedInAt ? new Date(item.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                            <span>to</span>
                            {item.checkedOutAt ? new Date(item.checkedOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-slate-200 block">{item.totalHours} hrs</span>
                        {item.otHours > 0 && (
                          <span className="text-[9px] font-medium text-cyan-400 block">+{item.otHours} OT</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* ==================== TAB B: WORK DIARY ==================== */}
        {activeTab === "diary" && (
          <section className="glass-panel rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-400" />
                Daily Work Diary
              </h3>
              <input
                type="date"
                value={diaryDate}
                onChange={(e) => handleDiaryDateChange(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500/50"
              />
            </div>

            {diarySaveSuccess && (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>Diary Log Saved Successfully!</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Diary Input Section wrapper */}
              {[
                { key: "whatIDid", label: "What I Did Today", placeholder: "e.g. Processed 15 GRNs and reconciled inventory counts..." },
                { key: "issuesFaced", label: "Issues Faced", placeholder: "e.g. Delayed network syncs with Tally server..." },
                { key: "learnings", label: "Learnings / Insights", placeholder: "e.g. Learned keyboard shortcuts for stock valuation..." },
                { key: "notes", label: "Personal Notes", placeholder: "e.g. Store team performed outstandingly..." },
                { key: "tomorrowPlan", label: "Tomorrow Plan (Used for auto-tasks)", placeholder: "- Verify pending supplier POs\n- Inspect vehicle queue\n- Prepare MIS sheet" }
              ].map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{field.label}</label>
                    <VoiceButton 
                      onTranscript={(text) => {
                        const original = (diaryData as any)[field.key];
                        setDiaryData({
                          ...diaryData,
                          [field.key]: original ? `${original} ${text}` : text,
                        });
                      }} 
                    />
                  </div>
                  <textarea
                    rows={field.key === "tomorrowPlan" || field.key === "whatIDid" ? 3 : 2}
                    value={(diaryData as any)[field.key]}
                    onChange={(e) => setDiaryData({ ...diaryData, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full bg-slate-950/70 border border-slate-850 rounded-2xl px-3.5 py-3 text-xs text-white placeholder-slate-650 outline-none focus:border-blue-500/50 transition-colors resize-none leading-relaxed"
                  />
                </div>
              ))}

              <button
                onClick={saveDiaryEntry}
                className="w-full touch-active py-3.5 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-650 text-white font-extrabold text-xs uppercase tracking-widest shadow-md shadow-blue-500/10 active:scale-95 transition-all"
              >
                Save Diary Entry
              </button>
            </div>
          </section>
        )}

        {/* ==================== TAB C: TASK PLANNER ==================== */}
        {activeTab === "tasks" && (
          <section className="space-y-5">
            {/* Task Adder Panel */}
            <div className="glass-panel rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Bookmark className="w-4 h-4 text-blue-400" />
                Add New Task
              </h3>
              
              <div className="space-y-3.5">
                <div className="flex items-center gap-2">
                  <VoiceButton 
                    onTranscript={(text) => setNewTaskTitle(text)} 
                  />
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Task title..."
                    className="flex-1 bg-slate-950/70 border border-slate-850 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-600 outline-none focus:border-blue-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">Priority</label>
                    <select
                      value={newTaskPriority}
                      onChange={(e: any) => setNewTaskPriority(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-blue-500/50"
                    >
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">Tags (Space separated)</label>
                    <input
                      type="text"
                      value={newTaskTags}
                      onChange={(e) => setNewTaskTags(e.target.value)}
                      placeholder="e.g. PO Store"
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleCreateTask()}
                  className="w-full touch-active py-3.5 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-650 text-white font-extrabold text-xs uppercase tracking-wider shadow-md shadow-blue-500/10 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Add Task
                </button>
              </div>
            </div>

            {/* Task list cockpit */}
            <div className="glass-panel rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-purple-400" />
                  Task Planner
                </h3>
                
                {/* Carry Forward action */}
                <button
                  onClick={triggerManualCarryForward}
                  className="touch-active text-[10px] px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-850 text-cyan-400 font-bold uppercase hover:bg-slate-850 flex items-center gap-1 transition-all active:scale-95"
                  title="Import tasks from yesterday's diary"
                >
                  <TrendingUp className="w-3 h-3" />
                  Sync Diary
                </button>
              </div>

              {/* Status Filters */}
              <div className="flex gap-1.5 overflow-x-auto pb-3 -mx-2 px-2 scrollbar-none">
                {["ALL", "TODO", "IN_PROGRESS", "COMPLETED"].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTaskFilter(filter as any)}
                    className={`touch-active text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border shrink-0 transition-all ${
                      taskFilter === filter 
                        ? "bg-blue-500/15 border-blue-500/40 text-blue-400" 
                        : "bg-slate-950/40 border-slate-900 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {filter === "TODO" ? "To Do" : filter === "IN_PROGRESS" ? "In Progress" : filter}
                  </button>
                ))}
              </div>

              {/* Tasks List */}
              <div className="space-y-3 mt-2 max-h-[350px] overflow-y-auto pr-1">
                {filteredTasks.length === 0 ? (
                  <p className="text-center text-slate-500 text-xs py-8">No tasks in this category</p>
                ) : (
                  filteredTasks.map((t) => (
                    <div 
                      key={t.id} 
                      className={`flex items-start justify-between p-3.5 rounded-2xl border transition-all ${
                        t.status === "COMPLETED" 
                          ? "bg-slate-950/20 border-slate-900/60 opacity-60" 
                          : "bg-slate-900/40 border-slate-850 hover:bg-slate-900/60"
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Checkbox */}
                        <button
                          onClick={() => handleToggleTaskStatus(t)}
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all mt-0.5 shrink-0 ${
                            t.status === "COMPLETED" 
                              ? "bg-blue-500 border-blue-600 text-white" 
                              : "border-slate-700 hover:border-slate-500"
                          }`}
                        >
                          {t.status === "COMPLETED" && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                        </button>
                        
                        <div className="min-w-0 flex-1">
                          <span className={`text-xs font-bold block leading-snug break-words ${
                            t.status === "COMPLETED" ? "line-through text-slate-500" : "text-slate-100"
                          }`}>
                            {t.title}
                          </span>

                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {/* Priority Badge */}
                            <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-md flex items-center gap-1 ${
                              t.priority === "HIGH" 
                                ? "bg-red-500/10 text-red-400" 
                                : t.priority === "MEDIUM"
                                  ? "bg-amber-500/10 text-amber-400"
                                  : "bg-slate-500/15 text-slate-400"
                            }`}>
                              <span className={`w-1 h-1 rounded-full ${
                                t.priority === "HIGH" ? "bg-red-400" : t.priority === "MEDIUM" ? "bg-amber-400" : "bg-slate-400"
                              }`} />
                              {t.priority}
                            </span>

                            {/* Carry Forward Indicator */}
                            {t.carryForwardCount > 0 && (
                              <span className="text-[8px] px-2 py-0.5 rounded-md bg-yellow-500/10 text-yellow-400 font-extrabold flex items-center gap-0.5">
                                ⟲ {t.carryForwardCount}d
                              </span>
                            )}

                            {/* Tags list */}
                            {t.tags.map((tag) => (
                              <span key={tag} className="text-[8px] px-2 py-0.5 rounded-md bg-slate-950 text-slate-400 font-semibold border border-slate-850">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteTask(t.id)}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors ml-2 shrink-0 touch-active"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {/* ==================== TAB D: FINANCE OS ==================== */}
        {activeTab === "finance" && (
          <section className="space-y-5">
            {/* Quick Expense Logger */}
            <div className="glass-panel rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Quick Expense Logger
              </h3>

              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">Amount</label>
                    <input
                      type="number"
                      value={newExpenseAmount}
                      onChange={(e) => setNewExpenseAmount(e.target.value)}
                      placeholder="₹ Amount"
                      className="w-full bg-slate-950/70 border border-slate-855 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-blue-500/50"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">Category</label>
                    <select
                      value={newExpenseCategory}
                      onChange={(e) => setNewExpenseCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-855 rounded-xl px-3 py-2.5 text-xs text-slate-350 outline-none focus:border-blue-500/50"
                    >
                      <option value="Food">Food 🍔</option>
                      <option value="Fuel">Fuel ⛽</option>
                      <option value="Bills">Bills 📱</option>
                      <option value="Medical">Medical 💊</option>
                      <option value="Shopping">Shopping 🛍️</option>
                      <option value="Travel">Travel ✈️</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Description</label>
                    <VoiceButton 
                      onTranscript={(text) => {
                        setNewExpenseDesc(text);
                        const numMatch = text.match(/(\d+)/);
                        if (numMatch) {
                          setNewExpenseAmount(numMatch[1]);
                          const desc = text.replace(/(\d+|spent|rs|rupees|on|for)/gi, "").trim();
                          if (desc) setNewExpenseDesc(desc.charAt(0).toUpperCase() + desc.slice(1));
                        }
                      }} 
                    />
                  </div>
                  <input
                    type="text"
                    value={newExpenseDesc}
                    onChange={(e) => setNewExpenseDesc(e.target.value)}
                    placeholder="e.g. Swiggy lunch, vehicle fuel..."
                    className="w-full bg-slate-950/70 border border-slate-855 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-650 outline-none focus:border-blue-500/50"
                  />
                </div>

                <button
                  onClick={handleCreateExpense}
                  className="w-full touch-active py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-550 text-white font-extrabold text-xs uppercase tracking-wider shadow-md shadow-emerald-500/10 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Log Expense
                </button>
              </div>
            </div>

            {/* Budgets Utilisation progress bars */}
            <div className="glass-panel rounded-3xl p-6">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-4">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Monthly Budget Targets
              </h3>

              <div className="space-y-4">
                {budgets.map((b) => {
                  const spent = expenses
                    .filter((e) => e.category.toLowerCase() === b.category.toLowerCase())
                    .reduce((sum, e) => sum + e.amount, 0);
                  const percent = b.limit > 0 ? Math.min(100, Math.round((spent / b.limit) * 100)) : 0;
                  
                  let progressColor = "from-emerald-500 to-teal-400";
                  let textColor = "text-slate-400";
                  let alertIcon = null;

                  if (percent >= 100) {
                    progressColor = "from-red-500 to-rose-600";
                    textColor = "text-red-400 font-bold";
                    alertIcon = "🚨 Over Budget";
                  } else if (percent >= 85) {
                    progressColor = "from-amber-500 to-orange-400";
                    textColor = "text-amber-400 font-bold animate-pulse";
                    alertIcon = "⚠️ Warning";
                  }

                  return (
                    <div key={b.id} className="space-y-1">
                      <div className="flex justify-between text-xs items-center">
                        <span className="font-semibold text-slate-200">{b.category}</span>
                        <div className="flex items-center gap-2">
                          {alertIcon && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 uppercase tracking-wide font-black ${textColor}`}>
                              {alertIcon}
                            </span>
                          )}
                          <span className={`text-[11px] ${textColor}`}>
                            ₹{spent.toLocaleString()} / ₹{b.limit.toLocaleString()} ({percent}%)
                          </span>
                        </div>
                      </div>

                      <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden p-[1px] border border-slate-900">
                        <div 
                          className={`h-full rounded-full bg-gradient-to-r ${progressColor} transition-all duration-500`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* EMI Manager Accounts list */}
            <div className="glass-panel rounded-3xl p-6">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-4">
                <Clock className="w-4 h-4 text-cyan-400" />
                Active Loans & EMIs
              </h3>

              <div className="space-y-3">
                {emis.length === 0 ? (
                  <p className="text-center py-4 text-xs text-slate-500">No active EMIs</p>
                ) : (
                  emis.map((emi) => {
                    const due = new Date(emi.dueDate);
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    const dueZero = new Date(due);
                    dueZero.setHours(0,0,0,0);
                    
                    const diffTime = dueZero.getTime() - today.getTime();
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                    
                    let alertLabel = `Due in ${diffDays} days`;
                    let isUrgent = false;

                    if (diffDays === 0) {
                      alertLabel = "🚨 Due Today";
                      isUrgent = true;
                    } else if (diffDays === 1) {
                      alertLabel = "⚠️ Due Tomorrow";
                      isUrgent = true;
                    } else if (diffDays < 0) {
                      alertLabel = "⚠️ Past Due";
                      isUrgent = true;
                    }

                    const paidMonths = emi.totalMonths - emi.remainingMonths;
                    const paidPercent = emi.totalMonths > 0 ? Math.round((paidMonths / emi.totalMonths) * 100) : 0;

                    return (
                      <div key={emi.id} className="p-3.5 rounded-2xl bg-slate-900/40 border border-slate-850 space-y-3 relative overflow-hidden">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-bold text-slate-100 block">{emi.loanName}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5 block">
                              ₹{emi.amount.toLocaleString()} monthly payment
                            </span>
                          </div>
                          
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            isUrgent ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-slate-800 text-slate-350"
                          }`}>
                            {alertLabel}
                          </span>
                        </div>

                        {/* Loan pay progress */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                            <span>Paid {paidMonths} / {emi.totalMonths} months</span>
                            <span>{paidPercent}% Cleared</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden border border-slate-900">
                            <div 
                              className="h-full rounded-full bg-cyan-500 transition-all duration-300"
                              style={{ width: `${paidPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* SIP Planner plans list */}
            <div className="glass-panel rounded-3xl p-6">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-4">
                <Bookmark className="w-4 h-4 text-purple-400" />
                Systematic Investments (SIP)
              </h3>

              <div className="space-y-3">
                {sips.length === 0 ? (
                  <p className="text-center py-4 text-xs text-slate-500">No active SIPs</p>
                ) : (
                  sips.map((sip) => (
                    <div key={sip.id} className="flex justify-between items-center p-3 rounded-2xl bg-slate-900/30 border border-slate-850">
                      <div>
                        <span className="text-xs font-bold text-slate-100 block">{sip.fundName}</span>
                        <span className="text-[10px] text-slate-400 mt-0.5 block flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          Debited on the {sip.investmentDate}th of every month
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-emerald-400 block">₹{sip.amount.toLocaleString()}</span>
                        <span className="text-[9px] text-slate-450 uppercase font-bold tracking-wide">Monthly</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Expense History */}
            <div className="glass-panel rounded-3xl p-6">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-4">
                <History className="w-4 h-4 text-purple-400" />
                Recent Expenses
              </h3>

              <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                {expenses.slice(0, 5).map((e) => {
                  const dateObj = new Date(e.date);
                  return (
                    <div key={e.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/40 border border-slate-850">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-850 flex items-center justify-center text-xs shrink-0">
                          {e.category === 'Food' && '🍔'}
                          {e.category === 'Fuel' && '⛽'}
                          {e.category === 'Bills' && '📱'}
                          {e.category === 'Medical' && '💊'}
                          {e.category === 'Shopping' && '🛍️'}
                          {e.category === 'Travel' && '✈️'}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-200 block truncate">{e.description}</span>
                          <span className="text-[9px] text-slate-400 block mt-0.5 font-medium">
                            {dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' })} • {e.category}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className="text-xs font-extrabold text-slate-200">₹{e.amount}</span>
                        <button
                          onClick={() => handleDeleteExpense(e.id)}
                          className="p-1 rounded-md text-slate-500 hover:text-red-400 transition-colors touch-active"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ==================== TAB E: LIFE OS ==================== */}
        {activeTab === "life" && (
          <section className="space-y-5">
            {/* Journey Planner */}
            <div className="glass-panel rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-sky-400" />
                  Journey Planner
                </h3>
                <button
                  onClick={() => setShowAddJourney(!showAddJourney)}
                  className="px-2.5 py-1 text-[10px] font-extrabold bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-1 active:scale-95 transition-all"
                >
                  <Plus className="w-3 h-3" />
                  {showAddJourney ? "Cancel" : "Add Trip"}
                </button>
              </div>

              {showAddJourney && (
                <div className="bg-[#0b1324]/50 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Destination</label>
                    <input
                      type="text"
                      value={newDestination}
                      onChange={(e) => setNewDestination(e.target.value)}
                      placeholder="e.g. Ooty, Munnar, Goa"
                      className="w-full bg-[#070b13] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Budget (₹)</label>
                      <input
                        type="number"
                        value={newJourneyBudget}
                        onChange={(e) => setNewJourneyBudget(e.target.value)}
                        placeholder="25000"
                        className="w-full bg-[#070b13] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Start Date</label>
                      <input
                        type="date"
                        value={newStartDate}
                        onChange={(e) => setNewStartDate(e.target.value)}
                        className="w-full bg-[#070b13] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleCreateJourney}
                    className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold text-white rounded-xl active:scale-95 transition-all"
                  >
                    Confirm Trip Plan
                  </button>
                </div>
              )}

              {journeys.length === 0 ? (
                <p className="text-xs text-slate-500 py-2 text-center">No active travel journeys planned.</p>
              ) : (
                <div className="space-y-4">
                  {journeys.map((j) => {
                    let items: any[] = [];
                    try {
                      items = JSON.parse(j.checklist);
                    } catch (e) {}
                    const doneCount = items.filter(i => i.done).length;
                    const totalCount = items.length;
                    const percent = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
                    
                    return (
                      <div key={j.id} className="bg-[#0b1324]/40 border border-slate-850 rounded-2xl p-4 space-y-3.5">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-xs font-extrabold text-slate-200 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-red-400" />
                              {j.destination}
                            </h4>
                            <span className="text-[9px] text-slate-500 font-medium block mt-1">
                              {new Date(j.startDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} - {new Date(j.endDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <span className="text-xs font-extrabold text-blue-400 bg-blue-950/40 border border-blue-900/50 px-2 py-1 rounded-lg">
                            ₹{j.budget.toLocaleString()}
                          </span>
                        </div>

                        {/* Checklist progress */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <span>Checklist Progress</span>
                            <span>{doneCount}/{totalCount} Completed ({percent.toFixed(0)}%)</span>
                          </div>
                          <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-sky-400 to-blue-500 rounded-full transition-all duration-500" 
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>

                        {/* Checklist items */}
                        <div className="border-t border-slate-855/50 pt-3 space-y-2">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Travel Checklist:</span>
                          <div className="grid grid-cols-1 gap-2">
                            {items.map((item) => (
                              <label key={item.id} className="flex items-center gap-2.5 cursor-pointer select-none py-0.5">
                                <input
                                  type="checkbox"
                                  checked={item.done}
                                  onChange={() => handleToggleChecklistItem(j.id, item.id)}
                                  className="w-3.5 h-3.5 rounded border-slate-800 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#070b13] cursor-pointer"
                                />
                                <span className={`text-xs ${item.done ? 'line-through text-slate-500 font-medium' : 'text-slate-350 font-bold'}`}>
                                  {item.text}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Purchase Goals */}
            <div className="glass-panel rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Purchase Goals
                </h3>
                <button
                  onClick={() => setShowAddPurchase(!showAddPurchase)}
                  className="px-2.5 py-1 text-[10px] font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1 active:scale-95 transition-all"
                >
                  <Plus className="w-3 h-3" />
                  {showAddPurchase ? "Cancel" : "Add Goal"}
                </button>
              </div>

              {showAddPurchase && (
                <div className="bg-[#0b1324]/50 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Item Name</label>
                    <input
                      type="text"
                      value={newPurchaseItem}
                      onChange={(e) => setNewPurchaseItem(e.target.value)}
                      placeholder="e.g. MacBook Pro, Electric Scooter"
                      className="w-full bg-[#070b13] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Target Amount (₹)</label>
                    <input
                      type="number"
                      value={newPurchaseTarget}
                      onChange={(e) => setNewPurchaseTarget(e.target.value)}
                      placeholder="150000"
                      className="w-full bg-[#070b13] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleCreatePurchase}
                    className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-bold text-white rounded-xl active:scale-95 transition-all"
                  >
                    Set Savings Goal
                  </button>
                </div>
              )}

              {purchases.length === 0 ? (
                <p className="text-xs text-slate-500 py-2 text-center">No purchase savings goals active.</p>
              ) : (
                <div className="space-y-4">
                  {purchases.map((p) => {
                    const percent = p.targetAmount > 0 ? (p.savedAmount / p.targetAmount) * 100 : 0;
                    const remaining = Math.max(0, p.targetAmount - p.savedAmount);
                    
                    return (
                      <div key={p.id} className="bg-[#0b1324]/40 border border-slate-850 rounded-2xl p-4 space-y-3.5">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-xs font-extrabold text-slate-200">{p.itemName}</h4>
                            {p.targetDate && (
                              <span className="text-[9px] text-slate-500 font-medium block mt-1">
                                Target Date: {new Date(p.targetDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-extrabold text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-2 py-1 rounded-lg">
                            {percent.toFixed(0)}% Saved
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                            <span>Saved: ₹{p.savedAmount.toLocaleString()}</span>
                            <span>Target: ₹{p.targetAmount.toLocaleString()}</span>
                          </div>
                          <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500" 
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[9px] text-slate-500 font-medium pt-0.5">
                            <span>Remaining: ₹{remaining.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Add savings */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-850/50">
                          <input
                            type="number"
                            placeholder="Add savings amount (₹)"
                            value={savingsAmount[p.id] || ""}
                            onChange={(e) => setSavingsAmount({ ...savingsAmount, [p.id]: e.target.value })}
                            className="bg-[#070b13] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 flex-1"
                          />
                          <button
                            onClick={() => handleAddSavings(p.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold active:scale-95 transition-all shrink-0"
                          >
                            Add +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ==================== TAB F: DOCUMENT OS ==================== */}
        {activeTab === "docs" && (
          <section className="space-y-5">
            {/* Google Drive Connection status */}
            <div className="glass-panel rounded-3xl p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-950/50 border border-blue-900/40">
                  <Sparkles className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-200">Google Drive Integration</h4>
                  <span className="text-[9px] text-slate-500 font-medium block mt-0.5">Sync document files to cloud automatically</span>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 px-2.5 py-1 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Connected (Mock)
              </span>
            </div>

            {/* Document Uploader */}
            <div className="glass-panel rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Folder className="w-4 h-4 text-sky-400" />
                Documents Upload
              </h3>

              <div className="space-y-3">
                {uploading ? (
                  <div className="bg-[#0b1324]/40 border border-dashed border-slate-800 rounded-2xl p-6 text-center space-y-3">
                    <span className="text-xs text-slate-400 font-bold block animate-pulse">Uploading and syncing to Google Drive...</span>
                    <div className="max-w-xs mx-auto h-2 bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all duration-100" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium block">{uploadProgress}% uploaded</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select File to Upload</label>
                      <select 
                        id="mock-file-select"
                        className="w-full bg-[#070b13] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                        defaultValue="Form_16_FY26.pdf"
                      >
                        <option value="Form_16_FY26.pdf">Form_16_FY26.pdf (Tax/Income)</option>
                        <option value="Medical_Bill_Apollo.jpg">Medical_Bill_Apollo.jpg (Medical)</option>
                        <option value="Aadhaar_Updated.pdf">Aadhaar_Updated.pdf (ID Proof)</option>
                        <option value="EB_Bill_May.pdf">EB_Bill_May.pdf (Bill)</option>
                        <option value="CV_Gunal.pdf">CV_Gunal.pdf (Resume)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Category</label>
                        <select 
                          id="mock-file-category"
                          className="w-full bg-[#070b13] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                        >
                          <option value="ID Proof">ID Proof</option>
                          <option value="Bill">Bill</option>
                          <option value="Resume">Resume</option>
                          <option value="Medical">Medical</option>
                          <option value="Tax">Tax</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div className="flex items-end">
                        <button
                          onClick={() => {
                            const nameEl = document.getElementById("mock-file-select") as HTMLSelectElement;
                            const catEl = document.getElementById("mock-file-category") as HTMLSelectElement;
                            if (nameEl && catEl) {
                              handleUploadDocument(nameEl.value, catEl.value);
                            }
                          }}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Upload & Sync
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Categories filter */}
            <div className="flex flex-wrap gap-1.5">
              {["All", "ID Proof", "Bill", "Resume", "Medical", "Tax", "Other"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedDocCategory(cat)}
                  className={`px-3 py-1 rounded-full text-[10px] font-extrabold transition-all border ${
                    selectedDocCategory === cat 
                      ? 'bg-blue-600 text-white border-blue-500' 
                      : 'bg-[#070b13]/60 text-slate-400 border-slate-850 hover:border-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Documents List */}
            <div className="glass-panel rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <FileText className="w-4 h-4 text-slate-400" />
                Documents Hub
              </h3>

              <div className="divide-y divide-slate-850/50">
                {documents
                  .filter(d => selectedDocCategory === "All" || d.category === selectedDocCategory)
                  .map((d) => {
                    const sizeMB = d.size ? (d.size / (1024 * 1024)).toFixed(2) : '0.10';
                    
                    return (
                      <div key={d.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-xl bg-[#0b1324]/50 border border-slate-850/60 text-slate-400 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-200 block truncate">{d.name}</span>
                            <span className="text-[9px] text-slate-500 block mt-0.5 font-medium">
                              {d.category} • {sizeMB} MB
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          {d.googleDriveId ? (
                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                              Synced
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSyncDocument(d.id)}
                              className="px-2 py-0.5 bg-[#0b1324] hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-md text-[9px] font-bold active:scale-95 transition-all"
                            >
                              Sync cloud
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteDocument(d.id)}
                            className="p-1 rounded-md text-slate-500 hover:text-red-400 transition-colors touch-active"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                {documents.filter(d => selectedDocCategory === "All" || d.category === selectedDocCategory).length === 0 && (
                  <p className="text-xs text-slate-500 py-4 text-center">No documents in this category.</p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Store Operations tab */}
        {activeTab === "store" && (
          <section className="space-y-6">
            {/* KPI Header Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/40 backdrop-blur-md border border-slate-800/80 hover:border-slate-700/80 transition-all duration-300 animate-fadeIn">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold">GRN/PO Efficiency</span>
                </div>
                <div className="text-2xl font-black text-slate-100">{storeKpis.efficiencyRatio}%</div>
                <p className="text-[10px] text-slate-500 mt-1">Target is &gt;95% velocity</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/40 backdrop-blur-md border border-slate-800/80 hover:border-slate-700/80 transition-all duration-300 animate-fadeIn">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Compass className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-semibold">Avg Daily Vehicles</span>
                </div>
                <div className="text-2xl font-black text-slate-100">{storeKpis.averageVehicles}</div>
                <p className="text-[10px] text-slate-500 mt-1">Daily fleet throughput</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/40 backdrop-blur-md border border-slate-800/80 hover:border-slate-700/80 transition-all duration-300 animate-fadeIn">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <HardDrive className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-semibold">Material Receipts</span>
                </div>
                <div className="text-2xl font-black text-slate-100">{storeKpis.totalMaterialReceipts}</div>
                <p className="text-[10px] text-slate-500 mt-1">Items received weekly</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/40 backdrop-blur-md border border-slate-800/80 hover:border-slate-700/80 transition-all duration-300 animate-fadeIn">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <CheckCircle className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold">Reconciliation Score</span>
                </div>
                <div className="text-2xl font-black text-slate-100">{storeKpis.reconciliationScore}%</div>
                <p className="text-[10px] text-slate-500 mt-1">Audit verification score</p>
              </div>
            </div>

            {/* Logger Form Button or Form Panel */}
            <div className="p-4 rounded-xl bg-slate-900/40 backdrop-blur-md border border-slate-800/80">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-200">Store Activity Log</h3>
                <button
                  onClick={() => setShowAddStoreLog(!showAddStoreLog)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1 active:scale-95 touch-active"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {showAddStoreLog ? "Close Form" : "New Log Entry"}
                </button>
              </div>

              {showAddStoreLog && (
                <div className="space-y-4 pt-2 border-t border-slate-800/60 transition-all duration-300">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">GRN Count</label>
                      <input
                        type="number"
                        placeholder="e.g. 15"
                        value={newGrnCount}
                        onChange={(e) => setNewGrnCount(e.target.value)}
                        className="w-full bg-[#0a0f18] border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">PO Count</label>
                      <input
                        type="number"
                        placeholder="e.g. 12"
                        value={newPoCount}
                        onChange={(e) => setNewPoCount(e.target.value)}
                        className="w-full bg-[#0a0f18] border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Vehicle Entries</label>
                      <input
                        type="number"
                        placeholder="e.g. 24"
                        value={newVehicleEntries}
                        onChange={(e) => setNewVehicleEntries(e.target.value)}
                        className="w-full bg-[#0a0f18] border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Material Receipts</label>
                      <input
                        type="number"
                        placeholder="e.g. 32"
                        value={newMaterialReceipts}
                        onChange={(e) => setNewMaterialReceipts(e.target.value)}
                        className="w-full bg-[#0a0f18] border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition-all"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Stock Verifications</label>
                      <input
                        type="number"
                        placeholder="e.g. 5"
                        value={newStockVerifications}
                        onChange={(e) => setNewStockVerifications(e.target.value)}
                        className="w-full bg-[#0a0f18] border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Operational Notes</label>
                    <textarea
                      placeholder="Enter shift summary notes..."
                      value={newStoreNotes}
                      onChange={(e) => setNewStoreNotes(e.target.value)}
                      className="w-full bg-[#0a0f18] border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none h-16 resize-none transition-all"
                    />
                  </div>
                  <button
                    onClick={handleCreateStoreLog}
                    className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg active:scale-98 transition-all touch-active"
                  >
                    Submit Log Entry
                  </button>
                </div>
              )}
            </div>

            {/* Historical logs table */}
            <div className="p-4 rounded-xl bg-slate-900/40 backdrop-blur-md border border-slate-800/80">
              <h3 className="text-sm font-bold text-slate-200 mb-3">Historical Logs</h3>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 no-scrollbar">
                {storeLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-lg bg-[#0a0f18] border border-slate-900/60 hover:border-slate-800 transition-all duration-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-blue-400">{new Date(log.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-800/50 text-slate-400 border border-slate-800 font-bold">
                        GRN/PO: {log.grnCount}/{log.poCount}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] border-b border-slate-850 pb-2 mb-2 text-slate-400">
                      <div>
                        <div className="text-slate-500 font-medium">Vehicles</div>
                        <div className="font-bold text-slate-300">{log.vehicleEntries}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 font-medium">Receipts</div>
                        <div className="font-bold text-slate-300">{log.materialReceipts}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 font-medium">Reconciled</div>
                        <div className="font-bold text-slate-300">{log.stockVerifications}</div>
                      </div>
                    </div>
                    {log.notes && <p className="text-[10px] text-slate-500 italic mt-1 leading-relaxed">{log.notes}</p>}
                  </div>
                ))}
                {storeLogs.length === 0 && (
                  <p className="text-xs text-slate-500 py-6 text-center">No store logs recorded yet.</p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* AI Assistant tab */}
        {activeTab === "ai" && (
          <section className="flex flex-col h-[70vh] max-h-[600px] bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="p-3 bg-[#0a0f18]/60 border-b border-slate-800/80 flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-500" />
              <div>
                <h3 className="text-xs font-bold text-slate-200">GSuite 360 AI Assistant</h3>
                <p className="text-[9px] text-slate-500">Natural language lookup & command center</p>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              {aiMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] p-3 rounded-xl text-xs leading-relaxed ${
                    msg.sender === "user" 
                      ? "bg-blue-600/90 text-white rounded-tr-none border border-blue-500/30" 
                      : "bg-[#0b1324]/80 text-slate-200 rounded-tl-none border border-slate-800/60"
                  }`}>
                    {msg.text.split("\n").map((line: string, i: number) => (
                      <p 
                        key={i} 
                        className={i > 0 ? "mt-1.5" : ""} 
                        dangerouslySetInnerHTML={{ __html: line }}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {aiQueryLoading && (
                <div className="flex justify-start">
                  <div className="bg-[#0b1324]/80 border border-slate-800/60 p-3 rounded-xl rounded-tl-none flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Helper Chips */}
            <div className="px-4 py-2 border-t border-slate-800/40 bg-slate-950/20">
              <p className="text-[9px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Quick Queries</p>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {[
                  { text: "How much spent on food?", label: "Food Spending" },
                  { text: "Am I checked in today?", label: "Check-in Status" },
                  { text: "Show pending tasks", label: "Pending Tasks" },
                  { text: "What work did I do last week?", label: "Last Week's Work" },
                  { text: "What is my balance salary?", label: "Earned Salary" },
                  { text: "Next holiday?", label: "Next Holiday" }
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendAiQuery(chip.text)}
                    className="shrink-0 px-2.5 py-1 bg-slate-900/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold active:scale-95 transition-all touch-active"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Input */}
            <div className="p-3 bg-[#0a0f18]/60 border-t border-slate-800/80 flex gap-2">
              <input
                type="text"
                placeholder="Ask me anything..."
                value={aiQueryInput}
                onChange={(e) => setAiQueryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendAiQuery();
                }}
                className="flex-1 bg-[#0a0f18] border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition-all"
              />
              <button
                onClick={() => handleSendAiQuery()}
                className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg active:scale-95 transition-all duration-200 touch-active"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </section>
        )}

        {/* Reporting OS tab */}
        {activeTab === "reports" && (
          <section className="space-y-6">
            {/* Summary metrics display */}
            {reportsSummary && (
              <div className="space-y-4">
                {/* Attendance & Tasks Gauge Block */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900/40 backdrop-blur-md border border-slate-800/80 animate-fadeIn">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Attendance OS</span>
                      <span className="text-[9px] text-blue-400 font-bold">{getAttendancePeriod()}</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <div className="text-2xl font-black text-emerald-400">{reportsSummary.attendance?.attendanceRate}%</div>
                      <span className="text-[10px] text-slate-400 font-semibold">{reportsSummary.attendance?.present} present</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${reportsSummary.attendance?.attendanceRate}%` }}></div>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-2">Hours: {reportsSummary.attendance?.totalHours}h (+{reportsSummary.attendance?.otHours}h OT)</p>
                    {/* Shift breakdown */}
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold">🌅 {reportsSummary.attendance?.morningShift || 0}M</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 font-bold">☀️ {reportsSummary.attendance?.afternoonShift || 0}A</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold">🏢 {reportsSummary.attendance?.fullDayShift || 0}F</span>
                      {(reportsSummary.attendance?.leave || 0) > 0 && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-bold">{reportsSummary.attendance?.leave}L</span>}
                      {(reportsSummary.attendance?.halfDay || 0) > 0 && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold">{reportsSummary.attendance?.halfDay}HD</span>}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/40 backdrop-blur-md border border-slate-800/80 animate-fadeIn">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Tasks & Work</span>
                    <div className="flex items-end justify-between">
                      <div className="text-2xl font-black text-blue-400">
                        {reportsSummary.work?.tasksCompleted}/{((reportsSummary.work?.tasksCompleted || 0) + (reportsSummary.work?.tasksPending || 0))}
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold">Completed</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-blue-400 h-full rounded-full" style={{ width: `${((reportsSummary.work?.tasksCompleted || 0) / (((reportsSummary.work?.tasksCompleted || 0) + (reportsSummary.work?.tasksPending || 0)) || 1)) * 100}%` }}></div>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-2">Diaries Logged: {reportsSummary.work?.diariesLoggedCount}</p>
                  </div>
                </div>

                {/* Salary OS breakdown */}
                <div className="p-4 rounded-xl bg-slate-900/40 backdrop-blur-md border border-slate-800/80 animate-fadeIn">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Salary config & payout ledger</span>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-[#0a0f18] border border-slate-900 rounded-lg">
                      <div className="text-[9px] text-slate-500 font-medium">Monthly Expected</div>
                      <div className="text-sm font-black text-slate-200">₹{reportsSummary.salary?.expectedSalary}</div>
                    </div>
                    <div className="p-2 bg-[#0a0f18] border border-slate-900 rounded-lg">
                      <div className="text-[9px] text-slate-500 font-medium">Earned Base</div>
                      <div className="text-sm font-black text-emerald-400">₹{reportsSummary.salary?.earnedTillDate}</div>
                    </div>
                    <div className="p-2 bg-[#0a0f18] border border-slate-900 rounded-lg">
                      <div className="text-[9px] text-slate-500 font-medium">Net Payout</div>
                      <div className="text-sm font-black text-blue-400">₹{reportsSummary.salary?.netEarned}</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mt-3 border-t border-slate-800/60 pt-2">
                    <span>OT Earnings: ₹{reportsSummary.salary?.otEarnings}</span>
                    <span>Unpaid Leave Deductions: ₹{reportsSummary.salary?.leaveDeductions}</span>
                  </div>
                </div>

                {/* Expenses breakdown */}
                <div className="p-4 rounded-xl bg-slate-900/40 backdrop-blur-md border border-slate-800/80 animate-fadeIn">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Expense categories ledger</span>
                    <span className="text-xs font-black text-red-400">Total: ₹{reportsSummary.expenses?.totalSpent}</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { category: "Food", amount: reportsSummary.expenses?.foodSpent || 0, color: "bg-red-400" },
                      { category: "Fuel & Travel", amount: (reportsSummary.expenses?.fuelSpent || 0) + (reportsSummary.expenses?.travelSpent || 0), color: "bg-blue-400" },
                      { category: "Shopping", amount: reportsSummary.expenses?.shoppingSpent || 0, color: "bg-amber-400" },
                      { category: "Bills & Others", amount: (reportsSummary.expenses?.billsSpent || 0) + (reportsSummary.expenses?.medicalSpent || 0), color: "bg-purple-400" }
                    ].map((exp, idx) => {
                      const percentage = reportsSummary.expenses?.totalSpent > 0 ? (exp.amount / reportsSummary.expenses.totalSpent) * 100 : 0;
                      return (
                        <div key={idx}>
                          <div className="flex justify-between items-center text-[10px] text-slate-300 font-medium mb-1">
                            <span>{exp.category}</span>
                            <span>₹{exp.amount} ({percentage.toFixed(0)}%)</span>
                          </div>
                          <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                            <div className={`${exp.color} h-full rounded-full`} style={{ width: `${percentage}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Export and download reports cards */}
            <div className="p-4 rounded-xl bg-slate-900/40 backdrop-blur-md border border-slate-800/80">
              <h3 className="text-sm font-bold text-slate-200 mb-3">Download Spreadsheet Reports</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: "Attendance Log", type: "attendance", desc: "Detailed check-in, check-out history" },
                  { name: "Salary Statement", type: "salary", desc: "Pay calculations, OT rates, breakdown" },
                  { name: "Expense Ledger", type: "expenses", desc: "Category expenses, dates, description" },
                  { name: "Work Diary Summary", type: "work", desc: "Daily diaries, tasks completion status" }
                ].map((rep, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExportCSV(rep.type as any)}
                    disabled={exportLoading}
                    className="p-3 text-left rounded-lg bg-[#0a0f18] hover:bg-[#0e1624] border border-slate-850 hover:border-slate-750 transition-all duration-200 flex flex-col justify-between h-24 hover:translate-y-[-2px] relative overflow-hidden group active:scale-98 touch-active"
                  >
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-200 group-hover:text-blue-400 transition-colors">{rep.name}</h4>
                      <p className="text-[9px] text-slate-500 mt-1 leading-relaxed">{rep.desc}</p>
                    </div>
                    <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wider mt-2 group-hover:underline flex items-center gap-0.5">
                      Export CSV
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Print Options */}
            <div className="p-4 rounded-xl bg-slate-900/40 backdrop-blur-md border border-slate-800/80 text-center">
              <h3 className="text-sm font-bold text-slate-200 mb-2">Printable Report Format</h3>
              <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">Generate a beautifully formatted PDF print template ready for print or saving.</p>
              <button
                onClick={() => window.print()}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg active:scale-95 transition-all inline-flex items-center gap-1.5 touch-active"
              >
                <FileText className="w-3.5 h-3.5" />
                Print/Export PDF
              </button>
            </div>
          </section>
        )}

      </div>

      {/* 5. Mobile Fixed Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#070b13]/95 backdrop-filter backdrop-blur-lg border-t border-slate-850 px-4 py-3 z-50">
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap snap-x snap-mandatory pb-1">
          <button 
            onClick={() => setActiveTab("dashboard")} 
            className={`flex flex-col items-center gap-1 active:scale-90 transition-transform shrink-0 snap-center ${
              activeTab === "dashboard" ? "text-blue-500 font-bold" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Briefcase className="w-4.5 h-4.5" />
            <span className="text-[8px] tracking-wider">Cockpit</span>
          </button>
  
          <button 
            onClick={() => setActiveTab("diary")} 
            className={`flex flex-col items-center gap-1 active:scale-90 transition-transform shrink-0 snap-center ${
              activeTab === "diary" ? "text-blue-500 font-bold" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <FileText className="w-4.5 h-4.5" />
            <span className="text-[8px] tracking-wider">Diary</span>
          </button>
  
          <button 
            onClick={() => setActiveTab("tasks")} 
            className={`flex flex-col items-center gap-1 active:scale-90 transition-transform shrink-0 snap-center ${
              activeTab === "tasks" ? "text-blue-500 font-bold" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Clock className="w-4.5 h-4.5" />
            <span className="text-[8px] tracking-wider">Tasks</span>
          </button>
  
          <button 
            onClick={() => setActiveTab("finance")} 
            className={`flex flex-col items-center gap-1 active:scale-90 transition-transform shrink-0 snap-center ${
              activeTab === "finance" ? "text-blue-500 font-bold" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <DollarSign className="w-4.5 h-4.5" />
            <span className="text-[8px] tracking-wider">Finance</span>
          </button>
  
          <button 
            onClick={() => setActiveTab("life")} 
            className={`flex flex-col items-center gap-1 active:scale-90 transition-transform shrink-0 snap-center ${
              activeTab === "life" ? "text-blue-500 font-bold" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Compass className="w-4.5 h-4.5" />
            <span className="text-[8px] tracking-wider">Life</span>
          </button>
  
          <button 
            onClick={() => setActiveTab("docs")} 
            className={`flex flex-col items-center gap-1 active:scale-90 transition-transform shrink-0 snap-center ${
              activeTab === "docs" ? "text-blue-500 font-bold" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Folder className="w-4.5 h-4.5" />
            <span className="text-[8px] tracking-wider">Docs</span>
          </button>
  
          <button 
            onClick={() => setActiveTab("store")} 
            className={`flex flex-col items-center gap-1 active:scale-90 transition-transform shrink-0 snap-center ${
              activeTab === "store" ? "text-blue-500 font-bold" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <HardDrive className="w-4.5 h-4.5" />
            <span className="text-[8px] tracking-wider">Store</span>
          </button>
  
          <button 
            onClick={() => setActiveTab("ai")} 
            className={`flex flex-col items-center gap-1 active:scale-90 transition-transform shrink-0 snap-center ${
              activeTab === "ai" ? "text-blue-500 font-bold" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Bot className="w-4.5 h-4.5" />
            <span className="text-[8px] tracking-wider">AI OS</span>
          </button>
  
          <button 
            onClick={() => setActiveTab("reports")} 
            className={`flex flex-col items-center gap-1 active:scale-90 transition-transform shrink-0 snap-center ${
              activeTab === "reports" ? "text-blue-500" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <FileBarChart className="w-4.5 h-4.5" />
            <span className="text-[8px] tracking-wider">Reports</span>
          </button>
        </div>
      </nav>

      {/* Manual Attendance Entry Modal */}
      {showManualEntry && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end justify-center">
          <div className="w-full max-w-md bg-[#090d16]/95 backdrop-blur-md border-t border-slate-800 rounded-t-[2.5rem] p-6 pb-10 space-y-6 shadow-2xl animate-slideUp max-h-[90vh] overflow-y-auto no-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-900 pb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-slate-100">Manual Attendance Entry</h3>
              </div>
              <button 
                onClick={() => setShowManualEntry(false)}
                className="p-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 active:scale-90 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Date Input */}
            <div className="space-y-2">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Date of Attendance</label>
              <input 
                type="date"
                min={getManualEntryDateBounds().min}
                max={getManualEntryDateBounds().max}
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full rounded-2xl glass-input py-3.5 px-4 text-sm font-medium focus:border-blue-500/50"
              />
            </div>

            {/* Status Picker */}
            <div className="space-y-2">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Attendance Status</label>
              <div className="grid grid-cols-3 gap-2">
                {(["PRESENT", "HALF_DAY", "LEAVE"] as const).map((status) => {
                  const isActive = manualStatus === status;
                  const labels = { PRESENT: "Present", HALF_DAY: "Half Day", LEAVE: "Leave" };
                  const colors = {
                    PRESENT: isActive ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-500/10" : "bg-slate-900/60 border-slate-850 text-slate-400 hover:text-slate-200",
                    HALF_DAY: isActive ? "bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-md shadow-amber-500/10" : "bg-slate-900/60 border-slate-850 text-slate-400 hover:text-slate-200",
                    LEAVE: isActive ? "bg-red-500/20 border-red-500/50 text-red-300 shadow-md shadow-red-500/10" : "bg-slate-900/60 border-slate-850 text-slate-400 hover:text-slate-200"
                  };
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setManualStatus(status)}
                      className={`py-3 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all duration-200 active:scale-95 touch-active ${colors[status]}`}
                    >
                      {labels[status]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Shift Picker & Time Pickers (only shown if not Leave) */}
            {manualStatus !== "LEAVE" && (
              <>
                {/* Shift Selector */}
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Select Shift</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["MORNING", "AFTERNOON", "FULL_DAY"] as ShiftType[]).map((shift) => {
                      const cfg = SHIFT_LABELS[shift];
                      const isActive = manualShift === shift;
                      return (
                        <button
                          key={shift}
                          type="button"
                          onClick={() => setManualShift(shift)}
                          className={`flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-2xl border font-bold transition-all duration-200 active:scale-95 touch-active ${
                            isActive
                              ? "bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-md shadow-blue-500/10"
                              : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                          }`}
                        >
                          <span className="text-base leading-none">{cfg.icon}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest leading-none">{cfg.label}</span>
                          <span className="text-[8px] text-slate-500 leading-none">{cfg.time}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Clock In / Out times */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Check-In Time</label>
                    <input 
                      type="time"
                      value={manualCheckIn}
                      onChange={(e) => setManualCheckIn(e.target.value)}
                      className="w-full rounded-2xl glass-input py-3 px-4 text-sm font-medium focus:border-blue-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Check-Out Time</label>
                    <input 
                      type="time"
                      value={manualCheckOut}
                      onChange={(e) => setManualCheckOut(e.target.value)}
                      className="w-full rounded-2xl glass-input py-3 px-4 text-sm font-medium focus:border-blue-500/50"
                    />
                  </div>
                </div>

                {/* Preview details */}
                {manualEntryPreview && (
                  <div className="p-3 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Estimated Working Hours:</span>
                    <span className="text-blue-400 font-black">
                      {manualEntryPreview.totalHours}h
                      {manualEntryPreview.otHours > 0 && (
                        <span className="text-emerald-400 ml-1.5 font-bold">({manualEntryPreview.otHours}h OT)</span>
                      )}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Action Buttons */}
            <div className="pt-2">
              {manualSuccess ? (
                <div className="w-full py-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm uppercase tracking-wider">
                  <Check className="w-5 h-5 animate-bounce" />
                  Entry Saved Successfully
                </div>
              ) : (
                <button
                  type="button"
                  disabled={manualSaving}
                  onClick={handleManualEntry}
                  className="w-full touch-active flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-black shadow-lg shadow-blue-500/10 active:scale-95 transition-all text-sm uppercase tracking-wider disabled:opacity-50"
                >
                  {manualSaving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4.5 h-4.5" />
                      Save Attendance Entry
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
