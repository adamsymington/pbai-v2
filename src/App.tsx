import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Table as TableIcon, 
  ClipboardCheck, 
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Download,
  LayoutDashboard,
  MessageSquare,
  X,
  Send,
  Info,
  ShieldAlert,
  BarChart3,
  Target,
  Zap,
  Upload,
  FileSearch,
  FileSpreadsheet,
  FileCode,
  Activity,
  MoreHorizontal,
  Layout,
  Gauge,
  History,
  Coins,
  Link
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  analyzeDocument, 
  createCoachChat, 
  checkConsistency, 
  generateQASP, 
  generatePWST,
  getTokenLogs,
  clearTokenLogs
} from './services/gemini';
import { 
  AnalysisResult, 
  Requirement, 
  DocumentType, 
  ChatMessage, 
  SuggestedRewriteArc,
  TokenLogEntry,
  TokenRunSummary,
  TokenUsage,
  QaspItem,
  PwstItem
} from './types';
import { 
  exportAnalysisReport, 
  exportQaspData, 
  exportPwstData 
} from './services/export';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [content, setContent] = useState('');
  const [docType, setDocType] = useState<DocumentType>('PWS');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<'not_started' | 'in_progress' | 'complete' | 'failed'>('not_started');
  const [qaspStatus, setQaspStatus] = useState<'not_started' | 'in_progress' | 'complete' | 'failed'>('not_started');
  const [pwstStatus, setPwstStatus] = useState<'not_started' | 'in_progress' | 'complete' | 'failed'>('not_started');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'analysis' | 'requirements' | 'excluded' | 'qasp' | 'pwst'>('analysis');
  const [selectedReq, setSelectedReq] = useState<Requirement | null>(null);
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isCheckingConsistency, setIsCheckingConsistency] = useState(false);
  const [consistencyResult, setConsistencyResult] = useState<{ issues: string[], confidence_score: number } | null>(null);
  const [qasp, setQasp] = useState<QaspItem[] | null>(null);
  const [pwst, setPwst] = useState<PwstItem[] | null>(null);
  const [isGeneratingQASP, setIsGeneratingQASP] = useState(false);
  const [isGeneratingPWST, setIsGeneratingPWST] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [editedReqIds, setEditedReqIds] = useState<Set<string>>(new Set());
  const [qaspRefinement, setQaspRefinement] = useState('');
  const [showQaspPrompt, setShowQaspPrompt] = useState(false);
  const [showTokenInspector, setShowTokenInspector] = useState(false);
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [tokenLogs, setTokenLogs] = useState<TokenLogEntry[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const coachChatRef = useRef<any>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    setTokenLogs(getTokenLogs());
  }, []);

  const resetReports = () => {
    setAnalysisStatus('not_started');
    setQaspStatus('not_started');
    setPwstStatus('not_started');
    setResult(null);
    setQasp(null);
    setPwst(null);
    setConsistencyResult(null);
    setEditedReqIds(new Set());
  };

  const processFile = async (file: File) => {
    setIsUploading(true);
    resetReports(); // R1: Reset statuses on new document
    try {
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }
        setContent(fullText);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setContent(result.value);
      } else if (file.type === 'text/plain') {
        const text = await file.text();
        setContent(text);
      } else {
        alert('Unsupported file type. Please upload .txt, .pdf, or .docx');
      }
    } catch (error) {
      console.error('File upload failed:', error);
      alert('Failed to read file. Please try pasting the text instead.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleAnalyze = async () => {
    if (!content.trim()) return;
    
    // R5: Re-analyze confirmation
    if (analysisStatus === 'complete') {
      if (!confirm("Re-analysis will re-score the entire document and may change results. Proceed?")) {
        return;
      }
    }

    const run_id = `run_analyze_${Date.now()}`;
    setSelectedRunId(run_id);
    setIsAnalyzing(true);
    setAnalysisStatus('in_progress');
    setConsistencyResult(null);
    setQasp(null);
    setPwst(null);
    setQaspStatus('not_started');
    setPwstStatus('not_started');
    
    try {
      const data = await analyzeDocument(content, docType, run_id);
      setResult(data);
      setAnalysisStatus('complete');
      setActiveTab('analysis');
      
      // A1: Suspiciously low requirement count trigger
      const wordCount = content.split(/\s+/).filter(Boolean).length;
      const estimatedPages = Math.max(1, Math.ceil(wordCount / 500));
      const reqScored = data.document_metrics?.requirements_scored ?? 0;
      if (reqScored < Math.max(5, estimatedPages * 0.5)) {
        alert("Warning: Potential extraction miss detected. The number of requirements found is low relative to the document length. Consider running a Consistency Check.");
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      setAnalysisStatus('failed');
      alert('Failed to analyze document. Please try again.');
    } finally {
      setIsAnalyzing(false);
      setTokenLogs(getTokenLogs());
    }
  };

  const handleConsistencyCheck = async () => {
    if (!result) return;
    const run_id = `run_consistency_${Date.now()}`;
    setSelectedRunId(run_id);
    setIsCheckingConsistency(true);
    try {
      const data = await checkConsistency(result, run_id);
      setConsistencyResult(data);
    } catch (error) {
      console.error('Consistency check failed:', error);
    } finally {
      setIsCheckingConsistency(false);
      setTokenLogs(getTokenLogs());
    }
  };

  const handleGenerateQASP = async () => {
    if (!result) return;
    const run_id = `run_qasp_${Date.now()}`;
    setSelectedRunId(run_id);
    setIsGeneratingQASP(true);
    setQaspStatus('in_progress');
    try {
      const data = await generateQASP(result, qaspRefinement, run_id);
      setQasp(data);
      setQaspStatus('complete');
      setActiveTab('qasp');
      setShowQaspPrompt(false);
    } catch (error) {
      console.error('QASP generation failed:', error);
      setQaspStatus('failed');
    } finally {
      setIsGeneratingQASP(false);
      setTokenLogs(getTokenLogs());
    }
  };

  const handleGeneratePWST = async () => {
    if (!result || !qasp) return;
    const run_id = `run_pwst_${Date.now()}`;
    setSelectedRunId(run_id);
    setIsGeneratingPWST(true);
    setPwstStatus('in_progress');
    try {
      const data = await generatePWST(result, qasp, run_id);
      setPwst(data);
      setPwstStatus('complete');
      setActiveTab('pwst');
    } catch (error) {
      console.error('PWST generation failed:', error);
      setPwstStatus('failed');
    } finally {
      setIsGeneratingPWST(false);
      setTokenLogs(getTokenLogs());
    }
  };

  const openCoach = (req: Requirement) => {
    setSelectedReq(req);
    setIsCoachOpen(true);
    setChatMessages([
      { role: 'model', text: `Hello! I'm your PWS-INTEL-COACH. I've analyzed requirement ${req.req_id}. How can I help you refine it? I've already suggested a rewrite based on the ARC method.` }
    ]);
    const run_id = `run_coach_${Date.now()}`;
    setSelectedRunId(run_id);
    coachChatRef.current = createCoachChat(req, content, run_id);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !coachChatRef.current || !selectedReq) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsChatLoading(true);

    try {
      const response = await coachChatRef.current.sendMessage({ message: userMessage });
      
      // Check for function calls
      const functionCalls = response.functionCalls;
      if (functionCalls) {
        for (const call of functionCalls) {
          if (call.name === 'updateSuggestedRewrite') {
            const args = call.args as any;
            // Update the requirement in the result state
            if (result) {
              const updatedRequirements = result.requirements.map(r => 
                r.req_id === args.req_id 
                  ? { 
                      ...r, 
                      suggested_rewrite_arc: args.suggested_rewrite_arc, 
                      suggested_rewrite_statement: args.suggested_rewrite_statement 
                    } 
                  : r
              );
              setResult({ ...result, requirements: updatedRequirements });
              // R4: Mark requirement as collaboratively edited
              setEditedReqIds(prev => new Set(prev).add(args.req_id));
              
              // Also update selectedReq for the UI
              setSelectedReq(prev => prev ? { 
                ...prev, 
                suggested_rewrite_arc: args.suggested_rewrite_arc, 
                suggested_rewrite_statement: args.suggested_rewrite_statement 
              } : null);
            }
            setChatMessages(prev => [...prev, { role: 'model', text: "I've updated the suggested rewrite based on our discussion. You can see the changes in the requirement details." }]);
          }
        }
      } else {
        setChatMessages(prev => [...prev, { role: 'model', text: response.text }]);
      }
    } catch (error) {
      console.error('Chat failed:', error);
      setChatMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsChatLoading(false);
      setTokenLogs(getTokenLogs());
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    if (score >= 60) return 'text-amber-600 bg-amber-50 border-amber-100';
    return 'text-rose-600 bg-rose-50 border-rose-100';
  };

  const getCriticalityIcon = (crit: string) => {
    switch (crit) {
      case 'Critical Issue': return <ShieldAlert className="w-4 h-4 text-rose-500" />;
      case 'Major Issue': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'Minor Issue': return <Info className="w-4 h-4 text-blue-500" />;
      default: return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7F9] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-6 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md">
              <Zap className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">PWS Intelligence</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Requirement Reviewer + Coach</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowTokenInspector(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-amber-500 hover:bg-amber-50 rounded-lg transition-colors border border-amber-500"
            >
              <Link className="w-3.5 h-3.5" />
              TOKEN INSPECTOR
            </button>
            {result && (
              <div className="relative">
                <button 
                  onClick={() => setIsExportOpen(!isExportOpen)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-xs font-bold transition-all rounded-lg border",
                    isExportOpen 
                      ? "bg-slate-800 text-white border-slate-800" 
                      : "text-slate-600 hover:bg-slate-50 border-slate-200"
                  )}
                >
                  <Download className="w-3.5 h-3.5" />
                  EXPORT ANALYSIS
                  <ChevronDown className={cn("w-3 h-3 transition-transform", isExportOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {isExportOpen && (
                    <>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40"
                        onClick={() => setIsExportOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden"
                      >
                        <div className="p-1">
                          {(['xlsx', 'csv', 'pdf', 'docx'] as const).map((format) => (
                            <button
                              key={format}
                              onClick={() => {
                                exportAnalysisReport(result, format);
                                setIsExportOpen(false);
                              }}
                              className="w-full flex items-center justify-between px-4 py-2.5 text-left text-[11px] font-black text-slate-700 hover:bg-slate-50 rounded-lg transition-colors uppercase"
                            >
                              <span>{format === 'docx' ? 'Word Document' : format.toUpperCase()}</span>
                              <span className="text-[9px] text-slate-400">.{format}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {!result ? (
          <div className="max-w-4xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "bg-white rounded-2xl shadow-xl shadow-slate-200/50 border-2 p-8 transition-all relative",
                isDragging 
                  ? "border-indigo-500 bg-indigo-50/50 scale-[1.01]" 
                  : "border-slate-200"
              )}
            >
              {isDragging && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-indigo-600/10 backdrop-blur-[2px] rounded-2xl pointer-events-none">
                  <div className="bg-white p-4 rounded-2xl shadow-xl border border-indigo-100 flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center animate-bounce">
                      <Upload className="text-white w-6 h-6" />
                    </div>
                    <p className="text-sm font-black text-indigo-600 uppercase tracking-widest">Drop to Upload</p>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 mb-1">New Analysis</h2>
                  <p className="text-sm text-slate-500">Paste your acquisition document to begin the PBA maturity review.</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  {(['SOW', 'PWS', 'SOO'] as DocumentType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setDocType(type)}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                        docType === type 
                          ? "bg-white text-indigo-600 shadow-sm" 
                          : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative group">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste SOW/PWS/SOO content here..."
                  className="w-full h-80 p-6 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all resize-none font-mono text-sm leading-relaxed"
                />
                <div className="absolute bottom-4 right-4 flex items-center gap-4">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    accept=".txt,.pdf,.docx"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 hover:text-indigo-600 transition-all shadow-sm"
                  >
                    {isUploading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    UPLOAD FILE (.txt, .pdf, .docx)
                  </button>
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {content.split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
              </div>

              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !content.trim()}
                className={cn(
                  "w-full mt-8 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all text-sm uppercase tracking-widest",
                  isAnalyzing 
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-[0.99]"
                )}
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Analyzing Document...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Run Analyst
                  </>
                )}
              </button>
            </motion.div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Top Bar Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aggregate Score</p>
                </div>
                <div className="p-5 flex items-end gap-2">
                  <span className="text-3xl font-black text-slate-900">{Math.round(result.overall_document_score ?? 0)}</span>
                  <span className="text-slate-300 font-bold mb-1">/100</span>
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Requirements</p>
                </div>
                <div className="p-5 flex items-end gap-2">
                  <span className="text-3xl font-black text-slate-900">{result.document_metrics?.requirements_scored ?? 0}</span>
                  <span className="text-slate-300 font-bold mb-1">Scored</span>
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Doc Type</p>
                </div>
                <div className="p-5 flex items-end gap-2">
                  <span className="text-3xl font-black text-indigo-600">{result.document_type}</span>
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Excluded</p>
                </div>
                <div className="p-5 flex items-end gap-2">
                  <span className="text-3xl font-black text-slate-500">{result.document_metrics?.excluded_findings_count ?? 0}</span>
                  <span className="text-slate-300 font-bold mb-1">Items</span>
                </div>
              </motion.div>
            </div>

            <div className="space-y-6">
              {/* Main Workspace */}
              <div className="flex items-center justify-between">
                <div className="flex p-1 bg-slate-200/50 rounded-xl w-fit border-2 border-blue-400/50">
                  {[
                    { id: 'analysis', label: 'Overview', icon: LayoutDashboard },
                    { id: 'requirements', label: 'Requirements', icon: FileText },
                    { id: 'excluded', label: 'Excluded Findings', icon: ShieldAlert },
                    { id: 'qasp', label: 'QASP', icon: FileSearch, disabled: !qasp },
                    { id: 'pwst', label: 'PWST', icon: FileSpreadsheet, disabled: !pwst },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      disabled={tab.disabled}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black transition-all",
                        activeTab === tab.id 
                          ? "bg-white text-blue-600 shadow-sm" 
                          : "text-slate-500 hover:text-slate-700",
                        tab.disabled && "opacity-30 cursor-not-allowed"
                      )}
                    >
                      <tab.icon className="w-3.5 h-3.5" />
                      {tab.label.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <button
                    onClick={() => setIsToolsOpen(!isToolsOpen)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black transition-all shadow-sm",
                      isToolsOpen 
                        ? "bg-slate-800 text-white" 
                        : "bg-slate-300 text-slate-700 hover:bg-slate-400"
                    )}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                    ANALYSIS TOOLS
                  </button>

                  <AnimatePresence>
                    {isToolsOpen && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 bg-slate-900/5"
                        onClick={() => setIsToolsOpen(false)}
                      />
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {isToolsOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden"
                      >
                          <div className="p-2 space-y-1">
                            <button
                              onClick={() => { setShowInsightsModal(true); setIsToolsOpen(false); }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-left text-[11px] font-black text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
                            >
                              <Gauge className="w-4 h-4 text-blue-600" />
                              VIEW DIMENSION INSIGHTS
                            </button>
                            
                            <div className="h-px bg-slate-100 mx-2 my-1" />

                            <button
                              onClick={() => { handleConsistencyCheck(); setIsToolsOpen(false); }}
                              disabled={isCheckingConsistency}
                              className="w-full flex items-center gap-3 px-4 py-3 text-left text-[11px] font-black text-slate-700 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50"
                            >
                              <ShieldAlert className="w-4 h-4 text-orange-600" />
                              {isCheckingConsistency ? "AUDITING..." : "RUN CONSISTENCY CHECK"}
                            </button>

                            <button
                              onClick={() => { setShowQaspPrompt(true); setIsToolsOpen(false); }}
                              disabled={isGeneratingQASP || analysisStatus !== 'complete'}
                              className="w-full flex items-center gap-3 px-4 py-3 text-left text-[11px] font-black text-slate-700 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50"
                            >
                              <FileSearch className="w-4 h-4 text-emerald-600" />
                              GENERATE QASP
                            </button>

                            <button
                              onClick={() => { handleGeneratePWST(); setIsToolsOpen(false); }}
                              disabled={isGeneratingPWST || qaspStatus !== 'complete'}
                              className="w-full flex items-center gap-3 px-4 py-3 text-left text-[11px] font-black text-slate-700 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50"
                            >
                              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                              GENERATE PWST
                            </button>

                            <div className="h-px bg-slate-100 mx-2 my-1" />

                            <button
                              onClick={() => { resetReports(); setIsToolsOpen(false); }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-left text-[11px] font-black text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            >
                              <RefreshCw className="w-4 h-4 text-red-600" />
                              RESET ANALYSIS
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {activeTab === 'analysis' && (
                  <motion.div
                    key="analysis"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-indigo-500" />
                          Dimension Averages
                        </h3>
                        <div className="space-y-4">
                          {Object.entries(result.dimension_averages ?? {}).map(([key, val]) => (
                            <div key={key}>
                              <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                <span>{key.replace('_', ' ')}</span>
                                <span>{Math.round(val)}%</span>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${val}%` }}
                                  className={cn(
                                    "h-full rounded-full",
                                    val >= 80 ? "bg-emerald-500" : val >= 60 ? "bg-amber-500" : "bg-rose-500"
                                  )}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Target className="w-4 h-4 text-indigo-500" />
                          High Impact Suggestions
                        </h3>
                        <ul className="space-y-3">
                          {(result.high_impact_suggestions ?? []).map((suggestion, i) => (
                            <li key={i} className="flex gap-3 text-sm text-slate-600 leading-relaxed">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                                {i + 1}
                              </span>
                              {suggestion}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {consistencyResult && (
                      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-indigo-500" />
                          Consistency Audit Results
                        </h3>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Confidence Score</span>
                            <span className={cn(
                              "text-xs font-black",
                              consistencyResult.confidence_score >= 90 ? "text-emerald-600" : "text-amber-600"
                            )}>
                              {consistencyResult.confidence_score}%
                            </span>
                          </div>
                          {consistencyResult.issues.length > 0 ? (
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {consistencyResult.issues.map((issue, i) => (
                                <li key={i} className="text-[11px] text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-100 flex gap-2">
                                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  {issue}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-[11px] text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex gap-2">
                              <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              No consistency issues detected.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                          <FileText className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-slate-900">Executive Summary</h3>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Document Analysis Overview</p>
                        </div>
                      </div>
                      <div className="prose prose-slate max-w-none">
                        <p className="text-slate-600 leading-relaxed italic">"{result.executive_summary}"</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                        <div>
                          <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <CheckCircle2 className="w-3 h-3" />
                            Key Strengths
                          </h4>
                          <ul className="space-y-3">
                            {result.strengths.map((s, i) => (
                              <li key={i} className="flex gap-3 text-sm text-slate-600 leading-relaxed">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <AlertCircle className="w-3 h-3" />
                            Areas for Improvement
                          </h4>
                          <ul className="space-y-3">
                            {result.areas_for_improvement.map((a, i) => (
                              <li key={i} className="flex gap-3 text-sm text-slate-600 leading-relaxed">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                                {a}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'requirements' && (
                    <motion.div
                      key="requirements"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4"
                    >
                      {(result.requirements ?? []).map((req) => (
                        <div 
                          key={req.req_id}
                          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group"
                        >
                          <div className="p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex flex-wrap gap-2">
                                <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-500 rounded uppercase tracking-widest">
                                  {req.classification}
                                </span>
                                {req.tags.map(tag => (
                                  <span key={tag} className="text-[9px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-500 rounded uppercase tracking-widest">
                                    {tag}
                                  </span>
                                ))}
                                {editedReqIds.has(req.req_id) && (
                                  <span className="text-[9px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded uppercase tracking-widest flex items-center gap-1">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    Collaboratively Edited
                                  </span>
                                )}
                              </div>
                              <div className={cn("text-xs font-black px-3 py-1 rounded-full border shadow-sm", getScoreColor(req.overall_score))}>
                                {req.overall_score}
                              </div>
                            </div>
                            
                            <p className="text-sm font-medium text-slate-800 leading-relaxed mb-6">
                              {req.original_text}
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                              <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                  {getCriticalityIcon(req.criticality)}
                                  Analysis
                                </h4>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                  {req.reasoning}
                                </p>
                              </div>
                              <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                  ARC Rewrite
                                </h4>
                                <p className="text-xs text-slate-800 font-bold leading-relaxed mb-2">
                                  {req.suggested_rewrite_statement}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  <span className="text-[8px] font-bold px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-400">A: {req.suggested_rewrite_arc.action}</span>
                                  <span className="text-[8px] font-bold px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-400">R: {req.suggested_rewrite_arc.result}</span>
                                  <span className="text-[8px] font-bold px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-400">C: {req.suggested_rewrite_arc.context}</span>
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                Source: {req.source_ref.section} | Method: {req.extraction_method}
                              </span>
                              <button 
                                onClick={() => openCoach(req)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                Discuss with Coach
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {activeTab === 'excluded' && (
                    <motion.div
                      key="excluded"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4"
                    >
                      {(result.excluded_findings ?? []).map((finding) => (
                        <div key={finding.finding_id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-500 rounded uppercase tracking-widest">
                              {finding.type}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                              ID: {finding.finding_id}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 italic mb-3">"{finding.text}"</p>
                          <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                            <p className="text-xs text-slate-600 font-medium">
                              <span className="font-bold text-slate-400 uppercase mr-2">Reason:</span>
                              {finding.reason_excluded}
                            </p>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {activeTab === 'qasp' && qasp && (
                    <motion.div
                      key="qasp"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                    >
                      <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Quality Assurance Surveillance Plan (QASP)</h3>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded uppercase tracking-widest mt-2 inline-block">Draft Generated</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Export As:</span>
                          {(['xlsx', 'csv', 'pdf', 'docx'] as const).map(format => (
                            <button
                              key={format}
                              onClick={() => exportQaspData(qasp, format)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black rounded-lg transition-all uppercase"
                            >
                              .{format}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="overflow-hidden border border-slate-100 rounded-xl">
                        <table className="w-full text-left border-collapse table-fixed">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="w-[25%] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Requirement Statement</th>
                              <th className="w-[15%] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Performance Objective</th>
                              <th className="w-[15%] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Performance Standard</th>
                              <th className="w-[15%] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Surveillance Method</th>
                              <th className="w-[15%] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Sampling Frequency</th>
                              <th className="w-[15%] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Incentive / Disincentive</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {qasp.map((item, i) => (
                              <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-3 py-3 text-[10px] font-bold text-indigo-600 leading-relaxed break-words whitespace-normal align-top">{item.requirement_statement}</td>
                                <td className="px-3 py-3 text-[10px] font-medium text-slate-800 leading-relaxed break-words whitespace-normal align-top">{item.performance_objective}</td>
                                <td className="px-3 py-3 text-[10px] text-slate-600 leading-relaxed break-words whitespace-normal align-top">{item.performance_standard}</td>
                                <td className="px-3 py-3 text-[10px] text-slate-600 leading-relaxed break-words whitespace-normal align-top">{item.surveillance_method}</td>
                                <td className="px-3 py-3 text-[10px] text-slate-600 leading-relaxed break-words whitespace-normal align-top">{item.sampling_frequency}</td>
                                <td className="px-3 py-3 text-[10px] text-slate-600 leading-relaxed break-words whitespace-normal align-top">{item.incentive_disincentive}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'pwst' && pwst && (
                    <motion.div
                      key="pwst"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                    >
                      <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Performance Work Summary Table (PWST)</h3>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded uppercase tracking-widest mt-2 inline-block">Draft Generated</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Export As:</span>
                          {(['xlsx', 'csv', 'pdf', 'docx'] as const).map(format => (
                            <button
                              key={format}
                              onClick={() => exportPwstData(pwst, format)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black rounded-lg transition-all uppercase"
                            >
                              .{format}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="overflow-hidden border border-slate-100 rounded-xl">
                        <table className="w-full text-left border-collapse table-fixed">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="w-[10%] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Task Ref</th>
                              <th className="w-[25%] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Performance Objective</th>
                              <th className="w-[20%] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Performance Standard</th>
                              <th className="w-[25%] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Acceptable Quality Level (AQL)</th>
                              <th className="w-[20%] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Surveillance Method</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {pwst.map((item, i) => (
                              <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-3 py-3 text-[10px] font-bold text-indigo-600 break-words whitespace-normal align-top">{item.pws_task_reference}</td>
                                <td className="px-3 py-3 text-[10px] font-medium text-slate-800 leading-relaxed break-words whitespace-normal align-top">{item.performance_objective}</td>
                                <td className="px-3 py-3 text-[10px] text-slate-600 leading-relaxed break-words whitespace-normal align-top">{item.performance_standard}</td>
                                <td className="px-3 py-3 text-[10px] text-slate-600 leading-relaxed break-words whitespace-normal align-top">{item.acceptable_quality_level}</td>
                                <td className="px-3 py-3 text-[10px] text-slate-600 leading-relaxed break-words whitespace-normal align-top">{item.surveillance_method}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </main>

      {/* Coaching Modal */}
      <AnimatePresence>
        {isCoachOpen && selectedReq && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-4xl h-[80vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <MessageSquare className="text-white w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">PWS-INTEL-COACH</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Requirement: {selectedReq.req_id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCoachOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* Chat Area */}
                <div className="flex-1 flex flex-col bg-slate-50">
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {chatMessages.map((msg, i) => (
                      <div 
                        key={i} 
                        className={cn(
                          "flex",
                          msg.role === 'user' ? "justify-end" : "justify-start"
                        )}
                      >
                        <div 
                          className={cn(
                            "max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                            msg.role === 'user' 
                              ? "bg-indigo-600 text-white rounded-tr-none" 
                              : "bg-white text-slate-700 border border-slate-200 rounded-tl-none"
                          )}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm">
                          <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-4 bg-white border-t border-slate-200">
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Ask the coach about mission intent or constraints..."
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500 transition-all"
                      />
                      <button 
                        onClick={handleSendMessage}
                        disabled={isChatLoading || !chatInput.trim()}
                        className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-slate-200 transition-all"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Context Sidebar */}
                <div className="w-80 border-l border-slate-200 bg-white p-6 overflow-y-auto space-y-6">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Original Requirement</h4>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium p-3 bg-slate-50 rounded-lg border border-slate-100 italic">
                      "{selectedReq.original_text}"
                    </p>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Suggested ARC Rewrite</h4>
                    <div className="space-y-3">
                      <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                        <p className="text-xs text-indigo-900 font-bold leading-relaxed">
                          {selectedReq.suggested_rewrite_statement}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[9px] font-bold">
                          <span className="text-slate-400 uppercase">Action</span>
                          <span className="text-slate-700">{selectedReq.suggested_rewrite_arc?.action ?? 'N/A'}</span>
                        </div>
                        <div className="flex items-center justify-between text-[9px] font-bold">
                          <span className="text-slate-400 uppercase">Result</span>
                          <span className="text-slate-700">{selectedReq.suggested_rewrite_arc?.result ?? 'N/A'}</span>
                        </div>
                        <div className="flex items-center justify-between text-[9px] font-bold">
                          <span className="text-slate-400 uppercase">Context</span>
                          <span className="text-slate-700">{selectedReq.suggested_rewrite_arc?.context ?? 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Probing Questions</h4>
                    <div className="space-y-2">
                      {selectedReq.probing_questions?.map((q, i) => (
                        <button 
                          key={i}
                          onClick={() => setChatInput(q)}
                          className="w-full text-left p-2.5 text-[10px] font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-100 transition-all leading-relaxed"
                        >
                          {q}
                        </button>
                      )) ?? <p className="text-[10px] text-slate-400 italic">No questions available.</p>}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QASP Refinement Prompt Modal */}
      <AnimatePresence>
        {showQaspPrompt && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl border border-slate-200"
            >
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest mb-4">QASP Generation</h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Before generating the QASP, confirm you've reviewed the key rewrites. You can provide any specific refinements or constraints to incorporate into the plan.
              </p>
              <textarea
                value={qaspRefinement}
                onChange={(e) => setQaspRefinement(e.target.value)}
                placeholder="Optional: Add refinements (e.g., 'Focus surveillance on security requirements', 'Use monthly inspections')..."
                className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 transition-all mb-6 resize-none"
              />
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowQaspPrompt(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-50 transition-all"
                >
                  CANCEL
                </button>
                <button 
                  onClick={handleGenerateQASP}
                  disabled={isGeneratingQASP}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                >
                  {isGeneratingQASP ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FileSearch className="w-3.5 h-3.5" />}
                  GENERATE NOW
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Insights Modal */}
      <AnimatePresence>
        {showInsightsModal && result && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Gauge className="text-white w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Analysis Insights</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dimension Scores & Recommendations</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowInsightsModal(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-indigo-500" />
                      Dimension Averages
                    </h3>
                    <div className="space-y-5">
                      {Object.entries(result.dimension_averages ?? {}).map(([key, val]) => (
                        <div key={key}>
                          <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                            <span>{key.replace('_', ' ')}</span>
                            <span>{Math.round(val)}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${val}%` }}
                              className={cn(
                                "h-full rounded-full",
                                val >= 80 ? "bg-emerald-500" : val >= 60 ? "bg-amber-500" : "bg-rose-500"
                              )}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <Target className="w-4 h-4 text-indigo-500" />
                      High Impact Suggestions
                    </h3>
                    <ul className="space-y-4">
                      {(result.high_impact_suggestions ?? []).map((suggestion, i) => (
                        <li key={i} className="flex gap-4 text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                            {i + 1}
                          </span>
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showTokenInspector && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[80vh] overflow-hidden rounded-3xl shadow-2xl border border-slate-200 flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <Coins className="text-amber-600 w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Token Usage Inspector</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Itemized AI Resource Audit</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      clearTokenLogs();
                      setTokenLogs([]);
                      setSelectedRunId(null);
                    }}
                    className="text-[10px] font-bold text-slate-400 hover:text-red-500 uppercase tracking-widest transition-all"
                  >
                    Clear History
                  </button>
                  <button 
                    onClick={() => setShowTokenInspector(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 transition-all"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="flex items-center gap-4 mb-8">
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Select Run</label>
                    <select 
                      value={selectedRunId || ''}
                      onChange={(e) => setSelectedRunId(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all"
                    >
                      <option value="">Select a run to inspect...</option>
                      {Array.from(new Set(tokenLogs.map(l => l.run_id))).reverse().map(runId => (
                        <option key={runId} value={runId}>{runId}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedRunId ? (
                  <div className="space-y-8">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {(() => {
                        const runEntries = tokenLogs.filter(l => l.run_id === selectedRunId);
                        const totals = runEntries.reduce((acc, curr) => ({
                          prompt: acc.prompt + curr.token_usage.prompt_tokens,
                          output: acc.output + curr.token_usage.output_tokens,
                          total: acc.total + curr.token_usage.total_tokens,
                          latency: acc.latency + (curr.latency_ms || 0)
                        }), { prompt: 0, output: 0, total: 0, latency: 0 });

                        return (
                          <>
                            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Total Tokens</span>
                              <div className="text-2xl font-black text-indigo-600">{totals.total.toLocaleString()}</div>
                              <div className="text-[10px] font-bold text-indigo-400 mt-1">
                                {totals.prompt.toLocaleString()} P / {totals.output.toLocaleString()} O
                              </div>
                            </div>
                            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-1">Total Latency</span>
                              <div className="text-2xl font-black text-emerald-600">{(totals.latency / 1000).toFixed(2)}s</div>
                              <div className="text-[10px] font-bold text-emerald-400 mt-1">
                                {runEntries.length} Agent Calls
                              </div>
                            </div>
                            <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
                              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block mb-1">Avg. Model</span>
                              <div className="text-sm font-black text-amber-600 uppercase truncate">
                                {runEntries[0]?.model || 'N/A'}
                              </div>
                              <div className="text-[10px] font-bold text-amber-400 mt-1">
                                {runEntries.some(e => e.is_estimate) ? 'Includes Estimates' : 'Exact Counts'}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Breakdown Table */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                      <table className="w-full text-left table-fixed">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="w-[45%] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Agent / Function</th>
                            <th className="w-[12%] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Prompt</th>
                            <th className="w-[12%] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Output</th>
                            <th className="w-[12%] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</th>
                            <th className="w-[19%] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {tokenLogs.filter(l => l.run_id === selectedRunId).map((entry) => (
                            <tr key={entry.id} className="hover:bg-slate-50/50 transition-all">
                              <td className="px-3 py-3 overflow-hidden align-top">
                                <div className="text-[10px] font-black text-slate-900 break-words whitespace-normal">{entry.agent}</div>
                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest break-words whitespace-normal">{entry.function}</div>
                              </td>
                              <td className="px-3 py-3 text-[10px] font-bold text-slate-600 align-top">{entry.token_usage.prompt_tokens.toLocaleString()}</td>
                              <td className="px-3 py-3 text-[10px] font-bold text-slate-600 align-top">{entry.token_usage.output_tokens.toLocaleString()}</td>
                              <td className="px-3 py-3 text-[10px] font-black text-indigo-600 align-top">{entry.token_usage.total_tokens.toLocaleString()}</td>
                              <td className="px-3 py-3 align-top">
                                {entry.is_estimate ? (
                                  <span className="text-[8px] font-black px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded uppercase tracking-widest">Estimate</span>
                                ) : (
                                  <span className="text-[8px] font-black px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded uppercase tracking-widest">Exact</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                    <History className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-sm font-bold uppercase tracking-widest">No run selected</p>
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => {
                    const data = JSON.stringify(tokenLogs.filter(l => l.run_id === selectedRunId), null, 2);
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `token-report-${selectedRunId}.json`;
                    a.click();
                  }}
                  disabled={!selectedRunId}
                  className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Run JSON
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="mt-20 border-t border-slate-200 py-12 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-slate-400">
            <Zap className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">PWS Intelligence v2.1</span>
          </div>
          <div className="flex items-center gap-8">
            <a href="#" className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors">Rubric</a>
            <a href="#" className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors">ARC Method</a>
            <a href="#" className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
