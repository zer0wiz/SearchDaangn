import { NextResponse } from 'next/server';
import axios from 'axios';

// 상대 시간 계산 함수
function getTimeAgo(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) return '방금 전';
    if (diffMin < 60) return `${diffMin}분 전`;
    if (diffHour < 24) return `${diffHour}시간 전`;
    return `${diffDay}일 전`;
}

export async function POST(request) {
    try {
        const { region, keyword } = await request.json();

        if (!region || !keyword) {
            return NextResponse.json({ items: [], regionId: region?.id });
        }

        try {
            const locationQuery = `${region.name3}-${region.id}`;
            const encodedKeyword = encodeURIComponent(keyword);
            // JSON API 엔드포인트 사용
            const url = `https://www.daangn.com/kr/buy-sell/?in=${locationQuery}&only_on_sale=true&search=${encodedKeyword}&_data=routes%2Fkr.buy-sell._index`;

            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Accept': 'application/json'
                }
            });

            const items = [];
            const data = response.data;
            const articles = data?.allPage?.fleamarketArticles || [];

            articles.forEach((article) => {
                if (article && article.title && article.href) {
                    const price = article.price 
                        ? `${Number(article.price).toLocaleString()}원`
                        : '';
                    
                    // boostedAt이 있으면 끌올 시간, 없으면 createdAt 사용
                    const isBoosted = article.boostedAt && article.boostedAt !== article.createdAt;
                    const timeDate = article.boostedAt || article.createdAt;
                    const timeAgo = isBoosted 
                        ? `끌올 ${getTimeAgo(timeDate)}`
                        : getTimeAgo(timeDate);
                    
                    items.push({
                        id: article.id || Math.random().toString(),
                        title: article.title,
                        price,
                        regionName: article.region?.name || region.name3,
                        img: article.thumbnail,
                        link: article.href,
                        originalRegion: region,
                        timeAgo,
                        content: article.content || ''
                    });
                }
            });

            return NextResponse.json({ 
                items, 
                regionId: region.id,
                completedAt: new Date().toISOString()
            });
        } catch (err) {
            console.error(`Error fetching for region ${region.name3}:`, err);
            return NextResponse.json({ 
                items: [], 
                regionId: region.id,
                error: err.message 
            });
        }

    } catch (error) {
        console.error('Search Single API Error:', error);
        return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
    }
}
