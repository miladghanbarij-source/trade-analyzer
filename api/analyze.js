export const config = {
    runtime: 'edge',
};

// این تابع به عنوان سرور امن شما عمل می‌کند
export default async function handler(request) {
    // --- بخش جدید: اضافه کردن هدرهای CORS ---
    // این هدرها به مرورگر اجازه می‌دهند تا از دامنه‌های دیگر به این API دسترسی داشته باشد
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*', // به همه دامنه‌ها اجازه می‌دهد. برای امنیت بیشتر می‌توانید 'https://lockposht.com' را جایگزین کنید
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    // مرورگرها قبل از ارسال درخواست اصلی، یک درخواست اولیه به نام OPTIONS می‌فرستند
    // این بخش به آن درخواست اولیه پاسخ مثبت می‌دهد
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }
    // --- پایان بخش جدید ---


    // بررسی می‌کند که درخواست از نوع POST باشد
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
        
        // پاسخ نهایی را به همراه هدرهای CORS به کاربر برمی‌گرداند
        return new Response(textResponse, {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Server error:', error);
        // در صورت بروز خطا، آن را به همراه هدرهای CORS برمی‌گرداند
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}

