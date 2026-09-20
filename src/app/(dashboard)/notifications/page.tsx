'use client';

import { useState, useEffect } from 'react';
import { timeAgo } from '@/lib/utils/date';
import { Bell, AlertTriangle, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { NotificationSeverity, NotificationType } from '@/types';

interface NotificationMock {
  _id: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationMock[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'CRITICAL' | 'UNREAD'>('ALL');
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    // Mock fetching
    const mock: NotificationMock[] = [
      { _id: '1', type: 'EMERGENCY_REQUEST', title: 'Critical Blood Request', message: 'Hospital A needs 2 units of O- blood immediately.', severity: 'CRITICAL', isRead: false, createdAt: new Date().toISOString() },
      { _id: '2', type: 'MATCH_ACCEPTED', title: 'Match Accepted', message: 'Donor John accepted your request.', severity: 'NORMAL', isRead: true, createdAt: new Date(Date.now() - 3600000).toISOString() },
      { _id: '3', type: 'SYSTEM', title: 'System Update', message: 'System maintenance scheduled for tomorrow.', severity: 'INFO', isRead: false, createdAt: new Date(Date.now() - 86400000).toISOString() },
    ];
    setNotifications(mock);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
  };

  const filtered = notifications.filter(n => {
    if (filter === 'CRITICAL') return n.severity === 'CRITICAL';
    if (filter === 'UNREAD') return !n.isRead;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getSeverityStyles = (severity: NotificationSeverity) => {
    switch (severity) {
      case 'CRITICAL': return 'border-l-red-500 bg-red-500/10';
      case 'HIGH': return 'border-l-amber-500 bg-amber-500/10';
      case 'NORMAL': return 'border-l-blue-500 bg-slate-800';
      case 'INFO': return 'border-l-slate-500 bg-slate-800';
      default: return 'border-l-slate-500 bg-slate-800';
    }
  };

  const getIcon = (severity: NotificationSeverity) => {
    switch (severity) {
      case 'CRITICAL': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'HIGH': return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case 'NORMAL': return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
      case 'INFO': return <Info className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto text-slate-200">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Notification Center</h1>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        <button 
          onClick={markAllRead}
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          Mark all as read
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {(['ALL', 'CRITICAL', 'UNREAD'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === f 
                ? 'bg-red-500/20 text-red-500 border border-red-500/50' 
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
            }`}
          >
            {f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading notifications...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-slate-900 rounded-lg border border-slate-800">
            <Bell className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No notifications found.</p>
          </div>
        ) : (
          filtered.map(notif => (
            <div 
              key={notif._id}
              onClick={() => !notif.isRead && markRead(notif._id)}
              className={`p-4 rounded-lg border-l-4 border-r border-y border-r-slate-800 border-y-slate-800 cursor-pointer transition-all ${getSeverityStyles(notif.severity)} ${!notif.isRead ? 'opacity-100 shadow-md shadow-black/20' : 'opacity-70'}`}
            >
              <div className="flex gap-4">
                <div className="mt-1">{getIcon(notif.severity)}</div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`text-sm ${notif.isRead ? 'font-medium text-slate-300' : 'font-bold text-white'}`}>
                      {notif.title}
                    </h3>
                    <span className="text-xs text-slate-500">{timeAgo(notif.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-400">{notif.message}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {filtered.length > 0 && (
        <div className="mt-8 flex justify-center">
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-400 hover:text-white disabled:opacity-50" disabled>Previous</button>
            <button className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-slate-400 hover:text-white">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
