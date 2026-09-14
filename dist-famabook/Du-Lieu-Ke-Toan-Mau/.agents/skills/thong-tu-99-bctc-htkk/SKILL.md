---
name: thong-tu-99-bctc-htkk
description: Cẩm nang chế độ kế toán doanh nghiệp theo Thông tư 99/2025/TT-BTC và cơ chế tự nhảy số, quy tắc kiểm tra nhập sai (validation rules), đối chiếu liên thông BCTC của phần mềm HTKK (Tổng cục Thuế). Áp dụng cho thiết kế CSDL, backend Golang, giao diện frontend và xuất XML/Excel/Docx BCTC.
---

# CẨM NANG CHẾ ĐỘ KẾ TOÁN THÔNG TƯ 99/2025/TT-BTC & LOGIC KIỂM TRA HTKK

Cẩm nang này lưu trữ toàn bộ các tri thức chuẩn mực trích xuất trực tiếp từ:
1. **Thông tư số 99/2025/TT-BTC** ngày 27/10/2025 của Bộ trưởng Bộ Tài chính (thay thế Thông tư 200/2014/TT-BTC).
2. **Phần mềm HTKK (Hỗ trợ kê khai thuế)** của Tổng cục Thuế tại `C:\Program Files (x86)\HTKK` (tệp mẫu `ReportTemplates/Excel/99_BCTC_305.xls`, lược đồ `InterfaceTemplates/Validate/99_BCTC_305.xsd`, cấu hình XML `InterfaceTemplates/xml/99_01_THTC_305.xml`).
3. **Phần mềm iTax Viewer** tại `C:\Program Files (x86)\iTax Viewer`.

---

## 1. THAY ĐỔI CỐT LÕI VỀ MÃ SỐ BÁO CÁO TÀI CHÍNH (B01-DN)

Bảng so sánh then chốt giữa Thông tư 200/2014/TT-BTC và Thông tư 99/2025/TT-BTC:

| Khoản mục B01-DN | Mã số TT 200 | Mã số TT 99 (Chuẩn HTKK) | Ghi chú & Tài khoản hạch toán |
| :--- | :---: | :---: | :--- |
| **TÀI SẢN NGẮN HẠN** | **100** | **100** | $= 110 + 120 + 130 + 140 + \mathbf{150} + \mathbf{160}$ |
| Tiền và tương đương tiền | 110 | 110 | TK 111, 112, 113, 1281 (ngắn hạn $\le 3$ tháng) |
| Đầu tư tài chính ngắn hạn | 120 | 120 | TK 121, 1282, 1283, 1288; trừ dự phòng 2291, 2292 |
| Các khoản phải thu ngắn hạn | 130 | 130 | TK 131, 136, 138; trừ dự phòng 2293 |
| Hàng tồn kho | 140 | 140 | TK 151, 152, 153, 154, 155, 156, 157, 158; trừ 2294 |
| **Tài sản sinh học ngắn hạn** | *(Chưa có)* | **150** | **MỚI**: TK 2152, 2153 ngắn hạn; trừ dự phòng 2295 |
| **Tài sản ngắn hạn khác** | **150** | **160** | **THAY ĐỔI**: Chi phí chờ phân bổ ngắn hạn (242), thuế GTGT khấu trừ (133), thuế phải thu NN (333 dư Nợ), trái phiếu CP (171) |
| **TÀI SẢN DÀI HẠN** | **200** | **200** | $= 210 + 220 + \mathbf{230} + 240 + 250 + 260 + \mathbf{270}$ |
| Các khoản phải thu dài hạn | 210 | 210 | TK 131, 136, 138, 244 dài hạn; trừ 2293 |
| Tài sản cố định | 220 | 220 | $= 221 + 224 + 227$ (Nguyên giá trừ hao mòn 214) |
| **Tài sản sinh học dài hạn** | *(Chưa có)* | **230** | **MỚI**: TK 2151, 2152, 2153 dài hạn (gồm 231, 236, 237, 238 trừ 2295) |
| **Bất động sản đầu tư** | **230** | **240** | **THAY ĐỔI MÃ**: TK 217 trừ hao mòn 2147 |
| **Tài sản dở dang dài hạn** | **240** | **250** | **THAY ĐỔI MÃ**: TK 241 (2411 Mua sắm, 2412 XDCB) |
| **Đầu tư tài chính dài hạn** | **250** | **260** | **THAY ĐỔI MÃ**: TK 221, 222, 2281, 128; trừ dự phòng 2292 |
| **Tài sản dài hạn khác** | **260** | **270** | **THAY ĐỔI MÃ**: Chi phí chờ phân bổ dài hạn (242), thuế TNDN hoãn lại (243), phụ tùng dài hạn (273) |
| **TỔNG CỘNG TÀI SẢN** | **270** | **280** | **THAY ĐỔI CỰC KỲ QUAN TRỌNG: Mã số chính thức là 280** ($= 100 + 200$) |
| **NỢ PHẢI TRẢ** | **300** | **300** | $= 310 + 330$ |
| Nợ ngắn hạn | 310 | 310 | TK 331, 333, 334, 335, 338, 3411 ngắn hạn |
| Nợ dài hạn | 330 | 330 | TK 331, 338, 3411, 343, 347 dài hạn |
| **VỐN CHỦ SỞ HỮU** | **400** | **400** | TK 411, 412, 413, 414, 418, 419, 421 |
| **TỔNG CỘNG NGUỒN VỐN** | **440** | **440** | **$= 300 + 400$** |

