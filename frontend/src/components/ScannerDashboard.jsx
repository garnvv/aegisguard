import React from 'react';
import { ShieldAlert, ShieldCheck, Activity, AlertTriangle, Fingerprint, Network } from 'lucide-react';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { motion } from 'framer-motion';

export default function ScannerDashboard({ result }) {
  const { 
    probability_pct, 
    verdict, 
    reasons, 
    attack_type, 
    compromised_data, 
    url, 
    is_masked_redirect 
  } = result;

  const isSafe = verdict === 'Green';
  const isWarning = verdict === 'Yellow';
  const isDanger = verdict === 'Red';

  const colorHex = isSafe ? '#10b981' : isWarning ? '#f59e0b' : '#ef4444';
  const pulseClass = isDanger ? 'animate-pulse' : '';

  const chartData = [{ name: 'Risk', value: probability_pct, fill: colorHex }];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      {/* Risk Gauge Card */}
      <div className="glass-panel p-6 flex flex-col items-center justify-center relative">
        <h3 className="text-xl font-display font-medium text-gray-300 absolute top-6 left-6">Threat Level</h3>
        
        <div className="w-48 h-48 mt-8 relative">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={10} data={chartData} startAngle={180} endAngle={0}>
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar minAngle={15} background={{ fill: 'rgba(255,255,255,0.05)' }} clockWise dataKey="value" cornerRadius={10} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center -mt-6">
            <span className={`text-4xl font-bold font-mono ${pulseClass}`} style={{ color: colorHex }}>
              {probability_pct}%
            </span>
            <span className="text-sm uppercase tracking-widest text-gray-400 mt-1">{verdict}</span>
          </div>
        </div>

        <div className={`mt-4 px-4 py-2 rounded-full border border-opacity-30 flex items-center gap-2`} style={{ borderColor: colorHex, backgroundColor: `${colorHex}15`, color: colorHex }}>
          {isSafe ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          <span className="font-semibold uppercase tracking-wider">{attack_type}</span>
        </div>
      </div>

      {/* Details & Features */}
      <div className="col-span-1 md:col-span-2 flex flex-col gap-6">
        
        <div className="glass-panel p-6">
          <h3 className="text-xl font-display font-medium text-neonCyan mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" /> Heuristics Analysis
          </h3>
          <ul className="space-y-3 font-mono text-sm text-gray-300 h-40 overflow-y-auto pr-2 custom-scrollbar">
            {reasons.map((reason, idx) => (
              <motion.li 
                key={idx}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-start gap-3 border-b border-gray-800 pb-2 last:border-0"
              >
                <span className="text-neonPurple shrink-0 mt-0.5">[{idx + 1}]</span>
                <span>{reason}</span>
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="glass-panel p-6 border-t-2 border-t-neonPurple/50">
            <h4 className="text-sm text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Fingerprint className="w-4 h-4 text-neonPurple" /> Targeted Data
            </h4>
            <div className="flex flex-wrap gap-2 text-sm font-medium">
              {compromised_data.length > 0 ? compromised_data.map((data, idx) => (
                <span key={idx} className="bg-neonPurple/10 text-neonPurple px-3 py-1 rounded-md border border-neonPurple/20">
                  {data}
                </span>
              )) : (
                <span className="text-gray-500 italic">No specific scopes parsed.</span>
              )}
            </div>
          </div>

          <div className="glass-panel p-6 border-t-2 border-t-neonCyan/50">
            <h4 className="text-sm text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Network className="w-4 h-4 text-neonCyan" /> Redirection Flag
            </h4>
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${is_masked_redirect ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                {is_masked_redirect ? <AlertTriangle className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
              </div>
              <div>
                <p className="font-bold">{is_masked_redirect ? 'Masked Redirect Detected' : 'No Masking'}</p>
                <p className="text-xs text-gray-400">Deep Scan Engine</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
