---
name: famabook-web-agent
description: Cẩm nang điều hướng siêu tốc (Instant Client-side Navigation < 20ms) và tương tác UI famabook.com cho AI Agent qua window.__reactNavigate, CustomEvent app:navigate, WebMCP (navigator.modelContext) và Playwright CDP. Tối ưu tốc độ chuyển trang, không reload, tra cứu toàn bộ router phân hệ kế toán.
---

# CẨM NANG ĐIỀU HƯỚNG SIÊU TỐC & TỰ ĐỘNG HÓA FAMABOOK.COM

Tài liệu này tổng hợp toàn bộ kiến trúc Frontend (`E:\source_code\acc10\frontend`), cơ chế định tuyến Client-side Router, WebMCP runtime nhúng (`navigator.modelContext`), bảng điều hướng toàn diện (Router Matrix) và các định danh DOM phục vụ cho AI Agent điều khiển và chuyển trang tức thì trên **famabook.com** với độ trễ thấp nhất (< 20ms).

---

## 1. NGUYÊN LÝ ĐIỀU HƯỚNG SIÊU TỐC (ZERO-LATENCY NAVIGATION)

### Tại sao KHÔNG DÙNG `page.goto()` để chuyển trang nội bộ?
* Khi gọi `page.goto('https://famabook.com/dashboard/...')`, trình duyệt phải thực hiện lại toàn bộ chu kỳ: DNS lookup, TCP/TLS handshake, tải lại file HTML, parse lại toàn bộ bundle JavaScript và CSS, nạp lại React root và kiểm tra lại xác thực OIDC.
* Quá trình này gây lãng phí 1.500ms – 3.000ms và làm nhấp nháy màn hình, mất cache tạm thời trong bộ nhớ.

### 4 Cấp độ Điều hướng Tức thì trong Frontend:

```javascript
// Cấp độ 1: Trực tiếp qua hook navigate của React Router (Nhanh nhất: < 5ms)
if (typeof window.__reactNavigate === 'function') {
  window.__reactNavigate('/dashboard/sales-contract/new');
}

// Cấp độ 2: Qua Event Bus chuẩn của Frontend (Được WebMCPInspector lắng nghe)
window.dispatchEvent(new CustomEvent('app:navigate', {
  detail: { path: '/dashboard/sales-contract/new' }
}));

// Cấp độ 3: Qua WebMCP In-browser Execution API (Chuẩn Chrome AI & Model Context Protocol)
// Tự động nhận diện từ khóa viết tắt như 'kho', 'hop-dong', 'hoa-don', 'bao-gia' sang URL chuẩn:
await window.modelContext.executeTool('navigate_to_page', {
  path: '/dashboard/sales-contract/new'
});

// Cấp độ 4: HTML5 History API Fallback
window.history.pushState({}, '', '/dashboard/sales-contract/new');
window.dispatchEvent(new PopStateEvent('popstate'));
```

### Cách gọi từ Playwright CDP không tốn tài nguyên:
```javascript
// Thay vì: await page.goto('https://famabook.com/dashboard/sales-contract/new'); (Mất 2 giây)
// Hãy dùng:
await page.evaluate((targetPath) => {
  if (typeof window.__reactNavigate === 'function') {
    window.__reactNavigate(targetPath);
  } else {
    window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: targetPath } }));
  }
}, '/dashboard/sales-contract/new');
// -> Chuyển trang tức thì trong 1 khung hình (16ms)!
```

---

## 2. BẢN ĐỒ ĐIỀU HƯỚNG ĐẦY ĐỦ CÁC PHÂN HỆ (ROUTING MATRIX)

Toàn bộ đường dẫn trích xuất trực tiếp từ `AppRoutes.tsx`:

