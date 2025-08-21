import { NextRequest, NextResponse } from 'next/server';
import { saveWorkspace, getWorkspaces } from '@/lib/workspace';
import { CreateWorkspaceRequest } from '@/types/forms';

// ワークスペース作成
export async function POST(request: NextRequest) {
    try {
        console.log('ワークスペース作成APIが呼ばれました');
        const body: CreateWorkspaceRequest = await request.json();
        console.log('受信したデータ:', JSON.stringify(body, null, 2));

        // バリデーション
        if (!body.name || !body.formsData || !body.fileName) {
            console.log('バリデーションエラー:', {
                name: !!body.name,
                formsData: !!body.formsData,
                fileName: !!body.fileName
            });
            return NextResponse.json(
                { error: '必要なデータが不足しています' },
                { status: 400 }
            );
        }

        console.log('ワークスペースを保存中...');
        const workspace = await saveWorkspace(body);
        console.log('ワークスペース保存完了:', workspace.id);

        return NextResponse.json({
            success: true,
            workspace: {
                id: workspace.id,
                name: workspace.name,
                description: workspace.description,
                createdAt: workspace.createdAt,
                fileName: workspace.fileName,
                totalResponses: workspace.formsData.totalResponses,
                totalQuestions: workspace.formsData.questions.length,
            }
        });
    } catch (error) {
        console.error('ワークスペース作成エラー:', error);
        return NextResponse.json(
            { error: 'ワークスペースの作成に失敗しました' },
            { status: 500 }
        );
    }
}

// ワークスペース一覧取得
export async function GET() {
    try {
        const workspaces = await getWorkspaces();
        return NextResponse.json({
            success: true,
            workspaces
        });
    } catch (error) {
        console.error('ワークスペース一覧取得エラー:', error);
        return NextResponse.json(
            { error: 'ワークスペース一覧の取得に失敗しました' },
            { status: 500 }
        );
    }
}
