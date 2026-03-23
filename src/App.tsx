import React, { useState, useEffect, useRef } from 'react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer 
} from 'recharts';
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
  Home,
  GraduationCap,
  FileSearch,
  FileSpreadsheet,
  FileCode,
  Activity,
  MoreHorizontal,
  Layout,
  Gauge,
  History,
  Coins,
  Link,
  Brain,
  Filter,
  SortAsc,
  Check,
  ThumbsUp,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { 
  analyzeDocument, 
  createCoachChat, 
  checkConsistency, 
  generateQASP, 
  generatePWST,
  getTokenLogs,
  clearTokenLogs,
  runDirectedAnalysis,
  learnFromCorrection,
  getLearningStore
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
  PwstItem,
  ConsistencyResult,
  LearningEntry
} from './types';
import { 
  exportAnalysisReport, 
  exportComprehensiveExcelReport,
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
  const [content, setContent] = useState(() => localStorage.getItem('pws_content') || '');
  const [docType, setDocType] = useState<DocumentType>(() => (localStorage.getItem('pws_doctype') as DocumentType) || 'PWS');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [analysisStatus, setAnalysisStatus] = useState<'not_started' | 'in_progress' | 'complete' | 'failed'>('not_started');
  const [qaspStatus, setQaspStatus] = useState<'not_started' | 'in_progress' | 'complete' | 'failed'>('not_started');
  const [pwstStatus, setPwstStatus] = useState<'not_started' | 'in_progress' | 'complete' | 'failed'>('not_started');
  const [result, setResult] = useState<AnalysisResult | null>(() => {
    const saved = localStorage.getItem('pws_result');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState<'analysis' | 'requirements' | 'excluded' | 'qasp' | 'pwst'>(() => {
    return localStorage.getItem('pws_result') ? 'analysis' : 'analysis';
  });
  const [selectedReq, setSelectedReq] = useState<Requirement | null>(null);
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isCheckingConsistency, setIsCheckingConsistency] = useState(false);
  const [consistencyResult, setConsistencyResult] = useState<{ issues: string[], confidence_score: number } | null>(() => {
    const saved = localStorage.getItem('pws_consistency');
    return saved ? JSON.parse(saved) : null;
  });
  const [qasp, setQasp] = useState<QaspItem[] | null>(() => {
    const saved = localStorage.getItem('pws_qasp');
    return saved ? JSON.parse(saved) : null;
  });
  const [pwst, setPwst] = useState<PwstItem[] | null>(() => {
    const saved = localStorage.getItem('pws_pwst');
    return saved ? JSON.parse(saved) : null;
  });
  const [isGeneratingQASP, setIsGeneratingQASP] = useState(false);
  const [isGeneratingPWST, setIsGeneratingPWST] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [editedReqIds, setEditedReqIds] = useState<Set<string>>(new Set());
  const [qaspRefinement, setQaspRefinement] = useState('');
  const [showQaspPrompt, setShowQaspPrompt] = useState(false);
  const [showTokenInspector, setShowTokenInspector] = useState(false);
  const [showLearningModal, setShowLearningModal] = useState(false);
  const [learningEntries, setLearningEntries] = useState<LearningEntry[]>([]);
  const [isLearning, setIsLearning] = useState(false);
  const [isTrainingMode, setIsTrainingMode] = useState(false);
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [tokenLogs, setTokenLogs] = useState<TokenLogEntry[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [filterCriticality, setFilterCriticality] = useState<string>('all');
  const [filterClassification, setFilterClassification] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'score-asc' | 'score-desc' | 'id'>('id');
  const [resolvedReqIds, setResolvedReqIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('pws_resolved_reqs');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const coachChatRef = useRef<any>(null);

  useEffect(() => {
    if (result) setAnalysisStatus('complete');
  }, []);

  useEffect(() => {
    localStorage.setItem('pws_content', content);
  }, [content]);

  useEffect(() => {
    localStorage.setItem('pws_doctype', docType);
  }, [docType]);

  useEffect(() => {
    if (result) {
      localStorage.setItem('pws_result', JSON.stringify(result));
    } else {
      localStorage.removeItem('pws_result');
    }
  }, [result]);

  useEffect(() => {
    if (consistencyResult) {
      localStorage.setItem('pws_consistency', JSON.stringify(consistencyResult));
    } else {
      localStorage.removeItem('pws_consistency');
    }
  }, [consistencyResult]);

  useEffect(() => {
    if (qasp) {
      localStorage.setItem('pws_qasp', JSON.stringify(qasp));
    } else {
      localStorage.removeItem('pws_qasp');
    }
  }, [qasp]);

  useEffect(() => {
    if (pwst) {
      localStorage.setItem('pws_pwst', JSON.stringify(pwst));
    } else {
      localStorage.removeItem('pws_pwst');
    }
  }, [pwst]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    setTokenLogs(getTokenLogs());
    setLearningEntries(getLearningStore());
  }, []);

  useEffect(() => {
    localStorage.setItem('pws_resolved_reqs', JSON.stringify(Array.from(resolvedReqIds)));
  }, [resolvedReqIds]);

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
        toast.error('Unsupported file type. Please upload .txt, .pdf, or .docx');
      }
    } catch (error) {
      console.error('File upload failed:', error);
      toast.error('Failed to read file. Please try pasting the text instead.');
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
    setAnalysisStep('Initializing Analyst Agent...');
    setAnalysisStatus('in_progress');
    setConsistencyResult(null);
    setQasp(null);
    setPwst(null);
    setQaspStatus('not_started');
    setPwstStatus('not_started');
    
    try {
      const { result: data, consistency } = await runDirectedAnalysis(content, docType, run_id, (step) => setAnalysisStep(step));
      setResult(data);
      setConsistencyResult(consistency);
      setAnalysisStatus('complete');
      setActiveTab('analysis');
      
      // A1: Suspiciously low requirement count trigger
      const wordCount = content.split(/\s+/).filter(Boolean).length;
      const estimatedPages = Math.max(1, Math.ceil(wordCount / 500));
      const reqScored = data.document_metrics?.requirements_scored ?? 0;
      if (reqScored < Math.max(5, estimatedPages * 0.5)) {
        toast.warning("Warning: Potential extraction miss detected. The number of requirements found is low relative to the document length. Consider running a Consistency Check.");
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      setAnalysisStatus('failed');
      toast.error('Failed to analyze document. Please try again.');
    } finally {
      setIsAnalyzing(false);
      setTokenLogs(getTokenLogs());
    }
  };

  const handleLearn = async (req: Requirement, userCorrection: string, userReasoning: string = "") => {
    const run_id = `run_learn_${Date.now()}`;
    setSelectedRunId(run_id);
    setIsLearning(true);
    try {
      const entry = await learnFromCorrection(req.original_text, req.suggested_rewrite_statement, userCorrection, userReasoning, run_id);
      setLearningEntries(prev => [entry, ...prev]);
      toast.success("Lesson learned! This correction will help improve future analyses.");
    } catch (error) {
      console.error('Learning failed:', error);
      toast.error('Failed to process correction. Please try again.');
    } finally {
      setIsLearning(false);
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

  const Tooltip = ({ text, children }: { text: string, children: React.ReactNode }) => (
    <div className="group relative inline-block">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-xl z-50">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800" />
      </div>
    </div>
  );

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
      <AnimatePresence>
        {(isAnalyzing || isGeneratingQASP || isGeneratingPWST) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-6"
          >
            <div className="flex flex-col items-center gap-8 max-w-md w-full">
              <div className="relative">
                <div className="w-24 h-24 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Brain className="w-8 h-8 text-indigo-600 animate-pulse" />
                </div>
              </div>
              
              <div className="text-center space-y-4 w-full">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {isAnalyzing ? 'Multi-Pass Analysis' : 'Generating Document'}
                </h2>
                
                {/* Live Stepper */}
                <div className="space-y-4">
                  {[
                    { id: 'parsing', label: 'Semantic Parsing', icon: FileText, active: isAnalyzing && analysisStep.includes('Parsing') },
                    { id: 'analyzing', label: 'PBA Dimension Scoring', icon: Target, active: isAnalyzing && analysisStep.includes('Analyzing') },
                    { id: 'refining', label: 'ARC Rewrite Generation', icon: RefreshCw, active: isAnalyzing && analysisStep.includes('Refining') },
                    { id: 'finalizing', label: 'Executive Synthesis', icon: CheckCircle2, active: (isAnalyzing && analysisStep.includes('Finalizing')) || isGeneratingQASP || isGeneratingPWST }
                  ].map((step, i) => {
                    const steps = ['Parsing', 'Analyzing', 'Refining', 'Finalizing'];
                    const currentStepIdx = steps.findIndex(s => analysisStep.includes(s));
                    const isPast = i < currentStepIdx || (!isAnalyzing && (isGeneratingQASP || isGeneratingPWST));
                    const isCurrent = i === currentStepIdx || (i === 3 && (isGeneratingQASP || isGeneratingPWST));
                    
                    return (
                      <div key={step.id} className="flex items-center gap-4 text-left">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500",
                          isPast ? "bg-emerald-500 border-emerald-500 text-white" : 
                          isCurrent ? "border-indigo-600 text-indigo-600 animate-pulse shadow-[0_0_15px_rgba(79,70,229,0.3)]" : 
                          "border-slate-200 text-slate-300"
                        )}>
                          {isPast ? <Check className="w-4 h-4" /> : <step.icon className="w-4 h-4" />}
                        </div>
                        <div className="flex-1">
                          <div className={cn(
                            "text-[10px] font-black uppercase tracking-widest",
                            isCurrent ? "text-indigo-600" : isPast ? "text-emerald-600" : "text-slate-400"
                          )}>
                            {step.label}
                          </div>
                          {isCurrent && (
                            <div className="h-1 w-full bg-slate-100 rounded-full mt-1 overflow-hidden">
                              <motion.div 
                                className="h-full bg-indigo-600"
                                initial={{ x: '-100%' }}
                                animate={{ x: '100%' }}
                                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-slate-500 text-sm font-medium animate-pulse">
                  {isAnalyzing 
                    ? 'Processing document chunks for maximum accuracy...' 
                    : 'Synthesizing final report and QASP/PWST templates...'}
                </p>
                
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {analysisStep}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toaster position="top-right" richColors />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-6 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md">
              <Zap className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">PBAi</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Requirement Reviewer + Coach</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {result && (
              <button 
                onClick={() => {
                  setResult(null);
                  setConsistencyResult(null);
                  setQasp(null);
                  setPwst(null);
                  setAnalysisStatus('not_started');
                  setQaspStatus('not_started');
                  setPwstStatus('not_started');
                  setAnalysisStep('');
                  setActiveTab('analysis');
                  // Keep content so they can re-analyze or edit easily
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                RETURN TO HOME
              </button>
            )}
            <button 
              onClick={() => setIsTrainingMode(!isTrainingMode)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-xs font-bold transition-all rounded-lg border",
                isTrainingMode 
                  ? "bg-rose-600 text-white border-rose-600 shadow-md" 
                  : "text-rose-600 hover:bg-rose-50 border-rose-200"
              )}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              {isTrainingMode ? 'TRAINING MODE: ON' : 'TRAINING MODE'}
            </button>
            <button 
              onClick={() => setShowLearningModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200"
            >
              <Brain className="w-3.5 h-3.5" />
              LEARNING CENTER
            </button>
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
                          <button
                            onClick={() => {
                              exportComprehensiveExcelReport(result);
                              setIsExportOpen(false);
                            }}
                            className="w-full flex items-center justify-between px-4 py-3 text-left text-[11px] font-black text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors uppercase border-b border-slate-100 mb-1"
                          >
                            <div className="flex flex-col">
                              <span>Comprehensive Report</span>
                              <span className="text-[8px] text-indigo-400 font-bold tracking-tighter">SCORING + METHODOLOGY</span>
                            </div>
                            <span className="text-[9px] text-indigo-400">.xlsx</span>
                          </button>
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
                  "w-full mt-8 py-4 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all text-sm uppercase tracking-widest",
                  isAnalyzing 
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-[0.99]"
                )}
              >
                {isAnalyzing ? (
                  <>
                    <div className="flex items-center gap-3">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Analyzing Document...
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 normal-case tracking-normal mt-1 animate-pulse">
                      {analysisStep}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <Search className="w-4 h-4" />
                      Run Analyst
                    </div>
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
                    <div className="grid grid-cols-12 gap-6">
                      {/* Bento Grid: Main Score & Summary */}
                      <div className="col-span-12 lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Overall Score Card */}
                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                              <Tooltip text="Performance-Based Acquisition (PBA) focuses on outcomes rather than processes.">
                                Overall Maturity
                              </Tooltip>
                            </h3>
                            <Gauge className="w-5 h-5 text-indigo-500" />
                          </div>
                          <div className="flex items-end gap-3">
                            <span className={cn("text-6xl font-black tracking-tighter", result.overall_document_score >= 80 ? "text-emerald-600" : result.overall_document_score >= 60 ? "text-amber-500" : "text-rose-500")}>
                              {result.overall_document_score}
                            </span>
                            <div className="mb-2">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PBA Index</div>
                              <div className="h-2 w-32 bg-slate-100 rounded-full overflow-hidden mt-1">
                                <div 
                                  className={cn("h-full transition-all duration-1000", result.overall_document_score >= 80 ? "bg-emerald-500" : result.overall_document_score >= 60 ? "bg-amber-500" : "bg-rose-500")}
                                  style={{ width: `${result.overall_document_score}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          <p className="mt-4 text-[11px] text-slate-500 leading-relaxed font-medium">
                            This score reflects the document's alignment with Performance-Based Acquisition principles across all identified requirements.
                          </p>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { label: 'Requirements', value: result.document_metrics.requirements_scored, icon: ClipboardCheck, color: 'text-blue-600 bg-blue-50' },
                            { label: 'Critical Issues', value: result.requirements.filter(r => r.criticality === 'Critical Issue').length, icon: ShieldAlert, color: 'text-rose-600 bg-rose-50' },
                            { label: 'Major Issues', value: result.requirements.filter(r => r.criticality === 'Major Issue').length, icon: AlertCircle, color: 'text-amber-600 bg-amber-50' },
                            { label: 'Excluded', value: result.document_metrics.excluded_findings_count, icon: FileText, color: 'text-slate-600 bg-slate-50' },
                          ].map((stat, i) => (
                            <div key={i} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-3", stat.color)}>
                                <stat.icon className="w-4 h-4" />
                              </div>
                              <div className="text-xl font-black text-slate-900">{stat.value}</div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</div>
                            </div>
                          ))}
                        </div>

                        {/* Executive Summary Card */}
                        <div className="md:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                          <div className="flex items-center gap-2 mb-4">
                            <FileSearch className="w-5 h-5 text-indigo-500" />
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Executive Summary</h3>
                          </div>
                          <div className="prose prose-slate prose-sm max-w-none text-slate-600 leading-relaxed italic">
                            "{result.executive_summary}"
                          </div>
                        </div>
                      </div>

                      {/* Radar Chart & Dimension Breakdown */}
                      <div className="col-span-12 lg:col-span-4 space-y-6">
                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm h-full">
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Dimension Radar</h3>
                            <Tooltip text="Visual representation of PBA maturity across 5 key dimensions.">
                              <HelpCircle className="w-4 h-4 text-slate-300 cursor-help" />
                            </Tooltip>
                          </div>
                          
                          <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                                { subject: 'Outcome', A: result.dimension_averages.outcome_orientation, full: 100 },
                                { subject: 'Metrics', A: result.dimension_averages.measurability, full: 100 },
                                { subject: 'Flex', A: result.dimension_averages.flexibility, full: 100 },
                                { subject: 'Surveil', A: result.dimension_averages.surveillance_linkage, full: 100 },
                                { subject: 'Clarity', A: result.dimension_averages.clarity_conciseness, full: 100 },
                              ]}>
                                <PolarGrid stroke="#e2e8f0" />
                                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                                <Radar
                                  name="PBA Score"
                                  dataKey="A"
                                  stroke="#4f46e5"
                                  fill="#4f46e5"
                                  fillOpacity={0.5}
                                />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>

                          <div className="mt-6 space-y-4">
                            {Object.entries(result.dimension_averages).map(([key, val]) => (
                              <div key={key} className="space-y-1">
                                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  <span>{key.replace('_', ' ')}</span>
                                  <span>{Math.round(val)}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className={cn(
                                      "h-full transition-all duration-1000",
                                      val >= 80 ? "bg-emerald-500" : val >= 60 ? "bg-amber-500" : "bg-rose-500"
                                    )}
                                    style={{ width: `${val}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Strengths & Improvements */}
                      <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-emerald-50/50 rounded-2xl p-6 border border-emerald-100">
                          <h3 className="text-xs font-black text-emerald-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <ThumbsUp className="w-4 h-4" />
                            Key Strengths
                          </h3>
                          <ul className="space-y-3">
                            {result.strengths.map((s, i) => (
                              <li key={i} className="flex gap-3 text-sm text-emerald-800">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="bg-rose-50/50 rounded-2xl p-6 border border-rose-100">
                          <h3 className="text-xs font-black text-rose-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Critical Gaps
                          </h3>
                          <ul className="space-y-3">
                            {result.areas_for_improvement.map((a, i) => (
                              <li key={i} className="flex gap-3 text-sm text-rose-800">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                                {a}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Consistency Audit Results (Conditional) */}
                      {consistencyResult && (
                        <div className="col-span-12 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-indigo-500" />
                            Consistency Audit Results
                          </h3>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confidence Score</span>
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
                      {/* Command Bar */}
                      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center gap-4">
                          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
                            <Search className="w-4 h-4 text-slate-400" />
                            <input 
                              type="text" 
                              placeholder="Search requirements..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none w-full"
                            />
                          </div>
                        
                        <div className="flex items-center gap-2">
                          <Filter className="w-4 h-4 text-slate-400" />
                          <select 
                            value={filterCriticality}
                            onChange={(e) => setFilterCriticality(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black text-slate-700 focus:outline-none"
                          >
                            <option value="all">ALL CRITICALITY</option>
                            <option value="Critical Issue">CRITICAL ONLY</option>
                            <option value="Major Issue">MAJOR ONLY</option>
                            <option value="Minor Improvement">MINOR ONLY</option>
                            <option value="Strength">STRENGTHS ONLY</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <SortAsc className="w-4 h-4 text-slate-400" />
                          <select 
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black text-slate-700 focus:outline-none"
                          >
                            <option value="id">SORT BY ID</option>
                            <option value="score-desc">HIGHEST SCORE</option>
                            <option value="score-asc">LOWEST SCORE</option>
                          </select>
                        </div>
                      </div>

                      {(result.requirements ?? [])
                        .filter(req => filterCriticality === 'all' || req.criticality === filterCriticality)
                        .filter(req => 
                          req.original_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          req.suggested_rewrite_statement.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          req.req_id.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .sort((a, b) => {
                          if (sortBy === 'score-desc') return b.overall_score - a.overall_score;
                          if (sortBy === 'score-asc') return a.overall_score - b.overall_score;
                          return a.req_id.localeCompare(b.req_id);
                        })
                        .map((req) => (
                        <div 
                          key={req.req_id}
                          className={cn(
                            "bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all group",
                            resolvedReqIds.has(req.req_id) ? "border-emerald-200 bg-emerald-50/10" : "border-slate-200"
                          )}
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
                                {resolvedReqIds.has(req.req_id) && (
                                  <span className="text-[9px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded uppercase tracking-widest flex items-center gap-1">
                                    <Check className="w-2.5 h-2.5" />
                                    APPROVED
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                {!resolvedReqIds.has(req.req_id) && (
                                  <button
                                    onClick={() => setResolvedReqIds(prev => new Set(prev).add(req.req_id))}
                                    className="text-[9px] font-black text-emerald-600 hover:text-emerald-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
                                  >
                                    <Check className="w-3 h-3" />
                                    APPROVE REWRITE
                                  </button>
                                )}
                                <div className={cn("text-xs font-black px-3 py-1 rounded-full border shadow-sm", getScoreColor(req.overall_score))}>
                                  {req.overall_score}
                                </div>
                              </div>
                            </div>
                            
                            {/* Diff View */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                              <div className="space-y-2">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Original Requirement</h4>
                                <div className="p-4 bg-rose-50/30 border border-rose-100 rounded-xl text-sm text-slate-700 leading-relaxed min-h-[80px]">
                                  {req.original_text}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Suggested ARC Rewrite</h4>
                                <div className="p-4 bg-emerald-50/30 border border-emerald-100 rounded-xl text-sm text-slate-900 font-bold leading-relaxed min-h-[80px]">
                                  {req.suggested_rewrite_statement}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                              <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                  {getCriticalityIcon(req.criticality)}
                                  Gap Analysis
                                </h4>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                  {req.reasoning}
                                </p>
                              </div>
                              <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                  <Tooltip text="Action-Result-Context (ARC) is the gold standard for performance requirements.">
                                    <Target className="w-3.5 h-3.5 text-indigo-500" />
                                  </Tooltip>
                                  ARC Structure
                                </h4>
                                <div className="space-y-2">
                                  <div className="flex gap-2 items-start">
                                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-white border border-slate-200 rounded text-indigo-600 w-6 text-center">A</span>
                                    <span className="text-[10px] text-slate-600 italic">"{req.suggested_rewrite_arc.action}"</span>
                                  </div>
                                  <div className="flex gap-2 items-start">
                                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-white border border-slate-200 rounded text-indigo-600 w-6 text-center">R</span>
                                    <span className="text-[10px] text-slate-600 italic">"{req.suggested_rewrite_arc.result}"</span>
                                  </div>
                                  <div className="flex gap-2 items-start">
                                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-white border border-slate-200 rounded text-indigo-600 w-6 text-center">C</span>
                                    <span className="text-[10px] text-slate-600 italic">"{req.suggested_rewrite_arc.context}"</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {isTrainingMode && (
                              <div className="mt-6 p-4 bg-rose-50 rounded-xl border border-rose-100 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-6 h-6 bg-rose-600 rounded-lg flex items-center justify-center">
                                    <GraduationCap className="text-white w-3.5 h-3.5" />
                                  </div>
                                  <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Training Mode: Provide Ideal Statement</h4>
                                </div>
                                <div className="space-y-3">
                                  <div>
                                    <label className="text-[9px] font-bold text-rose-400 uppercase tracking-widest mb-1 block">Ideal Statement</label>
                                    <textarea 
                                      placeholder="Enter the ideal, corrected requirement statement here..."
                                      className="w-full p-3 bg-white border border-rose-200 rounded-xl text-xs font-medium outline-none focus:border-rose-500 transition-all min-h-[80px] shadow-inner"
                                      defaultValue={req.suggested_rewrite_statement}
                                      id={`correction-${req.req_id}`}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-rose-400 uppercase tracking-widest mb-1 block">Reasoning behind correction (Optional)</label>
                                    <textarea 
                                      placeholder="What did the LLM do wrong? Why is this rewrite better? (e.g. 'LLM missed the specific outcome', 'The rewrite is more measurable')"
                                      className="w-full p-3 bg-white border border-rose-200 rounded-xl text-xs font-medium outline-none focus:border-rose-500 transition-all min-h-[60px] shadow-inner"
                                      id={`reasoning-${req.req_id}`}
                                    />
                                  </div>
                                  <div className="flex justify-end">
                                    <button 
                                      onClick={() => {
                                        const elCorr = document.getElementById(`correction-${req.req_id}`) as HTMLTextAreaElement;
                                        const elReas = document.getElementById(`reasoning-${req.req_id}`) as HTMLTextAreaElement;
                                        if (elCorr && elCorr.value.trim()) {
                                          handleLearn(req, elCorr.value.trim(), elReas?.value.trim() || "");
                                        }
                                      }}
                                      disabled={isLearning}
                                      className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-sm disabled:opacity-50"
                                    >
                                      {isLearning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                      Submit to Learner Agent
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="mt-4 flex items-center justify-between">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                Source: {req.source_ref.section} | Method: {req.extraction_method}
                              </span>
                              <div className="flex items-center gap-2">
                                {!isTrainingMode && (
                                  <button 
                                    onClick={() => {
                                      const correction = prompt("Enter your preferred version of this requirement for the AI to learn from:", req.suggested_rewrite_statement);
                                      if (correction) handleLearn(req, correction);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors"
                                  >
                                    <Brain className="w-3.5 h-3.5" />
                                    Learn from Correction
                                  </button>
                                )}
                                <button 
                                  onClick={() => openCoach(req)}
                                  className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm",
                                    isTrainingMode 
                                      ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                                  )}
                                  disabled={isTrainingMode}
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  Discuss with Coach
                                </button>
                              </div>
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
      {/* Learning Modal */}
      <AnimatePresence>
        {showLearningModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowLearningModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
                <div className="flex items-center gap-3">
                  <Brain className="w-6 h-6" />
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight">Learning Center</h2>
                    <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">AI Accuracy Improvement Store</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowLearningModal(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
                {learningEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                      <Brain className="w-10 h-10 text-indigo-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">No lessons learned yet</h3>
                    <p className="text-sm text-slate-500 max-w-md">
                      When you correct the AI's suggestions, use the "Learn from Correction" button. 
                      The Learner Agent will analyze your feedback and improve future analyses.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Lessons</p>
                        <p className="text-3xl font-black text-indigo-600">{learningEntries.length}</p>
                      </div>
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Top Category</p>
                        <p className="text-xl font-black text-slate-800 truncate">
                          {Object.entries(learningEntries.reduce((acc, e) => {
                            acc[e.category] = (acc[e.category] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
                        </p>
                      </div>
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Tags</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Array.from(new Set(learningEntries.flatMap(e => e.tags))).slice(0, 5).map(tag => (
                            <span key={tag} className="text-[8px] font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded uppercase tracking-widest">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Recent Lessons</h3>
                    {learningEntries.map((entry, i) => (
                      <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black px-2 py-1 bg-indigo-600 text-white rounded uppercase tracking-widest">
                              {entry.category}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {new Date(entry.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            {entry.tags.map(tag => (
                              <span key={tag} className="text-[8px] font-bold px-1.5 py-0.5 bg-white border border-slate-200 text-slate-400 rounded uppercase tracking-widest">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Original Document Text</h4>
                              <p className="text-xs text-slate-600 italic">"{entry.original_requirement}"</p>
                            </div>
                            <div>
                              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Original AI Suggestion</h4>
                              <p className="text-xs text-slate-500 italic line-through opacity-60">"{entry.ai_rewrite}"</p>
                            </div>
                            <div>
                              <h4 className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">Human Correction</h4>
                              <p className="text-xs text-slate-800 font-bold">"{entry.user_correction}"</p>
                            </div>
                            {entry.user_reasoning && (
                              <div>
                                <h4 className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-2">User Reasoning</h4>
                                <p className="text-xs text-slate-600 italic">"{entry.user_reasoning}"</p>
                              </div>
                            )}
                          </div>
                          <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                            <h4 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                              <Zap className="w-3 h-3" />
                              Learner Agent Critique
                            </h4>
                            <p className="text-xs text-indigo-900 leading-relaxed italic">
                              {entry.critique}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-100 bg-white flex justify-end">
                <button
                  onClick={() => setShowLearningModal(false)}
                  className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
                >
                  Close Learning Center
                </button>
              </div>
            </motion.div>
          </div>
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
                          thought: acc.thought + (curr.token_usage.thought_tokens || 0),
                          total: acc.total + curr.token_usage.total_tokens,
                          latency: acc.latency + (curr.latency_ms || 0)
                        }), { prompt: 0, output: 0, thought: 0, total: 0, latency: 0 });

                        return (
                          <>
                            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Total Tokens</span>
                              <div className="text-2xl font-black text-indigo-600">{totals.total.toLocaleString()}</div>
                              <div className="text-[10px] font-bold text-indigo-400 mt-1">
                                {totals.prompt.toLocaleString()} P / {totals.output.toLocaleString()} O / {totals.thought.toLocaleString()} T
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
                            <th className="w-[35%] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Agent / Function</th>
                            <th className="w-[12%] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Prompt</th>
                            <th className="w-[12%] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Output</th>
                            <th className="w-[12%] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Thought</th>
                            <th className="w-[12%] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</th>
                            <th className="w-[17%] px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
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
                              <td className="px-3 py-3 text-[10px] font-bold text-slate-400 align-top italic">{(entry.token_usage.thought_tokens || 0).toLocaleString()}</td>
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
            <span className="text-xs font-black uppercase tracking-widest">PBAi v2.1</span>
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
