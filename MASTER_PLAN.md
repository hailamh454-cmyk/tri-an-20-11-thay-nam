# MASTER PLAN: WEB APP 3D TƯƠNG TÁC TRI ÂN 20/11 - THẦY NAM (CHUYÊN VẬT LÝ)

> **Dự án Web App Nghệ thuật Tương tác 3D WebGL Cao Cấp tri ân Thầy giáo lãnh đội Học sinh giỏi Quốc gia / Olympic Vật Lý nhân ngày Nhà giáo Việt Nam 20/11.**  
> Kiến trúc: **Three.js 3D Scene thực (`assets/classroom.glb`), 100% Diegetic Chalkboard UI trên CanvasTexture 2048x1086, Bộ giải vật lý RK4, Bộ kết xuất công thức MathJax SVG chống va chạm, Procedural Web Audio API và Hook Điện ảnh Phase 2.**

---

## 1. Sơ Đồ State Machine Toàn Bộ Hệ Thống

```
 [IDLE_CLASSROOM] (Khung cảnh lớp học 3D chiều thu, ánh nắng hoàng hôn xiên qua cửa sổ)
         │
         │  Click vào Phong bì Kraft dập dấu sáp đỏ trên bàn giáo viên (Raycaster 3D)
         ▼
 [LETTER_OPENED] (Mở thư viết tay tri ân Thầy Nam, bấm "Bước lên bục giảng")
         │
         │  Camera chuyển động mượt mà (smooth lerp) hướng thẳng vào bảng đen
         ▼
 [LEVEL_1_BALLISTICS]  ──(Bắn đạn ném xiên có cản không khí bậc 2 trúng bia)──►
         │
         ▼
 [LEVEL_2_ORBITAL]     ──(Lợi dụng Slingshot Kepler vòng qua chướng ngại vật)──►
         │
         ▼
 [LEVEL_3_BLACKHOLE]   ──(Bắn đạn lọt chân trời sự kiện Schwarzschild r <= rs)──►
         │
         ▼
 [SINGULARITY_COLLAPSE] (Hố đen trượt ra giữa bảng, xoắn hút toàn bộ bài giảng)
         │
         ▼ (Sau ~3.5 giây co rút điểm kỳ dị đỉnh điểm kèm screen shake)
 [SUPERNOVA_CHALK_EXPLOSION] (Bùng nổ siêu tân tinh bụi phấn và 85+ công thức vật lý phủ kín bảng)
         │
         ▼ (Sau khi bụi phấn lắng xuống, chiếc khăn lau bảng trên gờ phát sáng)
 [ERASER_WIPING] (Người dùng cầm khăn nỉ lau sạch mặt bảng bằng destination-out qua Raycaster)
         │
         ▼ (Khi diện tích lau sạch đạt ngưỡng >= 80%)
 [PHASE_2_READY] (Khăn về chỗ cũ, kích hoạt Dolly-zoom camera, Video 1m44s & Kết mùa thu)
```

---

## 2. Mô Tả Chi Tiết Từng Trạng Thái (State Definitions)

### 2.1 `IDLE_CLASSROOM` (Phòng Học 3D Chiều Thu Hoàng Hôn)
- **Mô tả không gian:** Lớp học 3D hoàn chỉnh được dựng từ mô hình `assets/classroom.glb` qua `THREE.GLTFLoader`. Tuyệt đối không dùng ảnh 2D giả lập.
- **Hệ thống ánh sáng & Bầu không khí:**
  - `DirectionalLight` nắng vàng hổ phách (`#fbbf24` / `#f59e0b`) chiếu xiên góc qua các ô cửa sổ hướng Tây, tạo bóng đổ mềm (`PCFSoftShadowMap`).
  - Hàng trăm hạt bụi nắng lơ lửng (`THREE.Points`) chuyển động nhiệt Brown chậm chạp trong luồng ánh sáng thể tích (God-rays).
  - Tông màu chủ đạo: Nâu gỗ sồi ấm (`#4a2c18`), tường vàng nhạt hoài niệm, đá phiến xanh rêu trầm mặc (`#162821`).
