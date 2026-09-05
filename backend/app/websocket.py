import asyncio
import json
from typing import Set
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self.connections.add(websocket)

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            self.connections.discard(websocket)

    async def broadcast(self, payload: dict):
        message = json.dumps(payload, ensure_ascii=False)
        dead = []
        async with self._lock:
            targets = list(self.connections)
        for ws in targets:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self.connections.discard(ws)

manager = ConnectionManager()
