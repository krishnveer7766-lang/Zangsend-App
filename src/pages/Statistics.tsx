import { useState, useEffect } from 'react';
import { Mail, Eye, MousePointerClick, Users, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function StatisticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ sent: 0, opened: 0, clicked: 0 });
  const [leads, setLeads] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, company_name, status, opened_at, clicked_at, sent_at, data')
        .order('opened_at', { ascending: false, nullsFirst: false });

      if (error) throw error;

      if (contacts) {
        const sentContacts = contacts.filter((c: any) =>
          c.status === 'sent' || c.sent_at || c.data?.activity?.sent_at
        );
        const sent = sentContacts.length;
        const opened = sentContacts.filter((c: any) => c.opened_at).length;
        const clicked = sentContacts.filter((c: any) => c.clicked_at).length;
        
        setStats({ sent, opened, clicked });
        setLeads(sentContacts);
      }
    } catch (err) {
      console.error('Error fetching statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter(l => 
    l.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const trackerLeads = filteredLeads.filter(l => l.opened_at || l.clicked_at);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-display font-medium tracking-tight">Campaign Statistics</h1>
          <p className="text-xs text-text-secondary mt-1">Real-time tracking of email opens and link clicks.</p>
        </div>
        <button onClick={fetchStats} className="btn border border-border text-xs px-4 h-9">
          Refresh Data
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 text-text-secondary mb-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Mail className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium">Total Sent</span>
            </div>
            <div className="text-3xl font-mono font-bold">{stats.sent}</div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 text-status-opened mb-3">
              <div className="p-2 bg-status-opened/10 rounded-lg">
                <Eye className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium">Unique Opens</span>
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-3xl font-mono font-bold">{stats.opened}</div>
              <div className="text-sm text-text-tertiary">
                {stats.sent > 0 ? Math.round((stats.opened / stats.sent) * 100) : 0}% rate
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 text-primary mb-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <MousePointerClick className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium">Link Clicks / CV Opens</span>
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-3xl font-mono font-bold">{stats.clicked}</div>
              <div className="text-sm text-text-tertiary">
                {stats.sent > 0 ? Math.round((stats.clicked / stats.sent) * 100) : 0}% rate
              </div>
            </div>
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-elevated/30">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-text-tertiary" />
              Detailed Lead Tracking
            </h2>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input 
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-background border border-border rounded-lg pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-elevated/10">
                  <th className="px-5 py-3 text-[10px] uppercase tracking-wider font-bold text-text-tertiary">Lead</th>
                  <th className="px-5 py-3 text-[10px] uppercase tracking-wider font-bold text-text-tertiary">Company</th>
                  <th className="px-5 py-3 text-[10px] uppercase tracking-wider font-bold text-text-tertiary text-center">Status</th>
                  <th className="px-5 py-3 text-[10px] uppercase tracking-wider font-bold text-text-tertiary">Last Opened</th>
                  <th className="px-5 py-3 text-[10px] uppercase tracking-wider font-bold text-text-tertiary">Link Clicked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={5} className="px-5 py-20 text-center text-text-tertiary">Loading statistics...</td></tr>
                ) : trackerLeads.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-20 text-center text-text-tertiary">No engagement tracked yet.</td></tr>
                ) : trackerLeads.map(lead => (
                  <tr key={lead.id} className="hover:bg-elevated/5 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-text-primary">
                          {lead.first_name} {lead.last_name || ''}
                        </span>
                        <span className="text-xs text-text-tertiary">{lead.email}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-text-secondary">{lead.company_name || '—'}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        lead.clicked_at ? 'bg-primary/20 text-primary' : 
                        lead.opened_at ? 'bg-status-opened/20 text-status-opened' : 'bg-text-tertiary/10 text-text-tertiary'
                      }`}>
                        {lead.clicked_at ? 'CLICKED' : lead.opened_at ? 'OPENED' : 'SENT'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {lead.opened_at ? (
                        <div className="flex flex-col">
                          <span className="text-xs text-text-secondary">{new Date(lead.opened_at).toLocaleDateString()}</span>
                          <span className="text-[10px] text-text-tertiary">{new Date(lead.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-text-tertiary italic">Not opened yet</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {lead.clicked_at ? (
                        <div className="flex flex-col">
                          <span className="text-xs text-primary font-medium">{new Date(lead.clicked_at).toLocaleDateString()}</span>
                          <span className="text-[10px] text-primary/70">{new Date(lead.clicked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-text-tertiary">No clicks</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