---

## 2. QUY TẮC VALIDATE & CÔNG THỨC TRÍCH XUẤT TỪ HTKK

### A. Ràng buộc Cân đối kế toán (Sheet `Header!B22`)
```excel
=IF('01'!V252 <> '01'!V174, 0, 1)
```
* `V174` là **Mã số 280 (Tổng cộng tài sản)**.
* `V252` là **Mã số 440 (Tổng cộng nguồn vốn)**.
* Nếu $\text{Mã 280} \neq \text{Mã 440}$, công thức trả về `0`, HTKK báo đỏ: *"Chỉ tiêu 280 = chỉ tiêu 440"* và **chặn không cho xuất XML**.

### B. Ràng buộc Liên thông B03 (Lưu chuyển tiền tệ) $\leftrightarrow$ B01 (Báo cáo tình hình tài chính)
* **Số dư tiền đầu kỳ** (`Header!B12` & `Header!B14`):
  ```excel
  =IF('01_2'!V101 <> '01'!W53, 0, 1)
  ```
  $\rightarrow$ Chỉ tiêu 60 trên B03 (cả trực tiếp và gián tiếp) **phải bằng** Chỉ tiêu 110 (cột Số đầu năm) trên B01.
* **Số dư tiền cuối kỳ** (`Header!B13` & `Header!B15`):
  ```excel
  =IF('01_2'!V108 <> '01'!V53, 0, 1)
  ```
  $\rightarrow$ Chỉ tiêu 70 trên B03 (cả trực tiếp và gián tiếp) **phải bằng** Chỉ tiêu 110 (cột Số cuối năm) trên B01.

### C. Ràng buộc Liên thông B03 Gián tiếp $\leftrightarrow$ B02 (Kết quả kinh doanh)
* **Chỉ tiêu 01 trên B03 Gián tiếp** (Lợi nhuận trước thuế) $= \mathbf{Mã\ 50}$ trên B02-DN (`='01_1'!V76`).

### D. Ràng buộc Miền giá trị (Bounds Check trong XML template)
* Các chỉ tiêu ghi số âm trong ngoặc đơn (*): Khấu hao TSCĐ (214, 215122, 2147), Dự phòng rủi ro (2291, 2292, 2293, 2294, 2295), Cổ phiếu mua lại của chính mình (419):
  HTKK cấu hình `MinValue="-999999999999999" MaxValue="0"`.

---

## 3. CÔNG THỨC BÁO CÁO KẾT QUẢ KINH DOANH (B02-DN) THEO TT 99

1. Doanh thu thuần ($10 = 01 - 02$)
2. Lợi nhuận gộp ($20 = 10 - 11$)
3. **Lãi/lỗ hoạt động bán, thanh lý BĐSĐT: Mã số 21 (MỚI TRONG TT 99)**
4. Doanh thu hoạt động tài chính: Mã số 22 (TT 200 là 21)
5. Chi phí tài chính: Mã số 23 (TT 200 là 22). Trong đó Chi phí đi vay: Mã 24
6. Chi phí bán hàng: Mã số 25
7. Chi phí quản lý doanh nghiệp: Mã số 26
8. **Lợi nhuận thuần từ HĐKD**:
   $$\text{Mã 30} = 20 + 21 + 22 - (23 + 25 + 26)$$
9. Lợi nhuận khác ($40 = 31 - 32$)
10. Tổng lợi nhuận trước thuế ($50 = 30 + 40$)
11. Lợi nhuận sau thuế ($60 = 50 - 51 - 52$)

---

## 4. HỆ THỐNG TÀI KHOẢN MỚI CẦN LƯU Ý TRONG CSDL & CODE
* **TK 215**: Tài sản sinh học (2151 Súc vật nuôi định kỳ; 2152 Súc vật nuôi 1 lần; 2153 Cây trồng).
* **TK 2295**: Dự phòng tổn thất tài sản sinh học.
* **TK 242**: Đổi tên thành "Chi phí chờ phân bổ" (trước là "Chi phí trả trước").
* **TK 3387**: Đổi tên thành "Doanh thu chờ phân bổ" (trước là "Doanh thu chưa thực hiện").
* **TK 357**: Quỹ bình ổn giá.
* **TK 419**: Đổi tên thành "Cổ phiếu mua lại của chính mình" (trước là "Cổ phiếu quỹ").
* **TK 82112**: Chi phí thuế TNDN bổ sung theo quy định về thuế tối thiểu toàn cầu.
