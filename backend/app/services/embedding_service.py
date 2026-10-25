import hashlib
import math
import time
from typing import List, Optional
from app.core.config import settings
from app.core.logging import logger

try:
    from fastembed import TextEmbedding
    HAS_FASTEMBED = True
except ImportError:
    HAS_FASTEMBED = False

try:
    from google import genai
    HAS_GOOGLE_GENAI = True
except ImportError:
    HAS_GOOGLE_GENAI = False


class EmbeddingService:
    def __init__(
        self,
        provider: Optional[str] = None,
        model_name: Optional[str] = None,
    ):
        self.provider = (provider or settings.EMBEDDING_PROVIDER).lower()
        self.model_name = model_name or settings.LOCAL_EMBEDDING_MODEL
        self.dimension = settings.VECTOR_DIMENSION
        self._local_model = None
        self._gemini_client = None

    def _get_local_model(self):
        if not HAS_FASTEMBED:
            return None
        if self._local_model is None:
            try:
                # Use persistent cache directory if available to prevent runtime downloads
                cache_dir = os.getenv("FASTEMBED_CACHE_PATH", "/app/model_cache")
                if os.path.exists(cache_dir):
                    try:
                        self._local_model = TextEmbedding(
                            model_name=self.model_name,
                            cache_dir=cache_dir,
                            local_files_only=True,
                        )
                        logger.info(f"Loaded local FastEmbed model offline from: {cache_dir}")
                    except Exception as offline_err:
                        logger.warning(f"Offline FastEmbed load failed ({offline_err}), attempting online check...")
                        self._local_model = TextEmbedding(model_name=self.model_name, cache_dir=cache_dir)
                else:
                    self._local_model = TextEmbedding(model_name=self.model_name)
                    logger.info(f"Initialized local FastEmbed model: {self.model_name}")
            except Exception as e:
                logger.warning(f"FastEmbed initialization error: {e}. Falling back to deterministic embeddings.")
                self._local_model = False
        return self._local_model if self._local_model is not False else None

    def _get_gemini_client(self):
        if not HAS_GOOGLE_GENAI or not settings.GEMINI_API_KEY:
            return None
        if self._gemini_client is None:
            try:
                self._gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
            except Exception as e:
                logger.warning(f"Gemini client initialization error: {e}")
                self._gemini_client = False
        return self._gemini_client if self._gemini_client is not False else None

    def _generate_fallback_embedding(self, text: str) -> List[float]:
        """Deterministic pseudo-embedding for testing or offline environments without an API key."""
        vector = [0.0] * self.dimension
        if not text:
            return vector

        tokens = text.lower().split()
        for i, token in enumerate(tokens[:50]):
            h = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16)
            idx = (h + i) % self.dimension
            vector[idx] += 1.0 / (1.0 + math.log(i + 2))

        norm = math.sqrt(sum(x * x for x in vector))
        if norm > 0:
            vector = [x / norm for x in vector]
        else:
            vector[0] = 1.0
        return vector

    def get_embedding(self, text: str) -> List[float]:
        """Generates embedding for a single text."""
        embeddings = self.get_embeddings_batch([text])
        return embeddings[0] if embeddings else [0.0] * self.dimension

    def get_embeddings_batch(self, texts: List[str], max_retries: int = 3) -> List[List[float]]:
        """Generates embeddings for a batch of texts using the configured provider."""
        if not texts:
            return []

        # 1. Local FastEmbed (Zero Cost, Free-Tier-First)
        if self.provider == "local":
            local_model = self._get_local_model()
            if local_model:
                try:
                    embeddings_gen = local_model.embed(texts)
                    return [emb.tolist() for emb in embeddings_gen]
                except Exception as e:
                    logger.error(f"Local FastEmbed embedding error: {e}")

        # 2. Gemini Embeddings
        gemini_client = self._get_gemini_client()
        if self.provider == "gemini" and gemini_client:
            results: List[List[float]] = []
            batch_size = 50
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i + batch_size]
                attempt = 0
                success = False
                while attempt < max_retries and not success:
                    try:
                        response = gemini_client.models.embed_content(
                            model=settings.GEMINI_EMBEDDING_MODEL,
                            contents=batch,
                        )
                        if hasattr(response, "embeddings") and response.embeddings:
                            for emb in response.embeddings:
                                vals = getattr(emb, "values", None) or list(emb)
                                results.append(list(vals))
                        success = True
                    except Exception as e:
                        attempt += 1
                        logger.warning(f"Gemini embedding attempt {attempt} failed: {e}")
                        if attempt >= max_retries:
                            for t in batch:
                                results.append(self._generate_fallback_embedding(t))
                        else:
                            time.sleep(1.5 * attempt)
            if results:
                return results

        # 3. Deterministic Fallback (Fast, local, offline)
        return [self._generate_fallback_embedding(t) for t in texts]
