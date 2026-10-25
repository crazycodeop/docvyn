import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/common/Button';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-[#1a1a1a] border border-[#282828] text-white/80 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
          <FileQuestion className="w-8 h-8" />
        </div>
        <h1 className="font-heading text-3xl font-bold text-white">404 - Not Found</h1>
        <p className="font-sans mt-2 text-xs sm:text-sm text-[#8e8e8e] leading-relaxed">
          The requested page could not be found.
        </p>
        <div className="mt-6">
          <Link to="/">
            <Button variant="primary" icon={ArrowLeft}>
              Back to Chat
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
