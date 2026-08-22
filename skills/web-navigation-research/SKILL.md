---
name: web-navigation-research
description: Quy trình duyệt web, tìm kiếm thông tin và phân tích dữ liệu trực tuyến tự động cho doanh nghiệp BKIT.
---

# Web Navigation & Online Research Skill

Kỹ năng này hướng dẫn AI Agent thực hiện nghiên cứu trực tuyến một cách an toàn, chính xác và có hệ thống.

## Các bước thực hiện
1. **Xác định mục tiêu tìm kiếm**:
   - Chuyển đổi câu hỏi của người dùng thành từ khóa tìm kiếm tối ưu.
   - Bổ sung các từ khóa phạm vi (ví dụ: `site:gov.vn`, `site:vietcombank.com.vn`, năm `2026`).
2. **Tìm kiếm thông tin**:
   - Sử dụng công cụ `web/search` hoặc `puppeteer-browser` để mở trang kết quả.
   - Lọc ra 2-3 nguồn thông tin đáng tin cậy nhất.
3. **Thu thập và Trích xuất nội dung**:
   - Sử dụng `web/fetch` hoặc `readPage` để đọc nội dung bài viết/trang web.
   - Loại bỏ các thành phần thừa (quảng cáo, thanh điều hướng, script).
4. **Tổng hợp & Báo cáo**:
   - Cung cấp câu trả lời cô đọng, có cấu trúc.
   - Trích dẫn rõ ràng URL nguồn và thời điểm tra cứu.
