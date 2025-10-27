const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// Hàm đọc và phân tích dữ liệu từ file data.txt
async function readData(filePath) {
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
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

// Hàm thực hiện đăng ký cho một người trên một tab
async function registerPerson(browser, person) {
    console.log(`\n[BẮT ĐẦU] Mở tab mới cho: ${person.name}`);
    const page = await browser.newPage();

    try {
        // 1. Điều hướng đến trang đếm ngược (index.html)
        const indexPath = path.resolve(__dirname, 'index.html');
        await page.goto(`file://${indexPath}`);
        console.log(` -> Đang ở trang đếm ngược cho ${person.name}...`);

        // 2. Chờ trang tự động chuyển đến form.html
        await page.waitForNavigation({ timeout: 35000 }); // Chờ tối đa 35 giây
        console.log(` -> Đã chuyển đến trang form.html cho ${person.name}.`);

        // 3. Lấy tất cả các ngày có thể đăng ký
        const dateOptions = await page.$$eval('#slNgayBanHang option', options => 
            options.map(option => option.value).filter(value => value) // Lọc bỏ giá trị rỗng
        );

        if (dateOptions.length === 0) {
            console.log(` -> Không tìm thấy ngày nào để đăng ký cho ${person.name}.`);
            return;
        }

        console.log(` -> Tìm thấy ${dateOptions.length} ngày. Bắt đầu đăng ký...`);

        // 4. Lặp qua từng ngày và thực hiện đăng ký
        for (const dateValue of dateOptions) {
            const dateText = await page.$eval(`#slNgayBanHang option[value="${dateValue}"]`, el => el.textContent);
            
            // Điền thông tin cá nhân
            await page.type('#txtHoTen', person.name);
            await page.type('#txtNgaySinh_Ngay', person.day);
            await page.type('#txtNgaySinh_Thang', person.month);
            await page.type('#txtNgaySinh_Nam', person.year);
            await page.type('#txtSoDienThoai', person.phone);
            await page.type('#txtEmail', person.email);
            await page.type('#txtCCCD', person.id);

            // Chọn ngày và phiên
            await page.select('#slNgayBanHang', dateValue);
            await page.waitForTimeout(200); // Chờ để phiên được tải
            await page.select('#slPhien', '1'); // Mặc định chọn phiên sáng
            
            // "Giải" Captcha giả lập
            const captchaCode = await page.$eval('#dvCaptcha', el => el.textContent);
            await page.type('#txtCaptcha', captchaCode);
            
            // Tick đồng ý và gửi form
            await page.click('#ckbDongY');
            await page.click('#btDangKyThamGia');

            // Chờ kết quả đăng ký (chờ div kết quả xuất hiện)
            await page.waitForSelector('#dvTaoMaQR', { visible: true });
            
            console.log(`   ✔️  Đã đăng ký thành công cho ngày ${dateText}`);
            
            // Reset lại form để đăng ký ngày tiếp theo (bằng cách tải lại trang)
            await page.reload({ waitUntil: ["networkidle0", "domcontentloaded"] });
        }
        
        console.log(`[HOÀN TẤT] Đã đăng ký xong cho: ${person.name}`);

    } catch (error) {
        console.error(`[LỖI] Đã có lỗi xảy ra với tab của ${person.name}:`, error.message);
    } finally {
        // Bạn có thể thêm page.close() ở đây nếu muốn tab tự đóng sau khi xong
        // await page.close();
    }
}

// Hàm chính điều khiển toàn bộ quá trình
(async () => {
    const people = await readData('data.txt');
    if (people.length === 0) {
        console.log("Không có dữ liệu nào để xử lý. Vui lòng kiểm tra file data.txt.");
        return;
    }

    console.log(`Đã đọc được thông tin của ${people.length} người. Bắt đầu quá trình tự động hóa...`);

    const browser = await puppeteer.launch({
        headless: false, // Chạy ở chế độ có giao diện để bạn có thể xem
        defaultViewport: null,
        args: ['--start-maximized']
    });

    // Tạo các tác vụ đăng ký song song cho mỗi người
    const registrationPromises = people.map(person => registerPerson(browser, person));
    
    // Chờ tất cả các tab hoàn thành công việc
    await Promise.all(registrationPromises);

    console.log("\n=============================================");
    console.log("TOÀN BỘ QUÁ TRÌNH TỰ ĐỘNG ĐÃ HOÀN TẤT!");
    // browser.close(); // Bỏ comment dòng này nếu muốn trình duyệt tự đóng khi xong
})();