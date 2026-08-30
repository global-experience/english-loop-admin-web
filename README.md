# Loopine Admin

피드 후보 수집과 검수를 위한 독립 Next.js 관리자 앱입니다. 사용자 PWA(`loopine`) 및 FastAPI(`loopine-server-api`)와 별도 저장소·배포 단위로 관리합니다.

## 로컬 실행

```bash
cp .env.example .env.local
npm install
npm run dev
```

관리자 앱은 `http://localhost:3001`에서 실행됩니다. 최초 접속 전에는 백엔드 환경변수 `ADMIN_EMAILS`에 첫 관리자 로그인 이메일을 등록해 두세요. 한 번 접속하면 `admin_members` 테이블에 관리자 권한이 생성되고, 이후 권한 관리는 어드민 화면의 사용자 탭에서 합니다.

## Vercel

이 폴더를 `loopine-admin` 저장소 루트로 푸시한 뒤 별도 Vercel 프로젝트로 연결합니다.

```env
NEXT_PUBLIC_API_BASE_URL=/backend
API_PROXY_ORIGIN=https://loopine-server-api.onrender.com
```

백엔드 Render 환경에는 다음 값을 추가합니다.

```env
ADMIN_EMAILS=your-login-email@example.com # 최초 관리자 부트스트랩용
YOUTUBE_DATA_API_KEY=your-youtube-data-api-key
FEED_COLLECTOR_SECRET=long-random-secret
FEED_DEFAULT_REGION_CODE=US
FEED_COLLECTION_MAX_VIDEOS=100
```

자동 수집 스케줄러는 하루 한 번 아래 요청을 호출하면 됩니다.

```bash
curl -X POST https://loopine-server-api.onrender.com/internal/feed/collect \
  -H "Content-Type: application/json" \
  -H "X-Feed-Collector-Secret: $FEED_COLLECTOR_SECRET" \
  -d '{"limit":100}'
```
