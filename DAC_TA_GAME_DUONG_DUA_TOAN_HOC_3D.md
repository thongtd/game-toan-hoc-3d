# ĐẶC TẢ TRIỂN KHAI GAME “ĐƯỜNG ĐUA TOÁN HỌC 3D”

> Tài liệu giao việc hoàn chỉnh cho Claude Code  
> Phiên bản: 1.1 — bổ sung art direction và đặc tả giao diện game  
> Ngày chốt: 12/08/2026  
> Mục tiêu: xây dựng một mini game web 3D hoàn chỉnh, vui, dễ chơi, phù hợp học sinh tiểu học và sử dụng 100% mã nguồn/tài nguyên có giấy phép mở.

---

## 1. Cách sử dụng tài liệu này với Claude Code

Đặt file này ở thư mục gốc của repository rồi giao Claude Code prompt sau:

```text
Hãy đọc toàn bộ file DAC_TA_GAME_DUONG_DUA_TOAN_HOC_3D.md trước khi sửa code.

Bạn là senior web game engineer chịu trách nhiệm triển khai hoàn chỉnh game theo đặc tả. Hãy làm lần lượt theo các milestone, không bỏ qua kiểm thử và không tuyên bố hoàn thành khi Definition of Done chưa đạt.

Nguyên tắc:
1. Nếu repository đã có code, phải đọc cấu trúc và bảo toàn mọi thay đổi không liên quan.
2. Nếu repository trống, khởi tạo dự án đúng stack trong tài liệu.
3. Dùng TypeScript strict; không dùng any để lách lỗi.
4. Tách gameplay, bộ sinh câu hỏi, UI, audio và asset loading thành các module rõ ràng.
5. Chỉ dùng asset có giấy phép đã được xác minh trong tài liệu. Không tự lấy hình hoặc nhạc từ nguồn khác.
6. Trước khi kết thúc phải chạy: typecheck, lint, unit test, build và Playwright E2E.
7. Phải tự mở game bằng trình duyệt, chơi thử đầy đủ ít nhất một lượt ở desktop và một viewport mobile.
8. Nếu direct download URL của asset hết hiệu lực, vào trang nguồn ổn định được ghi trong tài liệu, tải bản hiện tại, kiểm tra License.txt là CC0 rồi cập nhật ASSET_SOURCES.md.
9. Sau mỗi milestone, ghi ngắn gọn file đã thay đổi, lệnh kiểm tra và kết quả. Không dừng để hỏi các lựa chọn nhỏ đã được đặc tả.
10. Giao diện phải có cảm giác là một game arcade 3D hoàn chỉnh, không phải một website/vibe-code đặt canvas phía sau các card. Đọc kỹ toàn bộ mục 5 trước khi dựng UI.

Bắt đầu bằng việc kiểm tra môi trường, repository và lập checklist thực hiện. Sau đó triển khai cho đến khi game hoàn chỉnh.
```

Claude Code phải coi các mục có nhãn **BẮT BUỘC** là tiêu chí nghiệm thu, không phải gợi ý.

---

## 2. Tóm tắt sản phẩm

### 2.1. Tên game

**Đường đua Toán học 3D**

Tên kỹ thuật trong source code: `math-runner-3d`.

### 2.2. Ý tưởng cốt lõi

Nhân vật tự chạy trên đường ba làn. Mỗi câu hỏi Toán đi kèm ba cánh cổng, mỗi cổng mang một đáp án. Học sinh chuyển làn để đi qua đáp án đúng. Trả lời đúng được cộng điểm, tăng chuỗi đúng và nhận hiệu ứng vui; trả lời sai không bị loại khỏi trò chơi mà được xem đáp án đúng rồi tiếp tục.

### 2.3. Đối tượng

- Học sinh tiểu học, ưu tiên 6–11 tuổi.
- Chơi trên điện thoại, máy tính bảng và máy tính.
- Không yêu cầu biết luật chơi phức tạp.
- Không yêu cầu đăng ký, đăng nhập hoặc nhập dữ liệu cá nhân.

### 2.4. Thời lượng

- Một lượt chơi gồm 12 câu hỏi.
- Thời lượng mục tiêu: 90–120 giây.
- Có thể chơi lại ngay sau màn tổng kết.

### 2.5. Mục tiêu trải nghiệm

- Vui trước, học sau; không tạo cảm giác đang làm bài kiểm tra.
- Người chơi hiểu cách chơi trong tối đa 10 giây.
- Không dùng thông báo mang tính chê trách.
- Không có quảng cáo, chat, mua hàng trong game hoặc dark pattern.
- Có thể chơi hoàn toàn từ static hosting; không cần backend.

### 2.6. Ngoài phạm vi phiên bản 1

Không triển khai các nội dung sau trong phiên bản đầu:

- Đăng nhập, tài khoản học sinh hoặc bảng xếp hạng trực tuyến.
- Backend, database hoặc API.
- Multiplayer.
- Cửa hàng mua vật phẩm hoặc thanh toán.
- AI tự sinh câu hỏi trên server.
- Va chạm vật lý phức tạp, nhảy, trượt hoặc đánh quái.
- Chứng nhận bám sát chương trình chính thức của Bộ Giáo dục. Các nhãn lớp chỉ thể hiện mức độ tham khảo và cần giáo viên duyệt trước nếu dùng chính thức trong trường học.

---

## 3. Gameplay chi tiết

### 3.1. Vòng chơi chính

1. Mở game và hiển thị màn hình tải tài nguyên.
2. Hiển thị trang chủ với nút **Bắt đầu** và lựa chọn lớp 1–5.
3. Người chơi chọn lớp, sau đó xem hướng dẫn điều khiển ngắn.
4. Đếm ngược `3 – 2 – 1 – CHẠY!`.
5. Nhân vật tự chạy, câu hỏi xuất hiện trên HUD.
6. Ba cánh cổng xuất hiện phía trước, mỗi cổng có một đáp án.
7. Người chơi chuyển sang làn có đáp án muốn chọn.
8. Khi nhân vật vượt qua cổng, game khóa đáp án và đưa phản hồi.
9. Lặp lại cho đến hết 12 câu.
10. Hiển thị tổng kết: số câu đúng, điểm, chuỗi đúng cao nhất, số sao và nút chơi lại.

### 3.2. Điều khiển

**Desktop**

- `ArrowLeft` hoặc `A`: sang trái một làn.
- `ArrowRight` hoặc `D`: sang phải một làn.
- `Escape`: tạm dừng/tiếp tục.
- `M`: bật/tắt âm thanh.
- Có hai nút điều khiển trái/phải trên màn hình để game vẫn chơi được bằng chuột.

**Mobile/tablet**

- Vuốt trái/phải trên vùng game.
- Hai nút cảm ứng trái/phải ở đáy màn hình.
- Ngưỡng vuốt: tối thiểu 35 px theo trục X và lớn hơn dịch chuyển trục Y.
- Mỗi gesture chỉ đổi tối đa một làn.
- CSS phải dùng `touch-action: none` cho vùng canvas để không cuộn trang khi chơi.

**BẮT BUỘC:** luôn hỗ trợ nút trên màn hình; không được chỉ dựa vào swipe hoặc bàn phím.

### 3.3. Ba làn đường

Quy ước tọa độ Three.js:

- Trục X: ngang.
- Trục Y: hướng lên.
- Trục Z âm: hướng chạy về phía trước.
- Vị trí X của ba làn: `[-2.6, 0, 2.6]`.
- Nhân vật chạy về Z âm; camera đi theo phía sau.
- Chuyển làn dùng damping/tween khoảng 220 ms, không teleport.
- Input có debounce 80 ms để tránh nhảy hai làn ngoài ý muốn.

### 3.4. Câu hỏi và cổng đáp án

- Chỉ tồn tại một câu hỏi đang hoạt động.
- Mỗi câu có đúng ba đáp án khác nhau.
- Câu hỏi hiển thị trên HUD và luôn đọc được trước khi cổng đến ít nhất 4,5 giây.
- Cổng được tạo bằng Three.js geometry; không cần model ngoài.
- Mỗi cổng gồm hai trụ, thanh ngang và một bảng đáp án.
- Bảng đáp án sử dụng `CanvasTexture` độ phân giải tối thiểu 1024×512 để chữ rõ trên màn hình retina.
- Không dùng CSS2DRenderer cho đáp án vì việc zoom trình duyệt có thể làm sai vị trí label.
- Khi qua mặt phẳng cổng, chọn làn gần nhất với X của nhân vật.
- Phát hiện vượt cổng theo đoạn chuyển động của frame, không dùng so sánh vị trí tuyệt đối duy nhất để tránh bỏ lỡ trigger khi FPS thấp:

```ts
const crossedGate = previousPlayerZ > gateZ && currentPlayerZ <= gateZ;
```

### 3.5. Tốc độ và khoảng cách

Thông số khởi tạo đề xuất:

| Thông số | Giá trị |
| --- | ---: |
| Tốc độ đầu lượt | 8 đơn vị/giây |
| Tốc độ tối đa | 12 đơn vị/giây |
| Tăng tốc sau mỗi câu | 0,28 đơn vị/giây |
| Cổng đầu tiên | Cách người chơi 48 đơn vị |
| Khoảng cách cổng tiếp theo | 45–55 đơn vị |
| Thời gian feedback | 800 ms |
| Thời gian chuyển làn | 220 ms |
| Số câu/lượt | 12 |

Nếu qua thử nghiệm thực tế học sinh lớp 1 không đủ thời gian đọc, giảm tốc riêng cho lớp 1 xuống 7 đơn vị/giây và không tăng quá 9,5.

### 3.6. Điểm số

