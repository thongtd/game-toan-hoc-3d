# Nguồn tài nguyên mở

Toàn bộ tài nguyên hình ảnh và âm thanh dùng trong **Đường đua Toán học 3D** đều thuộc
**Creative Commons Zero (CC0)**. Mã nguồn game phát hành theo **MIT** (xem `LICENSE`).

Các file được tải lại bằng `scripts/fetch-assets.ps1` (Windows) hoặc `scripts/fetch-assets.sh`
(macOS/Linux). Script chỉ copy đúng whitelist bên dưới, không đưa nguyên asset pack vào `public/`.

Ngày kiểm tra gần nhất: **12/08/2026**.

---

## 1. Kenney Platformer Kit 4.1 — model 3D

| Mục                     | Nội dung                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| Tên                     | Platformer Kit (4.1)                                                                                  |
| Tác giả / nhà phát hành | Kenney Vleugels — Kenney (www.kenney.nl)                                                              |
| Trang nguồn ổn định     | <https://kenney.nl/assets/platformer-kit>                                                             |
| Direct ZIP đã dùng      | <https://kenney.nl/media/pages/assets/platformer-kit/1585cf62b4-1775122253/kenney_platformer-kit.zip> |
| License                 | Creative Commons Zero (CC0 1.0)                                                                       |
| Bản sao giấy phép       | `public/assets/licenses/kenney_platformer-kit_License.txt`                                            |
| Ngày kiểm tra           | 12/08/2026                                                                                            |

File thực tế đang dùng:

```text
public/assets/models/platformer/character-oopi.glb
public/assets/models/platformer/coin-gold.glb
public/assets/models/platformer/chest.glb
public/assets/models/platformer/crate.glb
public/assets/models/platformer/flag.glb
public/assets/models/platformer/fence-low-straight.glb
public/assets/models/platformer/rocks.glb
public/assets/models/platformer/tree.glb
public/assets/models/platformer/tree-pine.glb
public/assets/models/platformer/Textures/colormap.png
```

**Lưu ý kỹ thuật:** mọi file GLB tham chiếu texture ngoài theo đường dẫn tương đối
`Textures/colormap.png`. Không được làm phẳng thư mục, nếu không texture sẽ 404.

Animation clip có sẵn trong `character-oopi.glb` (đã xác minh bằng cách đọc chunk JSON của GLB):

```text
static, idle, walk, sprint, jump, fall, crouch, sit, drive, die,
pick-up, emote-yes, emote-no, holding-right, holding-left, holding-both,
holding-right-shoot, holding-left-shoot, holding-both-shoot,
attack-melee-right, attack-melee-left, attack-kick-right, attack-kick-left,
interact-right, interact-left
```

Game sử dụng: `sprint` (đang chạy), `idle` (menu/pause), `emote-yes` (trả lời đúng),
`emote-no` (trả lời sai, rất ngắn). **Không** dùng `die` cho phản hồi sai.

---

## 2. Kenney UI Audio 1.0 — âm thanh giao diện

| Mục                     | Nội dung                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| Tên                     | UI SFX Set                                                                                |
| Tác giả / nhà phát hành | Kenney Vleugels — Kenney (www.kenney.nl)                                                  |
| Trang nguồn ổn định     | <https://kenney.nl/assets/ui-audio>                                                       |
| Direct ZIP đã dùng      | <https://kenney.nl/media/pages/assets/ui-audio/490d233f68-1677590494/kenney_ui-audio.zip> |
| License                 | Creative Commons Zero (CC0 1.0)                                                           |
| Bản sao giấy phép       | `public/assets/licenses/kenney_ui-audio_License.txt`                                      |
| Ngày kiểm tra           | 12/08/2026                                                                                |

| File gốc trong pack   | File trong game                       |
| --------------------- | ------------------------------------- |
| `Audio/click1.ogg`    | `public/assets/audio/ui/click.ogg`    |
| `Audio/rollover1.ogg` | `public/assets/audio/ui/rollover.ogg` |
| `Audio/switch1.ogg`   | `public/assets/audio/ui/switch.ogg`   |

`rollover.ogg` chỉ phát khi con trỏ chuột hover (desktop), không phát trên thiết bị cảm ứng.

---

## 3. Kenney Music Jingles 1.0 — âm thanh phản hồi

| Mục                     | Nội dung                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| Tên                     | Music Jingles                                                                                       |
| Tác giả / nhà phát hành | Kenney Vleugels — Kenney (www.kenney.nl)                                                            |
| Trang nguồn ổn định     | <https://kenney.nl/assets/music-jingles>                                                            |
| Direct ZIP đã dùng      | <https://kenney.nl/media/pages/assets/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip> |
| License                 | Creative Commons Zero (CC0 1.0)                                                                     |
| Bản sao giấy phép       | `public/assets/licenses/kenney_music-jingles_License.txt`                                           |
| Ngày kiểm tra           | 12/08/2026                                                                                          |

Mapping đang dùng (giữ nguyên đề xuất trong đặc tả §7.2C):

