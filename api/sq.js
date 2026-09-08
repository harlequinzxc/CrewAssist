export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { endpoint, payload } = req.body;
    
    if (!endpoint || (endpoint !== 'getcabin' && endpoint !== 'menu')) {
        return res.status(400).json({ error: 'Invalid endpoint' });
    }

    const targetUrl = `https://cifp.auto.prod.c0.singaporeair.com/api/${endpoint}`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds timeout

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'https://inflightmenu.singaporeair.com',
                'Referer': 'https://inflightmenu.singaporeair.com/',
                'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const data = await response.json();
        
        return res.status(200).json(data);
    } catch (error) {
        if (error.name === 'AbortError') {
            return res.status(504).json({ error: 'UPSTREAM_TIMEOUT' });
        }
        return res.status(502).json({ error: 'UPSTREAM_NETWORK', details: error.message });
    }
}