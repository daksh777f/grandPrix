import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { fetchCornerHistory, type CornerHistoryData, type CornerLapData } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Props {
  sessionKey: number;
  driverNumber: number;
  corner: string | null;
  liveCorner: string | null;
  onClose: () => void;
}

export function CornerHistoryPanel({ sessionKey, driverNumber, corner, liveCorner, onClose }: Props) {
  const [data, setData] = useState<CornerHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedLap, setSelectedLap] = useState<CornerLapData | null>(null);

  useEffect(() => {
    if (!corner) return;
    let active = true;
    
    async function loadData() {
      setLoading(true);
      try {
        const hist = await fetchCornerHistory(sessionKey, driverNumber, corner!);
        if (active) {
          setData(hist);
          setSelectedLap(null);
        }
      } catch (err) {
        console.error("Failed to load corner history", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    
    loadData();
    return () => { active = false; };
  }, [corner, sessionKey, driverNumber]);

  if (!corner) return null;

  const renderTrendIcon = (trend: string | null) => {
    if (trend === 'IMPROVING') return <TrendingUp className="w-3 h-3 text-emerald-400" />;
    if (trend === 'DEGRADING') return <TrendingDown className="w-3 h-3 text-brand-red" />;
    if (trend === 'STABLE') return <Minus className="w-3 h-3 text-chrome/50" />;
    return null;
  };

  const renderTrendText = (trend: string | null) => {
    if (!trend) return "N/A";
    return <span className={cn(
      trend === 'IMPROVING' ? 'text-emerald-400' : 
      trend === 'DEGRADING' ? 'text-brand-red' : 'text-chrome/50'
    )}>{trend}</span>;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed top-28 right-6 bottom-6 w-96 bg-[#0a0a0c]/95 backdrop-blur-md border border-chrome/10 rounded overflow-hidden flex flex-col z-40 shadow-2xl"
      >
        <div className="flex items-center justify-between p-4 border-b border-chrome/10 bg-[#111316]">
          <div className="flex flex-col">
            <span className="font-display font-black text-2xl uppercase tracking-tighter text-ink">{corner}</span>
            <span className="font-mono text-[9px] text-chrome/50 uppercase tracking-[0.2em]">
              {liveCorner && liveCorner !== corner ? (
                <>LIVE: {liveCorner} <span className="mx-1">|</span> VIEWING: {corner} HISTORY</>
              ) : (
                "CORNER HISTORY"
              )}
            </span>
          </div>
          <button onClick={onClose} className="p-2 text-chrome/50 hover:text-ink transition-colors rounded hover:bg-chrome/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center font-mono text-[10px] text-chrome/50 uppercase">
            Loading History...
          </div>
        ) : data?.error || !data?.laps?.length ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border-t border-chrome/5">
            <span className="font-display font-bold text-xl text-brand-red mb-2">LIMITED HISTORY</span>
            <span className="font-mono text-[10px] text-chrome/50">Insufficient data to generate history for this corner.</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
            
            {/* Trends Section */}
            {data.trend && data.trend.entry_speed && (
              <div className="p-4 border-b border-chrome/10 grid grid-cols-2 gap-4 bg-[#0a0a0c]">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[9px] text-chrome/50 uppercase">Entry Speed</span>
                  <div className="flex items-center gap-1.5 font-bold font-mono text-xs">
                    {renderTrendIcon(data.trend.entry_speed)}
                    {renderTrendText(data.trend.entry_speed)}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[9px] text-chrome/50 uppercase">Min Speed</span>
                  <div className="flex items-center gap-1.5 font-bold font-mono text-xs">
                    {renderTrendIcon(data.trend.minimum_speed)}
                    {renderTrendText(data.trend.minimum_speed)}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[9px] text-chrome/50 uppercase">Time Loss</span>
                  <div className="flex items-center gap-1.5 font-bold font-mono text-xs">
                    {renderTrendIcon(data.trend.time_loss)}
                    {renderTrendText(data.trend.time_loss)}
                  </div>
                </div>
              </div>
            )}

            {/* Summary Section */}
            {data.summary && (
              <div className="p-4 border-b border-chrome/10 bg-[#111316]">
                <div className="font-mono text-[9px] text-chrome/50 uppercase mb-1">Recent Form</div>
                <div className="font-body text-xs text-ink leading-relaxed">{data.summary}</div>
              </div>
            )}

            {/* Sparkline (Time Loss over laps) */}
            <div className="p-4 border-b border-chrome/10 h-24 flex items-end relative overflow-hidden bg-gradient-to-t from-brand-red/5 to-transparent">
               <span className="absolute top-2 left-3 font-mono text-[8px] text-chrome/40 uppercase">Time Loss Trend</span>
               <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full pt-6 opacity-70">
                 {(() => {
                    const validLaps = data.laps.filter(l => l.estimated_time_delta != null);
                    if (validLaps.length < 2) return null;
                    const maxL = Math.max(...validLaps.map(l => l.estimated_time_delta), 0.1);
                    const minL = Math.min(...validLaps.map(l => l.estimated_time_delta), -0.1);
                    const range = (maxL - minL) || 1;
                    
                    const points = validLaps.map((l, i) => {
                      const x = (i / (validLaps.length - 1)) * 100;
                      const y = 100 - (((l.estimated_time_delta - minL) / range) * 90 + 5);
                      return `${x},${y}`;
                    }).join(' L ');
                    
                    return <path d={`M ${points}`} fill="none" stroke="#E10600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                 })()}
               </svg>
            </div>

            {/* Selected Lap Detail */}
            <AnimatePresence>
              {selectedLap && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-b border-chrome/10 bg-brand-red/5 overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-display font-bold text-ink">LAP {selectedLap.lap} DETAIL</span>
                    </div>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-2 font-mono text-[10px]">
                      <div>
                        <div className="text-chrome/50">ENTRY SPEED</div>
                        <div className="text-ink">{selectedLap.entry_speed ?? '—'} km/h</div>
                      </div>
                      <div>
                        <div className="text-chrome/50">BRAKE POINT</div>
                        <div className="text-ink">{selectedLap.brake_progress != null ? (selectedLap.brake_progress * 100).toFixed(1) + '%' : '—'}</div>
                      </div>
                      <div>
                        <div className="text-chrome/50">MIN SPEED</div>
                        <div className="text-ink">{selectedLap.minimum_speed ?? '—'} km/h</div>
                      </div>
                      <div>
                        <div className="text-chrome/50">EXIT SPEED</div>
                        <div className="text-ink">{selectedLap.exit_speed ?? '—'} km/h</div>
                      </div>
                      <div className="col-span-2 mt-2 pt-2 border-t border-chrome/10">
                        <div className="text-chrome/50 mb-1">DIAGNOSIS</div>
                        <div className={cn("font-bold text-xs", selectedLap.diagnosis === "GOOD" ? "text-emerald-400" : "text-brand-red")}>
                          {selectedLap.diagnosis ? selectedLap.diagnosis.replace(/_/g, ' ') : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Lap History Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#111316] z-10 border-b border-chrome/10">
                  <tr className="font-mono text-[9px] text-chrome/50 uppercase">
                    <th className="py-2 pl-4 font-normal">Lap</th>
                    <th className="py-2 font-normal">Entry</th>
                    <th className="py-2 font-normal">Brake Pt</th>
                    <th className="py-2 font-normal">Min</th>
                    <th className="py-2 font-normal">Exit</th>
                    <th className="py-2 pr-4 font-normal text-right">Delta</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-[10px]">
                  {data.laps.map(l => (
                    <tr 
                      key={l.lap} 
                      onClick={() => setSelectedLap(selectedLap?.lap === l.lap ? null : l)}
                      className={cn(
                        "border-b border-chrome/5 cursor-pointer transition-colors",
                        selectedLap?.lap === l.lap ? "bg-brand-red/10 text-ink" : "hover:bg-chrome/5 text-chrome/80"
                      )}
                    >
                      <td className="py-2 pl-4">L{l.lap.toString().padStart(2, '0')}</td>
                      <td className="py-2">{l.entry_speed ?? '—'}</td>
                      <td className="py-2">{l.brake_progress != null ? (l.brake_progress * 100).toFixed(1) + '%' : '—'}</td>
                      <td className="py-2">{l.minimum_speed ?? '—'}</td>
                      <td className="py-2">{l.exit_speed ?? '—'}</td>
                      <td className="py-2 pr-4 text-right">
                        {l.estimated_time_delta != null ? (
                          <span className={cn(l.estimated_time_delta > 0.05 ? "text-brand-red" : (l.estimated_time_delta < -0.05 ? "text-emerald-400" : "text-chrome/80"))}>
                            {l.estimated_time_delta > 0 ? `+${l.estimated_time_delta.toFixed(2)}s LOST` : `${Math.abs(l.estimated_time_delta).toFixed(2)}s FASTER`}
                          </span>
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
