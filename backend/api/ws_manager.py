import asyncio
from typing import List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.connections: List[WebSocket] = []
        self._lock = asyncio.Lock()
    
    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self.connections.append(ws)
    
    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            if ws in self.connections:
                self.connections.remove(ws)
    
    async def broadcast(self, message: dict):
        async with self._lock:
            connections_copy = self.connections.copy()
        
        dead_connections = []
        for conn in connections_copy:
            try:
                await conn.send_json(message)
            except Exception:
                dead_connections.append(conn)
        
        if dead_connections:
            async with self._lock:
                for conn in dead_connections:
                    if conn in self.connections:
                        self.connections.remove(conn)

manager = ConnectionManager()
