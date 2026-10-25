import re
from typing import Any, Dict, List, Optional
from app.core.config import settings
from app.services.extraction_service import ExtractedPage


class ChunkData:
    def __init__(
        self,
        chunk_index: int,
        content: str,
        page_number: Optional[int],
        token_count: int,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.chunk_index = chunk_index
        self.content = content
        self.page_number = page_number
        self.token_count = token_count
        self.metadata = metadata or {}


class ChunkingService:
    def __init__(
        self,
        chunk_size: int = settings.CHUNK_SIZE,
        chunk_overlap: int = settings.CHUNK_OVERLAP,
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def _split_into_sections(self, text: str) -> List[str]:
        """Pre-splits text at logical topic/section boundaries (e.g. '18. Closures', '## Heading')."""
        # Regex splits on numbered items (e.g. '\n18. ' or '\n19. ') or markdown headings ('\n# ')
        pattern = r"(?:\r?\n)(?=(?:#{1,4}\s+|\d+[\.\)]\s+[A-Z]))"
        sections = re.split(pattern, text)
        clean_sections = [s.strip() for s in sections if s and s.strip()]
        return clean_sections if clean_sections else [text]

    def split_text(self, text: str) -> List[str]:
        """Recursively splits text respecting headings, paragraphs, and sentence boundaries."""
        if not text or not text.strip():
            return []

        text = text.strip()
        if len(text) <= self.chunk_size:
            return [text]

        sections = self._split_into_sections(text)
        final_chunks: List[str] = []

        separators = ["\n\n", "\n", ". ", "; ", ", ", " "]

        def _split_block(txt: str, sep_idx: int) -> List[str]:
            if len(txt) <= self.chunk_size:
                return [txt] if txt else []
            if sep_idx >= len(separators):
                chunks = []
                start = 0
                step = max(50, self.chunk_size - self.chunk_overlap)
                while start < len(txt):
                    chunks.append(txt[start:start + self.chunk_size])
                    start += step
                return chunks

            sep = separators[sep_idx]
            parts = txt.split(sep)
            result = []
            current_chunk = []
            current_len = 0

            for part in parts:
                part_len = len(part) + (len(sep) if current_chunk else 0)
                if current_len + part_len <= self.chunk_size:
                    current_chunk.append(part)
                    current_len += part_len
                else:
                    if current_chunk:
                        joined = sep.join(current_chunk)
                        result.append(joined)
                        # Overlap
                        overlap_target = self.chunk_overlap
                        overlap_parts = []
                        accum = 0
                        for p in reversed(current_chunk):
                            accum += len(p) + len(sep)
                            overlap_parts.insert(0, p)
                            if accum >= overlap_target:
                                break
                        current_chunk = overlap_parts
                        current_len = sum(len(p) for p in current_chunk) + len(sep) * max(0, len(current_chunk) - 1)

                    if len(part) > self.chunk_size:
                        sub_chunks = _split_block(part, sep_idx + 1)
                        result.extend(sub_chunks)
                        current_chunk = []
                        current_len = 0
                    else:
                        current_chunk.append(part)
                        current_len += len(part) + (len(sep) if len(current_chunk) > 1 else 0)

            if current_chunk:
                joined = sep.join(current_chunk)
                if not result or joined != result[-1]:
                    result.append(joined)

            return result

        for section in sections:
            if len(section) <= self.chunk_size:
                final_chunks.append(section)
            else:
                final_chunks.extend(_split_block(section, 0))

        return final_chunks

    def chunk_pages(self, pages: List[ExtractedPage]) -> List[ChunkData]:
        """Chunks a list of extracted pages, preserving page numbers and sequence."""
        chunks: List[ChunkData] = []
        global_index = 0

        for page in pages:
            page_text = page.text.strip()
            if not page_text:
                continue

            page_chunks = self.split_text(page_text)
            for chunk_str in page_chunks:
                clean_chunk = chunk_str.strip()
                if not clean_chunk:
                    continue
                tokens = max(1, len(clean_chunk) // 4)
                chunks.append(
                    ChunkData(
                        chunk_index=global_index,
                        content=clean_chunk,
                        page_number=page.page_number,
                        token_count=tokens,
                        metadata={
                            "page_number": page.page_number,
                            "char_length": len(clean_chunk),
                            "page_metadata": page.metadata,
                        }
                    )
                )
                global_index += 1

        return chunks
