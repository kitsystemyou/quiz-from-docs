'use client';

import { useState } from 'react';
import { Button } from '../ui/button';

type Quiz = { question: string; answer: string };

export default function QuizPage() {
  const [text, setText] = useState('');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX_LEN = 1000;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      setText(content.slice(0, MAX_LEN));
    } catch (err) {
      setError('ファイルの読み込みに失敗しました。');
    }
  }

  async function handleGenerate() {
    const payload = text.trim().slice(0, MAX_LEN);
    if (!payload) {
      setError('テキストが空です。入力またはファイルをアップロードしてください。');
      return;
    }
    setLoading(true);
    setError(null);
    setQuizzes([]);
    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'APIエラーが発生しました');
      }
      const list: Quiz[] = Array.isArray(data?.quizzes) ? data.quizzes : [];
      setQuizzes(list.slice(0, 5));
    } catch (err: any) {
      setError(err?.message ?? '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-6 md:p-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">クイズ生成ツール(β)</h1>
          <p className="mt-2 text-sm text-gray-600">
            テキストファイルをアップロードするか、下の入力欄に最大{MAX_LEN}文字まで入力してください。ボタンを押すと本文から5問のクイズを生成します。
          </p>
        </header>

        <section className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">テキストファイルのアップロード (.txt)</label>
          <input
            type="file"
            accept=".txt,text/plain"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-900 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
          />
        </section>

        <section className="space-y-2">
          <label htmlFor="quiz-text" className="block text-sm font-medium text-gray-700">
            入力欄（最大{MAX_LEN}文字）
          </label>
          <textarea
            id="quiz-text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
            rows={10}
            maxLength={MAX_LEN}
            placeholder="ここに本文を入力するか、ファイルをアップロードしてください。"
            className="block w-full rounded-md border border-gray-300 bg-white p-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>文字数: {text.length} / {MAX_LEN}</span>
            {loading ? <span className="text-blue-600">生成中...</span> : null}
          </div>
        </section>

        <div className="flex gap-3">
          <Button
            onClick={handleGenerate}
            disabled={loading || text.trim().length === 0}
            aria-disabled={loading || text.trim().length === 0}
          >
            {loading ? '生成中...' : 'クイズを作成'}
          </Button>
          <Button
            onClick={() => { setText(''); setQuizzes([]); setError(null); }}
            className="bg-gray-500 hover:bg-gray-400 focus-visible:outline-gray-500 active:bg-gray-600"
          >
            クリア
          </Button>
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="space-y-3">
          {quizzes.length > 0 && (
            <>
              <h2 className="text-lg font-semibold">生成結果（5問まで）</h2>
              <ol className="space-y-4">
                {quizzes.map((q, idx) => (
                  <li key={idx} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="font-medium">Q{idx + 1}. {q.question}</p>
                    <p className="mt-2 text-sm text-gray-700">
                      <span className="rounded bg-green-50 px-2 py-1 font-semibold text-green-700">答え</span>{' '}
                      {q.answer}
                    </p>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