- **Điểm tương tác khởi đầu:**
  - Bàn giáo viên ở tiền cảnh bên trái, trên mặt bàn đặt một phong bì thư Kraft vintage dập nổi con dấu sáp đỏ 3D (`#991b1b`).
  - Con dấu sáp có ánh sáng điểm nhẹ (subtle pulse) thu hút ánh nhìn đầu tiên của người dùng.
  - Chuột rê vào phong bì: Con trỏ biến thành hình bàn tay, phong bì nâng nhẹ và phát sáng dịu.

### 2.2 `LETTER_OPENED` (Mở Thư Tri Ân & Khởi Động Âm Thanh)
- **Hành động kích hoạt:** Click vào phong bì thư trên bàn giáo viên thông qua `THREE.Raycaster`.
- **Kích hoạt Web Audio API:** Cử chỉ click này đồng thời kích hoạt `AudioContext.resume()`, phát âm thanh thủ tục tiếng giấy sột soạt và tiếng tách con dấu sáp đỏ (`playEnvelopeOpen()`).
- **Giao diện thư:**
  - Nắp phong bì mở ra, tờ giấy viết tay cổ điển trượt lên giữa màn hình với hiệu ứng chiều sâu nổi bật.
  - Nội dung bức thư tri ân:
    > *"Kính gửi Thầy Nam - Người thầy kính mến đã truyền ngọn lửa đam mê Vật lý bất tận, dẫn dắt bao thế hệ học trò qua từng kỳ thi Chuyên, Học sinh giỏi Quốc gia và Đấu trường Olympic Quốc tế.*  
    > *Nhân ngày Nhà giáo Việt Nam 20/11, chúng em kính chúc Thầy luôn dồi dào sức khỏe, tràn đầy niềm vui và giữ mãi ngọn lửa nhiệt huyết trên bục giảng!*  
    > *Trước khi đến với món quà kỷ niệm đặc biệt, kính mời Thầy cùng chúng em khởi động lại 3 bài toán Vật lý kinh điển của Đội tuyển ngay trên bảng đen!"*
- **Hành động tiếp theo:**
  - Nút bấm *"Bước lên bục giảng"*: Camera 3D thực hiện chuyển động tween/lerp mượt mà từ góc nhìn bàn giáo viên tiến lại gần mặt bảng đen, căn giữa khung nhìn trực diện.
  - Tờ thư thu nhỏ thành icon chiếc phong bì tinh tế ở góc dưới để Thầy có thể xem lại bất kỳ lúc nào.

### 2.3 `LEVEL_1_BALLISTICS` (Cơ Học Cổ Điển - Ném Xiên Trong Không Khí Có Lực Cản Bậc 2)
- **Mặt bảng CanvasTexture (2048 x 1086):** Bảng đen 3D hiển thị bài toán đầu tiên bằng nét phấn trắng và vàng.
- **100% Diegetic Chalkboard UI (Không dùng HTML controls):**
  - Khung ngắm bệ phóng ở góc dưới bên trái bảng.
  - Vòng cung đo góc $\alpha$ vẽ bằng nét phấn trực tiếp trên mặt bảng, cho phép rê chuột để kéo đổi góc từ $15^\circ$ đến $80^\circ$.
  - Thanh trượt vận tốc $v_0$ kẻ bằng phấn với con trỏ viên phấn trượt ngang.
  - Nút phấn `[ PHÓNG PHẤN ]` (hoặc phím `Space`): Hiệu ứng phấn sáng lên khi click.
- **Công thức hiển thị (MathJax SVG-to-Canvas):**
  - Phương trình chuyển động vi phân: $m\ddot{\mathbf{r}} = m\mathbf{g} - \frac{1}{2}C_d\rho A |\mathbf{v}|\mathbf{v}$
  - Bán kính cong quỹ đạo: $\rho(t) = \frac{v(t)^2}{g_n}$
  - Tầm xa lý thuyết trong chân không: $R_0 = \frac{v_0^2\sin 2\alpha}{g}$