- Đúng: 100 điểm.
- Thưởng tốc độ: tối đa 50 điểm, giảm tuyến tính theo thời gian từ lúc hiển thị câu hỏi đến lúc qua cổng.
- Thưởng chuỗi đúng:
  - Chuỗi 2–3: `+10%`.
  - Chuỗi 4–5: `+20%`.
  - Chuỗi từ 6: `+30%`.
- Sai: 0 điểm cho câu đó, không trừ điểm tổng.
- Sai sẽ đưa chuỗi đúng hiện tại về 0.
- Điểm phải là số nguyên.

### 3.7. Sao cuối lượt

| Kết quả | Số sao |
| --- | ---: |
| 10–12 câu đúng | 3 |
| 7–9 câu đúng | 2 |
| 0–6 câu đúng | 1 |

Luôn trao ít nhất một sao để trẻ có cảm giác đã hoàn thành lượt chơi.

### 3.8. Phản hồi đúng/sai

**Đúng**

- Cổng đúng đổi sang xanh lá.
- Phát âm thanh vui ngắn.
- Hiện `Chính xác! +... điểm` trong khoảng 800 ms.
- Tạo burst 8–12 đồng xu/particle, nhưng giới hạn tổng particle.
- Nhân vật tiếp tục chạy, không dừng hoàn toàn.

**Sai**

- Cổng đã chọn chuyển cam, không dùng đỏ chói toàn màn hình.
- Cổng đúng được highlight xanh.
- Hiện `Gần đúng rồi! Đáp án là ...`.
- Tốc độ thế giới giảm nhẹ khoảng 15% trong 500 ms rồi trở lại.
- Không rung màn hình mạnh, không phát âm thanh gây giật mình.

### 3.9. Tạm dừng và mất focus

- Khi tab bị ẩn hoặc cửa sổ mất focus, tự động pause.
- Pause phải dừng clock gameplay, animation tiến trình, spawn và tính thưởng tốc độ.
- Nhạc nền giảm hoặc pause.
- Khi quay lại, hiển thị overlay và yêu cầu người dùng bấm **Tiếp tục**; không tự chạy ngay.

---

## 4. Nội dung Toán học

### 4.1. Mô hình dữ liệu

```ts
export type Grade = 1 | 2 | 3 | 4 | 5;
export type Topic =
  | 'addition'
  | 'subtraction'
  | 'multiplication'
  | 'division'
  | 'comparison'
  | 'missing-number'
  | 'decimal'
  | 'fraction';

export interface Question {
  id: string;
  grade: Grade;
  topic: Topic;
  prompt: string;
  answers: [string, string, string];
  correctIndex: 0 | 1 | 2;
  explanation: string;
}
```

`answers` là string để hiển thị được số thập phân dạng Việt Nam (`2,5`) và phân số (`3/4`) mà không phụ thuộc sai số số thực.

### 4.2. Nội dung theo lớp

| Lớp | Chủ đề dùng trong game | Giới hạn |
| --- | --- | --- |
| 1 | Cộng, trừ, so sánh, số còn thiếu | Trong phạm vi 20; phép trừ không âm |
| 2 | Cộng/trừ, so sánh, số còn thiếu | Trong phạm vi 100 |
| 3 | Nhân/chia, cộng/trừ | Bảng nhân 2–9; chia hết; cộng/trừ trong 1.000 |
| 4 | Nhân, chia, biểu thức hai bước | Nhân với số một chữ số; chia hết; không có số âm |
| 5 | Thập phân đơn giản, phân số cùng mẫu, biểu thức | Tối đa một chữ số thập phân; phân số tối giản nhỏ |

### 4.3. Quy tắc sinh câu hỏi

- Dùng seeded pseudo-random generator để test tái lập được.
- Mỗi lượt tạo seed từ thời gian, nhưng cho phép truyền seed qua query string trong môi trường dev: `?seed=12345&grade=2`.
- Không lặp cùng `prompt` trong một lượt.
- Không đặt đáp án đúng cùng một làn quá hai câu liên tiếp.
- Ba đáp án phải khác nhau sau khi format.
- Distractor phải hợp lý, gần đáp án đúng; không dùng số ngẫu nhiên quá xa.
- Không sinh kết quả âm ở lớp 1–4.
- Phép chia luôn chia hết.
- Với số thập phân, tính bằng số nguyên theo đơn vị phần mười rồi mới format, không cộng trực tiếp số float.
- Phân số phiên bản đầu chỉ dùng cùng mẫu số và mẫu thuộc `{2, 3, 4, 5, 8, 10}`.
- Phải có unit test property-based theo vòng lặp ít nhất 1.000 câu mỗi lớp để phát hiện đáp án trùng, phép chia không hết, index sai hoặc kết quả ngoài phạm vi.

### 4.4. Gợi ý tạo distractor

```ts
function createIntegerDistractors(correct: number, scale: number): number[] {
  // candidate offsets phụ thuộc scale, ví dụ:
  // scale <= 20: ±1, ±2, ±3
  // scale <= 100: ±1, ±5, ±10
  // scale > 100: ±10, ±50, ±100
  // Xáo trộn bằng seeded RNG, lọc số âm và loại trùng.
}
```

Với phép nhân/chia, ưu tiên lỗi học sinh thường gặp:

- `a × b`: `(a ± 1) × b`, `a × (b ± 1)`.
- `a ÷ b`: thương đúng `±1`, hoặc nhầm với `b` nếu không trùng.
- Số còn thiếu: dùng số gần giá trị đúng, không dùng kết quả của cả biểu thức làm distractor một cách vô nghĩa.

### 4.5. Dữ liệu mẫu bắt buộc

Ngoài bộ sinh tự động, tạo ít nhất 10 câu handcrafted cho mỗi lớp trong `src/content/seed-questions.ts`. Dùng các câu này cho smoke test, demo cố định và làm fallback nếu generator phát hiện không đủ câu hợp lệ.

Ví dụ:

```ts
{
  id: 'g1-add-001',
  grade: 1,
  topic: 'addition',
  prompt: '8 + 7 = ?',
  answers: ['13', '15', '17'],
  correctIndex: 1,
  explanation: '8 cộng 7 bằng 15.'
}
```

**BẮT BUỘC:** phần logic xác định đáp án đúng phải được unit test độc lập với Three.js.

---

## 5. Thiết kế hình ảnh và UI

### 5.1. Art direction bắt buộc: “Toy Adventure Arcade”

Giao diện phải trông như một trò chơi casual 3D dành cho trẻ em, không phải một web app giáo dục. Toàn bộ trải nghiệm là **một thế giới game liên tục**: từ trang chủ, chọn lớp, hướng dẫn, chạy, pause đến tổng kết đều dùng lại cảnh đường đua 3D, nhân vật và vật thể trong game. DOM chỉ là lớp HUD cần thiết phủ lên thế giới, không trở thành bố cục chính.

Từ khóa hình ảnh:

- Low-poly 3D, toy-like, arcade runner, vui nhộn, nhiều năng lượng.
- Hình khối chắc, màu no vừa phải, viền tối mềm và bóng đổ rõ.
- Nút có chiều sâu giống nút trong game mobile: mặt sáng, cạnh dưới đậm, bấm xuống có cảm giác vật lý.
- Nhân vật luôn là tâm điểm cảm xúc: idle ở menu, chạy ở gameplay, ăn mừng ở kết quả.
- Cổng, đồng xu, cờ đích, rương kho báu và bảng hiệu là ngôn ngữ thị giác xuyên suốt.
- Cảnh vật 3D chiếm 100% viewport; UI chỉ phủ khoảng 15–25% diện tích khi đang chơi.
- Không dùng hình AI trong phiên bản 1; model lấy từ nguồn mở đã liệt kê hoặc dựng bằng primitive Three.js.

Mục tiêu khi nhìn screenshot trang chủ: người xem phải nhận ra đây là game ngay cả khi chưa đọc chữ.

### 5.2. Những biểu hiện “vibe-code/web app” bị cấm

**BẮT BUỘC:** Claude Code không được dùng các lựa chọn sau làm ngôn ngữ thiết kế chính:

- Khung trắng lớn bo góc nằm giữa màn hình rồi đặt toàn bộ nội dung vào đó.
- Glassmorphism mờ kính, blur dày hoặc hàng loạt card trong suốt.
- Hero website gồm title, subtitle, hai CTA và ảnh minh họa bên cạnh.
- Grid card kiểu dashboard/SaaS cho lựa chọn lớp.
- Gradient tím–xanh chung chung, blob mờ, vòng sáng neon hoặc họa tiết AI.
- Nút phẳng giống form website hoặc button Tailwind mặc định.
- Icon line-art mảnh, font Inter/Roboto và khoảng trắng quá rộng kiểu landing page.
- Thanh navigation website, footer dài, breadcrumb hoặc menu hamburger kiểu trang nội dung.
- Emoji hệ thống dùng thay icon game.
- Các đoạn mô tả dài xuất hiện trong luồng chơi.
- Tách menu thành một trang HTML trắng hoàn toàn khác với cảnh gameplay.

Cho phép dùng panel DOM ở pause/kết quả, nhưng panel phải được thiết kế như **bảng gỗ/bảng nhiệm vụ/hộp game nổi**, có viền dày, highlight và bóng đổ; không giống modal SaaS.

### 5.3. Phong cách thế giới 3D

