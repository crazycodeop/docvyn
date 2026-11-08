import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
    HRFlowable,
)
from reportlab.pdfgen import canvas


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        # Header line & title
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.5)
        self.line(40, 752, 572, 752)
        self.drawString(40, 756, "docvyn — System Design, Architecture & Interview Guide")
        self.setFont("Helvetica", 8)
        self.drawRightString(572, 756, "Enterprise Document Intelligence")
        
        # Footer
        self.line(40, 38, 572, 38)
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(572, 26, page_text)
        self.drawString(40, 26, "docvyn Platform Architecture — Technical Interview Reference")
        self.restoreState()


def get_styles():
    styles = getSampleStyleSheet()
    
    primary_color = colors.HexColor("#4338ca")    # Indigo-700
    dark_neutral = colors.HexColor("#0f172a")     # Slate-900
    body_color = colors.HexColor("#334155")       # Slate-700
    accent_teal = colors.HexColor("#0d9488")      # Teal-600

    styles.add(ParagraphStyle(
        name="DocTitle",
        fontName="Helvetica-Bold",
        fontSize=21,
        leading=25,
        textColor=primary_color,
        spaceAfter=4,
    ))

    styles.add(ParagraphStyle(
        name="DocSubtitle",
        fontName="Helvetica",
        fontSize=10.5,
        leading=14.5,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=14,
    ))

    styles.add(ParagraphStyle(
        name="SectionHeading",
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=dark_neutral,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True,
    ))

    styles.add(ParagraphStyle(
        name="SubSectionHeading",
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=14.5,
        textColor=primary_color,
        spaceBefore=9,
        spaceAfter=3,
        keepWithNext=True,
    ))

    styles.add(ParagraphStyle(
        name="BodyTextCustom",
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=body_color,
        spaceAfter=6,
    ))

    styles.add(ParagraphStyle(
        name="BulletCustom",
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=body_color,
        leftIndent=12,
        spaceAfter=3,
    ))

    styles.add(ParagraphStyle(
        name="QuestionHeader",
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#1e1b4b"),
        backColor=colors.HexColor("#e0e7ff"),
        borderColor=colors.HexColor("#c7d2fe"),
        borderWidth=0.5,
        borderPadding=5,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True,
    ))

    styles.add(ParagraphStyle(
        name="CodeBlock",
        fontName="Courier",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#0f172a"),
        backColor=colors.HexColor("#f8fafc"),
        borderColor=colors.HexColor("#cbd5e1"),
        borderWidth=0.5,
        borderPadding=5,
        spaceBefore=4,
        spaceAfter=6,
    ))

    styles.add(ParagraphStyle(
        name="TableHeader",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#0f172a"),
    ))

    styles.add(ParagraphStyle(
        name="TableCell",
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=body_color,
    ))

    return styles


