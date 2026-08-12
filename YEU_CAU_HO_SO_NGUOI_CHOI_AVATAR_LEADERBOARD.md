# YÊU CẦU MODULE HỒ SƠ NGƯỜI CHƠI, AVATAR VÀ LEADERBOARD

> Tài liệu bổ sung cho game **Đường đua Toán học 3D**  
> Phiên bản: 1.0  
> Ngày chốt: 12/08/2026  
> Tên kỹ thuật module: `player-hub`  
> Phạm vi: màn hình đầu, hồ sơ người chơi, avatar có sẵn, lưu trữ backend và bảng xếp hạng.

---

## 1. Cách giao tài liệu này cho Claude Code

Đặt file này cùng cấp với `DAC_TA_GAME_DUONG_DUA_TOAN_HOC_3D.md`, sau đó giao Claude Code prompt:

```text
Hãy đọc toàn bộ hai file sau trước khi sửa code:

1. DAC_TA_GAME_DUONG_DUA_TOAN_HOC_3D.md
2. YEU_CAU_HO_SO_NGUOI_CHOI_AVATAR_LEADERBOARD.md

File thứ hai là đặc tả bổ sung cho module Player Hub, hồ sơ người chơi, avatar, backend storage và leaderboard. Nếu có khác biệt về luồng màn hình đầu, file thứ hai được ưu tiên.

Hãy khảo sát repository hiện tại, lập checklist triển khai theo milestone trong tài liệu rồi thực hiện hoàn chỉnh. Không được chỉ dựng giao diện giả hoặc lưu dữ liệu duy nhất trong localStorage.

Yêu cầu bắt buộc:
- SQLite là storage mặc định; JSON là adapter fallback dùng chung repository interface.
- Backend phải phát hành danh tính ẩn danh bằng player token, không dùng nickname làm khóa.
- Backend tự xác minh và tính lại điểm từ seed cùng danh sách câu trả lời; không tin score do client gửi.
- Leaderboard chỉ hiển thị nickname, avatar, hạng và điểm; không hiển thị tuổi hoặc dữ liệu định danh.
- Avatar chỉ chọn từ catalog có sẵn, không cho upload ảnh.
- Giao diện phải theo art direction game trong mục 5 của tài liệu chính, không làm form/card kiểu SaaS.
- Phải có migration, validation, unit/integration/E2E test và tài liệu vận hành.
- Trước khi báo hoàn thành phải chạy typecheck, lint, unit test, integration test, build và E2E.

Sau mỗi milestone, báo file đã thay đổi, lệnh kiểm tra và kết quả. Chỉ báo hoàn thành khi Definition of Done đạt toàn bộ.
```

Trong tài liệu này, “leader bot” được hiểu là **leaderboard — bảng xếp hạng**.

---

## 2. Mục tiêu sản phẩm

### 2.1. Mục tiêu

Tạo một màn hình đầu tiên mang tính game, nơi người chơi:

1. Tạo hoặc xem lại hồ sơ ẩn danh.
2. Nhập nickname.
3. Chọn một avatar đáng yêu có sẵn.
4. Chọn tuổi.
5. Xem bảng xếp hạng ngay trên cùng màn hình.
6. Bấm **Vào đường đua** để chuyển sang phần chọn lớp/chơi game hiện tại.

### 2.2. Tên màn hình

Tên hiển thị: **Sảnh Người Chơi**  
Tên code: `PlayerHubScreen`  
App phase đề xuất: `player-hub`.

### 2.3. Phạm vi MVP

- Hồ sơ không cần email, mật khẩu hay số điện thoại.
- Một thiết bị/trình duyệt giữ một player identity bằng opaque token.
- Nickname không cần duy nhất toàn hệ thống.
- Có tối thiểu 24 avatar từ bốn nhóm.
- Tuổi cho phép từ 6 đến 12.
- Leaderboard theo từng lớp, có **Tuần này** và **Mọi thời đại**.
- SQLite là mặc định.
- JSON được hỗ trợ cho demo hoặc môi trường đơn tiến trình.
- Backend cung cấp REST API.
- Sau mỗi lượt chơi hợp lệ, điểm được cập nhật vào leaderboard.

### 2.4. Ngoài phạm vi MVP

- Không có tài khoản phụ huynh hoặc giáo viên.
- Không đăng nhập bằng Google/Facebook.
- Không đồng bộ hồ sơ qua nhiều thiết bị.
- Không khôi phục token bị mất.
- Không cho upload avatar, ảnh thật hoặc ảnh từ URL.
- Không hiển thị tuổi trên leaderboard.
- Không có chat, kết bạn hoặc tin nhắn.
- Không có phần thưởng quy đổi ra tiền/vật phẩm trả phí.
- Không có bảng xếp hạng theo trường, lớp học thực tế hoặc vị trí địa lý.
- Không dùng tuổi để xác định tự động chương trình học bắt buộc.

---

## 3. Luồng người dùng

### 3.1. Người chơi lần đầu

1. App boot và tải scene 3D nền.
2. Frontend kiểm tra player token trong localStorage.
3. Nếu không có token, mở Sảnh Người Chơi ở trạng thái **Tạo nhân vật**.
4. Leaderboard được tải độc lập và hiển thị ngay; không chờ tạo hồ sơ.
5. Người chơi nhập nickname.
6. Người chơi chọn avatar.
7. Người chơi chọn tuổi.
8. Bấm **Lưu và vào đường đua**.
9. Frontend gọi API tạo player.
10. Backend trả `player`, `playerToken`.
11. Frontend lưu token, giữ hồ sơ trong memory và chuyển đến Home/chọn lớp.

### 3.2. Người chơi quay lại

1. App đọc token và gọi `GET /api/v1/players/me`.
2. Nếu token hợp lệ, Sảnh Người Chơi hiển thị avatar lớn, nickname, tuổi và kỷ lục gần nhất.
3. Leaderboard hiển thị song song; hàng của người chơi được highlight.
4. Người chơi có thể bấm **Vào đường đua** ngay hoặc **Sửa hồ sơ**.
5. Nếu token hết hiệu lực/không tồn tại, xóa token local và trở về luồng tạo mới với thông báo nhẹ nhàng.

### 3.3. Sửa hồ sơ

1. Bấm biểu tượng bút chì hoặc **Sửa hồ sơ**.
2. Cho sửa nickname, avatar, tuổi.
3. Bấm **Lưu thay đổi**.
4. Frontend gọi `PATCH /api/v1/players/me` kèm player token.
5. Sau khi lưu thành công, cập nhật ngay avatar/nickname trên leaderboard nếu đang có mặt.
6. Nếu request lỗi, giữ dữ liệu người dùng vừa nhập và cho thử lại.

