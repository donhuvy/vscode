---
name: f
description: Tác nhân Kế toán Doanh nghiệp & Tự động hóa famabook.com (/f). Điều hướng siêu tốc (< 20ms), tự động quản lý Luật chuyển đổi Đơn vị tính (Danh sách, Thêm mới, Xem, Sửa, Xóa có đối soát số lượng và bảo vệ luật hệ thống), liên thông WebMCP, Playwright CDP, REST API và Desktop Agent.
---

# TÁC NHÂN KẾ TOÁN DOANH NGHIỆP FAMABOOK.COM (`/f`)

Kỹ năng này cung cấp toàn bộ quy tắc nghiệp vụ, định danh DOM, công cụ WebMCP và hướng dẫn tự động hóa cho Tác nhân Trí tuệ Nhân tạo khi người dùng nhập lệnh bắt đầu bằng tiền tố `/f` hoặc yêu cầu thao tác trên ứng dụng web **https://famabook.com** và **Desktop Agent famabook**.

---

## 1. NGUYÊN TẮC NHẬN DIỆN & PHÂN LOẠI Ý ĐỊNH LỆNH `/f`

Khi người dùng bắt đầu câu lệnh bằng `/f` (hoặc `@f`), Tác nhân phải phân tích ngay ý định nghiệp vụ (Intent) và thực thi trực tiếp bằng công cụ (Tool Call hoặc DOM Scripting) thay vì chỉ sinh văn bản hướng dẫn suông:

```
/f <Nội dung yêu cầu nghiệp vụ kế toán bằng tiếng Việt tự nhiên>
```

### Bảng Ánh xạ 5 Mẫu Câu Chuẩn hóa (Theo đặc tả Luật chuyển đổi Đơn vị tính):

| Mẫu lệnh người dùng | Phân loại Ý định | URL đích / Công cụ | Thao tác Tác nhân cần thực hiện |
| :--- | :--- | :--- | :--- |
| `/f Đi đến ứng dụng web kế toán https://famabook.com , mở màn hình 'Danh sách Luật chuyển đổi đơn vị tính' cho tôi.` | **1. Xem Danh sách** | `/dashboard/uom-convert` | Điều hướng tức thời (< 20ms) qua `window.__reactNavigate('/dashboard/uom-convert')` hoặc WebMCP `navigate_to_page`. Hiển thị lưới dữ liệu datagrid. |
| `/f Mở trình duyệt web, đi đến trang web https://famabook.com . Mở màn hình Thêm mới Luật chuyển đổi đơn vị tính. Tôi muốn thêm luật chuyển đổi đơn vị tính: Đơn vị nguồn: bao (Bao tải), Đơn vị tính: kg (kilogam), Tử số: 1, Mẫu số: 50. Sau đó Lưu và xem.` | **2. Thêm mới** | `/dashboard/uom-convert/new` | Chuyển tới form thêm mới. Tự động chọn đơn vị nguồn (`fromUomId` = Bao tải), đơn vị đích (`toUomId` = Kilôgam), điền tử số = 1, mẫu số = 50. Nhấn nút Lưu và chuyển sang màn hình Xem. |
| `/f Xem luật chuyển đổi từ bao tải sang kg.` | **3. Xem chi tiết** | `/dashboard/uom-convert/:id` | Tìm kiếm bản ghi có cặp chuyển đổi `bao` $\rightarrow$ `kg`. Lấy mã ID và điều hướng tới màn hình xem chi tiết `/dashboard/uom-convert/:id`. |
| `/f Sửa Luật chuyển đổi đơn vị tính từ bao sang kg , phần mẫu số sẽ là 40 chứ không phải 50 nữa.` | **4. Chỉnh sửa** | `/dashboard/uom-convert/:id/edit` | Mở form sửa của luật `bao` $\rightarrow$ `kg`. Cập nhật ô Mẫu số thành `40`. Nhấn nút Lưu. |
| `/f Xóa bỏ luật chuyển đổi đơn vị tính từ bao sang kg . Báo cáo số lượng Luật chuyển đổi đơn vị tính trước khi xóa và sau khi xóa.` | **5. Xóa an toàn** | WebMCP `delete_uom_convert` hoặc DOM Delete | 1. Đếm tổng số lượng luật hiện có ($N$).<br>2. Kiểm tra bản ghi: **Chỉ cho phép xóa luật do người dùng tạo ra**; nếu là luật do hệ thống cài đặt sẵn (`creator` là NULL hoặc luật mặc định), Tác nhân phải chặn lại và giải thích rõ.<br>3. Tiến hành xóa luật người dùng tạo.<br>4. Đếm lại tổng số lượng ($N-1$).<br>5. Báo cáo rõ ràng: số lượng trước xóa, tên luật đã xóa, số lượng sau xóa. |

