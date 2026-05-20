import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { htmlContent } = await request.json();
    if (!htmlContent) {
      return NextResponse.json({ error: 'htmlContent is required' }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY || "AIzaSyDd1AZhuY6jylTKoCOfYqKpgYa5RX83fvs";

    // Call Gemini 1.5 Flash REST API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: "You are an expert translator specializing in university quality assurance and academic accreditation reports (YÖKAK, İAA). Translate the given report HTML from Turkish to English using official, professional, and academic vocabulary. You MUST STRICTLY preserve all HTML tags, structures, class names, links, table tags, and general layout. Translate ONLY the text inside the HTML tags. Return ONLY the translated HTML content without any markdown formatting, backticks, or additional explanations."
          }]
        },
        contents: [{
          parts: [{
            text: htmlContent
          }]
        }],
        generationConfig: {
          temperature: 0.1
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error Response:', errorText);
      return NextResponse.json({ error: 'Gemini translation service returned an error' }, { status: 502 });
    }

    const data = await response.json();
    const translatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!translatedText) {
      console.error('Gemini API Response Structure:', JSON.stringify(data));
      return NextResponse.json({ error: 'No translation content returned' }, { status: 500 });
    }

    // Clean up any markdown wraps if the model ignored instructions
    let cleanedHTML = translatedText.trim();
    if (cleanedHTML.startsWith('```html')) {
      cleanedHTML = cleanedHTML.replace(/^```html\s*/i, '').replace(/\s*```$/i, '');
    } else if (cleanedHTML.startsWith('```')) {
      cleanedHTML = cleanedHTML.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    }

    return NextResponse.json({ translatedHtml: cleanedHTML });
  } catch (error: any) {
    console.error('Translate Report Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
