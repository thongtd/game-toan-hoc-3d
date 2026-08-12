# Bàn giao phiên làm việc — 13/08/2026

Tài liệu để tiếp tục công việc trên máy khác. Đọc file này trước, rồi mở
[`YEU_CAU_HE_THONG_5_MAP_VA_TOC_DO_GAME.md`](./YEU_CAU_HE_THONG_5_MAP_VA_TOC_DO_GAME.md)
để đối chiếu đặc tả.

---

## 1. Đã làm gì trong phiên này

### 1.1. Hệ thống 5 bản đồ (mới)

| Thành phần                                                            | File                                                                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Manifest 5 map dùng chung web + server                                | `shared/maps/map-manifest.ts`                                                                                       |
| Ngẫu nhiên thông minh (không lặp, ưu tiên map ít chơi, RNG tiêm được) | `shared/maps/smart-random.ts`                                                                                       |
| MapManager: dynamic import, timeout 5 s, dispose, đổi palette         | `src/game/maps/MapManager.ts`                                                                                       |
| Khối dựng cảnh dùng chung + pool segment + particle                   | `src/game/maps/primitives.ts`, `MapSegmentPool.ts`, `MapParticles.ts`, `createProceduralMap.ts`, `map-materials.ts` |
| 5 map, mỗi map ≥ 5 segment + landmark                                 | `src/game/maps/<mapId>/segments.ts` + `create*.ts`                                                                  |
| Scene dự phòng (không phụ thuộc file ngoài)                           | `src/game/maps/fallback-map.ts`                                                                                     |
| Bộ chọn map trên Home                                                 | `src/ui/components/MapSelector.ts`, `src/styles/maps.css`                                                           |
| Lưu lựa chọn + cache thống kê map                                     | `src/player/map-preference.ts`                                                                                      |

**Quyết định quan trọng:** cảnh vật 5 map được dựng hoàn toàn bằng Three.js
primitives, **không tải model ngoài** → 0 MB asset thêm, không rủi ro giấy phép,
mỗi map là một chunk JS riêng 2–3 KB (đã kiểm chứng bằng output của `npm run build`).

### 1.2. Tốc độ theo điểm (thay cơ chế cũ)

- `shared/scoring/speed-config.ts`: `7.5 + floor(score/300) × 0.75`, trần cứng `11.25`,
  6 bậc, chuyển mượt `0.65 s`, `gateDistanceForQuestion()` bảo vệ thời gian đọc
  (5.5 s lớp 1 / 5.0 s lớp 2 / 4.5 s lớp 3–5).
- `shared/scoring/run-pacing.ts`: viết lại thành `pacingForQuestion(grade, index, scoreBefore)`
  — dùng chung cho cả client và `verify-run.ts`, nên cửa sổ chấm điểm hai phía luôn khớp.
- `src/game/speed/SpeedSystem.ts`: ease-out cubic, clamp nhiều lớp, pause = `update(0)`.
- **Đã gỡ:** `+0.28/câu`, `wrongAnswerSlowdown*`, `baseSpeed/maxSpeed` trong `grade-config.ts`.
- HUD: `src/ui/components/SpeedMeter.ts` (6 nấc + MAX), ribbon `TĂNG TỐC!`, FOV 52 → 58.

### 1.3. Backend

- Migration **version 2**: `map_id`, `map_manifest_version`, index `idx_runs_map_finished`
  (`server/src/storage/migrations.ts`). Run cũ đọc thành `rainbow-skyway`.
- `POST /runs/start` nhận + whitelist `mapId`, lỗi `MAP_NOT_AVAILABLE` (400).
- `mapId` khoá vào run; `finish` không thể đổi map; result trả `mapId`.
- `GET /players/me` trả thêm `mapStats` (chỉ tính run `finished`).
- Cả SQLite và JSON repository đều hỗ trợ; `getMapStats()` nằm trong contract chung.

### 1.4. Tài liệu và công cụ

- `README.md` (mới), `.env.example` (mới), `THIRD_PARTY_NOTICES.md` (mới),
  `ASSET_SOURCES.md` (bổ sung mục 5 về map và thumbnail).
- `npm run assets:validate` — kiểm tra thumbnail/avatar/giấy phép/dung lượng.
- `npm run assets:thumbnails` — chụp lại 5 thumbnail từ chính game.
- Thumbnail thật đã tạo: `public/assets/maps/<mapId>/thumbnail.webp` (14–21 KB).