- Bối cảnh là đường đua nổi trên thung lũng xanh, bầu trời xanh sáng, mây low-poly trôi chậm.
- Đường chạy rộng ba làn, mép đường rõ, có cờ tam giác và biển chỉ dẫn hai bên.
- Đầu đường có cổng xuất phát; cuối lượt là cổng đích kẻ caro và rương kho báu.
- Cây, đá, hàng rào và bụi cỏ tạo nhịp điệu nhưng không che cổng đáp án.
- Dùng parallax nhẹ: foreground di chuyển nhanh, đồi/mây ở xa chậm hơn.
- Mỗi vài segment có một điểm nhấn nhỏ: cụm bóng bay, vòng sao, cờ hoặc bảng số câu.
- Đáp án nằm trực tiếp trên ba cổng 3D, không đặt thành ba button HTML ở đáy màn hình.
- Bóng đổ mềm; ambient đủ sáng để nhân vật không tối mặt.
- Camera góc 3/4 phía sau, hơi thấp để tạo cảm giác tốc độ nhưng vẫn nhìn rõ ba cổng.
- Sử dụng fog sáng ở xa để cảnh có chiều sâu và che việc recycle segment.

### 5.4. Bảng màu

| Vai trò | Màu |
| --- | --- |
| Bầu trời | `#BFE8FF` |
| Cỏ | `#78C850` |
| Đường | `#596A7A` |
| Vạch đường | `#F8FAFC` |
| Primary/button chơi | `#FFB703` |
| Cạnh dưới button primary | `#D97904` |
| Secondary/UI xanh | `#21B6D7` |
| Cạnh dưới button secondary | `#117C9B` |
| Tím huy hiệu | `#7B61E8` |
| Viền UI tối | `#243B53` |
| Mặt panel kem | `#FFF4C7` |
| Viền panel gỗ | `#A9602A` |
| Đúng | `#2ECC71` |
| Sai/nhắc thử lại | `#FF8A65` |
| Thưởng/đồng xu | `#FFD166` |
| Chữ chính | `#183153` |
| Overlay tối | `rgba(12, 24, 45, 0.72)` |

Quy tắc phối màu:

- Mỗi control chỉ có một màu chính, một màu cạnh dưới và một viền tối.
- Tránh gradient nhiều màu. Chỉ cho phép gradient rất nhẹ trên mặt nút để tạo highlight vật liệu.
- Trạng thái đúng/sai vẫn phải có chữ/biểu tượng, không chỉ đổi màu.
- Không dùng đỏ thuần cho sai; dùng cam san hô để phản hồi nhẹ nhàng.

### 5.5. Typography mang tính game

Self-host **Baloo 2 Variable** cho toàn bộ title, số điểm, câu hỏi và button. Font này có giấy phép SIL Open Font License 1.1 và có Vietnamese subset. Không gọi Google Fonts CDN.

```css
@font-face {
  font-family: "Baloo 2";
  src: url("/assets/fonts/baloo2/Baloo2-Variable.ttf") format("truetype");
  font-weight: 400 800;
  font-style: normal;
  font-display: swap;
}

:root {
  font-family: "Baloo 2", ui-rounded, "Segoe UI", Arial, sans-serif;
}
```

Nếu font chưa load, fallback phải vẫn đọc được; không chặn game vì font.

Quy tắc chữ:

- Tên game: weight 800, chữ xếp hai dòng, hơi nghiêng/rotate từng cụm tối đa 2 độ; dùng stroke hoặc nhiều lớp `text-shadow` để tạo chiều sâu.
- Câu hỏi: weight 800, tối thiểu 32 px trên mobile và 46 px trên desktop.
- Đáp án trên cổng: weight 800, CanvasTexture độ phân giải cao; chữ trắng hoặc xanh đậm có stroke tương phản.
- Button: weight 800, chữ ngắn, không viết hoa toàn bộ trừ `CHẠY!`.
- Số điểm và streak: tabular numbers nếu có; kích thước lớn hơn label.
- Body/giải thích: weight 600 để giữ nét tròn và dễ đọc.
- Không dùng font mảnh dưới 500.
- Button mobile có vùng chạm tối thiểu 56×56 px.

### 5.6. Hệ thống nút game

Nút chính không được là hình chữ nhật phẳng. Tạo component `.game-button` dùng HTML `button` thật, nhưng trình bày như vật thể game:

```css
.game-button {
  min-height: 60px;
  padding: 10px 28px 8px;
  border: 3px solid #243b53;
  border-radius: 18px;
  background: linear-gradient(#ffd35c, #ffb703);
  box-shadow:
    0 7px 0 #d97904,
    0 10px 0 #243b53,
    0 14px 22px rgba(25, 45, 70, 0.28),
    inset 0 3px 0 rgba(255, 255, 255, 0.65);
  color: #183153;
  font: 800 24px/1 "Baloo 2", sans-serif;
  text-shadow: 0 2px 0 rgba(255, 255, 255, 0.35);
  cursor: pointer;
  transform: translateY(0);
  transition: transform 90ms ease, box-shadow 90ms ease, filter 120ms ease;
}

.game-button:hover {
  filter: brightness(1.06) saturate(1.05);
  transform: translateY(-2px) scale(1.02);
}

.game-button:active {
  transform: translateY(7px) scale(0.99);
  box-shadow:
    0 1px 0 #d97904,
    0 3px 0 #243b53,
    inset 0 3px 0 rgba(255, 255, 255, 0.45);
}

.game-button:focus-visible {
  outline: 5px solid #ffffff;
  outline-offset: 4px;
}
```

Yêu cầu:

- Nút **Bắt đầu** lớn nhất màn hình, có icon tam giác Play vẽ bằng CSS/SVG nội bộ.
- Nút phụ dùng xanh cyan hoặc tím nhưng vẫn có cạnh dưới đậm.
- Nút icon tròn cho pause/mute, tối thiểu 52×52 px.
- Nút disabled giảm saturation, không chỉ giảm opacity đến mức khó đọc.
- Icon là SVG nội bộ đơn giản hoặc hình khối CSS; không dùng emoji.

### 5.7. Cấu trúc lớp hiển thị

```text
Layer 1 — Three.js background/world: luôn full viewport
Layer 2 — World effects: particle, gate feedback, finish line
Layer 3 — HUD tối thiểu: câu hỏi, tiến trình, điểm, pause/mute
Layer 4 — Screen overlay: loading/home/tutorial/pause/result
Layer 5 — Toast/feedback ngắn
```

- `canvas` dùng `position: fixed; inset: 0; width: 100%; height: 100%`.
- `#game-ui` phủ toàn viewport nhưng chỉ vùng control có `pointer-events: auto`.
- Ở Home/Result, cảnh 3D vẫn render ở tốc độ giới hạn 30 FPS nếu cần tiết kiệm máy.
- Chuyển màn hình bằng camera move, character animation và overlay transition; không trắng màn hình giữa các state.

### 5.8. Bố cục từng màn hình

#### Loading — nhân vật đang chuẩn bị xuất phát

- Cảnh 3D đơn giản hiện càng sớm càng tốt: đường đua mờ phía sau hoặc màu trời/cỏ fallback.
- Nhân vật chạy tại chỗ hoặc silhouette nhỏ chạy trên thanh tiến trình.
- Thanh loading là một đoạn đường có vạch, cờ caro ở cuối; đồng xu chạy dọc theo tiến trình.
- Tên game ở 1/3 trên màn hình, không đặt trong card.
- Dòng trạng thái ngắn: `Đang mở đường đua...`, `Đang gọi bạn đồng hành...`, `Đang xếp các cánh cổng...`.
- Progress phải lấy từ `THREE.LoadingManager`; chỉ phần câu chữ được luân phiên cho vui.
- Nếu lỗi, hiện bảng game nhỏ có **Thử lại**, không thay bằng trang lỗi kỹ thuật.

#### Home — màn hình “attract mode” như game thật

Home không phải landing page. Dùng bố cục sau:

| Vùng | Desktop | Mobile portrait |
| --- | --- | --- |
| Thế giới 3D | Toàn màn hình, camera thấp nhìn dọc đường đua | Toàn màn hình, camera gần nhân vật hơn |
| Nhân vật | Lệch trái khoảng 28–35%, idle/vẫy tay | Giữa-dưới, chiếm khoảng 30% chiều cao |
| Logo/tên game | Phía trên trung tâm hoặc trên-phải | Trên cùng, tối đa 28% chiều cao |
| Chọn lớp | Hàng huy hiệu ở dưới logo | Hàng 5 huy hiệu gọn trên nút chơi |
| Bắt đầu | Nút lớn cạnh nhân vật/giữa dưới | Nút lớn giữa, ngay trên safe area |
| Mute/Credits | Hai nút icon nhỏ ở hai góc | Hai nút icon nhỏ ở hai góc |

Chi tiết:

- Tên `ĐƯỜNG ĐUA` và `TOÁN HỌC` là logo chữ game hai tầng, outline xanh đậm, face vàng/cyan, có cờ caro hoặc tia tốc độ nhỏ.
- Nhân vật `character-oopi` idle/vẫy tay; camera drift chậm 2–3 độ tạo sự sống.
- Phía xa có ba cổng mẫu và đồng xu quay; world chuyển động nhẹ dù chưa chơi.
- Không có subtitle marketing. Chỉ cho phép một câu ngắn: `Chọn lớp và cùng chạy nào!`.
- Chọn lớp bằng năm **huy hiệu/medal** `Lớp 1`…`Lớp 5`, không dùng dropdown, tabs web hoặc card mô tả.
- Huy hiệu đang chọn nổi lớn 1.08×, phát sáng nhẹ và có star/check; các huy hiệu khác vẫn thấy rõ.
- Nút **Bắt đầu** có nhịp thở rất nhẹ sau 3 giây không thao tác; không rung liên tục.
- Nút bật/tắt âm thanh và **Nguồn tài nguyên mở** là hai nút icon phụ, không tạo navigation bar.

#### Chọn lớp — badge, không phải form

- Mỗi lớp là một badge hình khiên/medal vẽ bằng CSS/SVG, màu riêng nhưng cùng hệ thống.
- Chỉ hiển thị `Lớp 1`…`Lớp 5`; không thêm các đoạn mô tả dài.
- Khi chọn, character có emote yes ngắn, badge bật lên và phát `switch.ogg`.
- Selected grade phải dễ nhận biết bằng scale + check/star + màu, không chỉ border.