| Sự kiện           | File gốc trong pack                           | File trong game                          |
| ----------------- | --------------------------------------------- | ---------------------------------------- |
| Trả lời đúng      | `Audio/Pizzicato jingles/jingles_PIZZI00.ogg` | `public/assets/audio/sfx/correct.ogg`    |
| Trả lời sai (nhẹ) | `Audio/8-Bit jingles/jingles_NES13.ogg`       | `public/assets/audio/sfx/wrong.ogg`      |
| Hoàn thành lượt   | `Audio/Pizzicato jingles/jingles_PIZZI07.ogg` | `public/assets/audio/sfx/finish.ogg`     |
| Kỷ lục mới        | `Audio/Pizzicato jingles/jingles_PIZZI03.ogg` | `public/assets/audio/sfx/new-record.ogg` |

---

## 4. Children's March Theme — nhạc nền

| Mục                      | Nội dung                                                                |
| ------------------------ | ----------------------------------------------------------------------- |
| Tên                      | Children's March Theme                                                  |
| Tác giả                  | Cleyton Kauffman                                                        |
| Trang nguồn ổn định      | <https://opengameart.org/content/childrens-march-theme>                 |
| Direct ZIP đã dùng       | <https://opengameart.org/sites/default/files/childrens_march_theme.zip> |
| License                  | Creative Commons Zero (CC0) — ghi rõ trong `readme.txt` của tác giả     |
| Bản sao readme/giấy phép | `public/assets/licenses/childrens-march-theme_readme.txt`               |
| Ngày kiểm tra            | 12/08/2026                                                              |

| File gốc trong pack          | File trong game                                       |
| ---------------------------- | ----------------------------------------------------- |
| `Children's March Theme.ogg` | `public/assets/audio/music/childrens-march-theme.ogg` |

Dùng bản **OGG** (không dùng MP3) để vòng lặp nhạc nền liền mạch, không bị khoảng hở.

---

## 5. Bản đồ 3D — tài nguyên gốc của dự án

Năm bản đồ (`rainbow-skyway`, `vietnam-countryside`, `cosmic-orbit`, `enchanted-forest`,
`toy-city`) **không** dùng model tải về. Toàn bộ cảnh vật được dựng bằng Three.js primitives
trong `src/game/maps/`, nên:

| Mục                 | Nội dung                                                             |
| ------------------- | -------------------------------------------------------------------- |
| Tác giả             | Chính dự án này                                                      |
| License             | MIT (cùng giấy phép mã nguồn)                                        |
| Dung lượng tải thêm | 0 MB — không có file model/texture nào cho map                       |
| Vị trí              | `src/game/maps/<mapId>/segments.ts` và `src/game/maps/primitives.ts` |

Lý do: giữ ngân sách tải của mỗi map ở mức tối thiểu, tránh phụ thuộc vào pack bên ngoài và
loại bỏ hoàn toàn rủi ro giấy phép. Nếu sau này thêm model tải về cho map, phải bổ sung một mục
riêng ở đây kèm URL, tác giả, license, ngày tải và đường dẫn file thực tế.

### 5.1. Thumbnail bản đồ

| Mục                | Nội dung                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| File               | `public/assets/maps/<mapId>/thumbnail.webp` (960×540, WebP)                                    |
| Nguồn              | Ảnh chụp trực tiếp từ scene trong game                                                         |
| Cách tạo lại       | `npm run build && npm run preview -- --port 4180 --strictPort` rồi `npm run assets:thumbnails` |
| Route dùng để chụp | `/?previewMap=<mapId>&previewSeed=1001&ui=0`                                                   |
| License            | MIT (ảnh của chính dự án)                                                                      |

Kiểm tra dung lượng và tính đầy đủ bằng `npm run assets:validate`.

---

## 6. Ghi công

CC0 không bắt buộc ghi công, nhưng game vẫn hiển thị modal **Nguồn tài nguyên mở** ở trang chủ:

```text
Mô hình 3D & hiệu ứng âm thanh: Kenney (CC0)
Nhạc nền: Children's March Theme — Cleyton Kauffman (CC0)
Mã nguồn game: MIT
```

## 7. Nguyên tắc bổ sung asset về sau

- Chỉ nhận asset có trang nguồn ổn định ghi rõ giấy phép CC0 (hoặc tương đương cho phép dùng
  thương mại, không yêu cầu ghi công bắt buộc).
- Không lấy file từ Google Images, YouTube, Pinterest hay các trang "free download" không ghi
  giấy phép rõ ràng. "Royalty free" **không** đồng nghĩa với CC0.
- Không dùng hình do AI tạo trong phiên bản 1.
- Mỗi lần thêm asset phải cập nhật file này: tên, tác giả, URL trang nguồn, license, file thực
  tế đang dùng, ngày kiểm tra và ghi chú attribution.
- Nếu direct URL hết hiệu lực: vào trang nguồn ổn định, tải bản hiện tại, kiểm tra file giấy
  phép trong ZIP là CC0, rồi cập nhật URL và ngày kiểm tra ở đây. Không tự tìm nguồn mirror.
