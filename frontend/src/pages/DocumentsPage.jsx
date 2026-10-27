import React, { useState, useEffect, useRef } from 'react';
import { documentsApi } from '../api/documents';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Spinner from '../components/common/Spinner';
import Input from '../components/common/Input';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { useSidebar } from '../context/SidebarContext';
import {
  UploadCloud,
  FileText,
  Trash2,
  RotateCcw,
  Eye,
  Search,
  AlertTriangle,
  Plus,
  RefreshCw,
  Download,
  Image as ImageIcon,
  CheckCircle2,
  PanelLeftOpen,
} from 'lucide-react';

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.png', '.jpg', '.jpeg', '.tiff'];

export default function DocumentsPage() {
  const { isSidebarCollapsed, toggleSidebarCollapse } = useSidebar();
  const [documents, setDocuments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Delete modal state
  const [deleteDoc, setDeleteDoc] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Preview modal state
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewTab, setPreviewTab] = useState('preview'); // 'preview' | 'text'
  const [previewChunks, setPreviewChunks] = useState([]);
  const [chunksLoading, setChunksLoading] = useState(false);

  // Alert modal state
  const [alertNotice, setAlertNotice] = useState(null);

  const fileInputRef = useRef(null);
  const blobUrlRef = useRef(null);

  const cleanupBlobUrl = () => {
    if (blobUrlRef.current) {
      window.URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  };

  const loadDocumentPreview = async (doc) => {
    if (!doc) {
      cleanupBlobUrl();
      setPreviewBlobUrl(null);
      setPreviewChunks([]);
      setPreviewLoading(false);
      setPreviewError('');
      return;
    }

    const isPdf = doc.mime_type === 'application/pdf';
    const isImage = doc.mime_type?.startsWith('image/');
    const isDocx = doc.filename?.toLowerCase().endsWith('.docx') || doc.mime_type?.includes('word');

    // For Word documents, automatically show extracted text tab
    if (isDocx) {
      setPreviewTab('text');
    } else {
      setPreviewTab('preview');
    }

    // Always fetch parsed chunks
    setChunksLoading(true);
    documentsApi
      .getDocumentChunks(doc.id)
      .then((data) => {
        setPreviewChunks(data?.chunks || []);
      })
      .catch(() => {
        setPreviewChunks([]);
      })
      .finally(() => {
        setChunksLoading(false);
      });

    // Fetch binary blob for PDF or Image
    if (isPdf || isImage) {
      setPreviewLoading(true);
      setPreviewError('');
      try {
        const blob = await documentsApi.getPreviewBlob(doc.id);
        const url = window.URL.createObjectURL(blob);
        cleanupBlobUrl();
        blobUrlRef.current = url;
        setPreviewBlobUrl(url);
      } catch (err) {
        console.error('Failed to load preview blob:', err);
        cleanupBlobUrl();
        setPreviewBlobUrl(null);
        setPreviewError('Could not load visual file preview. You can read the extracted text or download the file.');
      } finally {
        setPreviewLoading(false);
      }
    } else {
      cleanupBlobUrl();
      setPreviewBlobUrl(null);
      setPreviewLoading(false);
      setPreviewError('');
    }
  };

  useEffect(() => {
    loadDocumentPreview(previewDoc);
    return () => {
      cleanupBlobUrl();
    };
  }, [previewDoc]);

  const fetchDocuments = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await documentsApi.getDocuments({
        page,
        size: 15,
        status: statusFilter || undefined,
        q: searchQuery || undefined,
      });
      setDocuments(data.items || []);
      setTotal(data.total || 0);
      setError('');
    } catch (err) {
      if (showLoading) {
        setError('Unable to load documents. Please check your connection and try again.');
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments(true);
  }, [page, statusFilter, searchQuery]);

  // Auto-poll if any document is processing, queued, or uploaded
  useEffect(() => {
    const hasActiveTasks = documents.some(
      (d) => d.status === 'processing' || d.status === 'queued' || d.status === 'uploaded'
    );
    if (!hasActiveTasks) return;

    const interval = setInterval(() => {
      fetchDocuments(false);
    }, 2500);

    return () => clearInterval(interval);
  }, [documents]);

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSelectFile(e.target.files[0]);
    }
  };

  const validateAndSelectFile = (file) => {
    setUploadError('');
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setUploadError(
        `Unsupported file type '${ext}'. Supported formats: PDF, DOCX, PNG, JPEG, TIFF.`
      );
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setUploadError('File size exceeds the 25 MB limit.');
      return;
    }
    setUploadFile(file);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError('');

    try {
      await documentsApi.uploadDocument(uploadFile, (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percent);
      });
      setIsUploadOpen(false);
      setUploadFile(null);
      fetchDocuments(true);
    } catch (err) {
      setUploadError(err.response?.data?.detail || 'Unable to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRetry = async (docId) => {
    try {
      await documentsApi.retryDocument(docId);
      fetchDocuments(false);
    } catch (err) {
      setAlertNotice({
        title: 'Reprocess Failed',
        message: 'Unable to reprocess document. Please try again.',
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDoc) return;
    setIsDeleting(true);
    try {
      await documentsApi.deleteDocument(deleteDoc.id);
      setDeleteDoc(null);
      fetchDocuments(false);
    } catch (err) {
      setAlertNotice({
        title: 'Delete Failed',
        message: 'Unable to delete document. Please try again.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      await documentsApi.downloadOriginal(doc.id, doc.filename);
    } catch (err) {
      setAlertNotice({
        title: 'Download Failed',
        message: 'Failed to download original document file. The file may not exist or access was denied.',
      });
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getDocTypeBadge = (filename, mimeType) => {
    const ext = filename?.substring(filename.lastIndexOf('.')).toLowerCase() || '';
    if (ext === '.pdf' || mimeType === 'application/pdf') return 'PDF';
    if (ext === '.docx') return 'DOCX';
    if (ext === '.png') return 'PNG';
    if (ext === '.jpg' || ext === '.jpeg') return 'JPEG';
    if (ext === '.tiff' || ext === '.tif') return 'TIFF';
    return ext ? ext.replace('.', '').toUpperCase() : 'DOC';
  };

  const renderExtractionMethod = (doc) => {
    const method = doc.metadata_json?.extraction_method;
    const ocrConf = doc.metadata_json?.ocr_confidence;

    if (method === 'ocr' || method === 'ocr_pdf' || method === 'ocr_image') {
      const pct = ocrConf ? `${Math.round(ocrConf * 100)}%` : 'Active';
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20"
          title={`Extracted via RapidOCR (confidence: ${pct})`}
        >
          OCR {pct}
        </span>
      );
    }

    if (method === 'digital_pdf') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono text-[#a0a0a0] bg-[#222222] border border-[#2e2e2e]">
          Digital PDF
        </span>
      );
    }

    if (method === 'docx') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono text-[#a0a0a0] bg-[#222222] border border-[#2e2e2e]">
          DOCX Table
        </span>
      );
    }

    return (
      <span className="text-[11px] text-[#666666]">
        {doc.status === 'completed' ? 'Processed' : '—'}
      </span>
    );
  };

  const filterTabs = [
    { label: 'All Documents', value: '' },
    { label: 'Ready to use', value: 'completed' },
    { label: 'Processing', value: 'processing' },
    { label: "Couldn't process", value: 'failed' },
  ];

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-6 space-y-6 pb-16 animate-fade-in bg-[#121212] text-white">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          {isSidebarCollapsed && (
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              className="hidden md:flex p-2 rounded-xl text-[#8e8e8e] hover:text-white hover:bg-[#202020] border border-[#2c2c2b] transition cursor-pointer shrink-0"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-white">
              Documents
            </h1>
            <p className="font-sans text-xs sm:text-sm text-[#8e8e8e] mt-1 leading-relaxed">
              Upload and organize reference documents (PDF, DOCX, PNG, JPEG, TIFF) for grounded search in docvyn.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => fetchDocuments(true)}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setIsUploadOpen(true)}
          >
            Upload document
          </Button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1a1a1a] p-3 rounded-2xl border border-[#282828]">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 max-w-full scrollbar-none">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setStatusFilter(tab.value);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer ${
                statusFilter === tab.value
                  ? 'bg-white text-[#141414] font-semibold shadow-sm'
                  : 'text-[#8e8e8e] hover:bg-[#242424] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search documents by name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            icon={Search}
          />
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-[#251717] border border-[#3e2222] rounded-xl flex items-center gap-2 text-rose-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Documents Table Container */}
      <div className="bg-[#1a1a1a] rounded-2xl border border-[#282828] overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center">
            <Spinner size="lg" className="mx-auto" />
            <p className="mt-4 text-xs font-medium text-[#8e8e8e]">
              Loading documents...
            </p>
          </div>
        ) : documents.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 bg-[#222222] border border-[#2e2e2e] text-[#8e8e8e] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="font-heading text-base font-semibold text-white">No documents uploaded yet</h3>
            <p className="font-sans text-xs text-[#8e8e8e] mt-1 max-w-sm mx-auto leading-relaxed">
              Upload your documents (PDF, DOCX, images) to get started. You can then ask questions and search through their content in Playground.
            </p>
            <div className="mt-5">
              <Button
                variant="primary"
                size="sm"
                icon={UploadCloud}
                onClick={() => setIsUploadOpen(true)}
              >
                Upload document
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm text-[#ededed]">
                <thead className="bg-[#161616] text-[#8e8e8e] text-[11px] font-medium tracking-wide border-b border-[#262626]">
                  <tr>
                    <th className="px-6 py-3.5 font-medium">Document</th>
                    <th className="px-3 py-3.5 font-medium">Type</th>
                    <th className="px-4 py-3.5 font-medium">Size</th>
                    <th className="px-4 py-3.5 font-medium">Pages</th>
                    <th className="px-4 py-3.5 font-medium">Extraction</th>
                    <th className="px-4 py-3.5 font-medium">Status & Progress</th>
                    <th className="px-6 py-3.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#242424]">
                  {documents.map((doc) => {
                    const isProcessing =
                      doc.status === 'processing' ||
                      doc.status === 'queued' ||
                      doc.status === 'uploaded';
                    const progress = doc.metadata_json?.progress ?? (isProcessing ? 25 : 100);
                    const stage = doc.metadata_json?.stage || doc.status;

                    return (
                      <tr key={doc.id} className="hover:bg-[#202020] transition-colors duration-150">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#222222] border border-[#2e2e2e] text-[#a0a0a0] flex items-center justify-center shrink-0">
                              {doc.mime_type?.startsWith('image/') ? (
                                <ImageIcon className="w-4 h-4" />
                              ) : (
                                <FileText className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-heading font-medium text-white text-xs sm:text-sm truncate max-w-xs">
                                {doc.title || doc.filename}
                              </p>
                              <p className="font-sans text-[11px] text-[#707070] truncate flex items-center gap-2">
                                <span>{doc.filename}</span>
                                {doc.created_at && (
                                  <>
                                    <span>•</span>
                                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                                  </>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#222222] border border-[#333333] text-[#cfcfcf]">
                            {getDocTypeBadge(doc.filename, doc.mime_type)}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-xs text-[#8e8e8e]">
                          {formatSize(doc.file_size)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-xs text-[#a0a0a0]">
                          {doc.page_count > 0 ? doc.page_count : '—'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {renderExtractionMethod(doc)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {isProcessing ? (
                            <div className="space-y-1.5 min-w-[130px]">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-[#a0a0a0] capitalize flex items-center gap-1.5">
                                  <Spinner size="sm" />
                                  {stage}
                                </span>
                                <span className="font-mono text-[#8e8e8e]">{progress}%</span>
                              </div>
                              <div className="w-full bg-[#242424] rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-white h-full transition-all duration-300 rounded-full"
                                  style={{ width: `${Math.max(5, progress)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div>
                              <Badge status={doc.status} />
                              {doc.error_message && (
                                <p
                                  className="text-[11px] text-rose-400 mt-1 truncate max-w-xs"
                                  title={doc.error_message}
                                >
                                  {doc.error_message}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Preview */}
                            <button
                              onClick={() => setPreviewDoc(doc)}
                              title="Preview document"
                              className="p-1.5 text-[#8e8e8e] hover:text-white hover:bg-[#282828] rounded-lg transition cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Download Original File */}
                            <button
                              onClick={() => handleDownload(doc)}
                              title="Download original file"
                              className="p-1.5 text-[#8e8e8e] hover:text-white hover:bg-[#282828] rounded-lg transition cursor-pointer"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            {/* Retry if failed */}
                            {doc.status === 'failed' && (
                              <button
                                onClick={() => handleRetry(doc.id)}
                                title="Retry processing"
                                className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-[#2d2217] rounded-lg transition cursor-pointer"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}

                            {/* Delete */}
                            <button
                              onClick={() => setDeleteDoc(doc)}
                              title="Delete document"
                              className="p-1.5 text-[#8e8e8e] hover:text-rose-400 hover:bg-[#251717] rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="sm:hidden divide-y divide-[#242424]">
              {documents.map((doc) => {
                const isProcessing =
                  doc.status === 'processing' ||
                  doc.status === 'queued' ||
                  doc.status === 'uploaded';
                const progress = doc.metadata_json?.progress ?? (isProcessing ? 25 : 100);
                const stage = doc.metadata_json?.stage || doc.status;

                return (
                  <div key={doc.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#222222] border border-[#2e2e2e] text-[#a0a0a0] flex items-center justify-center shrink-0">
                          {doc.mime_type?.startsWith('image/') ? (
                            <ImageIcon className="w-4 h-4" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-heading font-medium text-white text-xs truncate">
                            {doc.title || doc.filename}
                          </p>
                          <p className="font-sans text-[11px] text-[#707070] truncate">
                            {doc.filename}
                          </p>
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#222222] border border-[#333333] text-[#cfcfcf] shrink-0">
                        {getDocTypeBadge(doc.filename, doc.mime_type)}
                      </span>
                    </div>

                    {/* Metadata tags */}
                    <div className="flex items-center flex-wrap gap-2 text-[11px] text-[#8e8e8e]">
                      <span>{formatSize(doc.file_size)}</span>
                      <span>•</span>
                      <span>{doc.page_count > 0 ? `${doc.page_count}p` : '1p'}</span>
                      <span>•</span>
                      <div>{renderExtractionMethod(doc)}</div>
                    </div>

                    {/* Status / Progress */}
                    {isProcessing ? (
                      <div className="space-y-1 bg-[#161616] p-2 rounded-xl border border-[#262626]">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#a0a0a0] capitalize flex items-center gap-1.5">
                            <Spinner size="sm" />
                            {stage}
                          </span>
                          <span className="font-mono text-[#8e8e8e]">{progress}%</span>
                        </div>
                        <div className="w-full bg-[#242424] rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-white h-full transition-all duration-300 rounded-full"
                            style={{ width: `${Math.max(5, progress)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <Badge status={doc.status} />
                        {doc.created_at && (
                          <span className="text-[10px] text-[#616161]">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}

                    {doc.error_message && (
                      <p className="text-[11px] text-rose-400 bg-rose-950/20 p-2 rounded-lg border border-rose-900/30">
                        {doc.error_message}
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-[#222222]">
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-[#b0b0b0] hover:text-white bg-[#222222] hover:bg-[#2c2c2c] rounded-lg transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(doc)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-[#b0b0b0] hover:text-white bg-[#222222] hover:bg-[#2c2c2c] rounded-lg transition cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                      {doc.status === 'failed' && (
                        <button
                          type="button"
                          onClick={() => handleRetry(doc.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-amber-400 hover:text-amber-300 bg-amber-950/30 hover:bg-amber-900/40 rounded-lg transition cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Retry</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteDoc(doc)}
                        className="p-1.5 text-[#8e8e8e] hover:text-rose-400 hover:bg-[#251717] rounded-lg transition cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => !isUploading && setIsUploadOpen(false)}
        title="Upload Document"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-colors duration-150 ${
              uploadFile
                ? 'border-white/40 bg-[#1e1e1e]'
                : 'border-[#333333] hover:border-[#555555] bg-[#161616]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.png,.jpg,.jpeg,.tiff"
              onChange={handleFileInput}
              className="hidden"
            />
            <div className="w-12 h-12 bg-[#222222] border border-[#2e2e2e] rounded-xl flex items-center justify-center mx-auto mb-3 text-white">
              <UploadCloud className="w-6 h-6" />
            </div>
            {uploadFile ? (
              <div>
                <p className="font-heading font-semibold text-white text-sm truncate max-w-xs mx-auto">
                  {uploadFile.name}
                </p>
                <p className="font-sans text-xs text-[#8e8e8e] mt-1">
                  {formatSize(uploadFile.size)} • Click or drop to replace
                </p>
              </div>
            ) : (
              <div>
                <p className="font-heading text-sm font-medium text-white">
                  Drop your document here, or <span className="underline font-semibold">browse</span>
                </p>
                <p className="font-sans text-xs text-[#8e8e8e] mt-1.5 leading-relaxed">
                  Supports PDF, DOCX, PNG, JPEG, TIFF (up to 25 MB)
                </p>
              </div>
            )}
          </div>

          {uploadError && (
            <div className="p-3 bg-[#251717] border border-[#3e2222] rounded-xl flex items-center gap-2 text-rose-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {isUploading && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[#a0a0a0]">
                <span>Uploading to docvyn...</span>
                <span className="font-mono">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-[#242424] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-white h-full transition-all duration-200 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-[#262626]">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsUploadOpen(false);
                setUploadFile(null);
                setUploadError('');
              }}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!uploadFile || isUploading}
              isLoading={isUploading}
            >
              Upload and process
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteDoc} onClose={() => setDeleteDoc(null)} title="Delete Document">
        <div className="space-y-4 text-[#a0a0a0]">
          <p className="text-xs sm:text-sm leading-relaxed">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-white">{deleteDoc?.title || deleteDoc?.filename}</span>?
            This will permanently remove the document and its searchable contents from your workspace.
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#262626]">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDeleteDoc(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteConfirm}
              isLoading={isDeleting}
            >
              Delete document
            </Button>
          </div>
        </div>
      </Modal>

      {/* Document Preview Modal */}
      <Modal
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.title || previewDoc?.filename || 'Document Preview'}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-3">
          {/* Header metadata & tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#262626]">
            <div className="flex items-center gap-2.5 text-xs text-[#8e8e8e]">
              <span>{previewDoc?.page_count || 1} pages</span>
              <span>•</span>
              <span>{previewDoc?.chunk_count || previewChunks.length} sections</span>
              <span>•</span>
              <span>{formatSize(previewDoc?.file_size)}</span>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <div className="inline-flex rounded-lg bg-[#141414] p-0.5 border border-[#2a2a2a]">
                <button
                  type="button"
                  onClick={() => setPreviewTab('preview')}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition cursor-pointer ${
                    previewTab === 'preview'
                      ? 'bg-[#2a2a2a] text-white shadow-sm'
                      : 'text-[#8e8e8e] hover:text-white'
                  }`}
                >
                  File Preview
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('text')}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    previewTab === 'text'
                      ? 'bg-[#2a2a2a] text-white shadow-sm'
                      : 'text-[#8e8e8e] hover:text-white'
                  }`}
                >
                  <span>Extracted Text</span>
                  {previewChunks.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#333333] text-[#b0b0b0]">
                      {previewChunks.length}
                    </span>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleDownload(previewDoc)}
                title="Download original file"
                className="p-1.5 text-[#8e8e8e] hover:text-white hover:bg-[#242424] rounded-lg transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="h-[60vh] max-h-[550px] bg-[#141414] rounded-xl overflow-hidden border border-[#282828] flex flex-col relative">
            {previewTab === 'text' ? (
              <div className="w-full h-full overflow-y-auto p-4 space-y-3 font-sans text-xs text-[#d4d4d4] leading-relaxed">
                {chunksLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-[#8e8e8e]">
                    <Spinner size="md" />
                    <p className="mt-2 text-xs">Loading extracted sections...</p>
                  </div>
                ) : previewChunks.length === 0 ? (
                  <div className="text-center py-16 text-[#707070]">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No extracted text sections found for this document.</p>
                  </div>
                ) : (
                  previewChunks.map((chunk, idx) => (
                    <div
                      key={chunk.id || idx}
                      className="p-3 bg-[#1a1a1a] rounded-xl border border-[#262626] space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px] text-[#707070] font-mono">
                        <span>Section {idx + 1}</span>
                        {chunk.page_number && <span>Page {chunk.page_number}</span>}
                      </div>
                      <p className="text-white/90 whitespace-pre-wrap select-text">
                        {chunk.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            ) : previewDoc?.mime_type === 'application/pdf' ? (
              previewLoading ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-[#8e8e8e]">
                  <Spinner size="lg" />
                  <p className="mt-3 text-xs font-medium">Loading document preview...</p>
                </div>
              ) : previewError ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center max-w-sm mx-auto space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#251717] border border-[#3e2222] text-rose-300 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <h4 className="font-heading text-sm font-semibold text-white">Visual Preview Unavailable</h4>
                  <p className="text-xs text-[#8e8e8e] leading-relaxed">
                    {previewError}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPreviewTab('text')}
                      className="px-3 py-1.5 bg-[#252525] hover:bg-[#303030] border border-[#3a3a3a] text-white text-xs rounded-xl font-medium transition cursor-pointer"
                    >
                      Read Extracted Text
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(previewDoc)}
                      className="px-3 py-1.5 bg-white text-[#141414] hover:bg-[#e5e5e5] text-xs rounded-xl font-semibold transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download File</span>
                    </button>
                  </div>
                </div>
              ) : previewBlobUrl ? (
                <div className="w-full h-full flex flex-col">
                  {/* Mobile direct download pill because mobile Chrome blocks raw iframe PDF rendering */}
                  <div className="sm:hidden flex items-center justify-between px-3 py-2 bg-[#1a1a1a] border-b border-[#282828] text-xs shrink-0">
                    <span className="text-[#8e8e8e] truncate max-w-[170px]">Mobile PDF Viewer</span>
                    <button
                      type="button"
                      onClick={() => handleDownload(previewDoc)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-[#141414] rounded-lg font-semibold text-[11px]"
                    >
                      <Download className="w-3 h-3" />
                      <span>Open / Download</span>
                    </button>
                  </div>
                  <iframe
                    src={previewBlobUrl}
                    className="w-full flex-1 border-none"
                    title="PDF Preview"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-[#8e8e8e] text-xs space-y-2">
                  <FileText className="w-8 h-8 opacity-40 mx-auto" />
                  <p>Document preview unavailable.</p>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('text')}
                    className="mt-2 px-3 py-1.5 bg-[#252525] hover:bg-[#303030] text-white text-xs rounded-xl transition cursor-pointer"
                  >
                    View Extracted Text
                  </button>
                </div>
              )
            ) : previewDoc?.mime_type?.startsWith('image/') ? (
              previewLoading ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-[#8e8e8e]">
                  <Spinner size="lg" />
                  <p className="mt-3 text-xs">Loading image preview...</p>
                </div>
              ) : previewError ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center max-w-sm mx-auto space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#251717] border border-[#3e2222] text-rose-300 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <h4 className="font-heading text-sm font-semibold text-white">Image Preview Unavailable</h4>
                  <p className="text-xs text-[#8e8e8e] leading-relaxed">
                    {previewError}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDownload(previewDoc)}
                    className="px-3 py-1.5 bg-white text-[#141414] hover:bg-[#e5e5e5] text-xs rounded-xl font-semibold transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Image</span>
                  </button>
                </div>
              ) : previewBlobUrl ? (
                <div className="w-full h-full flex items-center justify-center p-2">
                  <img
                    src={previewBlobUrl}
                    alt={previewDoc.filename}
                    className="max-h-full max-w-full object-contain rounded-lg"
                  />
                </div>
              ) : (
                <div className="text-center p-8 text-[#8e8e8e] text-xs">
                  <p>Image preview unavailable.</p>
                </div>
              )
            ) : (
              <div className="text-center p-8 m-auto">
                <FileText className="w-12 h-12 text-[#616161] mx-auto mb-3" />
                <p className="text-sm font-semibold text-white">Word Document (.docx)</p>
                <p className="text-xs text-[#8e8e8e] mt-1 max-w-sm leading-relaxed mx-auto">
                  Extracted into {previewDoc?.chunk_count || previewChunks.length} searchable sections. Click "Extracted Text" above to read them directly, or download the original file.
                </p>
                <button
                  type="button"
                  onClick={() => handleDownload(previewDoc)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white text-[#141414] rounded-xl text-xs font-semibold hover:bg-[#e5e5e5] transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download original file
                </button>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Error Alert Modal */}
      {alertNotice && (
        <ConfirmationModal
          isOpen={Boolean(alertNotice)}
          onClose={() => setAlertNotice(null)}
          title={alertNotice.title}
          message={alertNotice.message}
          type="error"
        />
      )}
    </div>
  );
}
