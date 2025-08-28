import { NextRequest, NextResponse } from 'next/server';
import * as workspaceLib from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;
        const body: { questionIndex: number; responseId: number; criterionId: string; value: boolean | null } = await request.json();

        if (
            typeof body.questionIndex !== 'number' ||
            typeof body.responseId !== 'number' ||
            typeof body.criterionId !== 'string' ||
            !(typeof body.value === 'boolean' || body.value === null)
        ) {
            return NextResponse.json({ error: '不正な採点データ' }, { status: 400 });
        }

        const workspace = await workspaceLib.upsertScores(id, body);
        if (!workspace) {
            return NextResponse.json({ error: 'ワークスペースが見つかりません' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('スコア保存エラー', e);
        return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
    }
}
