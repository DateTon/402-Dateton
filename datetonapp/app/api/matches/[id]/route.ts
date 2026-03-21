// app/api/matches/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getContractState } from "@/lib/contract";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const state = await getContractState(id);
        return NextResponse.json(state);
    } catch (e: any) {
        return NextResponse.json(
            { error: e.message },
            { status: 500 }
        );
    }
}
