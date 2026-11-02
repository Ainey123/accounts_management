"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare, Send, RefreshCw, Trash2, Clock, User, ShieldCheck,
  Users, CheckCircle2, AlertCircle, Sparkles, Search, Check, Volume2
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

export default function MessagesCenterPage() {
  const { user, isHydrated } = useAuth();
  const router = useRouter();

  const isAuthorized = user?.role === 'ADMIN' || user?.role === 'SUB_ADMIN';
  const isSupervisor = user?.role === 'SUB_ADMIN';

  // Navigation guard
  useEffect(() => {
    if (isHydrated && user && !isAuthorized) {
      router.push('/dashboard');
    }
  }, [user, isHydrated, router, isAuthorized]);

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedRecipientType, setSelectedRecipientType] = useState('user'); // 'user' | 'broadcast'
  const [searchQuery, setSearchQuery] = useState('');

  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [senderName, setSenderName] = useState(isSupervisor ? 'Supervisor (Sub Admin)' : 'Fatma');
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState('success');

  const messagesEndRef = useRef(null);

  // Load all users
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await apiFetch('/api/users');
      const allUsers = res.users || [];
      setUsers(allUsers);

      // Default selection
      if (!selectedUserId && allUsers.length > 0) {
        if (isSupervisor) {
          // Default supervisor to own thread (talking to Admin) or first office batch
          const firstOffice = allUsers.find((u) => u.role === 'EMPLOYEE');
          setSelectedUserId(firstOffice ? firstOffice.id : allUsers[0].id);
        } else {
          // Admin defaults to supervisor if exists, or first employee
          const sup = allUsers.find((u) => u.role === 'SUB_ADMIN');
          setSelectedUserId(sup ? sup.id : allUsers[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, [isSupervisor, selectedUserId]);

  useEffect(() => {
    if (isAuthorized) {
      loadUsers();
    }
  }, [isAuthorized, loadUsers]);

  // Load comments for selected user
  const loadComments = useCallback(async (targetId) => {
    if (!targetId) {
      setComments([]);
      return;
    }
    setLoadingComments(true);
    try {
      const res = await apiFetch(`/api/comments?userId=${targetId}`);
      setComments(res.comments || []);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoadingComments(false);
    }
  }, []);

  useEffect(() => {
    if (selectedUserId && selectedRecipientType === 'user') {
      loadComments(selectedUserId);
    }
  }, [selectedUserId, selectedRecipientType, loadComments]);

  // Scroll to bottom when new comments load
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const showToast = (msg, type = 'success') => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 4000);
  };

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    if (selectedRecipientType === 'broadcast') {
      setSubmitting(true);
      try {
        const res = await apiFetch('/api/comments', {
          method: 'POST',
          body: JSON.stringify({
            broadcastAll: true,
            content: messageText.trim(),
            adminName: senderName.trim(),
          }),
        });
        setMessageText('');
        showToast(`Announcement broadcasted to all ${res.broadcastCount || 'registered'} employees!`);
        if (selectedUserId) {
          await loadComments(selectedUserId);
        }
      } catch (err) {
        showToast(err.message || 'Failed to broadcast message', 'error');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!selectedUserId) {
      showToast('Please select a recipient', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/api/comments', {
        method: 'POST',
        body: JSON.stringify({
          userId: selectedUserId,
          content: messageText.trim(),
          adminName: senderName.trim(),
        }),
      });
      setMessageText('');
      await loadComments(selectedUserId);
      showToast('Message sent successfully!');
    } catch (err) {
      showToast(err.message || 'Failed to send message', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete message
  const handleDeleteComment = async (commentId) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
      await apiFetch(`/api/comments/${commentId}`, { method: 'DELETE' });
      await loadComments(selectedUserId);
      showToast('Message removed');
    } catch (err) {
      showToast(err.message || 'Failed to delete message', 'error');
    }
  };

  // Quick preset pills
  const handleInsertPreset = (text) => {
    setMessageText((prev) => (prev ? `${prev} ${text}` : text));
  };

  if (!isHydrated || !user || !isAuthorized) {
    return null;
  }

  // Filter users by search
  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.employeeName || '').toLowerCase().includes(q) ||
      (u.batchLabel || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  });

  const officeUsers = filteredUsers.filter((u) => u.role === 'EMPLOYEE');
  const fieldUsers = filteredUsers.filter((u) => u.role === 'FIELD_EMPLOYEE');
  const subAdminUsers = filteredUsers.filter((u) => u.role === 'SUB_ADMIN');

  const selectedUserObj = users.find((u) => u.id === selectedUserId);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 20px 48px', color: '#f8fafc' }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              background: isSupervisor ? 'linear-gradient(135deg, #d97706, #f59e0b)' : 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
              padding: 9,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isSupervisor ? '0 4px 14px rgba(245, 158, 11, 0.3)' : '0 4px 14px rgba(139, 92, 246, 0.3)'
            }}>
              <MessageSquare size={22} color="#ffffff" />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>
                Staff & Admin Messaging Center
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: isSupervisor ? 'rgba(245, 158, 11, 0.2)' : 'rgba(167, 139, 250, 0.2)',
                  color: isSupervisor ? '#fbbf24' : '#c084fc',
                }}>
                  {isSupervisor ? 'Supervisor / Sub Admin Terminal' : 'Master Admin Dispatch'}
                </span>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>
                  Two-way direct communication with every employee & management
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className="nexus-btn nexus-btn-ghost"
            onClick={() => {
              if (selectedUserId) loadComments(selectedUserId);
            }}
            style={{ fontSize: 13, gap: 6 }}
          >
            <RefreshCw size={14} className={loadingComments ? 'spin' : ''} /> Refresh Feed
          </button>
        </div>
      </div>

      {toast && (
        <div style={{
          marginBottom: 16,
          padding: '12px 16px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          background: toastType === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          color: toastType === 'error' ? '#f87171' : '#34d399',
          border: toastType === 'error' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          {toastType === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          {toast}
        </div>
      )}

      {/* TWO COLUMN MESSAGING GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        gap: 20,
        minHeight: 650,
        alignItems: 'stretch'
      }}>
        
        {/* LEFT PANEL: CONTACT DIRECTORY */}
        <div className="glass-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>SELECT CONVERSATION</span>
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{users.length} registered</span>
            </div>

            {/* Quick Search */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#64748b' }} />
              <input
                type="text"
                placeholder="Search staff, batch, name..."
                className="nexus-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ fontSize: 12, paddingLeft: 32, height: 36, width: '100%' }}
              />
            </div>

            {/* BROADCAST OPTION */}
            <button
              type="button"
              onClick={() => setSelectedRecipientType('broadcast')}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: selectedRecipientType === 'broadcast' ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.08)',
                background: selectedRecipientType === 'broadcast' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                color: selectedRecipientType === 'broadcast' ? '#fbbf24' : '#cbd5e1',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                marginBottom: 10
              }}
            >
              <Sparkles size={16} color={selectedRecipientType === 'broadcast' ? '#fbbf24' : '#94a3b8'} />
              <div>
                <div>Broadcast to All Staff</div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>Send announcement to everyone</div>
              </div>
            </button>
          </div>

          {/* CONTACT LIST */}
          <div style={{ overflowY: 'auto', flex: 1, maxHeight: 520, display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4 }}>
            
            {/* MANAGEMENT / SUPERVISOR GROUP */}
            {isSupervisor ? (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', padding: '4px 8px', letterSpacing: 0.5 }}>
                  MANAGEMENT / ADMIN
                </div>
                {/* For supervisor, if they select their own ID, it is their direct thread with Admin */}
                {user.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRecipientType('user');
                      setSelectedUserId(user.id);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: selectedRecipientType === 'user' && selectedUserId === user.id ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.05)',
                      background: selectedRecipientType === 'user' && selectedUserId === user.id ? 'rgba(167, 139, 250, 0.15)' : 'transparent',
                      color: selectedRecipientType === 'user' && selectedUserId === user.id ? '#ffffff' : '#cbd5e1',
                      fontSize: 12.5,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <ShieldCheck size={16} color="#a78bfa" />
                    <div style={{ flex: 1 }}>
                      <div>Master Admin (Fatma / Management)</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>Direct Management Thread</div>
                    </div>
                  </button>
                )}
              </div>
            ) : (
              subAdminUsers.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', padding: '4px 8px', letterSpacing: 0.5 }}>
                    SUPERVISORS
                  </div>
                  {subAdminUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setSelectedRecipientType('user');
                        setSelectedUserId(u.id);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: selectedRecipientType === 'user' && selectedUserId === u.id ? '1px solid #fbbf24' : '1px solid rgba(255,255,255,0.05)',
                        background: selectedRecipientType === 'user' && selectedUserId === u.id ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                        color: selectedRecipientType === 'user' && selectedUserId === u.id ? '#ffffff' : '#cbd5e1',
                        fontSize: 12.5,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <ShieldCheck size={16} color="#fbbf24" />
                      <div style={{ flex: 1 }}>
                        <div>{u.employeeName || 'Supervisor (Sub Admin)'}</div>
                        <div style={{ fontSize: 11, color: '#fbbf24' }}>Sub Admin</div>
                      </div>
                    </button>
                  ))}
                </div>
              )
            )}

            {/* OFFICE STAFF (BATCHES) */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#00f2fe', padding: '4px 8px', letterSpacing: 0.5 }}>
                OFFICE BATCHES
              </div>
              {officeUsers.length === 0 ? (
                <div style={{ fontSize: 12, color: '#64748b', padding: '4px 8px' }}>No office staff match</div>
              ) : (
                officeUsers.map((u) => {
                  const isSelected = selectedRecipientType === 'user' && selectedUserId === u.id;
                  const label = u.batchLabel || u.employeeName;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setSelectedRecipientType('user');
                        setSelectedUserId(u.id);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: isSelected ? '1px solid #00f2fe' : '1px solid rgba(255,255,255,0.05)',
                        background: isSelected ? 'rgba(0, 242, 254, 0.12)' : 'transparent',
                        color: isSelected ? '#ffffff' : '#cbd5e1',
                        fontSize: 12.5,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        textAlign: 'left',
                        marginBottom: 3
                      }}
                    >
                      <User size={15} color={isSelected ? '#00f2fe' : '#64748b'} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {label}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {u.employeeName}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* FIELD STAFF */}
            {fieldUsers.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#34d399', padding: '4px 8px', letterSpacing: 0.5 }}>
                  FIELD EMPLOYEES
                </div>
                {fieldUsers.map((u) => {
                  const isSelected = selectedRecipientType === 'user' && selectedUserId === u.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setSelectedRecipientType('user');
                        setSelectedUserId(u.id);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: isSelected ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.05)',
                        background: isSelected ? 'rgba(52, 211, 153, 0.12)' : 'transparent',
                        color: isSelected ? '#ffffff' : '#cbd5e1',
                        fontSize: 12.5,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        textAlign: 'left',
                        marginBottom: 3
                      }}
                    >
                      <User size={15} color={isSelected ? '#34d399' : '#64748b'} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {u.employeeName}
                        </div>
                        <div style={{ fontSize: 11, color: '#34d399' }}>Field Staff</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: CHAT STREAM & COMPOSER */}
        <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
          
          {/* CONVERSATION TOP BAR */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: 16,
            marginBottom: 16,
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                {selectedRecipientType === 'broadcast' ? (
                  <>
                    <Sparkles size={18} color="#fbbf24" />
                    <span>Broadcast Announcement to All Employees</span>
                  </>
                ) : isSupervisor && selectedUserId === user.id ? (
                  <>
                    <ShieldCheck size={18} color="#a78bfa" />
                    <span>Conversation with Master Admin (Fatma / Management)</span>
                  </>
                ) : (
                  <>
                    <User size={18} color="#00f2fe" />
                    <span>
                      Thread with {selectedUserObj?.batchLabel || selectedUserObj?.employeeName || 'Staff Member'}
                    </span>
                  </>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                {selectedRecipientType === 'broadcast'
                  ? 'This message will be dispatched directly to every active office and field employee feed'
                  : selectedUserObj?.email || 'Direct two-way comment channel'}
              </div>
            </div>

            {selectedRecipientType === 'user' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="status-pill active" style={{ fontSize: 11, background: 'rgba(0,242,254,0.15)', color: '#00f2fe' }}>
                  {comments.length} Messages Logged
                </span>
              </div>
            )}
          </div>

          {/* MESSAGE FEED */}
          {selectedRecipientType === 'broadcast' ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 40,
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 12,
              border: '1px dashed rgba(255, 255, 255, 0.1)',
              marginBottom: 16,
              textAlign: 'center'
            }}>
              <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: 14, borderRadius: 50, marginBottom: 12 }}>
                <Sparkles size={28} color="#fbbf24" />
              </div>
              <h3 style={{ fontSize: 17, color: '#f8fafc', margin: '0 0 6px 0' }}>All-Employee Announcement Mode</h3>
              <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 450, margin: 0, lineHeight: 1.5 }}>
                Type your message below and click <strong>Broadcast to Everyone</strong>. Every registered office batch and field employee will receive this in their real-time messages section.
              </p>
            </div>
          ) : (
            <div style={{
              flex: 1,
              overflowY: 'auto',
              maxHeight: 400,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              paddingRight: 6,
              marginBottom: 16
            }}>
              {loadingComments ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                  <RefreshCw size={20} className="spin" style={{ display: 'inline', marginRight: 8 }} />
                  Loading message history...
                </div>
              ) : comments.length === 0 ? (
                <div style={{
                  padding: 40,
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: 12,
                  border: '1px dashed rgba(255, 255, 255, 0.1)',
                  color: '#94a3b8',
                  fontSize: 13
                }}>
                  No messages exchanged in this thread yet. Type a note or instruction below to start!
                </div>
              ) : (
                comments.map((c) => {
                  const isEmployee = c.senderRole === 'EMPLOYEE';
                  const isSup = c.senderRole === 'SUB_ADMIN';
                  const isAdmin = c.senderRole === 'ADMIN';

                  return (
                    <div
                      key={c.id}
                      style={{
                        background: isEmployee
                          ? 'rgba(16, 185, 129, 0.08)'
                          : isSup
                          ? 'rgba(245, 158, 11, 0.08)'
                          : 'rgba(139, 92, 246, 0.08)',
                        borderRadius: 12,
                        padding: '14px 18px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderLeft: isEmployee
                          ? '4px solid #10b981'
                          : isSup
                          ? '4px solid #f59e0b'
                          : '4px solid #a78bfa',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: isEmployee
                              ? 'rgba(16, 185, 129, 0.2)'
                              : isSup
                              ? 'rgba(245, 158, 11, 0.2)'
                              : 'rgba(139, 92, 246, 0.2)',
                            color: isEmployee ? '#34d399' : isSup ? '#fbbf24' : '#c084fc',
                          }}>
                            {isEmployee ? 'Employee Reply' : isSup ? 'Supervisor (Sub Admin)' : 'Admin'}
                          </span>
                          <span style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={12} />
                            {new Date(c.createdAt).toLocaleString('en-US', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteComment(c.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: 4,
                            opacity: 0.7,
                          }}
                          title="Delete message"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div style={{ fontSize: 14, color: '#f1f5f9', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                        {c.content}
                      </div>

                      <div style={{
                        textAlign: 'right',
                        marginTop: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        color: isEmployee ? '#34d399' : isSup ? '#fbbf24' : '#c084fc'
                      }}>
                        By {c.senderName || c.adminName || (isEmployee ? 'Employee' : 'Management')}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* QUICK PRESETS PILLS */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}>Quick Preset Instructions:</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                '⚠️ Urgent: Pending Payment Clearance reminder',
                '📋 Please submit pending site survey / inspection proof',
                '💵 Work completion verified, awaiting billing PO',
                '✅ Account audit verified and acknowledged',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleInsertPreset(preset)}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#94a3b8',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* COMPOSER FORM */}
          <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 220 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Posting As:
                </label>
                <input
                  type="text"
                  className="nexus-input"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  style={{ fontSize: 12, height: 36 }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Message Content:
                </label>
                <textarea
                  rows={3}
                  className="nexus-input"
                  placeholder={
                    selectedRecipientType === 'broadcast'
                      ? 'Type company-wide announcement to all staff members...'
                      : `Write message or instruction for ${selectedUserObj?.employeeName || 'recipient'}...`
                  }
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  required
                  style={{ fontSize: 13, resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="submit"
                className="nexus-btn nexus-btn-primary"
                disabled={submitting || !messageText.trim()}
                style={{
                  padding: '10px 20px',
                  fontSize: 13,
                  gap: 8,
                  background:
                    selectedRecipientType === 'broadcast'
                      ? 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)'
                      : isSupervisor
                      ? 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)'
                      : undefined
                }}
              >
                <Send size={15} />
                {submitting
                  ? 'Dispatching...'
                  : selectedRecipientType === 'broadcast'
                  ? 'Broadcast to Everyone'
                  : 'Send Message'}
              </button>
            </div>
          </form>

        </div>
      </div>

    </div>
  );
}
