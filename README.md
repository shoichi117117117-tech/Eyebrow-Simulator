# 🤨 Eyebrow Simulator (AI Eyebrow Styling & Virtual Try-On)

A web-based application that detects facial landmarks, removes existing eyebrows using AI inpainting (LaMa via Replicate API), and overlays interactive 2D eyebrow templates in real-time.

---

## ✨ Features

- **Automated Eyebrow Removal**: AI-powered inpainting removes native eyebrows seamlessly.
- **Real-Time Facial Landmark Detection**: Powered by MediaPipe Vision Tasks API.
- **Interactive Template Fitting**:
  - Adjust rotation angle (symmetrically centered towards nasal bridge).
  - Adjust eyebrow distance / horizontal spacing (X-offset).
  - Modify thickness, vertical offset, opacity, and custom color palettes.
- **Canvas Overlay**: Dynamic Canvas rendering with customized color tinting.

---

## 🛠️ Tech Stack

### Frontend
- **HTML5 / CSS3 / JavaScript (ES6+)**
- **MediaPipe Tasks Vision** (`@mediapipe/tasks-vision`)
- **HTML5 Canvas API**

### Backend
- **Python 3.10+**
- **FastAPI**
- **OpenCV & NumPy** (Image processing & binary mask generation)
- **Replicate API** (LaMa Fast Inpainting Model)

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Replicate API Token

### 1. Environment Setup

Clone the repository and navigate into the project directory:

```bash
git clone [https://github.com/YOUR_USERNAME/eyebrow_simulator.git](https://github.com/YOUR_USERNAME/eyebrow_simulator.git)
cd eyebrow_simulator
Create a .env file in the root directory and add your Replicate API token:

Code snippet
REPLICATE_API_TOKEN=your_replicate_api_token_here
2. Backend Setup
Set up a Python virtual environment and install dependencies:

Bash
# Create and activate virtual environment
python -m venv .venv

# On macOS/Linux:
source .venv/bin/activate
# On Windows (PowerShell):
.\.venv\Scripts\Activate.ps1

# Install requirements
pip install -r requirements.txt
Run the FastAPI backend server:

Bash
uvicorn backend.main:app --reload
The backend server will start at http://localhost:8000.

3. Frontend Setup
Open frontend/index.html directly in your browser or serve it using Live Server / static file server.

📁 Project Structure
Plaintext
eyebrow_simulator/
├── backend/
│   ├── main.py              # FastAPI server & Replicate API Integration
│   └── face_landmarker.task # MediaPipe model asset
├── frontend/
│   ├── assets/              # Eyebrow PNG templates
│   ├── css/                 # UI Stylesheets
│   ├── js/                  # App logic & Canvas rendering
│   └── index.html           # Main user interface
├── .env                     # Local environment variables (Git ignored)
├── .gitignore               # Git exclude rules
├── requirements.txt         # Python package dependencies
└── README.md
