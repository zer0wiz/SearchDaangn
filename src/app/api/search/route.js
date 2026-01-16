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

                // Parse JSON-LD structured data
                const jsonLdScript = $('script[type="application/ld+json"]').html();
                if (jsonLdScript) {
                    try {
                        const jsonLdData = JSON.parse(jsonLdScript);
                        if (jsonLdData.itemListElement && Array.isArray(jsonLdData.itemListElement)) {
                            jsonLdData.itemListElement.forEach((listItem) => {
                                const product = listItem.item;
                                if (product && product.name && product.url) {
                                    const price = product.offers?.price !== undefined && product.offers?.price !== null
                                        ? `${Number(product.offers.price).toLocaleString()}원`
                                        : '';
                                    items.push({
                                        id: product.url.split('/').filter(Boolean).pop() || Math.random().toString(),
                                        title: product.name,
                                        price,
                                        regionName: region.name3,
                                        img: product.image,
                                        link: product.url,
                                        originalRegion: region
                                    });
                                }
                            });
                        }
                    } catch (parseError) {
                        console.error('JSON-LD parsing error:', parseError);
                    }
                }

                return items;
            } catch (err) {
                console.error(`Error scraping for region ${region.name3}:`, err);
                return [];
            }
        });

        const results = await Promise.all(promises);

        // Flatten results
        const allItems = results.flat();

        // Deduplicate items based on link (same item might appear in adjacent regions)
        const uniqueItems = Array.from(new Map(allItems.map(item => [item.link || item.id, item])).values());

        return NextResponse.json({ items: uniqueItems });

    } catch (error) {
        console.error('Search API Error:', error);
        return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
    }
}