#### Hướng dẫn — chơi thử ngay trong thế giới

- Không dùng slide/card hướng dẫn tĩnh.
- Chuyển camera vào đường đua training ngắn; ba làn hiện bằng vạch sáng.
- Một bàn tay/arrow SVG animation từ giữa sang trái/phải; dùng icon touch/keyboard tùy thiết bị.
- Dòng duy nhất: `Vuốt hoặc bấm ◀ ▶ để chọn cổng đúng`.
- Người chơi phải đổi làn thử một lần; character chạy sang lane, lane sáng lên.
- Sau khi thao tác đúng, cổng training mở, xuất hiện nút **Sẵn sàng!**.
- Chỉ hiện đầy đủ ở lần đầu; lần sau có nút nhỏ **Bỏ qua hướng dẫn**.

#### Countdown — khoảnh khắc vào game

- Camera hạ xuống vị trí gameplay trong khoảng 700 ms.
- Character vào tư thế chạy, cổng xuất phát đóng phía trước.
- Số `3`, `2`, `1` xuất hiện cực lớn giữa màn hình với squash-and-pop; mỗi số có âm click/pitch khác nhau.
- `CHẠY!` màu vàng, có tia tốc độ và cổng xuất phát mở.
- Không bọc countdown trong panel.

#### Gameplay HUD — tối thiểu, rõ và có chất game

- **Trên trái:** badge tiến trình hình cờ `4/12`, cạnh đó là đường progress nhỏ chạy tới icon cờ đích.
- **Trên giữa:** bảng câu hỏi giống bảng nhiệm vụ/biển đường, nền kem sáng, viền xanh đậm hoặc gỗ, tối đa 60% chiều rộng desktop và 78% mobile.
- **Trên phải:** coin badge gồm icon/model đồng xu + số điểm lớn; không dùng label `Điểm:` kiểu form.
- **Bên dưới câu hỏi:** streak chỉ hiện từ ×2, dùng icon tia chớp/lửa + `Chuỗi ×3`, bounce một lần khi tăng.
- **Hai góc dưới:** button trái/phải như hai pad arcade lớn, trong suốt vừa đủ nhưng vẫn có cạnh nổi; trên desktop giảm opacity khi dùng keyboard.
- **Pause/mute:** nút icon tròn ở mép trên, có `aria-label`, không cạnh tranh với câu hỏi.
- Không đặt ba đáp án trong HUD; đáp án phải gắn trên cổng trong world.

HUD tự thu gọn:

- Khi hiện feedback đúng/sai, question board thu nhỏ hoặc fade nhẹ để dành focus cho cổng.
- Trên mobile landscape, question board dịch lên sát safe area và giảm chiều cao.
- Không để UI che nhân vật hoặc mặt cổng trong “reading zone” từ 25% đến 72% chiều cao viewport.

#### Cổng đáp án — hero UI nằm trong 3D world

- Ba cổng có cùng hình dáng, màu base theo lane: xanh dương, tím, vàng; không gợi ý đáp án đúng trước khi chọn.
- Bảng số treo giữa cổng, viền dày, mặt sáng, chữ lớn có stroke.
- Khi cổng tiến gần, bảng số scale theo perspective tự nhiên; không animate rung.
- Cổng được chọn có vòng sáng ở chân khi nhân vật đã khóa lane gần trigger.
- Đúng: cổng xanh lá, sao/đồng xu burst và thanh ngang mở như portal.
- Sai: cổng chọn chuyển cam san hô, cổng đúng phát viền xanh; không làm toàn màn hình đỏ.

#### Feedback — nằm trong hành động

- Đúng: `CHÍNH XÁC!` pop ở ngay trên character/cổng, không mở modal; điểm bay về coin badge.
- Sai: `GẦN ĐÚNG RỒI!` và `Đáp án: 15` hiện trong ribbon nhỏ khoảng 800 ms.
- Dùng motion path cho 3–5 đồng xu bay về điểm; particle còn lại biến mất tại chỗ.
- Character emote ngắn, camera vẫn tiến nhẹ để không phá nhịp chạy.
- Streak milestone 3/5/10 có callout lớn hơn nhưng tối đa 700 ms.

#### Pause — bảng game nổi, cảnh vẫn thấy phía sau

- Freeze gameplay và dim scene bằng overlay; không blur quá 4 px.
- Panel pause như bảng gỗ treo bằng hai dây hoặc bảng chỉ dẫn, rộng tối đa 420 px.
- Tiêu đề `Tạm dừng` lớn, icon cờ/đồng hồ nhỏ.
- Ba nút xếp dọc: **Tiếp tục** (vàng), **Chơi lại** (cyan), **Về trang chủ** (trung tính).
- Chơi lại phải có xác nhận ngắn vì làm mất lượt hiện tại.
- Nhân vật giữ idle ở hậu cảnh; nếu performance thấp có thể freeze render.
- Không có nút close `×` nhỏ kiểu modal web; dùng nút **Tiếp tục** và phím Escape.

#### Result — về đích và nhận thưởng

- Đây là một scene game, không phải bảng thống kê dashboard.
- Character đứng trên bục hoặc trước rương kho báu tại cổng đích, phát `emote-yes`.
- 1–3 ngôi sao bay vào từng vị trí theo nhịp, có ánh sáng/âm thanh nhỏ.
- Kết quả chính dùng câu `Bạn chinh phục 10/12 cánh cổng!` thay vì văn phong bài thi.
- Điểm là số lớn cạnh đồng xu; kỷ lục mới có ribbon `KỶ LỤC MỚI!`.
- Best streak hiện bằng tia chớp nhỏ; không tạo nhiều ô KPI/card.
- Nút **Chạy lại** lớn; nút **Chọn lớp khác** nhỏ hơn.
- Sau 1–2 giây, rương mở và coin bay lên; giới hạn particle theo quality.
- Không dùng lời chê nếu kết quả thấp.

#### Credits

- Mở từ nút icon nhỏ ở Home.
- Dùng scroll panel kiểu bảng nhiệm vụ, không rời khỏi scene.
- Chỉ ghi nguồn/tác giả/license và nút **Quay lại**.
- Không biến Credits thành footer website.

### 5.9. Chuyển cảnh và motion language

- Home → Tutorial: camera dolly theo nhân vật vào vạch xuất phát, 600–900 ms.
- Tutorial → Countdown: overlay biến mất, gate xuất phát đóng lại rồi countdown.
- Câu đúng: pop/bounce nhanh, ease-out; không kéo dài.
- Câu sai: chuyển động nhẹ hơn, không shake mạnh.
- Gameplay → Result: nhân vật chạy qua cờ đích, camera vòng nhẹ ra phía trước rồi reveal bục/rương.
- Button hover/press dùng 90–140 ms; panel enter 250–350 ms; camera transition 600–1.000 ms.
- Không animate mọi thứ cùng lúc. Mỗi thời điểm chỉ có một điểm focus chính.
- `prefers-reduced-motion` bỏ camera orbit, coin flight phức tạp và squash mạnh; vẫn giữ phản hồi trạng thái rõ.

### 5.10. Responsive

- Hỗ trợ từ 360×640 trở lên.
- Portrait mobile là layout ưu tiên.
- Desktop hỗ trợ tới 1920×1080 và màn hình rộng hơn.
- Dùng CSS safe-area cho thiết bị có notch:

```css
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
```

- Khi resize, cập nhật aspect camera, renderer, canvas texture nếu cần và vùng điều khiển.
- Không reload game khi đổi orientation.

### 5.11. Khả năng tiếp cận

- Mọi button DOM phải dùng phần tử `button` thật.
- Có `aria-label` cho icon-only button.
- Không phân biệt đúng/sai chỉ bằng màu; luôn có chữ và biểu tượng.
- Tôn trọng `prefers-reduced-motion`: giảm confetti, camera bob và animation giao diện.
- Tôn trọng trạng thái mute đã lưu.
- Không bắt buộc fullscreen.

### 5.12. Tiêu chí nghiệm thu hình ảnh

Claude Code phải tự chụp screenshot và đối chiếu các câu hỏi sau:

- Nếu che toàn bộ chữ, screenshot có còn nhìn giống game runner không?
- Cảnh 3D có chiếm toàn viewport hay bị panel HTML lấn át?
- Home có nhân vật, đường đua, cổng và chuyển động nền hay chỉ là hero website?
- Nút có mặt, cạnh dưới, viền và trạng thái press rõ hay là button phẳng?
- Grade selector có giống badge game hay giống tab/form?
- HUD có tối giản và neo theo góc màn hình không?
- Đáp án có thực sự nằm trên cổng 3D không?
- Result có khoảnh khắc về đích/trao sao hay chỉ là ba card thống kê?
- Có bất kỳ glass card, gradient blob hoặc dashboard layout nào không? Nếu có, phải sửa.
- Font tiếng Việt có hiển thị đúng dấu ở các chuỗi `ĐƯỜNG ĐUA TOÁN HỌC`, `Chính xác`, `Gần đúng rồi`, `Chọn lớp khác` không?

**BẮT BUỘC:** Milestone UI chỉ đạt khi cả screenshot desktop và mobile trả lời đạt tất cả tiêu chí trên.

---

## 6. Stack kỹ thuật đã chốt

### 6.1. Công nghệ

- **Vite + Vanilla TypeScript**: không dùng React/Vue để giảm bundle và độ phức tạp.
- **Three.js**: dựng cảnh 3D, animation và tải GLB.
- **Howler.js**: quản lý nhạc/SFX và xử lý Web Audio/HTML5 Audio fallback.
- **Vitest**: unit test logic thuần.
- **Playwright**: end-to-end và smoke test trên Chromium; chạy thêm WebKit nếu môi trường cho phép.
- **ESLint + Prettier**: chất lượng code.