### 3.4. Kết thúc lượt chơi

1. Trước khi bắt đầu countdown, frontend tạo run session từ backend.
2. Backend cấp `runId`, `seed`, `generatorVersion` và thời gian hết hạn.
3. Frontend sinh câu hỏi từ seed và chơi bình thường.
4. Khi hoàn thành, frontend gửi các lựa chọn cùng thời gian trả lời, không tự quyết định điểm cuối cùng.
5. Backend tái tạo bộ câu hỏi, xác minh lựa chọn và tính lại score.
6. Backend lưu lượt chơi và trả kết quả đã xác minh.
7. Frontend hiển thị result bằng dữ liệu server.
8. Leaderboard được refresh; nếu có kỷ lục mới, phát animation `KỶ LỤC MỚI!`.

---

## 4. Đặc tả màn hình Sảnh Người Chơi

### 4.1. Art direction

Màn hình phải giống **sảnh trước cuộc đua**, không giống form đăng ký.

- Scene đường đua 3D vẫn chiếm toàn viewport.
- Nhân vật game đứng cạnh bảng hồ sơ hoặc cổng xuất phát.
- Hồ sơ là một **Player Pass/Thẻ tay đua** dạng bảng game.
- Leaderboard là một **bảng thành tích** gắn bên đường hoặc bảng gỗ/cờ đích.
- Button có chiều sâu theo `.game-button` của tài liệu chính.
- Không dùng card trắng, form SaaS, glassmorphism hoặc dashboard KPI.
- Chỉ dùng DOM cho input, button và text cần accessibility; nền/cảnh vẫn là Three.js.

### 4.2. Bố cục desktop

| Vùng | Tỷ lệ gợi ý | Nội dung |
| --- | ---: | --- |
| Player Pass | 38–42% | Avatar, nickname, tuổi, CTA |
| Khoảng thở/cảnh 3D | 8–12% | Nhân vật/cổng xuất phát |
| Bảng xếp hạng | 42–48% | Filter lớp, period, top 10 |

- Player Pass nằm trái hoặc giữa-trái.
- Leaderboard nằm phải.
- Cảnh 3D vẫn nhìn thấy giữa và xung quanh hai bảng.
- Hai panel không cao quá 82% viewport.
- Mute và credits ở góc, không tạo navigation bar.

### 4.3. Bố cục mobile portrait

- Scene 3D full viewport nhưng camera lùi nhẹ để không bị panel che hết.
- Player Pass ở phía trên, leaderboard compact ngay bên dưới.
- Avatar selector có thể mở thành bottom sheet mang phong cách hộp đồ game.
- Leaderboard phải hiện tối thiểu top 5 ngay trên màn hình, không ẩn hoàn toàn sau tab khác.
- Có nút **Xem đủ Top 10** để mở rộng trong cùng scene.
- Nút **Lưu và vào đường đua** nằm trên safe-area đáy nhưng không che leaderboard khi cuộn.
- Toàn màn hình được phép cuộn dọc; canvas cố định phía sau.

### 4.4. Player Pass lần đầu

Thứ tự hiển thị:

1. Tiêu đề `TẠO TAY ĐUA`.
2. Avatar đang chọn kích thước 112–144 px.
3. Nút/ô **Chọn avatar**.
4. Nickname.
5. Tuổi.
6. Dòng nhắc an toàn.
7. Nút **Lưu và vào đường đua**.

Copy đề xuất:

```text
TẠO TAY ĐUA
Biệt danh của bạn
Chọn tuổi
Chỉ dùng biệt danh vui, không nhập tên thật hoặc số điện thoại nhé!
LƯU VÀ VÀO ĐƯỜNG ĐUA
```

### 4.5. Player Pass người quay lại

- Avatar lớn và có frame theo hạng hiện tại.
- Nickname là title chính.
- Hiển thị `Tuổi 8` trong hồ sơ cá nhân nhưng không công khai trên leaderboard.
- Có `Kỷ lục Lớp X` và rank nếu API trả về.
- Nút chính: **Vào đường đua**.
- Nút phụ: **Sửa hồ sơ**.
- Không hiển thị player ID hoặc token.

### 4.6. Trạng thái tải và lỗi

- Profile và leaderboard tải độc lập.
- Leaderboard dùng skeleton hình hàng xếp hạng, không dùng spinner toàn trang.
- Nếu leaderboard lỗi, hồ sơ vẫn tạo/sử dụng được.
- Nếu lưu hồ sơ lỗi, không chuyển màn hình; hiện ribbon `Chưa lưu được, thử lại nhé!`.
- Nếu backend offline, có nút **Thử lại**. Không tự chuyển sang profile local giả vì sẽ tạo danh tính không đồng bộ.
- Chỉ cho phép chế độ offline/local nếu được bật rõ bằng config dành cho demo.

---

## 5. Nickname

### 5.1. Quy tắc

- Bắt buộc.
- Sau trim dài từ 2 đến 16 ký tự Unicode.
- Cho phép chữ tiếng Việt, chữ Latin, chữ số, dấu cách đơn và `_`.
- Không cho phép emoji, HTML tag, URL, email hoặc ký tự điều khiển.
- Không cho phép nhiều hơn một dấu cách liên tiếp.
- Không cho phép nickname chỉ gồm số.
- Không cho chuỗi có từ 7 chữ số liên tiếp để hạn chế nhập số điện thoại.
- Không phân biệt hoa/thường khi kiểm tra danh sách từ cấm.
- Nickname được lưu dạng hiển thị sau khi normalize Unicode NFC.
- Nickname không bắt buộc duy nhất; `playerId` mới là định danh.

Regex chỉ là lớp kiểm tra đầu tiên; cần validate theo code point và normalize, không phụ thuộc hoàn toàn vào một regex ASCII.

### 5.2. Validation hai phía

- Frontend validate để phản hồi tức thời.
- Backend lặp lại toàn bộ validation và là nguồn quyết định cuối cùng.
- Backend không nhận HTML và không render nickname bằng `innerHTML`.
- Khi hiển thị, luôn gán bằng `textContent` hoặc cơ chế escape tương đương.

### 5.3. Từ cấm và nội dung không phù hợp

- Có file cấu hình `content/blocked-nicknames.vi.json`.
- Kiểm tra từ cấm sau khi lowercase, bỏ dấu câu thừa và chuẩn hóa khoảng trắng.
- Danh sách phải dễ cập nhật, không hard-code rải rác.
- Không tự động “đoán” hay sửa nickname; trả lỗi thân thiện để người chơi chọn tên khác.
- Ghi log mã lỗi, không log nickname bị từ chối ở mức info production.

### 5.4. Mã lỗi và copy

