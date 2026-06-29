'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  FolderPlus, 
  Terminal, 
  Settings, 
  RefreshCw, 
  Play, 
  Square, 
  Trash2, 
  Key, 
  Copy, 
  Check, 
  ExternalLink,
  Cpu,
  Layers,
  Activity,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  subdomain: string;
  port: number;
  framework: string;
  deploymentPath: string;
  buildFolder: string;
  pm2ProcessName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Deployment {
  id: string;
  projectId: string;
  status: string;
  commitMessage: string | null;
  version: string | null;
  createdAt: string;
  completedAt: string | null;
}

export default function Dashboard() {
  const [apiKey, setApiKey] = useState('');
  const [isKeyConfigured, setIsKeyConfigured] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [activeDeployment, setActiveDeployment] = useState<Deployment | null>(null);
  const [logs, setLogs] = useState<string>('');
  
  // Modals / Creation states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    subdomain: '',
    port: '',
    framework: 'nextjs',
    buildFolder: '',
    deploymentPath: '',
  });

  const [copiedCommand, setCopiedCommand] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Initialize and check key
  useEffect(() => {
    const savedKey = localStorage.getItem('vessel_api_key');
    if (savedKey) {
      setApiKey(savedKey);
      setIsKeyConfigured(true);
    }
  }, []);

  // Fetch Projects List
  const fetchProjects = useCallback(async (keyToUse = apiKey) => {
    if (!keyToUse) return;
    try {
      const res = await fetch('/api/projects', {
        headers: { 'x-api-key': keyToUse }
      });


      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        // Sync active project if selected
        if (activeProject) {
          const updated = data.find((p: Project) => p.id === activeProject.id);
          if (updated) setActiveProject(updated);
        }
      } else {
        if (res.status === 401) {
          setIsKeyConfigured(false);
          localStorage.removeItem('vessel_api_key');
        }
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  }, [apiKey, activeProject]);

  // Fetch Deployments & Logs
  const fetchDeploymentsAndLogs = useCallback(async (projectId: string) => {
    // For simplicity, we can fetch all logs or deployment history.
    // Let's call /api/logs with the deploymentId if selected
    // First, let's fetch deployments using a custom sub-query or simulate based on API
    // Since we don't have separate GET /api/deployments, we can fetch projects with details or query
  }, []);

  // Trigger projects fetch when key is set
  useEffect(() => {
    if (isKeyConfigured) {
      fetchProjects();
      const interval = setInterval(() => fetchProjects(), 5000);
      return () => clearInterval(interval);
    }
  }, [isKeyConfigured, fetchProjects]);

  const saveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      localStorage.setItem('vessel_api_key', apiKey.trim());
      setIsKeyConfigured(true);
      setMessage({ text: 'API Key configured successfully.', type: 'success' });
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(newProject),
      });

      const data = await res.json();
      if (res.ok) {
        setShowCreateModal(false);
        setNewProject({
          name: '',
          subdomain: '',
          port: '',
          framework: 'nextjs',
          buildFolder: '',
          deploymentPath: '',
        });
        fetchProjects();
        setMessage({ text: 'Project created successfully and Nginx registered!', type: 'success' });
      } else {
        setMessage({ text: data.error || 'Failed to create project', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Network error occurred.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Are you absolutely sure you want to delete this project? This will remove PM2 process and Nginx configuration.')) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': apiKey },
      });

      if (res.ok) {
        setActiveProject(null);
        fetchProjects();
        setMessage({ text: 'Project deleted successfully.', type: 'success' });
      } else {
        const data = await res.json();
        setMessage({ text: data.error || 'Failed to delete project', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Network error occurred.', type: 'error' });
    }
  };

  const handlePM2Action = async (id: string, action: 'restart' | 'stop') => {
    try {
      // Patch project status or run a command
      // In this setup, we can trigger actions via PATCH /api/projects/[id]
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          status: action === 'restart' ? 'deploying' : 'idle',
        }),
      });

      if (res.ok) {
        fetchProjects();
        setMessage({ text: `Application ${action} triggered.`, type: 'success' });
      } else {
        const data = await res.json();
        setMessage({ text: data.error || `Failed to ${action} application`, type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Network error occurred.', type: 'error' });
    }
  };

  // Generate Curl CLI command for the developer to deploy
  const getCurlCommand = (project: Project) => {
    const host = typeof window !== 'undefined' ? window.location.origin : 'http://your-vps-ip';
    return `# 1. Build your app locally\nbun run build\n\n# 2. Package your build folder and package.json\ntar -czf app.tar.gz ${project.buildFolder} package.json node_modules\n\n# 3. Upload & Deploy to Vessel VPS\ncurl -X POST \\\n  -H "X-API-Key: ${apiKey}" \\\n  -H "X-Project-Id: ${project.id}" \\\n  -H "X-Version: 1.0.0" \\\n  -F "file=@app.tar.gz" \\\n  ${host}/api/deploy`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#070709] text-neutral-100 selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-neutral-900 bg-neutral-950/70 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl shadow-lg shadow-indigo-500/20">
            <Layers className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">VESSEL</h1>
            <p className="text-xs text-neutral-500">Self-Hosted Developer Console</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isKeyConfigured ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Connected
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
              <span className="h-1.5 w-1.5 bg-rose-500 rounded-full animate-pulse" />
              Lockdown Mode
            </div>
          )}
          
          <button 
            onClick={() => {
              setIsKeyConfigured(false);
              localStorage.removeItem('vessel_api_key');
            }} 
            className="text-xs text-neutral-500 hover:text-neutral-300 font-medium transition"
          >
            Clear Session Key
          </button>
        </div>
      </header>

      {/* API Key Modal Form if not configured */}
      {!isKeyConfigured && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-neutral-950/80 border border-neutral-900 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-indigo-500/10 text-indigo-400 mx-auto mb-6">
              <Key className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold text-center mb-2">Configure Console Key</h2>
            <p className="text-neutral-400 text-sm text-center mb-6">
              Vessel is currently in lockdown mode. Enter the system `INTERNAL_API_KEY` to unlock the dashboard.
            </p>
            <form onSubmit={saveApiKey} className="space-y-4">
              <div>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter secret API Key..."
                  className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-indigo-500 focus:outline-none transition font-mono text-sm"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium rounded-xl transition shadow-lg shadow-indigo-600/20"
              >
                Access Dashboard
              </button>
            </form>
          </div>
        </div>
      )}

      {isKeyConfigured && (
        <div className="flex-1 flex flex-col lg:flex-row">
          {/* Main Sidebar - Project List */}
          <aside className="w-full lg:w-80 border-r border-neutral-900 bg-neutral-950/30 p-6 flex flex-col gap-6 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Apps</span>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 rounded-lg text-xs font-medium transition"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Add App
              </button>
            </div>

            {/* List */}
            <div className="flex flex-col gap-2 overflow-y-auto">
              {projects.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-neutral-900 rounded-xl">
                  <p className="text-xs text-neutral-600 font-mono">No apps deployed yet.</p>
                </div>
              ) : (
                projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => setActiveProject(project)}
                    className={`w-full text-left p-3.5 rounded-xl border transition flex items-center justify-between ${
                      activeProject?.id === project.id
                        ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-100 shadow-lg shadow-indigo-500/5'
                        : 'bg-neutral-950/50 border-neutral-900 hover:border-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-semibold text-sm truncate">{project.name}</div>
                      <div className="text-xs font-mono text-neutral-500 truncate mt-0.5">{project.subdomain}</div>
                    </div>
                    
                    {/* Status indicator */}
                    <span className={`h-2 w-2 rounded-full shrink-0 ${
                      project.status === 'active' ? 'bg-emerald-500 shadow-md shadow-emerald-500/40' :
                      project.status === 'deploying' ? 'bg-amber-500 animate-pulse shadow-md shadow-amber-500/40' :
                      project.status === 'failed' ? 'bg-rose-500 shadow-md shadow-rose-500/40' :
                      'bg-neutral-600'
                    }`} />
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* Core Content View */}
          <main className="flex-1 p-6 lg:p-8 flex flex-col gap-6 overflow-y-auto">
            {/* Global Notify Message */}
            {message && (
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                message.type === 'success' 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}>
                <span className="text-sm font-medium">{message.text}</span>
                <button onClick={() => setMessage(null)} className="text-xs hover:underline font-mono">Dismiss</button>
              </div>
            )}

            {activeProject ? (
              <div className="space-y-6">
                {/* Project Header card */}
                <div className="bg-neutral-950 border border-neutral-900 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute right-0 top-0 p-8 opacity-5 pointer-events-none">
                    <Sparkles className="h-32 w-32 text-indigo-500" />
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider bg-neutral-900 border border-neutral-800 text-neutral-400">
                          {activeProject.framework}
                        </span>
                        <span className="text-xs font-mono text-neutral-500">Port {activeProject.port}</span>
                      </div>
                      <h2 className="text-2xl font-bold tracking-tight text-white mb-1">{activeProject.name}</h2>
                      <a 
                        href={`http://${activeProject.subdomain}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 font-mono"
                      >
                        {activeProject.subdomain}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    <div className="flex items-center gap-2">
                      {activeProject.framework !== 'static' && (
                        <>
                          <button
                            onClick={() => handlePM2Action(activeProject.id, 'restart')}
                            className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold transition"
                          >
                            <Play className="h-3.5 w-3.5 text-emerald-400" />
                            Start / Restart
                          </button>
                          <button
                            onClick={() => handlePM2Action(activeProject.id, 'stop')}
                            className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold transition"
                          >
                            <Square className="h-3.5 w-3.5 text-amber-500" />
                            Stop
                          </button>
                        </>
                      )}
                      
                      <button
                        onClick={() => handleDeleteProject(activeProject.id)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-neutral-900">
                    <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-900/60">
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">PM2 Name</span>
                      <div className="font-mono text-sm text-neutral-200 mt-1 truncate">{activeProject.pm2ProcessName}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-900/60">
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Deploy Directory</span>
                      <div className="font-mono text-sm text-neutral-200 mt-1 truncate">{activeProject.deploymentPath}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-900/60">
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Build Output Folder</span>
                      <div className="font-mono text-sm text-neutral-200 mt-1 truncate">{activeProject.buildFolder}</div>
                    </div>
                  </div>
                </div>

                {/* Instructions & CLI tools */}
                <div className="bg-neutral-950 border border-neutral-900 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Terminal className="h-5 w-5 text-indigo-400" />
                      <h3 className="font-semibold text-base">Deployment CLI instructions</h3>
                    </div>
                    <button
                      onClick={() => copyToClipboard(getCurlCommand(activeProject))}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-xs font-medium transition"
                    >
                      {copiedCommand ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-neutral-400" />
                          Copy Shell script
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="bg-neutral-900 p-4 rounded-xl text-xs font-mono text-neutral-300 overflow-x-auto leading-relaxed border border-neutral-800/50">
                    {getCurlCommand(activeProject)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center border border-neutral-900 rounded-3xl bg-neutral-950/20 p-8 min-h-[400px]">
                <div className="h-14 w-14 rounded-2xl bg-neutral-900 border border-neutral-850 flex items-center justify-center text-neutral-500 mb-4">
                  <Activity className="h-6 w-6 animate-pulse" />
                </div>
                <h3 className="text-lg font-semibold text-white">Select or Deploy an App</h3>
                <p className="text-sm text-neutral-500 max-w-sm text-center mt-1">
                  Choose a project from the left sidebar to view logs, configure settings, or trigger new builds.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-6 flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium rounded-xl transition shadow-lg shadow-indigo-600/20"
                >
                  <FolderPlus className="h-4 w-4" />
                  Create First Project
                </button>
              </div>
            )}
          </main>
        </div>
      )}

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-neutral-950 border border-neutral-900 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Create New Project</h2>
            
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-neutral-500 font-semibold uppercase tracking-wider mb-1">Project Name</label>
                  <input
                    type="text"
                    required
                    placeholder="My Portfolio"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-sm focus:border-indigo-500 focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 font-semibold uppercase tracking-wider mb-1">Subdomain</label>
                  <input
                    type="text"
                    required
                    placeholder="portfolio.sujithc.online"
                    value={newProject.subdomain}
                    onChange={(e) => setNewProject({ ...newProject, subdomain: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-sm focus:border-indigo-500 focus:outline-none transition font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-neutral-500 font-semibold uppercase tracking-wider mb-1">Port</label>
                  <input
                    type="number"
                    required
                    placeholder="3001"
                    value={newProject.port}
                    onChange={(e) => setNewProject({ ...newProject, port: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-sm focus:border-indigo-500 focus:outline-none transition font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 font-semibold uppercase tracking-wider mb-1">Framework</label>
                  <select
                    value={newProject.framework}
                    onChange={(e) => setNewProject({ ...newProject, framework: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-sm focus:border-indigo-500 focus:outline-none transition font-medium"
                  >
                    <option value="nextjs">Next.js (Node / Bun)</option>
                    <option value="bun">Bun App (src/index.ts)</option>
                    <option value="node">Node App (npm start)</option>
                    <option value="static">Static Webpage (Nginx direct)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-neutral-500 font-semibold uppercase tracking-wider mb-1">Build folder (Optional)</label>
                <input
                  type="text"
                  placeholder="Defaults to '.next' or 'dist'"
                  value={newProject.buildFolder}
                  onChange={(e) => setNewProject({ ...newProject, buildFolder: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-sm focus:border-indigo-500 focus:outline-none transition font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-500 font-semibold uppercase tracking-wider mb-1">VPS Deployment Directory (Optional)</label>
                <input
                  type="text"
                  placeholder="Defaults to /home/mdspl-sujith/sujith/apps/<process>"
                  value={newProject.deploymentPath}
                  onChange={(e) => setNewProject({ ...newProject, deploymentPath: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-sm focus:border-indigo-500 focus:outline-none transition font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {loading ? 'Registering...' : 'Register Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
