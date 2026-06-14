# FashionLens AI

AI-powered fashion search platform. Upload a clothing image or type a description — FashionLens finds visually and semantically similar products across Pakistan's top fashion brands.

Built as a BS AI semester project.

---

## What it does

- **Image Search** — upload any outfit photo, get similar products back
- **Text Search** — describe what you want, CLIP finds the closest matches
- **Multi-brand** — searches across Khaadi, Sapphire, Gul Ahmed, Outfitters, Alkaram, Limelight, Beechtree, Bonanza Satrangi, Nishat Linen, and Junaid Jamshed
- **User accounts** — save favorites, view search history
- **Metrics dashboard** — accuracy, precision, recall, F1, confusion matrix

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, TypeScript |
| Backend | FastAPI, Python 3.12 |
| Database | MongoDB Atlas |
| AI Model | OpenAI CLIP (clip-vit-base-patch32) |
| Vector Search | Facebook FAISS |
| Auth | JWT (python-jose), bcrypt |
| Scraping | requests, BeautifulSoup, Shopify JSON API |

---

## Architecture

```
User Query (text or image)
        ↓
   CLIP Encoder (512-dim vector)
        ↓
   FAISS Index (53k+ vectors)
        ↓
   Top-K matches → MongoDB lookup
        ↓
   Results with brand, price, product link
```

---

## Dataset

- **Kaggle Fashion Product Images (small)** — 10k products, used for base embeddings
- **Scraped brand catalogs** — 71k+ products from 10 Pakistani fashion brands

---

## Project Structure

```
fashionlens-ai/
├── backend/          # FastAPI app
│   └── app/
│       ├── api/      # Route handlers
│       ├── services/ # Business logic
│       ├── ai/       # CLIP + FAISS similarity engine
│       ├── models/   # MongoDB document schemas
│       ├── schemas/  # Pydantic request/response models
│       └── database/ # MongoDB connection
├── frontend/         # Next.js app
│   └── src/
│       ├── app/      # Pages (search, history, favorites, metrics)
│       ├── services/ # API calls
│       └── components/
├── scripts/          # Data pipeline scripts
│   ├── ingest_dataset.py
│   ├── clean_dataset.py
│   ├── generate_features.py
│   ├── build_index.py
│   ├── scrape_brands.py
│   ├── generate_brand_embeddings.py
│   └── evaluate_model.py
├── datasets/
│   ├── raw/          # Original Kaggle data
│   ├── cleaned/      # Cleaned CSV
│   └── processed/    # CLIP embeddings (.npy files)
└── models/
    ├── embeddings/   # FAISS index + product ID map
    └── evaluation/   # metrics.json
```

---

## Setup

### Prerequisites
- Python 3.12
- Node.js 18+
- MongoDB Atlas account

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

Create `backend/.env`:
```
MONGO_URI=your_atlas_connection_string
DB_NAME=fashionlens
JWT_SECRET=your_secret_key
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440
```

```bash
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Create `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Data Pipeline

Run these in order from the project root:

```bash
# 1. Ingest Kaggle dataset
venv\Scripts\python scripts/ingest_dataset.py

# 2. Clean data
venv\Scripts\python scripts/clean_dataset.py

# 3. Generate CLIP embeddings
venv\Scripts\python scripts/generate_features.py

# 4. Build FAISS index
venv\Scripts\python scripts/build_index.py

# 5. Scrape Pakistani brands
venv\Scripts\python scripts/scrape_brands.py

# 6. Generate brand embeddings
venv\Scripts\python scripts/generate_brand_embeddings.py

# 7. Evaluate model
venv\Scripts\python scripts/evaluate_model.py
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login, get JWT |
| GET | `/search/text?q=` | Text-based search |
| POST | `/search/image` | Image-based search |
| GET | `/favorites` | Get saved products |
| POST | `/favorites` | Save a product |
| DELETE | `/favorites/{id}` | Remove from favorites |
| GET | `/history` | Search history |
| GET | `/metrics` | Model evaluation metrics |
| GET | `/health` | Health check |

---

## Screenshots

> Add your own screenshots here

---

## Limitations

- Image search works best with clean, white-background product photos
- Brand product images link to external URLs (may break if brand updates site)
- Running on CPU — inference is slower than GPU
- MongoDB Atlas free tier limits storage to 512MB

---

## License

MIT
