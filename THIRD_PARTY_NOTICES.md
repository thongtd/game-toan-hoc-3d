# Thông báo bên thứ ba

Danh sách mọi thứ trong bản phát hành **Đường đua Toán học 3D** không phải do dự án tự viết,
kèm giấy phép. Bản chi tiết về từng file asset nằm ở [`ASSET_SOURCES.md`](./ASSET_SOURCES.md).

Mã nguồn của dự án: **MIT** — xem [`LICENSE`](./LICENSE).

---

## 1. Thư viện runtime (đi vào bundle)

| Gói    | Phiên bản | License | Trang chủ               |
| ------ | --------- | ------- | ----------------------- |
| three  | 0.185.1   | MIT     | <https://threejs.org/>  |
| howler | 2.2.4     | MIT     | <https://howlerjs.com/> |

Không có thư viện nào khác được nạp lúc chạy. Game **không** gọi CDN, không tải font từ Google
Fonts và không gửi request ra ngoài domain của chính nó.

## 2. Công cụ phát triển (không đi vào bundle)

| Gói                                                        | License          |
| ---------------------------------------------------------- | ---------------- |
| vite, vitest, @vitejs plugins                              | MIT              |
| typescript, typescript-eslint, eslint, @eslint/js, globals | Apache-2.0 / MIT |
| prettier                                                   | MIT              |
| @playwright/test                                           | Apache-2.0       |
| @types/three, @types/howler, @types/node                   | MIT              |

Chi tiết đầy đủ luôn có thể tra bằng:

```bash
npm ls --all
```

## 3. Tài nguyên hình ảnh và âm thanh

| Nhóm                           | Nguồn                                     | License     | Bản sao giấy phép                                                                                                        |
| ------------------------------ | ----------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| Model nhân vật, cây, rương, cờ | Kenney Platformer Kit                     | CC0 1.0     | `public/assets/licenses/kenney_platformer-kit_License.txt`                                                               |
| Avatar con vật                 | Kenney Animal Pack Remastered             | CC0 1.0     | `public/assets/licenses/kenney_animal-pack-remastered_License.txt`                                                       |
| Avatar robot                   | Kenney Robot Pack                         | CC0 1.0     | `public/assets/licenses/kenney_robot-pack_License.txt`                                                                   |
| Avatar máy bay                 | Kenney Tappy Plane                        | CC0 1.0     | `public/assets/licenses/kenney_tappy-plane_License.txt`                                                                  |
| Avatar phi thuyền              | Kenney Space Shooter Remastered           | CC0 1.0     | `public/assets/licenses/kenney_space-shooter-remastered_License.txt`                                                     |
| Avatar xe                      | Kenney Tanks, Top-down Tanks Remastered   | CC0 1.0     | `public/assets/licenses/kenney_tanks_License.txt`, `public/assets/licenses/kenney_top-down-tanks-remastered_License.txt` |
| SFX giao diện                  | Kenney UI Audio                           | CC0 1.0     | `public/assets/licenses/kenney_ui-audio_License.txt`                                                                     |
| SFX phản hồi                   | Kenney Music Jingles                      | CC0 1.0     | `public/assets/licenses/kenney_music-jingles_License.txt`                                                                |
| Nhạc nền                       | Children's March Theme — Cleyton Kauffman | CC0         | `public/assets/licenses/childrens-march-theme_readme.txt`                                                                |
| Font Baloo 2                   | Ek Type                                   | SIL OFL 1.1 | `public/assets/licenses/Baloo2-OFL.txt`                                                                                  |

## 4. Cảnh vật năm bản đồ

Toàn bộ scenery của `rainbow-skyway`, `vietnam-countryside`, `cosmic-orbit`,
`enchanted-forest` và `toy-city` là **mã nguồn của dự án** (`src/game/maps/`), dựng bằng
Three.js primitives. Không có model, texture hay ảnh bên thứ ba nào cho map, và không có file
nào được hotlink từ website khác.

Thumbnail trong bộ chọn map là ảnh chụp từ chính scene trong game, thuộc dự án, giấy phép MIT.

## 5. Cách kiểm tra

```bash
npm run assets:validate   # thumbnail, avatar, giấy phép, dung lượng
npm run test:e2e          # trong đó có bài kiểm tra không có request ra ngoài domain
```
