# 당특순 CS 시스템 사양서 (SSOT 기반)

본 문서는 현재 코드베이스(Next.js, Prisma, Postgres)와 동작을 일치시키기 위해 작성한 최신 사양서입니다. 레거시 문서/설계는 제거하고, 아래 내용을 단일 기준으로 삼습니다.

## 1. 전체 UX 플로우
- 고객 최초 진입: `/chatbot` (FAQ RAG 기반 챗봇)
  - 답변 성공: FAQ 내용 기반 안내 (+ 서비스 질문 시 `/docs` 링크 포함)
  - 정보 부족/지원 불가: FAQ 링크 없이 `/support`로 문의 유도
- FAQ 문서 뷰어: `/docs` (SSOT)
  - 카테고리 칩/검색/섹션 스크롤
  - 하단 플로팅 버튼 “관리자에게 문의하기” → `/support`
- 직접 문의: `/support`
  - 새 대화 생성 → 2초 폴링으로 관리자 답변 수신
- 관리자: `/admin`
  - 탭 1: 실시간 문의(대화 목록/조회/응답)
  - 탭 2: FAQ 생성/관리 (LLM 생성, 테이블/카테고리 뷰, 편집/삭제)
  - 탭 3: 카테고리 관리 (추가/수정/삭제)

## 2. 데이터 모델 (Prisma)
- `FAQArticle` (id, category, categoryId, title, content, sourceType, confidence, createdAt/updatedAt)
- `Category` (id, name, createdAt)
- `Conversation` (id, status, createdAt/updatedAt)
- `Message` (id, conversationId, role["user"|"admin"], content, createdAt)

## 3. 주요 API
- FAQ
  - `POST /api/faq/generate-from-logs` : LLM 기반 FAQ 생성 (RAG 아님)
  - `GET /api/faq/list` : FAQ 조회 (query/category)
  - `PUT/DELETE /api/faq/[id]`, `POST /api/faq/delete-bulk`
  - 카테고리: `GET/POST/PUT/DELETE /api/category/*`
- 챗봇 (/chatbot)
  - `POST /api/chatbot` : /docs FAQ를 RAG 컨텍스트로 LLM 호출 (SYSTEM_PROMPT 포함)
- 고객 문의 (/support)
  - `POST /api/chat` : 새 대화 생성 + 첫 메시지 저장
  - `GET /api/chat?conversation_id&since_id` : 메시지 폴링
  - `PUT /api/chat` : 메시지 전송(role=user/admin)
  - `GET /api/chat/conversations` : 대화 목록(관리자)

## 4. 챗봇 설계 (/chatbot)
- 소스: `lib/chatbot.ts`
- SYSTEM_PROMPT: “당특순 CS 챗봇” 페르소나/톤/행동 규칙
  - 서비스 질문 시 FAQ 링크 포함 (`/docs`)
  - 정보 부족/모호/지원 불가 시 `/support`로 안내
- RAG:
  - FAQ 전수조회 → 유사도 + 부분문자열 부스팅 → 상위 6개(낮은 스코어면 최대 12개) 컨텍스트 전달
  - FAQ 링크/Support 링크 환경변수: `NEXT_PUBLIC_SITE_BASE` 기준 기본 `/docs`, `/support`
  - LLM: `LLM_MODEL`, `LLM_API_BASE`, `OPENAI_API_KEY`

## 5. 고객 문의 흐름 (/support ↔ /admin)
- 고객 `/support`:
  - “문의 시작” → `POST /api/chat` → conversationId 획득 → 2초 폴링으로 수신
  - 메시지 전송: `PUT /api/chat`
- 관리자 `/admin` 탭 “실시간 문의”:
  - 대화 목록: `GET /api/chat/conversations`
  - 메시지 폴링: `GET /api/chat?conversation_id&since_id`
  - 답변 전송: `PUT /api/chat` (role=admin)

## 6. FAQ 생성/관리 (/admin 탭)
- LLM 생성: `/api/faq/generate-from-logs`
  - 중복/프로젝트 개념 제거, 카테고리 자동 매핑(유사도)
  - 신뢰도 미만 스킵, skippedDuplicates=0 (현재 dedup 없음)
- 리스트/검색/필터, 카드/테이블/카테고리 뷰, 편집/삭제/선택 삭제

## 7. 카테고리 관리 (/admin 탭)
- 전역 카테고리 CRUD (`/api/category/*`)
- 생성/이름 변경/삭제

## 8. SSOT 명시
- `/docs`가 FAQ의 단일 진실 공급원(SSOT)
- 챗봇 RAG, 고객문의, 관리자 FAQ 모두 동일 DB(`FAQArticle`, `Category`)
- 코드에 SSOT 주석: `app/docs/page.tsx`

## 9. 환경 변수
- `DATABASE_URL` (예: postgresql://isihyeon@localhost:5432/channeltalk)
- `OPENAI_API_KEY`, `LLM_API_BASE`, `LLM_MODEL`, `LLM_CONFIDENCE_THRESHOLD`
- `NEXT_PUBLIC_SITE_BASE` (FAQ/Support 링크 구성)

## 10. 실행/개발
```bash
# DB (새 데이터 디렉터리 예시)
/opt/homebrew/opt/postgresql@15/bin/pg_ctl -D ~/pgdata15 start

# Prisma
npx prisma db push --accept-data-loss
npx prisma generate

# Dev
npm run dev -- --port 3000
```

## 11. 확인 포인트
- /chatbot → FAQ 답변 + 정보 부족 시 /support 안내
- /docs → 카테고리 칩/검색/섹션 스크롤, 플로팅 문의 버튼
- /support ↔ /admin “실시간 문의” 탭: 메시지 송수신/폴링
- /admin 탭 전환: 실시간 문의 / FAQ / 카테고리 정상 동작
