import { NextRequest, NextResponse } from 'next/server';
import { updateScoringCriteria } from '@/lib/workspace';
import { QuestionScoringCriteria } from '@/types/forms';

// 採点基準の更新
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body: { criteria: QuestionScoringCriteria[] } = await request.json();
        console.log('採点基準更新リクエスト:', id);

        // バリデーション
        if (!body.criteria || !Array.isArray(body.criteria)) {
            return NextResponse.json(
                { error: '採点基準データが不正です' },
                { status: 400 }
            );
        }

        const updatedWorkspace = await updateScoringCriteria(id, body.criteria);

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
        console.error('採点基準更新エラー:', error);
        return NextResponse.json(
            { error: '採点基準の更新に失敗しました' },
            { status: 500 }
        );
    }
}
