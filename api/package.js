export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const { imageData, imageType, userPrompt, originalDimensions } = await req.json();
        const apiKey = process.env.GOOGLE_API_KEY;

        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'API key is not configured on the server.' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const prompt = `شما یک تحلیلگر حرفه‌ای بازارهای مالی هستید. وظیفه شما تحلیل تکنیکال نموداری است که کاربر ارسال می‌کند و ارائه یک تحلیل متنی و مجموعه‌ای از دستورالعمل‌ها برای رسم تحلیل روی تصویر است.
        پاسخ شما باید فقط و فقط یک آبجکت JSON معتبر باشد. هیچ متن اضافی، توضیحات یا فرمت markdown خارج از آبجکت JSON قرار ندهید.

        ساختار JSON باید به این صورت باشد:
        {
          "analysisText": "تحلیل متنی شما در اینجا...",
          "annotations": [
            { "type": "line", "color": "red", "startX": 100, "startY": 50, "endX": 800, "endY": 50 },
            { "type": "text", "color": "white", "x": 450, "y": 70, "text": "Resistance Level" }
          ]
        }

        **دستورالعمل تحلیل متنی:**
        تحلیل شما باید دقیق و بی‌طرفانه باشد و شامل:
        1.  **روند فعلی**: صعودی، نزولی یا خنثی.
        2.  **سطوح کلیدی**: مهم‌ترین سطوح حمایت و مقاومت.
        3.  **الگوها**: الگوهای قیمتی یا شمعی مهم.
        4.  **نتیجه‌گیری و سیگنال**: سیگنال واضح برای خرید (Buy)، فروش (Sell) یا انتظار (Wait).
        
        **دستورالعمل تحلیل تصویری (Annotations):**
        مجموعه‌ای از آبجکت‌ها را برای رسم روی نمودار ارائه دهید. مختصات باید بر اساس ابعاد تصویر اصلی (w: ${originalDimensions.w}, h: ${originalDimensions.h}) باشد.
        - برای خطوط (حمایت، مقاومت، روند): از نوع 'line' با رنگ 'green' برای حمایت و 'red' برای مقاومت استفاده کنید.
        - برای نوشتن متن روی نمودار: از نوع 'text' با رنگ 'white' یا 'yellow' استفاده کنید.
        - برای هایلایت کردن یک ناحیه: از نوع 'rect' با رنگ 'rgba(255, 255, 0, 0.2)' (زرد نیمه‌شفاف) استفاده کنید.
        
        متن کاربر: "${userPrompt}"`;

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        const payload = {
            contents: [{
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: imageType, data: imageData } }
                ]
            }]
        };

        const googleResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const rawResponseText = await googleResponse.text();
        
        if (!googleResponse.ok) {
            console.error("Google API Error:", rawResponseText);
            return new Response(JSON.stringify({ error: `خطا از سرور گوگل: ${googleResponse.statusText}` }), {
                status: googleResponse.status,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        const result = JSON.parse(rawResponseText);
        const part = result.candidates?.[0]?.content?.parts?.[0];

        if (!part || !part.text) {
             console.error("Unexpected API response structure:", rawResponseText);
             return new Response(JSON.stringify({ error: "ساختار پاسخ دریافتی از گوگل نامعتبر است." }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        let jsonText = part.text;
        
        if (jsonText.includes("```json")) {
            jsonText = jsonText.split("```json")[1].split("```")[0];
        }
        
        const firstBrace = jsonText.indexOf('{');
        const lastBrace = jsonText.lastIndexOf('}');
        
        if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
            console.error("Could not find valid JSON object in text:", jsonText);
            return new Response(JSON.stringify({ error: "پاسخ دریافتی فرمت JSON معتبر نداشت." }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        jsonText = jsonText.substring(firstBrace, lastBrace + 1);

        // اعتبارسنجی نهایی JSON قبل از ارسال به کاربر
        JSON.parse(jsonText);

        return new Response(jsonText, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Server Error:", error);
        return new Response(JSON.stringify({ error: 'یک خطای داخلی در سرور رخ داد.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
