import { useState, useEffect } from 'react';
import { Calendar, Search, Clock, X, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function ScheduledPage() {
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const [editTimeValue, setEditTimeValue] = useState<string>('');
  const [sortBy, setSortBy] = useState<'time-asc' | 'time-desc' | 'name'>('time-asc');

  useEffect(() => {
    fetchScheduled();
  }, []);

  const fetchScheduled = async () => {
    setLoading(true);
    try {
      // Fetch everything that has a scheduled time
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .not('scheduled_send_at', 'is', null)
        .order('scheduled_send_at', { ascending: true });
      
      if (contactsError) throw contactsError;

      const { data: templates } = await supabase.from('templates').select('id, name');
      const { data: lists } = await supabase.from('lists').select('id, name');

      const templateMap = new Map((templates || []).map(t => [t.id, t.name]));
      const listMap = new Map((lists || []).map(l => [l.id, l.name]));

      const formatted = (contacts || [])
        .filter(c => {
          const s = (c.status || '').toLowerCase();
          // Show everything except what is already finished (sent/bounced)
          return s !== 'sent' && s !== 'bounced';
        })
        .map(c => ({
          ...c,
          first_name: c.first_name || c.data?.first_name || '',
          last_name: c.last_name || c.data?.last_name || '',
          email: c.email || c.data?.email || '',
          display_status: c.status || 'scheduled',
          template: { name: templateMap.get(c.template_id) || 'None' },
          list: { name: listMap.get(c.list_id) || 'Unknown List' }
        }));

      console.log(`Fetched ${formatted.length} scheduled emails`);
      setScheduled(formatted);
    } catch (err: any) {
      console.error("Error fetching scheduled:", err);
      alert("Error loading scheduled emails: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRows(scheduled.map(s => s.id));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const handleEditTime = (id: string, currentIsoTime: string) => {
    setEditingTimeId(id);
    if (currentIsoTime) {
      const date = new Date(currentIsoTime);
      date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
      setEditTimeValue(date.toISOString().slice(0, 16));
    } else {
      setEditTimeValue('');
    }
  };

  const handleSaveTime = async (id: string) => {
    if (!editTimeValue) return;

    const newTime = new Date(editTimeValue);
    const newIsoTime = newTime.toISOString();
    const MIN_GAP_MS = 90 * 1000; // 90 seconds minimum gap

    // Check for conflicts with other scheduled emails
    const conflictingEmail = scheduled.find(s => {
      if (s.id === id) return false; // Skip self
      if (!s.scheduled_send_at) return false;
      const existingTime = new Date(s.scheduled_send_at).getTime();
      const newTimeMs = newTime.getTime();
      return Math.abs(existingTime - newTimeMs) < MIN_GAP_MS;
    });

    if (conflictingEmail) {
      alert(`Cannot schedule within 90 seconds of another email. Conflict with: ${conflictingEmail.email}`);
      return;
    }

    try {
      await supabase.from('contacts').update({ scheduled_send_at: newIsoTime }).eq('id', id);
      setScheduled(prev => prev.map(s => s.id === id ? { ...s, scheduled_send_at: newIsoTime } : s));
      setEditingTimeId(null);
    } catch (err: any) {
      alert("Failed to update time: " + err.message);
    }
  };

  const handleUnschedule = async (ids?: string[]) => {
    const targetIds = ids && ids.length > 0 ? ids : selectedRows;
    if (targetIds.length === 0) return;
    if (!confirm(`Are you sure you want to unschedule ${targetIds.length} contacts?`)) return;
    
    try {
      const { error } = await supabase
        .from('contacts')
        .update({
          status: 'pending',
          scheduled_send_at: null
        })
        .in('id', targetIds)
        .not('status', 'in', '(sent,bounced)');

      if (error) throw error;

      setScheduled(prev => prev.filter(s => !targetIds.includes(s.id)));
      setSelectedRows([]);
      await fetchScheduled();
    } catch (err: any) {
      alert('Failed to unschedule: ' + err.message);
    }
  };

  const handleUnscheduleSelected = () => {
    void handleUnschedule([...selectedRows]);
  };

  const sortedScheduled = [...scheduled].sort((a, b) => {
    if (sortBy === 'time-asc') {
      return new Date(a.scheduled_send_at || 0).getTime() - new Date(b.scheduled_send_at || 0).getTime();
    }
    if (sortBy === 'time-desc') {
      return new Date(b.scheduled_send_at || 0).getTime() - new Date(a.scheduled_send_at || 0).getTime();
    }
    if (sortBy === 'name') {
      return (a.first_name || '').localeCompare(b.first_name || '');
    }
    return 0;
  });

  const filteredScheduled = sortedScheduled.filter(s => 
    (s.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.first_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.last_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-display font-medium tracking-tight">Scheduled</h1>
          <p className="text-xs text-text-secondary mt-1">Emails queued for future delivery.</p>
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center px-6 py-3 border-b border-border space-x-4 bg-surface">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input 
            type="text" 
            placeholder="Search scheduled emails..." 
            className="bg-background border border-border rounded-lg pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary">Sort by:</span>
          <select 
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="bg-elevated border border-border text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="time-asc">Time (Soonest First)</option>
            <option value="time-desc">Time (Latest First)</option>
            <option value="name">Name (A-Z)</option>
          </select>
        </div>

        <button className="btn border border-border text-xs h-8 px-3" onClick={fetchScheduled}>
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-text-secondary">
              <th className="px-6 py-3 font-medium w-10">
                <input 
                  type="checkbox" 
                  checked={selectedRows.length === filteredScheduled.length && filteredScheduled.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th className="px-6 py-3 font-medium">Scheduled For</th>
              <th className="px-6 py-3 font-medium">Email</th>
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-[12.5px]">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-text-secondary">Loading...</td></tr>
            ) : filteredScheduled.map((row) => (
              <tr key={row.id} className="border-b border-border-soft hover:bg-elevated/50 transition-colors group">
                <td className="px-6 py-3">
                  <input 
                    type="checkbox" 
                    checked={selectedRows.includes(row.id)}
                    onChange={() => handleSelectRow(row.id)}
                  />
                </td>
                <td className="px-6 py-3 font-mono flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  {editingTimeId === row.id ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="datetime-local" 
                        value={editTimeValue}
                        onChange={(e) => setEditTimeValue(e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
                        autoFocus
                      />
                      <button onClick={() => handleSaveTime(row.id)} className="text-primary hover:underline text-xs">Save</button>
                      <button onClick={() => setEditingTimeId(null)} className="text-text-tertiary hover:underline text-xs">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group/time cursor-pointer" onClick={() => handleEditTime(row.id, row.scheduled_send_at)}>
                      <span className="text-status-finding">
                        {row.scheduled_send_at ? new Date(row.scheduled_send_at).toLocaleString() : 'Not set'}
                      </span>
                      {row.scheduled_send_at && new Date(row.scheduled_send_at).getTime() < Date.now() && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                          Overdue
                        </span>
                      )}
                      <span className="text-[10px] text-primary opacity-0 group-hover/time:opacity-100 transition-opacity">Edit</span>
                    </div>
                  )}
                </td>
                <td className="px-6 py-3 font-mono text-text-primary">{row.email}</td>
                <td className="px-6 py-3 text-text-secondary">{row.first_name} {row.last_name}</td>
                <td className="px-6 py-3 text-right">
                  <button onClick={() => handleUnschedule([row.id])} className="text-text-tertiary hover:text-status-bounced transition-colors px-2 py-1 flex items-center justify-end w-full gap-2 opacity-0 group-hover:opacity-100">
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {!loading && filteredScheduled.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
            <Calendar className="w-10 h-10 mb-4 opacity-50" />
            <p>No emails scheduled.</p>
          </div>
        )}
      </div>

      {selectedRows.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-elevated border border-border shadow-2xl rounded-lg px-6 py-3 flex items-center space-x-6 z-50">
          <span className="text-sm font-medium text-primary">{selectedRows.length} selected</span>
          <button onClick={handleUnscheduleSelected} className="flex items-center text-sm text-text-secondary hover:text-red-400 gap-2">
            <RotateCcw className="w-4 h-4" /> Unschedule
          </button>
          <button onClick={() => setSelectedRows([])} className="text-sm text-text-tertiary hover:text-text-primary flex items-center gap-2">
            <X className="w-4 h-4" /> Clear
          </button>
        </div>
      )}
    </div>
  );
}
