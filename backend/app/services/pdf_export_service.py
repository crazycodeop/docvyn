import html
import io
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


class NumberedCanvas(canvas.Canvas):
    """Canvas that computes total page count dynamically for Page X of Y footers."""

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
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))

        # Running Header
        self.drawString(40, 755, "docvyn • Conversation Export")
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.5)
        self.line(40, 748, 572, 748)

        # Running Footer
        self.line(40, 45, 572, 45)
        self.drawString(40, 32, "Confidential • Exported from docvyn")
        page_str = f"Page {self._pageNumber} of {total_pages}"
        self.drawRightString(572, 32, page_str)

        self.restoreState()


class PDFExportService:
    @staticmethod
    def _clean_markdown_text(text: str) -> str:
        """Sanitizes text and converts basic Markdown inline syntax to ReportLab XML tags."""
        if not text:
            return ""
        # Escape XML entities first
        escaped = html.escape(text)

        # Convert **bold** to <b>bold</b>
        escaped = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escaped)

        # Convert *italic* to <i>italic</i>
        escaped = re.sub(r"\*(.+?)\*", r"<i>\1</i>", escaped)

        # Convert `code` to <font name="Courier">code</font>
        escaped = re.sub(
            r"`(.+?)`",
            r'<font name="Courier" color="#0369a1">\1</font>',
            escaped,
        )

        return escaped

    @classmethod
    def export_conversation_to_pdf(
        cls,
        conversation_title: str,
        messages: List[Dict[str, Any]],
        user_email: Optional[str] = None,
    ) -> io.BytesIO:
        """Renders the entire conversation into a clean, multi-page vector PDF."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=40,
            rightMargin=40,
            topMargin=55,
            bottomMargin=55,
        )

        styles = getSampleStyleSheet()

        # Custom Typography Styles
        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=colors.HexColor("#0f172a"),
        )
        meta_style = ParagraphStyle(
            "MetaText",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#64748b"),
        )
        role_user_style = ParagraphStyle(
            "UserRole",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#334155"),
        )
        role_assistant_style = ParagraphStyle(
            "AssistantRole",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#0284c7"),
        )
        body_style = ParagraphStyle(
            "Body",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=14,
            textColor=colors.HexColor("#1e293b"),
        )
        h2_style = ParagraphStyle(
            "Heading2",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=8,
            spaceAfter=4,
        )
        h3_style = ParagraphStyle(
            "Heading3",
            parent=styles["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=10.5,
            leading=14,
            textColor=colors.HexColor("#1e293b"),
            spaceBefore=6,
            spaceAfter=3,
        )
        citation_header_style = ParagraphStyle(
            "CitHeader",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor("#0284c7"),
        )
        citation_body_style = ParagraphStyle(
            "CitBody",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#475569"),
        )
        code_style = ParagraphStyle(
            "CodeBlock",
            parent=styles["Normal"],
            fontName="Courier",
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#0f172a"),
        )

        story = []

        # Document Header
        safe_title = cls._clean_markdown_text(conversation_title or "Conversation Transcript")
        story.append(Paragraph(safe_title, title_style))
        story.append(Spacer(1, 4))

        now_str = datetime.now(timezone.utc).strftime("%B %d, %Y at %H:%M UTC")
        meta_line = f"Exported on {now_str} • {len(messages)} messages"
        if user_email:
            meta_line += f" • User: {html.escape(user_email)}"
        story.append(Paragraph(meta_line, meta_style))
        story.append(Spacer(1, 10))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0"), spaceAfter=14))

        # Render Messages
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            citations = msg.get("citations_json", [])

            is_user = role == "user"
            role_label = "You" if is_user else "docvyn"
            role_style = role_user_style if is_user else role_assistant_style

            # Role Header
            story.append(Paragraph(role_label, role_style))
            story.append(Spacer(1, 4))

            # Parse content blocks (code blocks vs regular markdown text)
            cls._render_message_content(
                story=story,
                content=content,
                body_style=body_style,
                h2_style=h2_style,
                h3_style=h3_style,
                code_style=code_style,
                is_user=is_user,
            )

            # Grounded Citations (if assistant message has citations)
            if not is_user and citations and len(citations) > 0:
                story.append(Spacer(1, 6))
                cit_elements = [
                    Paragraph(f"<b>Grounded Sources ({len(citations)})</b>", citation_header_style),
                    Spacer(1, 4),
                ]
                for idx, cit in enumerate(citations):
                    doc_title = html.escape(cit.get("document_title") or "Document")
                    page_num = cit.get("page_number")
                    page_str = f" (Page {page_num})" if page_num else ""
                    snippet = html.escape(cit.get("snippet", "")[:280])

                    cit_line = f"• <b>Source {idx + 1}:</b> {doc_title}{page_str}<br/><i>\"{snippet}\"</i>"
                    cit_elements.append(Paragraph(cit_line, citation_body_style))
                    cit_elements.append(Spacer(1, 3))

                cit_table = Table([[cit_elements]], colWidths=[520])
                cit_table.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                            ("PADDING", (0, 0), (-1, -1), 7),
                        ]
                    )
                )
                story.append(cit_table)

            story.append(Spacer(1, 14))
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#f1f5f9"), spaceAfter=10))

        doc.build(story, canvasmaker=NumberedCanvas)
        buffer.seek(0)
        return buffer

    @classmethod
    def _render_message_content(
        cls,
        story: list,
        content: str,
        body_style: ParagraphStyle,
        h2_style: ParagraphStyle,
        h3_style: ParagraphStyle,
        code_style: ParagraphStyle,
        is_user: bool,
    ):
        """Splits markdown content into paragraphs, headings, tables, and fenced code blocks."""
        # Split on fenced code blocks ``` ... ```
        parts = re.split(r"(```[\s\S]*?```)", content)

        for part in parts:
            if not part:
                continue

            if part.startswith("```") and part.endswith("```"):
                # Code block
                code_lines = part[3:-3].split("\n")
                # First line might be language name (e.g. python, json)
                if code_lines and len(code_lines[0].strip().split()) == 1 and not code_lines[0].startswith(" "):
                    code_lines = code_lines[1:]
                code_text = "\n".join(code_lines).strip()
                if code_text:
                    pre = Preformatted(code_text, code_style)
                    code_box = Table([[pre]], colWidths=[520])
                    code_box.setStyle(
                        TableStyle(
                            [
                                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                                ("PADDING", (0, 0), (-1, -1), 6),
                            ]
                        )
                    )
                    story.append(code_box)
                    story.append(Spacer(1, 6))
            else:
                # Regular text blocks: split by line breaks or double line breaks
                paragraphs = part.split("\n\n")
                for p_text in paragraphs:
                    p_text = p_text.strip()
                    if not p_text:
                        continue

                    # Check for markdown headings
                    if p_text.startswith("### "):
                        story.append(Paragraph(cls._clean_markdown_text(p_text[4:]), h3_style))
                    elif p_text.startswith("## ") or p_text.startswith("# "):
                        heading_text = p_text[3:] if p_text.startswith("## ") else p_text[2:]
                        story.append(Paragraph(cls._clean_markdown_text(heading_text), h2_style))
                    elif "|" in p_text and "-|-" in p_text:
                        # Markdown table
                        table_flowable = cls._render_markdown_table(p_text)
                        if table_flowable:
                            story.append(table_flowable)
                            story.append(Spacer(1, 6))
                        else:
                            story.append(Paragraph(cls._clean_markdown_text(p_text), body_style))
                            story.append(Spacer(1, 4))
                    else:
                        # Check if it is a list
                        lines = p_text.split("\n")
                        for line in lines:
                            line = line.strip()
                            if not line:
                                continue
                            if line.startswith("- ") or line.startswith("* "):
                                story.append(
                                    Paragraph(
                                        f"&bull;&nbsp;&nbsp;{cls._clean_markdown_text(line[2:])}",
                                        body_style,
                                    )
                                )
                            elif re.match(r"^\d+\.\s", line):
                                prefix = re.match(r"^\d+\.\s", line).group(0)
                                story.append(
                                    Paragraph(
                                        f"<b>{prefix}</b>{cls._clean_markdown_text(line[len(prefix):])}",
                                        body_style,
                                    )
                                )
                            else:
                                story.append(Paragraph(cls._clean_markdown_text(line), body_style))
                        story.append(Spacer(1, 4))

    @classmethod
    def _render_markdown_table(cls, table_text: str) -> Optional[Table]:
        """Converts markdown table text into a ReportLab Table."""
        try:
            lines = [l.strip() for l in table_text.split("\n") if l.strip()]
            data = []
            for line in lines:
                if re.match(r"^\|?[\s-:]+\|?$", line) or "-|-" in line:
                    continue  # Separator row
                row = [c.strip() for c in line.split("|")]
                if row and row[0] == "":
                    row = row[1:]
                if row and row[-1] == "":
                    row = row[:-1]
                if row:
                    data.append([Paragraph(cls._clean_markdown_text(c), ParagraphStyle("TableCell", fontName="Helvetica", fontSize=8, leading=11)) for c in row])

            if len(data) >= 1:
                t = Table(data, colWidths=[520 / len(data[0])] * len(data[0]))
                t.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                            ("PADDING", (0, 0), (-1, -1), 4),
                        ]
                    )
                )
                return t
        except Exception:
            return None
        return None
