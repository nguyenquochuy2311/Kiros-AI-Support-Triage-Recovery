# PRODUCT ANALYSIS & REQUIREMENTS DOCUMENT (PRD)
**Project:** AI Support "Triage & Recovery" Hub (Option A)
**Role:** Senior Full Stack Engineer Assessment
**Date:** Jan 31, 2026

---

## 1. Executive Summary (Tổng quan)
Hệ thống **AI Support Triage Hub** giải quyết vấn đề "nút thắt cổ chai" trong quy trình chăm sóc khách hàng. Thay vì để nhân viên CSKH phải đọc thủ công từng email, hệ thống sẽ tự động tiếp nhận, phân loại, đánh giá mức độ khẩn cấp và soạn thảo câu trả lời nháp sử dụng Generative AI.
Điểm mấu chốt của hệ thống là khả năng **xử lý bất đồng bộ (Asynchronous Processing)** để đảm bảo trải nghiệm người dùng cuối nhanh nhất, trong khi AI xử lý tác vụ nặng ở nền.

---

## 2. Business Analysis (Góc nhìn Phân tích Nghiệp vụ)

### 2.1. Vấn đề (Pain Points)
- **User:** Gửi khiếu nại và phải chờ đợi lâu mới nhận được phản hồi, không biết ticket của mình đã được ghi nhận chưa.
- **Agent:** Bị quá tải bởi hàng trăm ticket rác hoặc ticket đơn giản. Tốn thời gian gõ lại các câu trả lời mẫu (boilerplate). Khó xác định ticket nào cần xử lý gấp (VIP/Angry user).
- **System:** Việc gọi AI trực tiếp (Synchronous) khi nhận Request sẽ làm treo API từ 5-10s, dẫn đến timeout và trải nghiệm tồi tệ.

### 2.2. Giải pháp (Solution Strategy)
- **Decoupling (Tách rời):** Tách việc "Tiếp nhận" (Ingestion) và "Xử lý" (Processing) thành 2 luồng riêng biệt.
- **AI Augmentation:** AI không thay thế con người, mà đóng vai trò "trợ lý sơ cấp" (Triage Nurse) để chuẩn bị sẵn đạn dược cho Agent bắn.
- **Real-time Feedback:** Cập nhật trạng thái xử lý theo thời gian thực để Agent cảm thấy hệ thống đang "sống".

### 2.3. Rủi ro & Chiến lược giảm thiểu (Risk Analysis)
| Rủi ro | Mức độ | Chiến lược giảm thiểu (Engineering Depth) |
| :--- | :--- | :--- |
| **AI Hallucination** (AI trả lời sai) | Medium | Agent luôn phải review và nhấn "Approve" trước khi gửi. Không gửi tự động. |
| **Malformed JSON** (AI trả sai định dạng) | High | Sử dụng **Zod** để validate output. Nếu lỗi, Worker sẽ retry hoặc fallback về giá trị mặc định, không làm crash app. |
| **High Load** (Spam ticket) | High | API trả về ngay lập tức (Non-blocking). Sử dụng Queue (Redis) để đệm (buffer) tải. |
| **API Failure** (OpenAI sập) | Low | Cơ chế **Exponential Backoff Retry** trong Worker. |

---

## 3. Functional Requirements (Yêu cầu Chức năng)

### 3.1. Ticket Ingestion API (The "Bottleneck" Test)
- **Actor:** End User / External System.
- **Endpoint:** `POST /api/tickets`
- **Input:** `{ content: string, userEmail: string }`
- **Behavior:**
  1. Validate input (không được rỗng).
  2. Tạo bản ghi DB với trạng thái `PENDING`.
  3. Đẩy Job vào Queue (`ticket-processing`).
  4. **Trả về ngay lập tức** (Response Time < 200ms).
- **Output:** `201 Created` + `{ id: "uuid", status: "queued" }`.

