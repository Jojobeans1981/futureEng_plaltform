import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import AuthModal from './components/AuthModal';
import { ShieldCheck, PlusCircle, LogOut, CheckCircle2, AlertCircle, Loader2, Upload, Target, CheckSquare, History, FileText } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState(null);
  const [credits, setCredits] = useState(5);
  const [activeTab, setActiveTab] = useState('new'); // 'new', 'history', 'tasks'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [reports, setReports] = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [error, setError] = useState(null);

  const [uploadedFileName, setUploadedFileName] = useState('');
  const [documentContent, setDocumentContent] = useState('');

  const [formData, setFormData] = useState({
    companyName: '',
    industry: '',
    teamSize: '1-10',
    currentStack: '',
    revenueModel: '',
    monthlyRevenue: '',
    targetICP: '',
    conversionRate: '',
    painPoints: '',
    deliverableType: 'Actionable Step-by-Step Execution Plan',
    socialLinks: ''
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchHistory(session.user.id);
        fetchTasks(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchHistory(session.user.id);
        fetchTasks(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchHistory = async (userId) => {
    const { data } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (data) setReports(data);
  };

  const fetchTasks = async (userId) => {
    const { data } = await supabase
      .from('action_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (data) setActionItems(data);
  };

  const toggleTaskCompletion = async (taskId, currentStatus) => {
    const { error } = await supabase
      .from('action_items')
      .update({ completed: !currentStatus })
      .eq('id', taskId);

    if (!error) {
      setActionItems((prev) =>
        prev.map((item) => (item.id === taskId ? { ...item, completed: !currentStatus } : item))
      );
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setDocumentContent(event.target.result);
    };
    reader.readAsText(file);
  };

  const handleRunAnalysis = async (e) => {
    e.preventDefault();
    if (credits < 1) {
      setError('Insufficient credits. Purchase more credits to run an audit.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/audit/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          documentContent,
          userId: session.user.id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate analysis.');
      }

      setSelectedReport({ raw_report: data.report, company_name: formData.companyName });
      setCredits((prev) => prev - 1);
      setIsModalOpen(false);
      setActiveTab('report');
      fetchHistory(session.user.id);
      fetchTasks(session.user.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return <AuthModal />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <ShieldCheck className="w-7 h-7 text-emerald-400" />
          <span className="font-bold text-xl tracking-wider uppercase text-slate-100">FutureEng Workspace</span>
        </div>
        <div className="flex items-center space-x-6">
          <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded text-sm font-mono">
            Credits: <span className="text-emerald-400 font-bold">{credits}</span>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-slate-400 hover:text-red-400 transition"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-6xl mx-auto w-full">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-4">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('new')}
              className={`px-4 py-2 rounded text-sm font-medium transition flex items-center space-x-2 ${
                activeTab === 'new' || activeTab === 'report' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Current Diagnostic</span>
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-4 py-2 rounded text-sm font-medium transition flex items-center space-x-2 ${
                activeTab === 'tasks' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>Execution Board ({actionItems.filter(i => !i.completed).length})</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded text-sm font-medium transition flex items-center space-x-2 ${
                activeTab === 'history' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Audit Archive ({reports.length})</span>
            </button>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded shadow transition flex items-center space-x-2 text-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Analysis</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-950/50 border border-red-800 text-red-300 rounded flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Tab 1: Current Report */}
        {(activeTab === 'new' || activeTab === 'report') && (
          selectedReport ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-lg mb-4">
                <CheckCircle2 className="w-6 h-6" />
                <h2>Diagnostic Report: {selectedReport.company_name}</h2>
              </div>
              <div className="prose prose-invert max-w-none bg-slate-950 p-6 rounded border border-slate-800 text-slate-300 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                {selectedReport.raw_report}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-xl p-12 text-center">
              <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-slate-300 font-medium text-lg">No Active Diagnostic Selected</h3>
              <p className="text-slate-500 text-sm mt-1">Start a new analysis above or choose a historical report from the archive tab.</p>
            </div>
          )
        )}

        {/* Tab 2: Interactive Execution Board */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-100 mb-4">30-60-90 Day Execution Backlog</h2>
            {actionItems.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 p-8 text-center text-slate-500 rounded-xl">
                No action items generated yet. Run a business diagnostic to populate your task roadmap.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['30 Days', '60 Days', '90 Days'].map((timeframe) => (
                  <div key={timeframe} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <h3 className="font-bold text-emerald-400 text-sm uppercase mb-3 border-b border-slate-800 pb-2">
                      {timeframe} Goals
                    </h3>
                    <div className="space-y-3">
                      {actionItems
                        .filter((item) => item.timeframe === timeframe)
                        .map((item) => (
                          <div
                            key={item.id}
                            onClick={() => toggleTaskCompletion(item.id, item.completed)}
                            className={`p-3 rounded border cursor-pointer transition flex items-start space-x-3 ${
                              item.completed
                                ? 'bg-slate-950/40 border-slate-900 text-slate-500 line-through'
                                : 'bg-slate-950 border-slate-800 hover:border-emerald-500/50 text-slate-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={item.completed}
                              onChange={() => {}}
                              className="mt-1 rounded bg-slate-900 border-slate-800 text-emerald-500 focus:ring-0"
                            />
                            <div className="flex-1">
                              <p className="text-xs font-medium leading-snug">{item.title}</p>
                              <span className="inline-block text-[10px] uppercase tracking-wider text-slate-500 mt-1">
                                Owner: {item.owner}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Historical Audit Archive */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-100 mb-4">Saved Business Audits</h2>
            {reports.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 p-8 text-center text-slate-500 rounded-xl">
                No past reports found.
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((r) => (
                  <div
                    key={r.id}
                    className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between hover:border-slate-700 transition"
                  >
                    <div>
                      <h3 className="font-bold text-slate-100">{r.company_name}</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {r.deliverable_type} • {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedReport(r);
                        setActiveTab('report');
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs px-3 py-1.5 rounded border border-slate-700 transition"
                    >
                      View Report
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-100 mb-1">Deep Business Diagnostic Intake</h2>
            <p className="text-slate-400 text-xs mb-6">Provide technical, operational, and financial telemetry for diagnostic analysis.</p>

            <form onSubmit={handleRunAnalysis} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-medium text-emerald-400 mb-1 flex items-center">
                  <Target className="w-3.5 h-3.5 mr-1" />
                  <span>Desired Primary Deliverable</span>
                </label>
                <select
                  name="deliverableType"
                  value={formData.deliverableType}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-emerald-500/50 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-400 text-sm font-medium"
                >
                  <option value="Actionable Step-by-Step Execution Plan">Actionable Step-by-Step Execution Plan (30-60-90 Days)</option>
                  <option value="Updated Business Plan & Strategy">Updated Business Plan & Strategy (ICP, Pricing, GTM)</option>
                  <option value="Financial Projection & Revenue Optimization Table">Financial Projection & Revenue Optimization Table (Current vs. Proposed)</option>
                  <option value="Technical & Workflow Automation">Technical & Workflow Automation (Architecture & Integrations)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase font-medium text-slate-400 mb-1">Company Name</label>
                  <input
                    type="text"
                    name="companyName"
                    required
                    value={formData.companyName}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-medium text-slate-400 mb-1">Industry</label>
                  <input
                    type="text"
                    name="industry"
                    required
                    value={formData.industry}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs uppercase font-medium text-slate-400 mb-1">Team Size</label>
                  <select
                    name="teamSize"
                    value={formData.teamSize}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 text-sm"
                  >
                    <option value="1-10">1-10</option>
                    <option value="11-50">11-50</option>
                    <option value="51-200">51-200</option>
                    <option value="200+">200+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase font-medium text-slate-400 mb-1">Revenue Model</label>
                  <input
                    type="text"
                    name="revenueModel"
                    placeholder="SaaS, Agency, Retainers"
                    value={formData.revenueModel}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-medium text-slate-400 mb-1">Est. Monthly Revenue</label>
                  <input
                    type="text"
                    name="monthlyRevenue"
                    placeholder="e.g., $25k/mo"
                    value={formData.monthlyRevenue}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase font-medium text-slate-400 mb-1">Ideal Customer Profile (ICP)</label>
                  <input
                    type="text"
                    name="targetICP"
                    placeholder="e.g., Mid-market healthcare IT directors"
                    value={formData.targetICP}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-medium text-slate-400 mb-1">Key Conversion Metric / Rate</label>
                  <input
                    type="text"
                    name="conversionRate"
                    placeholder="e.g., 2% trial-to-paid, 15% demo close"
                    value={formData.conversionRate}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-medium text-slate-400 mb-1">Current Tech Stack & Tools</label>
                <input
                  type="text"
                  name="currentStack"
                  placeholder="e.g., React, Node, Hubspot, Stripe, Zapier, AWS"
                  required
                  value={formData.currentStack}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-medium text-slate-400 mb-1">Social Media / Web URLs</label>
                <input
                  type="text"
                  name="socialLinks"
                  placeholder="https://linkedin.com/company/example, https://example.com"
                  value={formData.socialLinks}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-medium text-slate-400 mb-1">Attach Documentation (P&L, SOPs, Tech Specs)</label>
                <div className="relative border border-dashed border-slate-800 bg-slate-950 rounded p-3 text-center">
                  <input
                    type="file"
                    accept=".txt,.md,.json,.csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  {uploadedFileName ? (
                    <span className="text-emerald-400 text-xs font-mono">{uploadedFileName}</span>
                  ) : (
                    <span className="text-slate-500 text-xs">Click or drag files (.txt, .md, .csv, .json)</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-medium text-slate-400 mb-1">Primary Operational Bottlenecks & Pain Points</label>
                <textarea
                  name="painPoints"
                  rows="3"
                  required
                  placeholder="Describe key friction points (e.g., manual lead intake takes 4 hours/day, 20% churn due to poor onboarding)..."
                  value={formData.painPoints}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 text-sm resize-none"
                ></textarea>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-5 py-2 rounded text-sm transition flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating Diagnostic...</span>
                    </>
                  ) : (
                    <span>Execute Diagnostic (1 Credit)</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}