### 1.5. Rà soát UI mobile-first (đang dở — xem mục 3)

- Bộ chọn map: mũi tên và tên map **đè lên ảnh** thay vì chiếm thêm chiều cao;
  chiều cao card theo `clamp(96px, 21vh, 190px)`.
- Home ở màn hình thấp (`max-height: 760px`): ẩn tagline, thu nhỏ logo/huy hiệu,
  nút mute/credits chuyển lên góc trên.
- HUD: `TĂNG TỐC!` chuyển thành pill nhỏ ngay dưới Speed Meter (trước đây đè lên
  câu hỏi và chip chuỗi).
- Hub: nén Player Pass, 7 huy hiệu tuổi thành lưới 7 cột, filter bảng xếp hạng gọn lại.

**Kết quả đo:** 360×640 và 390×844 không còn tràn ngang/dọc, nút **Bắt đầu** luôn
nằm trong viewport (trước đó bị đẩy ra ngoài ở 360×640).

---

## 2. Trạng thái kiểm tra (lần chạy cuối trên máy này)

| Lệnh                               | Kết quả                                         |
| ---------------------------------- | ----------------------------------------------- |
| `npm run typecheck`                | ✅ PASS                                         |
| `npm run lint`                     | ✅ PASS (0 warning)                             |
| `npm run format:check`             | ✅ PASS                                         |
| `npm test` (unit + contract + API) | ✅ PASS — 231 test / 9 file                     |
| `npm run build`                    | ✅ PASS (5 map = 5 chunk riêng)                 |
| `npm run server:build`             | ✅ PASS                                         |
| `npm run assets:validate`          | ✅ PASS                                         |
| `npm run test:e2e`                 | ⚠️ **CHƯA chạy lại đầy đủ sau các thay đổi UI** |

**Mốc thời gian của các kết quả trên:** typecheck / lint / format:check được chạy lại
sau cùng, sau đợt sửa UI mobile. `npm test` (231 test) xanh ở lần chạy **trước** đợt
sửa UI đó; đợt sửa chỉ động vào CSS, `index.html`, `PlayerHubScreen.ts` và
`debug-bridge.ts` nên nhiều khả năng vẫn xanh, nhưng **nên chạy lại để chắc chắn**:

```bash
npm test
```

Ghi chú E2E: lần chạy trước khi sửa UI còn 13 test đỏ, nguyên nhân đã xác định và
đã sửa (các test `goto('/')` rồi chờ `screen-home` mà chưa tạo hồ sơ → đã thêm
`ensureProfile`). Sau đó code UI thay đổi nên **cần chạy lại từ đầu**:

```bash
npx playwright install chromium     # lần đầu trên máy mới
rm -f data/e2e.db*
npm run test:e2e                    # ~25-30 phút
```

---

## 3. Việc còn lại (theo thứ tự ưu tiên)

### 3.1. 🐞 Avatar trong Player Pass hiển thị rỗng — **đã tìm ra nguyên nhân, chưa sửa**

`src/styles/hub.css`, class `.pass__avatar` dùng `padding: 12%`. Padding phần trăm
được tính theo **chiều rộng của phần tử cha** (`.pass__avatar-row`, ~330 px), không
phải theo chính nó → content box bị co về 0, ảnh avatar có kích thước `0×0`
(đã xác minh bằng `getBoundingClientRect()`).

Sửa: đổi `padding: 12%` thành `padding: 10px` (và `8px` trong block `@media (max-width: 560px)`).

```css
.pass__avatar {
  /* Fixed inset, not a percentage: percentage padding resolves against the
     flex row's width, which squeezed the avatar down to nothing. */
  padding: 10px;
}
```

Lưu ý: `.avatar-option` (dòng ~516) cũng dùng `padding: 12%` nhưng nó là grid item
nên phần trăm tính theo chính ô lưới → **không** bị lỗi, giữ nguyên.

Sau khi sửa, chụp lại kiểm chứng bằng `node scripts/.ui-review.mjs`.

### 3.2. Chạy lại toàn bộ E2E và sửa test đỏ nếu còn

