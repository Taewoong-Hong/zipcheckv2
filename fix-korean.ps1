# Fix Korean text corruption in ChatInterface.tsx
$file = "apps/web/components/chat/ChatInterface.tsx"
$content = Get-Content $file -Raw -Encoding UTF8

# Fix all corrupted Korean text
$content = $content -replace '\\?몄뀡 prop 諛쏄린', '세션 prop 받기'
$content = $content -replace '以묐났 \\?쒖텧 諛⑹\? \\?곹깭 異붽\\?', '중복 제출 방지 상태 추가'
$content = $content -replace '梨꾪똿 \\?붾㈃\\?먯꽌 \\?댁쟾 \\?\\?\\?ID瑜\\?\\?먮룞 蹂듦뎄\\?섎젮 \\?섎뒗\\?\\?', '채팅 화면에서 이전 대화 ID를 자동 복구하려 하는가'
$content = $content -replace 'Race condition 諛⑹\\?\\?\\?ref 異붽\\?', 'Race condition 방지용 ref 추가'
$content = $content -replace '\\?\\?\\?占쎌〈\\?\\?蹂닿컯', '세션 변경 모니터링'
$content = $content -replace '\\?대\\? 議댁옱\\?섎㈃ 諛붾줈 諛섑솚', '이미 존재하면 바로 반환'
$content = $content -replace '\\?좏깮\\?\\?二쇱냼:', '선택한 주소:'
$content = $content -replace '耳\\?댁뒪 \\?앹꽦 以\\?\\?ㅻ쪟媛 諛쒖깮\\?덉뒿\\?덈떎\\. \\?ㅼ떆 \\?쒕룄\\?댁＜\\?몄슂\\.', '케이스 생성 중 오류가 발생했습니다. 다시 시도해주세요.'
$content = $content -replace '怨꾩빟 \\?좏삎:', '계약 유형:'
$content = $content -replace '留ㅻℓ媛:', '매매가:'
$content = $content -replace '蹂댁쬆湲\\?', '보증금:'
$content = $content -replace '\\?붿꽭:', '월세:'
$content = $content -replace '\\?깃린遺\\?깅낯 諛쒓툒 \\?좎껌', '등기부등본 발급 선택'
$content = $content -replace '\\?깃린遺\\?깅낯 \\?낅줈\\?\\?', '등기부등본 업로드'
$content = $content -replace '\\?깃린遺\\?깅낯 諛쒓툒 湲곕뒫\\? \\?꾩쭅 援ы쁽\\?섏\\? \\?딆븯\\?듬땲\\?\\? PDF \\?뚯씪\\?\\?\\?낅줈\\?쒗빐二쇱꽭\\?\\?', '등기부등본 발급 기능은 아직 구현되지 않았습니다. PDF 파일을 업로드해주세요.'
$content = $content -replace '\\?깃린遺 泥섎━ 以\\?\\?ㅻ쪟媛 諛쒖깮\\?덉뒿\\?덈떎\\. \\?ㅼ떆 \\?쒕룄\\?댁＜\\?몄슂\\.', '등기부 처리 중 오류가 발생했습니다. 다시 시도해주세요.'
$content = $content -replace 'PDF瑜\\?\\?ㅼ떆 \\?낅줈\\?쒗빐 二쇱꽭\\?\\?', 'PDF를 다시 업로드해 주세요'
$content = $content -replace '遺꾩꽍 以\\?\\?ㅻ쪟媛 諛쒖깮\\?덉뒿\\?덈떎\\. \\?ㅼ떆 \\?쒕룄\\?댁＜\\?몄슂\\.', '분석 중 오류가 발생했습니다. 다시 시도해주세요.'
$content = $content -replace '以묐났 \\?쒖텧 諛⑹\\? \\\\\\(\\?붾컮\\?댁떛\\\\\\)', '중복 제출 방지 (디바운싱)'
$content = $content -replace '鍮꾨줈洹몄씤 \\?곹깭\\?먯꽌 濡쒓렇\\?\\?\\?좊룄', '비로그인 상태에서 로그인 시도'
$content = $content -replace '\\?\\?content瑜\\\?吏곸젒 \\?몄옄濡\\\?諛쏄굅\\?\\? inputValue \\?ъ슜', 'content를 직접 인자로 받거나 inputValue 사용'
$content = $content -replace '鍮\\?\\?낅젰\\?닿굅\\?\\? 濡쒕뵫 以묒씠硫\\\?early return', '빈 입력이거나 로딩 중이면 early return'
$content = $content -replace '\\?낅젰李\\\?利됱떆 \\?대━\\?\\?', '입력창 즉시 클리어'
$content = $content -replace '\\?쒖텧 以\\?\\?곹깭 \\?ㅼ젙 \\\\\\(500ms \\?숈븞 異붽\\? \\?쒖텧 李⑤떒\\\\\\)', '제출 중 상태 설정 (500ms 동안 추가 제출 차단)'
$content = $content -replace '梨꾪똿 \\?붾㈃\\?먯꽌 \\?댁쟾 \\?\\?\\?ID瑜\\?\\?먮룞 蹂듦뎄\\?섎젮 \\?섎뒗\\?\\?  // \\\\\\(\\?댁쟾 \\?몄뀡\\?\\?\\?곹깭媛 \\?⑥븘 二쇱냼 \\?④퀎瑜\\\?嫄대꼫\\?곕뒗 \\?댁뒋 諛⑹\\?\\\\\\)', '채팅 화면에서 이전 대화 ID를 자동 복구하려 하는가  // (이전 세션의 상태가 아닌 주소 선택을 건너뛰는 이슈 방지)'

# Save with UTF-8 encoding
$content | Set-Content $file -Encoding UTF8 -NoNewline
Write-Host "Korean text fixed successfully!"