### A. Phân hệ Bán hàng:
| Nghiệp vụ / Màn hình | Đường dẫn URL chuẩn | Chức năng |
| :--- | :--- | :--- |
| **Tổng quan tài chính** | `/dashboard` | KPI Doanh thu, Chi phí, Lợi nhuận, Quỹ |
| **Hợp đồng bán hàng (Danh sách)** | `/dashboard/sales-contract` | Quản lý hợp đồng kinh tế bán hàng |
| **Lập Hợp đồng bán hàng mới** | `/dashboard/sales-contract/new` | Tạo mới hợp đồng, xuất file Word DOCX |
| **Báo giá bán hàng** | `/dashboard/phan-he-ban-hang-bao-gia` | Danh sách báo giá gửi khách hàng |
| **Lập báo giá bán hàng mới** | `/dashboard/phan-he-ban-hang-bao-gia/new` | Tạo báo giá, xuất DOCX/XLSX |
| **Hóa đơn Bán hàng (Phải thu)** | `/dashboard/arinvoices` | Quản lý hóa đơn bán hàng, công nợ phải thu |
| **Lập hóa đơn bán hàng mới** | `/dashboard/arinvoices/new` | Ghi nhận doanh thu bán hàng & xuất kho |
| **Hóa đơn điện tử 30s** | `/dashboard/hoadon30s` | Cổng phát hành e-invoice 30s |
| **Đơn đặt hàng (Bán hàng)** | `/dashboard/phan-he-ban-hang-don-mua-hang` | Theo dõi đơn đặt hàng từ khách |
| **Quy trình bán hàng** | `/dashboard/quy-trinh-ban-hang` | Sơ đồ luồng luân chuyển chứng từ bán hàng |

### B. Phân hệ Mua hàng:
| Nghiệp vụ / Màn hình | Đường dẫn URL chuẩn | Chức năng |
| :--- | :--- | :--- |
| **Hóa đơn Mua hàng (Phải trả)** | `/dashboard/purchase-invoice` | Quản lý chi phí mua vào, công nợ NCC |
| **Lập hóa đơn mua hàng mới** | `/dashboard/purchase-invoice/new` | Ghi nhận hóa đơn đầu vào, nhập kho |
| **Đơn đặt mua hàng** | `/dashboard/purchase-order` | Lập đơn đặt hàng gửi nhà cung cấp |
| **Hợp đồng mua hàng** | `/dashboard/purchase-contract` | Hợp đồng kinh tế mua hàng hóa/dịch vụ |
| **Quy trình mua hàng** | `/dashboard/purchase-process` | Sơ đồ quy trình mua sắm |

### C. Phân hệ Kho hàng & Vật tư:
| Nghiệp vụ / Màn hình | Đường dẫn URL chuẩn | Chức năng |
| :--- | :--- | :--- |
| **Danh mục Kho hàng** | `/dashboard/warehouse` | Danh sách các kho hàng công ty |
| **Thêm mới Kho hàng** | `/dashboard/warehouse/new` | Form thêm mới kho (mã kho, tên kho, TK 156) |
| **Hàng hóa, vật tư, dịch vụ** | `/dashboard/goods` | Danh mục sản phẩm, vật tư tồn kho |
| **Thêm mới Hàng hóa** | `/dashboard/goods/new` | Khai báo mã hàng, đơn vị tính, giá vốn/bán |
| **Bảng giá hàng hóa** | `/dashboard/goods-price` | Thiết lập chính sách giá bán |
| **Sổ chi tiết vật tư/hàng hóa** | `/dashboard/goods-ledger` | Thẻ kho, sổ chi tiết nhập xuất tồn |
| **Lệnh sản xuất** | `/dashboard/lenh-san-xuat` | Quản lý lệnh sản xuất, định mức |

### D. Kế toán Tổng hợp & Báo cáo Tài chính TT 99:
| Nghiệp vụ / Màn hình | Đường dẫn URL chuẩn | Chức năng |
| :--- | :--- | :--- |
| **Hệ thống Tài khoản kế toán** | `/dashboard/accounting-account` | Danh mục tài khoản theo TT 99/2025/TT-BTC |
| **Định khoản kế toán** | `/dashboard/dinh-khoan` | Nghiệp vụ hạch toán Nợ/Có |
| **Sổ Nhật ký chung (S01-DN)** | `/dashboard/nhat-ky-chung` | Sổ nhật ký chung mẫu chuẩn Bộ Tài chính |
| **Tất cả chứng từ** | `/dashboard/tat-ca-chung-tu` | Tra cứu toàn bộ chứng từ thu, chi, nhập, xuất |
| **Báo cáo tài chính TT 99** | `/dashboard/bao-cao-tai-chinh` | B01-DN, B02-DN, B03-DN chuẩn HTKK 5.7.6 |
| **Tích hợp phần mềm HTKK** | `/dashboard/htkk-integration` | Kết xuất XML BCTC liên thông vào HTKK |
| **Lịch nộp tờ khai thuế** | `/dashboard/lich-nop-to-khai-thue` | Lịch theo dõi hạn nộp thuế GTGT, TNDN, TNCN |

