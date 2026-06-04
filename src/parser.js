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
                
                const rawData = [];
                
                // สแกนหาจาก "โครงสร้างข้อมูล" ในทุกๆ แถว แทนการอิงจากหัวคอลัมน์ (ตามที่คุณแนะนำ)
                for (let i = 0; i < json.length; i++) {
                    const row = json[i];
                    if (!row || row.length === 0) continue;
                    
                    let foundTracking = null;
                    let foundFee = null;
                    
                    for (let j = 0; j < row.length; j++) {
                        const cellVal = row[j];
                        if (cellVal === undefined || cellVal === null) continue;
                        
                        const cellStr = String(cellVal).replace(/\s+/g, '').toUpperCase();
                        
                        // 1. ตรวจจับเลข Tracking ด้วยโครงสร้าง (ตัวอักษร 2 + เลข 9 + TH)
                        if (/^[A-Z]{2}\d{9}TH$/.test(cellStr)) {
                            foundTracking = cellStr;
                        } 
                        // 2. ตรวจจับราคา (หาเซลล์ที่เป็นตัวเลขเพียวๆ)
                        else if (typeof cellVal === 'number') {
                            // เก็บตัวเลขแรกที่เจอ (หรือตัวเลขที่สมเหตุสมผลว่าเป็นราคา)
                            if (foundFee === null) foundFee = cellVal;
                        } 
                        else if (typeof cellVal === 'string') {
                            // ถ้าเป็น String ลองเช็คว่าเป็นตัวเลขเพียวๆ หรือไม่
                            const trimmed = cellVal.trim();
                            const parsed = parseFloat(trimmed);
                            if (!isNaN(parsed) && trimmed === parsed.toString()) {
                                if (foundFee === null) foundFee = parsed;
                            }
                        }
                    }
                    
                    // ถ้าระบุ Tracking ได้ ถือว่าเป็น 1 รายการ
                    if (foundTracking) {
                        // ถ้าหาตัวเลขเพียวๆ ไม่เจอ ลองพยายามสกัดตัวเลขจากเซลล์อื่นๆ (เผื่อติดตัวอักษรเช่น "29 บาท")
                        if (foundFee === null) {
                            for (let j = 0; j < row.length; j++) {
                                const cellVal = row[j];
                                const parsed = parseFloat(cellVal);
                                // หลีกเลี่ยงการดึงตัวเลขจาก ID ยาวๆ หรือเบอร์โทร
                                if (!isNaN(parsed) && String(parsed).length < 8) { 
                                    foundFee = parsed;
                                    break;
                                }
                            }
                        }

                        rawData.push({
                            tracking: foundTracking,
                            fee: foundFee || 0 // ถ้าหาไม่เจอจริงๆ ให้เป็น 0 ไว้ก่อน
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
export async function extractTextWithRegex(text) {
    const rawData = [];
    const trackingRegex = /([A-Za-z]{2})\s*(\d{4})\s*(\d{4})\s*(\d{1})\s*(TH)?/gi;
    let match;
    while ((match = trackingRegex.exec(text)) !== null) {
        let tracking = `${match[1]}${match[2]}${match[3]}${match[4]}${match[5]||'TH'}`.toUpperCase();
        rawData.push({
            tracking: tracking,
            fee: 40 
        });
    }
    return rawData;
}
