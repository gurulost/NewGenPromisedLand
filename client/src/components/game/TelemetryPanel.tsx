import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { useTelemetryLog } from '../../hooks/useTelemetryLog';
import type { TelemetryEvent } from '@shared/logic/telemetry';

const statusColor: Record<TelemetryEvent['status'], string> = {
  success: 'bg-green-500/20 text-green-200 border border-green-500/30',
  blocked: 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/30',
  error: 'bg-red-500/20 text-red-200 border border-red-500/30',
  info: 'bg-slate-500/20 text-slate-200 border border-slate-500/30',
};

const channelLabel: Record<TelemetryEvent['channel'], string> = {
  ability: 'Ability',
  combat: 'Combat',
  system: 'System',
  technology: 'Technology',
};

const formatTimestamp = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

type ChannelFilter = 'ability' | 'combat' | 'system' | 'technology';

export function TelemetryPanel({ limit = 30 }: { limit?: number }) {
  const { events, clear, exportLog } = useTelemetryLog(limit);
  const [activeChannels, setActiveChannels] = useState<ChannelFilter[]>(['ability', 'combat', 'system', 'technology']);

  const filteredEvents = useMemo(() => {
    return events.filter(event => activeChannels.includes(event.channel));
  }, [events, activeChannels]);

  const stats = useMemo(() => {
    const counts: Record<ChannelFilter, number> = {
      ability: 0,
      combat: 0,
      system: 0,
      technology: 0,
    };
    events.forEach(event => {
      counts[event.channel as ChannelFilter] += 1;
    });
    return counts;
  }, [events]);

  const toggleChannel = (channel: ChannelFilter) => {
    setActiveChannels(prev => {
      const exists = prev.includes(channel);
      if (exists && prev.length === 1) {
        return prev; // keep at least one channel active
      }
      if (exists) {
        return prev.filter(item => item !== channel);
      }
      return [...prev, channel];
    });
  };

  return (
    <div className="pointer-events-auto w-[26rem] bg-slate-900/80 border border-slate-700 rounded-xl shadow-xl backdrop-blur-lg flex flex-col h-[28rem]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 gap-3">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wide">Telemetry Log</h3>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-400">
            {(Object.keys(stats) as ChannelFilter[]).map(channel => (
              <button
                key={channel}
                onClick={() => toggleChannel(channel)}
                className={`px-2 py-0.5 rounded-full border transition ${
                  activeChannels.includes(channel)
                    ? 'border-slate-500/60 bg-slate-700/60 text-slate-100'
                    : 'border-slate-700 bg-slate-800/60 text-slate-500 hover:text-slate-300'
                }`}
              >
                {channelLabel[channel]} · {stats[channel]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={exportLog}
            className="text-xs text-blue-300 hover:text-blue-100"
          >
            Download
          </button>
          <button
            onClick={clear}
            className="text-xs text-blue-300 hover:text-blue-100"
          >
            Clear
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-2">
        <AnimatePresence initial={false}>
          {filteredEvents.map(event => (
            <motion.div
              key={event.timestamp + event.channel + (event.abilityId || '') + (event.attackerId || '')}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-2 first:mt-0"
            >
              <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <Badge className={statusColor[event.status]}>
                    {channelLabel[event.channel]}
                  </Badge>
                  <span className="text-[11px] text-slate-400 uppercase">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
                <div className="text-sm text-slate-100">
                  {event.reason ? event.reason.replace(/_/g, ' ') : event.status}
                </div>
                <div className="mt-1 text-xs text-slate-400 space-y-0.5">
                  {event.abilityId && <div>Ability: <span className="text-slate-200">{event.abilityId}</span></div>}
                  {event.attackerId && <div>Attacker: <span className="text-slate-200">{event.attackerId}</span></div>}
                  {event.defenderId && <div>Defender: <span className="text-slate-200">{event.defenderId}</span></div>}
                  {event.technologyId && <div>Technology: <span className="text-slate-200">{event.technologyId}</span></div>}
                  {typeof event.damage === 'number' && (
                    <div>Damage: <span className="text-slate-200">{event.damage}</span></div>
                  )}
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <div className="space-y-0.5">
                      {Object.entries(event.metadata).map(([key, value]) => (
                        <div key={key}>
                          {key}:
                          <span className="text-slate-200"> {String(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredEvents.length === 0 && (
          <div className="text-sm text-slate-400 text-center mt-8">No events yet. Trigger combat or abilities to populate the log.</div>
        )}
      </ScrollArea>
    </div>
  );
}