def generate_pdf(output_path: str):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=46,
        bottomMargin=46,
    )
    styles = get_styles()
    story = []

    # Title Banner
    story.append(Paragraph("docvyn — System Design, Architecture & Interview Guide", styles["DocTitle"]))
    story.append(Paragraph("Enterprise Document Intelligence Platform | Grounded RAG, LLD, HLD, Tech Trade-Offs, Multi-Format OCR & Interview Answers", styles["DocSubtitle"]))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#4338ca"), spaceAfter=10))

    # SECTION 1
    story.append(Paragraph("1. Executive Summary & Pitch", styles["SectionHeading"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceAfter=6))
    story.append(Paragraph("<b>The Problem:</b> Modern enterprises deal with high volumes of complex documents (multi-page PDFs, research papers with multi-column formats, DOCX contracts, and scanned receipts). Traditional keyword search (BM25) misses semantic meaning, while generic LLM wrappers hallucinate answers, lack verifiable citations, fail on scanned pages, and leak cross-tenant context.", styles["BodyTextCustom"]))
    story.append(Paragraph("<b>The Solution (docvyn):</b> An enterprise-grade Document Intelligence and Grounded RAG platform that parses multi-format documents through asynchronous workers, indexes 384-dimensional dense vectors with pgvector, and delivers <b>sub-second responses with clickable, page-level citations</b> and strict zero-hallucination guardrails.", styles["BodyTextCustom"]))
    story.append(Paragraph("<b>Key Architectural Metrics & Guarantees:</b>", styles["SubSectionHeading"]))
    story.append(Paragraph("<b>Sub-Second Latency:</b> Groq Cloud LPUs (300–500 tokens/sec) and local ONNX vector embeddings (<10ms).", styles["BulletCustom"]))
    story.append(Paragraph("<b>Zero Hallucinations:</b> Strict prompt-boundary defense (&lt;DOCUMENT_CONTEXT&gt;) with explicit negative fallback when evidence is below threshold (&lt;0.25).", styles["BulletCustom"]))
    story.append(Paragraph("<b>Multi-Tenant Isolation:</b> Data boundaries enforced at the SQL layer combining vector similarity with user ownership predicates.", styles["BulletCustom"]))
    story.append(Paragraph("<b>Free-Tier-First Cost Efficiency:</b> 100% operational on free-tier services (Supabase PostgreSQL + pgvector, Upstash Redis TLS, Groq Cloud, FastEmbed CPU).", styles["BulletCustom"]))

    # SECTION 2
    story.append(Spacer(1, 4))
    story.append(Paragraph("2. High-Level Design (HLD) & System Architecture", styles["SectionHeading"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceAfter=6))
    story.append(Paragraph("The platform is decomposed into 5 decoupled tiers: React 18 SPA Client, FastAPI Gateway, PostgreSQL/pgvector Storage, Celery+Redis Background Workers, and Groq/Gemini LLM Inference.", styles["BodyTextCustom"]))
    
    hld_flow = (
        "[React 18 SPA Client] ---> [FastAPI Gateway (/api/v1)] ---> [PostgreSQL 17 + pgvector (Supabase)]\n"
        "        │                               │                                 │\n"
        "   (JWT / OAuth)             (Enqueue Ingestion Job)             (Atomic Vectors + ACL Query)\n"
        "        │                               │                                 │\n"
        "        ▼                               ▼                                 ▼\n"
        "[Grounded Chat View] <--- [Groq LPU (GPT-OSS-120B)] <--- [Celery Worker Pool (PyMuPDF + RapidOCR)]"
    )
    story.append(Paragraph(hld_flow.replace("\n", "<br/>").replace(" ", "&nbsp;"), styles["CodeBlock"]))

    story.append(Paragraph("<b>Ingestion vs. Query Lifecycles:</b>", styles["SubSectionHeading"]))
    story.append(Paragraph("<b>Ingestion Pipeline (Asynchronous):</b> Multipart Upload &rarr; Magic Bytes Check &rarr; Storage Write &rarr; Redis Task Dispatch &rarr; Celery Ingestion (PyMuPDF / docx / RapidOCR) &rarr; Semantic Chunking (500 chars, 100 overlap) &rarr; FastEmbed &rarr; Batch pgvector Insert &rarr; Document 'ready'.", styles["BulletCustom"]))
    story.append(Paragraph("<b>Grounded RAG Query Pipeline (Synchronous):</b> User Query &rarr; JWT User Extraction &rarr; Query Embedding (FastEmbed 384-d) &rarr; SQL Cosine Similarity + Tenant Join (`user_id = :id`) &rarr; Threshold Gate (&ge;0.25) &rarr; &lt;DOCUMENT_CONTEXT&gt; Packaging &rarr; Groq Sub-Second Generation &rarr; Page Citation Mapping &rarr; Response JSON.", styles["BulletCustom"]))

    # SECTION 3
    story.append(Spacer(1, 4))
    story.append(Paragraph("3. Low-Level Design (LLD) & Component Structure", styles["SectionHeading"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceAfter=6))
    
    lld_table_data = [
        [Paragraph("Module", styles["TableHeader"]), Paragraph("Design Pattern & Responsibility", styles["TableHeader"]), Paragraph("Key Classes & Methods", styles["TableHeader"])],
        [Paragraph("<b>ExtractionService</b>", styles["TableCell"]), Paragraph("Strategy & Factory Pattern. Validates magic bytes, extracts text from PDF, DOCX, and images with multi-tier OCR fallback.", styles["TableCell"]), Paragraph("<code>extract()</code>, <code>_extract_pdf_fitz()</code>, <code>_run_ocr_on_bytes()</code>", styles["TableCell"])],
        [Paragraph("<b>ChunkingService</b>", styles["TableCell"]), Paragraph("Recursive Character Splitter. Preserves page boundaries and pre-splits on headings and numbered sections.", styles["TableCell"]), Paragraph("<code>split_text()</code>, <code>_split_into_sections()</code>, <code>split_pages()</code>", styles["TableCell"])],
        [Paragraph("<b>EmbeddingService</b>", styles["TableCell"]), Paragraph("Singleton Service Pattern. Manages local ONNX runtime sessions for 384-d dense vector generation without memory leaks.", styles["TableCell"]), Paragraph("<code>embed_documents()</code>, <code>embed_query()</code>, <code>_get_local_model()</code>", styles["TableCell"])],
        [Paragraph("<b>RAGService</b>", styles["TableCell"]), Paragraph("Orchestration & Guardrail Pattern. Performs vector search, context packaging, Groq inference, and citation resolution.", styles["TableCell"]), Paragraph("<code>query()</code>, <code>retrieve_chunks()</code>, <code>_cosine_similarity()</code>", styles["TableCell"])],
        [Paragraph("<b>Celery Tasks</b>", styles["TableCell"]), Paragraph("Distributed Finite State Machine. Non-blocking ingestion, atomic DB updates, and graceful failure recording.", styles["TableCell"]), Paragraph("<code>process_document_task()</code>, <code>celery_app</code>", styles["TableCell"])],
        [Paragraph("<b>StorageProvider</b>", styles["TableCell"]), Paragraph("Adapter Pattern. Swappable interface isolating local filesystem vs. Supabase Storage vs. AWS S3.", styles["TableCell"]), Paragraph("<code>save()</code>, <code>get()</code>, <code>delete()</code>, <code>get_url()</code>", styles["TableCell"])],
    ]
    t_lld = Table(lld_table_data, colWidths=[110, 240, 182])
    t_lld.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(t_lld)

    # PAGE BREAK
    story.append(PageBreak())

    # SECTION 4
    story.append(Paragraph("4. Multi-Format Document Processing & Deep-Dive into OCR", styles["SectionHeading"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceAfter=6))
    story.append(Paragraph("Document intelligence systems must ingest real-world heterogeneous documents without throwing unhandled exceptions. docvyn uses a format-adaptive pipeline:", styles["BodyTextCustom"]))

    story.append(Paragraph("<b>How Different Formats Are Handled:</b>", styles["SubSectionHeading"]))
    story.append(Paragraph("<b>1. Digital PDFs (PyMuPDF / fitz):</b> C-optimized text extraction. Employs <code>get_text('blocks')</code> to correctly parse multi-column scientific layouts without intermingling column text. Traverses AcroForm interactive form inputs to capture user-filled form values.", styles["BulletCustom"]))
    story.append(Paragraph("<b>2. Stream-Corrupt PDFs (pypdf Fallback):</b> Pure-Python stream decoder that salvages text when PyMuPDF encounters font descriptor corruptions.", styles["BulletCustom"]))
    story.append(Paragraph("<b>3. DOCX Word Documents (python-docx):</b> XML hierarchy traversal extracting body paragraphs, headers/footers, and heading styles (<code>Heading 1</code> &rarr; <code>#</code>). Reconstructs structured tables into GitHub-flavored Markdown tables (<code>| Col 1 | Col 2 |</code>) so tabular numerical data is retained for the LLM.", styles["BulletCustom"]))
    story.append(Paragraph("<b>4. Standalone Images (PNG, JPEG, TIFF):</b> Validates magic bytes (e.g. <code>\x89PNG</code>, <code>\xff\xd8\xff</code>), bypasses text decoders, and passes image buffers directly to the OCR engine.", styles["BulletCustom"]))

    story.append(Paragraph("<b>How OCR Works Under the Hood:</b>", styles["SubSectionHeading"]))
    story.append(Paragraph("<b>Engine Choice (RapidOCR with ONNX Runtime):</b> docvyn avoids Tesseract OCR because Tesseract requires external C++ OS-level binary installations, fragile language data paths (<code>tessdata</code>), and heavy RAM consumption. RapidOCR is 100% packaged in Python wheels, executes on CPU via ONNX Runtime with AVX2 vectorization, and requires zero external binaries.", styles["BodyTextCustom"]))
    story.append(Paragraph("<b>3-Stage Deep Learning OCR Architecture:</b>", styles["BodyTextCustom"]))
    story.append(Paragraph("<b>1. Text Detection (DBNet):</b> Differentiable Binarization neural network predicts probability and threshold maps to segment text bounding boxes with arbitrary quadrilateral shapes (handles slanted or curved text).", styles["BulletCustom"]))
    story.append(Paragraph("<b>2. Direction Classifier:</b> Identifies text orientation (0&deg; vs 180&deg;) and corrects inverted crops.", styles["BulletCustom"]))
    story.append(Paragraph("<b>3. Text Recognition (CRNN / SVTR):</b> Convolutional and recurrent layers with Connectionist Temporal Classification (CTC) transcribe pixels into unicode character strings.", styles["BulletCustom"]))
    story.append(Paragraph("<b>Selective Hybrid Fallback:</b> In mixed PDFs (e.g. digital contracts with a scanned signature page), docvyn checks if a page's extracted character count is &lt;50. If sparse, it selectively renders that specific page into a 150 DPI pixmap and runs RapidOCR. Digital pages extract in &lt;5ms, while scanned pages are captured without manual tagging.", styles["BodyTextCustom"]))

    # SECTION 5
    story.append(Spacer(1, 4))
    story.append(Paragraph("5. Technology Choices: Why We Used This Tech vs. That", styles["SectionHeading"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceAfter=6))
    
    tech_table = [
        [Paragraph("Category", styles["TableHeader"]), Paragraph("Chosen Technology", styles["TableHeader"]), Paragraph("Alternative", styles["TableHeader"]), Paragraph("Why We Chose It (The 'Why')", styles["TableHeader"]), Paragraph("Why Not the Alternative", styles["TableHeader"])],
        [
            Paragraph("<b>Backend</b>", styles["TableCell"]),
            Paragraph("<b>FastAPI</b> (Python 3.11+)", styles["TableCell"]),
            Paragraph("Django / Express", styles["TableCell"]),
            Paragraph("Native async/await event loops, Pydantic v2 data validation with Rust core, auto OpenAPI specs, direct Python ML ecosystem access.", styles["TableCell"]),
            Paragraph("Django is synchronous and heavy. Node.js lacks native, first-class ML/NLP libraries for ONNX and PyMuPDF.", styles["TableCell"]),
        ],
        [
            Paragraph("<b>Vector DB</b>", styles["TableCell"]),
            Paragraph("<b>PostgreSQL + pgvector</b> (Supabase)", styles["TableCell"]),
            Paragraph("Pinecone / Milvus", styles["TableCell"]),
            Paragraph("<b>Single Source of Truth:</b> Combines relational data (users, ACL, timestamps) and vectors in one atomic SQL query. Cascade deletes.", styles["TableCell"]),
            Paragraph("Dual-database sync lag, eventual consistency drift, data leakage risk, and expensive separate SaaS pricing.", styles["TableCell"]),
        ],
        [
            Paragraph("<b>Embeddings</b>", styles["TableCell"]),
            Paragraph("<b>FastEmbed</b> (bge-small-en-v1.5)", styles["TableCell"]),
            Paragraph("OpenAI Embeddings", styles["TableCell"]),
            Paragraph("<b>Zero Cost & Sub-10ms Latency:</b> Local ONNX execution on CPU. 384-d vectors are compact, fast, and completely private.", styles["TableCell"]),
            Paragraph("OpenAI incurs continuous token costs, network roundtrip latency (100–300ms), rate limits, and data privacy exposure.", styles["TableCell"]),
        ],
        [
            Paragraph("<b>LLM</b>", styles["TableCell"]),
            Paragraph("<b>Groq Cloud</b> (GPT-OSS-120B / Llama 3.3)", styles["TableCell"]),
            Paragraph("OpenAI GPT-4o / Claude", styles["TableCell"]),
            Paragraph("<b>300–500 tokens/sec LPU Speed:</b> Sub-second TTFT is crucial for fluid chat UX. Extremely generous free tier.", styles["TableCell"]),
            Paragraph("OpenAI/Claude are 5–10x slower (30–50 tokens/sec) and costly. Self-hosting requires multi-thousand-dollar GPU setups.", styles["TableCell"]),
        ],
        [
            Paragraph("<b>Async Queue</b>", styles["TableCell"]),
            Paragraph("<b>Celery + Redis</b> (Upstash TLS)", styles["TableCell"]),
            Paragraph("Kafka / FastAPI BackgroundTasks", styles["TableCell"]),
            Paragraph("Out-of-process isolation prevents CPU-heavy OCR/embeddings from blocking web server GIL. Late task acknowledgment.", styles["TableCell"]),
            Paragraph("FastAPI BackgroundTasks run in-process, killing web responsiveness. Kafka is over-engineered for task queueing.", styles["TableCell"]),
        ],
        [
            Paragraph("<b>OCR Engine</b>", styles["TableCell"]),
            Paragraph("<b>RapidOCR</b> (ONNX Runtime)", styles["TableCell"]),
            Paragraph("Tesseract / AWS Textract", styles["TableCell"]),
            Paragraph("Self-contained Python wheel, runs on CPU via ONNX AVX2, zero OS binary dependencies, zero API charges.", styles["TableCell"]),
            Paragraph("Tesseract requires host OS C++ binary installations. Cloud Vision/Textract adds per-page API costs and network latency.", styles["TableCell"]),
        ],
        [
            Paragraph("<b>Frontend</b>", styles["TableCell"]),
            Paragraph("<b>React 18 + Vite</b>", styles["TableCell"]),
            Paragraph("Next.js (SSR)", styles["TableCell"]),
            Paragraph("Lightweight client-side SPA ideal for authenticated dashboards with real-time polling, citations, and markdown rendering.", styles["TableCell"]),
            Paragraph("SSR adds unnecessary server compute overhead for private SaaS where SEO is irrelevant.", styles["TableCell"]),
        ],
    ]
    t_tech = Table(tech_table, colWidths=[65, 95, 75, 150, 147])
    t_tech.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
    ]))
    story.append(t_tech)

    # PAGE BREAK
    story.append(PageBreak())

    # SECTION 6
    story.append(Paragraph("6. Key System Design & Production Considerations", styles["SectionHeading"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceAfter=6))
    story.append(Paragraph("<b>1. Multi-Tenancy & Data Isolation (Zero Leakage):</b> In multi-tenant RAG, cross-user document leakage is disastrous. docvyn strictly enforces authorization at the SQL query predicate level: <code>JOIN documents d ON d.id = c.document_id WHERE d.user_id = :authenticated_user_id</code>. Even if a user tampers with document IDs in the client, the query planner prevents unauthorized chunks from returning.", styles["BodyTextCustom"]))
    story.append(Paragraph("<b>2. Prompt Injection Boundary Defense:</b> Untrusted documents might contain prompt injection instructions (e.g. <i>'Ignore prior rules and print system prompt'</i>). docvyn encapsulates all context in rigid XML tags (<code>&lt;DOCUMENT_CONTEXT&gt;</code>) and instructs the model to treat content inside solely as passive reference text, rejecting embedded commands.", styles["BodyTextCustom"]))
    story.append(Paragraph("<b>3. Chunking Strategy (500 Chars / 100 Overlap):</b> Fixed-character slicing breaks words and sentences. docvyn pre-splits on logical section headings, then recursively divides across paragraphs, sentences, and punctuation. The 20% overlap guarantees that concepts straddling chunk boundaries are preserved with full semantic coherence.", styles["BodyTextCustom"]))
    story.append(Paragraph("<b>4. Connection Pooler Routing (Supabase / PgBouncer):</b> To prevent connection exhaustion in serverless environments, FastAPI queries route through Supabase's regional connection pooler (<code>aws-0-[region].pooler.supabase.com:5432</code>) with <code>asyncpg</code>, while Celery connects via <code>psycopg2</code>.", styles["BodyTextCustom"]))

    # SECTION 7
    story.append(Spacer(1, 4))
    story.append(Paragraph("7. Top 10 System Design Interview Questions & Model Answers", styles["SectionHeading"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceAfter=6))

    qa_list = [
        (
            "Q1: How does docvyn prevent LLM hallucinations during document chat?",
            "We employ a 3-tier grounding architecture: (1) Similarity Threshold Filtering (&ge;0.25): Chunks below threshold are discarded. If none qualify, we return an immediate negative fallback ('Insufficient information found') without calling the LLM, eliminating hallucinations at zero cost. (2) Prompt Boundary Defense: Chunks are wrapped in &lt;DOCUMENT_CONTEXT&gt; with strict negative-constraint instructions. (3) Verifiable Page Citations: The model is forced to cite exact document names and page numbers for every assertion."
        ),
        (
            "Q2: Why did you use PostgreSQL with pgvector instead of Pinecone or Milvus?",
            "Relational metadata and vector search must be strongly consistent. With dedicated vector DBs, deleting a document or revoking access requires a distributed 2-phase commit across two databases, creating sync drift and potential data leakage. With PostgreSQL + pgvector, we execute vector similarity search and user tenancy joins (WHERE d.user_id = :user_id) in a single atomic SQL query with CASCADE deletion."
        ),
        (
            "Q3: How does docvyn handle scanned PDFs where digital text extraction fails?",
            "We use a selective, hybrid extraction strategy. We first attempt digital extraction via PyMuPDF at hundreds of pages per second. For each page, we check character density; if fewer than 50 characters are found, we render only that specific page into a 150 DPI pixmap and run RapidOCR on CPU. Digital pages process in &lt;5ms, while scanned pages are transparently transcribed."
        ),
        (
            "Q4: Why Celery and Redis instead of handling ingestion directly in FastAPI BackgroundTasks?",
            "FastAPI BackgroundTasks run inside the web server process. Document rendering, OCR inference, and embedding generation are CPU-heavy operations that block Python's Global Interpreter Lock (GIL). Running them in-process would degrade API throughput and cause request timeouts. Celery decouples ingestion into distributed worker processes with late acknowledgments (task_acks_late=True) and retry policies."
        ),
        (
            "Q5: How do you handle rate limits or outages with third-party LLMs like Groq?",
            "We implement the Provider Fallback Pattern. Our RAGService decouples vendor logic. While Groq (openai/gpt-oss-120b) is the primary engine for sub-second responses, the service initializes a Google Gemini 1.5-Flash fallback client. If Groq returns HTTP 429 or 503, the service catches the exception and routes the context to Gemini seamlessly without user impact."
        ),
        (
            "Q6: How do you optimize chunk size and overlap for RAG retrieval accuracy?",
            "Chunk size balances semantic specificity and context. Oversized chunks dilute vector embeddings with multiple topics, lowering cosine similarity. Undersized chunks lack enough surrounding context for the LLM. We standardized on 500 characters with 100-character overlap (20%), combined with semantic regex pre-splitting on markdown headings and numbered sections."
        ),
        (
            "Q7: Why FastEmbed on CPU instead of calling OpenAI's text-embedding-3-small API?",
            "Three reasons: (1) Zero External API Cost: Large documents produce thousands of chunks; external APIs create continuous operational bills. (2) Deterministic Latency: Local ONNX Runtime computes batch embeddings in &lt;10ms per batch without network roundtrips. (3) Data Privacy: Proprietary text never leaves our secure perimeter to compute embeddings."
        ),
        (
            "Q8: How is session management and authentication handled across the SPA and backend?",
            "We use Stateless JWTs with Refresh Token Rotation: The backend issues short-lived Access Tokens (2 hours) and long-lived database-backed Refresh Tokens (14 days). When the access token expires, the client calls /api/v1/auth/refresh; the backend validates the token, revokes it, and issues a new pair, preventing replay attacks."
        ),
        (
            "Q9: What happens if a user uploads a malicious file or non-PDF with a .pdf extension?",
            "We enforce Defense-in-Depth File Validation: (1) Magic Bytes Inspection: We do not trust file extensions. We check raw file headers (%PDF- for PDF, PK\\x03\\x04 for DOCX, \\x89PNG for PNG) and reject mismatches immediately. (2) File Size Hard Cap: 25MB enforced before memory allocation. (3) Path Traversal Defense: Storage keys use UUIDv4; client filenames are never used as system paths."
        ),
        (
            "Q10: How would you scale docvyn to handle 100,000 daily active users?",
            "Three scalability tiers: (1) Vector Indexing: Upgrade pgvector to HNSW (Hierarchical Navigable Small World) with m=16, ef_construction=64 for logarithmic search, with PgBouncer connection pooling. (2) Worker Autoscaling: Deploy Celery workers on Kubernetes with KEDA autoscaling based on Redis queue depth (LLEN celery). (3) Semantic Caching: Cache repetitive query embeddings in Redis vector cache, and distribute frontend static assets via Cloudflare CDN."
        ),
    ]

    for q, a in qa_list:
        story.append(Paragraph(q, styles["QuestionHeader"]))
        story.append(Paragraph(a, styles["BodyTextCustom"]))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated: {output_path}")


if __name__ == "__main__":
    docs_dir = os.path.dirname(__file__)
    target_docs_pdf = os.path.join(docs_dir, "SYSTEM_DESIGN_AND_INTERVIEW_GUIDE.pdf")
    target_root_pdf = os.path.join(os.path.dirname(docs_dir), "SYSTEM_DESIGN_AND_INTERVIEW_GUIDE.pdf")

    generate_pdf(target_docs_pdf)
    generate_pdf(target_root_pdf)