### E. Quản trị, Đối tác & Ngân hàng:
| Nghiệp vụ / Màn hình | Đường dẫn URL chuẩn | Chức năng |
| :--- | :--- | :--- |
| **Đối tác (Khách hàng/NCC)** | `/dashboard/party` | Danh bạ khách hàng, nhà cung cấp, MST |
| **Giấy báo Có (Ngân hàng)** | `/dashboard/bank-deposit` | Thu tiền gửi ngân hàng, đối soát sao kê |
| **Cơ cấu tổ chức** | `/dashboard/organization-structure` | Phòng ban, chi nhánh, công ty con |
| **Người ký báo cáo** | `/dashboard/report-signer` | Thiết lập chữ ký GĐ, Kế toán trưởng |

---

## 2. BẢNG TRA CỨU ĐỊNH DANH DOM & FORM CONTROLS (DOM SELECTORS)

Để con trỏ chuột phong cách ChatGPT lướt và click chính xác, hãy dùng các bộ chọn DOM đã được chuẩn hóa trong Frontend:

### A. Phân hệ Kho hàng (`/dashboard/warehouse` & `/dashboard/warehouse/new`):
- Nút thêm mới trên trang danh sách: `#warehouse-add-btn` hoặc `button:contains("Thêm mới")`
- Ô tìm kiếm danh mục kho: `#warehouse-search-box`
- Nút xuất file Excel: `button:contains("Xuất XLSX")`
- **Form thêm mới / chỉnh sửa kho**:
  - Mã kho (`warehouseCode`): `#warehouse-field-warehouse-code`
  - Tên kho (`warehouseName`): `#warehouse-field-warehouse-name`
  - Ghi chú (`notes`): `#warehouse-field-notes`
  - Nút Lưu form: `#warehouse-save-btn` hoặc `button[type="submit"]`
  - Nút Hủy: `button:contains("Hủy")`
  - Nút Quay lại: `#warehouse-back-btn`

### B. Phân hệ Bán hàng & Hóa đơn (`/dashboard/arinvoices`):
- Nút mở menu Bán hàng trên Top Nav:
  `button.nav-link` có chữ `"Bán hàng"` (hoặc cha chứa `menuId="sales-menu"`)
- Submenu Hóa đơn Bán hàng:
  Phần tử `MenuItem` có nhãn text `"Hóa đơn Bán hàng"`
- Nút Lập hóa đơn mới: `button:contains("Thêm mới")` hoặc `navigate('/dashboard/arinvoices/new')`
- Ô tìm kiếm hóa đơn: `#ArInvoiceSearchHistory` hoặc ô input text trong Toolbar

### C. Phân hệ Hợp đồng Bán hàng (`/dashboard/sales-contract` & `/dashboard/sales-contract/new`):
- **Trang danh sách (`/dashboard/sales-contract`)**:
  - Nút thêm mới hợp đồng: `#sales-contract-add-btn` hoặc `button:contains("Thêm mới")`
  - Ô tìm kiếm danh sách: `#sales-contract-search-box`
  - Nút xuất file Excel: `#sales-contract-export-xlsx-btn`
  - Nút xem chi tiết dòng đầu tiên: `#sales-contract-row-0-view-btn`
  - Nút sửa dòng đầu tiên: `#sales-contract-row-0-edit-btn`
- **Form thêm mới / chỉnh sửa hợp đồng (`/dashboard/sales-contract/new`)**:
  - Số chứng từ (`accountingDocumentNumber`): `#sales-contract-field-accounting-document-number`
  - Số hợp đồng (`contractCode`): `#sales-contract-field-contract-code`
  - Tiêu đề hợp đồng (`contractSubject`): `#sales-contract-field-contract-subject`
  - Khách hàng / Đối tác (`accountObjectName`): `#sales-contract-field-account-object-name`
  - Nhân viên phụ trách (`employeeId`): `#sales-contract-field-employee-id`
  - Nút thêm dòng chi tiết hàng hóa: `#sales-contract-add-row-btn`
  - Chi tiết hàng hóa dòng thứ `index` (0, 1, 2...):
    - Mã / tên hàng hóa: `#sales-contract-detail-goods-${index}`
    - Đơn vị tính: `#sales-contract-detail-uom-${index}`
    - Số lượng: `#sales-contract-detail-quantity-${index}`
    - Đơn giá: `#sales-contract-detail-unit-price-${index}`
    - Thuế suất GTGT: `#sales-contract-detail-vat-tax-rate-${index}` (Không chịu thuế / 0% / 5% / 8% / 10%)
  - Nút Lưu hợp đồng: `#sales-contract-save-btn` hoặc `button[type="submit"]`
  - Nút Xuất DOCX (khi ở chế độ xem): `#sales-contract-export-docx-btn`
  - Nút Xuất XLSX (khi ở chế độ xem): `#sales-contract-export-xlsx-btn`
  - Nút Quay lại: `#sales-contract-back-btn`

