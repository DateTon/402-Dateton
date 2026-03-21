// app/api/matches/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getContractState } from "@/lib/contract";

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const state = await getContractState(params.id);
        return NextResponse.json(state);
    } catch (e: any) {
        return NextResponse.json(
            { error: e.message },
            { status: 500 }
        );
    }
}
