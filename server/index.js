import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();
const port = 5001;
const JWT_SECRET = process.env.JWT_SECRET || "finora-dev-secret";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, "data.json");

app.use(cors());
app.use(express.json());

const readData = () => {
  const raw = fs.readFileSync(dataPath, "utf-8");
  return JSON.parse(raw);
};

const writeData = (data) => {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
};

const ensureSeedUser = () => {
  const data = readData();
  data.users = data.users || [];
  if (data.users.length === 0) {
    const passwordHash = bcrypt.hashSync("finora123", 10);
    data.users.push({
      id: "user-001",
      name: "Finora Admin",
      email: "admin@finora.id",
      password: passwordHash,
      created_at: new Date().toISOString()
    });
  }

  const defaultUserId = data.users[0].id;
  data.projects = (data.projects || []).map((item) => ({
    ...item,
    user_id: item.user_id || defaultUserId
  }));
  data.transactions = (data.transactions || []).map((item) => ({
    ...item,
    user_id: item.user_id || defaultUserId
  }));
  data.debts = (data.debts || []).map((item) => ({
    ...item,
    user_id: item.user_id || defaultUserId
  }));
  writeData(data);
};

ensureSeedUser();

const authMiddleware = (req, res, next) => {
  if (req.path === "/api/login" || req.path === "/api/register") return next();
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

app.use(authMiddleware);

const getProjectTotals = (project) => {
  const totalPaid = project.payments.reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = project.expenses.reduce((sum, item) => sum + item.amount, 0);
  const remainingPayment = Math.max(project.contract_value - totalPaid, 0);
  const paymentStatus =
    totalPaid === 0
      ? "Belum Bayar"
      : totalPaid < project.contract_value
      ? "DP"
      : "Lunas";
  const overdue =
    paymentStatus !== "Lunas" && new Date(project.project_date) < new Date();

  return {
    total_paid: totalPaid,
    total_expense: totalExpense,
    remaining_payment: remainingPayment,
    profit: totalPaid - totalExpense,
    payment_status: paymentStatus,
    overdue
  };
};

const enrichProject = (project) => ({
  ...project,
  ...getProjectTotals(project)
});

app.get("/api/summary", (req, res) => {
  const data = readData();
  res.json(data.summary);
});

app.get("/api/cashflow", (req, res) => {
  const data = readData();
  res.json(data.cashflow);
});

app.get("/api/projects", (req, res) => {
  const data = readData();
  const userProjects = (data.projects || []).filter((item) => item.user_id === req.userId);
  res.json(userProjects.map(enrichProject));
});

app.get("/api/projects/:id", (req, res) => {
  const data = readData();
  const project = (data.projects || []).find(
    (item) => item.id === req.params.id && item.user_id === req.userId
  );
  if (!project) {
    res.status(404).json({ message: "Project tidak ditemukan" });
    return;
  }
  res.json(enrichProject(project));
});

app.get("/api/transactions", (req, res) => {
  const data = readData();
  const userTransactions = (data.transactions || []).filter((item) => item.user_id === req.userId);
  res.json(userTransactions);
});

app.get("/api/debts", (req, res) => {
  const data = readData();
  const userDebts = (data.debts || []).filter((item) => item.user_id === req.userId);
  res.json(userDebts);
});

app.get("/api/receivables", (req, res) => {
  const data = readData();
  const receivables = (data.projects || [])
    .filter((item) => item.user_id === req.userId)
    .map(enrichProject)
    .filter((item) => item.payment_status !== "Lunas");
  res.json(
    receivables.map((item) => ({
      client: item.client_name,
      project: item.project_name,
      total: item.contract_value,
      dibayar: item.total_paid,
      sisa: item.remaining_payment,
      jatuhTempo: item.payment_deadline,
      status: item.payment_status
    }))
  );
});

app.get("/api/analytics", (req, res) => {
  const data = readData();
  res.json(data.analytics);
});

app.post("/api/register", (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    res.status(400).json({ message: "Data tidak lengkap" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ message: "Password minimal 6 karakter" });
    return;
  }
  const data = readData();
  data.users = data.users || [];
  const existing = data.users.find((user) => user.email === email);
  if (existing) {
    res.status(400).json({ message: "Email sudah terdaftar" });
    return;
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const newUser = {
    id: `user-${Date.now()}`,
    name,
    email,
    password: passwordHash,
    created_at: new Date().toISOString()
  };
  data.users.push(newUser);
  writeData(data);
  res.json({ message: "Register berhasil" });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const data = readData();
  data.users = data.users || [];
  const user = data.users.find((item) => item.email === email);
  if (!user) {
    res.status(401).json({ message: "Email atau password salah" });
    return;
  }
  const match = bcrypt.compareSync(password, user.password);
  if (!match) {
    res.status(401).json({ message: "Email atau password salah" });
    return;
  }
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email }
  });
});

app.listen(port, () => {
  console.log(`Finora API running on http://localhost:${port}`);
});