| Code | Copy người dùng |
| --- | --- |
| `NICKNAME_REQUIRED` | `Hãy đặt một biệt danh nhé!` |
| `NICKNAME_TOO_SHORT` | `Biệt danh cần ít nhất 2 ký tự.` |
| `NICKNAME_TOO_LONG` | `Biệt danh tối đa 16 ký tự.` |
| `NICKNAME_INVALID_CHARS` | `Biệt danh có ký tự chưa phù hợp.` |
| `NICKNAME_PRIVATE_INFO` | `Đừng dùng số điện thoại, email hoặc đường dẫn nhé!` |
| `NICKNAME_BLOCKED` | `Hãy chọn một biệt danh vui vẻ khác nhé!` |

---

## 6. Tuổi

### 6.1. Quy tắc

- Bắt buộc chọn một số nguyên từ 6 đến 12.
- Không nhập ngày sinh hoặc năm sinh.
- UI dùng bảy huy hiệu số `6`…`12`, stepper hoặc carousel; không dùng input ngày.
- Tuổi mặc định chưa được chọn, không tự đoán.
- Backend validate `Number.isInteger(age)` và range.
- Tuổi có thể sửa sau.

### 6.2. Mục đích sử dụng

Trong MVP, tuổi chỉ được dùng để:

- Cá nhân hóa lời chào nếu cần.
- Gợi ý mức lớp ban đầu nhưng không tự khóa người chơi.
- Phân tích nội bộ trong tương lai nếu có yêu cầu riêng.

Tuổi **không được**:

- Hiển thị trên leaderboard.
- Đưa vào nickname hoặc URL công khai.
- Dùng để so sánh/xếp hạng trẻ.
- Dùng để tự động chia sẻ dữ liệu.

### 6.3. Gợi ý lớp không bắt buộc

Nếu muốn preselect grade sau khi tạo hồ sơ:

| Tuổi | Grade gợi ý |
| ---: | ---: |
| 6 | 1 |
| 7 | 2 |
| 8 | 3 |
| 9 | 4 |
| 10–12 | 5 |

Đây chỉ là giá trị mặc định UI. Người chơi vẫn được chọn lớp khác ở màn hình game.

---

## 7. Avatar catalog

### 7.1. Quy tắc sản phẩm

- Chỉ chọn avatar có sẵn.
- Không upload ảnh, không nhập URL và không bật camera.
- Tối thiểu 24 avatar, mỗi nhóm tối thiểu 6 lựa chọn.
- Mỗi avatar có ID ổn định; database chỉ lưu `avatarId`, không lưu binary.
- Tất cả asset nằm local trong production.
- Phong cách cần đồng nhất bằng badge/frame chung dù source pack khác nhau.

### 7.2. Các nhóm bắt buộc

| Nhóm | ID | Ví dụ |
| --- | --- | --- |
| Con vật | `animals` | mèo, chó, gấu trúc, ếch, voi, khỉ |
| Robot | `robots` | robot xanh, vàng, tím, robot một mắt |
| Máy bay/vũ trụ | `aircraft` | máy bay, phi thuyền, UFO |
| Xe và xe tăng | `vehicles` | xe tăng, xe đua, xe địa hình |

Không sử dụng vũ khí, đạn, hiệu ứng nổ hoặc hình ảnh mang tính bạo lực trong thumbnail. Xe tăng được minh họa theo phong cách đồ chơi đáng yêu, không có cảnh chiến đấu.

### 7.3. Nguồn CC0 đề xuất

Ưu tiên chọn và chuẩn hóa từ các pack chính thức của Kenney:

- Animal Pack Remastered: <https://kenney.nl/assets/animal-pack-remastered>
- Robot Pack: <https://kenney.nl/assets/robot-pack>
- Tappy Plane: <https://kenney.nl/assets/tappy-plane>
- Space Shooter Remastered: <https://kenney.nl/assets/space-shooter-remastered>
- Tanks: <https://kenney.nl/assets/tanks>
- Top-down Tanks Remastered: <https://kenney.nl/assets/top-down-tanks-remastered>

Các trang asset này ghi giấy phép Creative Commons CC0. Chỉ copy những file thực tế dùng, giữ `License.txt` và ghi từng source pack vào `ASSET_SOURCES.md`.

### 7.4. Chuẩn hóa file

- Output mỗi avatar: PNG hoặc WebP có transparency.
- Kích thước logical: 256×256 px.
- Nội dung đặt giữa, chừa 10–14% safe padding.
- Dung lượng mục tiêu dưới 60 KB/avatar.
- Không bake nickname vào ảnh.
- Frame, rarity ring hoặc trạng thái selected vẽ bằng CSS/SVG, không tạo bản ảnh lặp.
- Tên file theo ID, ví dụ `animal-panda-01.webp`.
- Có thể tạo thumbnail 128×128 nếu cần, nhưng không bắt buộc cho MVP.

### 7.5. Manifest

Tạo `shared/content/avatars.json` hoặc TypeScript module tương đương:

```json
[
  {
    "id": "animal-panda-01",
    "category": "animals",
    "displayName": "Gấu trúc",
    "imageUrl": "/assets/avatars/animal-panda-01.webp",
    "sourcePack": "Kenney Animal Pack Remastered",
    "license": "CC0",
    "enabled": true,
    "sortOrder": 10
  }
]
```

Yêu cầu:

- `id` không đổi sau khi đã có player sử dụng.
- Muốn ẩn avatar thì đặt `enabled=false`, không xóa ngay file/record.
- Backend dùng cùng manifest để validate `avatarId`.
- API chỉ trả avatar enabled khi tạo/sửa hồ sơ.

### 7.6. UI chọn avatar

- Avatar hiện tại lớn ở giữa Player Pass.
- Có filter bốn nhóm bằng icon + label ngắn.
- Desktop: grid 4–6 cột.
- Mobile: grid 3–4 cột hoặc carousel ngang.
- Selected avatar scale 1.08×, có vòng sáng, check/star và âm `switch.ogg`.
- Hover/focus preview avatar, nhưng chỉ click/Enter/Space mới chọn.
- Mỗi item là `button` có `aria-label="Chọn avatar Gấu trúc"`.
- Lazy-load hình ngoài vùng nhìn thấy.

---

## 8. Leaderboard

### 8.1. Mục tiêu

Tạo cảm giác thi đua vui vẻ nhưng công bằng, không biến bảng xếp hạng thành nơi công khai dữ liệu trẻ em.

### 8.2. Phạm vi xếp hạng

- Xếp hạng riêng cho từng grade 1–5.
- Không gộp score lớp 1 và lớp 5 vào cùng một bảng chính vì độ khó khác nhau.
- Period:
  - `weekly`: tuần hiện tại.
  - `all_time`: mọi thời đại.