Không dùng physics engine. Game chỉ cần chuyển làn và trigger qua cổng; hitbox tự viết sẽ đơn giản, ổn định và nhẹ hơn.

### 6.2. Phiên bản đã kiểm tra ngày 12/08/2026

| Package | Version | License |
| --- | ---: | --- |
| `three` | `0.185.1` | MIT |
| `howler` | `2.2.4` | MIT |
| `vite` | `8.2.1` | MIT |
| `typescript` | `7.0.2` | Apache-2.0 |
| `vitest` | `4.1.10` | MIT |
| `@playwright/test` | `1.62.1` | Apache-2.0 |
| `@types/three` | `0.185.4` | MIT |
| `@types/howler` | `2.2.13` | MIT |
| `eslint` | `10.8.1` | MIT |
| `@eslint/js` | `10.0.1` | MIT |
| `typescript-eslint` | `8.67.0` | MIT |
| `globals` | `17.10.0` | MIT |
| `prettier` | `3.9.6` | MIT |

Nếu triển khai vào thời điểm khác, ưu tiên giữ các phiên bản trên để kết quả tái lập. Chỉ nâng version trong một commit riêng sau khi toàn bộ test đang xanh.

### 6.3. Yêu cầu môi trường

- Node.js tối thiểu theo Vite: `20.19+` hoặc `22.12+`; khuyến nghị Node `24.x`.
- npm `11.x`.
- Git.
- Chrome/Edge hiện đại; Safari iOS hiện đại.
- Không cần Docker.

Kiểm tra:

```bash
node --version
npm --version
git --version
```

### 6.4. Khởi tạo repository trống

Chỉ chạy nếu thư mục chưa có ứng dụng:

```bash
npm create vite@9.1.2 . -- --template vanilla-ts --no-interactive
npm install three@0.185.1 howler@2.2.4
npm install -D typescript@7.0.2 @types/three@0.185.4 @types/howler@2.2.13 vitest@4.1.10 @playwright/test@1.62.1 eslint@10.8.1 @eslint/js@10.0.1 typescript-eslint@8.67.0 globals@17.10.0 prettier@3.9.6
npx playwright install chromium
```

Không chạy scaffold vào repository đã có code trước khi kiểm tra và thống nhất cấu trúc hiện tại.

### 6.5. Scripts bắt buộc trong `package.json`

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b --pretty false",
    "lint": "eslint . --max-warnings=0",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "check": "npm run typecheck && npm run lint && npm run format:check && npm run test && npm run build"
  }
}
```

---

## 7. Tài nguyên mở và cách tải

### 7.1. Nguyên tắc giấy phép

- Source code của game phát hành theo MIT.
- Model, texture và audio Kenney dùng CC0.
- Nhạc nền được chọn cụ thể từ một submission CC0 trên OpenGameArt.
- Font Baloo 2 dùng SIL Open Font License 1.1 và được self-host trong game.
- Giữ bản sao `License.txt`/`readme.txt` của từng bộ trong repository.
- Không lấy file từ Google Images, YouTube, Pinterest hoặc trang “free download” không ghi giấy phép rõ ràng.
- Không xem “royalty free” là đồng nghĩa với open source/CC0.

### 7.2. Bộ asset bắt buộc

#### A. Kenney Platformer Kit 4.1 — model 3D

- Trang ổn định: <https://kenney.nl/assets/platformer-kit>
- License: Creative Commons CC0.
- Direct ZIP đã xác minh ngày 12/08/2026:  
  <https://kenney.nl/media/pages/assets/platformer-kit/1585cf62b4-1775122253/kenney_platformer-kit.zip>

Chỉ đưa các file sau vào game:

```text
Models/GLB format/character-oopi.glb
Models/GLB format/coin-gold.glb
Models/GLB format/chest.glb
Models/GLB format/crate.glb
Models/GLB format/flag.glb
Models/GLB format/fence-low-straight.glb
Models/GLB format/rocks.glb
Models/GLB format/tree.glb
Models/GLB format/tree-pine.glb
Models/GLB format/Textures/colormap.png
License.txt
```

`character-oopi.glb` đã được xác minh có các animation clip:

```text
static, idle, walk, sprint, jump, fall, crouch, sit, drive, die,
pick-up, emote-yes, emote-no, holding-right, holding-left,
holding-both, holding-right-shoot, holding-left-shoot,
holding-both-shoot, attack-melee-right, attack-melee-left,
attack-kick-right, attack-kick-left, interact-right, interact-left
```

Dùng `sprint` khi chạy, `idle` ở menu/pause, `emote-yes` khi trả lời đúng và `emote-no` rất ngắn khi trả lời sai. Không dùng `die` cho phản hồi sai.

**Quan trọng:** các file GLB tham chiếu `Textures/colormap.png`. Phải giữ đúng cấu trúc tương đối:

```text
public/assets/models/platformer/
├── character-oopi.glb
├── chest.glb
├── coin-gold.glb
├── crate.glb
├── fence-low-straight.glb
├── flag.glb
├── rocks.glb
├── tree.glb
├── tree-pine.glb
└── Textures/
    └── colormap.png
```

#### B. Kenney UI Audio 1.0 — click và switch

- Trang ổn định: <https://kenney.nl/assets/ui-audio>
- License: Creative Commons CC0.
- Direct ZIP đã xác minh:  
  <https://kenney.nl/media/pages/assets/ui-audio/490d233f68-1677590494/kenney_ui-audio.zip>

Lấy:

```text
Audio/click1.ogg
Audio/rollover1.ogg
Audio/switch1.ogg
License.txt
```

Không bắt buộc phát rollover trên mobile.

#### C. Kenney Music Jingles 1.0 — feedback

- Trang ổn định: <https://kenney.nl/assets/music-jingles>
- License: Creative Commons CC0.
- Direct ZIP đã xác minh:  
  <https://kenney.nl/media/pages/assets/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip>

Lấy tối thiểu:

```text
Audio/Pizzicato jingles/jingles_PIZZI00.ogg
Audio/Pizzicato jingles/jingles_PIZZI03.ogg
Audio/Pizzicato jingles/jingles_PIZZI07.ogg
Audio/8-Bit jingles/jingles_NES13.ogg
License.txt
```

Claude Code phải nghe thử các file và map theo cảm xúc. Mapping khởi tạo đề xuất:

| Event | File gợi ý |
| --- | --- |
| Đúng | `jingles_PIZZI00.ogg` |
| Sai nhẹ | `jingles_NES13.ogg` |
| Hoàn thành | `jingles_PIZZI07.ogg` |
| Kỷ lục mới | `jingles_PIZZI03.ogg` |

Nếu đổi mapping, không đổi nguồn và phải ghi trong `ASSET_SOURCES.md`.

#### D. Children’s March Theme — nhạc nền

- Trang nguồn: <https://opengameart.org/content/childrens-march-theme>
- Tác giả: Cleyton Kauffman.
- License hiển thị trên submission: CC0.
- Bản nhạc loop liền, dài khoảng 1:04; có WAV, MP3 và OGG.
- Direct ZIP:  
  <https://opengameart.org/sites/default/files/childrens_march_theme.zip>

Lấy file:

```text
Children's March Theme.ogg
readme.txt
```

Đổi tên khi đưa vào public:

```text
public/assets/audio/music/childrens-march-theme.ogg
```

Dùng OGG để loop liền; không dùng MP3 vì có thể xuất hiện khoảng hở khi lặp.

#### E. Baloo 2 Variable — font giao diện game có hỗ trợ tiếng Việt

- Trang nguồn chính thức: <https://github.com/google/fonts/tree/main/ofl/baloo2>
- File: `Baloo2[wght].ttf`.
- License: SIL Open Font License 1.1.
- Metadata chính thức ghi có Vietnamese subset.
- Direct file:  
  <https://raw.githubusercontent.com/google/fonts/main/ofl/baloo2/Baloo2%5Bwght%5D.ttf>
- License file:  
  <https://raw.githubusercontent.com/google/fonts/main/ofl/baloo2/OFL.txt>

Đổi tên và đặt tại:

```text
public/assets/fonts/baloo2/Baloo2-Variable.ttf
public/assets/licenses/Baloo2-OFL.txt
```

Không gọi `fonts.googleapis.com` hoặc bất kỳ font CDN nào trong production.

### 7.3. Tải thủ công

Nếu không dùng script:

1. Mở từng trang nguồn ổn định.
2. Bấm **Download**.
3. Chọn **Continue without donating...** nếu không quyên góp.
4. Giải nén vào thư mục tạm ngoài `public/`.
5. Kiểm tra file giấy phép trong ZIP.
6. Chỉ copy các file được liệt kê ở trên.
7. Không commit nguyên ZIP hoặc toàn bộ asset pack.

### 7.4. Script tải asset Claude Code phải tạo

Tạo cả:

```text
scripts/fetch-assets.sh
scripts/fetch-assets.ps1
```

Yêu cầu cho hai script:

- Tải ZIP vào `.cache/game-assets/`.
- Kiểm tra HTTP status và dừng nếu download lỗi.
- Giải nén vào thư mục tạm nằm trong `.cache/game-assets/`.
- Copy đúng whitelist file vào `public/assets/`.
- Giữ `Textures/colormap.png` đúng vị trí tương đối.
- Tải/copy Baloo 2 và OFL license vào đúng vị trí; kiểm tra font tồn tại trước khi báo thành công.
- Copy giấy phép vào `public/assets/licenses/` với tên không trùng.
- Không xóa thư mục rộng hoặc đường dẫn do biến môi trường chưa được xác minh.
- Chạy lặp lại không làm hỏng dữ liệu.
- Cuối script in danh sách file đã chuẩn bị và báo thiếu nếu có.
- Nếu URL trực tiếp hỏng, script phải báo trang nguồn ổn định để người dùng tải thủ công; không tự tìm nguồn mirror.

Thêm vào `.gitignore`:

```gitignore
.cache/
playwright-report/
test-results/
```

### 7.5. Cấu trúc audio sau cùng

```text
public/assets/audio/
├── music/
│   └── childrens-march-theme.ogg
├── sfx/
│   ├── correct.ogg
│   ├── wrong.ogg
│   ├── finish.ogg
│   └── new-record.ogg
└── ui/
    ├── click.ogg
    ├── rollover.ogg
    └── switch.ogg