### 3.2. AI Worker Engine (Background Process)
- **Actor:** System (Worker).
- **Trigger:** Có Job mới trong Queue.
- **Process:**
  1. Lấy nội dung ticket.
  2. Gọi LLM với Prompt kỹ thuật (System Prompt) yêu cầu trả về JSON.
  3. **AI Tasks:**
     - `Category`: Phân loại (Billing, Tech, Feature, Other).
     - `Urgency`: Đánh giá (High, Medium, Low) dựa trên từ khóa (e.g., "dữ liệu bị mất", "gấp").
     - `Sentiment`: Chấm điểm cảm xúc (1-10).
     - `Draft`: Soạn câu trả lời lịch sự, empathic.
  4. Validate JSON output bằng Zod.
  5. Cập nhật DB -> Trạng thái `PROCESSED`.
  6. Bắn sự kiện `ticket-updates` vào Redis Pub/Sub.

### 3.3. Agent Dashboard (Real-time UI)
- **Actor:** Support Agent.
- **Views:**
  - **List View:** Hiển thị danh sách ticket.
    - Sắp xếp: Ưu tiên `High Urgency` lên đầu.
    - Visual: Badge màu đỏ cho High, xanh cho Low.
    - Real-time: Tự động cập nhật khi Worker xử lý xong (qua SSE).
  - **Detail View:**
    - Xem nội dung gốc.
    - Xem AI Analysis (Category, Sentiment).
    - Editor: Chỉnh sửa `Draft Response`.
    - Action: Button "Resolve & Send" (Lưu `finalReply`, đổi status `RESOLVED`).

---

## 4. Non-Functional Requirements (Yêu cầu Phi chức năng)
*Đây là phần ghi điểm "Engineering Depth"*

1.  **Performance:** API Ingestion phải chịu tải cao, không bao giờ được chờ AI.
2.  **Resilience (Khả năng phục hồi):**
    - Nếu Worker chết, Job trong Redis không được mất. Khi Worker sống lại phải xử lý tiếp.
    - Frontend mất mạng phải tự kết nối lại (Auto-reconnect).
3.  **Extensibility (Khả năng mở rộng):**
    - Code phải dùng **Adapter Pattern** cho Queue để dễ dàng đổi từ BullMQ sang RabbitMQ/Kafka.
4.  **Maintainability:**
    - Type Safety tuyệt đối (Full TypeScript).
    - Environment Variables quản lý chặt chẽ.

---

## 5. Data Schema & Models

### Table: Tickets
| Field | Type | Description | AI Generated? |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | No |
| `content` | String | Nội dung khiếu nại | No |
| `status` | Enum | `PENDING`, `PROCESSED`, `RESOLVED`, `FAILED` | No (Updated by System) |
| `createdAt` | DateTime | Thời gian tạo | No |
| `category` | String | Billing, Technical, etc. | **Yes** |
| `urgency` | Enum | `High`, `Medium`, `Low` | **Yes** |
| `sentiment` | Int | 1 (Angry) - 10 (Happy) | **Yes** |
| `draftReply` | Text | AI gợi ý trả lời | **Yes** |
| `finalReply` | Text | Agent chốt câu trả lời | No |

---

## 6. Logic Flow (Mermaid Diagram)

```mermaid
sequenceDiagram
    participant User
    participant API as API Server (Express)
    participant DB as PostgreSQL
    participant Q as Queue (Redis)
    participant W as Worker (Node.js)
    participant AI as LLM (OpenAI)
    participant Dashboard as Agent Dashboard

    User->>API: POST /tickets (Complaint)
    API->>DB: Create Ticket (Status: PENDING)
    API->>Q: Add Job {ticketId}
    API-->>User: 201 Created (Immediate Response)
    
    par Background Processing
        W->>Q: Process Job
        W->>DB: Fetch Ticket Content
        W->>AI: Analyze & Draft (JSON Mode)
        AI-->>W: JSON {category, urgency, draft...}
        W->>W: Zod Validation
        W->>DB: Update Ticket (Status: PROCESSED)
        W->>Redis PubSub: Publish "Ticket Updated"
    and Real-time Update
        Redis PubSub->>API: Notify Subscriber
        API-->>Dashboard: SSE Event (Update UI)
    end
    
    Dashboard->>Dashboard: Auto-refresh Row (Green/Red Badge)