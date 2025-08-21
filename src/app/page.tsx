'use client';

import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import ResponsePreview from '@/components/ResponsePreview';
import { ParsedFormsData } from '@/types/forms';

export default function Home() {
  const [formsData, setFormsData] = useState<ParsedFormsData | null>(null);

  const handleDataParsed = (data: ParsedFormsData) => {
    setFormsData(data);
  };

  const handleReset = () => {
    setFormsData(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Microsoft Forms 採点システム
          </h1>
          <p className="text-gray-600">
            Formsの回答データを読み込んで採点を行います
          </p>
        </header>

        {!formsData ? (
          <FileUpload onDataParsed={handleDataParsed} />
        ) : (
          <div>
            <div className="text-center mb-6">
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                別のファイルを読み込む
              </button>
            </div>
            <ResponsePreview data={formsData} />
          </div>
        )}
      </div>
    </div>
  );
}
