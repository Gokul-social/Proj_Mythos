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
  mode: 'channel' | 'direct' | 'mock' | 'unavailable' | 'l2';
  connected?: boolean;
  network_state?: string;
  active_negotiations?: number;
  current_session_id?: string;
}

interface WorkflowStep {
  step: number;
  name: string;
  status: string;
  details: Record<string, unknown>;
  timestamp: string;
}

interface SocketMessage {
  type: string;
  data?: Record<string, unknown>;
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
          const message = JSON.parse(event.data) as SocketMessage;
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

  const handleMessage = (message: SocketMessage) => {
    switch (message.type) {
      case 'connected':
        console.log('WebSocket connection confirmed');
        break;

      case 'agent_status':
        {
        const statusValue = message.data?.status;
        const status: AgentStatus['status'] =
          statusValue === 'idle' || statusValue === 'negotiating' || statusValue === 'analyzing'
            ? statusValue
            : 'idle';
        const task = typeof message.data?.task === 'string' ? message.data.task : undefined;
        const agentData: AgentStatus = task ? { status, task } : { status };

        setState(prev => ({
          ...prev,
          agentStatus: agentData,
          stats: { ...prev.stats, agentStatus: agentData.status }
        }));
        }
        break;

      case 'conversation_update':
        // Fetch latest conversation
        fetchLatestConversation();
        break;

      case 'workflow_channel_status':
      case 'l2_status':
      case 'hydra_status': // Keep backward compatibility
        {
          const channelData = message.data ?? {};
          const incomingMode = String(channelData.mode ?? 'unavailable');
          const modeValue = incomingMode === 'hydra' || incomingMode === 'l2'
            ? 'channel'
            : incomingMode;
          const normalizedMode: L2Status['mode'] =
            modeValue === 'channel' ||
            modeValue === 'direct' ||
            modeValue === 'mock' ||
            modeValue === 'l2' ||
            modeValue === 'unavailable'
              ? modeValue
              : 'unavailable';

        setState(prev => ({
          ...prev,
          l2Status: {
            mode: normalizedMode,
            connected: channelData.connected as boolean | undefined,
            network_state: (channelData.head_state as string | undefined) || (channelData.network_state as string | undefined),
            active_negotiations: channelData.active_negotiations as number | undefined,
            current_session_id: (channelData.current_head_id as string | undefined) || (channelData.current_session_id as string | undefined)
          }
        }));
        }
        break;

      case 'workflow_step':
        {
        const stepData = message.data ?? {};
        const workflowStep: WorkflowStep = {
          step: Number(stepData.step ?? 0),
          name: typeof stepData.name === 'string' ? stepData.name : 'Unknown Step',
          status: typeof stepData.status === 'string' ? stepData.status : 'unknown',
          details: stepData.details && typeof stepData.details === 'object'
            ? (stepData.details as Record<string, unknown>)
            : {},
          timestamp: typeof stepData.timestamp === 'string' ? stepData.timestamp : new Date().toISOString(),
        };

        setState(prev => ({
          ...prev,
          workflowSteps: [...prev.workflowSteps.slice(-9), workflowStep] // Keep last 10 steps
        }));
        }
        break;

      case 'stats_update':
        {
        const statsData = (message.data ?? {}) as Partial<WebSocketState['stats']>;
        setState(prev => ({
          ...prev,
          stats: { ...prev.stats, ...statsData }
        }));
        }
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