```

Script có thể copy và đổi tên file theo mapping này. Không xử lý lại âm thanh nếu chưa cần thiết.

### 7.6. `ASSET_SOURCES.md` bắt buộc

Tạo file ở root, ghi cho từng asset:

- Tên.
- Tác giả/nhà phát hành.
- URL trang nguồn ổn định.
- License.
- File thực tế đang dùng.
- Ngày kiểm tra.
- Ghi chú attribution.

Dù CC0 không bắt buộc ghi công, game vẫn nên có modal Credits:

```text
3D models & sound effects: Kenney (CC0)
Background music: Children's March Theme — Cleyton Kauffman (CC0)
Interface font: Baloo 2 — The Baloo 2 Project Authors (OFL-1.1)
Game source code: MIT
```

---

## 8. Cấu trúc source code

```text
math-runner-3d/
├── public/
│   └── assets/
│       ├── audio/
│       ├── fonts/baloo2/
│       ├── licenses/
│       └── models/platformer/
├── scripts/
│   ├── fetch-assets.ps1
│   └── fetch-assets.sh
├── src/
│   ├── app/
│   │   ├── App.ts
│   │   └── app-state.ts
│   ├── audio/
│   │   ├── AudioManager.ts
│   │   └── audio-manifest.ts
│   ├── content/
│   │   ├── grade-config.ts
│   │   └── seed-questions.ts
│   ├── game/
│   │   ├── Game.ts
│   │   ├── GameClock.ts
│   │   ├── game-config.ts
│   │   ├── game-types.ts
│   │   ├── entities/
│   │   │   ├── Gate.ts
│   │   │   ├── Player.ts
│   │   │   └── Track.ts
│   │   └── systems/
│   │       ├── CameraSystem.ts
│   │       ├── FeedbackSystem.ts
│   │       ├── InputSystem.ts
│   │       ├── ParticleSystem.ts
│   │       ├── QuestionSystem.ts
│   │       └── WorldRecycleSystem.ts
│   ├── math/
│   │   ├── format-number.ts
│   │   ├── question-generator.ts
│   │   ├── question-validator.ts
│   │   ├── seeded-rng.ts
│   │   └── shuffle-answers.ts
│   ├── scene/
│   │   ├── AssetLoader.ts
│   │   ├── create-lights.ts
│   │   ├── create-renderer.ts
│   │   ├── create-scene.ts
│   │   └── quality.ts
│   ├── storage/
│   │   └── GameStorage.ts
│   ├── ui/
│   │   ├── UIController.ts
│   │   ├── components/
│   │   └── screens/
│   ├── utils/
│   │   ├── assert-never.ts
│   │   ├── clamp.ts
│   │   └── dispose-three.ts
│   ├── styles/
│   │   ├── base.css
│   │   ├── game.css
│   │   └── ui.css
│   └── main.ts
├── tests/
│   ├── e2e/
│   │   ├── game-flow.spec.ts
│   │   └── responsive.spec.ts
│   └── unit/
│       ├── question-generator.test.ts
│       ├── scoring.test.ts
│       └── storage.test.ts
├── ASSET_SOURCES.md
├── LICENSE
├── README.md
├── eslint.config.js
├── index.html
├── package.json
├── playwright.config.ts
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

Không cần bám cứng từng file nếu repository hiện tại có convention tốt hơn, nhưng bắt buộc duy trì ranh giới module tương đương.

---

## 9. Kiến trúc ứng dụng

### 9.1. State machine

```ts
export type AppPhase =
  | 'boot'
  | 'loading'
  | 'home'
  | 'tutorial'
  | 'countdown'
  | 'running'
  | 'feedback'
  | 'paused'
  | 'finished'
  | 'error';
```

Chuyển trạng thái hợp lệ:

```text
boot -> loading -> home
loading -> error -> loading
home -> tutorial -> countdown -> running
home -> countdown                         (đã xem tutorial)
running -> feedback -> running
running|feedback|countdown -> paused -> trạng thái trước đó
running|feedback -> finished
finished -> countdown                     (chơi lại cùng lớp)
finished -> home                          (chọn lớp khác)
```

Không để UI tự đổi state game trực tiếp. UI phát action, `App`/state controller kiểm tra transition rồi điều phối.

### 9.2. Game loop

- Dùng `requestAnimationFrame`.
- Dùng `THREE.Clock` hoặc `GameClock` wrapper.
- Clamp delta tối đa `0.05` giây để tab vừa quay lại không làm nhân vật nhảy xuyên cổng.
- Tách `update(delta)` và `render()`.
- Dừng cập nhật gameplay khi pause nhưng vẫn có thể render overlay.

Pseudo-code:

```ts
function frame(now: number): void {
  const delta = clock.tick(now, 0.05);

  if (state.isGameplayActive()) {
    inputSystem.update(delta);
    player.update(delta);
    track.update(delta, player.position.z);
    questionSystem.update(delta, player);
    feedbackSystem.update(delta);
    particleSystem.update(delta);
    cameraSystem.update(delta, player);
  }

  animationMixers.forEach((mixer) => mixer.update(delta));
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
```

### 9.3. Asset loading

- Dùng `THREE.LoadingManager` + `GLTFLoader` từ `three/addons/loaders/GLTFLoader.js`.
- Cache mỗi GLTF một lần; clone scene khi cần.
- Chỉ character là skinned/animated; không clone bằng `Object3D.clone()` nếu sau này dùng nhiều character, phải dùng `SkeletonUtils.clone`.
- Hiện progress dựa trên số asset đã hoàn thành.
- Asset lỗi phải đi vào state `error`, không để màn hình loading treo vĩnh viễn.
- Load model thiết yếu trước: character, coin, texture.
- Có thể lazy-load nhạc nền sau gesture **Bắt đầu** để tuân thủ autoplay policy.

### 9.4. Player

- Một `Group` chứa model, shadow blob đơn giản và effect anchor.
- Collision lane dựa trên `targetLane`, không dựa vào mesh bounding box.
- Model scale được chuẩn hóa sau khi load bằng `Box3` để chiều cao khoảng 1,8 đơn vị.
- Rotate model đúng hướng chạy sau khi kiểm tra orientation thực tế.
- `AnimationMixer` quản lý `idle`, `sprint`, `emote-yes`, `emote-no`.
- Chuyển clip bằng `fadeOut`/`fadeIn` khoảng 0,15 giây.
- Sau emote quay lại `sprint`.

### 9.5. Track và world recycling

- Mặt đường tạo bằng `BoxGeometry`, không cần model.
- Tạo 8–10 segment dài 20 đơn vị.
- Khi segment ở sau camera quá ngưỡng, chuyển segment đó ra trước segment xa nhất.
- Decoration hai bên dùng object pool; không create/dispose mỗi frame.
- Chỉ decorative, không collision.
- Random decoration bằng seed riêng để ảnh chụp test ổn định.

### 9.6. Gate

- Mỗi gate là `Group` tại một Z xác định.
- Ba lane panel dùng cùng geometry, khác CanvasTexture.
- Có trạng thái: `approaching`, `locked`, `resolved`, `recycled`.
- CanvasTexture cũ phải `dispose()` khi thay câu hỏi để tránh leak.
- Khi question resolved, không nhận input làm thay đổi đáp án đã chọn.
- Sau khi gate đi qua sau camera thì remove và trả object về pool.

### 9.7. Camera

- PerspectiveCamera FOV khởi tạo 50–55 độ.
- Offset gợi ý so với player: `(0, 4.6, 7.5)`.
- Look-at gợi ý: player + `(0, 1.2, -8)`.
- Smooth follow bằng exponential damping, không gắn cứng để tránh giật khi đổi lane.
- Camera bob biên độ rất nhỏ và tắt khi `prefers-reduced-motion`.
- Không camera shake khi trả lời sai.

### 9.8. Lighting

- HemisphereLight cho ánh sáng môi trường.
- DirectionalLight như mặt trời.
- Shadow chỉ bật ở quality medium/high.
- Shadow map tối đa 1024×1024.
- Chỉ nhân vật và các vật chính cast shadow; cây ở xa không cast shadow.

### 9.9. Renderer và quality

```ts
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
```

Không bật post-processing trong phiên bản 1.

Quality fallback:

- Đo FPS trung bình trong 5 giây sau countdown.
- Nếu dưới 45 FPS: pixel ratio = 1, tắt shadow, giảm decoration 50%.
- Nếu WebGL không khởi tạo được: hiển thị thông báo trình duyệt không hỗ trợ và nút thử lại; không crash trang.

### 9.10. Audio

- Tạo một `AudioManager`, không gọi Howler rải rác.
- Nhạc nền loop, volume mặc định 0,22.
- SFX volume mặc định 0,65.
- Pause/resume đúng với app state.
- Unlock audio sau gesture đầu tiên của người dùng.
- Lưu mute vào localStorage.
- Khi tab ẩn, pause music; quay lại không tự phát cho đến khi người dùng tiếp tục game.
- Không phát chồng nhiều âm đúng/sai nếu user thao tác nhanh.

### 9.11. Storage

Chỉ lưu localStorage:

