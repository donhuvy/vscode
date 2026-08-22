# 📘 HƯỚNG DẪN CÀI ĐẶT & SỬ DỤNG BKIT AI AGENT CHO NGƯỜI DÙNG VĂN PHÒNG
### Tác nhân AI Kế toán & Duyệt Web Tự động (Tích hợp auth.bkit.vn & DeepSeek Flash 4)

---

## 🌟 1. Giới thiệu
**BKIT AI Agent** là trợ lý trí tuệ nhân tạo chuyên biệt dành cho kế toán viên và nhân sự văn phòng, tích hợp trực tiếp trong môi trường làm việc của bạn với các tính năng vượt trội:
1. 🌐 **Duyệt Web & Tra cứu Tự động**: Tự động mở web tra cứu mã số thuế (MST), tra cứu hóa đơn điện tử Tổng cục Thuế (`hoadondientu.gdt.gov.vn`), tỷ giá ngân hàng, văn bản pháp luật thuế.
2. 🔐 **Đăng nhập 1 Lần (SSO)**: Đăng nhập an toàn qua Cổng xác thực doanh nghiệp `auth.bkit.vn`.
3. ⚡ **Mô hình AI Siêu tốc (DeepSeek Flash 4)**: Xử lý câu hỏi và phân tích dữ liệu ngay lập tức thông qua cổng điều phối backend bảo mật, không yêu cầu người dùng phải tự cấu hình API Key.

---

## 🚀 2. Cài đặt Cực nhanh (Dành cho Người Dùng Mới)

Chỉ cần **1 thao tác duy nhất**:
1. Vào thư mục `visual_studio_code_agents/delivery/`.
2. **Nhấp đúp chuột vào tệp**: `install-bkit-agent.bat`.
3. Màn hình cài đặt màu đen sẽ tự động kiểm tra và cấu hình toàn bộ hệ thống cho bạn trong vòng 5 giây.
4. Visual Studio Code sẽ tự động mở lên.

---

## 🔑 3. Hướng dẫn Đăng nhập Tài khoản BKIT

Sau khi Visual Studio Code mở lên:
1. Nhìn xuống **thanh trạng thái dưới cùng góc phải** màn hình.
2. Nhấn vào biểu tượng: `[BKIT AI: Chưa đăng nhập]`.
3. Chọn **Đăng nhập qua Trình duyệt (auth.bkit.vn)**.
4. Trình duyệt mở ra trang đăng nhập Keycloak -> Điền tên đăng nhập & mật khẩu của bạn.
5. Sau khi đăng nhập thành công, thanh trạng thái chuyển sang: `[✅ BKIT AI: Đã kết nối]`.

---

## 💬 4. Cách Sử dụng Hàng Ngày

Mở cửa sổ Chat trong VS Code (phím tắt `Ctrl + Alt + I` hoặc nhấn vào biểu tượng Chat bên thanh công cụ trái):

### 🔹 Tra cứu Web & Doanh nghiệp
```text
@bkit /web Hãy tra cứu mã số thuế 0312345678 và cho tôi biết công ty này còn đang hoạt động không?
```

### 🔹 Tra cứu Hóa đơn Điện tử
```text
@bkit /web Hãy mở cổng hoadondientu.gdt.gov.vn và hướng dẫn tôi các bước kiểm tra hóa đơn mẫu số 1C26TAA
```

### 🔹 Hỗ trợ Định khoản Kế toán
```text
@bkit /acc Công ty mua 10 máy tính Dell tổng giá trị 150 triệu đã thanh toán qua ngân hàng, VAT 10%, hãy định khoản giúp tôi theo Thông tư 99/2025/TT-BTC.
```

---

## ❓ 5. Câu hỏi Thường gặp (FAQ)

- **Hỏi**: Tôi có cần mua thêm tài khoản AI hay nạp thẻ không?  
  *Trả lời*: Không, hệ thống đã được tích hợp sẵn DeepSeek Flash 4 từ máy chủ backend của BKIT, bạn chỉ cần đăng nhập tài khoản BKIT được cấp.
- **Hỏi**: Làm sao để cập nhật khi công ty có phiên bản mới?  
  *Trả lời*: Bạn chỉ cần chạy lại tệp `install-bkit-agent.bat`, hệ thống sẽ tự động cập nhật bản mới nhất.