### D. Quy tắc kích hoạt sự kiện React (Bắt buộc):
Khi điền giá trị vào các ô `<input>` do React quản lý (React Hook Form), việc chỉ gán `el.value = 'ABC'` là chưa đủ. Agent phải dispatch các sự kiện:
```javascript
el.value = 'ABC';
el.dispatchEvent(new Event('input', { bubbles: true }));
el.dispatchEvent(new Event('change', { bubbles: true }));
```

---

## 3. ENGINE TỰ ĐỘNG HÓA NHANH & ỔN ĐỊNH (`window.__acc10`)

Ưu tiên **tính đơn giản và độ ổn định cao**, thao tác trực tiếp trên DOM và dispatch sự kiện React:

```javascript
// 1. Chuyển trang tức thì (< 20ms)
window.__acc10.appNavigate('/dashboard/sales-contract/new');

// 2. Điền dữ liệu vào input React Form chuẩn xác
window.__acc10.setInputValue(document.getElementById('sales-contract-field-contract-subject'), 'Hợp đồng kinh tế BKIT - SIGMANANO');

// 3. Click phần tử DOM trực tiếp
window.__acc10.clickElement(document.getElementById('sales-contract-save-btn'));
```

---

## 4. TÍCH HỢP PLAYWRIGHT CDP & TỐI ƯU TỐC ĐỘ TỐI ĐA (ZERO-OVERHEAD AUTOMATION)

Để AI Agent thao tác trên famabook.com với tốc độ nhanh nhất, cần loại bỏ toàn bộ các tác vụ nặng (như quay video màn hình, delay chờ tĩnh, re-render thừa):

### A. Cấu hình Playwright Tốc độ Tối đa (Tắt mọi overhead):
```javascript
import { chromium } from 'playwright';
import path from 'path';
import os from 'os';

const userDataDir = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Acc10_Playwright_Data');

const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chrome',
  headless: false, // Hoặc true nếu muốn chạy ngầm 100%
  viewport: { width: 1366, height: 768 },
  // KHÔNG bật recordVideo để tránh nghẽn I/O ổ cứng và CPU
});
```

### B. Mẹo điều hướng không chờ mạng (Instant In-Page Route):
```javascript
// Thay vì chờ mạng reload trang:
// await page.goto('https://famabook.com/dashboard/sales-contract/new');
// Hãy dùng evaluate gọi trực tiếp router nội bộ:
await page.evaluate((target) => {
  if (typeof window.__reactNavigate === 'function') {
    window.__reactNavigate(target);
  } else {
    window.dispatchEvent(new CustomEvent('app:navigate', { detail: { path: target } }));
  }
}, '/dashboard/sales-contract/new');

// Chỉ cần đợi form selector xuất hiện:
await page.waitForSelector('#sales-contract-form', { timeout: 5000 });
```

### C. Quản lý Phiên Đăng nhập & Xác thực 2FA OTP:
* Đường dẫn lưu cache phiên bền vững: `%LocalAppData%\Acc10_Playwright_Data`.
* Khi phiên đăng nhập hết hạn và bị chuyển hướng về Keycloak (`auth.bkit.vn`):
  1. Tự động điền email (`vy@bkit.vn`) và mật khẩu.
  2. Tại màn hình 2FA (`textbox "One-time code"` hoặc `input[name="otp"]`), người dùng nhập OTP một lần duy nhất trên cửa sổ trình duyệt.
  3. Session được ghi nhớ bền vững, các lần chạy kế tiếp sẽ vào thẳng hệ thống mà không cần đăng nhập lại.