---

## 2. QUY TẮC NGHIỆP VỤ LUẬT CHUYỂN ĐỔI ĐƠN VỊ TÍNH

1. **Công thức quy đổi**:
   $$\text{Giá trị (Đơn vị đích)} = \text{Giá trị (Đơn vị nguồn)} \times \frac{\text{Tử số (Numerator)}}{\text{Mẫu số (Denominator)}}$$
   *Ví dụ:* 1 Bao tải với Tử số = 1, Mẫu số = 50 nghĩa là 1 Bao tải = 50 Kilôgam (hoặc tỷ lệ chuẩn $1 \text{ bao} \times 50 / 1 = 50 \text{ kg}$).

2. **Quy tắc an toàn khi Xóa (Bảo vệ dữ liệu hệ thống)**:
   - Các luật do hệ thống cài đặt sẵn (như Tấn $\rightarrow$ Kg, Tạ $\rightarrow$ Kg, Yến $\rightarrow$ Kg, Kg $\rightarrow$ G, Mét khối $\rightarrow$ Lít...) được tạo tự động bởi thủ tục `INIT_DEFAULT_UOM_CONVERT` và có trường `creator` là `NULL`. **Tuyệt đối không được xóa các luật này**.
   - Người dùng **chỉ được phép xóa** các luật chuyển đổi do chính đơn vị/kế toán viên thêm mới trong quá trình vận hành kinh doanh.
   - Khi nhận lệnh xóa, Tác nhân **bắt buộc phải đối soát số lượng** trước và sau khi xóa:
     ```
     Số lượng Luật chuyển đổi trước khi xóa: N
     Đã xóa thành công luật chuyển đổi: [Đơn vị nguồn] -> [Đơn vị đích]
     Số lượng Luật chuyển đổi sau khi xóa: N - 1
     ```

---

## 3. BẢNG TRA CỨU ĐỊNH DANH DOM PHÂN HỆ `UomConvert`

Khi Tác nhân điều khiển giao diện web qua Playwright CDP hoặc JavaScript injection, sử dụng các bộ chọn DOM chuẩn sau:

### A. Màn hình Danh sách (`/dashboard/uom-convert`):
- Thẻ bao ngoài: `#uom-convert-list-page`
- Tiêu đề trang: `#uom-convert-list-title` ("Danh sách Luật chuyển đổi đơn vị tính")
- Nút Thêm mới: `#uom-convert-add-btn` (kích hoạt mở `/dashboard/uom-convert/new`)
- Ô tìm kiếm danh sách: `#uom-convert-search-box`
- Nút Xuất Excel: `#uom-convert-export-xlsx-btn`
- Lưới dữ liệu (Datagrid): `#uom-convert-datagrid`
- Dòng dữ liệu thứ `i`: `#uom-convert-row-{i}`
- Nút Xem dòng `i`: `#uom-convert-row-{i}-view-btn`
- Nút Sửa dòng `i`: `#uom-convert-row-{i}-edit-btn`
- Nút Xóa dòng `i`: `#uom-convert-row-{i}-delete-btn`
- Trạng thái trống (chưa có dữ liệu): `#uom-convert-empty-state`

