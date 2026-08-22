---
name: tax-invoice-portal
description: Quy trình tự động tra cứu, kiểm tra tính hợp pháp hóa đơn điện tử trên Cổng hoadondientu.gdt.gov.vn của Tổng cục Thuế.
---

# Tax Invoice Portal Lookup Skill

Kỹ năng này hướng dẫn AI Agent tra cứu trạng thái hóa đơn trên Cổng thông tin Hóa đơn Điện tử Tổng cục Thuế.

## Các tham số cần thu thập
- Mã số thuế người bán (MST Bán)
- Loại hóa đơn (1: Hóa đơn GTGT, 2: Hóa đơn bán hàng...)
- Ký hiệu mẫu số hóa đơn (ví dụ: `1C26TAA`)
- Ký hiệu hóa đơn (ví dụ: `C26TAA`)
- Số hóa đơn (ví dụ: `00000123`)
- Tổng tiền thanh toán hoặc Tổng tiền thuế GTGT

## Quy trình thực hiện
1. Điều hướng trình duyệt tới `https://hoadondientu.gdt.gov.vn/`
2. Điền các trường thông tin vào form tra cứu.
3. Giải mã Captcha (nếu có yêu cầu từ người dùng hoặc hỗ trợ qua OCR).
4. Đọc kết quả tra cứu:
   - "Đã cấp mã" / "Hóa đơn hợp lệ"
   - Tên người bán, người mua, ngày lập hóa đơn.
5. So sánh với chứng từ nội bộ của doanh nghiệp và cảnh báo nếu có sự sai lệch.
