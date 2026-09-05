// ============================================================
// Genius Coaching Classes — app logic (Supabase-backed)
// ============================================================
// This file replaces the old hardcoded-password login with real
// Supabase Authentication + Row Level Security. See the SQL file
// (schema.sql) for the database tables and security policies this
// code relies on.
//
// SUPABASE_URL / SUPABASE_ANON_KEY below are the project URL and the
// PUBLIC anon/publishable key — these are safe to keep in frontend
// code (that is what they are for). Never put a service_role key
// here. If you ever need to point this site at a different Supabase
// project, change only these two lines.
const SUPABASE_URL = "https://qorrvpukcijdsjtbxmun.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_FF3AdQx9_nevNlyu3fkKfA_XQh2UL0s";

// Students log in with a short Student ID instead of an email address.
// Supabase Auth requires an email-shaped identifier, so each Student ID
// is mapped to an internal, never-emailed address like
// "s101@students.geniuscoaching.internal". The student never sees or
// needs to know this — they only ever type their Student ID.
const STUDENT_EMAIL_DOMAIN = "students.geniuscoaching.internal";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function studentCodeToEmail(code) {
  return `${code.trim().toLowerCase().replace(/\s+/g, "")}@${STUDENT_EMAIL_DOMAIN}`;
}

// The signed-in user's profile row (role, name, etc.), kept in memory.
// This is UI convenience only — every actual permission check happens
// server-side via Supabase Row Level Security, so tampering with this
// value in the browser console cannot grant access to anything.
let currentProfile = null;

// ------------------------------------------------------------
// Small DOM / UX helpers
// ------------------------------------------------------------
function $(id) {
  return document.getElementById(id);
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

let toastTimer = null;
function showToast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

function setFieldError(elId, message) {
  const el = $(elId);
  if (!el) return;
  el.textContent = message || "";
  el.style.display = message ? "block" : "none";
}

function setButtonLoading(btn, isLoading, loadingText, normalText) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = isLoading ? loadingText : normalText;
}

// ------------------------------------------------------------
// Session bootstrap — runs once on page load, and keeps nav
// labels + in-memory state in sync with the real Supabase session.
// ------------------------------------------------------------
function updateNavForSession() {
  const teacherLink = $("nav-teacher-link");
  const studentLinks = [$("nav-student-link"), $("hero-student-link")].filter(Boolean);

  if (teacherLink) {
    teacherLink.textContent = currentProfile?.role === "teacher" ? "Teacher Dashboard" : "Teacher Login";
  }
  studentLinks.forEach((a) => {
    a.textContent = currentProfile?.role === "student" ? "Student Dashboard" : "Student Login";
  });
}

async function loadCurrentProfile(userId) {
  const { data: profile, error } = await _supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error || !profile) return null;
  return profile;
}

async function bootstrapSession() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) {
    currentProfile = null;
  } else {
    currentProfile = await loadCurrentProfile(session.user.id);
  }
  updateNavForSession();
}

// Keep state in sync if the session ends for any reason (manual
// logout, expired refresh token, token revoked elsewhere, etc.).
_supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session) {
    const wasSignedIn = !!currentProfile;
    currentProfile = null;
    updateNavForSession();
    const portal = $("portal");
    if (wasSignedIn && portal && portal.style.display !== "none") {
      exitPortal();
      showToast("Your session ended. Please log in again.");
    }
  }
});

document.addEventListener("DOMContentLoaded", bootstrapSession);

// ------------------------------------------------------------
// Portal open / close (called from the nav "Login" links/buttons)
// ------------------------------------------------------------
window.openPortal = function (role) {
  const site = $("site");
  const portal = $("portal");
  if (site) site.style.display = "none";
  if (portal) portal.style.display = "block";
  window.scrollTo(0, 0);

  if (role === "teacher") {
    if (currentProfile?.role === "teacher") renderTeacherDashboard();
    else renderTeacherLogin();
  } else if (role === "student") {
    if (currentProfile?.role === "student") renderStudentDashboard();
    else renderStudentLogin();
  }
};

window.exitPortal = function () {
  const site = $("site");
  const portal = $("portal");
  if (portal) portal.style.display = "none";
  if (site) site.style.display = "block";
};

function setPortalRole(label) {
  const el = $("portalRoleLabel");
  if (el) el.textContent = label;
}

async function handleLogout() {
  await _supabase.auth.signOut();
  // onAuthStateChange above takes care of clearing state, closing the
  // portal and showing a toast.
}