```ts
interface StoredGameDataV1 {
  version: 1;
  tutorialSeen: boolean;
  muted: boolean;
  selectedGrade: Grade;
  bestScoreByGrade: Partial<Record<Grade, number>>;
}
```

Key duy nhất:

```text
math-runner-3d:v1
```

- Validate dữ liệu khi đọc.
- Nếu JSON hỏng, reset về mặc định, không crash.
- Không lưu tên, tuổi, trường, số điện thoại hoặc thông tin định danh.

### 9.12. Dọn tài nguyên

Viết utility dispose cho geometry, material, texture và audio khi app teardown/HMR. Không dispose shared asset đang dùng. Dùng cache có ownership rõ ràng.

---

## 10. API nội bộ và event

Các event tối thiểu:

```ts
type GameEvent =
  | { type: 'GAME_STARTED'; grade: Grade; seed: number }
  | { type: 'QUESTION_SHOWN'; question: Question; index: number }
  | { type: 'LANE_CHANGED'; lane: 0 | 1 | 2 }
  | { type: 'ANSWER_RESOLVED'; correct: boolean; selectedIndex: number }
  | { type: 'SCORE_CHANGED'; score: number; streak: number }
  | { type: 'GAME_PAUSED' }
  | { type: 'GAME_RESUMED' }
  | { type: 'GAME_FINISHED'; result: RunResult }
  | { type: 'ASSET_ERROR'; assetUrl: string };
```

Có thể dùng typed event emitter nhỏ tự viết; không thêm thư viện chỉ để truyền event.

Kết quả lượt:

```ts
export interface RunResult {
  grade: Grade;
  seed: number;
  totalQuestions: 12;
  correctAnswers: number;
  score: number;
  bestStreak: number;
  stars: 1 | 2 | 3;
  isNewBest: boolean;
  durationMs: number;
}
```

---

## 11. Debug mode phục vụ kiểm thử

Trong dev/test, expose API đọc trạng thái, nhưng không bật ở production trừ khi `VITE_ENABLE_GAME_DEBUG=true`:

```ts
declare global {
  interface Window {
    __MATH_RUNNER_DEBUG__?: {
      getSnapshot(): {
        phase: AppPhase;
        lane: 0 | 1 | 2;
        score: number;
        questionIndex: number;
        activeQuestion: Question | null;
      };
      moveToLane(lane: 0 | 1 | 2): void;
      setTimeScale(scale: number): void;
    };
  }
}
```

Không tạo hàm “auto win” trong production. Debug API chỉ để E2E xác nhận gameplay canvas một cách ổn định.

---

## 12. Kiểm thử

### 12.1. Unit test bắt buộc

`question-generator.test.ts`:

- Sinh 1.000 câu cho mỗi lớp mà không throw.
- Luôn có đúng ba đáp án sau format.
- `correctIndex` luôn 0–2 và trỏ đúng kết quả.
- Không có đáp án trùng.
- Lớp 1–4 không sinh kết quả âm.
- Phép chia luôn chia hết.
- Cùng seed cho cùng chuỗi câu.
- Khác seed tạo khác chuỗi trong hầu hết trường hợp.
- Không để correct lane lặp quá hai lần liên tiếp.

`scoring.test.ts`:

- Điểm đúng cơ bản.
- Speed bonus không âm và không vượt 50.
- Streak multiplier đúng ngưỡng.
- Sai đưa streak về 0 nhưng không trừ score.
- Star threshold đúng biên 6/7/9/10/12.

`storage.test.ts`:

- Dữ liệu hợp lệ được load.
- JSON hỏng fallback mặc định.
- Version lạ fallback an toàn.
- Best score chỉ tăng, không giảm.

### 12.2. E2E bắt buộc

`game-flow.spec.ts`:

1. Mở app không có console error.
2. Loading kết thúc và home hiện.
3. Chọn lớp 1.
4. Hoàn thành tutorial.
5. Countdown kết thúc.
6. Dùng debug snapshot lấy đáp án đúng rồi gửi input hợp lệ.
7. Xác nhận score tăng.
8. Cố ý chọn sai câu tiếp theo; xác nhận feedback có đáp án đúng và score không giảm.
9. Pause, chờ, xác nhận question index không đổi.
10. Resume và hoàn thành 12 câu.
11. Result screen hiển thị X/12, score và star.
12. Chơi lại hoạt động.

`responsive.spec.ts`:

- Desktop 1440×900.
- Mobile 390×844.
- Small mobile 360×640.
- Không có horizontal overflow.
- Nút điều khiển nằm trong viewport và vùng chạm tối thiểu.
- Câu hỏi không bị cắt.
- Resize trong lúc pause không crash.

### 12.3. Test thủ công

Claude Code phải tự kiểm tra:

- Chrome/Edge desktop bằng bàn phím.
- Mobile emulation bằng touch/swipe và button.
- Mute trước/sau khi bắt đầu.
- Tab background rồi quay lại.
- Refresh sau khi có kỷ lục.
- Mạng chậm trong DevTools để xem loading.
- Giả lập một asset 404 để xem error/retry.
- `prefers-reduced-motion`.
- Browser zoom 125%: HUD và CanvasTexture vẫn đúng.
- Chơi hết ít nhất một lượt không dùng debug API.

### 12.4. Visual QA

Chụp screenshot tối thiểu:

```text
artifacts/screenshots/home-desktop.png
artifacts/screenshots/game-desktop.png
artifacts/screenshots/game-mobile.png
artifacts/screenshots/feedback-correct.png
artifacts/screenshots/feedback-wrong.png
artifacts/screenshots/result-mobile.png
```

Các screenshot chỉ là artifact kiểm thử, có thể không commit nếu repository không muốn giữ.

---

## 13. Hiệu năng và asset budget

### 13.1. Mục tiêu

- Menu có thể tương tác nhanh; không đợi tải mọi decoration mới hiện home.
- 55–60 FPS trên điện thoại tầm trung hiện đại.
- Không tụt dưới 40 FPS kéo dài.
- Không có memory tăng liên tục sau nhiều lượt chơi.
- Không log mỗi frame.

### 13.2. Ngân sách

| Hạng mục | Mục tiêu |
| --- | ---: |
| JS gzip | ≤ 250 KB, cho phép cảnh báo Vite nhưng phải giải thích nếu vượt |
| Model + texture phục vụ lượt đầu | ≤ 1,8 MB |
| Audio cần thiết | ≤ 3,5 MB |
| Tổng initial playable | ≤ 6 MB |
| Texture | Tối đa 2048 px; ưu tiên asset gốc nhỏ hơn |
| Pixel ratio | Cap 1,5 mặc định |
| Shadow map | Tối đa 1024 |
| Active particle | Tối đa 80 |
| Decoration visible | Khoảng 40–60 object, dùng pooling |

Không đưa toàn bộ Platformer Kit, UI Audio hoặc Music Jingles vào `public/`.

### 13.3. Tối ưu bắt buộc

- Reuse geometry/material cho gate, track và particle.
- Dùng object pooling cho coin/particle/decoration.
- Không create CanvasTexture mỗi frame.
- Không gọi `new Vector3()` liên tục trong hot loop; dùng temp vector.
- Không bật antialias/post-process nặng trên máy yếu.
- Pause animation loop gameplay khi `document.hidden`, hoặc ít nhất không update simulation.
- Lazy-load nhạc sau gesture.

---

## 14. Bảo mật, quyền riêng tư và hành vi phù hợp trẻ em

- Không thu thập dữ liệu cá nhân.
- Không dùng analytics trong phiên bản 1.
- Không tải script từ CDN trong production.
- Tất cả dependency phải nằm trong lockfile.
- Không dùng `eval`, HTML không tin cậy hoặc inject prompt trực tiếp vào `innerHTML`.
- Text câu hỏi do code tạo vẫn phải gán bằng `textContent`.
- Không có link ngoài trong luồng chơi; credits có thể mở modal nội bộ.
- Không có quảng cáo, loot box, đếm ngược gây áp lực hoặc lời kêu gọi mua hàng.
- Không có hình ảnh bạo lực; sai không làm nhân vật “chết”.

---

## 15. README và triển khai

### 15.1. README phải có

- Mô tả game và ảnh screenshot.
- Cách cài Node/npm.
- `npm install`.
- Cách tải asset bằng script Windows/Linux.
- `npm run dev`.
- Danh sách lệnh kiểm tra.
- Cách build và preview.
- Điều khiển game.
- Kiến trúc ngắn gọn.
- License source code và link `ASSET_SOURCES.md`.

### 15.2. Build production

```bash
npm ci
npm run check
npm run build
npm run preview -- --host 0.0.0.0
```

Output nằm ở `dist/` và phải deploy được lên bất kỳ static hosting nào.

### 15.3. Base path

Vite config phải hỗ trợ deploy ở root mặc định. Nếu deploy vào subdirectory, cho phép cấu hình `VITE_BASE_PATH` hoặc `base` phù hợp. Asset phải đi qua đường dẫn an toàn theo base, không hard-code domain.

### 15.4. Cache

- Model/audio có thể cache dài hạn nếu tên file có version/hash qua build pipeline.
- `index.html` cache ngắn.
- Không cần service worker trong phiên bản 1; tránh thêm độ phức tạp cache cũ.

---

## 16. Các milestone Claude Code phải thực hiện

### Milestone 0 — Khảo sát và scaffold

Deliverables:

- Đọc repository và file hướng dẫn dự án nếu có.
- Kiểm tra Node/npm/Git.
- Khởi tạo hoặc tích hợp Vite Vanilla TypeScript.
- Pin dependency và tạo lockfile.
- Cấu hình strict TypeScript, ESLint, Prettier, Vitest, Playwright.
- Tạo scripts.

Exit criteria:

- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` chạy được trên skeleton.

### Milestone 1 — Asset pipeline

Deliverables:

- `fetch-assets.sh` và `fetch-assets.ps1`.
- Tải/copy đúng whitelist.
- `ASSET_SOURCES.md`, `LICENSE` MIT và license asset.
- Loading manager và asset manifest.

Exit criteria:

- Model character load thành công, texture không 404.
- Audio file truy cập được.
- Không có ZIP hoặc asset thừa trong public.

### Milestone 2 — Vertical slice gameplay

Deliverables:

- Scene, renderer, camera, light, track.
- Character sprint animation.
- Ba lane và input desktop/mobile.
- Một câu hỏi cố định, ba gate và resolve đúng/sai.
- HUD tối thiểu theo art direction game; câu trả lời phải nằm trên cổng 3D.

Exit criteria:

- Có thể chơi một câu hoàn chỉnh trên desktop và mobile.
- Không có console error.

### Milestone 3 — Hệ thống câu hỏi và game loop

Deliverables:

- Generator lớp 1–5.
- Seeded RNG và validation.
- 12 câu/lượt, điểm, streak, star.
- Unit test đầy đủ.
- Pause/resume và finish/replay.

Exit criteria:

- Unit tests 1.000 câu/lớp pass.
- Chơi liên tục 12 câu và xem kết quả.

### Milestone 4 — UI/UX và audio

Deliverables:

- Loading, home, grade select, tutorial, countdown, HUD, pause, result, credits.
- Home attract mode, grade badge, button 3D, bảng nhiệm vụ và result scene đúng mục 5; không dùng layout web app.
- Responsive, safe-area, reduced motion.
- Nhạc/SFX, mute, autoplay unlock.
- Feedback animation, particle pooling, emote.

Exit criteria:

- Toàn bộ flow đẹp và rõ trên 390×844 cùng 1440×900.
- Không text tràn/cắt.
- Screenshot desktop/mobile vượt toàn bộ checklist nghiệm thu hình ảnh tại mục 5.12.

### Milestone 5 — Testing, performance và hoàn thiện

Deliverables:

- Playwright E2E.
- Visual QA screenshots.
- FPS quality fallback.
- Memory/dispose review.
- README triển khai.
- Production build.

Exit criteria:

- Toàn bộ Definition of Done đạt.
- Báo cáo cuối ghi rõ lệnh, kết quả, hạn chế còn lại nếu có.

---

## 17. Definition of Done

Claude Code chỉ được coi game hoàn thành khi tất cả tiêu chí sau đạt:

### Chức năng

- [ ] Game mở được bằng URL trên desktop và mobile.
- [ ] Có đủ loading, home, chọn lớp, tutorial, countdown, gameplay, pause và result.
- [ ] Điều khiển bàn phím, nút màn hình và swipe hoạt động.
- [ ] Có 12 câu/lượt và bộ câu hỏi lớp 1–5.
- [ ] Đáp án đúng luôn chính xác và không trùng.
- [ ] Điểm, streak, sao, best score hoạt động.
- [ ] Chơi lại và đổi lớp hoạt động.
- [ ] Mute và pause hoạt động đúng.
- [ ] Tab background không làm bỏ lỡ cổng.

### Hình ảnh/âm thanh

- [ ] Character dùng model CC0 và phát animation sprint.
- [ ] Track, gate, cây/đá/coin hiển thị ổn định.
- [ ] Cảnh 3D chiếm toàn viewport ở Home, Tutorial, Gameplay và Result; không biến thành web app có canvas trang trí.
- [ ] Home có attract mode, character và đường đua sống động; không dùng hero/card SaaS.
- [ ] Nút có chiều sâu, trạng thái hover/press/focus và không dùng emoji làm icon.
- [ ] Chọn lớp dùng huy hiệu game; câu trả lời nằm trên ba cổng 3D.
- [ ] Result có cổng đích, character/rương và animation trao sao; không dùng KPI cards.
- [ ] Baloo 2 hiển thị đúng toàn bộ dấu tiếng Việt và được self-host theo OFL-1.1.
- [ ] Nhạc nền và SFX đều từ nguồn CC0 đã ghi.
- [ ] Không có asset 404.
- [ ] Không có asset không rõ giấy phép.
- [ ] UI đọc rõ ở 360×640.

### Kỹ thuật

- [ ] TypeScript strict và không lạm dụng `any`/`@ts-ignore`.
- [ ] `npm run typecheck` pass.
- [ ] `npm run lint` pass, 0 warning.
- [ ] `npm run format:check` pass.
- [ ] `npm run test` pass.
- [ ] `npm run build` pass.
- [ ] `npm run test:e2e` pass.
- [ ] Không có console error trong flow chính.
- [ ] Không có network request ngoài sau khi app được deploy; asset chạy local.
- [ ] Không có memory leak rõ ràng sau ba lượt chơi lại.

### Tài liệu/pháp lý

- [ ] Có README hoàn chỉnh.
- [ ] Có MIT `LICENSE` cho source code.
- [ ] Có `ASSET_SOURCES.md`.
- [ ] Có bản sao giấy phép/readme của asset.
- [ ] Không commit ZIP/full asset packs/.cache.

---

## 18. Những lỗi Claude Code cần tránh

1. Không làm prototype chỉ có khối hộp rồi tuyên bố hoàn thành; model, animation, audio và UI đều là scope bắt buộc.
2. Không dùng React Three Fiber vì stack đã chốt Vanilla TypeScript + Three.js.
3. Không thêm backend hoặc database.
4. Không dùng physics engine cho bài toán chuyển làn.
5. Không tải toàn bộ asset pack vào production.
6. Không import model GLB mà quên `Textures/colormap.png`.
7. Không dùng MP3 cho nhạc loop nếu đã có OGG.
8. Không tự phát audio trước gesture người dùng.
9. Không phụ thuộc màu đơn thuần để báo đúng/sai.
10. Không tiếp tục simulation khi tab hidden.
11. Không tạo/huỷ geometry, material hoặc texture mỗi frame.
12. Không dùng random thật trong unit test; phải inject seed.
13. Không hard-code đáp án đúng luôn ở giữa.
14. Không phạt trẻ bằng game over sau một câu sai.
15. Không thêm analytics, quảng cáo hoặc CDN ngoài scope.
16. Không dùng glassmorphism, card trắng lớn, gradient blob, hero landing page hoặc dashboard layout làm giao diện chính.
17. Không dùng font Inter/Roboto mặc định, emoji hệ thống hoặc icon line-art mảnh làm ngôn ngữ game.
18. Không đặt ba đáp án thành button HTML tách khỏi ba cổng 3D.

---

## 19. Hướng mở rộng sau phiên bản 1

Kiến trúc phải chuẩn bị để sau này có thể thêm mà không viết lại lõi:

- Chế độ tiếng Việt: ghép chữ/từ, chính tả.
- Chế độ tiếng Anh: từ vựng theo hình ảnh.
- Chủ đề đường đua khác: rừng, tuyết, không gian.
- Unlock nhân vật bằng thành tích, không dùng tiền thật.
- Giáo viên import bộ câu hỏi JSON.
- Chế độ luyện tập không tính thời gian.
- Text-to-speech đọc câu hỏi trên thiết bị.
- PWA/offline ở phiên bản sau.
- Dashboard lớp học chỉ khi có yêu cầu riêng về tài khoản, quyền riêng tư và pháp lý.

Để hỗ trợ mở rộng, `QuestionSystem` không được phụ thuộc trực tiếp vào phép Toán; nó chỉ biết `prompt`, ba `answers`, `correctIndex` và `explanation`.

---

## 20. Nguồn kỹ thuật đã xác minh

- Three.js repository và giấy phép MIT: <https://github.com/mrdoob/three.js/>
- Three.js GLTFLoader: <https://threejs.org/docs/pages/GLTFLoader.html>
- Vite Getting Started: <https://vite.dev/guide/>
- Vite production build: <https://vite.dev/guide/build>
- Howler.js, MIT: <https://github.com/goldfire/howler.js/>
- Playwright: <https://playwright.dev/>
- Kenney xác nhận asset pages dùng CC0: <https://kenney.nl/support>
- Kenney Platformer Kit: <https://kenney.nl/assets/platformer-kit>
- Kenney UI Audio: <https://kenney.nl/assets/ui-audio>
- Kenney Music Jingles: <https://kenney.nl/assets/music-jingles>
- Children’s March Theme, CC0: <https://opengameart.org/content/childrens-march-theme>
- Baloo 2 font, OFL-1.1, có Vietnamese subset: <https://github.com/google/fonts/tree/main/ofl/baloo2>

---

## 21. Kết quả bàn giao mong đợi từ Claude Code

Khi hoàn thành, Claude Code phải trả báo cáo theo format:

```text
1. Kết quả
- Game đã hoàn thành những flow nào.
- URL local/preview để kiểm tra.

2. Tài nguyên
- Asset nào thực tế đang dùng.
- Giấy phép và vị trí ASSET_SOURCES.md.

3. Kiểm thử
- npm run typecheck: PASS/FAIL
- npm run lint: PASS/FAIL
- npm run format:check: PASS/FAIL
- npm run test: PASS/FAIL (số test)
- npm run build: PASS/FAIL
- npm run test:e2e: PASS/FAIL (số test)
- Desktop manual playthrough: PASS/FAIL
- Mobile manual playthrough: PASS/FAIL

4. Hiệu năng
- Kích thước dist.
- Dung lượng asset.
- FPS desktop/mobile emulation.

5. File chính
- Liệt kê các file quan trọng, không dán toàn bộ code.

6. Hạn chế còn lại
- Chỉ ghi vấn đề thực tế chưa xử lý; không che giấu lỗi.
```

Nếu bất kỳ mục bắt buộc nào FAIL, trạng thái cuối phải là **chưa hoàn thành** và nêu rõ blocker.
