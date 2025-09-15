/**
 * POST /api/quiz
 * Body: { text: string }
 * Returns: { quizzes: { question: string; answer: string }[] }
 */
export async function POST(request: Request) {
  try {
    const { text } = (await request.json()) as { text?: string };

    if (!text || typeof text !== 'string') {
      return Response.json({ error: 'text is required' }, { status: 400 });
    }

    const trimmed = text.trim().slice(0, 1000);
    if (!trimmed) {
      return Response.json({ error: 'text must not be empty' }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'Missing OpenAI API key in environment (set NEXT_PUBLIC_OPENAI_API_KEY or OPENAI_API_KEY)' },
        { status: 500 },
      );
    }

    // Construct a strict JSON-only prompt (Japanese)
    const systemPrompt =
      'あなたは与えられた本文だけを根拠として日本語のクイズを作成するアシスタントです。出力は必ずJSONのみで、説明文や前後のテキストは一切含めないでください。';
    const userPrompt = [
      '次の本文から、内容に基づいた日本語のクイズを5問作成してください。',
      '出力は次のJSONオブジェクト形式にしてください（配列は"quizzes"プロパティに入れる）:',
      '',
      '{',
      '  "quizzes": [',
      '    { "question": "質問文", "answer": "模範解答（簡潔に）" },',
      '    { "question": "質問文", "answer": "模範解答（簡潔に）" },',
      '    { "question": "質問文", "answer": "模範解答（簡潔に）" },',
      '    { "question": "質問文", "answer": "模範解答（簡潔に）" },',
      '    { "question": "質問文", "answer": "模範解答（簡潔に）" }',
      '  ]',
      '}',
      '',
      '要件:',
      '- 絶対に有効なJSONオブジェクトのみを出力（前後の説明やコードブロック禁止）',
      '- 各question/answerは本文の情報に基づくこと',
      '- 質問は簡潔に、答えも簡潔に',
      '',
      '本文:',
      trimmed,
    ].join('\n');

    // Use Chat Completions API via fetch (no SDK dependency)
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' as const }, // encourage strict JSON
      }),
    });

    if (!openaiRes.ok) {
      const errTxt = await openaiRes.text().catch(() => '');
      return Response.json(
        { error: 'OpenAI API error', details: errTxt || openaiRes.statusText },
        { status: 500 },
      );
    }

    const data = await openaiRes.json();

    // Depending on response_format, content might be JSON string or object
    const content: string =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ??
      '';

    // Try to parse quizzes. The strict prompt should return an array, but also handle object wrapping.
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to extract JSON array substring as last resort
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        return Response.json(
          { error: 'Failed to parse model output', raw: content },
          { status: 500 },
        );
      }
    }

    // Normalize into array of {question, answer}
    type QA = { question: string; answer: string };
    let quizzes: QA[] = [];

    if (Array.isArray(parsed)) {
      quizzes = parsed
        .map((x) => {
          if (x && typeof x === 'object' && 'question' in x && 'answer' in x) {
            const q = (x as any).question;
            const a = (x as any).answer;
            if (typeof q === 'string' && typeof a === 'string') {
              return { question: q, answer: a };
            }
          }
          return null;
        })
        .filter(Boolean) as QA[];
    } else if (
      parsed &&
      typeof parsed === 'object' &&
      'quizzes' in (parsed as any) &&
      Array.isArray((parsed as any).quizzes)
    ) {
      quizzes = (parsed as any).quizzes
        .map((x: any) => {
          if (x && typeof x === 'object' && 'question' in x && 'answer' in x) {
            const q = x.question;
            const a = x.answer;
            if (typeof q === 'string' && typeof a === 'string') {
              return { question: q, answer: a };
            }
          }
          return null;
        })
        .filter(Boolean);
    }

    if (!quizzes.length) {
      return Response.json(
        { error: 'No quizzes generated', raw: content },
        { status: 500 },
      );
    }

    // Ensure at most 5
    quizzes = quizzes.slice(0, 5);

    return Response.json({ quizzes });
  } catch (error: any) {
    return Response.json(
      { error: 'Unexpected server error', details: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}
