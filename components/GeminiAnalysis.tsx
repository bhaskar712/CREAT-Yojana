
import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { X, Brain, Sparkles, Loader2, AlertCircle, ChevronRight, BarChart3, TrendingUp, PieChart } from 'lucide-react';
import Markdown from 'react-markdown';

interface GeminiAnalysisProps {
  data: {
    stats: any;
    breakdownData: any;
    loadAnalysisData: any;
    monthlyRollup: any[];
    selectedFY: string | null;
    fiscalMode: string;
  };
}

export const GeminiAnalysis: React.FC<GeminiAnalysisProps> = ({ data }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const model = "gemini-3-flash-preview";
      
      const prompt = `
        As a Senior Financial Analyst and Strategic Planner, analyze the following budget data for the fiscal year ${data.selectedFY || 'N/A'} in ${data.fiscalMode} mode.
        
        ### Portfolio Metrics:
        - Total Projects: ${data.stats?.portfolioCount || 0}
        - Confirmed Projects: ${data.stats?.confirmedCount || 0}
        - Total Budget: ${data.stats?.baseTotalCr?.toFixed(2) || '0.00'} CR
        - Manpower Budget: ${data.stats?.baseManpowerCr?.toFixed(2) || '0.00'} CR (${data.stats?.baseEffortsMM?.toFixed(2) || '0.00'} MM)
        - Expense Budget: ${data.stats?.baseExpensesCr?.toFixed(2) || '0.00'} CR
        - New Projects Share: ${data.stats?.baseTotalCr > 0 ? ((data.stats.baseNewCr / data.stats.baseTotalCr) * 100).toFixed(2) : '0.00'}%
        - Carry-over Share: ${data.stats?.baseTotalCr > 0 ? ((data.stats.baseCoCr / data.stats.baseTotalCr) * 100).toFixed(2) : '0.00'}%
        
        ### Vertical Breakdown (INR CR):
        ${data.breakdownData?.metrics ? Object.entries(data.breakdownData.metrics).map(([v, m]: [string, any]) => `- ${v}: ${m.total?.toFixed(2) || '0.00'} CR (${m.confirmed || 0} projects)`).join('\n') : 'No data'}
        
        ### Strategic Initiatives:
        - IVI: ${data.breakdownData?.strategic?.ivi?.total?.toFixed(2) || '0.00'} CR
        - Auto Expo: ${data.breakdownData?.strategic?.ae?.total?.toFixed(2) || '0.00'} CR
        - INITIA Add: ${data.breakdownData?.strategic?.initia_add?.total?.toFixed(2) || '0.00'} CR
        
        ### Top Business Units:
        ${data.loadAnalysisData?.buList ? data.loadAnalysisData.buList.slice(0, 5).map((bu: any) => `- ${bu.name}: ${bu.totalCr?.toFixed(2) || '0.00'} CR (${bu.share?.toFixed(2) || '0.00'}%)`).join('\n') : 'No data'}
        
        ### Monthly Trend (Total MM):
        ${data.monthlyRollup ? data.monthlyRollup.map(m => `${m.name}: ${m.totalMM?.toFixed(2) || '0.00'} MM`).join(', ') : 'No data'}
        
        Please provide a comprehensive analysis including:
        1. **Executive Summary**: High-level overview of the financial health and strategic alignment.
        2. **Key Insights**: Identify trends, anomalies, or significant concentrations of budget.
        3. **Strategic Alignment**: How well the budget supports "New" vs "Carry-over" initiatives and strategic segments like IVI/INITIA.
        4. **Risks & Opportunities**: Potential financial risks or areas for optimization.
        5. **Actionable Recommendations**: 3-5 specific steps for the PMO to improve fiscal governance or resource allocation.
        
        Format the response in professional Markdown with clear headings and bullet points.
      `;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      setAnalysis(response.text || "No analysis generated.");
    } catch (err: any) {
      console.error("Gemini Analysis Error:", err);
      setError(err.message || "Failed to generate analysis. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleModal = () => {
    setIsOpen(!isOpen);
    if (!isOpen && !analysis) {
      generateAnalysis();
    }
  };

  return (
    <>
      <button
        onClick={toggleModal}
        className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95"
      >
        <Brain className="w-4 h-4" />
        <span className="text-xs font-black uppercase tracking-widest">AI Analysis</span>
        <Sparkles className="w-3 h-3 text-indigo-200" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200"
            >
              {/* Header */}
              <div className="bg-slate-900 p-6 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-4">
                  <div className="bg-indigo-500 p-3 rounded-2xl shadow-lg shadow-indigo-500/20">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-white text-lg font-black uppercase tracking-tight leading-none">AI Portfolio Intelligence</h2>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Powered by Gemini 3 Flash</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-white p-2 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-grow overflow-y-auto p-8 no-scrollbar bg-slate-50/30">
                {isLoading ? (
                  <div className="h-full flex flex-col items-center justify-center space-y-6 py-20">
                    <div className="relative">
                      <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
                      </div>
                    </div>
                    <div className="text-center">
                      <h3 className="text-slate-800 font-black uppercase tracking-tight text-lg">Synthesizing Portfolio Data...</h3>
                      <p className="text-slate-500 text-xs font-medium mt-2">Gemini is analyzing trends, risks, and strategic alignment.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl mt-12">
                      {[
                        { icon: BarChart3, label: "Metric Analysis" },
                        { icon: TrendingUp, label: "Trend Detection" },
                        { icon: PieChart, label: "Strategic Mapping" }
                      ].map((item, i) => (
                        <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center space-x-3 shadow-sm">
                          <item.icon className="w-5 h-5 text-indigo-500" />
                          <span className="text-[10px] font-black uppercase text-slate-600">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : error ? (
                  <div className="h-full flex flex-col items-center justify-center space-y-4 py-20">
                    <div className="bg-red-50 p-4 rounded-full">
                      <AlertCircle className="w-12 h-12 text-red-500" />
                    </div>
                    <div className="text-center max-w-md">
                      <h3 className="text-slate-800 font-black uppercase tracking-tight text-lg">Analysis Interrupted</h3>
                      <p className="text-red-500 text-sm font-medium mt-2">{error}</p>
                    </div>
                    <button
                      onClick={generateAnalysis}
                      className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all"
                    >
                      Retry Analysis
                    </button>
                  </div>
                ) : analysis ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="prose prose-slate max-w-none"
                  >
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 markdown-body">
                      <Markdown>{analysis}</Markdown>
                    </div>
                    
                    <div className="mt-8 flex items-center justify-between bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                      <div className="flex items-center space-x-4">
                        <div className="bg-indigo-500 p-2 rounded-lg">
                          <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <p className="text-[11px] font-bold text-indigo-900 uppercase tracking-tight">
                          This analysis is AI-generated based on current portfolio snapshots. 
                          Verify critical financial decisions with the PMO team.
                        </p>
                      </div>
                      <button 
                        onClick={generateAnalysis}
                        className="text-indigo-600 hover:text-indigo-800 text-[10px] font-black uppercase tracking-widest flex items-center space-x-1"
                      >
                        <span>Refresh Analysis</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </div>

              {/* Footer */}
              <div className="p-6 bg-white border-t border-slate-100 flex justify-end shrink-0">
                <button
                  onClick={() => setIsOpen(false)}
                  className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-900/20"
                >
                  Close Analysis
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
