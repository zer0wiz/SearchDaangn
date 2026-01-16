import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword');

    if (!keyword) {
        return NextResponse.json({ locations: [] });
    }

    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const url = `https://www.daangn.com/v1/api/search/kr/location?keyword=${encodedKeyword}`;

        const response = await axios.get(url);

        // We can filter or transform here if needed, but Daangn returns standard structure.
        // Ensure we only return necessary fields to minimize data payload if we want,
        // but forwarding filtering is safe.

        return NextResponse.json(response.data);
    } catch (error) {
        console.error('Daangn Location API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }
}
