import { NextRequest, NextResponse } from 'next/server';
import { updateQuestionTitles } from '@/lib/workspace';

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body: { titles: string[] } = await request.json();
        if (!body || !Array.isArray(body.titles)) {
            return NextResponse.json({ error: '不正なデータ' }, { status: 400 });
        }

        const updated = await updateQuestionTitles(id, body.titles);
        if (!updated) {
            return NextResponse.json({ error: 'ワークスペースが見つかりません' }, { status: 404 });
        }

        return NextResponse.json({ success: true, workspace: updated });
    } catch (e) {
        console.error('質問タイトル更新APIエラー', e);
        return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
    }
}