Bộ E2E mới `tests/e2e/maps-and-speed.spec.ts` gồm: chọn tay 5 map, nhớ lựa chọn sau
reload, ngẫu nhiên không lặp, fallback khi chunk map 404, màn hình chờ trước countdown,
mobile viewport, ngưỡng tốc độ, trần tốc độ, pause giữa lúc tăng tốc, sai không giảm tốc,
và bài kiểm tra rò rỉ geometry khi đổi map nhiều lần.

### 3.3. Rà soát UI phần còn lại

- Màn **Result** trên mobile: có thể hiển thị thêm icon map của lượt vừa chơi.
- Màn **Tutorial** và **Pause** chưa được rà lại theo mobile-first.
- Kiểm tra thật trên thiết bị cảm ứng (vuốt ngang bộ chọn map).

### 3.4. Ảnh Visual QA theo đặc tả

Cần chụp và lưu vào `artifacts/screenshots/` (E2E tự sinh một phần):
`player-hub-new-desktop`, `player-hub-returning-desktop`, `avatar-picker-mobile`,
`player-hub-leaderboard-mobile`, `leaderboard-new-record`, và mỗi map ở 3 viewport.

### 3.5. Dọn dẹp trước khi merge

- `scripts/.ui-review.mjs` là script rà UI (chụp ảnh + đo overflow) viết trong phiên này.
  Giữ lại thì đổi tên bỏ dấu chấm đầu và ghi vào README; không thì xoá.
- `scripts/visual-qa.mjs` còn hard-code đường dẫn cũ `D:/T3SKY/projects/...` — nên sửa
  hoặc xoá vì đã có `.ui-review.mjs` thay thế.
- ~~`data/*.db*` bị theo dõi trong git~~ — đã gỡ khỏi index và thêm `data/` vào `.gitignore`.

---

## 3.6. Trạng thái git khi bàn giao

Ba commit đã tạo trên nhánh `main`, **chưa push**:

| Commit    | Nội dung                                                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `58cd9d8` | `chore: normalise line endings and apply Prettier` — thêm `.gitattributes`, chạy Prettier cho các file chỉ lệch định dạng, gỡ `data/` khỏi git |
| `e6a0c5e` | `feat: five maps and score-based speed` — toàn bộ tính năng, test, tài liệu                                                                    |
| `6b822db` | `style: format index.html and the UI review script`                                                                                            |

Trên máy mới, sau khi `git pull`, chạy `git add --renormalize .` một lần nếu thấy
Git báo lệch dòng hàng loạt.

---

## 4. Chạy lại trên máy mới

```bash
npm ci
npx playwright install chromium          # chỉ cần cho E2E và chụp thumbnail
cp .env.example .env                     # đặt PLAYER_TOKEN_PEPPER ngẫu nhiên

# Hai tiến trình khi phát triển
npm run server:dev                       # API  http://127.0.0.1:8787
npm run dev                              # Web  http://127.0.0.1:5173
```

Rà soát UI nhanh (cần dev server đang chạy):

```bash
node scripts/.ui-review.mjs http://127.0.0.1:5173 artifacts/review
# → ảnh ở artifacts/review/, kèm số đo overflow và vị trí các phần tử chính
```

Chụp lại thumbnail map (cần bản build + preview):

```bash
npm run build
npm run preview -- --port 4180 --strictPort   # cửa sổ riêng
npm run assets:thumbnails -- http://127.0.0.1:4180
```

---

## 5. Lưu ý về diff và môi trường

- **Diff rất lớn (~134 file)** vì đã chạy `npx prettier --write .` một lần: phần lớn là
  thay đổi định dạng, không phải logic. Nên commit tách làm hai:
  `chore: prettier` rồi `feat: 5 maps + score-based speed`.
- Đã thêm `.gitattributes` (`* text=auto eol=lf`) để máy Windows với
  `core.autocrlf=true` không làm `format:check` đỏ trên cây sạch. Trên máy mới, sau
  khi clone, nếu vẫn thấy lệch dòng: `git add --renormalize .`.
- Quyền cho agent nằm ở `.claude/settings.json` (commit được, dùng chung).
  `.claude/settings.local.json` là của riêng từng máy và đã được gitignore.
- Node cần **≥ 22.5** vì server dùng `node:sqlite` và chạy trực tiếp file `.ts`.
- Trạng thái task của phiên: 6/7 hoàn thành, còn lại là mục "Tests and full check suite"
  (chính là mục 3.1 và 3.2 ở trên).
