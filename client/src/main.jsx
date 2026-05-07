import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarDays,
  CheckCircle2,
  LayoutDashboard,
  LogOut,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Users
} from "lucide-react";
import "./styles.css";

const statusLabels = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done"
};

const priorityLabels = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High"
};

const emptyTaskForm = {
  title: "",
  description: "",
  dueDate: "",
  priority: "MEDIUM",
  assigneeId: ""
};

function apiClient(token) {
  async function request(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });

    if (response.status === 204) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "Request failed");
    return payload;
  }

  return {
    request,
    get: (path) => request(path),
    post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
    patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) }),
    delete: (path) => request(path, { method: "DELETE" })
  };
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const client = useMemo(() => apiClient(), []);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = mode === "signup"
        ? await client.post("/api/auth/signup", form)
        : await client.post("/api/auth/login", { email: form.email, password: form.password });
      onAuth(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <p className="eyebrow">Collaborative workspace</p>
          <h1>Team Task Manager</h1>
          <p className="lede">Create projects, assign ownership, and keep status visible across the team.</p>
        </div>
        <form onSubmit={submit} className="auth-form">
          <div className="segmented">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Login</button>
            <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Signup</button>
          </div>
          {mode === "signup" && (
            <label>
              Name
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required minLength={2} />
            </label>
          )}
          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </label>
          <label>
            Password
            <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={mode === "signup" ? 8 : 1} />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary" disabled={loading}>{loading ? "Working..." : mode === "signup" ? "Create account" : "Sign in"}</button>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ stats }) {
  return (
    <section className="dashboard-band">
      <div className="metric">
        <LayoutDashboard size={20} />
        <span>Total tasks</span>
        <strong>{stats?.totalTasks ?? 0}</strong>
      </div>
      <div className="metric">
        <Users size={20} />
        <span>Projects</span>
        <strong>{stats?.projectCount ?? 0}</strong>
      </div>
      <div className="metric">
        <CheckCircle2 size={20} />
        <span>Done</span>
        <strong>{stats?.byStatus?.DONE ?? 0}</strong>
      </div>
      <div className="metric alert">
        <CalendarDays size={20} />
        <span>Overdue</span>
        <strong>{stats?.overdueTasks?.length ?? 0}</strong>
      </div>
    </section>
  );
}

function ProjectList({ projects, selectedId, onSelect, onCreate }) {
  const [form, setForm] = useState({ name: "", description: "" });

  function submit(event) {
    event.preventDefault();
    onCreate(form);
    setForm({ name: "", description: "" });
  }

  return (
    <aside className="sidebar">
      <form onSubmit={submit} className="create-project">
        <input placeholder="New project" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <textarea placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <button className="icon-text"><Plus size={16} /> Create</button>
      </form>
      <nav className="project-nav">
        {projects.map((project) => (
          <button key={project.id} className={project.id === selectedId ? "selected" : ""} onClick={() => onSelect(project.id)}>
            <span>{project.name}</span>
            <small>{project.role} · {project.taskCount} tasks</small>
          </button>
        ))}
      </nav>
    </aside>
  );
}

