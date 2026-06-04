import * as XLSX from 'xlsx';

export async function parseExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                // ค้นหาคอลัมน์ Tracking และ ค่าบริการ
                let trackingColIdx = -1;
                let feeColIdx = -1;
                let headerRowIdx = -1;

                // ค้นหาแถวที่เป็น Header ก่อน
                for (let i = 0; i < Math.min(json.length, 10); i++) {
                    const row = json[i];
                    for (let j = 0; j < row.length; j++) {
                        const cell = String(row[j] || '').toLowerCase();
                        if (cell.includes('เลขที่ลงทะเบียน') || cell.includes('tracking') || cell.includes('เลขพัสดุ')) {
                            trackingColIdx = j;
                            headerRowIdx = i;
                        }
                        if (cell.includes('ค่าบริการ') || cell.includes('price') || cell.includes('ค่าส่ง')) {
                            feeColIdx = j;
                        }
                    }
                    if (trackingColIdx !== -1 && feeColIdx !== -1) break;
                }

                // ถ้าไม่เจอ Header ที่ชัดเจน ลองเดา (สมมติว่าคอลัมน์ 2 เป็น Tracking คอลัมน์สุดท้ายเป็นค่าบริการ)
                if (trackingColIdx === -1) trackingColIdx = 1;
                if (feeColIdx === -1) feeColIdx = 4; // กะคร่าวๆ
                
                const rawData = [];
                for (let i = headerRowIdx + 1; i < json.length; i++) {
                    const row = json[i];
                    if (!row || row.length === 0) continue;
                    
                    const tracking = String(row[trackingColIdx] || '').replace(/\s+/g, '').toUpperCase();
                    const fee = parseFloat(row[feeColIdx]);

                    // ตรวจสอบว่าเป็น Tracking ถูกต้องไหม (อย่างน้อยมีตัวอักษรและตัวเลข)
                    if (tracking && tracking.length >= 10 && !isNaN(fee)) {
                        rawData.push({
                            tracking: tracking,
                            fee: fee
                        });
                    }
                }
                
                resolve(rawData);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
}

// สำหรับรูปภาพและ PDF การดึงข้อมูลจริงอาจต้องใช้ Tesseract.js และ PDF.js
// แต่ในเวอร์ชันต้นแบบ จะมีการใช้ RegExp สกัดจากข้อความจำลอง
export async function extractTextWithRegex(text) {
    const rawData = [];
    // แพทเทิร์นค้นหาเลข Tracking เช่น EQ 6878 7878 0 TH หรือ EQ687878780TH
    const trackingRegex = /([A-Za-z]{2})\s*(\d{4})\s*(\d{4})\s*(\d{1})\s*(TH)?/gi;
    let match;
    let index = 1;
    while ((match = trackingRegex.exec(text)) !== null) {
        let tracking = `${match[1]}${match[2]}${match[3]}${match[4]}${match[5]||'TH'}`.toUpperCase();
        // หาตัวเลขใกล้เคียงที่เป็นค่าบริการ (การทำจริงจะยากกว่านี้ ต้องผูกกับตาราง)
        rawData.push({
            tracking: tracking,
            fee: 40 // ค่าเริ่มต้นจำลอง
        });
        index++;
    }
    return rawData;
}