// ------------------------------------------------------------
// Teacher login
// ------------------------------------------------------------
function renderTeacherLogin() {
  setPortalRole("Teacher Portal");
  $("portalRoot").innerHTML = `
    <div class="auth-card">
      <h2>Teacher Login</h2>
      <p class="auth-sub">Sign in with your teacher email and password.</p>
      <div id="teacher-login-error" class="error-msg" style="display:none;"></div>
      <form id="teacher-login-form">
        <div class="field">
          <label for="t-email">Email</label>
          <input type="email" id="t-email" required autocomplete="username">
        </div>
        <div class="field">
          <label for="t-pass">Password</label>
          <input type="password" id="t-pass" required autocomplete="current-password">
        </div>
        <button type="submit" class="btn btn-primary btn-block" id="teacher-login-btn">Login</button>
      </form>
      <p class="hint-msg">Teacher accounts are created by the coaching admin in Supabase.</p>
    </div>
  `;

  $("teacher-login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    setFieldError("teacher-login-error", "");
    const email = $("t-email").value.trim();
    const password = $("t-pass").value;
    const btn = $("teacher-login-btn");
    setButtonLoading(btn, true, "Signing in…", "Login");

    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setButtonLoading(btn, false, "", "Login");
      setFieldError("teacher-login-error", "Invalid email or password.");
      return;
    }

    const profile = await loadCurrentProfile(data.user.id);
    if (!profile || profile.role !== "teacher") {
      await _supabase.auth.signOut();
      setButtonLoading(btn, false, "", "Login");
      setFieldError("teacher-login-error", "This account is not registered as a teacher.");
      return;
    }

    currentProfile = profile;
    updateNavForSession();
    setButtonLoading(btn, false, "", "Login");
    renderTeacherDashboard();
  });
}

// ------------------------------------------------------------
// Student login
// ------------------------------------------------------------
function renderStudentLogin() {
  setPortalRole("Student Portal");
  $("portalRoot").innerHTML = `
    <div class="auth-card">
      <h2>Student Login</h2>
      <p class="auth-sub">Sign in with your Student ID and password.</p>
      <div id="student-login-error" class="error-msg" style="display:none;"></div>
      <form id="student-login-form">
        <div class="field">
          <label for="s-code">Student ID</label>
          <input type="text" id="s-code" required autocomplete="username" placeholder="e.g. S101">
        </div>
        <div class="field">
          <label for="s-pass">Password</label>
          <input type="password" id="s-pass" required autocomplete="current-password">
        </div>
        <button type="submit" class="btn btn-primary btn-block" id="student-login-btn">Login</button>
      </form>
      <p class="hint-msg">Don't have your Student ID or password? Ask your teacher.</p>
    </div>
  `;

  $("student-login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    setFieldError("student-login-error", "");
    const code = $("s-code").value.trim();
    const password = $("s-pass").value;
    const btn = $("student-login-btn");
    if (!code) return;
    setButtonLoading(btn, true, "Signing in…", "Login");

    const email = studentCodeToEmail(code);
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setButtonLoading(btn, false, "", "Login");
      setFieldError("student-login-error", "Invalid Student ID or password.");
      return;
    }

    const profile = await loadCurrentProfile(data.user.id);
    if (!profile || profile.role !== "student") {
      await _supabase.auth.signOut();
      setButtonLoading(btn, false, "", "Login");
      setFieldError("student-login-error", "This account is not registered as a student.");
      return;
    }

    currentProfile = profile;
    updateNavForSession();
    setButtonLoading(btn, false, "", "Login");
    renderStudentDashboard();
  });
}