---

## 5. QUY TRÌNH TỰ ĐỘNG XUẤT & MỞ TẬP TIN DOCX / XLSX TRÊN WINDOWS

Khi tạo xong chứng từ / hợp đồng và cần xuất file Word (`.docx`) hoặc Excel (`.xlsx`):
1. **Lắng nghe sự kiện download trong Playwright**:
```javascript
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.locator('#sales-contract-export-docx-btn').click(),
]);
const downloadPath = path.join(process.cwd(), download.suggestedFilename());
await download.saveAs(downloadPath);
```

2. **Mở tập tin DOCX ngay lập tức cho người dùng xem**:
```powershell
Start-Process -FilePath "<downloadPath>"
```
Lệnh này kích hoạt ứng dụng đọc Word mặc định (Microsoft Word, WPS Office hoặc LibreOffice) để mở tài liệu ngay trước mắt người dùng.

---

## 6. DANH MỤC CÔNG CỤ WEBMCP TỰ ĐỘNG HÓA VÉT CẠN (EXHAUSTIVE WEBMCP TOOLS)

Hệ thống WebMCP tại `frontend/src/webmcp/` cung cấp API nhúng trực tiếp vào trình duyệt qua `window.modelContext` / `navigator.modelContext`, đồng thời tự động chuyển đổi thành OpenAI Function Calling schema cho các LLM như DeepSeek V3/V4/Flash, ChatGPT.

### A. Cách gọi công cụ từ Playwright CDP hoặc Console:
```javascript
// Gọi trực tiếp từ page.evaluate không cần giả lập click DOM:
const result = await page.evaluate(async () => {
  return await window.modelContext.executeTool('create_sales_contract', {
    partnerName: 'Công ty SIGMANANO',
    contractSubject: 'Hợp đồng kinh tế BKIT - SIGMANANO',
    employeeName: 'Nguyễn Phương Dung',
    details: [
      { goodsName: 'Microsoft Project', quantity: 3, unitPrice: 4000000, vatRate: 'Không chịu thuế' },
      { goodsName: 'SQL Server 2025 Standard', quantity: 2, unitPrice: 25000000, vatRate: 'Không chịu thuế' }
    ]
  });
});
console.log(result.message); // Hợp đồng được lưu và giao diện tự động chuyển đến trang chi tiết!
```

### B. Bảng tra cứu các công cụ WebMCP theo phân hệ:

#### 1. Bán hàng & Phải thu (Sales):
* `create_sales_contract`: Lập hợp đồng kinh tế bán hàng với danh sách hàng hóa/dịch vụ, thuế suất, điều khoản.
* `export_sales_contract_docx`: Xuất hợp đồng bán hàng ra file Word `.docx` chuẩn mẫu.
* `create_sales_quotation`: Lập báo giá bán hàng gửi cho khách hàng.
* `create_sales_order`: Lập đơn đặt hàng bán từ khách hàng.
* `create_document_01_bh`: Lập hóa đơn bán hàng kiêm phiếu xuất kho theo mẫu 01-BH (TT 99).
* `create_ar_invoice`: Tạo hóa đơn bán hàng ghi nhận doanh thu và công nợ phải thu.

#### 2. Mua hàng & Phải trả (Purchases):
* `create_purchase_order`: Lập đơn đặt mua hàng (PO) gửi nhà cung cấp.
* `create_purchase_contract`: Lập hợp đồng kinh tế mua hàng/dịch vụ từ NCC.
* `create_purchase_invoice`: Lập hóa đơn mua hàng đầu vào, chi phí mua hàng và công nợ phải trả.

#### 3. Kho hàng & Vật tư (Inventory):
* `create_warehouse`: Khai báo thêm kho hàng mới vào hệ thống danh mục.
* `create_goods`: Thêm mới vật tư, hàng hóa, dịch vụ vào danh mục tồn kho.
* `create_document_01_vt`: Lập Phiếu nhập kho (Mẫu 01-VT theo TT 99).
* `create_document_02_vt`: Lập Phiếu xuất kho (Mẫu 02-VT theo TT 99).

