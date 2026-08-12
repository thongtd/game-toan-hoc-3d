# Đường đua Toán học 3D

Mini game web 3D luyện Toán cho học sinh tiểu học lớp 1–5. Người chơi chạy trên một đường đua
ba làn, mỗi cánh cổng là một câu hỏi Toán, chọn đúng làn là chọn đúng đáp án.

![Sảnh người chơi và bản đồ Làng Quê Việt Nam](public/assets/maps/vietnam-countryside/thumbnail.webp)

- **Stack:** Vanilla TypeScript + Three.js + Vite, backend Node.js thuần với `node:sqlite`.
- **Không** framework UI, **không** physics engine, **không** dịch vụ ngoài.
- Toàn bộ asset chạy local, giấy phép CC0/OFL — xem [`ASSET_SOURCES.md`](./ASSET_SOURCES.md) và
  [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

---

## 1. Yêu cầu

| Thành phần | Phiên bản                                                            |
| ---------- | -------------------------------------------------------------------- |
| Node.js    | **≥ 22.5** (cần `node:sqlite` và khả năng chạy trực tiếp file `.ts`) |
| npm        | đi kèm Node                                                          |

Kiểm tra nhanh:

```bash
node --version
npm --version
```

## 2. Cài đặt

```bash
npm ci
```

Tải asset (chỉ cần khi thư mục `public/assets/` trống hoặc muốn tải lại):

```powershell
# Windows
pwsh scripts/fetch-assets.ps1
```

```bash
# macOS / Linux
bash scripts/fetch-assets.sh
```

Script chỉ copy đúng danh sách file được whitelist, không đưa nguyên asset pack vào `public/`.

Tạo file cấu hình máy chủ:

```bash
cp .env.example .env
# rồi đặt PLAYER_TOKEN_PEPPER thành một chuỗi ngẫu nhiên dài
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## 3. Chạy khi phát triển

Cần **hai** tiến trình:

```bash
npm run server:dev   # API tại http://127.0.0.1:8787
npm run dev          # web tại http://localhost:5173 (proxy /api sang server)
```

Mở <http://localhost:5173>. Lần đầu vào sẽ là **Sảnh Người Chơi**: đặt biệt danh, chọn avatar và
tuổi, rồi vào đường đua.

Tham số dành cho phát triển (chỉ có tác dụng ở bản dev): `?seed=12345`, `?grade=3`,
`?map=toy-city`.

## 4. Điều khiển

| Hành động     | Bàn phím       | Cảm ứng / chuột      |
| ------------- | -------------- | -------------------- |
| Sang làn trái | `←` hoặc `A`   | Nút ◀ hoặc vuốt trái |
| Sang làn phải | `→` hoặc `D`   | Nút ▶ hoặc vuốt phải |
| Tạm dừng      | `Esc` hoặc `P` | Nút tạm dừng         |
| Bật/tắt tiếng | `M`            | Nút loa              |

## 5. Lệnh kiểm tra

```bash
npm run typecheck        # TypeScript strict
npm run lint             # ESLint, 0 warning
npm run format:check     # Prettier
npm test                 # unit + repository contract + API integration
npm run test:unit        # chỉ unit
npm run test:contract    # repository contract, chạy cho cả SQLite và JSON
npm run test:api         # API integration trên HTTP thật
npm run test:e2e         # Playwright, chạy trên bản build production
npm run assets:validate  # thumbnail, avatar, giấy phép, dung lượng
npm run build            # build web
npm run server:build     # build server
npm run check            # gộp typecheck + lint + format + test + build
```

Lần đầu chạy E2E cần tải trình duyệt:

```bash
npx playwright install chromium
```

## 6. Build và chạy production

```bash
npm ci
npm run check
npm run build
npm run preview -- --host 0.0.0.0     # xem thử bản dist/
NODE_ENV=production npm run server:start
```

`dist/` là site tĩnh, deploy được lên bất kỳ static hosting nào. Server API chạy riêng và phải
được đặt sau reverse proxy ở cùng origin với web (hoặc khai báo `CORS_ORIGINS`).

Deploy vào thư mục con thì đặt `VITE_BASE_PATH=/duong-dua/` trước khi build; mọi asset đều đi qua
base path, không hard-code domain.

## 7. Kiến trúc ngắn gọn

```text
src/
├── app/          App.ts điều phối phase, AppState giữ máy trạng thái
├── game/         Game.ts + systems (câu hỏi, camera, input, particle)
│   ├── maps/     MapManager + 5 map dựng bằng primitives + scene dự phòng
│   └── speed/    SpeedSystem: tốc độ theo điểm
├── scene/        renderer, ánh sáng, chất lượng đồ hoạ, tải model
├── ui/           UIController và các component DOM
├── player/       token ẩn danh, cache hồ sơ, lựa chọn bản đồ
└── api/          ApiClient và các lời gọi API có kiểu

server/src/       config → routes → services → repositories → storage
shared/           dùng chung web và server, không phụ thuộc DOM/Three.js
├── maps/         manifest 5 bản đồ + thuật toán ngẫu nhiên thông minh
├── math/         seeded RNG, sinh câu hỏi, xáo đáp án
├── scoring/      công thức điểm, cấu hình tốc độ, xác minh lượt chơi
└── validation/   biệt danh, tuổi, avatar
```

Nguyên tắc quan trọng: **mọi logic quyết định điểm đều nằm trong `shared/`** và được cả trình
duyệt lẫn máy chủ dùng chung, nên cùng một `seed` luôn sinh ra cùng bộ câu hỏi ở hai phía.

### Bản đồ và tốc độ

- Có đúng 5 bản đồ, mở sẵn từ đầu, chọn thủ công hoặc **Ngẫu nhiên thông minh**.
- Bản đồ chỉ đổi hình ảnh, ánh sáng và trang trí. Làn chạy, câu hỏi, điểm và tốc độ giống hệt
  nhau ở mọi bản đồ, nên một bảng xếp hạng vẫn công bằng.
- Tốc độ: `7.5 + floor(điểm / 300) × 0.75`, trần tuyệt đối `11.25`, chuyển mượt trong `0.65s`.
  Khoảng cách cổng tự giãn theo lớp để thời gian đọc không bao giờ bị rút ngắn.
- Máy chủ khoá `mapId` từ lúc `POST /runs/start`; payload finish không thể đổi bản đồ.

## 8. Máy chủ, dữ liệu và vận hành

### Cấu hình

Toàn bộ biến môi trường và ý nghĩa nằm trong [`.env.example`](./.env.example). App **fail fast**
khi `STORAGE_DRIVER` sai, và ở production khi `PLAYER_TOKEN_PEPPER` chưa đủ an toàn hoặc
`CORS_ORIGINS` là `*`.

### Migration

Migration chạy tự động khi mở database, theo version, trong một transaction:

| Version | Nội dung                                                             |
| ------- | -------------------------------------------------------------------- |
| 1       | `players`, `game_runs` và các index                                  |
| 2       | thêm `map_id`, `map_manifest_version`, index `idx_runs_map_finished` |

Lượt chơi ghi trước khi có hệ thống bản đồ được đọc thành `rainbow-skyway` và vẫn giữ nguyên
điểm cũng như vị trí trên bảng xếp hạng.

### Sao lưu

SQLite ghi theo chế độ WAL. Khi tắt, server tự `wal_checkpoint(TRUNCATE)`, nên **copy file
`.db` sau khi tắt là một bản backup đầy đủ**. Muốn sao lưu lúc đang chạy:

```bash
sqlite3 data/math-runner.db ".backup 'backup/math-runner-$(date +%F).db'"
```

Với driver JSON, file được ghi atomic (ghi file tạm rồi rename) và luôn giữ một bản `.bak` gần
nhất. Thư mục `data/` **không** được đặt dưới static root và không bao giờ được serve.

### Giới hạn của mô hình không tài khoản

Danh tính là một token ẩn danh nằm trong `localStorage`. Xoá dữ liệu trình duyệt hoặc đổi thiết
bị là mất quyền truy cập hồ sơ cũ; phiên bản này **không** có cách khôi phục.

## 9. Quyền riêng tư

Chỉ lưu biệt danh, tuổi dạng số, avatar id, player id ẩn danh, hash token và kết quả chơi. Không
thu thập họ tên thật, email, số điện thoại, trường lớp hay vị trí. Bảng xếp hạng chỉ hiển thị
biệt danh, avatar, hạng và điểm — **không** hiển thị tuổi.

## 10. Giấy phép

- Mã nguồn: [MIT](./LICENSE)
- Asset: CC0 / OFL — chi tiết ở [`ASSET_SOURCES.md`](./ASSET_SOURCES.md) và
  [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)
