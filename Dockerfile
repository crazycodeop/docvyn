FROM python:3.12-slim

WORKDIR /app

# Set persistent model cache directory and default Hugging Face Spaces port
ENV FASTEMBED_CACHE_PATH=/app/model_cache \
    PORT=7860 \
    PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies and pre-bake FastEmbed model
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    mkdir -p /app/model_cache && \
    python -c "from fastembed import TextEmbedding; TextEmbedding(model_name='BAAI/bge-small-en-v1.5', cache_dir='/app/model_cache')"

COPY backend /app
RUN chmod +x /app/start.sh

# Hugging Face Spaces runs as user 1000 by default
RUN useradd -m -u 1000 user && \
    mkdir -p /app/uploads && \
    chown -R user:user /app
USER user

EXPOSE 7860

CMD ["/app/start.sh"]
