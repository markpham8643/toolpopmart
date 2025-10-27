const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config(); // Nạp các biến từ file .env

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error("Lỗi: Không tìm thấy GEMINI_API_KEY trong file .env. Vui lòng kiểm tra lại.");
    process.exit(1); // Dừng chương trình
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function runTest() {
    console.log("=====================================");
    console.log("Bắt đầu kiểm tra API Key với Gemini...");
    console.log("=====================================\n");

    // === Test 1: Kiểm tra model văn bản cơ bản ===
    try {
        console.log(">> Đang test model văn bản (gemini-pro)...");
        const textModel = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await textModel.generateContent("Hãy nói 'xin chào'");
        const response = await result.response;
        console.log("   ✅ Model văn bản (gemini-pro) HOẠT ĐỘNG! Gemini trả lời:", `"${response.text().trim()}"`);
    } catch (error) {
        console.error("   ❌ LỖI với model văn bản (gemini-pro):", error.message);
    }

    console.log("\n-------------------------------------\n");

    // === Test 2: Kiểm tra model hình ảnh ===
    try {
        console.log(">> Đang test model hình ảnh (gemini-pro-vision)...");
        // Đây là một ảnh trắng 1x1 pixel dưới dạng base64
        const dummyImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        
        const visionModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
        const prompt = "What is this image?";
        const imagePart = {
            inlineData: {
                data: dummyImageBase64,
                mimeType: "image/png"
            }
        };

        const result = await visionModel.generateContent([prompt, imagePart]);
        await result.response; // Chỉ cần chờ phản hồi, không cần đọc nội dung
        console.log("   ✅ Model hình ảnh (gemini-pro-vision) HOẠT ĐỘNG!");

    } catch (error) {
        console.error("   ❌ LỖI với model hình ảnh (gemini-pro-vision):", error.message);
    }
    
    console.log("\n=====================================");
    console.log("Kiểm tra hoàn tất.");
    console.log("=====================================");
}

runTest();