// ------------------------------------------------------------
// Student dashboard — own profile + own attendance only.
// (RLS guarantees this server-side even if this code is bypassed.)
// ------------------------------------------------------------
async function renderStudentDashboard() {
  setPortalRole("Student Portal");
  const p = currentProfile;
  $("portalRoot").innerHTML = `
    <div class="panel-head">
      <h3>Welcome, ${escapeHtml(p.full_name)}</h3>
      <button class="btn btn-ghost btn-sm" id="student-logout-btn">Logout</button>
    </div>
    <p class="auth-sub" style="text-align:left;margin:-8px 0 20px;">
      Student ID: ${escapeHtml(p.student_code || "—")} · Class ${escapeHtml(p.class_name || "—")}
    </p>

    <div class="stat-grid">
      <div class="stat-card present"><div class="num" id="stat-present">0</div><div class="lbl">Present</div></div>
      <div class="stat-card absent"><div class="num" id="stat-absent">0</div><div class="lbl">Absent</div></div>
      <div class="stat-card"><div class="num" id="stat-total">0</div><div class="lbl">Total marked</div></div>
      <div class="stat-card"><div class="num" id="stat-pct">0%</div><div class="lbl">Attendance</div></div>
    </div>
    <div class="progress-track"><div class="progress-fill" id="attendance-progress" style="width:0%"></div></div>

    <div class="panel">
      <div class="panel-head"><h3 id="cal-title">This month</h3></div>
      <div class="cal-grid" id="student-calendar"><p class="empty-state">Loading attendance…</p></div>
    </div>
  `;

  $("student-logout-btn").addEventListener("click", handleLogout);

  const { data, error } = await _supabase
    .from("attendance")
    .select("date, status")
    .eq("student_id", p.id)
    .order("date", { ascending: true });

  if (error) {
    $("student-calendar").innerHTML = `<p class="empty-state">Could not load attendance: ${escapeHtml(error.message)}</p>`;
    return;
  }

  renderAttendanceStats(data || []);
  renderAttendanceCalendar(data || []);
}

function renderAttendanceStats(rows) {
  const present = rows.filter((r) => r.status === "Present").length;
  const absent = rows.filter((r) => r.status === "Absent").length;
  const total = rows.length;
  const pct = total ? Math.round((present / total) * 100) : 0;
  $("stat-present").textContent = present;
  $("stat-absent").textContent = absent;
  $("stat-total").textContent = total;
  $("stat-pct").textContent = pct + "%";
  $("attendance-progress").style.width = pct + "%";
}

function renderAttendanceCalendar(rows) {
  const byDate = {};
  rows.forEach((r) => { byDate[r.date] = r.status; });

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstDay.getDay();

  $("cal-title").textContent = firstDay.toLocaleString("default", { month: "long", year: "numeric" });

  const dow = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  let html = dow.map((d) => `<div class="cal-dow">${d}</div>`).join("");

  for (let i = 0; i < startWeekday; i++) html += `<div class="cal-cell empty"></div>`;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const status = byDate[dateStr];
    let cls = "cal-cell";
    if (status === "Present") cls += " present";
    else if (status === "Absent") cls += " absent";
    html += `<div class="${cls}">${day}</div>`;
  }

  $("student-calendar").innerHTML = html;
}

// ------------------------------------------------------------
// Teacher dashboard — mark attendance, manage students.
// ------------------------------------------------------------
async function renderTeacherDashboard() {
  setPortalRole("Teacher Portal");
  const today = new Date().toISOString().split("T")[0];

  $("portalRoot").innerHTML = `
    <div class="panel-head">
      <h3>Teacher Dashboard</h3>
      <button class="btn btn-ghost btn-sm" id="teacher-logout-btn">Logout</button>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-tab="mark">Mark Attendance</button>
      <button class="tab-btn" data-tab="students">Students</button>
      <button class="tab-btn" data-tab="add">Add Student</button>
    </div>

    <div id="tab-mark" class="tab-panel">
      <div class="panel">
        <div class="panel-head">
          <h3>Mark attendance</h3>
          <input type="date" id="mark-date" class="inline-input" value="${today}">
        </div>
        <div id="mark-list"><p class="empty-state">Loading students…</p></div>
      </div>
    </div>

    <div id="tab-students" class="tab-panel" style="display:none;">
      <div class="panel">
        <div class="panel-head"><h3>All students</h3></div>
        <table class="rtable">
          <thead><tr><th>ID</th><th>Name</th><th>Class</th><th>Actions</th></tr></thead>
          <tbody id="students-tbody"><tr><td colspan="4"><p class="empty-state">Loading…</p></td></tr></tbody>
        </table>
      </div>
      <div class="panel" id="student-history-panel" style="display:none;">
        <div class="panel-head">
          <h3 id="student-history-title">Attendance history</h3>
          <button class="btn btn-ghost btn-sm" id="close-history-btn">Close</button>
        </div>
        <table class="rtable">
          <thead><tr><th>Date</th><th>Status</th></tr></thead>
          <tbody id="student-history-tbody"></tbody>
        </table>
      </div>
    </div>

    <div id="tab-add" class="tab-panel" style="display:none;">
      <div class="panel">
        <div class="panel-head"><h3>Add a new student</h3></div>
        <div id="add-student-error" class="error-msg" style="display:none;"></div>
        <form id="add-student-form" class="form-grid">
          <div class="field"><label for="new-full-name">Full name</label><input type="text" id="new-full-name" required></div>
          <div class="field"><label for="new-student-code">Student ID</label><input type="text" id="new-student-code" required placeholder="e.g. S101"></div>
          <div class="field"><label for="new-class">Class</label><input type="text" id="new-class" required placeholder="e.g. 9th"></div>
          <div class="field"><label for="new-password">Temporary password</label><input type="text" id="new-password" required minlength="6" placeholder="min 6 characters"></div>
        </form>
        <button type="submit" form="add-student-form" class="btn btn-primary" id="add-student-btn">Add student</button>
        <p class="hint-msg">Share the Student ID and password with the student so they can log in.</p>
      </div>
    </div>
  `;

  $("teacher-logout-btn").addEventListener("click", handleLogout);

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab-panel").forEach((p) => (p.style.display = "none"));
      $("tab-" + btn.dataset.tab).style.display = "block";
    });
  });

  $("mark-date").addEventListener("change", () => loadMarkList($("mark-date").value));
  $("add-student-form").addEventListener("submit", handleAddStudent);
  $("close-history-btn").addEventListener("click", () => { $("student-history-panel").style.display = "none"; });

  await loadMarkList(today);
  await loadStudentsTable();
}

