# HƯỚNG DẪN SỬ DỤNG VÀ PHÂN PHỐI PHẦN MỀM KẾ TOÁN FAMABOOK.COM
### (Dành cho Kế toán viên & Người dùng không chuyên về kỹ thuật)

---

## I. GIỚI THIỆU TỔNG QUAN

**famabook.com** là phiên bản phần mềm Kế toán Doanh nghiệp thế hệ mới, tích hợp sâu Trợ lý Trí tuệ Nhân tạo và Agent tự động hóa. Phần mềm được thiết kế với nhận diện thương hiệu **chữ `f` cách điệu mầm lá xanh (leafly green)**, mang giao diện tiếng Việt thân thiện, dễ sử dụng, hoàn toàn che giấu các yếu tố kỹ thuật phức tạp bên dưới.

### Các đặc tính tiền cấu hình nổi bật:
1. **Logo & Thương hiệu:** Biểu tượng lá mạ xanh (`f`) trên thanh tác vụ, cửa sổ ứng dụng và tệp thực thi.
2. **Trợ lý Trí tuệ Kế toán tự động:** Đã được tích hợp sẵn mô hình nghiệp vụ, hoạt động ngay lập tức mà **không yêu cầu người dùng phải tự lấy hay cấu hình API Key**.
3. **Cổng dữ liệu Sổ sách thông minh:** Tự động kết nối tới cổng dữ liệu an toàn `famabook.com` để tra cứu danh mục tài khoản, số dư, chứng từ hóa đơn và phân tích công nợ.
4. **Liên thông Hóa đơn điện tử 30s:** Điều hướng tức thời (< 20ms) đến cổng phát hành hóa đơn điện tử 30s, hợp đồng mua bán, xuất kho.
5. **Rà soát BCTC theo Thông tư 99/2025/TT-BTC:** Tích hợp bộ quy tắc kiểm toán nội bộ và chuẩn kiểm tra của phần mềm HTKK (Tổng cục Thuế), tự động kiểm tra cân đối **Tổng cộng Tài sản (Mã 280) = Tổng cộng Nguồn vốn (Mã 440)**.
6. **Đăng nhập một chạm (Single Sign-On):** Mở giao diện đăng nhập qua web portal, tự động đồng bộ tài khoản kế toán viên vào phần mềm.

---

## II. HƯỚNG DẪN KHỞI ĐỘNG DÀNH CHO KẾ TOÁN VIÊN

Phần mềm được đóng gói dưới dạng chạy trực tiếp (Portable) hoặc cài đặt tự động:

1. **Khởi động một chạm:**
   - Mở thư mục phần mềm `famabook.com`.
   - Nhấp đúp chuột vào tệp: **`Khoi-Dong-Famabook.bat`** (hoặc `Famabook.exe`).
2. **Đăng nhập tài khoản:**
   - Chọn biểu tượng **Tài khoản** ở góc trái dưới cùng hoặc nhấn phím `F1` $\rightarrow$ gõ `Đăng nhập Tài khoản famabook.com`.
   - Trình duyệt sẽ tự động mở trang đăng nhập. Kế toán viên chỉ cần nhập tên tài khoản và mật khẩu được cấp, sau đó hệ thống sẽ tự động xác thực và kích hoạt toàn bộ tính năng.

---

## III. CÁC TÍNH NĂNG VÀ CÂU LỆNH MẪU KẾ TOÁN NÊN DÙNG

Tại khung chat Trợ lý Kế toán (nhấn biểu tượng famabook hoặc tổ hợp phím `Ctrl + Shift + I`), kế toán viên có thể giao tiếp hoàn toàn bằng tiếng Việt tự nhiên:

### 1. Điều hướng nhanh các phân hệ làm việc (< 20ms):
- *"Mở cổng hóa đơn điện tử 30s"* $\rightarrow$ Trợ lý tự động chuyển tới `/dashboard/hoadon30s`.
- *"Mở phân hệ hợp đồng bán hàng mới"* $\rightarrow$ Trợ lý tự động mở `/dashboard/sales-contract/new`.
- *"Cho tôi xem bảng tổng quan tài chính công ty"* $\rightarrow$ Mở `/dashboard`.
- *"Mở danh mục kho và vật tư hàng hóa"* $\rightarrow$ Mở `/dashboard/warehouse` và `/dashboard/goods`.

### 2. Rà soát BCTC theo Thông tư 99/2025/TT-BTC & HTKK:
- *"Rà soát bảng cân đối kế toán năm nay xem có khớp không"* $\rightarrow$ Trợ lý đối chiếu Tổng tài sản (Mã 280) với Tổng nguồn vốn (Mã 440), kiểm tra số dư TK 111, 112, 131, 331, 156.
- *"Kiểm tra danh mục tài khoản theo quy định Thông tư 99"* $\rightarrow$ Rà soát tài khoản cấp 1, cấp 2 và nguyên tắc mở sổ chi tiết.
- *"Đối soát thuế GTGT đầu vào đầu ra với hóa đơn 30s"* $\rightarrow$ So sánh TK 133 và TK 3331 với dữ liệu hóa đơn điện tử.
- *"Kiểm tra các bước kết chuyển khóa sổ cuối kỳ"* $\rightarrow$ Rà soát quy trình kết chuyển sang TK 911 (Xác định kết quả kinh doanh).

### 3. Tra cứu số liệu sổ sách kế toán:
- *"Tra cứu danh sách khách hàng còn nợ quá hạn"*
- *"Xem biểu đồ doanh thu và chi phí quý này"*
- *"Xuất mẫu bảng kê nhập xuất tồn vật tư ra Excel"*

---

## IV. QUY TRÌNH ĐÓNG GÓI & PHÂN PHỐI CHO QUẢN TRỊ VIÊN

Khi cần đóng gói bản phát hành mới cho toàn bộ phòng kế toán:

1. **Chạy kịch bản đóng gói tự động:**
   ```powershell
   pwsh -File scripts\build-famabook.ps1
   ```
2. **Kiểm tra kết quả tại thư mục:** `dist-famabook/`
   - Chứa tệp khởi động tiện lợi `Khoi-Dong-Famabook.bat`.
   - Chứa tệp cấu hình mẫu `.mcp.json` với 14 quyền nghiệp vụ kế toán được phê duyệt tự động.
   - Toàn bộ tệp thực thi mang icon mầm lá xanh thương hiệu famabook.com.
3. **Phân phối:** Nén thư mục thành file `.zip` gửi cho kế toán viên giải nén ra ổ cứng (ví dụ `D:\Famabook`) và tạo shortcut ra màn hình Desktop.
