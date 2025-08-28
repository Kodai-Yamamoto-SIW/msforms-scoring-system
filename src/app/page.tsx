'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FileUpload from '@/components/FileUpload';
import ResponsePreview from '@/components/ResponsePreview';
import QuestionView from '@/components/QuestionView';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import ScoringCriteriaSetup from '@/components/ScoringCriteriaSetup';
import { ParsedFormsData, ScoringWorkspace, QuestionScoringCriteria } from '@/types/forms';

type ViewMode = 'question' | 'person';
type AppMode = 'workspaceList' | 'main' | 'scoringCriteria';

export default function Home() {
  const router = useRouter();
  const [formsData, setFormsData] = useState<ParsedFormsData | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('question'); // デフォルトは問題ごと表示
  const [currentWorkspace, setCurrentWorkspace] = useState<ScoringWorkspace | null>(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>('workspaceList');

  const handleWorkspaceCreated = (workspaceId: string) => {
    // ワークスペース作成後、そのワークスペースを開く
    loadWorkspace(workspaceId);
  };

  const handleSelectWorkspace = (workspaceId: string) => {
    router.push(`/workspace/${workspaceId}`);
  };

  const loadWorkspace = async (workspaceId: string) => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`);
      const result = await response.json();

      if (result.success) {
        setCurrentWorkspace(result.workspace);
        setFormsData(result.workspace.formsData);
        setShowFileUpload(false);
        setAppMode('main');
      } else {
        console.error('ワークスペースの読み込みに失敗しました:', result.error);
      }
    } catch (error) {
      console.error('ワークスペース読み込みエラー:', error);
    }
  };

  const handleCreateNew = () => {
    setShowFileUpload(true);
    setAppMode('main');
  };



  const handleSaveScoringCriteria = async (criteria: QuestionScoringCriteria[]) => {
    if (!currentWorkspace) return;

    try {
      const response = await fetch(`/api/workspaces/${currentWorkspace.id}/scoring-criteria`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ criteria }),
      });

      if (response.ok) {
        const result = await response.json();
        setCurrentWorkspace(result.workspace);
        setAppMode('main');
        alert('採点基準を保存しました');
      } else {
        alert('採点基準の保存に失敗しました');
      }
    } catch (error) {
      console.error('採点基準保存エラー:', error);
      alert('採点基準の保存に失敗しました');
    }
  };

  const handleCancelScoringCriteria = () => {
    setAppMode('main');
  };

  const handleReset = () => {
    setFormsData(null);
    setCurrentWorkspace(null);
    setShowFileUpload(false);
    setAppMode('workspaceList');
  };

  // 採点基準設定画面
  if (appMode === 'scoringCriteria' && currentWorkspace) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <ScoringCriteriaSetup
            workspace={currentWorkspace}
            onSave={handleSaveScoringCriteria}
            onCancel={handleCancelScoringCriteria}
          />
        </div>
      </div>
    );
  }

  // ワークスペースまたはファイルアップロードの選択画面
  if (!formsData && !showFileUpload) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <WorkspaceSelector
          onSelectWorkspace={handleSelectWorkspace}
          onCreateNew={handleCreateNew}
        />
      </div>
    );
  }

  // ファイルアップロード画面
  if (showFileUpload && !formsData) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              新しいワークスペースを作成
            </h1>
            <button
              onClick={() => setShowFileUpload(false)}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              ← ワークスペース一覧に戻る
            </button>
          </div>
          <FileUpload
            onWorkspaceCreated={handleWorkspaceCreated}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Microsoft Forms 採点システム
          </h1>
          {currentWorkspace && (
            <p className="text-gray-600">
              ワークスペース: {currentWorkspace.name}
            </p>
          )}
        </header>

        {formsData && (
          <div>
            {/* 操作パネル */}
            <div className="flex justify-center items-center gap-4 mb-6">
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                ワークスペース一覧に戻る
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
