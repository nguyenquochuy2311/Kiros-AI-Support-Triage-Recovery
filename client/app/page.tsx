
'use client';

import { useEffect, useState } from 'react';
import { useSSE } from '../hooks/useSSE';
import { ChevronDown } from 'lucide-react';

interface Ticket {
  id: string;
  content: string;
  status: 'PENDING' | 'PROCESSED' | 'FAILED' | 'RESOLVED';
  category?: string;
  urgency?: 'High' | 'Medium' | 'Low';
  sentiment?: number;
  draftReply?: string;
  finalReply?: string;
  createdAt: string;

  updatedAt?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function Dashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  // Use callback for reliable event handling (no drops)
  useSSE<any>(`${API_URL}/api/events`, (sseData) => {
    if (sseData.type === 'TICKET_UPDATED') {
      setTickets(prev => prev.map(t => t.id === sseData.ticketId ? { ...t, ...sseData } : t));
    } else if (sseData.type === 'TICKET_CREATED') {
      setTickets(prev => {
        if (prev.find(t => t.id === sseData.ticket.id)) return prev;
        return [sseData.ticket, ...prev];
      });
    } else if (sseData.type === 'TICKET_PARTIAL') {
      setTickets(prev => prev.map(t => {
        if (t.id === sseData.ticketId) {
          // Determine new draft reply
          const currentDraft = t.draftReply || '';
          const newDraft = currentDraft + sseData.delta;
          return { ...t, draftReply: newDraft };
        }
        return t;
      }));
    }
  });