### B. Màn hình Form Thêm mới / Chỉnh sửa (`/dashboard/uom-convert/new` & `/:id/edit`):
- Form chính: `#uom-convert-form`
- Tiêu đề form: `#uom-convert-form-title`
- Nút Quay lại danh sách: `#uom-convert-back-btn`
- Mã chuyển đổi đơn vị (`uomConvertCode`): `#uom-convert-field-uom-convert-code`
- Tên việc chuyển đổi (`uomConvertName`): `#uom-convert-field-uom-convert-name`
- Từ đơn vị tính (Dropdown select `fromUomId`): `#uom-convert-field-from-uom-id`
- Đến đơn vị tính (Dropdown select `toUomId`): `#uom-convert-field-to-uom-id`
- Tử số (`numerator`): `#uom-convert-field-numerator`
- Mẫu số (`denominator`): `#uom-convert-field-denominator`
- Nút Lưu form: `#uom-convert-save-btn` (hoặc `button[type="submit"]`)

### C. Màn hình Xem chi tiết (`/dashboard/uom-convert/:id`):
- Trang xem: `#uom-convert-view-page`
- Tiêu đề trang xem: `#uom-convert-view-title`
- Nút Sửa: `#uom-convert-edit-btn`
- Nút Quay lại: `#uom-convert-back-btn`

---

## 4. BỘ CÔNG CỤ WEBMCP TỰ ĐỘNG HÓA PHÂN HỆ QUY ĐỔI ĐƠN VỊ TÍNH

Khi chạy trong ngữ cảnh trình duyệt famabook.com, Tác nhân có thể gọi trực tiếp API WebMCP qua `window.modelContext.executeTool(name, args)`:

### 1. `list_uom_converts`
Lấy danh sách các luật chuyển đổi đơn vị tính kèm tổng số lượng:
```javascript
const res = await window.modelContext.executeTool('list_uom_converts', {});
// res.totalCount: Tổng số lượng luật
// res.items: Mảng chi tiết từng luật
```

### 2. `create_uom_convert`
Thêm mới một luật chuyển đổi. Tự động nhận diện tên đơn vị tính (ví dụ: "bao", "Bao tải", "kg", "kilogam"):
```javascript
const res = await window.modelContext.executeTool('create_uom_convert', {
  fromUom: 'bao',
  toUom: 'kg',
  numerator: 1,
  denominator: 50,
  convertName: 'Chuyển đổi Bao tải sang Kilôgam'
});
// Tự động điều hướng giao diện tới /dashboard/uom-convert/:id để người dùng xem ngay
```

### 3. `get_uom_convert`
Xem chi tiết một luật chuyển đổi theo ID hoặc theo cặp đơn vị:
```javascript
const res = await window.modelContext.executeTool('get_uom_convert', {
  fromUom: 'bao',
  toUom: 'kg'
});
// Tự động chuyển màn hình tới /dashboard/uom-convert/:id
```

### 4. `update_uom_convert`
Sửa luật chuyển đổi (ví dụ: đổi mẫu số thành 40):
```javascript
const res = await window.modelContext.executeTool('update_uom_convert', {
  fromUom: 'bao',
  toUom: 'kg',
  denominator: 40
});
```

### 5. `delete_uom_convert`
Xóa luật chuyển đổi do người dùng tạo, bảo vệ luật hệ thống và báo cáo số lượng trước/sau:
```javascript
const res = await window.modelContext.executeTool('delete_uom_convert', {
  fromUom: 'bao',
  toUom: 'kg'
});
// res.countBefore: số lượng trước khi xóa
// res.countAfter: số lượng sau khi xóa
// res.deletedItem: thông tin bản ghi vừa xóa
```

---

## 5. TÍCH HỢP LIÊN HỢP TRONG DESKTOP AGENT (VS CODE / FAMABOOK EXTENSION)

Trong Desktop Agent famabook (`E:\source_code\vscode`):
- Chat Participant `@f` được đăng ký mặc định. Người dùng chỉ cần gõ `/f <lệnh>` trên thanh chat.
- Khi nhận lệnh `/f`, Desktop Agent tự động:
  1. Nếu là lệnh mở màn hình $\rightarrow$ Kích hoạt `famabook_navigate` mở trực tiếp URL đích (`https://famabook.com/dashboard/uom-convert`).
  2. Nếu là lệnh thêm, xem, sửa, xóa $\rightarrow$ Kích hoạt công cụ `famabook_uom_convert` hoặc `famabook_webmcp_exec`.
  3. Trả về kết quả markdown tóm tắt rõ ràng, chuyên nghiệp cho kế toán viên.