async function fetchAllStudents() {
  const { data, error } = await _supabase
    .from("profiles")
    .select("id, full_name, student_code, class_name")
    .eq("role", "student")
    .order("student_code", { ascending: true });
  if (error) {
    showToast("Could not load students: " + error.message);
    return [];
  }
  return data || [];
}

async function loadMarkList(dateStr) {
  const list = $("mark-list");
  list.innerHTML = `<p class="empty-state">Loading students…</p>`;

  const students = await fetchAllStudents();
  if (students.length === 0) {
    list.innerHTML = `<p class="empty-state">No students yet. Add one from the "Add Student" tab.</p>`;
    return;
  }

  const { data: existing } = await _supabase
    .from("attendance")
    .select("student_id, status")
    .eq("date", dateStr);

  const statusByStudent = {};
  (existing || []).forEach((r) => { statusByStudent[r.student_id] = r.status; });

  list.innerHTML = students.map((s) => `
    <div class="mark-row" data-student-id="${s.id}">
      <div class="mark-name">${escapeHtml(s.full_name)} <span class="hint-msg" style="display:inline;margin:0;">(${escapeHtml(s.student_code || "")})</span></div>
      <div class="mark-choices">
        <button type="button" class="choice-btn present-btn ${statusByStudent[s.id] === "Present" ? "p-active" : ""}" data-status="Present">Present</button>
        <button type="button" class="choice-btn absent-btn ${statusByStudent[s.id] === "Absent" ? "a-active" : ""}" data-status="Absent">Absent</button>
      </div>
    </div>
  `).join("");

  list.querySelectorAll(".choice-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest(".mark-row");
      const studentId = row.dataset.studentId;
      const status = btn.dataset.status;
      const dateVal = $("mark-date").value;

      btn.disabled = true;
      const { error } = await _supabase
        .from("attendance")
        .upsert(
          { student_id: studentId, date: dateVal, status: status, marked_by: currentProfile.id },
          { onConflict: "student_id,date" }
        );
      btn.disabled = false;

      if (error) {
        showToast("Error saving: " + error.message);
        return;
      }
      row.querySelectorAll(".choice-btn").forEach((b) => b.classList.remove("p-active", "a-active"));
      btn.classList.add(status === "Present" ? "p-active" : "a-active");
      showToast(`Marked ${status} for ${row.querySelector(".mark-name").textContent.trim()}`);
    });
  });
}

