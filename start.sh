#!/bin/bash
# Start both backend and frontend

echo "Starting Resume Matcher..."

# Backend
cd backend
pip install -r requirements.txt -q
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
echo "Backend started (PID $BACKEND_PID) → http://localhost:8989"

# Frontend
cd ../frontend
npm install -q
npm run dev &
FRONTEND_PID=$!
echo "Frontend started (PID $FRONTEND_PID) → http://localhost:3000"

echo ""
echo "App running at http://localhost:3000"
echo "API docs at  http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers"

wait
