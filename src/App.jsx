import React, { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import SummaryCard from "./components/SummaryCard.jsx";
import LineChart from "./components/LineChart.jsx";
import { auth, db, googleProvider } from "./lib/firebaseClient.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail
} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc
} from "firebase/firestore";

const formatCurrency = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value || 0);

const formatDate = (value) =>
  new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value)
  );

const formatMonthLabel = (value) =>
  new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(`${value}-01`));

const toCsv = (rows) =>
  rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/\"/g, '""')}"`).join(",")).join("\n");

const downloadCsv = (filename, rows) => {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const statusBadge = (status) => {
  if (status === "Lunas" || status === "Paid") return "success";
  if (status === "DP") return "warning";
  if (status === "Aktif") return "info";
  if (status === "Belum Bayar" || status === "Belum Lunas") return "danger";
  if (status === "Overdue") return "danger";
  return "muted";
};

const statusLabel = (status) => status || "Belum Bayar";

const daysUntil = (dateValue) => {
  if (!dateValue) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateValue);
  target.setHours(0, 0, 0, 0);
  const diff = target - today;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const DEBT_CATEGORY_OPTIONS = [
  "Operasional Bisnis",
  "Modal Project",
  "Pembelian Equipment",
  "Sewa Alat",
  "Transport",
  "Gaji/Crew",
  "Pribadi Mendesak",
  "Tagihan Vendor",
  "Pajak",
  "Lainnya"
];

const BRAND_NAME = "Finora";
const BRAND_TAGLINE = "Simple Finance for Your Business";
const ACTIVE_TITLES = {
  dashboard: "Dashboard",
  transactions: "Transaksi",
  projects: "Project",
  debts: "Hutang & Piutang",
  reports: "Laporan",
  analytics: "Analytics",
  profile: "Profil"
};

const MOBILE_NAV_ITEMS = [
  { id: "dashboard", label: "Home", icon: "⌂" },
  { id: "transactions", label: "Transaksi", icon: "◷" },
  { id: "projects", label: "Project", icon: "▦" },
  { id: "debts", label: "Hutang", icon: "◫" }
];

export default function App() {
  const [active, setActive] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: ""
  });
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: ""
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    businessName: "Finora Studio",
    email: "hello@finora.id",
    phone: "+62 812-3456-7890",
    industry: "Jasa Kreatif",
    city: "Jakarta",
    bankAccount: "BCA 1234 567 890",
    taxId: "NPWP 90.123.456.7-890.000"
  });
  const [summary, setSummary] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [cashflow, setCashflow] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("Semua");
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [projectForm, setProjectForm] = useState({
    client_name: "",
    phone: "",
    project_name: "",
    project_type: "Wedding",
    project_date: "",
    location: "",
    contract_value: "",
    payment_deadline: "",
    dp: "",
    payment_method: "Transfer"
  });
  const [incomeFormOpen, setIncomeFormOpen] = useState(false);
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [incomeForm, setIncomeForm] = useState({
    date: "",
    type: "DP",
    amount: "",
    method: "Transfer",
    note: ""
  });
  const [expenseForm, setExpenseForm] = useState({
    date: "",
    category: "Crew",
    amount: "",
    note: ""
  });
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState("Semua");
  const [transactionMonthFilter, setTransactionMonthFilter] = useState("Semua");
  const [transactionProjectFilter, setTransactionProjectFilter] = useState("Semua");
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [transactionForm, setTransactionForm] = useState({
    date: "",
    type: "income",
    category: "DP",
    project_id: "",
    payment_method: "Transfer",
    amount: "",
    note: "",
    proof_url: ""
  });
  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
  const [debtTab, setDebtTab] = useState("Hutang");
  const [debtFilter, setDebtFilter] = useState("Semua");
  const [isDebtFormOpen, setIsDebtFormOpen] = useState(false);
  const [isDebtPaymentOpen, setIsDebtPaymentOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState(null);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [debtForm, setDebtForm] = useState({
    date: "",
    lender_name: "",
    category: "Operasional Bisnis",
    total_amount: "",
    paid_amount: "0",
    due_date: "",
    note: ""
  });
  const [debtPaymentForm, setDebtPaymentForm] = useState({
    payment_date: "",
    amount: "",
    method: "Transfer",
    note: ""
  });
  const [receivables, setReceivables] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    type: "DP",
    amount: "",
    invoice_date: "",
    due_date: "",
    note: ""
  });
  const [showOverdueToast, setShowOverdueToast] = useState(false);
  const [toast, setToast] = useState(null);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [dismissedNotifIds, setDismissedNotifIds] = useState({});
  const [reminderFilter, setReminderFilter] = useState("Semua");
  const [snoozedReminders, setSnoozedReminders] = useState({});
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [quickSelectOpen, setQuickSelectOpen] = useState(null);
  const [quickAddForm, setQuickAddForm] = useState({
    type: "income",
    amount: "",
    category: "DP",
    project_id: "",
    date: new Date().toISOString().slice(0, 10),
    note: ""
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    setSession(null);
    setActive("dashboard");
  };

  const isGoogleAccount =
    session?.user?.providerData?.some((provider) => provider.providerId === "google.com") || false;

  const derivedBusinessName =
    profileData.businessName?.trim() ||
    session?.user?.displayName ||
    (session?.user?.email ? session.user.email.split("@")[0] : BRAND_NAME);

  useEffect(() => {
    if (!session?.user) return;
    setProfileData((prev) => ({
      ...prev,
      email: session.user.email || prev.email
    }));
  }, [session]);

  const handlePasswordUpdate = async (event) => {
    event.preventDefault();
    if (!session?.user?.email) return;
    if (!isGoogleAccount) {
      if (passwordForm.newPassword.length < 6) {
        setToast({ type: "error", message: "Password baru minimal 6 karakter." });
        return;
      }
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        setToast({ type: "error", message: "Konfirmasi password tidak sama." });
        return;
      }
    }

    setPasswordLoading(true);
    try {
      if (isGoogleAccount) {
        await sendPasswordResetEmail(auth, session.user.email);
        setToast({
          type: "success",
          message: "Email reset password dikirim. Cek inbox untuk set/update password."
        });
      } else {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Sesi login tidak ditemukan.");
        const credential = EmailAuthProvider.credential(
          session.user.email,
          passwordForm.currentPassword
        );
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, passwordForm.newPassword);
        setToast({ type: "success", message: "Password berhasil diperbarui." });
      }
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      setToast({
        type: "error",
        message: error?.message || "Gagal memperbarui password."
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const loadProfile = async (user) => {
    if (!user?.uid) return;
    try {
      const profileRef = doc(db, "profiles", user.uid);
      const profileSnap = await getDoc(profileRef);
      const savedProfile = profileSnap.exists() ? profileSnap.data() : {};
      setProfileData((prev) => ({
        ...prev,
        ...savedProfile,
        email: user.email || prev.email
      }));
    } catch (error) {
      setProfileData((prev) => ({
        ...prev,
        email: user.email || prev.email
      }));
      setToast({
        type: "error",
        message: "Izin Firestore untuk profil belum aktif. Update rules koleksi profiles."
      });
    }
  };

  const handleProfileEditToggle = async () => {
    if (!session?.user?.uid) return;
    if (!isEditingProfile) {
      setIsEditingProfile(true);
      return;
    }

    setProfileSaving(true);
    try {
      await setDoc(
        doc(db, "profiles", session.user.uid),
        {
          user_id: session.user.uid,
          businessName: profileData.businessName,
          email: session.user.email || profileData.email,
          phone: profileData.phone,
          industry: profileData.industry,
          city: profileData.city,
          bankAccount: profileData.bankAccount,
          taxId: profileData.taxId,
          updated_at: new Date().toISOString()
        },
        { merge: true }
      );
      setIsEditingProfile(false);
      setToast({ type: "success", message: "Profil berhasil disimpan." });
    } catch (error) {
      setToast({ type: "error", message: error?.message || "Gagal menyimpan profil." });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginForm.email, loginForm.password);
    } catch (error) {
      setAuthError(error.message || "Email atau password salah");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setAuthError("");
    if (registerForm.password.length < 6) {
      setAuthError("Password minimal 6 karakter");
      return;
    }
    if (registerForm.password !== registerForm.confirm) {
      setAuthError("Password dan konfirmasi harus sama");
      return;
    }
    setAuthLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, registerForm.email, registerForm.password);
      setAuthMode("login");
      setAuthError("Register berhasil. Silakan login.");
    } catch (error) {
      setAuthError(error.message || "Register gagal");
    } finally {
      setAuthLoading(false);
    }
  };

  const buildCashflow = (txs) => {
    const months = [];
    const now = new Date();
    for (let i = 4; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = date.toISOString().slice(0, 7);
      const label = date.toLocaleString("id-ID", { month: "short" });
      months.push({ key, month: label, in: 0, out: 0 });
    }
    months.forEach((month) => {
      txs
        .filter((item) => item.date?.startsWith(month.key))
        .forEach((item) => {
          if (item.type === "income") month.in += item.amount;
          if (item.type === "expense") month.out += item.amount;
        });
    });
    return months.map(({ month, in: income, out }) => ({ month, in: income, out }));
  };

  const loadData = async (userId) => {
    setDataLoading(true);
    try {
      const projectsSnap = await getDocs(query(collection(db, "projects"), where("user_id", "==", userId)));
      const transactionsSnap = await getDocs(
        query(collection(db, "transactions"), where("user_id", "==", userId))
      );
      const debtsSnap = await getDocs(query(collection(db, "debts"), where("user_id", "==", userId)));

      const projectData = projectsSnap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
      const transactionData = transactionsSnap.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data()
      }));
      const debtData = debtsSnap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));

      const hydratedProjects = (projectData || []).map((project) => {
      const payments = (transactionData || [])
        .filter((item) => item.project_id === project.id && item.type === "income")
        .map((item) => ({
          date: item.date,
          type: item.category === "DP" ? "DP" : "Pelunasan",
          amount: item.amount,
          method: item.payment_method,
          note: item.note
        }));
      const expenses = (transactionData || [])
        .filter((item) => item.project_id === project.id && item.type === "expense")
        .map((item) => ({
          date: item.date,
          category: item.category,
          amount: item.amount,
          note: item.note
        }));
      return enrichLocalProject({ ...project, payments, expenses });
    });

      const derivedReceivables = hydratedProjects
      .filter((item) => item.payment_status !== "Lunas")
      .map((item) => ({
        client: item.client_name,
        project: item.project_name,
        total: item.contract_value,
        dibayar: item.total_paid,
        sisa: item.remaining_payment,
        jatuhTempo: item.payment_deadline,
        status: item.payment_status
      }));

      const normalizedDebts = (debtData || []).map((debt) => {
      const remaining = Math.max(debt.total_amount - debt.paid_amount, 0);
      const status = calculateDebtStatus(remaining, debt.due_date);
      return { ...debt, remaining_amount: remaining, status, payments: debt.payments || [] };
    });

      const currentMonthKey = new Date().toISOString().slice(0, 7);
      const monthlyTransactions = (transactionData || []).filter((item) =>
        item.date?.startsWith(currentMonthKey)
      );
      const monthlyIncomeValue = monthlyTransactions
        .filter((item) => item.type === "income")
        .reduce((sum, item) => sum + item.amount, 0);
      const monthlyExpenseValue = monthlyTransactions
        .filter((item) => item.type === "expense")
        .reduce((sum, item) => sum + item.amount, 0);
      const totalIncomeValue = (transactionData || [])
        .filter((item) => item.type === "income")
        .reduce((sum, item) => sum + item.amount, 0);
      const totalExpenseValue = (transactionData || [])
        .filter((item) => item.type === "expense")
        .reduce((sum, item) => sum + item.amount, 0);

      const monthStats = [];
      for (let i = 4; i >= 0; i -= 1) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const key = date.toISOString().slice(0, 7);
        const label = date.toLocaleString("id-ID", { month: "short" });
        const monthTx = transactionData.filter((item) => item.date?.startsWith(key));
        const income = monthTx
          .filter((item) => item.type === "income")
          .reduce((sum, item) => sum + item.amount, 0);
        const expense = monthTx
          .filter((item) => item.type === "expense")
          .reduce((sum, item) => sum + item.amount, 0);
        monthStats.push({ label, profit: income - expense });
      }

      const expenseByCategory = transactionData
      .filter((item) => item.type === "expense")
      .reduce((acc, item) => {
        const key = item.category || "Lainnya";
        acc[key] = (acc[key] || 0) + (item.amount || 0);
        return acc;
      }, {});
      const expenseCategories = Object.entries(expenseByCategory)
      .map(([kategori, nilai]) => ({ kategori, nilai }))
      .sort((a, b) => b.nilai - a.nilai)
      .slice(0, 5);

      const topProjects = hydratedProjects
      .map((item) => ({ project: item.project_name, profit: item.profit || 0 }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 3);

      setSummary({
        totalSaldo: totalIncomeValue - totalExpenseValue,
        pemasukan: monthlyIncomeValue,
        pengeluaran: monthlyExpenseValue,
        profit: monthlyIncomeValue - monthlyExpenseValue
      });
      setCashflow(buildCashflow(transactionData || []));
      setProjects(hydratedProjects);
      setTransactions(transactionData || []);
      setDebts(normalizedDebts);
      setReceivables(derivedReceivables);
      setAnalytics({
        profitPerBulan: monthStats.map((item) => item.profit),
        profitLabels: monthStats.map((item) => item.label),
        pengeluaranKategori:
          expenseCategories.length > 0 ? expenseCategories : [{ kategori: "Belum ada data", nilai: 0 }],
        topProjects: topProjects.length > 0 ? topProjects : [{ project: "Belum ada project", profit: 0 }]
      });
    } catch (error) {
      setToast({ type: "error", message: error?.message || "Gagal memuat data dashboard." });
    } finally {
      setDataLoading(false);
    }
  };

  const refreshData = async () => {
    if (!session?.user?.uid) return;
    await loadData(session.user.uid);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setSession(user ? { user } : null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!session) return;
    loadData(session.user.uid);
    loadProfile(session.user);
  }, [session]);

  const enrichLocalProject = (project) => {
    const totalPaid = (project.payments || []).reduce((sum, item) => sum + item.amount, 0);
    const totalExpense = (project.expenses || []).reduce((sum, item) => sum + item.amount, 0);
    const remainingPayment = Math.max(project.contract_value - totalPaid, 0);
    const paymentStatus =
      totalPaid === 0 ? "Belum Bayar" : totalPaid < project.contract_value ? "DP" : "Lunas";
    const overdue = paymentStatus !== "Lunas" && new Date(project.project_date) < new Date();

    return {
      ...project,
      total_paid: totalPaid,
      total_expense: totalExpense,
      remaining_payment: remainingPayment,
      profit: totalPaid - totalExpense,
      payment_status: paymentStatus,
      overdue
    };
  };

  const resetProjectForm = () => {
    setProjectForm({
      client_name: "",
      phone: "",
      project_name: "",
      project_type: "Wedding",
      project_date: "",
      location: "",
      contract_value: "",
      payment_deadline: "",
      dp: "",
      payment_method: "Transfer"
    });
    setEditingProject(null);
  };

  const openProjectForm = (project = null) => {
    if (project) {
      setEditingProject(project);
      setProjectForm({
        client_name: project.client_name,
        phone: project.phone || "",
        project_name: project.project_name,
        project_type: project.project_type,
        project_date: project.project_date,
        location: project.location || "",
        contract_value: project.contract_value,
        payment_deadline: project.payment_deadline,
        dp: project.payments?.[0]?.amount || "",
        payment_method: project.payments?.[0]?.method || "Transfer"
      });
    } else {
      resetProjectForm();
    }
    setIsProjectFormOpen(true);
  };

  const handleProjectSubmit = async (event) => {
    event.preventDefault();
    if (!session?.user?.uid) return;
    const contractValue = Number(projectForm.contract_value || 0);
    const dpValue = Number(projectForm.dp || 0);

    const payload = {
      user_id: session.user.uid,
      client_name: projectForm.client_name,
      phone: projectForm.phone,
      project_name: projectForm.project_name,
      project_type: projectForm.project_type,
      project_date: projectForm.project_date,
      location: projectForm.location,
      contract_value: contractValue,
      payment_deadline: projectForm.payment_deadline,
      total_paid: 0,
      total_expense: 0
    };

    if (editingProject) {
      const optimistic = enrichLocalProject({
        ...editingProject,
        ...payload,
        payments: editingProject.payments || [],
        expenses: editingProject.expenses || []
      });
      setProjects((prev) =>
        prev.map((item) => (item.id === editingProject.id ? optimistic : item))
      );
      await updateDoc(doc(db, "projects", editingProject.id), payload);
    } else {
      const created = await addDoc(collection(db, "projects"), payload);
      const optimistic = enrichLocalProject({
        ...payload,
        id: created.id,
        payments: dpValue
          ? [
              {
                date: projectForm.project_date || new Date().toISOString().slice(0, 10),
                amount: dpValue,
                method: projectForm.payment_method,
                note: "DP awal"
              }
            ]
          : [],
        expenses: []
      });
      setProjects((prev) => [optimistic, ...prev]);
      if (dpValue > 0) {
        await addDoc(collection(db, "transactions"), {
          user_id: session.user.uid,
          project_id: created.id,
          type: "income",
          category: "DP",
          amount: dpValue,
          date: projectForm.project_date || new Date().toISOString().slice(0, 10),
          payment_method: projectForm.payment_method,
          note: "DP awal"
        });
      }
    }

    await refreshData();
    setIsProjectFormOpen(false);
    resetProjectForm();
    setToast({ type: "success", message: editingProject ? "Project diperbarui." : "Project ditambahkan." });
  };

  const handleProjectDelete = async (projectId) => {
    if (!window.confirm("Hapus project ini?")) return;
    const previousProjects = projects;
    setProjects((prev) => prev.filter((item) => item.id !== projectId));
    if (selectedProjectId === projectId) {
      setSelectedProjectId(null);
    }
    try {
      const txSnap = await getDocs(
        query(
          collection(db, "transactions"),
          where("project_id", "==", projectId),
          where("user_id", "==", session.user.uid)
        )
      );
      await Promise.all(txSnap.docs.map((d) => deleteDoc(doc(db, "transactions", d.id))));
      await deleteDoc(doc(db, "projects", projectId));
      await refreshData();
      setToast({ type: "success", message: "Project berhasil dihapus." });
    } catch (error) {
      setProjects(previousProjects);
      setToast({ type: "error", message: "Gagal menghapus project. Cek izin Firestore." });
    }
  };


  const selectedProject = projects.find((project) => project.id === selectedProjectId);

  const handleAddIncome = async (event) => {
    event.preventDefault();
    if (!selectedProject) return;
    const amount = Number(incomeForm.amount || 0);
    await addDoc(collection(db, "transactions"), {
      user_id: session.user.uid,
      date: incomeForm.date,
      type: "income",
      category: incomeForm.type,
      project_id: selectedProject.id,
      payment_method: incomeForm.method,
      amount,
      note: incomeForm.note,
      proof_url: ""
    });
    await refreshData();
    setIncomeForm({ date: "", type: "DP", amount: "", method: "Transfer", note: "" });
    setIncomeFormOpen(false);
    setToast({ type: "success", message: "Pemasukan project ditambahkan." });
  };

  const handleAddExpense = async (event) => {
    event.preventDefault();
    if (!selectedProject) return;
    const amount = Number(expenseForm.amount || 0);
    await addDoc(collection(db, "transactions"), {
      user_id: session.user.uid,
      date: expenseForm.date,
      type: "expense",
      category: expenseForm.category,
      project_id: selectedProject.id,
      payment_method: "Cash",
      amount,
      note: expenseForm.note,
      proof_url: ""
    });
    await refreshData();
    setExpenseForm({ date: "", category: "Crew", amount: "", note: "" });
    setExpenseFormOpen(false);
    setToast({ type: "success", message: "Pengeluaran project ditambahkan." });
  };

  const calculateDebtStatus = (remaining, dueDate) => {
    if (remaining <= 0) return "Lunas";
    const today = new Date().toISOString().slice(0, 10);
    if (dueDate && dueDate < today) return "Overdue";
    return "Aktif";
  };

  const resetDebtForm = () => {
    setDebtForm({
      date: "",
      lender_name: "",
      category: "Operasional Bisnis",
      total_amount: "",
      paid_amount: "0",
      due_date: "",
      note: ""
    });
    setEditingDebt(null);
  };

  const openDebtForm = (debt = null) => {
    if (debt) {
      setEditingDebt(debt);
      setDebtForm({
        date: debt.date,
        lender_name: debt.lender_name,
        category: debt.category,
        total_amount: debt.total_amount,
        paid_amount: debt.paid_amount,
        due_date: debt.due_date,
        note: debt.note || ""
      });
    } else {
      resetDebtForm();
    }
    setIsDebtFormOpen(true);
  };

  const handleDebtSubmit = async (event) => {
    event.preventDefault();
    const total = Number(debtForm.total_amount || 0);
    const paid = Number(debtForm.paid_amount || 0);
    const remaining = Math.max(total - paid, 0);
    const status = calculateDebtStatus(remaining, debtForm.due_date);

    const newDebt = {
      user_id: session.user.uid,
      date: debtForm.date,
      lender_name: debtForm.lender_name,
      category: debtForm.category,
      total_amount: total,
      paid_amount: paid,
      remaining_amount: remaining,
      due_date: debtForm.due_date,
      status,
      note: debtForm.note
    };

    if (editingDebt) {
      await updateDoc(doc(db, "debts", editingDebt.id), newDebt);
    } else {
      await addDoc(collection(db, "debts"), newDebt);
    }
    await refreshData();

    setIsDebtFormOpen(false);
    resetDebtForm();
    setToast({ type: "success", message: "Hutang tersimpan." });
  };

  const handleDebtDelete = async (debtId) => {
    if (!window.confirm("Hapus hutang ini?")) return;
    await deleteDoc(doc(db, "debts", debtId));
    await refreshData();
    setToast({ type: "success", message: "Hutang dihapus." });
  };

  const openDebtPayment = (debt) => {
    setSelectedDebt(debt);
    setDebtPaymentForm({
      payment_date: new Date().toISOString().slice(0, 10),
      amount: "",
      method: "Transfer",
      note: ""
    });
    setIsDebtPaymentOpen(true);
  };

  const handleDebtPayment = async (event) => {
    event.preventDefault();
    if (!selectedDebt) return;
    const payAmount = Number(debtPaymentForm.amount || 0);
    const updatedPaid = selectedDebt.paid_amount + payAmount;
    const remaining = Math.max(selectedDebt.total_amount - updatedPaid, 0);
    const status = calculateDebtStatus(remaining, selectedDebt.due_date);

    const newPayment = {
      id: `debtpay-${Date.now()}`,
      payment_date: debtPaymentForm.payment_date,
      amount: payAmount,
      method: debtPaymentForm.method,
      note: debtPaymentForm.note
    };
    const updatedDebt = {
      ...selectedDebt,
      paid_amount: updatedPaid,
      remaining_amount: remaining,
      status,
      payments: [...(selectedDebt.payments || []), newPayment]
    };

    await updateDoc(doc(db, "debts", selectedDebt.id), updatedDebt);
    await addDoc(collection(db, "transactions"), {
      user_id: session.user.uid,
      date: debtPaymentForm.payment_date,
      type: "expense",
      category: "Hutang",
      project_id: null,
      payment_method: debtPaymentForm.method,
      amount: payAmount,
      note: debtPaymentForm.note || `Pembayaran hutang: ${selectedDebt.lender_name}`,
      proof_url: ""
    });
    await refreshData();

    setIsDebtPaymentOpen(false);
    setSelectedDebt(null);
    setToast({ type: "success", message: "Pembayaran hutang tercatat." });
  };

  const openInvoiceForm = () => {
    if (!selectedProject) return;
    const today = new Date().toISOString().slice(0, 10);
    const dpTarget = Math.round(selectedProject.contract_value * 0.3);
    const dpDue = Math.max(dpTarget - selectedProject.total_paid, 0);
    const defaultAmount = dpDue > 0 ? dpDue : selectedProject.remaining_payment;

    setInvoiceForm({
      type: "DP",
      amount: defaultAmount,
      invoice_date: today,
      due_date: selectedProject.payment_deadline || today,
      note: ""
    });
    setIsInvoiceOpen(true);
  };

  const updateInvoiceAmountByType = (type) => {
    if (!selectedProject) return;
    if (type === "DP") {
      const dpTarget = Math.round(selectedProject.contract_value * 0.3);
      const dpDue = Math.max(dpTarget - selectedProject.total_paid, 0);
      setInvoiceForm((prev) => ({ ...prev, type, amount: dpDue || selectedProject.remaining_payment }));
      return;
    }
    if (type === "Pelunasan") {
      setInvoiceForm((prev) => ({ ...prev, type, amount: selectedProject.remaining_payment }));
      return;
    }
    setInvoiceForm((prev) => ({ ...prev, type, amount: prev.amount || 0 }));
  };

  const generateInvoicePdf = () => {
    if (!selectedProject) return;
    const amountValue = Number(invoiceForm.amount || 0);
    const invoiceTitle = `Invoice-${selectedProject.client_name}-${invoiceForm.invoice_date}`;
    const html = `
      <html>
        <head>
          <title>${invoiceTitle}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #1f2937; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
            .brand { font-weight: 700; font-size: 22px; letter-spacing: 0.08em; }
            .tagline { font-size: 12px; color: #6b7280; }
            .card { border: 1px solid #e5e7eb; padding: 16px; border-radius: 12px; }
            .row { display: flex; justify-content: space-between; margin-top: 8px; }
            .muted { color: #6b7280; font-size: 12px; }
            .title { font-size: 18px; font-weight: 600; margin-bottom: 12px; }
            .total { font-size: 18px; font-weight: 700; }
            .footer { margin-top: 24px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="brand">${BRAND_NAME.toUpperCase()}</div>
              <div class="tagline">${BRAND_TAGLINE}</div>
            </div>
            <div class="muted">Tanggal Invoice: ${invoiceForm.invoice_date}</div>
          </div>

          <div class="card">
            <div class="title">Informasi Client</div>
            <div class="row"><span>Nama Client</span><strong>${selectedProject.client_name}</strong></div>
            <div class="row"><span>Project</span><strong>${selectedProject.project_name}</strong></div>
            <div class="row"><span>Tanggal Project</span><strong>${selectedProject.project_date}</strong></div>
          </div>

          <div class="card" style="margin-top: 16px;">
            <div class="title">Detail Invoice</div>
            <div class="row"><span>Deskripsi</span><strong>${invoiceForm.type}</strong></div>
            <div class="row"><span>Jatuh Tempo</span><strong>${invoiceForm.due_date}</strong></div>
            <div class="row"><span>Nominal</span><strong>${formatCurrency(amountValue)}</strong></div>
            ${invoiceForm.note ? `<div class="row"><span>Catatan</span><strong>${invoiceForm.note}</strong></div>` : ""}
          </div>

          <div class="card" style="margin-top: 16px;">
            <div class="row">
              <span class="muted">Total yang harus dibayar</span>
              <span class="total">${formatCurrency(amountValue)}</span>
            </div>
          </div>

          <div class="footer">Terima kasih atas kepercayaan Anda.</div>
        </body>
      </html>
    `;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const markInvoiceAsPaid = async () => {
    if (!selectedProject) return;
    const amountValue = Number(invoiceForm.amount || 0);
    const newTransaction = {
      user_id: session.user.uid,
      date: invoiceForm.invoice_date,
      type: "income",
      category: invoiceForm.type === "Custom Amount" ? "Lainnya" : invoiceForm.type,
      project_id: selectedProject.id,
      payment_method: "Transfer",
      amount: amountValue,
      note: invoiceForm.note || `Pembayaran invoice ${invoiceForm.type}`,
      proof_url: ""
    };
    await addDoc(collection(db, "transactions"), newTransaction);
    await refreshData();
    setIsInvoiceOpen(false);
    setToast({ type: "success", message: "Invoice ditandai sebagai lunas." });
  };

  const applyTransactionToProject = (project, transaction) => {
    if (!project || !transaction.project_id) return project;
    if (transaction.type === "income") {
      const payment = {
        date: transaction.date,
        type: transaction.category === "DP" ? "DP" : "Pelunasan",
        amount: transaction.amount,
        method: transaction.payment_method,
        note: transaction.note
      };
      return enrichLocalProject({
        ...project,
        payments: [...(project.payments || []), payment]
      });
    }
    const expense = {
      date: transaction.date,
      category: transaction.category,
      amount: transaction.amount,
      note: transaction.note
    };
    return enrichLocalProject({
      ...project,
      expenses: [...(project.expenses || []), expense]
    });
  };

  const removeTransactionFromProject = (project, transaction) => {
    if (!project || !transaction.project_id) return project;
    if (transaction.type === "income") {
      const updatedPayments = (project.payments || []).filter(
        (item) =>
          !(
            item.date === transaction.date &&
            item.amount === transaction.amount &&
            item.method === transaction.payment_method &&
            item.note === transaction.note
          )
      );
      return enrichLocalProject({ ...project, payments: updatedPayments });
    }
    const updatedExpenses = (project.expenses || []).filter(
      (item) =>
        !(
          item.date === transaction.date &&
          item.amount === transaction.amount &&
          item.category === transaction.category &&
          item.note === transaction.note
        )
    );
    return enrichLocalProject({ ...project, expenses: updatedExpenses });
  };

  const resetTransactionForm = () => {
    setTransactionForm({
      date: "",
      type: "income",
      category: "DP",
      project_id: "",
      payment_method: "Transfer",
      amount: "",
      note: "",
      proof_url: ""
    });
    setEditingTransaction(null);
  };

  const openTransactionForm = (transaction = null) => {
    if (transaction) {
      setEditingTransaction(transaction);
      setTransactionForm({
        date: transaction.date,
        type: transaction.type,
        category: transaction.category,
        project_id: transaction.project_id || "",
        payment_method: transaction.payment_method,
        amount: transaction.amount,
        note: transaction.note || "",
        proof_url: transaction.proof_url || ""
      });
    } else {
      resetTransactionForm();
    }
    setIsTransactionFormOpen(true);
  };

  const handleTransactionSubmit = async (event) => {
    event.preventDefault();
    const amountValue = Number(transactionForm.amount || 0);
    const newTransaction = {
      user_id: session.user.uid,
      date: transactionForm.date,
      type: transactionForm.type,
      category: transactionForm.category,
      project_id: transactionForm.project_id || null,
      payment_method: transactionForm.payment_method,
      amount: amountValue,
      note: transactionForm.note,
      proof_url: transactionForm.proof_url
    };

    if (editingTransaction) {
      await updateDoc(doc(db, "transactions", editingTransaction.id), newTransaction);
    } else {
      await addDoc(collection(db, "transactions"), newTransaction);
    }
    await refreshData();

    setIsTransactionFormOpen(false);
    resetTransactionForm();
    setToast({ type: "success", message: "Transaksi tersimpan." });
  };

  const handleTransactionDelete = async (transaction) => {
    if (!window.confirm("Hapus transaksi ini?")) return;
    setTransactions((prev) => prev.filter((item) => item.id !== transaction.id));
    await deleteDoc(doc(db, "transactions", transaction.id));
    await refreshData();
    setToast({ type: "success", message: "Transaksi dihapus." });
  };

  const openQuickAdd = () => {
    setQuickAddForm((prev) => ({
      ...prev,
      date: new Date().toISOString().slice(0, 10),
      type: "income",
      category: "DP",
      amount: "",
      project_id: "",
      note: ""
    }));
    setIsQuickAddOpen(true);
  };

  const handleQuickAddSubmit = async (event) => {
    event.preventDefault();
    const amountValue = Number(quickAddForm.amount || 0);
    if (!amountValue) return;
    const newTransaction = {
      user_id: session.user.uid,
      date: quickAddForm.date,
      type: quickAddForm.type,
      category: quickAddForm.category,
      project_id: quickAddForm.project_id || null,
      payment_method: "Transfer",
      amount: amountValue,
      note: quickAddForm.note,
      proof_url: ""
    };
    await addDoc(collection(db, "transactions"), newTransaction);
    await refreshData();
    setIsQuickAddOpen(false);
    setToast({ type: "success", message: "Quick add berhasil." });
  };

  const QuickSelect = ({ id, label, value, options, onChange }) => {
    const selected = options.find((item) => item.value === value)?.label || label;
    const isOpen = quickSelectOpen === id;
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setQuickSelectOpen(isOpen ? null : id)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-left flex items-center justify-between"
        >
          <span className="truncate">{selected}</span>
          <span className="text-slate-400">▾</span>
        </button>
        {isOpen && (
          <div className="absolute z-50 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-52 overflow-auto">
            {options.map((item) => (
              <button
                type="button"
                key={item.value}
                onClick={() => {
                  onChange(item.value);
                  setQuickSelectOpen(null);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  item.value === value ? "bg-slate-100 font-semibold" : ""
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const allTransactions = transactions || [];
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const monthlyTransactions = allTransactions.filter((item) => item.date?.slice(0, 7) === currentMonthKey);
  const monthlyIncome = monthlyTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);
  const monthlyExpense = monthlyTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);
  const totalIncome = allTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = allTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);
  const transactionMonthOptions = [...new Set(allTransactions.map((item) => item.date?.slice(0, 7)))].filter(
    Boolean
  );
  const filteredTransactions = allTransactions.filter((item) => {
    const searchValue = `${item.category} ${item.note || ""} ${
      projects.find((p) => p.id === item.project_id)?.project_name || ""
    }`
      .toLowerCase()
      .includes(transactionSearch.toLowerCase());
    const matchesType =
      transactionTypeFilter === "Semua" ||
      (transactionTypeFilter === "Pemasukan" && item.type === "income") ||
      (transactionTypeFilter === "Pengeluaran" && item.type === "expense");
    const matchesMonth = transactionMonthFilter === "Semua" || item.date?.slice(0, 7) === transactionMonthFilter;
    const matchesProject = transactionProjectFilter === "Semua" || item.project_id === transactionProjectFilter;
    return searchValue && matchesType && matchesMonth && matchesProject;
  });
  const filteredProjects = projects.filter((project) => {
    const matchesSearch = `${project.client_name} ${project.project_name}`
      .toLowerCase()
      .includes(projectSearch.toLowerCase());
    const status = statusLabel(project.payment_status);
    const todayDate = new Date().toISOString().slice(0, 10);
    const isActive = status !== "Lunas" && project.project_date >= todayDate;
    const isBelumLunas = status !== "Lunas";
    const matchesFilter =
      projectFilter === "Semua" ||
      (projectFilter === "Aktif" && isActive) ||
      (projectFilter === "Lunas" && status === "Lunas") ||
      (projectFilter === "Belum Lunas" && isBelumLunas);
    return matchesSearch && matchesFilter;
  });
  const filteredDebts = debts.filter((item) => debtFilter === "Semua" || item.status === debtFilter);
  const debtPaymentHistory = debts.flatMap((item) =>
    (item.payments || []).map((payment) => ({
      ...payment,
      lender_name: item.lender_name
    }))
  );
  const currentSaldo = totalIncome - totalExpense;
  const hasTransactions = allTransactions.length > 0;
  const receivableList = projects
    .filter((item) => item.payment_status !== "Lunas")
    .map((item) => ({
      client: item.client_name,
      project: item.project_name,
      total: item.contract_value,
      dibayar: item.total_paid,
      sisa: item.remaining_payment,
      jatuhTempo: item.payment_deadline,
      status: item.payment_status
    }));

  const debtTotals = debts.reduce(
    (acc, debt) => {
      acc.total += debt.total_amount;
      acc.remaining += debt.remaining_amount;
      if (debt.status === "Overdue") acc.overdue += debt.remaining_amount;
      return acc;
    },
    { total: 0, remaining: 0, overdue: 0 }
  );
  const overdueDebts = debts.filter((debt) => debt.status === "Overdue");
  const unpaidClientsCount = receivableList.length;

  const forecastWindowDays = 30;
  const minSaldo = 5000000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const withinForecast = (dateValue) => {
    if (!dateValue) return false;
    const target = new Date(dateValue);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= forecastWindowDays;
  };

  const forecastIncoming = receivableList
    .filter((item) => withinForecast(item.jatuhTempo))
    .map((item) => ({
      client: item.client,
      project: item.project,
      amount: item.sisa,
      date: item.jatuhTempo
    }));
  const forecastOutgoing = debts
    .filter((item) => item.remaining_amount > 0 && withinForecast(item.due_date))
    .map((item) => ({
      lender: item.lender_name,
      amount: item.remaining_amount,
      date: item.due_date
    }));

  const totalIncoming30 = forecastIncoming.reduce((sum, item) => sum + item.amount, 0);
  const totalOutgoing30 = forecastOutgoing.reduce((sum, item) => sum + item.amount, 0);
  const forecastBalance = currentSaldo + totalIncoming30 - totalOutgoing30;
  const forecastStatus =
    forecastBalance > minSaldo
      ? "Aman"
      : forecastBalance >= 0
      ? "Waspada"
      : "Risiko Minus";

  const todayKey = new Date().toISOString().slice(0, 10);
  const reminderItems = [
    ...projects
      .filter((project) => project.remaining_payment > 0)
      .map((project) => {
        const days = daysUntil(project.payment_deadline);
        let status = "Normal";
        if (days !== null && days < 0) status = "Overdue";
        else if (days !== null && days <= 3) status = "Due Soon";
        return {
          id: `rem-client-${project.id}`,
          type: "Client",
          title: project.client_name,
          subtitle: project.project_name,
          amount: project.remaining_payment,
          date: project.payment_deadline,
          status
        };
      }),
    ...debts
      .filter((debt) => debt.remaining_amount > 0)
      .map((debt) => {
        const days = daysUntil(debt.due_date);
        let status = "Normal";
        if (days !== null && days < 0) status = "Overdue";
        else if (days !== null && days <= 3) status = "Due Soon";
        return {
          id: `rem-debt-${debt.id}`,
          type: "Hutang",
          title: debt.lender_name,
          subtitle: debt.category,
          amount: debt.remaining_amount,
          date: debt.due_date,
          status
        };
      }),
    ...projects.map((project) => {
      const days = daysUntil(project.project_date);
      let status = "Normal";
      if (days !== null && days < 0) status = "Overdue";
      else if (days !== null && days <= 3) status = "Due Soon";
      return {
        id: `rem-project-${project.id}`,
        type: "Project",
        title: project.project_name,
        subtitle: project.client_name,
        amount: null,
        date: project.project_date,
        status
      };
    })
  ]
    .filter((item) => item.status !== "Normal")
    .filter((item) => {
      const snoozeUntil = snoozedReminders[item.id];
      if (!snoozeUntil) return true;
      return snoozeUntil < todayKey;
    })
    .sort((a, b) => {
      const aDays = daysUntil(a.date) ?? 9999;
      const bDays = daysUntil(b.date) ?? 9999;
      return aDays - bDays;
    })
    .slice(0, 5);

  const filteredReminderItems = reminderItems.filter((item) => {
    if (reminderFilter === "Semua") return true;
    if (reminderFilter === "Client") return item.type === "Client";
    if (reminderFilter === "Hutang") return item.type === "Hutang";
    if (reminderFilter === "Project") return item.type === "Project";
    return true;
  });
  const visibleReminderItems = reminderItems.filter((item) => !dismissedNotifIds[item.id]);

  const overdueClientCount = projects.filter((project) => {
    if (project.remaining_payment <= 0) return false;
    const days = daysUntil(project.payment_deadline);
    return days !== null && days < 0;
  }).length;
  const overdueDebtCount = debts.filter((debt) => {
    if (debt.remaining_amount <= 0) return false;
    const days = daysUntil(debt.due_date);
    return days !== null && days < 0;
  }).length;
  const totalOverdueCount = overdueClientCount + overdueDebtCount;

  useEffect(() => {
    if (totalOverdueCount > 0) {
      setShowOverdueToast(true);
    }
  }, [totalOverdueCount]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setIsNotifOpen(false);
    setIsProfileMenuOpen(false);
  }, [active]);

  const exportDebtCsv = () => {
    const rows = [
      [
        "Tanggal",
        "Kepada",
        "Kategori",
        "Total Hutang",
        "Sudah Dibayar",
        "Sisa Hutang",
        "Jatuh Tempo",
        "Status",
        "Catatan"
      ],
      ...debts.map((item) => [
        item.date,
        item.lender_name,
        item.category,
        item.total_amount,
        item.paid_amount,
        item.remaining_amount,
        item.due_date,
        item.status,
        item.note || ""
      ])
    ];
    downloadCsv("finora-hutang.csv", rows);
  };

  const exportReceivableCsv = () => {
    const rows = [
      [
        "Client",
        "Project",
        "Nilai Kontrak",
        "Total Dibayar",
        "Sisa Pembayaran",
        "Deadline",
        "Status"
      ],
      ...receivableList.map((item) => [
        item.client,
        item.project,
        item.total,
        item.dibayar,
        item.sisa,
        item.jatuhTempo,
        item.status
      ])
    ];
    downloadCsv("finora-piutang.csv", rows);
  };

  const exportDebtPdf = () => {
    const html = `
      <html>
        <head>
          <title>Laporan Hutang</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { font-size: 20px; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
            th { background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>${BRAND_NAME} - Laporan Hutang</h1>
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kepada</th>
                <th>Kategori</th>
                <th>Total</th>
                <th>Dibayar</th>
                <th>Sisa</th>
                <th>Jatuh Tempo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${debts
                .map(
                  (item) => `
                  <tr>
                    <td>${item.date}</td>
                    <td>${item.lender_name}</td>
                    <td>${item.category}</td>
                    <td>${formatCurrency(item.total_amount)}</td>
                    <td>${formatCurrency(item.paid_amount)}</td>
                    <td>${formatCurrency(item.remaining_amount)}</td>
                    <td>${item.due_date}</td>
                    <td>${item.status}</td>
                  </tr>
                `
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const exportReceivablePdf = () => {
    const html = `
      <html>
        <head>
          <title>Laporan Piutang</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { font-size: 20px; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
            th { background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>${BRAND_NAME} - Laporan Piutang</h1>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Project</th>
                <th>Nilai Kontrak</th>
                <th>Total Dibayar</th>
                <th>Sisa Pembayaran</th>
                <th>Deadline</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${receivableList
                .map(
                  (item) => `
                  <tr>
                    <td>${item.client}</td>
                    <td>${item.project}</td>
                    <td>${formatCurrency(item.total)}</td>
                    <td>${formatCurrency(item.dibayar)}</td>
                    <td>${formatCurrency(item.sisa)}</td>
                    <td>${item.jatuhTempo}</td>
                    <td>${item.status}</td>
                  </tr>
                `
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const reportMonthLabel = formatMonthLabel(currentMonthKey);
  const projectNameById = Object.fromEntries(
    projects.map((project) => [project.id, project.project_name])
  );
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 6);

  const exportMonthlyReportCsv = () => {
    const rows = [
      [`${BRAND_NAME} - Laporan Bulanan`, reportMonthLabel],
      [],
      ["Ringkasan"],
      ["Total Pemasukan", monthlyIncome],
      ["Total Pengeluaran", monthlyExpense],
      ["Profit Bulanan", monthlyIncome - monthlyExpense],
      ["Saldo Saat Ini", currentSaldo],
      [],
      ["Detail Transaksi"],
      [
        "Tanggal",
        "Jenis",
        "Kategori",
        "Project",
        "Metode",
        "Nominal",
        "Catatan"
      ],
      ...monthlyTransactions.map((item) => [
        item.date || "",
        item.type === "income" ? "Pemasukan" : "Pengeluaran",
        item.category || "",
        item.project_id ? projectNameById[item.project_id] || "Project Dihapus" : "Tanpa Project",
        item.payment_method || "",
        item.amount || 0,
        item.note || ""
      ])
    ];
    downloadCsv(`finora-laporan-${currentMonthKey}.csv`, rows);
  };

  const exportMonthlyReportPdf = () => {
    const detailRows = monthlyTransactions
      .map(
        (item) => `
          <tr>
            <td>${item.date || "-"}</td>
            <td>${item.type === "income" ? "Pemasukan" : "Pengeluaran"}</td>
            <td>${item.category || "-"}</td>
            <td>${
              item.project_id ? projectNameById[item.project_id] || "Project Dihapus" : "Tanpa Project"
            }</td>
            <td>${item.payment_method || "-"}</td>
            <td>${formatCurrency(item.amount || 0)}</td>
            <td>${item.note || "-"}</td>
          </tr>
        `
      )
      .join("");

    const html = `
      <html>
        <head>
          <title>${BRAND_NAME} - Laporan ${reportMonthLabel}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
            h1 { font-size: 20px; margin: 0; }
            h2 { font-size: 14px; margin: 2px 0 0; color: #64748b; font-weight: 500; }
            .meta { margin-top: 14px; margin-bottom: 16px; font-size: 12px; color: #64748b; }
            .cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 14px; }
            .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; }
            .label { font-size: 11px; color: #64748b; margin-bottom: 4px; }
            .value { font-size: 13px; font-weight: 700; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #e5e7eb; padding: 6px; text-align: left; vertical-align: top; }
            th { background: #f8fafc; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>${BRAND_NAME} - Laporan Bulanan</h1>
          <h2>${reportMonthLabel}</h2>
          <div class="meta">Diekspor: ${new Date().toLocaleString("id-ID")}</div>
          <div class="cards">
            <div class="card"><div class="label">Total Pemasukan</div><div class="value">${formatCurrency(monthlyIncome)}</div></div>
            <div class="card"><div class="label">Total Pengeluaran</div><div class="value">${formatCurrency(monthlyExpense)}</div></div>
            <div class="card"><div class="label">Profit Bulanan</div><div class="value">${formatCurrency(
              monthlyIncome - monthlyExpense
            )}</div></div>
            <div class="card"><div class="label">Saldo Saat Ini</div><div class="value">${formatCurrency(
              currentSaldo
            )}</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Jenis</th>
                <th>Kategori</th>
                <th>Project</th>
                <th>Metode</th>
                <th>Nominal</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              ${
                detailRows ||
                `<tr><td colspan="7" style="text-align:center;color:#64748b;">Belum ada transaksi pada bulan ini.</td></tr>`
              }
            </tbody>
          </table>
        </body>
      </html>
    `;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-[#f3f5fb] flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-md overflow-hidden rounded-[32px] bg-gradient-to-br from-[#4f99ec] via-[#4e82df] to-[#5456d9] shadow-card">
          <div className="px-6 pt-8 pb-5 text-white">
            <p className="text-sm tracking-wide opacity-80">{authMode === "login" ? "Sign in" : "Sign up"}</p>
            <h1 className="mt-2 text-3xl font-semibold">{authMode === "login" ? "Welcome Back" : "Create Account"}</h1>
            <p className="mt-1 text-sm text-white/80">{BRAND_NAME} - {BRAND_TAGLINE}</p>
          </div>

          <div className="relative rounded-t-[34px] bg-[#f7f7fb] px-5 pt-5 pb-6">
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setAuthMode("login")}
                className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
                  authMode === "login"
                    ? "bg-gradient-to-r from-[#6366f1] to-[#3b82f6] text-white"
                    : "border border-slate-200 text-slate-500"
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setAuthMode("register")}
                className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
                  authMode === "register"
                    ? "bg-gradient-to-r from-[#6366f1] to-[#3b82f6] text-white"
                    : "border border-slate-200 text-slate-500"
                }`}
              >
                Register
              </button>
            </div>

            {authError && (
              <div className="mt-3 text-sm text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-xl">
                {authError}
              </div>
            )}

            {authMode === "login" ? (
              <form className="mt-4 grid gap-3" onSubmit={handleLogin}>
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  placeholder="Email"
                  type="email"
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))}
                  required
                />
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  placeholder="Password"
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                  required
                />
                <button
                  className="w-full rounded-2xl bg-gradient-to-r from-[#6366f1] to-[#3b82f6] px-4 py-3 text-sm font-semibold text-white"
                  disabled={authLoading}
                >
                  {authLoading ? "Loading..." : "Login"}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setAuthError("");
                    try {
                      await signInWithPopup(auth, googleProvider);
                    } catch (error) {
                      setAuthError(error.message);
                    }
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold"
                >
                  Login with Google
                </button>
              </form>
            ) : (
              <form className="mt-4 grid gap-3" onSubmit={handleRegister}>
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  placeholder="Nama"
                  value={registerForm.name}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  placeholder="Email"
                  type="email"
                  value={registerForm.email}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))}
                  required
                />
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  placeholder="Password"
                  type="password"
                  value={registerForm.password}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))}
                  required
                />
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  placeholder="Confirm Password"
                  type="password"
                  value={registerForm.confirm}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, confirm: event.target.value }))}
                  required
                />
                <button
                  className="w-full rounded-2xl bg-gradient-to-r from-[#6366f1] to-[#3b82f6] px-4 py-3 text-sm font-semibold text-white"
                  disabled={authLoading}
                >
                  {authLoading ? "Loading..." : "Register"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[radial-gradient(circle_at_top_left,_#e7eef8,_#f5f7fa_40%)]">
      <Sidebar
        active={active}
        onChange={setActive}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        alertsCount={totalOverdueCount}
        businessName={derivedBusinessName}
        userEmail={session?.user?.email || profileData.email}
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8">
        <div className="flex flex-col gap-6">
          <div className="lg:hidden relative flex items-center justify-between px-1">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{BRAND_NAME}</p>
              <p className="text-lg font-semibold text-primary">{ACTIVE_TITLES[active]}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsProfileMenuOpen((prev) => !prev);
                  setIsNotifOpen(false);
                }}
                className="h-10 w-10 rounded-full border border-slate-200 bg-white text-base"
                aria-label="Profil"
              >
                👤
              </button>
              <button
                onClick={() => {
                  setIsNotifOpen((prev) => !prev);
                  setIsProfileMenuOpen(false);
                }}
                className="relative h-10 w-10 rounded-full border border-slate-200 bg-white text-base"
                aria-label="Notifikasi"
              >
                🔔
                {visibleReminderItems.length > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                    {visibleReminderItems.length}
                  </span>
                )}
              </button>
            </div>
            {isProfileMenuOpen && (
              <div className="absolute right-12 top-12 z-40 w-40 rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
                <button
                  onClick={() => {
                    setActive("profile");
                    setIsProfileMenuOpen(false);
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Menu Profil
                </button>
                <button
                  onClick={handleLogout}
                  className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                >
                  Logout
                </button>
              </div>
            )}
            {isNotifOpen && (
              <div className="absolute right-0 top-12 z-40 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-card">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-primary">Notifikasi</p>
                  <button
                    onClick={() => setIsNotifOpen(false)}
                    className="text-xs font-semibold text-slate-500"
                  >
                    Tutup
                  </button>
                </div>
                <div className="space-y-2">
                  {visibleReminderItems.length === 0 && (
                    <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Belum ada notifikasi.</p>
                  )}
                  {visibleReminderItems.slice(0, 4).map((item) => (
                    <button
                      key={item.id}
                      onClick={() =>
                        setDismissedNotifIds((prev) => ({
                          ...prev,
                          [item.id]: true
                        }))
                      }
                      className="w-full rounded-xl bg-slate-50 p-3 text-left"
                    >
                      <p className="text-xs font-semibold text-ink">{item.title}</p>
                      <p className="text-[11px] text-slate-500">{item.type} • {item.subtitle}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <header className="hidden lg:flex lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                Sistem Manajemen Keuangan
              </p>
              <h2 className="text-3xl font-semibold text-primary mt-2">{ACTIVE_TITLES[active]}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportMonthlyReportCsv}
                className="px-4 py-2 rounded-full border border-slate-200 bg-white text-sm font-semibold text-primary"
              >
                Export Laporan
              </button>
              <button
                onClick={openQuickAdd}
                className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold"
              >
                + Tambah Transaksi
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-full border border-slate-200 text-sm font-semibold"
              >
                Logout
              </button>
            </div>
          </header>

          {active === "dashboard" && dataLoading && (
            <>
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={`sk-sum-${index}`} className="card p-4 sm:p-6">
                    <div className="h-3 w-24 rounded bg-slate-200"></div>
                    <div className="mt-3 h-8 w-32 rounded bg-slate-200"></div>
                  </div>
                ))}
              </section>

              <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
                <div className="card p-4 sm:p-6 animate-pulse">
                  <div className="h-4 w-28 rounded bg-slate-200"></div>
                  <div className="mt-4 h-56 rounded-xl bg-slate-100"></div>
                </div>
                <div className="card p-4 sm:p-6 animate-pulse">
                  <div className="h-4 w-28 rounded bg-slate-200"></div>
                  <div className="mt-4 space-y-3">
                    <div className="h-14 rounded-xl bg-slate-100"></div>
                    <div className="h-14 rounded-xl bg-slate-100"></div>
                    <div className="h-14 rounded-xl bg-slate-100"></div>
                  </div>
                </div>
              </section>

              <section className="card p-4 sm:p-6 animate-pulse">
                <div className="h-5 w-40 rounded bg-slate-200"></div>
                <div className="mt-4 space-y-3">
                  <div className="h-16 rounded-xl bg-slate-100"></div>
                  <div className="h-16 rounded-xl bg-slate-100"></div>
                </div>
              </section>
            </>
          )}

          {active === "dashboard" && !dataLoading && summary && (
            <>
              <div className="fixed bottom-28 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-3">
                {isFabOpen && (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        setIsFabOpen(false);
                        openQuickAdd();
                      }}
                      className="px-4 py-2 rounded-full bg-primary text-white text-sm font-semibold shadow-lg"
                    >
                      + Transaksi
                    </button>
                    <button
                      onClick={() => {
                        setIsFabOpen(false);
                        openProjectForm();
                      }}
                      className="px-4 py-2 rounded-full bg-secondary text-white text-sm font-semibold shadow-lg"
                    >
                      + Project
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setIsFabOpen((prev) => !prev)}
                  className="h-14 w-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center text-2xl"
                  aria-label="Quick actions"
                >
                  {isFabOpen ? "×" : "+"}
                </button>
              </div>

              <section className="md:hidden rounded-[28px] bg-gradient-to-br from-[#4f99ec] via-[#4e82df] to-[#5456d9] p-5 text-white shadow-card">
                <p className="text-xs uppercase tracking-[0.18em] text-white/70">Saldo Saat Ini</p>
                <h3 className="mt-2 text-3xl font-semibold">
                  {formatCurrency(hasTransactions ? currentSaldo : summary.totalSaldo)}
                </h3>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-white/15 p-3">
                    <p className="text-[11px] text-white/70">Money In</p>
                    <p className="mt-1 text-sm font-semibold">
                      {formatCurrency(hasTransactions ? monthlyIncome : summary.pemasukan)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/15 p-3">
                    <p className="text-[11px] text-white/70">Money Out</p>
                    <p className="mt-1 text-sm font-semibold">
                      {formatCurrency(hasTransactions ? monthlyExpense : summary.pengeluaran)}
                    </p>
                  </div>
                </div>
              </section>

              <section className="md:hidden card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-primary">Recent Transactions</h3>
                  <button
                    onClick={() => setActive("transactions")}
                    className="text-xs font-semibold text-primary"
                  >
                    Lihat Semua
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {recentTransactions.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                      Belum ada transaksi.
                    </div>
                  )}
                  {recentTransactions.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{item.category}</p>
                        <p className="text-[11px] text-slate-500">{formatDate(item.date)}</p>
                      </div>
                      <p
                        className={`whitespace-nowrap text-sm font-semibold ${
                          item.type === "income" ? "text-secondary" : "text-rose-600"
                        }`}
                      >
                        {item.type === "income" ? "+" : "-"} {formatCurrency(item.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="hidden md:grid gap-6 xl:grid-cols-[1.7fr_1fr]">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <SummaryCard
                      title="Total Saldo"
                      value={formatCurrency(hasTransactions ? currentSaldo : summary.totalSaldo)}
                      icon="💼"
                      accent="bg-primary/10 text-primary"
                    />
                    <SummaryCard
                      title="Pemasukan Bulan Ini"
                      value={formatCurrency(hasTransactions ? monthlyIncome : summary.pemasukan)}
                      icon="📥"
                      accent="bg-secondary/10 text-secondary"
                    />
                    <SummaryCard
                      title="Pengeluaran Bulan Ini"
                      value={formatCurrency(hasTransactions ? monthlyExpense : summary.pengeluaran)}
                      icon="📤"
                      accent="bg-amber-100 text-amber-600"
                    />
                    <SummaryCard
                      title="Profit Bulan Ini"
                      value={formatCurrency(
                        hasTransactions ? monthlyIncome - monthlyExpense : summary.profit
                      )}
                      icon="✨"
                      accent="bg-slate-100 text-slate-600"
                    />
                  </div>

                  <div className="card p-4 sm:p-6">
                    <LineChart data={cashflow} />
                  </div>

                  <div className="card p-4 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500">Activity Summary</p>
                        <h3 className="text-lg font-semibold text-primary">Transaksi Terbaru</h3>
                      </div>
                      <button
                        onClick={() => setActive("transactions")}
                        className="px-3 py-2 rounded-full border border-slate-200 text-xs font-semibold text-primary"
                      >
                        Lihat Semua
                      </button>
                    </div>
                    <div className="mt-4 space-y-2">
                      {recentTransactions.length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                          Belum ada transaksi.
                        </div>
                      )}
                      {recentTransactions.slice(0, 6).map((item) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-[110px_1fr_auto] items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5"
                        >
                          <p className="text-xs text-slate-500">{formatDate(item.date)}</p>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">{item.category}</p>
                            <p className="truncate text-xs text-slate-500">
                              {item.project_id
                                ? projectNameById[item.project_id] || "Project Dihapus"
                                : "Tanpa Project"}
                            </p>
                          </div>
                          <p
                            className={`text-sm font-semibold ${
                              item.type === "income" ? "text-secondary" : "text-rose-600"
                            }`}
                          >
                            {item.type === "income" ? "+" : "-"} {formatCurrency(item.amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-[28px] bg-gradient-to-br from-[#2f46d1] via-[#3849d9] to-[#5a47dd] p-5 text-white shadow-card">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/70">My Balance</p>
                    <h3 className="mt-2 text-3xl font-semibold">
                      {formatCurrency(hasTransactions ? currentSaldo : summary.totalSaldo)}
                    </h3>
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button
                        onClick={openQuickAdd}
                        className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-primary"
                      >
                        + Transaksi
                      </button>
                      <button
                        onClick={openProjectForm}
                        className="rounded-xl bg-white/20 px-3 py-2 text-xs font-semibold text-white border border-white/30"
                      >
                        + Project
                      </button>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-white/15 p-3">
                        <p className="text-white/70">Money In</p>
                        <p className="mt-1 font-semibold">
                          {formatCurrency(hasTransactions ? monthlyIncome : summary.pemasukan)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/15 p-3">
                        <p className="text-white/70">Money Out</p>
                        <p className="mt-1 font-semibold">
                          {formatCurrency(hasTransactions ? monthlyExpense : summary.pengeluaran)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="card p-4 sm:p-5">
                    <p className="text-sm text-slate-500">Indicators</p>
                    <h4 className="text-base font-semibold">Cashflow Health</h4>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                        <span className="text-xs text-slate-500">Total Sisa Hutang</span>
                        <span className="text-sm font-semibold text-primary">
                          {formatCurrency(debtTotals.remaining)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                        <span className="text-xs text-slate-500">Client Belum Lunas</span>
                        <span className="text-sm font-semibold text-secondary">{unpaidClientsCount}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                        <span className="text-xs text-slate-500">Hutang Overdue</span>
                        <span className="text-sm font-semibold text-rose-600">{overdueDebts.length} Item</span>
                      </div>
                    </div>
                  </div>

                  <div className="card p-4 sm:p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500">Project Aktif</p>
                        <h4 className="text-base font-semibold">Sedang Berjalan</h4>
                      </div>
                      <button
                        onClick={() => setActive("projects")}
                        className="text-xs font-semibold text-primary"
                      >
                        Lihat
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {projects
                        .filter((project) => project.payment_status !== "Lunas")
                        .slice(0, 4)
                        .map((project) => (
                          <div
                            key={project.id}
                            className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-ink">{project.project_name}</p>
                              <p className="truncate text-xs text-slate-500">{project.client_name}</p>
                            </div>
                            <span className={`badge ${statusBadge(project.payment_status)}`}>
                              {project.payment_status}
                            </span>
                          </div>
                        ))}
                      {projects.filter((project) => project.payment_status !== "Lunas").length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                          Tidak ada project aktif.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="card p-4 sm:p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500">Client Belum Lunas</p>
                        <h4 className="text-base font-semibold">Piutang Aktif</h4>
                      </div>
                      <button
                        onClick={() => {
                          setActive("debts");
                          setDebtTab("Piutang");
                        }}
                        className="text-xs font-semibold text-primary"
                      >
                        Lihat
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {receivableList.slice(0, 4).map((item) => (
                        <div
                          key={item.client}
                          className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{item.client}</p>
                            <p className="truncate text-xs text-slate-500">{item.project}</p>
                          </div>
                          <p className="text-sm font-semibold text-primary">{formatCurrency(item.sisa)}</p>
                        </div>
                      ))}
                      {receivableList.length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                          Semua client sudah lunas.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="hidden md:block card p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Reminder & Alert</p>
                    <h3 className="text-lg font-semibold">Pantau Deadline Penting</h3>
                  </div>
                  <span className="text-xs text-slate-400">Max 5 item</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["Semua", "Client", "Hutang", "Project"].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setReminderFilter(filter)}
                      className={`px-3 py-2 min-h-[44px] rounded-full text-xs font-semibold ${
                        reminderFilter === filter
                          ? "bg-primary text-white"
                          : "bg-white border border-slate-200 text-slate-500"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
                <div className="mt-4 space-y-3">
                  {filteredReminderItems.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                      Tidak ada reminder mendesak.
                    </div>
                  )}
                  {filteredReminderItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="text-xs text-slate-500">
                          {item.type} • {item.subtitle}
                        </p>
                        </div>
                        <span
                          className={`badge ${
                            item.status === "Overdue"
                              ? "danger"
                              : item.status === "Due Soon"
                              ? "warning"
                              : "muted"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                        <div className="text-left sm:text-right">
                        {item.amount !== null && (
                          <p className="text-sm font-semibold text-primary">
                            {formatCurrency(item.amount)}
                          </p>
                        )}
                        <p className="text-xs text-slate-400">
                          Deadline {formatDate(item.date)}
                        </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setSnoozedReminders((prev) => ({
                                ...prev,
                                [item.id]: new Date(Date.now() + 86400000)
                                  .toISOString()
                                  .slice(0, 10)
                              }))
                            }
                            className="px-2 py-1 rounded-full border border-slate-200 text-xs text-slate-600 font-semibold"
                          >
                            Snooze 1 hari
                          </button>
                          <button
                            onClick={() =>
                              setSnoozedReminders((prev) => ({
                                ...prev,
                                [item.id]: new Date(Date.now() + 7 * 86400000)
                                  .toISOString()
                                  .slice(0, 10)
                              }))
                            }
                            className="px-2 py-1 rounded-full border border-slate-200 text-xs text-slate-600 font-semibold"
                          >
                            Snooze 7 hari
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="hidden md:block card p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Cashflow Forecast</p>
                    <h3 className="text-lg font-semibold">30 Hari ke Depan</h3>
                  </div>
                  <span
                    className={`badge ${
                      forecastStatus === "Aman"
                        ? "success"
                        : forecastStatus === "Waspada"
                        ? "warning"
                        : "danger"
                    }`}
                  >
                    {forecastStatus}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="p-4 rounded-xl bg-slate-50">
                    <p className="text-xs text-slate-500">Saldo Saat Ini</p>
                    <h4 className="text-lg font-semibold text-primary">
                      {formatCurrency(currentSaldo)}
                    </h4>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50">
                    <p className="text-xs text-slate-500">Potensi Pemasukan</p>
                    <h4 className="text-lg font-semibold text-secondary">
                      {formatCurrency(totalIncoming30)}
                    </h4>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50">
                    <p className="text-xs text-slate-500">Pengeluaran Terjadwal</p>
                    <h4 className="text-lg font-semibold text-rose-600">
                      {formatCurrency(totalOutgoing30)}
                    </h4>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50">
                    <p className="text-xs text-slate-500">Forecast Saldo</p>
                    <h4 className="text-lg font-semibold text-primary">
                      {formatCurrency(forecastBalance)}
                    </h4>
                  </div>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-600">Incoming</p>
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-[420px] w-full text-sm">
                        <thead className="table-head">
                          <tr>
                            <th className="py-2 text-left">Client</th>
                            <th className="py-2 text-left">Project</th>
                            <th className="py-2 text-left">Nominal</th>
                            <th className="py-2 text-left">Deadline</th>
                          </tr>
                        </thead>
                        <tbody>
                          {forecastIncoming.length === 0 && (
                            <tr>
                              <td className="py-2 text-slate-500" colSpan={4}>
                                Tidak ada pemasukan terjadwal.
                              </td>
                            </tr>
                          )}
                          {forecastIncoming.map((item, index) => (
                            <tr key={`${item.client}-${index}`} className="border-b border-slate-100">
                              <td className="py-2 font-medium">{item.client}</td>
                              <td className="py-2">{item.project}</td>
                              <td className="py-2">{formatCurrency(item.amount)}</td>
                              <td className="py-2">{formatDate(item.date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-600">Outgoing</p>
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-[380px] w-full text-sm">
                        <thead className="table-head">
                          <tr>
                            <th className="py-2 text-left">Hutang</th>
                            <th className="py-2 text-left">Nominal</th>
                            <th className="py-2 text-left">Due date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {forecastOutgoing.length === 0 && (
                            <tr>
                              <td className="py-2 text-slate-500" colSpan={3}>
                                Tidak ada pengeluaran terjadwal.
                              </td>
                            </tr>
                          )}
                          {forecastOutgoing.map((item, index) => (
                            <tr key={`${item.lender}-${index}`} className="border-b border-slate-100">
                              <td className="py-2 font-medium">{item.lender}</td>
                              <td className="py-2">{formatCurrency(item.amount)}</td>
                              <td className="py-2">{formatDate(item.date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          <nav className="lg:hidden fixed bottom-3 left-1/2 z-50 w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-3xl border border-slate-200 bg-white/95 px-2 py-2 shadow-card backdrop-blur">
            <div className="grid grid-cols-4 gap-1">
              {MOBILE_NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className={`min-h-[46px] rounded-2xl px-1 text-[10px] font-semibold transition ${
                    active === item.id
                      ? "bg-gradient-to-r from-[#6366f1] to-[#3b82f6] text-white"
                      : "text-slate-500"
                  }`}
                >
                  <span className="block text-base leading-4">{item.icon}</span>
                  <span className="block mt-1 truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </nav>

          {active === "projects" && (
            <section className="card p-4 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">Project Berbasis Client</p>
                  <h3 className="text-lg font-semibold">Daftar Project</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    className="w-full sm:w-auto px-3 py-2 min-h-[44px] rounded-full border border-slate-200 text-sm"
                    placeholder="Search project..."
                    value={projectSearch}
                    onChange={(event) => setProjectSearch(event.target.value)}
                  />
                  <select
                    className="w-full sm:w-auto px-3 py-2 min-h-[44px] rounded-full border border-slate-200 text-sm"
                    value={projectFilter}
                    onChange={(event) => setProjectFilter(event.target.value)}
                  >
                    <option value="Semua">Semua</option>
                    <option value="Aktif">Aktif</option>
                    <option value="Lunas">Lunas</option>
                    <option value="Belum Lunas">Belum Lunas</option>
                  </select>
                  <button
                    onClick={() => openProjectForm()}
                    className="w-full sm:w-auto px-4 py-2 min-h-[44px] rounded-2xl bg-gradient-to-r from-[#6366f1] to-[#3b82f6] text-white text-sm font-semibold"
                  >
                    + Tambah Project
                  </button>
                </div>
              </div>
              <div className="mt-4 overflow-x-auto">
                <div className="space-y-3 md:hidden">
                  {filteredProjects.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                      Tidak ada project yang sesuai filter.
                    </div>
                  )}
                  {filteredProjects.map((project) => (
                    <div key={project.id} className="rounded-2xl bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink truncate">{project.project_name}</p>
                          <p className="text-xs text-slate-500 truncate">{project.client_name}</p>
                        </div>
                        <span className={`badge ${statusBadge(project.payment_status)}`}>{project.payment_status}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                        <div>
                          <p className="text-[11px]">Nilai Kontrak</p>
                          <p className="mt-0.5 font-semibold text-ink">{formatCurrency(project.contract_value)}</p>
                        </div>
                        <div>
                          <p className="text-[11px]">Sisa</p>
                          <p className="mt-0.5 font-semibold text-primary">{formatCurrency(project.remaining_payment)}</p>
                        </div>
                        <div>
                          <p className="text-[11px]">Tanggal Project</p>
                          <p className="mt-0.5 font-semibold text-ink">{formatDate(project.project_date)}</p>
                        </div>
                        <div>
                          <p className="text-[11px]">Deadline</p>
                          <p className="mt-0.5 font-semibold text-ink">{formatDate(project.payment_deadline)}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-3 text-xs">
                        <button onClick={() => setSelectedProjectId(project.id)} className="font-semibold text-primary">
                          Detail
                        </button>
                        <button onClick={() => openProjectForm(project)} className="font-semibold text-slate-500">
                          Edit
                        </button>
                        <button onClick={() => handleProjectDelete(project.id)} className="font-semibold text-rose-500">
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <table className="hidden md:table min-w-[1280px] w-full table-fixed text-sm">
                  <colgroup>
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                  </colgroup>
                  <thead className="table-head">
                    <tr>
                      <th className="px-3 py-3 text-left">Nama Client</th>
                      <th className="px-3 py-3 text-left">Nama Project</th>
                      <th className="px-3 py-3 text-left">Jenis Project</th>
                      <th className="px-3 py-3 text-left">Tanggal Project</th>
                      <th className="px-3 py-3 text-left">Nilai Kontrak</th>
                      <th className="px-3 py-3 text-left">Total Dibayar</th>
                      <th className="px-3 py-3 text-left">Sisa Pembayaran</th>
                      <th className="px-3 py-3 text-left">Status</th>
                      <th className="px-3 py-3 text-left">Deadline Pelunasan</th>
                      <th className="px-3 py-3 text-left">Profit</th>
                      <th className="px-3 py-3 text-left whitespace-nowrap">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((project) => (
                        <tr key={project.id} className="border-b border-slate-100">
                          <td className="px-3 py-3 font-medium">{project.client_name}</td>
                          <td className="px-3 py-3">{project.project_name}</td>
                          <td className="px-3 py-3">{project.project_type}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{formatDate(project.project_date)}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{formatCurrency(project.contract_value)}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{formatCurrency(project.total_paid)}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{formatCurrency(project.remaining_payment)}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`badge ${statusBadge(project.payment_status)}`}>
                                {project.payment_status}
                              </span>
                              {project.overdue && (
                                <span className="badge danger">Overdue</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">{formatDate(project.payment_deadline)}</td>
                          <td className="px-3 py-3 font-semibold text-primary whitespace-nowrap">
                            {formatCurrency(project.profit)}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-nowrap gap-2 text-xs whitespace-nowrap">
                              <button
                                onClick={() => setSelectedProjectId(project.id)}
                                className="text-primary font-semibold"
                              >
                                Detail
                              </button>
                              <button
                                onClick={() => openProjectForm(project)}
                                className="text-slate-500 font-semibold"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleProjectDelete(project.id)}
                                className="text-rose-500 font-semibold"
                              >
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedProject && (
                <div className="mt-8 border-t border-slate-100 pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Detail Project</p>
                      <h3 className="text-lg font-semibold">{selectedProject.project_name}</h3>
                    </div>
                    <button
                      onClick={() => setSelectedProjectId(null)}
                      className="text-xs text-slate-500 font-semibold"
                    >
                      Tutup Detail
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div className="p-4 rounded-xl bg-slate-50">
                      <p className="text-xs text-slate-500">Nama Client</p>
                      <p className="text-sm font-semibold">{selectedProject.client_name}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50">
                      <p className="text-xs text-slate-500">Tanggal</p>
                      <p className="text-sm font-semibold">{formatDate(selectedProject.project_date)}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50">
                      <p className="text-xs text-slate-500">Nilai Kontrak</p>
                      <p className="text-sm font-semibold">{formatCurrency(selectedProject.contract_value)}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50">
                      <p className="text-xs text-slate-500">Total Dibayar</p>
                      <p className="text-sm font-semibold">{formatCurrency(selectedProject.total_paid)}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50">
                      <p className="text-xs text-slate-500">Sisa Pembayaran</p>
                      <p className="text-sm font-semibold">{formatCurrency(selectedProject.remaining_payment)}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50">
                      <p className="text-xs text-slate-500">Total Pengeluaran</p>
                      <p className="text-sm font-semibold">{formatCurrency(selectedProject.total_expense)}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50">
                      <p className="text-xs text-slate-500">Profit</p>
                      <p className="text-sm font-semibold text-primary">
                        {formatCurrency(selectedProject.profit)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2">
                    <button
                      onClick={openInvoiceForm}
                      className="w-full sm:w-auto px-4 py-2 min-h-[44px] rounded-full bg-primary text-white text-sm font-semibold"
                    >
                      Generate Invoice
                    </button>
                  </div>

                  <div className="mt-6 grid gap-6 xl:grid-cols-2">
                    <div className="card p-4 sm:p-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Pemasukan Project</h4>
                        <button
                          onClick={() => setIncomeFormOpen((prev) => !prev)}
                          className="text-xs text-primary font-semibold"
                        >
                          + Tambah Pemasukan
                        </button>
                      </div>
                      {incomeFormOpen && (
                        <form className="mt-3 grid gap-3" onSubmit={handleAddIncome}>
                          <div className="grid gap-2 md:grid-cols-2">
                            <input
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              type="date"
                              value={incomeForm.date}
                              onChange={(event) =>
                                setIncomeForm((prev) => ({ ...prev, date: event.target.value }))
                              }
                              required
                            />
                            <select
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              value={incomeForm.type}
                              onChange={(event) =>
                                setIncomeForm((prev) => ({ ...prev, type: event.target.value }))
                              }
                            >
                              <option value="DP">DP</option>
                              <option value="Pelunasan">Pelunasan</option>
                            </select>
                            <input
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              type="number"
                              placeholder="Nominal"
                              value={incomeForm.amount}
                              onChange={(event) =>
                                setIncomeForm((prev) => ({ ...prev, amount: event.target.value }))
                              }
                              required
                            />
                            <input
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              placeholder="Metode Pembayaran"
                              value={incomeForm.method}
                              onChange={(event) =>
                                setIncomeForm((prev) => ({ ...prev, method: event.target.value }))
                              }
                            />
                          </div>
                          <input
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            placeholder="Catatan"
                            value={incomeForm.note}
                            onChange={(event) =>
                              setIncomeForm((prev) => ({ ...prev, note: event.target.value }))
                            }
                          />
                          <button className="self-start px-4 py-2 rounded-full bg-primary text-white text-xs font-semibold">
                            Simpan
                          </button>
                        </form>
                      )}
                      <div className="mt-4 overflow-x-auto">
                        <table className="min-w-[520px] w-full text-sm">
                          <thead className="table-head">
                            <tr>
                              <th className="py-2 text-left">Tanggal</th>
                              <th className="py-2 text-left">Jenis</th>
                              <th className="py-2 text-left">Nominal</th>
                              <th className="py-2 text-left">Metode</th>
                              <th className="py-2 text-left">Catatan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(selectedProject.payments || []).map((item, index) => (
                              <tr key={`${item.date}-${index}`} className="border-b border-slate-100">
                                <td className="py-2">{formatDate(item.date)}</td>
                                <td className="py-2">{item.type}</td>
                                <td className="py-2">{formatCurrency(item.amount)}</td>
                                <td className="py-2">{item.method}</td>
                                <td className="py-2 text-slate-500">{item.note}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="card p-4 sm:p-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Pengeluaran Project</h4>
                        <button
                          onClick={() => setExpenseFormOpen((prev) => !prev)}
                          className="text-xs text-primary font-semibold"
                        >
                          + Tambah Pengeluaran
                        </button>
                      </div>
                      {expenseFormOpen && (
                        <form className="mt-3 grid gap-3" onSubmit={handleAddExpense}>
                          <div className="grid gap-2 md:grid-cols-2">
                            <input
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              type="date"
                              value={expenseForm.date}
                              onChange={(event) =>
                                setExpenseForm((prev) => ({ ...prev, date: event.target.value }))
                              }
                              required
                            />
                            <select
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              value={expenseForm.category}
                              onChange={(event) =>
                                setExpenseForm((prev) => ({ ...prev, category: event.target.value }))
                              }
                            >
                              <option value="Crew">Crew</option>
                              <option value="Transport">Transport</option>
                              <option value="Sewa Alat">Sewa Alat</option>
                              <option value="Editing">Editing</option>
                              <option value="Operasional">Operasional</option>
                            </select>
                            <input
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              type="number"
                              placeholder="Nominal"
                              value={expenseForm.amount}
                              onChange={(event) =>
                                setExpenseForm((prev) => ({ ...prev, amount: event.target.value }))
                              }
                              required
                            />
                            <input
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              placeholder="Catatan"
                              value={expenseForm.note}
                              onChange={(event) =>
                                setExpenseForm((prev) => ({ ...prev, note: event.target.value }))
                              }
                            />
                          </div>
                          <button className="self-start px-4 py-2 rounded-full bg-primary text-white text-xs font-semibold">
                            Simpan
                          </button>
                        </form>
                      )}
                      <div className="mt-4 overflow-x-auto">
                        <table className="min-w-[520px] w-full text-sm">
                          <thead className="table-head">
                            <tr>
                              <th className="py-2 text-left">Tanggal</th>
                              <th className="py-2 text-left">Kategori</th>
                              <th className="py-2 text-left">Nominal</th>
                              <th className="py-2 text-left">Catatan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(selectedProject.expenses || []).map((item, index) => (
                              <tr key={`${item.date}-${index}`} className="border-b border-slate-100">
                                <td className="py-2">{formatDate(item.date)}</td>
                                <td className="py-2">{item.category}</td>
                                <td className="py-2">{formatCurrency(item.amount)}</td>
                                <td className="py-2 text-slate-500">{item.note}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isInvoiceOpen && selectedProject && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      generateInvoicePdf();
                    }}
                    className="bg-white rounded-2xl shadow-card p-6 w-full max-w-2xl"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Generate Invoice</h3>
                      <button
                        type="button"
                        onClick={() => setIsInvoiceOpen(false)}
                        className="text-sm text-slate-500"
                      >
                        Tutup
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <select
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          value={invoiceForm.type}
                          onChange={(event) => updateInvoiceAmountByType(event.target.value)}
                        >
                          <option value="DP">DP</option>
                          <option value="Pelunasan">Pelunasan</option>
                          <option value="Custom Amount">Custom Amount</option>
                        </select>
                        <input
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          type="number"
                          placeholder="Nominal"
                          value={invoiceForm.amount}
                          onChange={(event) =>
                            setInvoiceForm((prev) => ({ ...prev, amount: event.target.value }))
                          }
                          required
                        />
                        <input
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          type="date"
                          value={invoiceForm.invoice_date}
                          onChange={(event) =>
                            setInvoiceForm((prev) => ({ ...prev, invoice_date: event.target.value }))
                          }
                          required
                        />
                        <input
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          type="date"
                          value={invoiceForm.due_date}
                          onChange={(event) =>
                            setInvoiceForm((prev) => ({ ...prev, due_date: event.target.value }))
                          }
                          required
                        />
                      </div>
                      <textarea
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        rows={3}
                        placeholder="Catatan (opsional)"
                        value={invoiceForm.note}
                        onChange={(event) =>
                          setInvoiceForm((prev) => ({ ...prev, note: event.target.value }))
                        }
                      />
                      <div className="rounded-xl bg-slate-50 p-4 text-sm">
                        <p className="text-xs text-slate-500">Ringkasan Project</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span>Nama Client</span>
                          <span className="font-semibold">{selectedProject.client_name}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span>Project</span>
                          <span className="font-semibold">{selectedProject.project_name}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span>Nilai Kontrak</span>
                          <span className="font-semibold">
                            {formatCurrency(selectedProject.contract_value)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span>Total Dibayar</span>
                          <span className="font-semibold">
                            {formatCurrency(selectedProject.total_paid)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span>Sisa Pembayaran</span>
                          <span className="font-semibold text-primary">
                            {formatCurrency(selectedProject.remaining_payment)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col sm:flex-row sm:justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setIsInvoiceOpen(false)}
                        className="px-4 py-2 rounded-full border border-slate-200 text-sm"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={markInvoiceAsPaid}
                        className="px-4 py-2 rounded-full bg-secondary text-white text-sm font-semibold"
                      >
                        Mark as Paid
                      </button>
                      <button className="px-5 py-2 rounded-full bg-primary text-white text-sm font-semibold">
                        Download PDF
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </section>
          )}

          {active === "transactions" && (
            <section className="card p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">Transaksi Harian</p>
                  <h3 className="text-xl font-semibold text-primary">Pemasukan & Pengeluaran</h3>
                </div>
                <button
                  onClick={() => openTransactionForm()}
                  className="w-full sm:w-auto px-4 py-2 min-h-[44px] rounded-2xl bg-gradient-to-r from-[#6366f1] to-[#3b82f6] text-white text-sm font-semibold"
                >
                  + Tambah Transaksi
                </button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="p-4 sm:p-6 rounded-xl bg-slate-50">
                  <p className="text-xs text-slate-500">Total Pemasukan Bulan Ini</p>
                  <h4 className="text-lg font-semibold text-secondary">
                    {formatCurrency(monthlyIncome)}
                  </h4>
                </div>
                <div className="p-4 sm:p-6 rounded-xl bg-slate-50">
                  <p className="text-xs text-slate-500">Total Pengeluaran Bulan Ini</p>
                  <h4 className="text-lg font-semibold text-rose-600">
                    {formatCurrency(monthlyExpense)}
                  </h4>
                </div>
                <div className="p-4 sm:p-6 rounded-xl bg-slate-50">
                  <p className="text-xs text-slate-500">Profit Bulanan</p>
                  <h4 className="text-lg font-semibold text-primary">
                    {formatCurrency(monthlyIncome - monthlyExpense)}
                  </h4>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <input
                  className="w-full sm:w-auto px-3 py-2 min-h-[44px] rounded-full border border-slate-200 text-sm"
                  placeholder="Search transaksi..."
                  value={transactionSearch}
                  onChange={(event) => setTransactionSearch(event.target.value)}
                />
                <select
                  className="w-full sm:w-auto px-3 py-2 min-h-[44px] rounded-full border border-slate-200 text-sm"
                  value={transactionTypeFilter}
                  onChange={(event) => setTransactionTypeFilter(event.target.value)}
                >
                  <option value="Semua">Semua</option>
                  <option value="Pemasukan">Pemasukan</option>
                  <option value="Pengeluaran">Pengeluaran</option>
                </select>
                <select
                  className="w-full sm:w-auto px-3 py-2 min-h-[44px] rounded-full border border-slate-200 text-sm"
                  value={transactionMonthFilter}
                  onChange={(event) => setTransactionMonthFilter(event.target.value)}
                >
                  <option value="Semua">Semua Bulan</option>
                  {transactionMonthOptions.map((month) => (
                    <option key={month} value={month}>
                      {formatMonthLabel(month)}
                    </option>
                  ))}
                </select>
                <select
                  className="w-full sm:w-auto px-3 py-2 min-h-[44px] rounded-full border border-slate-200 text-sm"
                  value={transactionProjectFilter}
                  onChange={(event) => setTransactionProjectFilter(event.target.value)}
                >
                  <option value="Semua">Semua Project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.project_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 space-y-3 md:hidden">
                {filteredTransactions.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    Tidak ada transaksi yang sesuai filter.
                  </div>
                )}
                {filteredTransactions.map((tx) => {
                  const projectName = projects.find((project) => project.id === tx.project_id)?.project_name || "-";
                  return (
                    <div key={tx.id} className="rounded-2xl bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink truncate">{tx.category}</p>
                          <p className="text-xs text-slate-500">{formatDate(tx.date)}</p>
                        </div>
                        <span className={`badge ${tx.type === "income" ? "success" : "danger"}`}>
                          {tx.type === "income" ? "Pemasukan" : "Pengeluaran"}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-slate-500 space-y-1">
                        <p>Project: {projectName}</p>
                        <p>Metode: {tx.payment_method}</p>
                        <p>Catatan: {tx.note || "-"}</p>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <p className={`text-sm font-semibold ${tx.type === "income" ? "text-secondary" : "text-rose-600"}`}>
                          {tx.type === "income" ? "+" : "-"} {formatCurrency(tx.amount)}
                        </p>
                        <div className="flex gap-3 text-xs">
                          <button onClick={() => openTransactionForm(tx)} className="font-semibold text-primary">
                            Edit
                          </button>
                          <button onClick={() => handleTransactionDelete(tx)} className="font-semibold text-rose-500">
                            Hapus
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 hidden md:block overflow-x-auto">
                <table className="min-w-[900px] w-full text-sm">
                  <thead className="table-head">
                    <tr>
                      <th className="py-3 text-left">Tanggal</th>
                      <th className="py-3 text-left">Jenis</th>
                      <th className="py-3 text-left">Kategori</th>
                      <th className="py-3 text-left">Project</th>
                      <th className="py-3 text-left">Catatan</th>
                      <th className="py-3 text-left">Metode</th>
                      <th className="py-3 text-left">Nominal</th>
                      <th className="py-3 text-left">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((tx) => {
                      const projectName =
                        projects.find((project) => project.id === tx.project_id)?.project_name || "-";
                      return (
                        <tr key={tx.id} className="border-b border-slate-100">
                          <td className="py-3">{formatDate(tx.date)}</td>
                          <td className="py-3">
                            <span className={`badge ${tx.type === "income" ? "success" : "danger"}`}>
                              {tx.type === "income" ? "Pemasukan" : "Pengeluaran"}
                            </span>
                          </td>
                          <td className="py-3">{tx.category}</td>
                          <td className="py-3">{projectName}</td>
                          <td className="py-3 text-slate-500">{tx.note || "-"}</td>
                          <td className="py-3">{tx.payment_method}</td>
                          <td className="py-3 font-semibold text-primary">{formatCurrency(tx.amount)}</td>
                          <td className="py-3">
                            <div className="flex gap-2 text-xs">
                              <button onClick={() => openTransactionForm(tx)} className="text-primary font-semibold">
                                Edit
                              </button>
                              <button onClick={() => handleTransactionDelete(tx)} className="text-rose-500 font-semibold">
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {isTransactionFormOpen && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
                  <form
                    onSubmit={handleTransactionSubmit}
                    className="bg-white rounded-2xl shadow-card p-6 w-full max-w-2xl"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">
                        {editingTransaction ? "Edit Transaksi" : "Tambah Transaksi"}
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setIsTransactionFormOpen(false);
                          resetTransactionForm();
                        }}
                        className="text-sm text-slate-500"
                      >
                        Tutup
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4">
                      <div>
                        <p className="text-xs text-slate-500 mb-2">Informasi Dasar</p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <input
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            type="date"
                            value={transactionForm.date}
                            onChange={(event) =>
                              setTransactionForm((prev) => ({ ...prev, date: event.target.value }))
                            }
                            required
                          />
                          <select
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            value={transactionForm.type}
                            onChange={(event) =>
                              setTransactionForm((prev) => ({
                                ...prev,
                                type: event.target.value,
                                category: event.target.value === "income" ? "DP" : "Crew"
                              }))
                            }
                          >
                            <option value="income">Pemasukan</option>
                            <option value="expense">Pengeluaran</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500 mb-2">Relasi Project</p>
                        <select
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-full"
                          value={transactionForm.project_id}
                          onChange={(event) =>
                            setTransactionForm((prev) => ({ ...prev, project_id: event.target.value }))
                          }
                        >
                          <option value="">Tanpa Project</option>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.project_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500 mb-2">Kategori</p>
                        <select
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-full"
                          value={transactionForm.category}
                          onChange={(event) =>
                            setTransactionForm((prev) => ({ ...prev, category: event.target.value }))
                          }
                        >
                          {transactionForm.type === "income" ? (
                            <>
                              <option value="DP">DP</option>
                              <option value="Pelunasan">Pelunasan</option>
                              <option value="Lainnya">Lainnya</option>
                            </>
                          ) : (
                            <>
                              <option value="Crew">Crew</option>
                              <option value="Transport">Transport</option>
                              <option value="Konsumsi">Konsumsi</option>
                              <option value="Sewa Alat">Sewa Alat</option>
                              <option value="Editing / Outsource">Editing / Outsource</option>
                              <option value="Operasional">Operasional</option>
                              <option value="Equipment / Gear">Equipment / Gear</option>
                              <option value="Marketing">Marketing</option>
                              <option value="Lainnya">Lainnya</option>
                            </>
                          )}
                        </select>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500 mb-2">Detail Tambahan</p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <select
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            value={transactionForm.payment_method}
                            onChange={(event) =>
                              setTransactionForm((prev) => ({
                                ...prev,
                                payment_method: event.target.value
                              }))
                            }
                          >
                            <option>Transfer</option>
                            <option>Cash</option>
                            <option>E-Wallet</option>
                          </select>
                          <input
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            type="number"
                            placeholder="Nominal"
                            value={transactionForm.amount}
                            onChange={(event) =>
                              setTransactionForm((prev) => ({ ...prev, amount: event.target.value }))
                            }
                            required
                          />
                        </div>
                        <input
                          className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          placeholder="Catatan"
                          value={transactionForm.note}
                          onChange={(event) =>
                            setTransactionForm((prev) => ({ ...prev, note: event.target.value }))
                          }
                        />
                        <input
                          className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          type="file"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            setTransactionForm((prev) => ({
                              ...prev,
                              proof_url: URL.createObjectURL(file)
                            }));
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setIsTransactionFormOpen(false);
                          resetTransactionForm();
                        }}
                        className="px-4 py-2 rounded-full border border-slate-200 text-sm"
                      >
                        Batal
                      </button>
                      <button className="px-5 py-2 rounded-full bg-primary text-white text-sm font-semibold">
                        Simpan
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </section>
          )}

          {active === "debts" && (
            <section className="grid gap-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">Hutang & Piutang</p>
                  <h3 className="text-lg font-semibold">Manajemen Cashflow</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setDebtTab("Hutang")}
                    className={`w-full sm:w-auto px-4 py-2 min-h-[44px] rounded-full text-sm font-semibold ${
                      debtTab === "Hutang"
                        ? "bg-primary text-white"
                        : "bg-white border border-slate-200 text-slate-500"
                    }`}
                  >
                    Hutang
                  </button>
                  <button
                    onClick={() => setDebtTab("Piutang")}
                    className={`w-full sm:w-auto px-4 py-2 min-h-[44px] rounded-full text-sm font-semibold ${
                      debtTab === "Piutang"
                        ? "bg-primary text-white"
                        : "bg-white border border-slate-200 text-slate-500"
                    }`}
                  >
                    Piutang
                  </button>
                  {debtTab === "Hutang" && (
                    <>
                      <button
                        onClick={() => exportDebtPdf()}
                        className="w-full sm:w-auto px-4 py-2 min-h-[44px] rounded-full border border-slate-200 text-sm font-semibold"
                      >
                        Export PDF
                      </button>
                      <button
                        onClick={() => exportDebtCsv()}
                        className="w-full sm:w-auto px-4 py-2 min-h-[44px] rounded-full border border-slate-200 text-sm font-semibold"
                      >
                        Export Excel
                      </button>
                      <button
                        onClick={() => openDebtForm()}
                        className="w-full sm:w-auto px-4 py-2 min-h-[44px] rounded-full bg-secondary text-white text-sm font-semibold"
                      >
                        + Tambah Hutang
                      </button>
                    </>
                  )}
                  {debtTab === "Piutang" && (
                    <>
                      <button
                        onClick={() => exportReceivablePdf()}
                        className="w-full sm:w-auto px-4 py-2 min-h-[44px] rounded-full border border-slate-200 text-sm font-semibold"
                      >
                        Export PDF
                      </button>
                      <button
                        onClick={() => exportReceivableCsv()}
                        className="w-full sm:w-auto px-4 py-2 min-h-[44px] rounded-full border border-slate-200 text-sm font-semibold"
                      >
                        Export Excel
                      </button>
                    </>
                  )}
                </div>
              </div>

              {debtTab === "Hutang" && (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 rounded-xl bg-slate-50">
                      <p className="text-xs text-slate-500">Total Hutang</p>
                      <h4 className="text-lg font-semibold text-primary">
                        {formatCurrency(debtTotals.total)}
                      </h4>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50">
                      <p className="text-xs text-slate-500">Total Sisa Hutang</p>
                      <h4 className="text-lg font-semibold text-blue-600">
                        {formatCurrency(debtTotals.remaining)}
                      </h4>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50">
                      <p className="text-xs text-slate-500">Hutang Jatuh Tempo</p>
                      <h4 className="text-lg font-semibold text-rose-600">
                        {formatCurrency(debtTotals.overdue)}
                      </h4>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {["Semua", "Aktif", "Lunas", "Overdue"].map((status) => (
                      <button
                        key={status}
                        onClick={() => setDebtFilter(status)}
                        className={`px-4 py-2 rounded-full text-xs font-semibold ${
                          debtFilter === status
                            ? "bg-primary text-white"
                            : "bg-white border border-slate-200 text-slate-500"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>

                  <div className="card p-4 sm:p-6">
                    <div className="mt-2 space-y-3 md:hidden">
                      {filteredDebts.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                          Tidak ada data hutang untuk filter ini.
                        </div>
                      )}
                      {filteredDebts.map((item) => (
                        <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-ink">{item.lender_name}</p>
                              <p className="text-xs text-slate-500">{item.category}</p>
                            </div>
                            <span className={`badge ${statusBadge(item.status)}`}>{item.status}</span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                            <div>
                              <p>Total</p>
                              <p className="mt-0.5 font-semibold text-ink">{formatCurrency(item.total_amount)}</p>
                            </div>
                            <div>
                              <p>Sisa</p>
                              <p className="mt-0.5 font-semibold text-primary">{formatCurrency(item.remaining_amount)}</p>
                            </div>
                            <div>
                              <p>Dibayar</p>
                              <p className="mt-0.5 font-semibold text-ink">{formatCurrency(item.paid_amount)}</p>
                            </div>
                            <div>
                              <p>Due Date</p>
                              <p className="mt-0.5 font-semibold text-ink">{formatDate(item.due_date)}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex gap-3 text-xs">
                            <button onClick={() => openDebtForm(item)} className="font-semibold text-primary">
                              Edit
                            </button>
                            <button onClick={() => handleDebtDelete(item.id)} className="font-semibold text-rose-500">
                              Hapus
                            </button>
                            <button onClick={() => openDebtPayment(item)} className="font-semibold text-blue-600">
                              Bayar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 overflow-x-auto">
                      <table className="hidden md:table min-w-[860px] w-full text-sm">
                        <thead className="table-head">
                          <tr>
                            <th className="py-3 text-left">Tanggal</th>
                            <th className="py-3 text-left">Kepada</th>
                            <th className="py-3 text-left">Kategori</th>
                            <th className="py-3 text-left">Total</th>
                            <th className="py-3 text-left">Dibayar</th>
                            <th className="py-3 text-left">Sisa</th>
                            <th className="py-3 text-left">Jatuh Tempo</th>
                            <th className="py-3 text-left">Status</th>
                            <th className="py-3 text-left">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDebts.map((item) => (
                              <tr key={item.id} className="border-b border-slate-100">
                                <td className="py-3">{formatDate(item.date)}</td>
                                <td className="py-3 font-medium">{item.lender_name}</td>
                                <td className="py-3">{item.category}</td>
                                <td className="py-3">{formatCurrency(item.total_amount)}</td>
                                <td className="py-3">{formatCurrency(item.paid_amount)}</td>
                                <td className="py-3">{formatCurrency(item.remaining_amount)}</td>
                                <td className="py-3">{formatDate(item.due_date)}</td>
                                <td className="py-3">
                                  <span className={`badge ${statusBadge(item.status)}`}>{item.status}</span>
                                </td>
                                <td className="py-3">
                                  <div className="flex gap-2 text-xs">
                                    <button
                                      onClick={() => openDebtForm(item)}
                                      className="text-primary font-semibold"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDebtDelete(item.id)}
                                      className="text-rose-500 font-semibold"
                                    >
                                      Hapus
                                    </button>
                                    <button
                                      onClick={() => openDebtPayment(item)}
                                      className="text-blue-600 font-semibold"
                                    >
                                      Bayar
                                    </button>
                                  </div>
                                </td>
                              </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="card p-4 sm:p-6">
                    <p className="text-sm text-slate-500">Riwayat Pembayaran</p>
                    <h3 className="text-lg font-semibold">History Hutang</h3>
                    <div className="mt-3 space-y-2 md:hidden">
                      {debtPaymentHistory.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                          Belum ada pembayaran hutang.
                        </div>
                      )}
                      {debtPaymentHistory.map((payment) => (
                        <div key={payment.id} className="rounded-2xl bg-slate-50 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">{payment.lender_name}</p>
                            <p className="text-xs text-slate-500">{formatDate(payment.payment_date)}</p>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-primary">{formatCurrency(payment.amount)}</p>
                          <p className="text-xs text-slate-500">{payment.method} • {payment.note || "-"}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="hidden md:table min-w-[720px] w-full text-sm">
                        <thead className="table-head">
                          <tr>
                            <th className="py-2 text-left">Kepada</th>
                            <th className="py-2 text-left">Tanggal</th>
                            <th className="py-2 text-left">Nominal</th>
                            <th className="py-2 text-left">Metode</th>
                            <th className="py-2 text-left">Catatan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {debtPaymentHistory.length === 0 && (
                            <tr>
                              <td className="py-3 text-slate-500" colSpan={5}>
                                Belum ada pembayaran hutang.
                              </td>
                            </tr>
                          )}
                          {debtPaymentHistory.map((payment) => (
                              <tr key={payment.id} className="border-b border-slate-100">
                                <td className="py-2 font-medium">{payment.lender_name}</td>
                                <td className="py-2">{formatDate(payment.payment_date)}</td>
                                <td className="py-2">{formatCurrency(payment.amount)}</td>
                                <td className="py-2">{payment.method}</td>
                                <td className="py-2 text-slate-500">{payment.note || "-"}</td>
                              </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {debtTab === "Piutang" && (
                <div className="card p-4 sm:p-6">
                  <div className="mt-2 space-y-3 md:hidden">
                    {receivableList.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                        Tidak ada data piutang.
                      </div>
                    )}
                    {receivableList.map((item) => {
                      const overdue = item.jatuhTempo < new Date().toISOString().slice(0, 10);
                      return (
                        <div key={item.client} className="rounded-2xl bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-ink">{item.client}</p>
                              <p className="text-xs text-slate-500 truncate">{item.project}</p>
                            </div>
                            <span className={`badge ${statusBadge(item.status)}`}>{item.status}</span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                            <div>
                              <p>Kontrak</p>
                              <p className="mt-0.5 font-semibold text-ink">{formatCurrency(item.total)}</p>
                            </div>
                            <div>
                              <p>Sisa</p>
                              <p className="mt-0.5 font-semibold text-primary">{formatCurrency(item.sisa)}</p>
                            </div>
                            <div>
                              <p>Dibayar</p>
                              <p className="mt-0.5 font-semibold text-ink">{formatCurrency(item.dibayar)}</p>
                            </div>
                            <div>
                              <p>Deadline</p>
                              <p className="mt-0.5 font-semibold text-ink">{formatDate(item.jatuhTempo)}</p>
                            </div>
                          </div>
                          {overdue && <span className="mt-2 inline-flex badge danger">Overdue</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 overflow-x-auto">
                    <table className="hidden md:table min-w-[760px] w-full text-sm">
                      <thead className="table-head">
                        <tr>
                          <th className="py-3 text-left">Client</th>
                          <th className="py-3 text-left">Project</th>
                          <th className="py-3 text-left">Nilai Kontrak</th>
                          <th className="py-3 text-left">Total Dibayar</th>
                          <th className="py-3 text-left">Sisa Pembayaran</th>
                          <th className="py-3 text-left">Deadline Pelunasan</th>
                          <th className="py-3 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receivableList.map((item) => {
                          const overdue = item.jatuhTempo < new Date().toISOString().slice(0, 10);
                          return (
                            <tr key={item.client} className="border-b border-slate-100">
                              <td className="py-3 font-medium">{item.client}</td>
                              <td className="py-3">{item.project}</td>
                              <td className="py-3">{formatCurrency(item.total)}</td>
                              <td className="py-3">{formatCurrency(item.dibayar)}</td>
                              <td className="py-3">{formatCurrency(item.sisa)}</td>
                              <td className="py-3">{formatDate(item.jatuhTempo)}</td>
                              <td className="py-3">
                                <div className="flex items-center gap-2">
                                  <span className={`badge ${statusBadge(item.status)}`}>{item.status}</span>
                                  {overdue && <span className="badge danger">Overdue</span>}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {isDebtFormOpen && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
                  <form
                    onSubmit={handleDebtSubmit}
                    className="bg-white rounded-2xl shadow-card p-6 w-full max-w-2xl"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">
                        {editingDebt ? "Edit Hutang" : "Tambah Hutang"}
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDebtFormOpen(false);
                          resetDebtForm();
                        }}
                        className="text-sm text-slate-500"
                      >
                        Tutup
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          type="date"
                          value={debtForm.date}
                          onChange={(event) =>
                            setDebtForm((prev) => ({ ...prev, date: event.target.value }))
                          }
                          required
                        />
                        <input
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          placeholder="Kepada siapa"
                          value={debtForm.lender_name}
                          onChange={(event) =>
                            setDebtForm((prev) => ({ ...prev, lender_name: event.target.value }))
                          }
                          required
                        />
                        <select
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          value={debtForm.category}
                          onChange={(event) =>
                            setDebtForm((prev) => ({ ...prev, category: event.target.value }))
                          }
                        >
                          {DEBT_CATEGORY_OPTIONS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                        <input
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          type="number"
                          placeholder="Total Hutang"
                          value={debtForm.total_amount}
                          onChange={(event) =>
                            setDebtForm((prev) => ({ ...prev, total_amount: event.target.value }))
                          }
                          required
                        />
                        <div className="grid gap-1">
                          <p className="text-xs text-slate-500">Sudah Dibayar (default 0)</p>
                          <input
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            type="number"
                            min="0"
                            placeholder="0"
                            value={debtForm.paid_amount}
                            onChange={(event) =>
                              setDebtForm((prev) => ({ ...prev, paid_amount: event.target.value }))
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <p className="text-xs text-slate-500">Jatuh Tempo (opsional)</p>
                          <input
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            type="date"
                            value={debtForm.due_date}
                            onChange={(event) =>
                              setDebtForm((prev) => ({ ...prev, due_date: event.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <input
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Catatan"
                        value={debtForm.note}
                        onChange={(event) =>
                          setDebtForm((prev) => ({ ...prev, note: event.target.value }))
                        }
                      />
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setIsDebtFormOpen(false);
                          resetDebtForm();
                        }}
                        className="px-4 py-2 rounded-full border border-slate-200 text-sm"
                      >
                        Batal
                      </button>
                      <button className="px-5 py-2 rounded-full bg-primary text-white text-sm font-semibold">
                        Simpan
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {isDebtPaymentOpen && selectedDebt && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
                  <form
                    onSubmit={handleDebtPayment}
                    className="bg-white rounded-2xl shadow-card p-6 w-full max-w-lg"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Bayar Hutang</h3>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDebtPaymentOpen(false);
                          setSelectedDebt(null);
                        }}
                        className="text-sm text-slate-500"
                      >
                        Tutup
                      </button>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">{selectedDebt.lender_name}</p>
                    <div className="mt-4 grid gap-3">
                      <input
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        type="date"
                        value={debtPaymentForm.payment_date}
                        onChange={(event) =>
                          setDebtPaymentForm((prev) => ({
                            ...prev,
                            payment_date: event.target.value
                          }))
                        }
                        required
                      />
                      <input
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        type="number"
                        placeholder="Nominal bayar"
                        value={debtPaymentForm.amount}
                        onChange={(event) =>
                          setDebtPaymentForm((prev) => ({ ...prev, amount: event.target.value }))
                        }
                        required
                      />
                      <select
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={debtPaymentForm.method}
                        onChange={(event) =>
                          setDebtPaymentForm((prev) => ({ ...prev, method: event.target.value }))
                        }
                      >
                        <option>Transfer</option>
                        <option>Cash</option>
                        <option>E-Wallet</option>
                      </select>
                      <input
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Catatan"
                        value={debtPaymentForm.note}
                        onChange={(event) =>
                          setDebtPaymentForm((prev) => ({ ...prev, note: event.target.value }))
                        }
                      />
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setIsDebtPaymentOpen(false);
                          setSelectedDebt(null);
                        }}
                        className="px-4 py-2 rounded-full border border-slate-200 text-sm"
                      >
                        Batal
                      </button>
                      <button className="px-5 py-2 rounded-full bg-primary text-white text-sm font-semibold">
                        Simpan
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </section>
          )}

          {active === "reports" && summary && (
            <section className="card p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Laporan Bulanan</p>
                  <h3 className="text-lg font-semibold">Ringkasan {reportMonthLabel}</h3>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={exportMonthlyReportPdf}
                    className="px-3 py-2 rounded-full border border-slate-200 text-xs font-semibold"
                  >
                    Export PDF
                  </button>
                  <button
                    onClick={exportMonthlyReportCsv}
                    className="px-3 py-2 rounded-full border border-slate-200 text-xs font-semibold"
                  >
                    Export Excel
                  </button>
                </div>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-xl bg-slate-50">
                  <p className="text-xs text-slate-500">Total Pemasukan</p>
                  <h4 className="text-lg font-semibold text-secondary">
                    {formatCurrency(summary.pemasukan)}
                  </h4>
                </div>
                <div className="p-4 rounded-xl bg-slate-50">
                  <p className="text-xs text-slate-500">Total Pengeluaran</p>
                  <h4 className="text-lg font-semibold text-amber-600">
                    {formatCurrency(summary.pengeluaran)}
                  </h4>
                </div>
                <div className="p-4 rounded-xl bg-slate-50">
                  <p className="text-xs text-slate-500">Profit Bulanan</p>
                  <h4 className="text-lg font-semibold text-primary">
                    {formatCurrency(summary.profit)}
                  </h4>
                </div>
              </div>
            </section>
          )}

          {active === "analytics" && analytics && (
            <section className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
              <div className="card p-4 sm:p-6">
                <p className="text-sm text-slate-500">Profit per Bulan</p>
                <h3 className="text-lg font-semibold">Trend Profit</h3>
                <div className="mt-4 grid grid-cols-5 gap-3">
                  {analytics.profitPerBulan.map((value, index) => (
                    <div
                      key={`${analytics.profitLabels?.[index] || index}-${value}`}
                      className="flex flex-col items-center justify-end h-32 rounded-xl bg-slate-50"
                    >
                      <div
                        className="w-8 rounded-t-xl bg-primary"
                        style={{ height: `${Math.min(100, (value / 60000000) * 100)}%` }}
                      ></div>
                      <span className="text-[10px] text-slate-400 mt-2">
                        {analytics.profitLabels?.[index] || `B${index + 1}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card p-4 sm:p-6">
                <p className="text-sm text-slate-500">Pengeluaran per Kategori</p>
                <h3 className="text-lg font-semibold">Kategori Terbesar</h3>
                <div className="mt-4 space-y-3">
                  {(() => {
                    const maxCategory = Math.max(
                      ...analytics.pengeluaranKategori.map((item) => item.nilai || 0),
                      1
                    );
                    return analytics.pengeluaranKategori.map((item) => (
                      <div key={item.kategori}>
                        <div className="flex items-center justify-between text-sm">
                          <span>{item.kategori}</span>
                          <span className="font-semibold text-primary">{formatCurrency(item.nilai)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 mt-2">
                          <div
                            className="h-2 rounded-full bg-secondary"
                            style={{ width: `${Math.min(100, (item.nilai / maxCategory) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
              <div className="card p-4 sm:p-6 xl:col-span-2">
                <p className="text-sm text-slate-500">Project Paling Menguntungkan</p>
                <h3 className="text-lg font-semibold">Top Projects</h3>
                <div className="mt-4 grid md:grid-cols-3 gap-4">
                  {analytics.topProjects.map((item) => (
                    <div key={item.project} className="p-4 rounded-xl bg-slate-50">
                      <p className="text-sm font-semibold">{item.project}</p>
                      <p className="text-xs text-slate-400 mt-1">Profit</p>
                      <p className="text-lg font-semibold text-primary">{formatCurrency(item.profit)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {active === "profile" && (
            <section className="grid gap-6">
              <div className="card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">Data Bisnis</h3>
                    <p className="text-sm text-slate-500 mt-2">
                      Kelola profil bisnis untuk branding dan informasi akun.
                    </p>
                  </div>
                  <button
                    onClick={handleProfileEditToggle}
                    disabled={profileSaving}
                    className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-primary disabled:opacity-60"
                  >
                    {profileSaving ? "Menyimpan..." : isEditingProfile ? "Simpan Profil" : "Edit Profil"}
                  </button>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-xl bg-slate-50">
                  <p className="text-xs text-slate-500">Nama Bisnis</p>
                  {isEditingProfile ? (
                    <input
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={profileData.businessName}
                      onChange={(event) =>
                        setProfileData((prev) => ({ ...prev, businessName: event.target.value }))
                      }
                    />
                  ) : (
                    <p className="text-sm font-semibold">{profileData.businessName}</p>
                  )}
                </div>
                <div className="p-4 rounded-xl bg-slate-50">
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="text-sm font-semibold">{session?.user?.email || profileData.email}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50">
                  <p className="text-xs text-slate-500">Nomor Telepon</p>
                  {isEditingProfile ? (
                    <input
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={profileData.phone}
                      onChange={(event) =>
                        setProfileData((prev) => ({ ...prev, phone: event.target.value }))
                      }
                    />
                  ) : (
                    <p className="text-sm font-semibold">{profileData.phone}</p>
                  )}
                </div>
                <div className="p-4 rounded-xl bg-slate-50">
                  <p className="text-xs text-slate-500">Industri</p>
                  {isEditingProfile ? (
                    <input
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={profileData.industry}
                      onChange={(event) =>
                        setProfileData((prev) => ({ ...prev, industry: event.target.value }))
                      }
                    />
                  ) : (
                    <p className="text-sm font-semibold">{profileData.industry}</p>
                  )}
                </div>
                <div className="p-4 rounded-xl bg-slate-50">
                  <p className="text-xs text-slate-500">Kota</p>
                  {isEditingProfile ? (
                    <input
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={profileData.city}
                      onChange={(event) =>
                        setProfileData((prev) => ({ ...prev, city: event.target.value }))
                      }
                    />
                  ) : (
                    <p className="text-sm font-semibold">{profileData.city}</p>
                  )}
                </div>
                <div className="p-4 rounded-xl bg-slate-50">
                  <p className="text-xs text-slate-500">Rekening Utama</p>
                  {isEditingProfile ? (
                    <input
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={profileData.bankAccount}
                      onChange={(event) =>
                        setProfileData((prev) => ({ ...prev, bankAccount: event.target.value }))
                      }
                    />
                  ) : (
                    <p className="text-sm font-semibold">{profileData.bankAccount}</p>
                  )}
                </div>
                <div className="p-4 rounded-xl bg-slate-50 md:col-span-2">
                  <p className="text-xs text-slate-500">NPWP</p>
                  {isEditingProfile ? (
                    <input
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={profileData.taxId}
                      onChange={(event) =>
                        setProfileData((prev) => ({ ...prev, taxId: event.target.value }))
                      }
                    />
                  ) : (
                    <p className="text-sm font-semibold">{profileData.taxId}</p>
                  )}
                </div>
                </div>
              </div>
              <div className="card p-6">
                <p className="text-xs text-slate-500">Keamanan Akun</p>
                <h4 className="text-sm font-semibold mt-1">
                  {isGoogleAccount ? "Set / Update Password" : "Ganti Password"}
                </h4>
                <form onSubmit={handlePasswordUpdate} className="mt-3 grid gap-3 md:grid-cols-2">
                  {!isGoogleAccount && (
                    <input
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm md:col-span-2"
                      type="password"
                      placeholder="Password saat ini"
                      value={passwordForm.currentPassword}
                      onChange={(event) =>
                        setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                      }
                      required
                    />
                  )}
                  <input
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    type="password"
                    placeholder={isGoogleAccount ? "Password baru untuk akun ini" : "Password baru"}
                    value={passwordForm.newPassword}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                    }
                    required={!isGoogleAccount}
                  />
                  <input
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    type="password"
                    placeholder="Konfirmasi password baru"
                    value={passwordForm.confirmPassword}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                    }
                    required={!isGoogleAccount}
                  />
                  {isGoogleAccount && (
                    <p className="text-xs text-slate-500 md:col-span-2">
                      Untuk login Google, klik tombol di bawah untuk kirim link reset password ke email akun.
                    </p>
                  )}
                  <div className="md:col-span-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={passwordLoading}
                      className="px-4 py-2 rounded-full bg-primary text-white text-xs font-semibold disabled:opacity-60"
                    >
                      {passwordLoading
                        ? "Menyimpan..."
                        : isGoogleAccount
                        ? "Kirim Email Reset Password"
                        : "Update Password"}
                    </button>
                  </div>
                </form>
              </div>
              <div className="card p-6">
                <button
                  onClick={handleLogout}
                  className="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 px-4 py-3 text-sm font-semibold text-white"
                >
                  Logout
                </button>
              </div>
            </section>
          )}
        </div>
      </main>

      {isProjectFormOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleProjectSubmit}
            className="bg-white rounded-2xl shadow-card p-6 w-full max-w-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editingProject ? "Edit Project" : "Tambah Project"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsProjectFormOpen(false);
                  resetProjectForm();
                }}
                className="text-sm text-slate-500"
              >
                Tutup
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-2">Informasi Client</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Nama Client"
                    value={projectForm.client_name}
                    onChange={(event) =>
                      setProjectForm((prev) => ({ ...prev, client_name: event.target.value }))
                    }
                    required
                  />
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="No. HP (opsional)"
                    value={projectForm.phone}
                    onChange={(event) =>
                      setProjectForm((prev) => ({ ...prev, phone: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-2">Informasi Project</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Nama Project"
                    value={projectForm.project_name}
                    onChange={(event) =>
                      setProjectForm((prev) => ({ ...prev, project_name: event.target.value }))
                    }
                    required
                  />
                  <QuickSelect
                    id="projectType"
                    label="Pilih jenis project"
                    value={projectForm.project_type}
                    options={[
                      { value: "Wedding", label: "Wedding" },
                      { value: "Event", label: "Event" },
                      { value: "Prewedding", label: "Prewedding" },
                      { value: "Jasa Kreatif", label: "Jasa Kreatif" },
                      { value: "Other", label: "Other" }
                    ]}
                    onChange={(value) =>
                      setProjectForm((prev) => ({ ...prev, project_type: value }))
                    }
                  />
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    type="date"
                    value={projectForm.project_date}
                    onChange={(event) =>
                      setProjectForm((prev) => ({ ...prev, project_date: event.target.value }))
                    }
                    required
                  />
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Lokasi (opsional)"
                    value={projectForm.location}
                    onChange={(event) =>
                      setProjectForm((prev) => ({ ...prev, location: event.target.value }))
                    }
                  />
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    type="number"
                    placeholder="Nilai Kontrak"
                    value={projectForm.contract_value}
                    onChange={(event) =>
                      setProjectForm((prev) => ({ ...prev, contract_value: event.target.value }))
                    }
                    required
                  />
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    type="date"
                    placeholder="Deadline Pelunasan"
                    value={projectForm.payment_deadline}
                    onChange={(event) =>
                      setProjectForm((prev) => ({ ...prev, payment_deadline: event.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-2">Informasi Pembayaran Awal</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    type="number"
                    placeholder="DP (opsional)"
                    value={projectForm.dp}
                    onChange={(event) =>
                      setProjectForm((prev) => ({ ...prev, dp: event.target.value }))
                    }
                  />
                  <QuickSelect
                    id="projectPayMethod"
                    label="Metode Pembayaran"
                    value={projectForm.payment_method}
                    options={[
                      { value: "Transfer", label: "Transfer" },
                      { value: "Cash", label: "Cash" },
                      { value: "E-Wallet", label: "E-Wallet" }
                    ]}
                    onChange={(value) =>
                      setProjectForm((prev) => ({ ...prev, payment_method: value }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsProjectFormOpen(false);
                  resetProjectForm();
                }}
                className="px-4 py-2 rounded-full border border-slate-200 text-sm"
              >
                Batal
              </button>
              <button className="px-5 py-2 rounded-full bg-primary text-white text-sm font-semibold">
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 right-4 z-50 bg-white border border-slate-200 shadow-sm rounded-xl p-4 max-w-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-primary">Notifikasi</p>
              <p className="text-xs text-slate-500 mt-1">{toast.message}</p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="h-8 w-8 rounded-full border border-slate-200 grid place-items-center text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {showOverdueToast && totalOverdueCount > 0 && (
        <div className="fixed top-4 right-4 z-50 bg-white border border-slate-200 shadow-sm rounded-xl p-4 max-w-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-rose-600">Reminder</p>
              <p className="text-xs text-slate-500 mt-1">
                You have {totalOverdueCount} overdue payments.
              </p>
            </div>
            <button
              onClick={() => setShowOverdueToast(false)}
              className="h-8 w-8 rounded-full border border-slate-200 grid place-items-center text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {isQuickAddOpen && (
        <div
          className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center p-4 z-50"
          onClick={() => setIsQuickAddOpen(false)}
        >
          <form
            onSubmit={handleQuickAddSubmit}
            onClick={(event) => event.stopPropagation()}
            className="bg-white w-full max-w-sm sm:rounded-2xl rounded-t-3xl shadow-card p-5 sm:p-6 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Quick Add</h3>
              <button
                type="button"
                onClick={() => setIsQuickAddOpen(false)}
                className="text-sm text-slate-500"
              >
                Tutup
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              <QuickSelect
                id="type"
                label="Pilih jenis"
                value={quickAddForm.type}
                options={[
                  { value: "income", label: "Pemasukan" },
                  { value: "expense", label: "Pengeluaran" }
                ]}
                onChange={(value) =>
                  setQuickAddForm((prev) => ({
                    ...prev,
                    type: value,
                    category: value === "income" ? "DP" : "Crew"
                  }))
                }
              />
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                type="number"
                placeholder="Nominal"
                value={quickAddForm.amount}
                onChange={(event) =>
                  setQuickAddForm((prev) => ({ ...prev, amount: event.target.value }))
                }
                required
              />
              <QuickSelect
                id="category"
                label="Pilih kategori"
                value={quickAddForm.category}
                options={
                  quickAddForm.type === "income"
                    ? [
                        { value: "DP", label: "DP" },
                        { value: "Pelunasan", label: "Pelunasan" },
                        { value: "Lainnya", label: "Lainnya" }
                      ]
                    : [
                        { value: "Crew", label: "Crew" },
                        { value: "Transport", label: "Transport" },
                        { value: "Konsumsi", label: "Konsumsi" },
                        { value: "Sewa Alat", label: "Sewa Alat" },
                        { value: "Editing / Outsource", label: "Editing / Outsource" },
                        { value: "Operasional", label: "Operasional" },
                        { value: "Equipment / Gear", label: "Equipment / Gear" },
                        { value: "Marketing", label: "Marketing" },
                        { value: "Lainnya", label: "Lainnya" }
                      ]
                }
                onChange={(value) =>
                  setQuickAddForm((prev) => ({ ...prev, category: value }))
                }
              />
              <QuickSelect
                id="project"
                label="Tanpa Project"
                value={quickAddForm.project_id}
                options={[
                  { value: "", label: "Tanpa Project" },
                  ...projects.map((project) => ({
                    value: project.id,
                    label: project.project_name
                  }))
                ]}
                onChange={(value) =>
                  setQuickAddForm((prev) => ({ ...prev, project_id: value }))
                }
              />
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                type="date"
                value={quickAddForm.date}
                onChange={(event) =>
                  setQuickAddForm((prev) => ({ ...prev, date: event.target.value }))
                }
                required
              />
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Catatan (opsional)"
                value={quickAddForm.note}
                onChange={(event) =>
                  setQuickAddForm((prev) => ({ ...prev, note: event.target.value }))
                }
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsQuickAddOpen(false)}
                className="px-4 py-2 rounded-full border border-slate-200 text-sm"
              >
                Batal
              </button>
              <button className="px-4 py-2 rounded-full bg-primary text-white text-sm font-semibold">
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mobile action bar removed in favor of FAB menu */}
    </div>
  );
}
