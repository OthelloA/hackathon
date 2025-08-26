'use client';
import { useState } from 'react';

interface DocumentUploadProps {
  onTextExtracted: (text: string, fileName: string) => void;
}

export default function DocumentUpload({ onTextExtracted }: DocumentUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (result.success && result.extractedText) {
        onTextExtracted(result.extractedText, result.fileName);
      } else {
        alert(result.error || 'Failed to process document');
      }
    } catch (error) {
      alert('Upload failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mb-4">
      <input
        type="file"
        accept=".pdf,.docx"
        onChange={handleFileUpload}
        disabled={isProcessing}
        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />
      {isProcessing && <p className="mt-2 text-sm text-gray-600">Processing document...</p>}
    </div>
  );
}