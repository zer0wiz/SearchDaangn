import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function POST(request) {
    try {
        const { regions, keyword } = await request.json();

        if (!regions || regions.length === 0 || !keyword) {
            return NextResponse.json({ items: [] });
        }

        const promises = regions.map(async (region) => {
            try {
                // Construct URL: https://www.daangn.com/kr/buy-sell/?in={name3}-{id}&only_on_sale=true&search={keyword}
                const locationQuery = `${region.name3}-${region.id}`;
                const encodedKeyword = encodeURIComponent(keyword);
                const url = `https://www.daangn.com/kr/buy-sell/?in=${locationQuery}&only_on_sale=true&search=${encodedKeyword}`;

                const response = await axios.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
                    }
                });

                const $ = cheerio.load(response.data);
                const items = [];

                // Parse article elements
                $('article').each((_, element) => {
                    const $el = $(element);

                    const title = $el.find('.card-title').text().trim();
                    const price = $el.find('.card-price').text().trim();
                    const regionName = $el.find('.card-region-name').text().trim();
                    const link = $el.find('a.card-link').attr('href');
                    const img = $el.find('img').attr('src');

                    if (title && price) {
                        items.push({
                            id: link ? link.split('/').pop() : Math.random().toString(), // Extract ID from link
                            title,
                            price,
                            regionName,
                            img,
                            link: link ? `https://www.daangn.com${link}` : null,
                            originalRegion: region // Tag with the region that found this
                        });
                    }
                });

                return items;
            } catch (err) {
                console.error(`Error scraping for region ${region.name3}:`, err);
                return [];
            }
        });

        const results = await Promise.all(promises);

        // Flatten results
        const allItems = results.flat();

        // Deduplicate items based on link/id (same item might appear in adjacent regions)
        const uniqueItems = Array.from(new Map(allItems.map(item => [item.link, item])).values());

        return NextResponse.json({ items: uniqueItems });

    } catch (error) {
        console.error('Search API Error:', error);
        return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
    }
}