- Default:
  - Grade: grade đã chọn gần nhất; lần đầu là lớp 1.
  - Period: `weekly`.
- Tuần tính từ thứ Hai 00:00 đến trước thứ Hai kế tiếp theo timezone `Asia/Ho_Chi_Minh`.

### 8.3. Quy tắc mỗi player một hàng

- Với mỗi grade và period, chỉ lấy lượt tốt nhất của mỗi player.
- Một player không được chiếm nhiều hàng bằng nhiều lượt chơi.
- Nếu chơi tốt hơn, best entry được thay thế.
- Lịch sử run vẫn được giữ để audit/thống kê.

### 8.4. Thứ tự xếp hạng

So sánh lần lượt:

1. `score` giảm dần.
2. `correctAnswers` giảm dần.
3. `durationMs` tăng dần.
4. `finishedAt` tăng dần — người đạt thành tích trước đứng trên nếu mọi chỉ số bằng nhau.
5. `runId` tăng dần để thứ tự luôn deterministic.

### 8.5. Nội dung hiển thị

| Cột | Nội dung |
| --- | --- |
| Hạng | 1, 2, 3…; top 3 dùng huy chương |
| Avatar | 40–52 px, lấy từ manifest |
| Nickname | Tối đa 16 ký tự, truncate bằng CSS nếu cần |
| Điểm | Số lớn cạnh icon đồng xu |

Không hiển thị:

- Tuổi.
- Player ID.
- Token.
- IP, vị trí, thiết bị.
- Thời gian online.
- Lịch sử chi tiết của người khác.

### 8.6. Top 3 và hàng hiện tại

- Top 1: huy chương vàng, row lớn hơn nhẹ.
- Top 2: bạc.
- Top 3: đồng.
- Không dùng podium chiếm quá nhiều diện tích trên mobile; row badge là đủ.
- Hàng của current player có outline cyan và label nhỏ `Bạn`.
- Nếu player ngoài Top 10, API trả thêm `currentPlayerEntry`; UI ghim hàng đó ở cuối, ngăn bằng dấu `…`.

### 8.7. Refresh và cache

- Tải leaderboard khi mở Player Hub.
- Refresh sau khi kết thúc lượt chơi đã được backend xác minh.
- Có nút refresh nhỏ với cooldown 10 giây.
- Backend có thể cache mỗi tổ hợp `grade + period + limit` trong 10–30 giây.
- Không polling liên tục.

### 8.8. Trạng thái đặc biệt

- Chưa có dữ liệu: `Chưa có tay đua nào — bạn mở hàng nhé!`.
- Lỗi: `Bảng thành tích đang nghỉ một chút.` + nút **Thử lại**.
- Player bị vô hiệu hóa không xuất hiện.
- Avatar đã disabled vẫn hiển thị cho player cũ bằng fallback manifest hoặc avatar mặc định.

---

## 9. Kiến trúc backend

### 9.1. Nguyên tắc

- Backend viết bằng TypeScript để dùng chung type, validator và question generator với frontend.
- Tách domain/service/repository; route handler không chứa SQL trực tiếp.
- SQLite là storage mặc định cho production một máy.
- JSON adapter dùng cùng interface để test/demo.
- Không để client truy cập file database hoặc JSON trực tiếp.
- Tất cả thời gian lưu UTC ISO-8601 hoặc epoch integer nhất quán; convert timezone chỉ ở query period/UI.

### 9.2. Cấu trúc đề xuất

```text
server/
├── src/
│   ├── app.ts
│   ├── config.ts
│   ├── routes/
│   │   ├── avatars.routes.ts
│   │   ├── health.routes.ts
│   │   ├── leaderboard.routes.ts
│   │   ├── players.routes.ts
│   │   └── runs.routes.ts
│   ├── domain/
│   │   ├── player.ts
│   │   ├── run.ts
│   │   └── leaderboard.ts
│   ├── services/
│   │   ├── PlayerService.ts
│   │   ├── RunService.ts
│   │   └── LeaderboardService.ts
│   ├── repositories/
│   │   ├── GameRepository.ts
│   │   ├── JsonGameRepository.ts
│   │   └── SqliteGameRepository.ts
│   ├── storage/
│   │   ├── migrations/
│   │   ├── json-store.ts
│   │   └── sqlite.ts
│   ├── middleware/
│   │   ├── auth-player.ts
│   │   ├── error-handler.ts
│   │   └── rate-limit.ts
│   └── utils/
│       ├── token.ts
│       └── time.ts
├── tests/
└── package.json

shared/
├── content/avatars.json
├── contracts/
├── math/question-generator.ts
├── scoring/
└── validation/
```

Nếu repository dùng monorepo, có thể tổ chức `apps/web`, `apps/server`, `packages/shared`. Không duplicate question/scoring logic giữa client và server.

### 9.3. Repository interface

```ts
export interface GameRepository {
  createPlayer(input: NewPlayerRecord): Promise<PlayerRecord>;
  getPlayerById(id: string): Promise<PlayerRecord | null>;
  getPlayerByTokenHash(tokenHash: string): Promise<PlayerRecord | null>;
  updatePlayer(id: string, patch: UpdatePlayerRecord): Promise<PlayerRecord>;

  createRunSession(input: NewRunSessionRecord): Promise<GameRunRecord>;
  getRunById(id: string): Promise<GameRunRecord | null>;
  finishRun(input: FinishRunRecord): Promise<GameRunRecord>;

  getLeaderboard(query: LeaderboardQuery): Promise<LeaderboardEntry[]>;
  getPlayerRank(query: PlayerRankQuery): Promise<LeaderboardEntry | null>;
  close(): Promise<void>;
}
```

Contract test phải chạy cùng một suite cho cả SQLite và JSON adapter.

---

## 10. Lựa chọn storage

### 10.1. Cấu hình

```env
STORAGE_DRIVER=sqlite
SQLITE_PATH=./data/math-runner.db
JSON_DATA_PATH=./data/math-runner.json
PLAYER_TOKEN_PEPPER=replace-with-long-random-secret
CORS_ORIGINS=http://localhost:5173
TRUST_PROXY=false
```

- Default `STORAGE_DRIVER=sqlite`.
- App fail fast nếu storage driver không hợp lệ.
- Production fail fast nếu `PLAYER_TOKEN_PEPPER` chưa được đặt an toàn.
- Không commit `.env`, database hoặc JSON production.

### 10.2. SQLite — mặc định và khuyến nghị