#### 4. Tiền mặt & Ngân hàng (Cash & Bank):
* `create_document_01_tt`: Lập Phiếu thu tiền mặt (Mẫu 01-TT theo TT 99).
* `create_document_02_tt`: Lập Phiếu chi tiền mặt (Mẫu 02-TT theo TT 99).
* `create_bank_deposit`: Lập Giấy báo Có / Nộp tiền vào tài khoản ngân hàng.
* `create_bank_withdraw`: Lập Ủy nhiệm chi / Giấy báo Nợ rút tiền tài khoản ngân hàng.
* `create_bank_internal_transfer`: Lập lệnh chuyển tiền giữa các tài khoản ngân hàng nội bộ.

#### 5. Đối tác & Danh mục Kế toán (Master Data):
* `create_partner`: Thêm mới đối tác (Khách hàng / Nhà cung cấp) kèm MST, địa chỉ, email, số điện thoại.
* `create_accounting_account`: Thêm mới tài khoản kế toán theo hệ thống TK Thông tư 99/2025/TT-BTC.

#### 6. Tự động hóa Giao diện & Báo cáo Tài chính (UI & Reports):
* `get_active_screen_context`: Phân tích ngữ cảnh màn hình hiện tại (đường dẫn URL, tên phân hệ, form đang mở).
* `fill_active_form_fields`: Điền hàng loạt trường dữ liệu vào form React đang hiển thị trên màn hình.
* `export_financial_statement`: Xuất trọn bộ Báo cáo tài chính (B01-DN, B02-DN, B03-DN) ra XML HTKK hoặc Excel.

#### 7. Điều hướng & Cơ sở dữ liệu Kế toán (Navigation & Database Query):
* `navigate_to_page`: Điều hướng tức thì sang bất kỳ phân hệ nào mà không reload trang.
* `search_system_menu`: Tìm kiếm nhanh vị trí chức năng hoặc mẫu biểu chứng từ.
* `view_financial_dashboard`: Xem dashboard KPI tài chính tổng quan.
* `list_entities`: Liệt kê 256 bảng dữ liệu kế toán trong CSDL.
* `get_records`: Lấy danh sách dữ liệu từ bảng bất kỳ.
* `search_records`: Tìm kiếm đối tượng, chứng từ theo từ khóa.
* `count_records`: Đếm số lượng bản ghi trong bảng.
* `get_entity_schema`: Xem chi tiết schema các cột và ràng buộc của bảng.
* `execute_query`: Chạy truy vấn SQL SELECT an toàn với phân lập đa người dùng (multi-tenancy).
* `export_entity_to_excel`: Xuất bảng dữ liệu ra file Excel (.xlsx).
* `get_application_downloads`: Lấy link tải phần mềm HTKK, iTaxViewer, chữ ký số.

---

## 7. CƠ CHẾ NGĂN CHẶN DEEPSEEK / LLM TRẢ LỜI CHỮ SUÔNG (PREVENTING PLAIN-TEXT STALLING)

Khi người dùng ra lệnh tạo chứng từ bằng tiếng Việt tự nhiên (ví dụ: *"Thêm mới hợp đồng bán hàng cho công ty ABC..."*), mô hình ngôn ngữ cần gọi tool thay vì chỉ sinh text hướng dẫn.

1. **Tool Definition Injection**:
   Mọi WebMCP tool từ `coreWebMCPTools` đều được tự động ánh xạ qua `webMCPToolsToOpenAITools()` đưa vào `tools` payload của DeepSeek API, kèm theo thuộc tính `tool_choice: 'auto'`.

2. **Strict System Prompt Enforcement**:
   Prompt chỉ thị rõ cho LLM:
   - BẮT BUỘC ưu tiên gọi function call ngay khi phát hiện người dùng muốn tạo mới, xuất file hoặc điều hướng.
   - KHÔNG chỉ trả lời hướng dẫn bằng văn bản mà hãy trực tiếp thực hiện hành động.
   - Sau khi tool thực thi thành công và trả về thông điệp, LLM mới tóm tắt kết quả cho kế toán viên.

3. **Client-Side Execution Routing**:
   Hàm `executeDualMcpTool` trong `aiChatService.ts` phân biệt rõ:
   - Tool WebMCP Client (tạo chứng từ, điền form, điều hướng): Thực thi trực tiếp trong môi trường React, kích hoạt state cập nhật và router tức thì (< 20ms).
   - Tool Backend Database (SQL SELECT, get_records): Định tuyến qua `/api/McpBridge/call` vào backend Go để truy vấn dữ liệu an toàn.

