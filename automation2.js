// Import các thư viện cần thiết
const puppeteer = require('puppeteer');
const fs = 'fs'; // Chỉ dùng để đọc file data.txt
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config(); // Nạp các biến từ file .env

// --- START: Cấu hình an toàn ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    throw new Error("Không tìm thấy GEMINI_API_KEY. Vui lòng tạo file .env và thêm key vào.");
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// --- END: Cấu hình an toàn ---

/**
 * Hàm đọc dữ liệu người dùng từ file text.
 * @param {string} filePath Đường dẫn đến file data.txt.
 * @returns {Array<Object>} Mảng các đối tượng người dùng.
 */
async function readData(filePath) {
    try {
        const fileContent = await require('fs').promises.readFile(filePath, 'utf-8');
        const lines = fileContent.split('\n').filter(line => line.trim() !== "");
        
        return lines.map(line => {
            const parts = line.split('|');
            return {
                name: parts[0]?.trim(),
                day: parts[1]?.trim(),
                month: parts[2]?.trim(),
                year: parts[3]?.trim(),
                phone: parts[4]?.trim(),
                email: parts[5]?.trim(),
                id: parts[6]?.trim()
            };
        });
    } catch (error) {
        console.error("Lỗi: Không thể đọc được file data.txt. Hãy chắc chắn file tồn tại và đúng định dạng.", error);
        return [];
    }
}

/**
 * Chụp ảnh CAPTCHA, gửi đến Gemini và nhận lại kết quả.
 * Xử lý ảnh hoàn toàn trong bộ nhớ để tối ưu tốc độ.
 * @param {import('puppeteer').Page} page - Đối tượng trang của Puppeteer.
 * @param {string} captchaSelector - Selector CSS của phần tử CAPTCHA.
 * @returns {Promise<string|null>} - Trả về text CAPTCHA hoặc null nếu thất bại.
 */
// async function solveCaptchaWithGemini(page, captchaSelector) {
//     try {
//         console.log("   -> Chụp ảnh CAPTCHA...");
//         const captchaElement = await page.waitForSelector(captchaSelector, { visible: true });
//         if (!captchaElement) throw new Error("Không tìm thấy phần tử CAPTCHA trên trang.");

//         // Chụp ảnh và lấy dữ liệu base64 trực tiếp từ bộ nhớ
//         const imageBase64 = await captchaElement.screenshot({ encoding: 'base64' });

//         console.log("   -> Gửi ảnh đến Gemini để giải...");
//         const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-vision-latest" });
//         const prompt = "Hãy đọc chính xác các ký tự trong ảnh. Chỉ trả về chuỗi ký tự, không giải thích gì thêm.";
        
//         const imagePart = {
//             inlineData: {
//                 data: imageBase64,
//                 mimeType: "image/png"
//             }
//         };

//         const result = await model.generateContent([prompt, imagePart]);
//         const response = await result.response;
//         // Làm sạch kết quả: xóa khoảng trắng, ký tự đặc biệt có thể Gemini trả về
//         const captchaText = response.text().trim().replace(/\s+/g, '');

//         if (!captchaText) {
//             console.log("   -> Gemini không trả về kết quả.");
//             return null;
//         }
        
//         console.log(`   -> Gemini giải được: ${captchaText}`);
//         return captchaText;

//     } catch (error) {
//         console.error("   [LỖI] Không thể giải CAPTCHA bằng Gemini:", error.message);
//         return null;
//     }
// }