async function loadStudentsTable() {
  const tbody = $("students-tbody");
  const students = await fetchAllStudents();

  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4"><p class="empty-state">No students yet.</p></td></tr>`;
    return;
  }

  tbody.innerHTML = students.map((s) => `
    <tr data-student-id="${s.id}">
      <td data-label="ID">${escapeHtml(s.student_code || "—")}</td>
      <td data-label="Name" class="cell-name">${escapeHtml(s.full_name)}</td>
      <td data-label="Class" class="cell-class">${escapeHtml(s.class_name || "—")}</td>
      <td data-label="Actions">
        <button class="btn btn-ghost btn-sm edit-btn">Edit</button>
        <button class="btn btn-ghost btn-sm history-btn">History</button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll(".history-btn").forEach((btn) => {
    const tr = btn.closest("tr");
    btn.addEventListener("click", () => showStudentHistory(tr.dataset.studentId, tr.querySelector(".cell-name").textContent));
  });

  tbody.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => startEditStudentRow(btn.closest("tr")));
  });
}

function startEditStudentRow(tr) {
  const studentId = tr.dataset.studentId;
  const nameCell = tr.querySelector(".cell-name");
  const classCell = tr.querySelector(".cell-class");
  const currentName = nameCell.textContent;
  const currentClass = classCell.textContent === "—" ? "" : classCell.textContent;

  nameCell.innerHTML = `<input type="text" class="inline-input edit-name" value="${escapeHtml(currentName)}">`;
  classCell.innerHTML = `<input type="text" class="inline-input edit-class" value="${escapeHtml(currentClass)}">`;

  const actionsCell = tr.querySelector("td:last-child");
  actionsCell.innerHTML = `
    <button class="btn btn-primary btn-sm save-btn">Save</button>
    <button class="btn btn-ghost btn-sm cancel-btn">Cancel</button>
  `;

  actionsCell.querySelector(".cancel-btn").addEventListener("click", loadStudentsTable);
  actionsCell.querySelector(".save-btn").addEventListener("click", async () => {
    const newName = tr.querySelector(".edit-name").value.trim();
    const newClass = tr.querySelector(".edit-class").value.trim();
    if (!newName) {
      showToast("Name cannot be empty.");
      return;
    }

    const { error } = await _supabase
      .from("profiles")
      .update({ full_name: newName, class_name: newClass || null })
      .eq("id", studentId);

    if (error) {
      showToast("Error saving: " + error.message);
      return;
    }
    showToast("Student updated.");
    loadStudentsTable();
  });
}

async function showStudentHistory(studentId, name) {
  const panel = $("student-history-panel");
  panel.style.display = "block";
  $("student-history-title").textContent = `Attendance history — ${name.trim()}`;
  const tbody = $("student-history-tbody");
  tbody.innerHTML = `<tr><td colspan="2"><p class="empty-state">Loading…</p></td></tr>`;
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });

  const { data, error } = await _supabase
    .from("attendance")
    .select("date, status")
    .eq("student_id", studentId)
    .order("date", { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="2">Error: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="2"><p class="empty-state">No attendance recorded yet.</p></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((r) => `
    <tr>
      <td data-label="Date">${r.date}</td>
      <td data-label="Status"><span class="pill ${r.status === "Present" ? "present" : "absent"}">${r.status}</span></td>
    </tr>
  `).join("");
}

async function handleAddStudent(e) {
  e.preventDefault();
  setFieldError("add-student-error", "");

  const fullName = $("new-full-name").value.trim();
  const studentCode = $("new-student-code").value.trim();
  const className = $("new-class").value.trim();
  const password = $("new-password").value;
  const btn = $("add-student-btn");

  if (!fullName || !studentCode || !password) {
    setFieldError("add-student-error", "Please fill in all required fields.");
    return;
  }
  if (password.length < 6) {
    setFieldError("add-student-error", "Password must be at least 6 characters.");
    return;
  }

  setButtonLoading(btn, true, "Adding…", "Add student");

  // A separate, non-persisted client is used here so that creating the
  // new student's account does not touch (or clobber) the teacher's own
  // signed-in session, which lives in the shared browser storage.
  const tempClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const email = studentCodeToEmail(studentCode);
  const { data: signUpData, error: signUpError } = await tempClient.auth.signUp({ email, password });

  if (signUpError) {
    setButtonLoading(btn, false, "", "Add student");
    setFieldError(
      "add-student-error",
      signUpError.message.toLowerCase().includes("registered")
        ? "That Student ID is already in use."
        : signUpError.message
    );
    return;
  }

  if (!signUpData.session) {
    setButtonLoading(btn, false, "", "Add student");
    setFieldError(
      "add-student-error",
      'Account created but not confirmed. Ask the admin to disable "Confirm email" in Supabase Auth settings (see setup steps).'
    );
    return;
  }

  const { error: profileError } = await tempClient.from("profiles").insert({
    id: signUpData.user.id,
    role: "student",
    full_name: fullName,
    student_code: studentCode,
    class_name: className || null,
  });

  setButtonLoading(btn, false, "", "Add student");

  if (profileError) {
    setFieldError("add-student-error", "Account created, but saving the profile failed: " + profileError.message);
    return;
  }

  showToast(`${fullName} added successfully.`);
  $("add-student-form").reset();
  loadStudentsTable();
  loadMarkList($("mark-date").value);
}
