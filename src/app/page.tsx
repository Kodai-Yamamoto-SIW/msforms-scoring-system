'use client';

import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import ResponsePreview from '@/components/ResponsePreview';
import QuestionView from '@/components/QuestionView';
import { ParsedFormsData } from '@/types/forms';

type ViewMode = 'question' | 'person';

export default function Home() {
  const [formsData, setFormsData] = useState<ParsedFormsData | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('question'); // デフォルトは問題ごと表示

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
            {/* 操作パネル */}
            <div className="flex justify-center items-center gap-4 mb-6">
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                別のファイルを読み込む
              </button>

              {/* 表示モード切り替え */}
              <div className="flex bg-gray-200 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('question')}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${viewMode === 'question'
                      ? 'bg-green-600 text-white'
                      : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                  📝 問題ごと表示
                </button>
                <button
                  onClick={() => setViewMode('person')}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${viewMode === 'person'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                  👤 人ごと表示
                </button>
              </div>
            </div>

            {/* 表示モードに応じたコンポーネント */}
            {viewMode === 'question' ? (
              <QuestionView data={formsData} />
            ) : (
              <ResponsePreview data={formsData} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