Khi mở database:

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
```

Yêu cầu:

- Chạy migration theo version, không tạo bảng tùy tiện trong route.
- Transaction khi finish run và cập nhật dữ liệu liên quan leaderboard.
- Parameterized query; không nối chuỗi SQL từ request.
- Index theo các query leaderboard.
- Backup được bằng file database cùng WAL checkpoint phù hợp.
- Một backend instance hoặc nhiều process trên cùng máy chỉ khi driver/config đã được test.

### 10.3. JSON — fallback

JSON chỉ phù hợp:

- Demo nhỏ.
- Local development.
- Một Node process.
- Lưu lượng thấp.

Yêu cầu:

- Cùng schema logic với SQLite.
- Ghi file atomic: ghi vào file tạm cùng directory rồi rename.
- Dùng in-process mutex/queue để tuần tự hóa write.
- Giữ bản backup gần nhất trước khi replace.
- Validate toàn bộ file khi load.
- Nếu file hỏng, không âm thầm ghi đè; chuyển app sang read-only/error và báo rõ.
- Không hỗ trợ multi-instance hoặc shared network filesystem.

Cấu trúc:

```json
{
  "schemaVersion": 1,
  "players": [],
  "runs": [],
  "metadata": {
    "updatedAt": "2026-08-12T00:00:00.000Z"
  }
}
```

---

## 11. Schema SQLite

### 11.1. `schema_migrations`

```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
```

### 11.2. `players`

```sql
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  nickname_normalized TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age BETWEEN 6 AND 12),
  avatar_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX idx_players_status ON players(status);
```

Không đặt `UNIQUE` cho nickname.

### 11.3. `game_runs`

```sql
CREATE TABLE game_runs (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 5),
  seed INTEGER NOT NULL,
  generator_version INTEGER NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('started', 'finished', 'expired', 'rejected')),
  score INTEGER,
  correct_answers INTEGER,
  best_streak INTEGER,
  duration_ms INTEGER,
  answers_json TEXT,
  rejection_reason TEXT,
  started_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  finished_at TEXT,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX idx_runs_player_grade
  ON game_runs(player_id, grade, status);

CREATE INDEX idx_runs_leaderboard
  ON game_runs(grade, status, finished_at, score DESC);
```

### 11.4. Lưu answer audit

`answers_json` lưu payload đã chuẩn hóa:

```json
[
  {
    "questionIndex": 0,
    "selectedIndex": 1,
    "responseMs": 5240,
    "isCorrect": true,
    "awardedScore": 142
  }
]
```

Không cần lưu prompt/answers nếu backend có thể tái tạo bằng `seed + grade + generatorVersion`.

### 11.5. Truy vấn best run

Leaderboard query phải chọn best run của từng player bằng window function/CTE hoặc logic repository tương đương. Không lấy tất cả run rồi sort toàn bộ ở frontend.

Pseudo SQL:

```sql
WITH ranked_player_runs AS (
  SELECT
    r.*,
    ROW_NUMBER() OVER (
      PARTITION BY r.player_id
      ORDER BY
        r.score DESC,
        r.correct_answers DESC,
        r.duration_ms ASC,
        r.finished_at ASC,
        r.id ASC
    ) AS player_best
  FROM game_runs r
  JOIN players p ON p.id = r.player_id
  WHERE r.status = 'finished'
    AND p.status = 'active'
    AND r.grade = :grade
    AND r.finished_at >= :periodStart
    AND r.finished_at < :periodEnd
)
SELECT *
FROM ranked_player_runs
WHERE player_best = 1
ORDER BY
  score DESC,
  correct_answers DESC,
  duration_ms ASC,
  finished_at ASC,
  id ASC