  const [newTicketContent, setNewTicketContent] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchTickets = async () => {
    try {
      const res = await fetch(`${API_URL}/api/tickets`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setTickets(data);
      } else {
        console.error('API returned non-array data:', data);
        setTickets([]);
      }
    } catch (err) {
      console.error('Failed to fetch tickets', err);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);

  const createTicket = async () => {
    if (!newTicketContent) return;
    setCreateError(null);
    try {
      const res = await fetch(`${API_URL}/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newTicketContent }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        let errorMessage = 'Failed to create ticket';

        if (errorData.error) {
          if (Array.isArray(errorData.error)) {
            // Handle Zod errors
            errorMessage = errorData.error.map((e: any) => e.message).join(', ');
          } else {
            errorMessage = errorData.error;
          }
        }

        setCreateError(errorMessage);
        return;
      }

      const newTicket = await res.json();
      setCreatedTicketId(newTicket.id);

      setTickets(prev => {
        if (prev.find(t => t.id === newTicket.id)) return prev;
        return [newTicket, ...prev];
      });
      setNewTicketContent('');
      setIsDialogOpen(false);
    } catch (err) {
      console.error('Failed to create ticket', err);
      setCreateError('Network error: Could not reach the server.');
    }
  };

  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) {
      case 'High': return 'bg-red-500 text-white';
      case 'Medium': return 'bg-yellow-500 text-white';
      case 'Low': return 'bg-green-500 text-white';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-4 font-sans text-gray-900">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Support Triage Hub (Basic UI)</h1>

        <button
          onClick={() => setIsDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          + New Ticket
        </button>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold mb-2">Create New Ticket</h2>
            <p className="text-gray-600 mb-4">Simulate a user submitting a complaint.</p>
            <textarea
              value={newTicketContent}
              onChange={(e) => setNewTicketContent(e.target.value)}
              placeholder="Describe your issue..."
              className="w-full border border-gray-300 rounded p-2 mb-4 min-h-[100px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {createError && (
              <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm border border-red-200">
                {createError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsDialogOpen(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded"
              >
                Cancel
              </button>
              <button
                onClick={createTicket}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                disabled={!newTicketContent}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {tickets.length === 0 && <p className="text-gray-500 text-center py-10">No tickets found.</p>}
        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            getUrgencyColor={getUrgencyColor}
            autoExpand={ticket.id === createdTicketId}
            onTicketUpdated={(updatedTicket) => {
              setTickets(prev => prev.map(t => t.id === updatedTicket.id ? updatedTicket : t));
            }}
          />
        ))}
      </div>
    </div>
  );
}

function TicketCard({ ticket, getUrgencyColor, autoExpand, onTicketUpdated }: { ticket: Ticket, getUrgencyColor: (u?: string) => string, autoExpand?: boolean, onTicketUpdated: (t: Ticket) => void }) {
  const [reply, setReply] = useState(ticket.draftReply || '');
  const [isSaving, setIsSaving] = useState(false);
  const [expanded, setExpanded] = useState(autoExpand || false);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (autoExpand) {
      setExpanded(true);
    }
  }, [autoExpand]);

  useEffect(() => {
    // 1. If we are caught up or ahead (perfect sync), do nothing.
    if (reply === ticket.draftReply) return;

    // 2. If status becomes PROCESSED (done) or RESOLVED, snap to finish immediately.
    // This allows the user to see the full text and start editing right away.
    if ((ticket.status === 'PROCESSED' || ticket.status === 'RESOLVED') && ticket.draftReply) {
      setReply(ticket.draftReply);
      return;
    }

    // 3. Smooth Streaming (Only while PENDING)
    if (ticket.status === 'PENDING' && ticket.draftReply) {
      // Safety: If local reply isn't a prefix of the new draft (e.g. content correction), snap to it.
      if (!ticket.draftReply.startsWith(reply)) {
        setReply(ticket.draftReply);
        return;
      }

      // Type next character if we have more to show
      if (ticket.draftReply.length > reply.length) {
        const timeout = setTimeout(() => {
          setReply(ticket.draftReply!.slice(0, reply.length + 1));
        }, 90); // 90ms per character
        return () => clearTimeout(timeout);
      }
    }
  }, [ticket.draftReply, reply, ticket.status]);

  const resolve = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalReply: reply })
      });
      if (res.ok) {
        const updatedTicket = await res.json();
        onTicketUpdated(updatedTicket);
      }
    } catch (e) {
      console.error(e);
    }
    setIsSaving(false);
  };

  return (
    <div className={`bg-white shadow rounded-lg border-l-4 p-4 transition-all hover:shadow-md ${ticket.urgency === 'High' ? 'border-l-red-500' : 'border-l-gray-300'}`}>
      <div className="flex justify-between items-start mb-2 cursor-pointer group" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {ticket.category || 'Uncategorized'}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded ? 'transform rotate-180' : ''}`} />
          </div>
          <h3 className="text-lg font-bold mt-1 text-gray-900 group-hover:text-blue-600 transition-colors">
            {ticket.content.substring(0, 100)}{ticket.content.length > 100 ? '...' : ''}
          </h3>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-gray-400">
            {new Date(ticket.updatedAt || ticket.createdAt).toLocaleString()}
          </span>
          {ticket.urgency && (
            <span className={`px-2 py-1 rounded text-xs font-bold ${getUrgencyColor(ticket.urgency)}`}>
              {ticket.urgency}
            </span>
          )}
          <span className="px-2 py-1 rounded text-xs font-bold border border-gray-300 bg-white text-gray-700">
            {ticket.status}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-gray-700 mb-4 whitespace-pre-wrap">{ticket.content}</p>

          {ticket.sentiment && (
            <div className="mb-4 text-sm text-gray-600">
              <strong>Sentiment Score:</strong> {ticket.sentiment}/10
            </div>
          )}

          {ticket.status !== 'RESOLVED' && (
            <div className="mt-4 p-4 bg-gray-50 rounded border border-gray-200">
              <label className="text-sm font-bold mb-2 block text-gray-700">
                {ticket.status === 'PENDING' ? 'AI is analyzing & drafting...' : 'AI Draft Reply:'}
              </label>

              {/* Show Pulse ONLY if PENDING and No Reply yet */}
              {ticket.status === 'PENDING' && !ticket.draftReply && (
                <div className="flex items-center space-x-2 text-gray-500 animate-pulse mb-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animation-delay-200"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animation-delay-400"></div>
                  <span className="text-sm">Generating response...</span>
                </div>
              )}

              {/* Show Textarea if PROCESSED OR (PENDING + draft content exists for streaming) */}
              {(ticket.status === 'PROCESSED' || ticket.draftReply) && (
                <>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    disabled={ticket.status === 'PENDING'}
                    className="w-full border border-gray-300 rounded p-2 mb-2 min-h-[100px] focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-100"
                    placeholder="Draft reply here..."
                  />
                  <button
                    onClick={resolve}
                    disabled={isSaving || ticket.status === 'PENDING' || !reply}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Sending...' : 'Approve & Send'}
                  </button>
                </>
              )}
            </div>
          )}

          {ticket.status === 'RESOLVED' && (
            <div className="mt-4 p-4 bg-green-50 rounded border border-green-200">
              <p className="text-sm font-bold text-green-800 mb-1">Final Reply Sent:</p>
              <p className="text-gray-800 whitespace-pre-wrap">{ticket.finalReply}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
