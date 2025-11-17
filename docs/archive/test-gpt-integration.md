# GPT-4o-mini Integration Test Guide

## Setup

1. **Backend Environment Variables**
   Add to `services/ai/.env`:
   ```
   OPENAI_API_KEY=your-openai-api-key-here
   ```

2. **Frontend Environment Variables** (Optional)
   Add to `apps/web/.env.local`:
   ```
   USE_GPT_V2=true  # To enable GPT-4o-mini by default
   ```

## Testing the Integration

### 1. Start the Backend
```bash
cd services/ai
python app.py
```

### 2. Start the Frontend
```bash
cd apps/web
npm run dev
```

### 3. Test Conversation Flow

Open the browser and navigate to `http://localhost:3000`

#### Test Case 1: Address Search
1. Type: "서울 강남구 역삼동 123번지"
2. Expected: GPT-4o-mini should detect this as an address and trigger the address search modal

#### Test Case 2: Contract Type Selection
1. After address is selected, type: "전세 계약 분석해줘"
2. Expected: GPT-4o-mini should detect "전세" and trigger the contract type selector

#### Test Case 3: General Question
1. Type: "전세가율이란 무엇인가요?"
2. Expected: GPT-4o-mini should provide a conversational answer without triggering any modal

#### Test Case 4: Comparison Request
1. Type: "강남구 역삼동과 서초구 반포동 아파트 비교해줘"
2. Expected: GPT-4o-mini should provide a comparison analysis without triggering modals

#### Test Case 5: Registry Upload
1. After address and contract type are set, type: "등기부 분석 시작"
2. Expected: GPT-4o-mini should trigger the registry upload modal

## Debugging

### Check Console Logs

**Frontend Console:**
- Look for: `[ChatInterface] Tool call received:` - This shows when tool calls are detected
- Look for: `[chat/route] Tool calls received from backend:` - This shows tool calls from the backend

**Backend Logs:**
- Look for: `Tool call:` - This shows when GPT-4o-mini invokes a function
- Look for: `GPT-4o-mini response:` - This shows the raw response from OpenAI

### Common Issues

1. **No tool calls triggered**
   - Check that `useGPTv2: true` is being sent in the request
   - Verify OpenAI API key is set correctly
   - Check backend logs for any errors

2. **Modal not opening**
   - Verify the tool call name matches the handler in ChatInterface.tsx
   - Check that the state machine transition is happening

3. **Backend connection error**
   - Ensure backend is running on port 8000
   - Check `AI_API_URL` in frontend `.env.local` is set to `http://localhost:8000`

## Tool Call Flow

1. User sends message
2. Frontend adds `useGPTv2: true` to request
3. Backend calls OpenAI GPT-4o-mini with Function Calling
4. GPT-4o-mini may return tool_calls in response
5. Backend returns tool_calls to frontend via SSE
6. Frontend parses tool calls and triggers appropriate UI modals

## Available Tools

- `search_address` - Opens address search modal
- `select_contract_type` - Opens contract type selector
- `input_price` - Opens price input form
- `upload_registry` - Opens registry upload modal
- `start_analysis` - Starts the analysis process

## Sample Tool Call Structure

```json
{
  "type": "OPEN_ADDRESS_MODAL",
  "data": {
    "keyword": "서울 강남구 역삼동",
    "purpose": "주소 검색",
    "index": 0
  }
}
```