async function solveCaptchaWithGemini(page, captchaSelector) {
    try {
        console.log("   -> Chụp ảnh CAPTCHA...");
        const captchaElement = await page.waitForSelector(captchaSelector, { visible: true });
        if (!captchaElement) throw new Error("Không tìm thấy phần tử CAPTCHA trên trang.");

        const imageBase64 = await captchaElement.screenshot({ encoding: 'base64' });

        console.log("   -> Gửi ảnh đến Gemini để giải...");
        
        // DÒNG ĐÃ THAY ĐỔI
       const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
        
        const prompt = "Hãy đọc chính xác các ký tự trong ảnh. Chỉ trả về chuỗi ký tự, không giải thích gì thêm.";
        
        const imagePart = {
            inlineData: {
                data: imageBase64,
                mimeType: "image/png"
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const captchaText = response.text().trim().replace(/\s+/g, '');

        if (!captchaText) {
            console.log("   -> Gemini không trả về kết quả.");
            return null;
        }
        
        console.log(`   -> Gemini giải được: ${captchaText}`);
        return captchaText;

    } catch (error) {
        console.error("   [LỖI] Không thể giải CAPTCHA bằng Gemini:", error.message);
        return null;
    }
}

/**
 * Hàm điền thông tin cá nhân vào form.
 */
async function fillForm(page, person) {
    await page.type('#txtHoTen', person.name);
    await page.type('#txtNgaySinh_Ngay', person.day);
    await page.type('#txtNgaySinh_Thang', person.month);
    await page.type('#txtNgaySinh_Nam', person.year);
    await page.type('#txtSoDienThoai', person.phone);
    await page.type('#txtEmail', person.email);
    await page.type('#txtCCCD', person.id);
}

/**
 * Hàm chính thực hiện quá trình đăng ký cho một người trên một tab.
 * @param {import('puppeteer').Browser} browser - Đối tượng trình duyệt Puppeteer.
 * @param {Object} person - Thông tin của một người.
 */
async function registerPerson(browser, person) {
    console.log(`\n[BẮT ĐẦU] Mở tab mới cho: ${person.name}`);
    const page = await browser.newPage();

    try {
        const indexPath = path.resolve(__dirname, 'index.html');
        await page.goto(`file://${indexPath}`);
        console.log(` -> Đang ở trang đếm ngược cho ${person.name}...`);

        await page.waitForNavigation({ timeout: 35000 });
        console.log(` -> Đã chuyển đến trang form.html cho ${person.name}.`);

        const dateOptions = await page.$$eval('#slNgayBanHang option', options => 
            options.map(option => option.value).filter(value => value)
        );

        if (dateOptions.length === 0) {
            console.log(` -> Không tìm thấy ngày nào để đăng ký cho ${person.name}. Đóng tab.`);
            await page.close();
            return;
        }
        console.log(` -> Tìm thấy ${dateOptions.length} ngày. Bắt đầu lặp...`);
        
        // Lặp qua từng ngày và thực hiện đăng ký
        for (const [index, dateValue] of dateOptions.entries()) {
            console.log(`  -> Đăng ký ngày ${index + 1}/${dateOptions.length} cho ${person.name}...`);
            await fillForm(page, person);
            
            await page.select('#slNgayBanHang', dateValue);
            await page.waitForSelector('#slPhien option[value="1"]');
            await page.select('#slPhien', '1');
            
            const captchaCode = await solveCaptchaWithGemini(page, '#dvCaptcha');
            
            if (!captchaCode) {
                console.log(`   [THẤT BẠI] Không giải được CAPTCHA. Tải lại trang để thử ngày tiếp theo.`);
                await page.reload({ waitUntil: "domcontentloaded" });
                continue; // Bỏ qua ngày này
            }
            
            await page.type('#txtCaptcha', captchaCode);
            await page.click('#ckbDongY');
            await page.click('#btDangKyThamGia');

            try {
                await page.waitForSelector('#dvTaoMaQR', { visible: true, timeout: 10000 });
                console.log(`   ✔️  Đăng ký thành công cho ${person.name}`);
            } catch (e) {
                console.log(`   ❌ Đăng ký thất bại cho ${person.name}. Có thể CAPTCHA sai hoặc thông tin không hợp lệ.`);
            }

            // Nếu không phải ngày cuối cùng, tải lại trang để đăng ký ngày tiếp theo
            if (index < dateOptions.length - 1) {
                console.log("   -> Tải lại trang để đăng ký ngày tiếp theo...");
                await page.reload({ waitUntil: "domcontentloaded" });
            }
        }
        
        console.log(`[HOÀN TẤT] Đã đăng ký xong cho: ${person.name}`);

    } catch (error) {
        console.error(`[LỖI NGHIÊM TRỌNG] Tab của ${person.name} đã gặp sự cố:`, error.message);
        await page.screenshot({ path: `error_${person.name.replace(/\s/g, '_')}.png` });
    } finally {
        await page.close(); // Đóng tab sau khi hoàn tất hoặc gặp lỗi
    }
}

/**
 * Hàm chính điều khiển toàn bộ quá trình.
 */
(async () => {
    const people = await readData(path.join(__dirname, 'data.txt'));
    if (people.length === 0) {
        console.log("Không có dữ liệu nào để xử lý. Vui lòng kiểm tra file data.txt.");
        return;
    }

    console.log(`Đã đọc được thông tin của ${people.length} người. Bắt đầu quá trình tự động hóa...`);

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const registrationPromises = people.map(person => registerPerson(browser, person));
    
    await Promise.all(registrationPromises);

    console.log("\n=============================================");
    console.log("TOÀN BỘ QUÁ TRÌNH TỰ ĐỘNG ĐÃ HOÀN TẤT!");
    await browser.close();
})();