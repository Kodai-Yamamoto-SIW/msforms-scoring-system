import { NextRequest, NextResponse } from 'next/server';
import { getWorkspace, deleteWorkspace } from '@/lib/workspace';

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
