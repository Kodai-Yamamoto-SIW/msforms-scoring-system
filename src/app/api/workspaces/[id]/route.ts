import { NextRequest, NextResponse } from 'next/server';
import { getWorkspace, deleteWorkspace, updateWorkspace } from '@/lib/workspace';
import { UpdateWorkspaceRequest } from '@/types/forms';

// 特定のワークスペース取得
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const workspace = await getWorkspace(params.id);

        if (!workspace) {
            return NextResponse.json(
                { error: 'ワークスペースが見つかりません' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            workspace
        });
    } catch (error) {
        console.error('ワークスペース取得エラー:', error);
        return NextResponse.json(
            { error: 'ワークスペースの取得に失敗しました' },
            { status: 500 }
        );
    }
}

// ワークスペース更新
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const body: UpdateWorkspaceRequest = await request.json();
        console.log('ワークスペース更新リクエスト:', params.id, body);
        
        // バリデーション
        if (!body.name?.trim()) {
            return NextResponse.json(
                { error: 'ワークスペース名は必須です' },
                { status: 400 }
            );
        }

        const updatedWorkspace = await updateWorkspace(params.id, {
            name: body.name.trim(),
            description: body.description?.trim() || undefined,
        });

        if (!updatedWorkspace) {
            return NextResponse.json(
                { error: 'ワークスペースが見つかりません' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            workspace: updatedWorkspace
        });
    } catch (error) {
        console.error('ワークスペース更新エラー:', error);
        return NextResponse.json(
            { error: 'ワークスペースの更新に失敗しました' },
            { status: 500 }
        );
    }
}

// ワークスペース削除
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const success = await deleteWorkspace(params.id);

        if (!success) {
            return NextResponse.json(
                { error: 'ワークスペースが見つかりません' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'ワークスペースを削除しました'
        });
    } catch (error) {
        console.error('ワークスペース削除エラー:', error);
        return NextResponse.json(
            { error: 'ワークスペースの削除に失敗しました' },
            { status: 500 }
        );
    }
}
