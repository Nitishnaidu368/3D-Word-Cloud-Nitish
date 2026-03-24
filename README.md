# 3D-Word-Cloud-Nitish

An interactive full-stack project that analyzes a news article URL and visualizes extracted topics as a 3D word cloud.

## Overview

This app demonstrates an end-to-end flow:

1. User enters a news article URL in the React frontend.
2. Frontend sends the URL to `POST /analyze` on the FastAPI backend.
3. Backend crawls the page, cleans text, and extracts important keywords using TF-IDF.
4. Frontend renders keywords in an interactive 3D scene with size and motion based on relevance.

## Tech Stack

### Frontend

- React 19 + TypeScript
- Vite
- Three.js via React Three Fiber (`@react-three/fiber`)
- Drei utilities (`@react-three/drei`)

### Backend

- Python 3
- FastAPI
- Uvicorn
- Requests
- BeautifulSoup4
- scikit-learn (TF-IDF keyword extraction)

## Project Structure

```text
.
├── backend/
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   └── package.json
├── run_project.sh
└── README.md
```

## API

### `POST /analyze`

Request body:

```json
{
	"url": "https://example.com/article"
}
```

Response body:

```json
{
	"words": [
		{ "word": "economy", "weight": 0.92 },
		{ "word": "policy", "weight": 0.81 }
	]
}
```

### `GET /health`

Health check endpoint that returns:

```json
{ "status": "ok" }
```

## Run The Project (macOS)

This project includes one root setup script that installs dependencies and starts both servers.

```bash
chmod +x run_project.sh
./run_project.sh
```

After startup:

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:8000`

Press `Ctrl+C` to stop both servers.

## Manual Run (Optional)

### Backend

```bash
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Notes

- Crawling is intentionally lightweight for demonstration purposes.
- Keyword extraction uses TF-IDF and returns weighted terms for visualization.
- Frontend includes interactive 3D behaviors: auto-rotation, hover highlighting, atmospheric effects, and topic detail card.
- Commit history is organized by feature progression.