function Members({ project, onAddMember, onRemoveMember }) {
  const [email, setEmail] = useState("");
  const isAdmin = project?.role === "ADMIN";

  function submit(event) {
    event.preventDefault();
    onAddMember(email);
    setEmail("");
  }

  return (
    <section className="panel members-panel">
      <div className="panel-heading">
        <h2>Members</h2>
        <Shield size={18} />
      </div>
      {isAdmin && (
        <form onSubmit={submit} className="inline-form">
          <input type="email" placeholder="member@email.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <button className="icon-only" title="Add member"><Plus size={17} /></button>
        </form>
      )}
      <div className="member-list">
        {project?.members?.map((member) => (
          <div key={member.user.id} className="member-row">
            <span>{member.user.name}</span>
            <small>{member.role}</small>
            {isAdmin && member.role !== "ADMIN" && (
              <button className="ghost-icon" title="Remove member" onClick={() => onRemoveMember(member.user.id)}><Trash2 size={15} /></button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function TaskComposer({ project, onCreateTask }) {
  const [form, setForm] = useState(emptyTaskForm);
  const isAdmin = project?.role === "ADMIN";

  useEffect(() => {
    const firstMember = project?.members?.[0]?.user?.id || "";
    setForm((current) => ({ ...emptyTaskForm, assigneeId: firstMember || current.assigneeId }));
  }, [project?.id]);

  if (!isAdmin) return null;

  function submit(event) {
    event.preventDefault();
    onCreateTask({ ...form, dueDate: new Date(form.dueDate).toISOString() });
    setForm({ ...emptyTaskForm, assigneeId: project.members[0]?.user.id || "" });
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Create task</h2>
        <Plus size={18} />
      </div>
      <form onSubmit={submit} className="task-form">
        <input placeholder="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
        <textarea placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <div className="form-grid">
          <input type="datetime-local" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} required />
          <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
            {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={form.assigneeId} onChange={(event) => setForm({ ...form, assigneeId: event.target.value })} required>
            {project.members.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.name}</option>)}
          </select>
        </div>
        <button className="primary">Add task</button>
      </form>
    </section>
  );
}

function TaskBoard({ tasks, project, onUpdateTask, onDeleteTask }) {
  const isAdmin = project?.role === "ADMIN";
  const grouped = Object.keys(statusLabels).map((status) => ({
    status,
    tasks: tasks.filter((task) => task.status === status)
  }));

  return (
    <section className="board">
      {grouped.map((group) => (
        <div key={group.status} className="lane">
          <h3>{statusLabels[group.status]}</h3>
          <div className="task-list">
            {group.tasks.map((task) => (
              <article key={task.id} className={`task priority-${task.priority.toLowerCase()}`}>
                <div className="task-topline">
                  <strong>{task.title}</strong>
                  <span>{priorityLabels[task.priority]}</span>
                </div>
                {task.description && <p>{task.description}</p>}
                <div className="task-meta">
                  <span>{task.assignee.name}</span>
                  <span>{formatDate(task.dueDate)}</span>
                </div>
                <div className="task-actions">
                  <select value={task.status} onChange={(event) => onUpdateTask(task.id, { status: event.target.value })}>
                    {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  {isAdmin && (
                    <>
                      <select value={task.assigneeId} onChange={(event) => onUpdateTask(task.id, { assigneeId: event.target.value })}>
                        {project.members.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.name}</option>)}
                      </select>
                      <button className="ghost-icon" title="Delete task" onClick={() => onDeleteTask(task.id)}><Trash2 size={15} /></button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const client = useMemo(() => apiClient(token), [token]);
  const selectedProject = projects.find((project) => project.id === selectedId);

  async function refresh() {
    if (!token) return;
    setLoading(true);
    setMessage("");
    try {
      const [mePayload, projectPayload, dashboardPayload] = await Promise.all([
        client.get("/api/auth/me"),
        client.get("/api/projects"),
        client.get("/api/dashboard")
      ]);
      setUser(mePayload.user);
      setProjects(projectPayload.projects);
      setStats(dashboardPayload);
      setSelectedId((current) => current || projectPayload.projects[0]?.id || "");
    } catch (err) {
      setMessage(err.message);
      logout();
    } finally {
      setLoading(false);
    }
  }

  async function refreshTasks(projectId = selectedId) {
    if (!projectId) return setTasks([]);
    const payload = await client.get(`/api/projects/${projectId}/tasks`);
    setTasks(payload.tasks);
  }

  useEffect(() => {
    refresh();
  }, [token]);

  useEffect(() => {
    refreshTasks();
  }, [selectedId, token]);

  function onAuth(payload) {
    localStorage.setItem("token", payload.token);
    setToken(payload.token);
    setUser(payload.user);
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setProjects([]);
    setTasks([]);
    setStats(null);
  }

  async function runAction(action) {
    setMessage("");
    try {
      await action();
      await refresh();
      await refreshTasks();
    } catch (err) {
      setMessage(err.message);
    }
  }

  if (!token) return <AuthScreen onAuth={onAuth} />;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Signed in as {user?.name}</p>
          <h1>Team Task Manager</h1>
        </div>
        <div className="header-actions">
          <button className="icon-only" title="Refresh" onClick={refresh} disabled={loading}><RefreshCw size={18} /></button>
          <button className="icon-text" onClick={logout}><LogOut size={17} /> Logout</button>
        </div>
      </header>

      <Dashboard stats={stats} />

      {message && <p className="toast">{message}</p>}

      <div className="workspace">
        <ProjectList
          projects={projects}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreate={(form) => runAction(async () => {
            const payload = await client.post("/api/projects", form);
            setSelectedId(payload.project.id);
          })}
        />

        <section className="project-space">
          {selectedProject ? (
            <>
              <div className="project-heading">
                <div>
                  <p className="eyebrow">{selectedProject.role}</p>
                  <h2>{selectedProject.name}</h2>
                  <p>{selectedProject.description}</p>
                </div>
              </div>
              <div className="management-grid">
                <Members
                  project={selectedProject}
                  onAddMember={(email) => runAction(() => client.post(`/api/projects/${selectedProject.id}/members`, { email }))}
                  onRemoveMember={(userId) => runAction(() => client.delete(`/api/projects/${selectedProject.id}/members/${userId}`))}
                />
                <TaskComposer
                  project={selectedProject}
                  onCreateTask={(form) => runAction(() => client.post(`/api/projects/${selectedProject.id}/tasks`, form))}
                />
              </div>
              <TaskBoard
                tasks={tasks}
                project={selectedProject}
                onUpdateTask={(taskId, patch) => runAction(() => client.patch(`/api/tasks/${taskId}`, patch))}
                onDeleteTask={(taskId) => runAction(() => client.delete(`/api/tasks/${taskId}`))}
              />
              <section className="panel analytics-panel">
                <h2>Tasks per user</h2>
                <div className="bars">
                  {Object.entries(stats?.perUser || {}).map(([name, count]) => (
                    <div key={name} className="bar-row">
                      <span>{name}</span>
                      <div><i style={{ width: `${Math.max(12, count * 28)}px` }} /></div>
                      <strong>{count}</strong>
                    </div>
                  ))}
                </div>
                {stats?.overdueTasks?.length > 0 && (
                  <div className="overdue-list">
                    {stats.overdueTasks.map((task) => (
                      <p key={task.id}>{task.title} · {task.project} · due {formatDate(task.dueDate)}</p>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="empty-state">
              <h2>Create your first project</h2>
              <p>Projects organize members, tasks, assignments, and dashboard reporting.</p>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
