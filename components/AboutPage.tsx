import React from 'react';

const AboutPage: React.FC = () => {
  return (
    <div className="w-full space-y-16 animate-fadeIn pb-24 px-4 sm:px-6">
      {/* Hero Section */}
      <div className="bg-[#1a1a1a] rounded-[3rem] p-12 sm:p-16 text-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/10 rounded-full blur-[100px] -mr-40 -mt-40"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] -ml-40 -mb-40"></div>
        
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter mb-3 relative z-10">CREAT <span className="text-orange-500">YOJANA</span></h1>
        <p className="text-xl sm:text-2xl font-black text-slate-300 tracking-widest mb-6 uppercase relative z-10">नवाचार की योजना</p>
        <div className="w-16 h-1 bg-orange-500 mx-auto rounded-full mb-8 relative z-10"></div>
        
        <p className="text-lg sm:text-xl font-bold text-white/90 leading-tight relative z-10">
          AI-Assisted R&D Planning Platform <br className="hidden sm:block" /> 
          <span className="text-orange-400 italic">Co-created with AI</span>
        </p>
        <div className="absolute bottom-4 right-8 text-[10px] font-black text-white/20 uppercase tracking-[0.3em] z-10">
          v1.4.1
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="bg-white p-12 rounded-[3rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-[12px] font-black text-indigo-600 uppercase tracking-[0.4em] mb-6">The Platform</h3>
          <h2 className="text-3xl font-black text-slate-800 mb-8 tracking-tight">What is CREAT YOJANA?</h2>
          <p className="text-slate-600 text-lg leading-relaxed font-semibold">
            CREAT YOJANA is an AI-assisted planning platform that enables structured, transparent, and data-driven estimation of R&D manpower and expenses across projects and domains. It serves as the single source of truth for fiscal governance.
          </p>
        </div>

        <div className="bg-white p-12 rounded-[3rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-[12px] font-black text-red-600 uppercase tracking-[0.4em] mb-6">The Challenge</h3>
          <h2 className="text-3xl font-black text-slate-800 mb-8 tracking-tight">Why it exists</h2>
          <ul className="space-y-6">
            {[
              "Fragmented R&D estimates across teams",
              "Low visibility of domain-level investment",
              "Manual, error-prone budgeting cycles",
              "Limited scenario simulation capability"
            ].map(item => (
              <li key={item} className="flex items-start space-x-4 text-slate-700 text-lg font-bold">
                <svg className="w-6 h-6 text-red-500 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white p-12 rounded-[3rem] border border-slate-200 shadow-sm md:col-span-2 hover:shadow-md transition-shadow">
          <h3 className="text-[12px] font-black text-emerald-600 uppercase tracking-[0.4em] mb-6">The Value</h3>
          <h2 className="text-4xl font-black text-slate-800 mb-12 tracking-tight">What it delivers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
            {[
              { icon: "📊", title: "R&D Estimation", desc: "Project-wise & domain-wise detailed planning with high-fidelity accuracy." },
              { icon: "🧠", title: "Cost Structuring", desc: "AI-assisted effort and budget allocation models for optimal investment." },
              { icon: "🔍", title: "Skill Visibility", desc: "Skill-level manpower resource mapping to identify talent gaps instantly." },
              { icon: "💰", title: "Integrated Planning", desc: "Combined Manpower & Expense (A+B=C) for total visibility of spend." },
              { icon: "📈", title: "Leadership Roll-ups", desc: "Monthly & annual consolidated reporting for strategic decision making." }
            ].map(item => (
              <div key={item.title} className="space-y-4">
                <div className="text-5xl mb-4">{item.icon}</div>
                <h4 className="font-black text-slate-800 text-xl uppercase tracking-tight">{item.title}</h4>
                <p className="text-base text-slate-500 font-bold leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-indigo-50 p-12 rounded-[3rem] border border-indigo-100 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-[12px] font-black text-indigo-600 uppercase tracking-[0.4em] mb-6">The Edge</h3>
          <h2 className="text-3xl font-black text-slate-800 mb-8 tracking-tight">What makes it different</h2>
          <ul className="space-y-6">
            {[
              "AI-assisted, not AI-controlled",
              "Built by AI enthusiastic engineers using AI vibe coding",
              "Perfectly aligned to CREAT operating model",
              "Highly scalable across programs and domains"
            ].map(item => (
              <li key={item} className="flex items-start space-x-4 text-slate-800 text-lg font-black">
                <svg className="w-6 h-6 text-indigo-600 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" /></svg>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-emerald-50 p-12 rounded-[3rem] border border-emerald-100 shadow-sm flex flex-col justify-center items-center text-center hover:shadow-md transition-shadow">
          <h3 className="text-[12px] font-black text-emerald-600 uppercase tracking-[0.4em] mb-6">The Mission</h3>
          <h2 className="text-4xl font-black text-emerald-900 mb-8 tracking-tight">Outcome</h2>
          <p className="text-2xl font-black text-emerald-800 leading-relaxed max-w-md">
            Better planning. <br /> Better decisions. <br /> 
            <span className="text-emerald-600">Faster deployment.</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;