import { useState, useEffect, useRef, useCallback } from 'react';

interface AgentStatus {
  status: 'idle' | 'negotiating' | 'analyzing';
  task?: string;
}

interface Conversation {
  conversation_id: string;
  messages: Array<{
    id: string;
    timestamp: string;
    agent: string;
    type: 'message' | 'thought' | 'action';
    content: string;
    confidence?: number;
    reasoning?: string;
  }>;
}

interface L2Status {
  mode: 'l2' | 'direct' | 'unavailable';
  connected?: boolean;
  network_state?: string;
  active_negotiations?: number;
  current_session_id?: string;
}

interface WorkflowStep {
  step: number;
  name: string;
  status: string;
  details: any;
  timestamp: string;
}

interface WebSocketState {
  isConnected: boolean;
  agentStatus: AgentStatus;
  currentConversation: Conversation | null;
  l2Status: L2Status;
  workflowSteps: WorkflowStep[];
  stats: {
    totalBalance: number;
    activeLoans: number;
    totalProfit: number;
    agentStatus: string;
  };
}

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';

export function useWebSocket() {
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    agentStatus: { status: 'idle' },
    currentConversation: null,
    l2Status: { mode: 'unavailable' },
    workflowSteps: [],
    stats: {
      totalBalance: 0,
      activeLoans: 0,
      totalProfit: 0,
      agentStatus: 'idle'
    }
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      wsRef.current = new WebSocket(WS_URL);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setState(prev => ({ ...prev, isConnected: true }));
        reconnectAttempts.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setState(prev => ({ ...prev, isConnected: false }));

        // Attempt to reconnect if not intentionally closed
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts})`);
            connect();
          }, 2000 * reconnectAttempts.current);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, []);

  const handleMessage = (message: any) => {
    switch (message.type) {
      case 'connected':
        console.log('WebSocket connection confirmed');
        break;

      case 'agent_status':
        setState(prev => ({
          ...prev,
          agentStatus: message.data,
          stats: { ...prev.stats, agentStatus: message.data.status }
        }));
        break;

      case 'conversation_update':
        // Fetch latest conversation
        fetchLatestConversation();
        break;

      case 'network_status':
      case 'l2_status':
      case 'hydra_status': // Backward-compat alias — backend now sends network_status
        setState(prev => ({
          ...prev,
          l2Status: {
            mode: 'l2',  // Always Solana L1 — mode field kept for UI compat
            connected: message.data.connected,
            network_state: message.data.network_state || message.data.head_state || 'devnet',
            active_negotiations: message.data.active_negotiations,
            current_session_id: message.data.current_session_id || message.data.current_head_id
          }
        }));
        break;

      case 'workflow_step':
        setState(prev => ({
          ...prev,
          workflowSteps: [...prev.workflowSteps.slice(-9), message.data] // Keep last 10 steps
        }));
        break;

      case 'stats_update':
        setState(prev => ({
          ...prev,
          stats: { ...prev.stats, ...message.data }
        }));
        break;

      case 'workflow_started':
        // Reset workflow steps for new workflow
        setState(prev => ({
          ...prev,
          workflowSteps: [],
          agentStatus: { status: 'negotiating', task: 'Starting workflow...' }
        }));
        break;

      default:
        console.log('Unhandled WebSocket message:', message);
    }
  };

  const fetchLatestConversation = async () => {
    try {
      const response = await fetch('/api/conversation/latest');
      const data = await response.json();
      if (data.conversation_id && data.messages.length > 0) {
        setState(prev => ({
          ...prev,
          currentConversation: data
        }));
      }
    } catch (error) {
      console.error('Failed to fetch conversation:', error);
    }
  };

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Send ping every 30 seconds to keep connection alive
  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => clearInterval(pingInterval);
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    fetchLatestConversation
  };
}