- **Mô phỏng vật lý RK4:** Tích phân số Runge-Kutta bậc 4 chính xác, viên phấn bay vạch đường nét đứt, hạt bụi phấn bay rớt theo đường bay, âm thanh rít gió tăng giảm theo tốc độ đạn.
- **Mục tiêu:** Bắn trúng hồng tâm phấn tròn ở bên phải bảng để vượt qua màn 1.

### 2.4 `LEVEL_2_ORBITAL` (Cơ Học Thiên Thể Kepler & Hiệu Ứng Hấp Dẫn Slingshot)
- **Bối cảnh bài toán:** Giữa bảng xuất hiện một thiên thể nặng bán kính $R_p$ sinh ra giếng thế hấp dẫn Newton $U(r) = -GM/r$. Phía trước mục tiêu có một chướng ngại vật chắn đường ngắm thẳng.
- **100% Diegetic UI:** Bộ điều khiển góc phóng $\alpha$ và vector vận tốc $\vec{v}_0$ bằng cách kéo thả mũi tên vector phấn tại bệ phóng.
- **Công thức hiển thị (MathJax SVG-to-Canvas):**
  - Định luật vạn vật hấp dẫn: $\vec{F} = -G\frac{Mm}{r^3}\vec{r}$
  - Bảo toàn mômen động lượng: $\vec{L} = \vec{r} \times m\vec{v} = \text{const}$
  - Thế năng hiệu dụng: $U_{\text{eff}}(r) = -\frac{GMm}{r} + \frac{L^2}{2mr^2}$
  - Góc lệch tán xạ hấp dẫn: $\tan\frac{\theta}{2} = \frac{GM}{b v_\infty^2}$
- **Cơ chế chơi:** Người chơi căn chỉnh góc và vận tốc để quỹ đạo bay lướt sát bề mặt thiên thể, nhận gia tốc phụ từ hiệu ứng Gravity Assist (Slingshot) bẻ cong quỹ đạo vòng qua chướng ngại vật chạm đích. Âm thanh cộng hưởng hấp dẫn (`playSlingshotHum`) rền vang khi bay sát hành tinh.

### 2.5 `LEVEL_3_BLACKHOLE` (Thuyết Tương Đối Rộng & Hố Đen Schwarzschild)
- **Bối cảnh bài toán:** Tâm bảng xuất hiện một Hố đen tương đối tính với đĩa bồi tụ xoay tròn phát sáng rực rỡ, vòng quang tử (photon sphere) và chân trời sự kiện (event horizon).
- **Công thức hiển thị (MathJax SVG-to-Canvas):**
  - Metric Schwarzschild: $ds^2 = -\left(1 - \frac{r_s}{r}\right)c^2dt^2 + \left(1 - \frac{r_s}{r}\right)^{-1}dr^2 + r^2d\Omega^2$
  - Bán kính Chân trời sự kiện: $r_s = \frac{2GM}{c^2}$
  - Gia tốc tương đối tính tích hợp vào RK4: $\ddot{\mathbf{r}} = -\frac{GM}{r^3}\mathbf{r} - \frac{3GM h^2}{c^2 r^5}\mathbf{r}$ ($h = |\mathbf{r} \times \mathbf{v}|$)
  - Bức xạ Hawking: $T_H = \frac{\hbar c^3}{8\pi GM k_B}$
- **Nhiệm vụ:** Tính toán góc phóng đạn để vượt qua rào thế ly tâm và rơi xoắn ốc xuyên qua chân trời sự kiện $r \le r_s$.

### 2.6 `SINGULARITY_COLLAPSE` (Điểm Kỳ Dị Nuốt Chửng Mặt Bảng)
- Khi viên phấn chạm vào chân trời sự kiện, Hố đen kích hoạt chuỗi sụp đổ hấp dẫn:
  - Hố đen từ từ dịch chuyển vào chính giữa trung tâm bảng đen và mở rộng đĩa hút.
  - Toàn bộ các nét vẽ, trục tọa độ, chữ viết và công thức của 3 bài toán trên bảng bị kéo dãn sợi mỳ (spaghettification), biến dạng phi tuyến và xoáy ốc lao vào tâm điểm kỳ dị.
  - Hiệu ứng rung màn hình 3D (camera shake) với tần số tăng dần.
  - Âm thanh sine sweep tần số siêu trầm quét từ $65\text{Hz}$ xuống $20\text{Hz}$ trong 3.5 giây (`playBlackHoleImplosion`).

