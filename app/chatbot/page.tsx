"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { Send, RefreshCw, X } from "lucide-react";

type Message = { id: string; role: "user" | "assistant"; text: string; timestamp: string };

export default function ChatbotPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const typeOutAssistant = (fullText: string) => {
    const id = crypto.randomUUID();
    const timestamp = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { id, role: "assistant", text: "", timestamp }]);

    let i = 0;
    const tick = () => {
      i++;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], text: fullText.slice(0, i) };
        return next;
      });
      if (i < fullText.length) {
        requestAnimationFrame(tick);
      }
    };
    tick();
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (loading) return;
    if (isComposing) return;

    if (!hasStarted) setHasStarted(true);

    setError(null);
    const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text: trimmed, timestamp: now },
    ]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "챗봇 호출 실패");
      }
      const data = await res.json();
      const reply = data?.answer ?? "답변을 불러오지 못했습니다.";
      typeOutAssistant(reply);
    } catch (e: any) {
      console.error(e);
      setError("답변을 불러오지 못했습니다.");
      typeOutAssistant("죄송합니다. 잠시 응답이 지연되고 있습니다. 다시 시도해 주시겠어요?");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (confirm("대화 내용을 모두 지우고 처음으로 돌아가시겠습니까?")) {
      setMessages([]);
      setHasStarted(false);
      setInput("");
      setError(null);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-white text-gray-900 relative overflow-hidden font-sans">
      {/* Top Black Bar (Simulated Window Control / App Header) */}
      <div className="bg-black text-white px-6 py-3 flex justify-between items-center shrink-0 w-full z-50 relative">
        <div />
        <div className="flex gap-4">
          <button onClick={handleRefresh} className="hover:text-gray-300 transition-colors">
            <RefreshCw size={20} />
          </button>
          <button className="hover:text-gray-300 transition-colors">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col items-center w-full max-w-4xl mx-auto px-4 transition-all duration-500 ease-in-out ${hasStarted ? "justify-end pb-4" : "justify-center gap-10"}`}>

        {/* Landing Content - Fades out or moves up when started */}
        {!hasStarted && (
          <div className="flex flex-col items-center gap-6 text-center animate-in fade-in zoom-in duration-700 w-full mb-4">

            {/* Logo Bubble */}
            <div className="h-16 w-16 rounded-full bg-black flex items-center justify-center text-white font-bold text-lg shadow-xl z-10 relative left-[-30px]">
              QnA
            </div>

            {/* Hero Section */}
            <div className="flex items-center justify-center gap-5 text-2xl md:text-3xl font-bold tracking-tight text-gray-800 w-full">
              <span className="text-right whitespace-nowrap">카피챗에게</span>
              <div className="relative w-32 h-32 md:w-44 md:h-44 flex-shrink-0 rounded-full overflow-hidden border border-gray-100 shadow-sm mx-1">
                <Image
                  src="/capychat_mascot.png"
                  alt="Capychat Mascot"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <span className="text-left whitespace-nowrap">모두 물어보세요!</span>
            </div>
          </div>
        )}

        {/* Chat List (Only visible when started) */}
        {hasStarted && (
          <div className="w-full flex-1 overflow-y-auto px-2 py-4 space-y-6 scrollbar-hide">
            {messages.map((m) => (
              <div key={m.id} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] md:max-w-[70%] rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed shadow-sm
                     ${m.role === 'user'
                    ? 'bg-gray-900 text-white rounded-tr-sm'
                    : 'bg-gray-100 text-gray-800 rounded-tl-sm border border-gray-200'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start w-full">
                <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-5 py-4 border border-gray-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input Area */}
        <div className={`w-full relative transition-all duration-500 ease-in-out ${hasStarted ? "mb-2 max-w-3xl" : "mb-0 max-w-2xl"}`}>
          <div className="relative group">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  handleSend();
                }
              }}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder={hasStarted ? "메시지를 입력하세요..." : "궁금한 내용은 무엇이든 물어보세요! ☝️"}
              className={`w-full py-4 pl-6 pr-14 text-base bg-white border border-gray-200 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.08)] 
                outline-none focus:border-gray-400 focus:shadow-[0_4px_25px_rgba(0,0,0,0.12)] transition-all placeholder:text-gray-400
                ${hasStarted ? "text-gray-800" : "text-center md:text-left text-gray-600"}`}
              style={{ textAlign: hasStarted ? 'left' : 'center' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-gray-900 text-white rounded-full hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-gray-900 transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="py-4 text-center shrink-0">
        <p className="text-[11px] text-gray-400 font-medium">
          Powered by <span className="text-gray-600 font-semibold">capychat.ai</span>
        </p>
      </footer>
    </div>
  );
}
