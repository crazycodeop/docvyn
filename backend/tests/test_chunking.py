from app.services.chunking_service import ChunkingService
from app.services.extraction_service import ExtractedPage


def test_chunking_short_text():
    chunker = ChunkingService(chunk_size=500, chunk_overlap=100)
    pages = [
        ExtractedPage(page_number=1, text="Short text on page one."),
        ExtractedPage(page_number=2, text="Short text on page two.")
    ]
    chunks = chunker.chunk_pages(pages)
    assert len(chunks) == 2
    assert chunks[0].page_number == 1
    assert chunks[0].content == "Short text on page one."
    assert chunks[1].page_number == 2
    assert chunks[1].content == "Short text on page two."


def test_chunking_long_text_with_overlap():
    chunker = ChunkingService(chunk_size=100, chunk_overlap=30)
    long_text = (
        "Paragraph one is introducing the core document intelligence concepts. "
        "Paragraph two delves deeper into embedding models and pgvector indexing. "
        "Paragraph three summarizes the retrieval augmented generation system."
    )
    pages = [ExtractedPage(page_number=1, text=long_text)]
    chunks = chunker.chunk_pages(pages)
    assert len(chunks) > 1
    # Verify index sequence
    for i, c in enumerate(chunks):
        assert c.chunk_index == i
        assert c.page_number == 1
        assert len(c.content) <= 150  # Roughly within chunk_size threshold
