import asyncio
import json
from typing import Dict, Set
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.connections: Dict[WebSocket, int] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        async with self._lock:
            self.connections[websocket] = user_id

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            self.connections.pop(websocket, None)

    async def _send(self, targets: Set[WebSocket], payload: dict):
        message = json.dumps(payload, ensure_ascii=False)
        dead: Set[WebSocket] = set()
        for ws in targets:
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self.connections.pop(ws, None)

    async def broadcast(self, payload: dict):
        async with self._lock:
            targets = set(self.connections.keys())
        await self._send(targets, payload)

    async def send_to_user(self, user_id: int, payload: dict):
        async with self._lock:
            targets = {ws for ws, connected_user_id in self.connections.items() if connected_user_id == user_id}
        await self._send(targets, payload)


manager = ConnectionManager()
