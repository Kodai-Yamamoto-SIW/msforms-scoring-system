import { NextRequest, NextResponse } from 'next/server';
import * as workspaceLib from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body: { questionIndex: number; responseId: number; comment: string } = await request.json();
    if (
      typeof body.questionIndex !== 'number' ||
      typeof body.responseId !== 'number' ||
      typeof body.comment !== 'string'
    ) {
      return NextResponse.json({ error: '不正なコメントデータ' }, { status: 400 });
    }
    const workspace = await workspaceLib.upsertComment(id, body);
    if (!workspace) {
      return NextResponse.json({ error: 'ワークスペースが見つかりません' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('コメント保存エラー', e);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
