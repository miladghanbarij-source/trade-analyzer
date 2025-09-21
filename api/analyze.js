export const config = {
    runtime: 'edge',
};

// این تابع به عنوان سرور امن شما عمل می‌کند
export default async function handler(request) {
    // --- بخش بهبود یافته: مدیریت هوشمند CORS برای دامنه‌های مجاز ---
    const allowedOrigins = [
        'https://trade-analyzer-brown.vercel.app', 
        'https://lockposht.com'
    ];
    const origin = request.headers.get('origin');
    // اگر دامنه درخواست‌کننده در لیست مجاز باشد، به آن اجازه دسترسی داده می‌شود
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    const corsHeaders = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin', // برای مدیریت صحیح کش توسط مرورگر
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }
    // --- پایان بخش بهبود یافته ---

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        const { image, prompt, mimeType } = await request.json();
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

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error("Google API Error:", errorBody);
            throw new Error(`Google API Error: ${errorBody.error.message}`);
        }

        const data = await response.json();
        const textResponse = data.candidates[0].content.parts[0].text;
        
        return new Response(textResponse, {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Server error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}

