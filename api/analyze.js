// --- بخش جدید: افزایش مهلت زمانی اجرای تابع به ۴۵ ثانیه ---
export const maxDuration = 45; 

// این تابع به عنوان سرور امن شما عمل می‌کند
export default async function handler(request, response) {
    // --- بخش بهبود یافته: مدیریت هوشمند CORS برای دامنه‌های مجاز ---
    const allowedOrigins = [
        'https://trade-analyzer-brown.vercel.app', 
        'https://lockposht.com'
    ];
    const origin = request.headers.origin;
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    response.setHeader('Access-Control-Allow-Origin', corsOrigin);
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Vary', 'Origin');

    if (request.method === 'OPTIONS') {
        return response.status(204).end();
    }
    // --- پایان بخش بهبود یافته ---

    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // در نود جی‌اس، بدنه درخواست به صورت request.body در دسترس است
        const { image, prompt, mimeType } = request.body;
        const apiKey = process.env.GOOGLE_API_KEY;

        if (!apiKey) {
            throw new Error("کلید API گوگل در سرور تنظیم نشده است.");
        }
        
        const systemPrompt = `You are an expert technical analyst for financial markets. Your task is to analyze the user-provided chart image. First, provide a concise, actionable text analysis in PERSIAN based on the user's prompt. The analysis should identify key levels (support, resistance), trends, and potential trading signals (buy, sell, hold). Second, provide a JSON array of annotations to be drawn on the chart. The coordinate system is 1000x1000. Available annotation types are 'line', 'rect', and 'text'. You MUST return ONLY a valid JSON object with the following structure, without any markdown formatting: {"analysisText": "...", "annotations": [{"type": "line", "start": {"x":..., "y":...}, "end": {"x":..., "y":...}, "color": "yellow"}, ...]}`;

        const payload = {
            contents: [
                {
                    parts: [
                        { text: systemPrompt },
                        { text: `User request: ${prompt}` },
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: image
                            }
                        }
                    ]
                }
            ]
        };
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorBody = await apiResponse.json();
            console.error("Google API Error:", errorBody);
            throw new Error(`Google API Error: ${errorBody.error.message}`);
        }

        const data = await apiResponse.json();
        const textResponse = data.candidates[0].content.parts[0].text;
        
        // پاسخ موفقیت‌آمیز را به صورت JSON ارسال می‌کنیم
        return response.status(200).send(textResponse);

    } catch (error) {
        console.error('Server error:', error);
        return response.status(500).json({ error: error.message });
    }
}