LIMIT :limit;
```

Với `all_time`, bỏ điều kiện period.

---

## 12. Danh tính ẩn danh và player token

### 12.1. Tạo token

- Backend tạo `playerId` UUID.
- Backend tạo token ngẫu nhiên tối thiểu 32 byte bằng cryptographic RNG.
- Token raw chỉ trả cho client một lần khi tạo player.
- Database chỉ lưu hash của token kết hợp secret pepper, không lưu raw token.
- So sánh hash bằng phương thức timing-safe nếu driver/runtime cho phép.

### 12.2. Client lưu token

Key đề xuất:

```text
math-runner-3d:player-token:v1
```

- Lưu token trong localStorage cho MVP.
- Không ghi token vào URL, log, analytics hoặc error report.
- Gửi bằng header:

```http
Authorization: Bearer <playerToken>
```

- Khi API trả `401`, xóa token và đưa về tạo hồ sơ.
- Không dùng nickname để xác thực.

### 12.3. Giới hạn mô hình không tài khoản

- Xóa dữ liệu trình duyệt sẽ mất quyền truy cập player cũ.
- Đổi thiết bị không tự đồng bộ.
- Không cung cấp recovery code trong MVP.
- README và UI quản trị nội bộ phải ghi rõ giới hạn này.

---

## 13. REST API

Base path:

```text
/api/v1
```

Response lỗi chuẩn:

```json
{
  "error": {
    "code": "NICKNAME_TOO_LONG",
    "message": "Biệt danh tối đa 16 ký tự.",
    "requestId": "req_...",
    "field": "nickname"
  }
}
```

Không trả stack trace cho client production.

### 13.1. `GET /avatars`

Public, không cần token.

Response:

```json
{
  "items": [
    {
      "id": "animal-panda-01",
      "category": "animals",
      "displayName": "Gấu trúc",
      "imageUrl": "/assets/avatars/animal-panda-01.webp"
    }
  ],
  "version": 1
}
```

Không cần trả source/license trong runtime response; thông tin đó nằm ở `ASSET_SOURCES.md` và Credits.

### 13.2. `POST /players`

Public nhưng rate-limited.

Request:

```json
{
  "nickname": "Gấu Mập",
  "age": 8,
  "avatarId": "animal-panda-01"
}
```

Response `201`:

```json
{
  "player": {
    "id": "uuid",
    "nickname": "Gấu Mập",
    "age": 8,
    "avatarId": "animal-panda-01",
    "createdAt": "2026-08-12T08:00:00.000Z"
  },
  "playerToken": "opaque-random-token"
}
```

### 13.3. `GET /players/me`

Cần Bearer token.

Response:

```json
{
  "player": {
    "id": "uuid",
    "nickname": "Gấu Mập",
    "age": 8,
    "avatarId": "animal-panda-01",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "bestScores": {
    "1": 1420,
    "2": 1310
  }
}
```

### 13.4. `PATCH /players/me`

Cần Bearer token.

Request cho phép partial nhưng ít nhất một field:

```json
{
  "nickname": "Panda Tốc Độ",
  "age": 9,
  "avatarId": "robot-blue-01"
}
```

- Validate giống create.
- Không cho sửa `id`, `token`, `status`, score.
- Rate-limit update để tránh spam leaderboard cache.

### 13.5. `POST /runs/start`

Cần Bearer token.

Request:

```json
{
  "grade": 3
}
```

Response `201`:

```json
{
  "runId": "uuid",
  "grade": 3,
  "seed": 18273645,
  "generatorVersion": 1,
  "totalQuestions": 12,
  "startedAt": "2026-08-12T08:10:00.000Z",
  "expiresAt": "2026-08-12T08:20:00.000Z"
}
```

Yêu cầu:

- Seed do backend tạo.
- Run hết hạn sau 10 phút.
- Có thể giới hạn tối đa ba run `started` chưa hết hạn/player.
- Countdown chỉ bắt đầu sau khi nhận run session.
- Nếu API lỗi, UI thông báo và cho retry; không tạo score leaderboard offline.

### 13.6. `POST /runs/{runId}/finish`

Cần Bearer token; player chỉ finish run của chính mình.

Request:

```json
{
  "clientDurationMs": 104230,
  "answers": [
    {
      "questionIndex": 0,
      "selectedIndex": 1,
      "responseMs": 5240
    }
  ]
}
```

Yêu cầu:

- Đủ đúng 12 answer item.
- `questionIndex` duy nhất từ 0 đến 11.
- `selectedIndex` là 0, 1 hoặc 2.
- `responseMs` trong giới hạn hợp lý.
- Backend tái tạo questions từ grade, seed, generatorVersion.
- Backend tự xác định đúng/sai, streak, speed bonus, score và stars.
- Backend sử dụng duration server làm kiểm tra chéo; không tin tuyệt đối `clientDurationMs`.
- Finish là idempotent: gửi lại cùng run trả cùng kết quả, không tạo run thứ hai.
- Run hết hạn hoặc payload bất hợp lý được đánh `rejected` và không lên leaderboard.

Response:

```json
{
  "result": {
    "runId": "uuid",
    "grade": 3,
    "score": 1420,
    "correctAnswers": 10,
    "bestStreak": 6,
    "stars": 3,
    "durationMs": 104230,
    "isNewBest": true,
    "rank": 7
  }
}
```

### 13.7. `GET /leaderboard`

Public; token optional để trả current player entry.

Query:

```text
GET /api/v1/leaderboard?grade=3&period=weekly&limit=10
```

Validation:

- `grade`: 1–5, bắt buộc.
- `period`: `weekly|all_time`, mặc định `weekly`.
- `limit`: 5–50, mặc định 10.

Response:

```json
{
  "grade": 3,
  "period": "weekly",
  "periodStart": "2026-08-10T00:00:00+07:00",
  "periodEnd": "2026-08-17T00:00:00+07:00",
  "entries": [
    {
      "rank": 1,
      "nickname": "Mèo Bay",
      "avatarId": "animal-cat-01",
      "score": 1710
    }
  ],
  "currentPlayerEntry": {
    "rank": 27,
    "nickname": "Gấu Mập",
    "avatarId": "animal-panda-01",
    "score": 1420
  },
  "generatedAt": "2026-08-12T08:15:30.000Z"
}
```

Không trả `age`, `playerId`, `durationMs`, token hoặc run history trong endpoint public.

### 13.8. `GET /health`

- Trả trạng thái app và storage connectivity.
- Không trả đường dẫn database, secret hoặc dữ liệu player.

---

## 14. Xác minh điểm và hạn chế gian lận

### 14.1. Nguồn sự thật

- Backend là nguồn sự thật cho run hợp lệ, score và leaderboard.
- Frontend chỉ hiển thị preview score trong lúc chơi.
- Result cuối dùng score server trả về.

### 14.2. Shared deterministic logic

Các module sau phải dùng chung giữa web và server:

- Seeded RNG.
- Question generator.
- Answer shuffle.
- Number formatting phục vụ logic.
- Scoring formula.
- Grade config.
- `generatorVersion`.

Cùng `seed + grade + generatorVersion` phải tạo đúng cùng bộ câu hỏi và correctIndex ở client/server.

### 14.3. Validation run

Reject hoặc không xếp hạng khi:

- Run không thuộc player.
- Run đã hết hạn.
- Thiếu/thừa answer.
- Question index trùng hoặc sai range.
- Response time âm hoặc vượt ngưỡng.
- Tổng duration quá ngắn bất hợp lý.
- `generatorVersion` không còn được backend hỗ trợ.
- Run đã bị rejected/expired.

### 14.4. Lưu ý

Web game không thể chống cheat tuyệt đối. Mục tiêu MVP là không tin một `score` tùy ý từ client và loại các payload rõ ràng bất hợp lý. Không cần DRM hoặc fingerprint thiết bị.

---

## 15. Tích hợp frontend

### 15.1. App state mới

Mở rộng `AppPhase`:

```ts
export type AppPhase =
  | 'boot'
  | 'loading'
  | 'player-hub'
  | 'home'
  | 'tutorial'
  | 'countdown'
  | 'running'
  | 'feedback'
  | 'paused'
  | 'finished'
  | 'error';
```

Luồng đầu:

```text
boot -> loading -> player-hub -> home -> tutorial/countdown -> running
```

### 15.2. Client modules

```text
src/
├── api/
│   ├── ApiClient.ts
│   ├── leaderboard.api.ts
│   ├── players.api.ts
│   └── runs.api.ts
├── player/
│   ├── PlayerSession.ts
│   ├── player-storage.ts
│   └── player-types.ts
├── ui/screens/
│   └── PlayerHubScreen.ts
├── ui/components/
│   ├── AvatarPicker.ts
│   ├── LeaderboardBoard.ts
│   ├── NicknameInput.ts
│   ├── PlayerPass.ts
│   └── AgePicker.ts
└── content/
    └── avatars.ts
```

### 15.3. API client

- Base URL qua `VITE_API_BASE_URL`, default same origin `/api/v1`.
- Timeout 8–10 giây.
- Parse error chuẩn.
- Tự đính Bearer token khi có.
- Không retry POST create/finish một cách mù quáng; finish dùng idempotency theo runId nên có thể retry có kiểm soát.
- GET leaderboard có thể retry một lần với backoff ngắn.

### 15.4. Local storage

Frontend được lưu:

- Player token.
- Cache hồ sơ để render optimistic khi mở lại.
- Avatar manifest version.
- Grade/period filter gần nhất.

Frontend không được coi cache là nguồn sự thật. Khi online, luôn reconcile bằng API.

### 15.5. Run khi backend lỗi

Chốt hành vi MVP:

- Nếu không tạo được `/runs/start`, không bắt đầu lượt có leaderboard.
- Có thể cho phép **Chơi thử không xếp hạng** nếu product bật `VITE_ALLOW_PRACTICE_OFFLINE=true`.
- Chơi thử phải có label rõ `Chế độ luyện tập — không tính bảng xếp hạng`.
- Không âm thầm lưu score local rồi đưa lên sau vì seed/session đã hết hạn.

---

## 16. Quyền riêng tư và an toàn cho trẻ

### 16.1. Dữ liệu tối thiểu

Chỉ lưu:

- Nickname.
- Tuổi dạng số.
- Avatar ID.
- Player ID ẩn danh.
- Token hash.
- Kết quả chơi và timestamp.

Không yêu cầu/lưu:

- Họ tên thật.
- Ngày sinh.
- Email.
- Số điện thoại.
- Trường/lớp thực tế.
- Địa chỉ.
- Ảnh thật.
- Vị trí chính xác.
- Danh bạ hoặc tài khoản mạng xã hội.

### 16.2. Hiển thị công khai

Leaderboard chỉ công khai:

- Nickname.
- Avatar.
- Rank.
- Score.

Không công khai tuổi dù player đã nhập.

### 16.3. Log

- Không log Authorization header hoặc player token.
- Không log toàn bộ request body tạo player ở production.
- Không lưu IP/User-Agent lâu dài trong database MVP.
- Log request ID, route, status, duration và mã lỗi đủ để vận hành.

### 16.4. Xóa dữ liệu

MVP cần endpoint/admin script nội bộ để disable hoặc xóa player theo player ID khi cần vận hành. Không expose công khai nếu chưa có authentication quản trị. Khi disable, player không xuất hiện trên leaderboard và token không còn dùng được.

---

## 17. Bảo mật và vận hành

- CORS allowlist; production không dùng `*` nếu gửi Authorization header.
- Rate-limit:
  - Tạo player theo IP/request fingerprint tạm thời.
  - Update profile theo player.
  - Start/finish run theo player.
  - Leaderboard theo IP ở mức rộng hơn.
- Body limit tối đa 32 KB cho API này.
- Security headers phù hợp.
- Validate `Content-Type: application/json`.
- Parameterized SQL.
- Secret chỉ từ environment/secret store.
- Không serve thư mục `data/` dưới static root.
- Database/JSON backup định kỳ tùy môi trường triển khai.
- Graceful shutdown phải flush JSON queue và đóng SQLite.
- Health check không làm write.
- Có request ID cho mỗi request.

---

## 18. Hiệu năng

- `GET /leaderboard` p95 mục tiêu dưới 250 ms trên dataset nhỏ/trung bình của MVP.
- Cache leaderboard 10–30 giây.
- Limit tối đa 50.
- Avatar manifest có cache dài và immutable asset filename nếu có hash.
- Player Hub render scene 3D ở quality phù hợp; leaderboard DOM không gây reflow liên tục.
- Avatar picker dùng lazy loading.
- Không preload toàn bộ ảnh full-size nếu chỉ hiển thị 6 avatar đầu.
- Index database đúng query.
- Không đọc/parse lại toàn bộ JSON cho mỗi GET; JSON adapter giữ state trong memory và persist tuần tự.

---

## 19. Kiểm thử

### 19.1. Unit test

Nickname:

- Tiếng Việt có dấu hợp lệ.
- Trim/normalize đúng.
- 1 ký tự bị từ chối.
- 17 ký tự bị từ chối.
- Emoji, URL, email, HTML, số điện thoại bị từ chối.
- Từ cấm bị từ chối.

Tuổi/avatar:

- Tuổi 6 và 12 hợp lệ; 5, 13, số thực, string bị từ chối.
- Avatar enabled hợp lệ.
- Avatar không tồn tại/disabled không được chọn mới.

Score/run:

- Cùng seed sinh cùng câu hỏi trên client/server.
- Backend tính đúng score, streak, star.
- Client gửi score giả không ảnh hưởng vì API finish không nhận score.
- Run hết hạn bị reject.
- Duplicate finish trả cùng kết quả.

Leaderboard:

- Mỗi player một row.
- Tie-break đúng thứ tự.
- Weekly boundary timezone đúng.
- Disabled player bị loại.
- Current player ngoài Top 10 vẫn có `currentPlayerEntry`.

### 19.2. Repository contract test

Chạy cùng một suite cho:

- `SqliteGameRepository` dùng temporary database.
- `JsonGameRepository` dùng temporary directory.

Test:

- Create/read/update player.
- Token hash lookup.
- Start/finish run.
- Transaction/idempotency.
- Leaderboard ordering.
- JSON atomic write và reload.
- Migration từ schema version hiện tại.

### 19.3. API integration test

- Tạo player thành công.
- Payload invalid trả 400 và error code đúng.
- Token sai trả 401.
- Update player không sửa field cấm.
- Run của player A không được finish bởi player B.
- Leaderboard response không chứa age/playerId/token.
- Rate-limit trả 429.
- Storage error trả 503/500 an toàn, không lộ stack/đường dẫn.

### 19.4. Frontend E2E

1. First visit không có token.
2. Leaderboard tải dù chưa có profile.
3. Nhập nickname tiếng Việt.
4. Chọn từng category avatar.
5. Chọn tuổi.
6. Submit và lưu token.
7. Vào game, chọn grade.
8. Chơi hết một lượt bằng seed server.
9. Result dùng score server.
10. Quay lại Player Hub; leaderboard/current row cập nhật.
11. Reload; hồ sơ được khôi phục.
12. Sửa nickname/avatar/tuổi.
13. Test token invalid.
14. Test leaderboard lỗi không chặn profile.

Viewport:

- 1440×900.
- 390×844.
- 360×640.

### 19.5. Visual QA

Chụp:

```text
artifacts/screenshots/player-hub-new-desktop.png
artifacts/screenshots/player-hub-returning-desktop.png
artifacts/screenshots/avatar-picker-mobile.png
artifacts/screenshots/player-hub-leaderboard-mobile.png
artifacts/screenshots/leaderboard-new-record.png
```

Checklist:

- Có nhìn như sảnh game hay giống form đăng ký?
- Scene 3D còn nhìn thấy rõ?
- Avatar là điểm focus?
- Leaderboard đọc được nhưng không giống bảng admin?
- Mobile có thấy cả hồ sơ và top leaderboard?
- Nickname tiếng Việt không lỗi dấu?
- Không hiển thị tuổi trên leaderboard?

---

## 20. Milestone triển khai

### Milestone 1 — Shared contracts và avatar catalog

- Tạo shared types/validators.
- Tạo avatar manifest ít nhất 24 avatar.
- Chuẩn hóa asset và license.
- Tạo nickname/age/avatar unit test.

Exit criteria:

- Manifest hợp lệ, không duplicate ID, toàn bộ file tồn tại.
- Validator test pass.

### Milestone 2 — Storage adapters

- Migration SQLite.
- SQLite repository.
- JSON repository atomic.
- Contract test chung.
- Config/env validation.

Exit criteria:

- Contract suite pass với cả hai driver.
- Restart app vẫn đọc được data.

### Milestone 3 — Player API và anonymous auth

- Create/get/update player.
- Token generation/hash/auth middleware.
- Rate-limit và error format.
- API integration test.

Exit criteria:

- Không lưu raw token.
- Invalid auth/payload được xử lý đúng.

### Milestone 4 — Run verification và leaderboard

- Start/finish run.
- Shared deterministic generator/scoring.
- Leaderboard query, current player rank, cache.
- Weekly period.

Exit criteria:

- Score giả từ client không thể vào leaderboard.
- Tie-break và one-row-per-player test pass.

### Milestone 5 — Player Hub UI

- New/returning/edit states.
- Avatar picker, nickname, age.
- Leaderboard desktop/mobile.
- Loading/error/empty states.
- Tích hợp art direction game.

Exit criteria:

- Flow hoàn chỉnh trên desktop/mobile.
- Visual QA không mang giao diện SaaS/vibe-code.

### Milestone 6 — Integration và hoàn thiện

- Kết nối run với game hiện tại.
- Result dùng server score.
- E2E.
- README backend, environment, backup, deploy.
- Production build.

Exit criteria:

- Definition of Done đạt toàn bộ.

---

## 21. Definition of Done

### Hồ sơ

- [ ] Người mới tạo được nickname, avatar và tuổi.
- [ ] Người quay lại được nhận diện bằng token.
- [ ] Sửa hồ sơ hoạt động.
- [ ] Nickname/tuổi/avatar được validate cả client và server.
- [ ] Không yêu cầu thông tin định danh thật.
- [ ] Không upload ảnh.

### Avatar

- [ ] Có ít nhất 24 avatar, đủ bốn nhóm.
- [ ] Avatar ID ổn định và dùng shared manifest.
- [ ] Asset local, có license/source rõ.
- [ ] Avatar picker hoạt động bằng touch, mouse và keyboard.

### Leaderboard

- [ ] Leaderboard hiển thị ngay tại Player Hub.
- [ ] Có grade 1–5 và weekly/all-time.
- [ ] Mỗi player một row trong một bảng.
- [ ] Tie-break deterministic.
- [ ] Current player được highlight/pin nếu ngoài Top 10.
- [ ] Không trả/hiển thị tuổi, player ID hoặc token.

### Backend/storage

- [ ] SQLite chạy mặc định với migration/index/transaction.
- [ ] JSON fallback ghi atomic và có contract test.
- [ ] Raw player token không nằm trong storage/log.
- [ ] Start/finish run hoạt động và finish idempotent.
- [ ] Backend tái tạo câu hỏi, tự tính score.
- [ ] Run invalid/rejected không vào leaderboard.
- [ ] Data directory không được public serve.

### UI/UX

- [ ] Player Hub nhìn như sảnh game, không phải form website.
- [ ] Scene 3D full viewport vẫn nhìn thấy.
- [ ] Player Pass và leaderboard dùng art direction game.
- [ ] Mobile hiển thị profile và ít nhất Top 5.
- [ ] Loading/error/empty state đầy đủ.
- [ ] Tiếng Việt hiển thị đúng.

### Kiểm thử/tài liệu

- [ ] Typecheck pass.
- [ ] Lint pass, 0 warning.
- [ ] Unit test pass.
- [ ] Repository contract test pass cho SQLite và JSON.
- [ ] API integration test pass.
- [ ] Frontend E2E pass.
- [ ] Web và server production build pass.
- [ ] README có setup, env, migration, backup và deploy.
- [ ] `ASSET_SOURCES.md` cập nhật avatar packs.

---

## 22. Những lỗi Claude Code phải tránh

1. Không lưu profile duy nhất trong localStorage rồi gọi là backend.
2. Không dùng nickname làm primary key hoặc auth identity.
3. Không bắt nickname phải unique toàn cầu trong MVP.
4. Không lưu raw token trong database/log.
5. Không tin score client gửi lên.
6. Không cho client tự cấp seed cho run xếp hạng.
7. Không để cùng player chiếm nhiều hàng leaderboard.
8. Không gộp score các grade khác nhau thành bảng chính.
9. Không hiển thị tuổi hoặc player ID trên leaderboard.
10. Không cho upload avatar/ảnh thật.
11. Không lấy avatar từ nguồn không rõ license.
12. Không dùng JSON storage cho nhiều backend instance.
13. Không ghi thẳng JSON target file rồi có nguy cơ file rỗng khi crash.
14. Không serve thư mục `data/`.
15. Không duplicate generator/scoring logic ở web và server.
16. Không dựng Player Hub thành form/card/dashboard SaaS.
17. Không để lỗi leaderboard chặn tạo hồ sơ.
18. Không âm thầm đưa điểm offline vào leaderboard sau khi run session hết hạn.

---

## 23. Kết quả bàn giao mong đợi

Claude Code báo cáo theo format:

```text
1. Player Hub
- Luồng người mới/người quay lại/sửa hồ sơ.
- Screenshot desktop/mobile.

2. Avatar
- Số avatar theo từng nhóm.
- Source/license.

3. Backend
- Framework/cấu trúc thực tế.
- API đã hoàn thành.
- Auth/token behavior.

4. Storage
- SQLite migration/version.
- JSON fallback.
- Vị trí data và backup guidance.

5. Leaderboard
- Period/grade/tie-break.
- Cách backend xác minh điểm.

6. Kiểm thử
- typecheck: PASS/FAIL
- lint: PASS/FAIL
- unit: PASS/FAIL
- repository contract SQLite: PASS/FAIL
- repository contract JSON: PASS/FAIL
- API integration: PASS/FAIL
- E2E desktop/mobile: PASS/FAIL
- production build web/server: PASS/FAIL

7. Hạn chế còn lại
- Chỉ ghi vấn đề thực tế chưa xử lý.
```

Nếu bất kỳ tiêu chí bắt buộc nào chưa đạt, trạng thái cuối phải là **chưa hoàn thành**.

---

## 24. Nguồn asset tham khảo

- Kenney xác nhận asset pages dùng CC0: <https://kenney.nl/support>
- Animal Pack Remastered: <https://kenney.nl/assets/animal-pack-remastered>
- Robot Pack: <https://kenney.nl/assets/robot-pack>
- Tappy Plane: <https://kenney.nl/assets/tappy-plane>
- Space Shooter Remastered: <https://kenney.nl/assets/space-shooter-remastered>
- Tanks: <https://kenney.nl/assets/tanks>
- Top-down Tanks Remastered: <https://kenney.nl/assets/top-down-tanks-remastered>

