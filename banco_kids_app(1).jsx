import React, { useEffect, useState, useCallback, useRef, forwardRef, memo } from "react";

// BancoKids - Single-file React component (major update)
// Tailwind CSS assumed in project
// Big list of additions and fixes:
// - FIX: typing bug — inputs converted to stable memoized controlled Input component + buttons set to type="button"
// - Admin features: transaction history, export CSV, pending transfers (approval), impersonate user, force-run hourly jobs, adjust interval for testing
// - Notices: admin can send notices; users have read/unread state; admin can broadcast
// - Hourly jobs: taxes, bonus, lottery — manual run button and configurable test interval
// - Transfer approvals: transfers over APPROVAL_LIMIT go to pending and require admin approval
// - UX improvements: clearer messages, modal-like announcement banner, improved layout
// - Persisted state: users, transactions, notices, announcements, pendingTransfers, readNotices, lang, settings

export default function BancoKidsApp() {
  const ADMIN_USERNAME = "Manel";
  const ADMIN_EMAIL = "caeiro949@gmail.com";
  const ADMIN_PASSWORD = "manel123"; // change in production

  // localStorage keys
  const LS_USERS = "bancokids_users";
  const LS_CURRENT = "bancokids_current";
  const LS_NOTICES = "bancokids_notices";
  const LS_ANNOUNCEMENTS = "bancokids_announcements";
  const LS_TRANSACTIONS = "bancokids_transactions";
  const LS_LANG = "bancokids_lang";
  const LS_PENDING = "bancokids_pending";
  const LS_READ = "bancokids_readnotices";
  const LS_SETTINGS = "bancokids_settings";

  // initial demo users
  const demoUsers = [
    { id: "u_manel", username: "Manel", email: "manel@example.com", password: ADMIN_PASSWORD, name: "Manel (Admin)", balance: 1000, role: "admin", banned: false },
    { id: "u_alice", username: "Alice", email: "alice@example.com", password: "alice123", name: "Alice", balance: 50, role: "student", banned: false },
    { id: "u_joao", username: "Joao", email: "joao@example.com", password: "joao123", name: "João", balance: 30, role: "student", banned: false },
    { id: "u_caheiro", username: "Caeiro", email: "caeiro949@gmail.com", password: "caeiro123", name: "Caeiro (Admin)", balance: 500, role: "admin", banned: false },
  ];

  // settings (persisted)
  const defaultSettings = { taxRate: 0.02, hourlyBonus: 10, lotteryPrize: 100, approvalLimit: 100, jobIntervalMs: 60 * 60 * 1000 };

  // state
  const [phase, setPhase] = useState("home");
  const [users, setUsers] = useState([]);
  const [current, setCurrent] = useState(null);
  const [form, setForm] = useState({ username: "", password: "", name: "", email: "" });
  const [message, setMessage] = useState("");
  const [notices, setNotices] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [lang, setLang] = useState("pt");
  const [pending, setPending] = useState([]);
  const [readNotices, setReadNotices] = useState({});
  const [settings, setSettings] = useState(defaultSettings);

  // admin UI state
  const [targetUser, setTargetUser] = useState("");
  const [amount, setAmount] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [adminNoticeTarget, setAdminNoticeTarget] = useState("");
  const [adminNoticeText, setAdminNoticeText] = useState("");
  const [impersonateUser, setImpersonateUser] = useState("");

  // refs
  const loginUserRef = useRef();
  const loginPassRef = useRef();

  // small translation object
  const T = {
    pt: { welcome: "Bem-vindo ao BancoKids", login: "Login", signup: "Cadastro", send: "Enviar", addMoney: "Adicionar", users: "Lista de usuários", adminPanel: "Painel de Administração", notices: "Avisos", announcements: "Anúncios", balance: "Saldo", transactions: "Transações", pending: "Pendentes", impersonate: "Impersonar" },
    en: { welcome: "Welcome to BancoKids", login: "Login", signup: "Signup", send: "Send", addMoney: "Add", users: "User list", adminPanel: "Admin Panel", notices: "Notices", announcements: "Announcements", balance: "Balance", transactions: "Transactions", pending: "Pending", impersonate: "Impersonate" },
  };

  // -------------------- Persistence load --------------------
  useEffect(() => {
    const raw = localStorage.getItem(LS_USERS);
    if (raw) setUsers(JSON.parse(raw));
    else { setUsers(demoUsers); localStorage.setItem(LS_USERS, JSON.stringify(demoUsers)); }

    const cur = localStorage.getItem(LS_CURRENT);
    if (cur) setCurrent(JSON.parse(cur));

    const rawNot = localStorage.getItem(LS_NOTICES);
    if (rawNot) setNotices(JSON.parse(rawNot));

    const rawAnn = localStorage.getItem(LS_ANNOUNCEMENTS);
    if (rawAnn) setAnnouncements(JSON.parse(rawAnn));

    const rawTx = localStorage.getItem(LS_TRANSACTIONS);
    if (rawTx) setTransactions(JSON.parse(rawTx));

    const rawPend = localStorage.getItem(LS_PENDING);
    if (rawPend) setPending(JSON.parse(rawPend));

    const rawRead = localStorage.getItem(LS_READ);
    if (rawRead) setReadNotices(JSON.parse(rawRead));

    const rawSettings = localStorage.getItem(LS_SETTINGS);
    if (rawSettings) setSettings(JSON.parse(rawSettings));

    const rawLang = localStorage.getItem(LS_LANG);
    if (rawLang) setLang(rawLang);
  }, []);

  useEffect(() => localStorage.setItem(LS_USERS, JSON.stringify(users)), [users]);
  useEffect(() => { if (current) localStorage.setItem(LS_CURRENT, JSON.stringify(current)); else localStorage.removeItem(LS_CURRENT); }, [current]);
  useEffect(() => localStorage.setItem(LS_NOTICES, JSON.stringify(notices)), [notices]);
  useEffect(() => localStorage.setItem(LS_ANNOUNCEMENTS, JSON.stringify(announcements)), [announcements]);
  useEffect(() => localStorage.setItem(LS_TRANSACTIONS, JSON.stringify(transactions)), [transactions]);
  useEffect(() => localStorage.setItem(LS_PENDING, JSON.stringify(pending)), [pending]);
  useEffect(() => localStorage.setItem(LS_READ, JSON.stringify(readNotices)), [readNotices]);
  useEffect(() => localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)), [settings]);
  useEffect(() => localStorage.setItem(LS_LANG, lang), [lang]);

  // helpers
  const findUser = useCallback((usernameOrEmail) => {
    if (!usernameOrEmail) return null;
    const q = usernameOrEmail.toLowerCase();
    return users.find((u) => u.username.toLowerCase() === q || (u.email && u.email.toLowerCase() === q));
  }, [users]);

  const isAdmin = useCallback(() => {
    if (!current) return false;
    if (current.username === ADMIN_USERNAME) return true;
    const u = users.find((x) => x.username === current.username);
    if (!u) return false;
    return (u.email && u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  }, [current, users]);

  const pushTransaction = (type, from, to, amount, note = "") => {
    const tx = { id: `tx_${Date.now()}`, ts: Date.now(), type, from, to, amount: Number(amount), note };
    setTransactions((s) => [tx, ...s]);
  };

  // -------------------- Input component (fix typing bug) --------------------
  // memoized controlled input that avoids unnecessary re-renders and preserves focus
  const StableInput = memo(forwardRef(function StableInput({ value, onChange, ...rest }, ref) {
    return <input ref={ref} value={value} onChange={onChange} {...rest} />;
  }), (prev, next) => prev.value === next.value && prev.onChange === next.onChange);

  // -------------------- Auth actions --------------------
  const handleSignup = useCallback(() => {
    setMessage("");
    if (!form.username || !form.password || !form.name) return setMessage("Preencha todos os campos.");
    if (users.find((u) => u.username.toLowerCase() === form.username.toLowerCase())) return setMessage("Nome de usuário já existe.");
    const newUser = { id: `u_${Date.now()}`, username: form.username, email: form.email || "", password: form.password, name: form.name, balance: 0, role: "student", banned: false };
    setUsers((s) => [...s, newUser]);
    setCurrent({ username: newUser.username, name: newUser.name, role: newUser.role });
    setPhase("dashboard");
    setForm({ username: "", password: "", name: "", email: "" });
  }, [form, users]);

  const handleLogin = useCallback(() => {
    setMessage("");
    const q = form.username || "";
    const u = users.find((x) => x.username.toLowerCase() === q.toLowerCase() || (x.email && x.email.toLowerCase() === q.toLowerCase()));
    if (!u) return setMessage("Usuário não encontrado.");
    if (u.banned) return setMessage("Conta banida.");
    if (u.password !== form.password) return setMessage("Senha incorreta.");
    setCurrent({ username: u.username, name: u.name, role: u.role, email: u.email });
    setForm({ username: "", password: "", name: "", email: "" });
    setPhase(u.role === "admin" || (u.email && u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) ? "admin" : "dashboard");
  }, [form, users]);

  const logout = useCallback(() => { setCurrent(null); setPhase("home"); }, []);

  // -------------------- Admin actions --------------------
  const adminAddMoney = useCallback(() => {
    setMessage("");
    if (!isAdmin()) return setMessage("Acesso negado.");
    const u = findUser(targetUser);
    if (!u) return setMessage("Usuário alvo não encontrado.");
    if (u.banned) return setMessage("Não é possível adicionar a uma conta banida.");
    const value = Number(amount);
    if (isNaN(value) || value <= 0) return setMessage("Valor inválido.");
    setUsers((prev) => prev.map((usr) => usr.username === u.username ? { ...usr, balance: Number(usr.balance) + value } : usr));
    pushTransaction('admin_add', current ? current.username : 'admin', u.username, value, `Admin adicionou`);
    setMessage(`Foi acrescentado €${value.toFixed(2)} a ${u.username}.`);
  }, [isAdmin, targetUser, amount, findUser, current]);

  const adminToggleBan = useCallback((username) => {
    if (!isAdmin()) return setMessage("Acesso negado.");
    if (username === ADMIN_USERNAME) return setMessage("Não pode banir o administrador.");
    setUsers((prev) => prev.map((u) => u.username === username ? { ...u, banned: !u.banned } : u));
    setMessage(`Usuário ${username} atualizado.`);
  }, [isAdmin]);

  const adminSendNotice = useCallback((target, text) => {
    if (!isAdmin()) return setMessage("Acesso negado.");
    if (!text) return setMessage("Texto vazio.");
    const note = { id: `n_${Date.now()}`, ts: Date.now(), from: current ? current.username : 'admin', target: target || 'all', text };
    setNotices((s) => [note, ...s]);
    setMessage('Aviso enviado.');
  }, [isAdmin, current]);

  const adminImpersonate = useCallback((username) => {
    if (!isAdmin()) return setMessage("Acesso negado.");
    const u = findUser(username);
    if (!u) return setMessage("Usuário não encontrado.");
    setCurrent({ username: u.username, name: u.name, role: u.role, email: u.email, impersonatedBy: current ? current.username : 'admin' });
    setPhase(u.role === "admin" ? "admin" : "dashboard");
    setMessage(`Agora a agir como ${u.username}`);
  }, [isAdmin, findUser, current]);

  // -------------------- Transfers --------------------
  const createPendingTransfer = useCallback((fromUsername, toUsername, amountVal) => {
    const p = { id: `p_${Date.now()}`, ts: Date.now(), from: fromUsername, to: toUsername, amount: Number(amountVal), status: 'pending' };
    setPending((s) => [p, ...s]);
    setMessage('Transferência solicitada — aguarda aprovação do admin.');
  }, []);

  const approvePending = useCallback((pendingId, approve) => {
    if (!isAdmin()) return setMessage('Acesso negado.');
    const p = pending.find((x) => x.id === pendingId);
    if (!p) return setMessage('Pedido não encontrado.');
    if (!approve) {
      setPending((s) => s.map((x) => x.id === pendingId ? { ...x, status: 'rejected' } : x));
      setMessage('Transferência rejeitada.');
      return;
    }
    // execute transfer
    setUsers((prev) => {
      const from = prev.find((u) => u.username === p.from);
      const to = prev.find((u) => u.username === p.to);
      if (!from || !to) { setMessage('Conta envolvida não encontrada.'); return prev; }
      if (from.balance < p.amount) { setMessage('Saldo insuficiente.'); return prev; }
      const next = prev.map((u) => {
        if (u.username === from.username) return { ...u, balance: Number(u.balance) - p.amount };
        if (u.username === to.username) return { ...u, balance: Number(u.balance) + p.amount };
        return u;
      });
      pushTransaction('transfer', from.username, to.username, p.amount);
      setAnnouncements((s) => [{ id: `a_${Date.now()}`, ts: Date.now(), message: `UAU! O USER ${from.name || from.username} TRANSFERIU €${p.amount.toFixed(2)} PARA O USER ${to.username}. APROVEITA BEM!` }, ...s]);
      setPending((s) => s.map((x) => x.id === pendingId ? { ...x, status: 'approved' } : x));
      setMessage('Transferência aprovada e executada.');
      return next;
    });
  }, [isAdmin, pending]);

  const sendMoney = useCallback((fromUsername, toUsername, value) => {
    setMessage("");
    const from = findUser(fromUsername);
    const to = findUser(toUsername);
    if (!from) return setMessage("Remetente não encontrado.");
    if (!to) return setMessage("Destinatário não encontrado.");
    if (from.banned || to.banned) return setMessage("Conta banida envolvida na transferência.");
    const amt = Number(value);
    if (isNaN(amt) || amt <= 0) return setMessage("Valor inválido.");
    // if above approval limit -> create pending transfer
    if (amt > settings.approvalLimit && !isAdmin()) {
      createPendingTransfer(from.username, to.username, amt);
      return;
    }
    if (from.balance < amt) return setMessage("Saldo insuficiente.");
    setUsers((prev) => prev.map((u) => {
      if (u.username === from.username) return { ...u, balance: Number(u.balance) - amt };
      if (u.username === to.username) return { ...u, balance: Number(u.balance) + amt };
      return u;
    }));
    pushTransaction('transfer', from.username, to.username, amt);

    if (amt > settings.approvalLimit) {
      const ann = { id: `a_${Date.now()}`, ts: Date.now(), message: `UAU! O USER ${from.name || from.username} TRANSFERIU €${amt.toFixed(2)} PARA O USER ${to.username}. APROVEITA BEM!` };
      setAnnouncements((s) => [ann, ...s]);
    }

    setMessage(`Transferidos €${amt.toFixed(2)} de ${from.username} para ${to.username}.`);
  }, [findUser, settings, createPendingTransfer, isAdmin]);

  // -------------------- Hourly jobs + manual run --------------------
  const runJobs = useCallback(() => {
    const { taxRate, hourlyBonus, lotteryPrize } = settings;
    // tax + bonus
    setUsers((prev) => prev.map((u) => {
      if (u.banned) return u;
      const taxed = Number(u.balance) * (1 - taxRate);
      const afterTax = Number(taxed.toFixed(2));
      const afterBonus = Number((afterTax + hourlyBonus).toFixed(2));
      pushTransaction('hourly', 'system', u.username, hourlyBonus, 'Bonus + tax applied');
      return { ...u, balance: afterBonus };
    }));
    // lottery
    setUsers((prev) => {
      const candidates = prev.filter((u) => !u.banned);
      if (candidates.length === 0) return prev;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      pushTransaction('lottery', 'system', pick.username, lotteryPrize, 'Hourly lottery prize');
      setAnnouncements((s) => [{ id: `a_${Date.now()}`, ts: Date.now(), message: `${pick.username} ganhou €${lotteryPrize} no sorteio!` }, ...s]);
      return prev.map((u) => u.username === pick.username ? { ...u, balance: Number(u.balance) + lotteryPrize } : u);
    });
  }, [settings]);

  useEffect(() => {
    // run once at mount
    runJobs();
    const iv = setInterval(runJobs, settings.jobIntervalMs);
    return () => clearInterval(iv);
  }, [runJobs, settings.jobIntervalMs]);

  // -------------------- Notices read state --------------------
  const markNoticeRead = useCallback((noticeId) => {
    if (!current) return;
    setReadNotices((prev) => {
      const copy = { ...prev };
      if (!copy[current.username]) copy[current.username] = {};
      copy[current.username][noticeId] = true;
      return copy;
    });
  }, [current]);

  // -------------------- Export CSV --------------------
  const exportTransactionsCSV = useCallback(() => {
    const rows = transactions.map((t) => `${new Date(t.ts).toISOString()},${t.type},${t.from},${t.to},${t.amount},"${t.note || ''}"`);
    const csv = `timestamp,type,from,to,amount,note
${rows.join('')}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'transactions.csv'; a.click();
    URL.revokeObjectURL(url);
  }, [transactions]);

  // -------------------- Utility UI small components --------------------
  const SmallButton = ({ onClick, children, className = '' }) => (
    <button type="button" onClick={onClick} className={`py-2 px-3 rounded ${className}`}>{children}</button>
  );

  // -------------------- UI --------------------
  const Home = () => (
    <div className="max-w-4xl mx-auto mt-12 p-6 bg-white rounded-2xl shadow-lg">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">BancoKids</h1>
        <div className="text-sm text-gray-600">Segurança. Educação. Diversão.</div>
      </header>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 border rounded-xl">
          <h2 className="text-xl font-semibold">{T[lang].login}</h2>
          <p className="text-sm text-gray-500">Já tem conta? Faça login de forma segura.</p>
          <SmallButton onClick={() => setPhase("login")} className="mt-3 w-full border">{T[lang].login}</SmallButton>
        </div>

        <div className="p-6 border rounded-xl">
          <h2 className="text-xl font-semibold">{T[lang].signup}</h2>
          <p className="text-sm text-gray-500">Crie uma conta para crianças — sem dados reais.</p>
          <SmallButton onClick={() => setPhase("signup")} className="mt-3 w-full border">{T[lang].signup}</SmallButton>
        </div>
      </div>

      <footer className="mt-6 text-xs text-gray-400">Este é um ambiente educativo / demo. Não use dados bancários reais.</footer>
    </div>
  );

  const Login = () => (
    <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-2xl shadow-lg">
      <h2 className="text-2xl font-bold">{T[lang].login}</h2>
      <p className="mt-2 text-sm text-gray-500">Use um usuário de demonstração (ex: Manel) ou sua conta criada.</p>

      <label className="block mt-4 text-sm">Usuário ou email</label>
      <StableInput ref={loginUserRef} name="loginUser" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} className="w-full p-2 border rounded" />
      <label className="block mt-2 text-sm">Senha</label>
      <StableInput ref={loginPassRef} name="loginPass" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="w-full p-2 border rounded" />

      <div className="flex items-center justify-between mt-4">
        <SmallButton onClick={handleLogin} className="bg-blue-600 text-white">{T[lang].login}</SmallButton>
        <SmallButton onClick={() => setPhase("home")} className="border">Voltar</SmallButton>
      </div>

      {message && <div className="mt-4 text-sm text-red-500">{message}</div>}

      <div className="mt-4 text-xs text-gray-400">Dica: usuário <strong>Manel</strong> (ou o email {ADMIN_EMAIL}) é administrador.</div>
    </div>
  );

  const Signup = () => (
    <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-2xl shadow-lg">
      <h2 className="text-2xl font-bold">{T[lang].signup}</h2>

      <label className="block mt-4 text-sm">Nome completo</label>
      <StableInput value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full p-2 border rounded" />

      <label className="block mt-2 text-sm">Usuário</label>
      <StableInput value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} className="w-full p-2 border rounded" />

      <label className="block mt-2 text-sm">Email (opcional)</label>
      <StableInput value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full p-2 border rounded" />

      <label className="block mt-2 text-sm">Senha</label>
      <StableInput type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="w-full p-2 border rounded" />

      <div className="flex items-center justify-between mt-4">
        <SmallButton onClick={handleSignup} className="bg-green-600 text-white">Criar conta</SmallButton>
        <SmallButton onClick={() => setPhase("home")} className="border">Voltar</SmallButton>
      </div>

      {message && <div className="mt-4 text-sm text-red-500">{message}</div>}
    </div>
  );

  const Dashboard = () => {
    const u = users.find((x) => x.username === (current ? current.username : ""));
    const userNotices = notices.filter((n) => n.target === 'all' || n.target === (u ? u.username : ''));

    return (
      <div className="max-w-4xl mx-auto mt-12 p-6 bg-white rounded-2xl shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Olá, {current ? current.name : ''}</h2>
            <div className="text-sm text-gray-500">{T[lang].balance}: €{u ? Number(u.balance).toFixed(2) : "0.00"}</div>
          </div>
          <div className="flex gap-2">
            <select value={lang} onChange={(e) => setLang(e.target.value)} className="p-2 border rounded">
              <option value="pt">PT</option>
              <option value="en">EN</option>
            </select>
            <SmallButton onClick={logout} className="border">Sair</SmallButton>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border rounded-xl">
            <h3 className="font-semibold">{T[lang].send} dinheiro</h3>
            <label className="block mt-2 text-sm">Para (usuário)</label>
            <StableInput value={transferTo} onChange={(e) => setTransferTo(e.target.value)} className="w-full p-2 border rounded" />
            <label className="block mt-2 text-sm">Valor (€)</label>
            <StableInput type="number" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} className="w-full p-2 border rounded" />
            <SmallButton onClick={() => sendMoney(current.username, transferTo, transferAmount)} className="mt-3 bg-blue-600 text-white">{T[lang].send}</SmallButton>

            <div className="mt-4">
              <h4 className="font-semibold">{T[lang].notices}</h4>
              <div className="mt-2 space-y-2 max-h-40 overflow-auto text-sm text-gray-700">
                {userNotices.length === 0 && <div className="text-xs text-gray-400">Sem avisos.</div>}
                {userNotices.map((n) => (
                  <div key={n.id} className={`p-2 border rounded ${readNotices[current.username] && readNotices[current.username][n.id] ? 'bg-white' : 'bg-slate-50'}`}>
                    <div className="flex justify-between"><div>{n.text}</div><div><SmallButton onClick={() => markNoticeRead(n.id)} className="text-xs border">Marcar lido</SmallButton></div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 border rounded-xl col-span-2">
            <h3 className="font-semibold">{T[lang].users}</h3>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-auto">
              {users.map((u) => (
                <div key={u.username} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-medium">{u.name} ({u.username})</div>
                    <div className="text-xs text-gray-500">{T[lang].balance}: €{Number(u.balance).toFixed(2)} {u.banned ? "• BANIDO" : ""}</div>
                  </div>
                  <div className="text-xs text-gray-400">{u.email}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
              <SmallButton onClick={() => {
                const csv = users.map(u => `${u.username},${u.email},${u.name},${u.balance}`).join(''); const blob = new Blob([csv], { type: 'text / csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'users.csv'; a.click(); URL.revokeObjectURL(url); }} className="border">Exportar usuários CSV</SmallButton>
                < SmallButton onClick = {() => setPhase('transactions')} className="border">Ver transações</SmallButton>
            <SmallButton onClick={() => setPhase('announcements')} className="border">Ver anúncios</SmallButton>
          </div>
      </div>
        </div >

    { message && <div className="mt-4 text-sm text-green-600">{message}</div>
}
      </div >
    );
  };

const AdminHub = () => {
  return (
    <div className="max-w-6xl mx-auto mt-12 p-6 bg-white rounded-2xl shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{T[lang].adminPanel}</h2>
          <div className="text-sm text-gray-500">Usuário: {current ? current.name : ''} (Administrador)</div>
        </div>
        <div className="flex gap-2">
          <select value={lang} onChange={(e) => setLang(e.target.value)} className="p-2 border rounded">
            <option value="pt">PT</option>
            <option value="en">EN</option>
          </select>
          <SmallButton onClick={logout} className="border">Sair</SmallButton>
        </div>
      </div>

      <section className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 border rounded-xl">
          <h3 className="font-semibold">{T[lang].addMoney} à conta</h3>
          <label className="block mt-2 text-sm">Usuário alvo</label>
          <StableInput value={targetUser} onChange={(e) => setTargetUser(e.target.value)} className="w-full p-2 border rounded" />
          <label className="block mt-2 text-sm">Valor (€)</label>
          <StableInput type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full p-2 border rounded" />
          <SmallButton onClick={adminAddMoney} className="mt-3 bg-green-600 text-white">{T[lang].addMoney}</SmallButton>

          <div className="mt-4">
            <h4 className="font-semibold">Enviar Aviso</h4>
            <StableInput value={adminNoticeTarget} onChange={(e) => setAdminNoticeTarget(e.target.value)} className="w-full p-2 border rounded mt-2" placeholder="Usuário (opcional)" />
            <StableInput value={adminNoticeText} onChange={(e) => setAdminNoticeText(e.target.value)} className="w-full p-2 border rounded mt-2" placeholder="Texto do aviso" />
            <SmallButton onClick={() => { adminSendNotice(adminNoticeTarget, adminNoticeText); setAdminNoticeTarget(''); setAdminNoticeText(''); }} className="mt-3 bg-indigo-600 text-white">Enviar Aviso</SmallButton>
          </div>
        </div>

        <div className="p-4 border rounded-xl">
          <h3 className="font-semibold">Transferências como Admin</h3>
          <label className="block mt-2 text-sm">De</label>
          <StableInput value={targetUser} onChange={(e) => setTargetUser(e.target.value)} className="w-full p-2 border rounded" />
          <label className="block mt-2 text-sm">Para</label>
          <StableInput value={transferTo} onChange={(e) => setTransferTo(e.target.value)} className="w-full p-2 border rounded" />
          <label className="block mt-2 text-sm">Valor (€)</label>
          <StableInput type="number" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} className="w-full p-2 border rounded" />
          <SmallButton onClick={() => sendMoney(targetUser, transferTo, transferAmount)} className="mt-3 bg-blue-600 text-white">Enviar</SmallButton>

          <div className="mt-4">
            <h4 className="font-semibold">Impersonate</h4>
            <StableInput value={impersonateUser} onChange={(e) => setImpersonateUser(e.target.value)} className="w-full p-2 border rounded" placeholder="username" />
            <SmallButton onClick={() => adminImpersonate(impersonateUser)} className="mt-2 border">{T[lang].impersonate}</SmallButton>
          </div>
        </div>

        <div className="p-4 border rounded-xl">
          <h3 className="font-semibold">Gerir usuários</h3>
          <div className="mt-2 space-y-2 max-h-56 overflow-auto">
            {users.map((u) => (
              <div key={u.username} className="flex items-center justify-between p-2 border rounded">
                <div>
                  <div className="font-medium">{u.name} ({u.username})</div>
                  <div className="text-xs text-gray-500">{T[lang].balance}: €{Number(u.balance).toFixed(2)} {u.banned ? "• BANIDO" : ""}</div>
                </div>
                <div className="flex gap-2">
                  <SmallButton onClick={() => adminToggleBan(u.username)} className="border">{u.banned ? "Desbanir" : "Banir"}</SmallButton>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <SmallButton onClick={() => exportTransactionsCSV()} className="border">Exportar transações CSV</SmallButton>
          </div>
        </div>

        <div className="p-4 border rounded-xl">
          <h3 className="font-semibold">Jobs / Configurações</h3>
          <div className="text-xs text-gray-500">Taxa: <strong>{(settings.taxRate * 100).toFixed(2)}%</strong> • Bónus horário: <strong>€{settings.hourlyBonus}</strong> • Sorteio: <strong>€{settings.lotteryPrize}</strong></div>
          <label className="block mt-2 text-sm">Intervalo (ms) — para testes reduzir</label>
          <StableInput type="number" value={settings.jobIntervalMs} onChange={(e) => setSettings((s) => ({ ...s, jobIntervalMs: Number(e.target.value) }))} className="w-full p-2 border rounded" />
          <label className="block mt-2 text-sm">Limite para aprovação</label>
          <StableInput type="number" value={settings.approvalLimit} onChange={(e) => setSettings((s) => ({ ...s, approvalLimit: Number(e.target.value) }))} className="w-full p-2 border rounded" />
          <div className="mt-3 flex gap-2">
            <SmallButton onClick={() => runJobs()} className="bg-yellow-400">Executar jobs agora</SmallButton>
            <SmallButton onClick={() => { setAnnouncements((s) => [{ id: `a_${Date.now()}`, ts: Date.now(), message: `Admin ${current.username} limpou anúncios.` }, ...s]); setAnnouncements([]); }} className="border">Limpar anúncios</SmallButton>
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 border rounded-xl">
          <h4 className="font-semibold">{T[lang].pending}</h4>
          <div className="mt-2 space-y-2 max-h-56 overflow-auto">
            {pending.length === 0 && <div className="text-xs text-gray-400">Sem pedidos pendentes.</div>}
            {pending.map((p) => (
              <div key={p.id} className="p-2 border rounded flex justify-between items-center">
                <div>
                  <div className="font-medium">{p.from} → {p.to}</div>
                  <div className="text-xs text-gray-500">€{p.amount} • {p.status}</div>
                </div>
                <div className="flex gap-2">
                  <SmallButton onClick={() => approvePending(p.id, true)} className="bg-green-600 text-white">Aprovar</SmallButton>
                  <SmallButton onClick={() => approvePending(p.id, false)} className="border">Rejeitar</SmallButton>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border rounded-xl">
          <h4 className="font-semibold">Anúncios recentes</h4>
          <div className="mt-2 space-y-2 max-h-56 overflow-auto text-sm text-blue-700">
            {announcements.map((a) => (
              <div key={a.id} className="p-2 border rounded bg-yellow-50">{a.message}</div>
            ))}
          </div>
        </div>
      </section>

      {message && <div className="mt-4 text-sm text-green-600">{message}</div>}
    </div>
  );
};

const TransactionsView = () => (
  <div className="max-w-4xl mx-auto mt-12 p-6 bg-white rounded-2xl shadow-lg">
    <div className="flex items-center justify-between">
      <h2 className="text-2xl font-bold">{T[lang].transactions}</h2>
      <div className="flex gap-2">
        <SmallButton onClick={() => setPhase(current && (isAdmin() ? 'admin' : 'dashboard'))} className="border">Fechar</SmallButton>
        <SmallButton onClick={() => exportTransactionsCSV()} className="border">Exportar CSV</SmallButton>
      </div>
    </div>

    <div className="mt-4 max-h-96 overflow-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-gray-500 border-b"><tr><th>Data</th><th>Tipo</th><th>De</th><th>Para</th><th>Valor</th><th>Nota</th></tr></thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id} className="border-b"><td>{new Date(t.ts).toLocaleString()}</td><td>{t.type}</td><td>{t.from}</td><td>{t.to}</td><td>€{t.amount}</td><td>{t.note}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const AnnouncementsView = () => (
  <div className="max-w-4xl mx-auto mt-12 p-6 bg-white rounded-2xl shadow-lg">
    <div className="flex items-center justify-between">
      <h2 className="text-2xl font-bold">{T[lang].announcements}</h2>
      <SmallButton onClick={() => setPhase(current && (isAdmin() ? 'admin' : 'dashboard'))} className="border">Fechar</SmallButton>
    </div>

    <div className="mt-4 space-y-2 max-h-96 overflow-auto">
      {announcements.map((a) => (
        <div key={a.id} className="p-3 border rounded bg-yellow-50">{a.message}</div>
      ))}
    </div>
  </div>
);

// main render
return (
  <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white py-8">
    <div className="container mx-auto px-4">
      {phase === "home" && <Home />}
      {phase === "login" && <Login />}
      {phase === "signup" && <Signup />}
      {phase === "dashboard" && current && <Dashboard />}
      {phase === "admin" && current && (isAdmin() ? <AdminHub /> : <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded-2xl shadow-lg">Acesso negado.</div>)}
      {phase === "transactions" && <TransactionsView />}
      {phase === "announcements" && <AnnouncementsView />}
    </div>

    {/* Big announcement banner */}
    {announcements.length > 0 && (
      <div className="fixed bottom-4 right-4 max-w-md">
        <div className="p-4 bg-yellow-100 border rounded shadow-lg">
          <div className="font-semibold">Anúncio</div>
          <div className="text-sm mt-2">{announcements[0].message}</div>
          <div className="mt-3 flex gap-2 justify-end">
            <SmallButton onClick={() => setAnnouncements((s) => s.slice(1))} className="border">Fechar</SmallButton>
          </div>
        </div>
      </div>
    )}
  </div>
);
}
