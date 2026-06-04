// summarizer.js

function formatTracking(tracking) {
    if (tracking.length === 13) {
        return `${tracking.substring(0,2)} ${tracking.substring(2,6)} ${tracking.substring(6,10)} ${tracking.substring(10,11)} ${tracking.substring(11,13)}`;
    }
    return tracking;
}

function splitTracking(tracking) {
    // แยก 8 หลักที่เป็น sequence และ 1 หลักที่เป็น check digit
    const match = tracking.match(/^([A-Z]{2})(\d{8})(\d)(TH)?$/i);
    if (!match) return null;
    return {
        prefix: match[1].toUpperCase(),
        seq: parseInt(match[2], 10),
        checkDigit: match[3],
        suffix: match[4] ? match[4].toUpperCase() : 'TH'
    };
}

function groupTracking(items) {
    const groups = [];
    if (items.length === 0) return groups;

    let currentGroup = [items[0]];

    for (let i = 1; i < items.length; i++) {
        const prev = splitTracking(items[i-1].tracking);
        const curr = splitTracking(items[i].tracking);

        // จัดกลุ่มถ้า Prefix เดียวกัน และเลข 8 หลัก (Sequence) เรียงต่อกัน
        if (prev && curr && prev.prefix === curr.prefix && curr.seq === prev.seq + 1) {
            currentGroup.push(items[i]);
        } else {
            groups.push(currentGroup);
            currentGroup = [items[i]];
        }
    }
    groups.push(currentGroup);
    return groups;
}

function isArService(prefix, fee) {
    // สมมติว่า เรทตอบรับ EMS = 52, 67, ... (ตัวอย่าง) หรืออิงจาก prefix
    // ในที่นี้ สมมติถ้า fee เฉพาะของบริการ AR
    if ((prefix.startsWith('E') || prefix.startsWith('R')) && (fee === 52 || fee === 60)) {
        return true;
    }
    return false;
}

export function summarizeData(rawData) {
    const priceCounts = {};
    rawData.forEach(item => {
        const f = parseFloat(item.fee) || 0;
        priceCounts[f] = (priceCounts[f] || 0) + 1;
    });

    const priceBuckets = Object.keys(priceCounts)
        .map(p => ({ fee: parseFloat(p), count: priceCounts[p] }))
        .sort((a, b) => b.count - a.count);

    const trackingGroups = groupTracking(rawData);

    const resultLines = [];
    let totalItemsFinal = 0;
    let totalPriceFinal = 0;

    for (const group of trackingGroups) {
        if (group.length === 0) continue;
        
        let trackingIndex = 0;

        while (trackingIndex < group.length && priceBuckets.length > 0) {
            let currentBucket = priceBuckets[0];
            let remainingInGroup = group.length - trackingIndex;
            
            let prefix = group[trackingIndex].tracking.substring(0, 2);
            let isAR = isArService(prefix, currentBucket.fee);
            
            // ถ้าเป็น AR 1 ชิ้นใช้ 2 เลข
            let multiplier = isAR ? 2 : 1;
            let maxItemsCanFulfill = Math.floor(remainingInGroup / multiplier);
            
            let consumeCount = Math.min(maxItemsCanFulfill, currentBucket.count);
            
            if (consumeCount === 0) {
                // กลุ่ม Tracking นี้เหลือเลขไม่พอจะจับคู่แม้แต่ 1 ชิ้น (เช่นเหลือ 1 เลข แต่บริการเป็น AR ต้องการ 2)
                break; 
            }

            let trackingSlotsConsumed = consumeCount * multiplier;
            
            let startItem = group[trackingIndex];
            let endItem = group[trackingIndex + trackingSlotsConsumed - 1];
            
            let startStr = formatTracking(startItem.tracking);
            let endStr = formatTracking(endItem.tracking);
            
            resultLines.push({
                startStr: startStr,
                endStr: consumeCount === 1 ? null : endStr,
                consumeCount: consumeCount,
                fee: currentBucket.fee,
                amount: consumeCount * currentBucket.fee
            });

            totalItemsFinal += consumeCount;
            totalPriceFinal += (consumeCount * currentBucket.fee);

            currentBucket.count -= consumeCount;
            trackingIndex += trackingSlotsConsumed;

            if (currentBucket.count === 0) {
                priceBuckets.shift();
            }
        }
    }

    return {
        lines: resultLines,
        totalItems: totalItemsFinal,
        totalPrice: totalPriceFinal
    };
}
