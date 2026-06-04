// summarizer.js

// ฟังก์ชันดึง Prefix และ Number
function splitTracking(tracking) {
    const match = tracking.match(/^([A-Z]{2})(\d{9})(TH)?$/i);
    if (!match) return null;
    return {
        prefix: match[1].toUpperCase(),
        numStr: match[2],
        num: parseInt(match[2], 10),
        suffix: match[3] ? match[3].toUpperCase() : 'TH'
    };
}

// ฟังก์ชันจัดกลุ่มเลขที่เรียงกัน
function groupTracking(items) {
    const groups = [];
    if (items.length === 0) return groups;

    let currentGroup = [items[0]];

    for (let i = 1; i < items.length; i++) {
        const prev = splitTracking(items[i-1].tracking);
        const curr = splitTracking(items[i].tracking);

        if (prev && curr && prev.prefix === curr.prefix && curr.num === prev.num + 1) {
            currentGroup.push(items[i]);
        } else {
            groups.push(currentGroup);
            currentGroup = [items[i]];
        }
    }
    groups.push(currentGroup);
    return groups;
}

// AR Logic checker
// ตรวจสอบว่าบริการนี้ใช้ AR Track หรือไม่
function isArService(prefix, fee) {
    // เรทราคาตอบรับมักจะมีลักษณะเฉพาะ เช่น EMS ตอบรับ, ลทบ ตอบรับ
    // สมมติว่า เรทตอบรับ EMS = 52, 67, ... (ตัวอย่าง)
    // ตรงนี้สามารถเชื่อมกับฐานข้อมูลจริงจาก TPB ได้
    // ในที่นี้ ถ้าเป็นบริการตอบรับ เรามักจะเจอราคาเฉพาะ เช่น 52, 67, หรือมีคีย์ AR
    // แต่เพื่อความยืดหยุ่นในเดโม จะอนุญาตให้ผู้ใช้กำหนด Flag หรือเช็คจากตรรกะง่ายๆ
    
    // ตัวอย่างเงื่อนไข: หากขึ้นต้นด้วย E หรือ R และราคาเป็นราคารวม AR (อันนี้ต้องปรับตามจริง)
    // ในบริบทนี้ สมมติถ้า fee == 52 (อิงจากโจทย์) ถือว่าเป็น AR
    // จริงๆ ควรดึงจาก DB
    if ((prefix === 'E' || prefix === 'R') && (fee === 52 || fee === 60)) {
        return true;
    }
    return false;
}

export function summarizeData(rawData) {
    // 1. นำข้อมูลดิบมาแยกเป็น Tracking Blocks
    // เนื่องจากโจทย์บอกว่าข้อมูล Tracking อาจจะเรียงอยู่แล้ว ให้จัดกลุ่มเลย
    // rawData ควรเป็น Array ของ Object: { tracking: "EQ687878780TH", fee: 40, isAr: false }
    
    // สร้างถังราคา (Price Buckets) เรียงลำดับตามความสวยงาม (น้อยไปมาก หรือมากไปน้อย)
    // สำหรับเดโม เรียงตามจำนวนชิ้นเยอะสุดไปน้อยสุดก่อน
    const priceCounts = {};
    rawData.forEach(item => {
        const f = parseFloat(item.fee) || 0;
        priceCounts[f] = (priceCounts[f] || 0) + 1;
    });

    const priceBuckets = Object.keys(priceCounts)
        .map(p => ({ fee: parseFloat(p), count: priceCounts[p] }))
        .sort((a, b) => b.count - a.count); // จัดเรียงตามจำนวนเยอะสุดไปน้อยสุด

    // จัดกลุ่ม Tracking ที่มีอยู่
    const trackingGroups = groupTracking(rawData);

    const resultLines = [];
    let totalItemsFinal = 0;
    let totalPriceFinal = 0;

    // The Zipper Algorithm (เทน้ำใส่แก้ว)
    for (const group of trackingGroups) {
        if (group.length === 0) continue;
        
        const firstTrackingParts = splitTracking(group[0].tracking);
        if (!firstTrackingParts) continue; // ข้ามถ้า format ผิด

        let groupRemaining = group.length;
        let trackingStartNum = firstTrackingParts.num;

        while (groupRemaining > 0 && priceBuckets.length > 0) {
            // เอาถังราคาที่อยู่บนสุดมาใช้
            let currentBucket = priceBuckets[0];
            
            // ใช้จำนวนเท่าที่ถังราคาเหลือ หรือเท่าที่กลุ่ม Tracking ขาด
            let consumeCount = Math.min(groupRemaining, currentBucket.count);

            // คำนวณเลข Tracking ปลายทาง
            let isAR = isArService(firstTrackingParts.prefix[0], currentBucket.fee);
            let trackingSlotsConsumed = isAR ? consumeCount * 2 : consumeCount;

            let endNum = trackingStartNum + trackingSlotsConsumed - 1;
            
            // Format Tracking
            let startStr = `${firstTrackingParts.prefix} ${String(trackingStartNum).padStart(9, '0').replace(/(\d{4})(\d{4})(\d{1})/, '$1 $2 $3')} TH`;
            let endStr = `${firstTrackingParts.prefix} ${String(endNum).padStart(9, '0').replace(/(\d{4})(\d{4})(\d{1})/, '$1 $2 $3')} TH`;
            
            let displayStr = consumeCount === 1 ? startStr : `${startStr} ถึง ${endStr}`;
            
            resultLines.push(`${displayStr.padEnd(45, ' ')} จำนวน ${consumeCount} ชิ้น*${currentBucket.fee} บาท เป็นเงิน ${(consumeCount * currentBucket.fee).toLocaleString()} บาท`);

            // อัปเดตยอดรวม
            totalItemsFinal += consumeCount;
            totalPriceFinal += (consumeCount * currentBucket.fee);

            // หักลบจากถัง
            currentBucket.count -= consumeCount;
            groupRemaining -= trackingSlotsConsumed; // ในโจทย์ปกติคือ 1:1 แต่ถ้า AR คือใช้ 2 เลขจากลิสต์
            trackingStartNum = endNum + 1;

            if (currentBucket.count === 0) {
                priceBuckets.shift(); // ถังว่างแล้ว ทิ้งไป
            }
        }
    }

    return {
        lines: resultLines,
        totalItems: totalItemsFinal,
        totalPrice: totalPriceFinal
    };
}