### 2.7 `SUPERNOVA_CHALK_EXPLOSION` (Vụ Nổ Siêu Tân Tinh Bụi Phấn & 85+ Công Thức)
- Điểm kỳ dị co nhỏ cực đại rồi bùng nổ chấn động toàn bộ lớp học:
  - Âm thanh Supernova Boom kết hợp sub-bass $38\text{Hz}$ và shockwave kéo dài 3.2 giây (`playSupernovaExplosion`).
  - Hàng trăm hạt bụi phấn đa sắc (trắng, vàng, đỏ, xanh) bắn tung tóe dội vào khung gỗ 3D của bảng.
  - **Hơn 85 công thức Vật lý kinh điển** (Einstein, Maxwell, Dirac, Schrödinger, Feynman diagrams, Boltzmann, Navier-Stokes, Lorentz, Hawking...) bắn văng ra từ tâm theo các góc ngẫu nhiên.
  - **Hệ thống Zero-Collision Layout:** Đảm bảo tất cả 85+ công thức được bố trí chặt chẽ, đo đạc bounding box chuẩn xác để không đè chồng lên nhau, phủ kín 100% diện tích bảng đen như một bản giao hưởng tri thức vĩ đại.

### 2.8 `ERASER_WIPING` (Thầy Cầm Khăn Lau Bảng)
- Sau vụ nổ, bảng đen bị bụi phấn và các công thức phủ kín hỗn độn.
- Chiếc khăn lau bảng 3D đặt trên gờ bảng bắt đầu phát ánh hào quang nhấp nháy, kèm dòng chữ phấn mời gọi:  
  *“Vụ nổ hố đen làm loạn hết công thức rồi! Thầy hãy cầm khăn lau sạch bảng nhé.”*
- **Tương tác Raycaster & Cọ Vải Nỉ:**
  - Người dùng giữ và rê chuột trên mặt bảng: Khăn lau di chuyển bám theo chuột với góc nghiêng tự nhiên theo vector vận tốc.
  - Xóa lớp phấn dày đặc bằng chế độ cọ nỉ mềm: `boardCtx.globalCompositeOperation = 'destination-out'`.
  - Bụi phấn rơi lả tả xuống gờ bảng, âm thanh tiếng lau sột soạt chân thực (`playEraserWipe`) biến thiên theo tốc độ kéo chuột.
  - **Lưới giám sát 80x45:** Theo dõi diện tích sạch. Khi đạt $\ge 80\%$, hệ thống tự động làm sạch hoàn toàn 20% còn lại trong 0.6s và đưa khăn về gờ bảng ngay ngắn.

### 2.9 `PHASE_2_READY` (Hook Chuyển Tiếp Điện Ảnh Phase 2)
- Khăn lau trở về vị trí ban đầu trên gờ bảng.
- Kích hoạt sự kiện `window.dispatchEvent(new CustomEvent('phase1-completed'))` và gọi hàm `triggerPhase2Transition()`.
- Sẵn sàng kích hoạt chuỗi điện ảnh đỉnh cao của Phase 2:
  1. Camera 3D Dolly-Zoom tiến sát vào lòng bảng đen (Vertigo effect 2.5s, bảng đen trở thành màn chiếu rạp phim 16:9).
  2. Phát video kỷ niệm Đội tuyển 1 phút 44 giây (`assets/sakura_no_uta_memories.mp4`) trên nền nhạc hoài niệm trường lớp.
  3. Cảnh kết chiều thu hoàng hôn Koe no Katachi: Mưa lá phong đỏ rơi, bức thư tri ân viết tay bằng mực ánh kim và hình bóng tri ân của Yuzuru Nishimiya.

---

## 3. Kiến Trúc Mã Nguồn & Danh Sách Module Chuẩn

