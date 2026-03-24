import re
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer

app = FastAPI(title="3D Word Cloud API")

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    url: str


class WordEntry(BaseModel):
    word: str
    weight: float


class AnalyzeResponse(BaseModel):
    words: list[WordEntry]


def fetch_article_text(url: str) -> str:
    """Fetch and extract text content from a URL."""
    def fetch_via_reader_proxy(target_url: str) -> str:
        """Fallback fetch via reader proxy for anti-bot protected pages."""
        parsed = urlparse(target_url)
        host_path = f"{parsed.netloc}{parsed.path}"
        if parsed.query:
            host_path = f"{host_path}?{parsed.query}"

        proxy_url = f"https://r.jina.ai/http://{host_path}"
        proxy_response = requests.get(proxy_url, timeout=20)
        proxy_response.raise_for_status()
        return proxy_response.text

    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        }
        response = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, "html.parser")

        # Remove script and style tags
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()

        # Extract text from paragraphs and common content tags
        text_parts = []
        for tag in soup.find_all(["article", "main", "p", "h2", "li", "div"]):
            text = tag.get_text(strip=True)
            if len(text) > 20:
                text_parts.append(text)

        extracted = " ".join(text_parts)

        # If direct scraping gives too little content, use fallback reader proxy.
        if len(extracted.split()) < 120:
            extracted = fetch_via_reader_proxy(url)

        if len(extracted.split()) < 50:
            raise ValueError("Unable to extract enough readable text from this URL")

        return extracted
    except requests.RequestException:
        try:
            extracted = fetch_via_reader_proxy(url)
            if len(extracted.split()) < 50:
                raise ValueError("Unable to extract enough readable text from this URL")
            return extracted
        except requests.RequestException as proxy_error:
            raise ValueError(f"Failed to fetch URL: {str(proxy_error)}")


def clean_text(text: str) -> str:
    """Clean and normalize text for analysis."""
    # Convert to lowercase
    text = text.lower()

    # Remove URLs
    text = re.sub(r"https?://\S+", "", text)

    # Remove email addresses
    text = re.sub(r"\S+@\S+", "", text)

    # Remove special characters and extra whitespace
    text = re.sub(r"[^a-z\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    return text


def extract_keywords(text: str, n_keywords: int = 15) -> list[WordEntry]:
    """Extract top keywords using TF-IDF."""
    if not text or len(text.split()) < 5:
        raise ValueError("Text too short for analysis")

    # Split into segments for better context. If punctuation is limited,
    # fall back to fixed-size token chunks so TF-IDF has multiple documents.
    sentences = text.split(".")
    sentences = [s.strip() for s in sentences if len(s.strip().split()) > 3]

    if len(sentences) < 2:
        tokens = text.split()
        chunk_size = 80
        sentences = [
            " ".join(tokens[i : i + chunk_size])
            for i in range(0, len(tokens), chunk_size)
            if len(tokens[i : i + chunk_size]) > 8
        ]

    if not sentences:
        raise ValueError("No valid content found")

    # Create TF-IDF vectorizer
    vectorizer = TfidfVectorizer(
        max_features=50,
        min_df=1,
        max_df=1.0,
        stop_words="english",
        ngram_range=(1, 2),
    )

    # Fit and transform the sentences
    try:
        tfidf_matrix = vectorizer.fit_transform(sentences)
    except ValueError:
        raise ValueError("Unable to process text content")

    # Get feature names and scores
    feature_names = vectorizer.get_feature_names_out()
    scores = tfidf_matrix.mean(axis=0).A1

    # Get top keywords
    top_indices = scores.argsort()[-n_keywords:][::-1]

    # Normalize scores to 0-1 range
    max_score = scores[top_indices[0]] if len(top_indices) > 0 else 1
    min_score = scores[top_indices[-1]] if len(top_indices) > 0 else 0
    score_range = max_score - min_score if max_score > min_score else 1

    words = []
    for idx in top_indices:
        word = feature_names[idx]
        score = scores[idx]
        # Normalize to 0-1 range
        normalized_weight = (score - min_score) / score_range if score_range > 0 else 0.5
        words.append(WordEntry(word=word, weight=max(0.3, normalized_weight)))

    return words


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    """Analyze an article URL and extract top keywords."""
    if not request.url:
        raise HTTPException(status_code=400, detail="URL is required")

    try:
        # Fetch article text
        raw_text = fetch_article_text(request.url)

        # Clean text
        cleaned_text = clean_text(raw_text)

        # Extract keywords
        keywords = extract_keywords(cleaned_text, n_keywords=15)

        return AnalyzeResponse(words=keywords)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}
