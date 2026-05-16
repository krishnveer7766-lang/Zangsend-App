import { useState, useEffect } from 'react';
import { Clock, FileText, UserPlus, CheckCircle2, AlertCircle, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchActivityLog();
  }, []);

  const fetchActivityLog = async () => {
    setLoading(true);
    try {
      // We derive activity from contacts state changes
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id, email, status, 
          created_at, sent_at, scheduled_send_at, data,
          templates(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform contacts into activity events
      const events: any[] = [];
      data?.forEach(contact => {
        const firstName = contact?.data?.first_name || '';
        const lastName = contact?.data?.last_name || '';
        const fallbackEmail = contact?.data?.email || contact?.email || 'Unknown contact';
        const name = `${firstName} ${lastName}`.trim() || fallbackEmail;
        
        // Event: Contact Created
        events.push({
          id: `${contact.id}-created`,
          type: 'added',
          title: 'Contact added to list',
          description: `Added ${name} to your lead list.`,
          timestamp: contact.created_at,
          icon: UserPlus,
          color: 'text-text-tertiary',
          bg: 'bg-elevated'
        });

        const templates: any = contact.templates;
        const templateName = Array.isArray(templates) ? templates[0]?.name : templates?.name;
        const activity = contact.data?.activity || {};

        // Event: Scheduled
        if (contact.scheduled_send_at || activity.scheduled_at) {
          events.push({
            id: `${contact.id}-scheduled`,
            type: 'scheduled',
            title: 'Email Scheduled',
            description: `Scheduled campaign for ${name} using "${templateName || 'Default'}" template.`,
            timestamp: contact.scheduled_send_at || activity.scheduled_at,
            icon: Clock,
            color: 'text-status-finding',
            bg: 'bg-status-finding/10'
          });
        }

        // Event: Draft
        if (contact.status === 'draft' || activity.drafted_at) {
          events.push({
            id: `${contact.id}-draft`,
            type: 'draft',
            title: 'Created Draft',
            description: `Gmail draft created for ${name}.`,
            timestamp: activity.drafted_at || contact.created_at,
            icon: FileText,
            color: 'text-text-secondary',
            bg: 'bg-elevated'
          });
        }

        // Event: Processing
        if (contact.status === 'processing' || activity.processing_at) {
          events.push({
            id: `${contact.id}-processing`,
            type: 'processing',
            title: 'Email Processing',
            description: `Started sending email to ${name}.`,
            timestamp: activity.processing_at || contact.scheduled_send_at || contact.created_at,
            icon: Clock,
            color: 'text-primary',
            bg: 'bg-primary-ghost'
          });
        }

        // Event: Sent
        if (contact.sent_at || activity.sent_at) {
          events.push({
            id: `${contact.id}-sent`,
            type: 'sent',
            title: 'Email Sent Successfully',
            description: `Campaign email delivered to ${name}.`,
            timestamp: contact.sent_at || activity.sent_at,
            icon: CheckCircle2,
            color: 'text-primary',
            bg: 'bg-primary-ghost'
          });
        }

        // Event: Bounced
        if (contact.status === 'bounced' || activity.failed_at) {
          events.push({
            id: `${contact.id}-failed`,
            type: 'failed',
            title: 'Delivery Failed',
            description: `Could not send email to ${name}. Please check SMTP settings.`,
            timestamp: activity.failed_at || contact.sent_at || contact.created_at,
            icon: AlertCircle,
            color: 'text-status-failed',
            bg: 'bg-status-failed/10'
          });
        }
      });

      // Sort by timestamp latest first
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivities(events);

    } catch (err) {
      console.error('Error fetching activity log:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredActivities = filter === 'all' 
    ? activities 
    : activities.filter(a => a.type === filter);

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
        <div>
          <h1 className="text-xl font-display font-medium tracking-tight">Activity History</h1>
          <p className="text-xs text-text-secondary mt-1">Timeline of all actions performed in ZangSends.</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-text-tertiary mr-1" />
          <select 
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="bg-elevated border border-border text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Activities</option>
            <option value="sent">Sent</option>
            <option value="scheduled">Scheduled</option>
            <option value="draft">Drafts</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
            <option value="added">New Leads</option>
          </select>
          <button onClick={fetchActivityLog} className="btn border border-border text-xs px-4 h-9 ml-2">
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 max-w-4xl mx-auto w-full">
        {loading ? (
          <div className="text-center py-20 text-text-tertiary">Loading activity history...</div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-20 text-text-tertiary">No actions logged yet.</div>
        ) : (
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-[17px] top-4 bottom-4 w-px bg-border-soft" />

            <div className="space-y-8">
              {filteredActivities.map((activity) => (
                <div key={activity.id} className="relative pl-12 group">
                  {/* Timeline Dot */}
                  <div className={`absolute left-0 top-0 w-9 h-9 rounded-full ${activity.bg} flex items-center justify-center border border-border group-hover:border-primary/30 transition-colors z-10 shadow-sm`}>
                    <activity.icon className={`w-4 h-4 ${activity.color}`} />
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-text-primary">{activity.title}</h3>
                      <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-widest bg-elevated px-2 py-0.5 rounded">
                        {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[10px] text-text-tertiary">
                        {new Date(activity.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary mt-1 leading-relaxed">
                      {activity.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