```text
/
├── index.html                       # HTML5 Semantic Layout, WebGL Canvas đơn nhất, Modal đọc thư
├── MASTER_PLAN.md                   # Tài liệu Thiết Kế & Đặc Tả Toàn Diện Hệ Thống
├── .agents/
│   ├── rules/
│   │   ├── 3d-physics-standards.md  # Quy chuẩn Three.js 3D, Diegetic UI, RK4, MathJax SVG & Audio
│   │   └── architecture-and-physics.md
│   └── skills/
│       ├── phase1-classroom-physics/SKILL.md
│       └── phase2-cinematic-ending/SKILL.md
├── assets/
│   ├── classroom.glb                # Mô hình 3D lớp học thực tế (tường, cửa sổ, bàn ghế, bảng đen)
│   └── sakura_no_uta_memories.mp4   # Video kỷ niệm 1m44s cho Phase 2
├── css/
│   └── main.css                     # Phong cách hoài niệm chiều thu, thư Kraft, typography cổ điển
└── js/
    ├── main.js                      # Three.js Scene Orchestrator, Camera Controller, Game Loop, Raycaster
    ├── engine/
    │   ├── latexChalkRenderer.js    # MathJax/KaTeX SVG-to-Canvas, Chalk Dust Shader, 85+ công thức chống va chạm
    │   └── physicsEngine.js         # Bộ giải tích phân Runge-Kutta bậc 4 (RK4) cho Drag, Kepler & Schwarzschild
    ├── audio/
    │   └── soundSynthesizer.js      # Bộ tổng hợp âm thanh thủ tục 100% qua Web Audio API (Zero file MP3 ngoài)
    ├── sequences/
    │   └── blackHoleSequence.js     # Diễn hoạt Hút sụp đổ, Spaghettification & Bùng nổ Supernova 85+ công thức
    ├── interactions/
    │   └── eraserController.js      # Khăn lau bảng 3D, Destination-out wiping, Bụi phấn rơi & Grid tracker 80x45
    └── transitions/
        └── phase2Placeholder.js     # Hook Dolly-zoom camera, Video Player 1m44s & Mùa thu Koe no Katachi
```

---

## 4. Bảng Kiểm Thử & Tiêu Chí Chấp Nhận (Acceptance Criteria)

| Thành phần | Tiêu chí kỹ thuật bắt buộc | Trạng thái |
| :--- | :--- | :--- |
| **Môi trường 3D** | Nạp thành công `assets/classroom.glb`, bóng đổ `PCFSoftShadowMap`, ánh nắng xiên hoàng hôn qua cửa sổ, bụi nắng thể tích lơ lửng. Cấm hoàn toàn ảnh 2D giả lập. | Bắt buộc |
| **Diegetic UI** | Bảng đen sử dụng `CanvasTexture` $2048 \times 1086$. 100% nút bấm, thanh trượt, góc bắn vẽ bằng phấn trực tiếp trên mặt bảng. Không có nút/slider HTML bên ngoài. | Bắt buộc |
| **Công thức MathJax** | Render vector SVG độ nét cao sang Canvas với hiệu ứng hạt phấn. Hệ thống Bounding Box đảm bảo 85+ công thức không va chạm/đè chồng lên nhau. Không in LaTeX thô. | Bắt buộc |
| **Vật lý RK4** | Tích phân Runge-Kutta bậc 4 giải chính xác: Đạn ném xiên cản gió bậc hai, Quỹ đạo Kepler slingshot, Hố đen Schwarzschild tương đối tính. Không dùng Euler explicit. | Bắt buộc |
| **Web Audio API** | 8 hiệu ứng âm thanh thủ tục sinh hoàn toàn bằng code (phấn viết, va chạm, rít gió, hố đen sụp đổ, siêu tân tinh, khăn lau, mở thư sáp). Không cần file mp3 ngoài. | Bắt buộc |
| **Khăn lau & Phase 2** | Khăn nỉ xóa nét phấn bằng `destination-out`. Lưới $80 \times 45$ đếm diện tích sạch $\ge 80\%$ kích hoạt mượt mà hook Dolly-zoom chuyển cảnh Phase 2. | Bắt buộc |
