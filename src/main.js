import './style.css';
import { parseExcel } from './parser.js';
import { summarizeData } from './summarizer.js';

let rawDataState = [];

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('drop-zone');
    const statusMsg = document.getElementById('upload-status');
    const dataSection = document.getElementById('data-section');
    const resultSection = document.getElementById('result-section');
    
    // File upload logic
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    async function handleFile(file) {
        statusMsg.classList.remove('hidden');
        statusMsg.textContent = `กำลังอ่านไฟล์ ${file.name}...`;

        try {
            if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                rawDataState = await parseExcel(file);
                renderRawTable();
                statusMsg.textContent = `อ่านข้อมูลสำเร็จ! พบ ${rawDataState.length} รายการ`;
                dataSection.classList.remove('hidden');
                resultSection.classList.add('hidden');
            } else {
                // สำหรับ PDF, PNG, JPG แนะนำให้ใช้ OCR หรือแจ้งเตือนไปก่อน
                statusMsg.textContent = `ระบบกำลังพัฒนาการอ่านรูปภาพ/PDF (กรุณาใช้ Excel ก่อนในเวอร์ชันทดสอบ)`;
                
                // Mock ข้อมูล 30 รายการตามโจทย์
                setTimeout(() => {
                    loadMockData();
                    statusMsg.textContent = `จำลองข้อมูล 30 รายการตามตัวอย่าง...`;
                }, 1000);
            }
        } catch (err) {
            statusMsg.textContent = `เกิดข้อผิดพลาด: ${err.message}`;
        }
    }

    function renderRawTable() {
        const tbody = document.getElementById('raw-tbody');
        tbody.innerHTML = '';
        
        rawDataState.forEach((item, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td><input type="text" value="${item.tracking}" onchange="updateData(${idx}, 'tracking', this.value)"></td>
                <td class="col-fee"><input type="number" value="${item.fee}" onchange="updateData(${idx}, 'fee', this.value)"></td>
                <td><button class="btn-del" onclick="deleteRow(${idx})">×</button></td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.updateData = (idx, field, value) => {
        if (field === 'fee') {
            rawDataState[idx][field] = parseFloat(value) || 0;
        } else {
            rawDataState[idx][field] = value.replace(/\s+/g, '').toUpperCase();
        }
    };

    window.deleteRow = (idx) => {
        rawDataState.splice(idx, 1);
        renderRawTable();
    };

    document.getElementById('btn-add-row').addEventListener('click', () => {
        rawDataState.push({ tracking: '', fee: 0 });
        renderRawTable();
    });

    document.getElementById('btn-summarize').addEventListener('click', () => {
        if (rawDataState.length === 0) return;
        
        const summary = summarizeData(rawDataState);
        
        const contentDiv = document.getElementById('summary-content');
        contentDiv.innerHTML = '';
        
        let plainTextArr = [];

        summary.lines.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'summary-item';
            
            let trackingHtml = `<div class="summary-tracking-start">${item.startStr}</div>`;
            if (item.endStr) {
                trackingHtml += `<div class="summary-tracking-end">ถึง ${item.endStr}</div>`;
            }

            row.innerHTML = `
                <div class="summary-tracking-container">
                    ${trackingHtml}
                </div>
                <div class="summary-details">
                    <span class="badge">จำนวน ${item.consumeCount} ชิ้น</span>
                    <span class="badge fee-badge">@ ${item.fee} บาท</span>
                    <span class="amount">เป็นเงิน <strong>${item.amount.toLocaleString()}</strong> บาท</span>
                </div>
            `;
            contentDiv.appendChild(row);
            
            let plainTextTracking = item.endStr ? `${item.startStr} ถึง ${item.endStr}` : item.startStr;
            plainTextArr.push(`${plainTextTracking}\nจำนวน ${item.consumeCount} ชิ้น*${item.fee} บาท เป็นเงิน ${item.amount.toLocaleString()} บาท`);
        });
        
        contentDiv.dataset.plainText = plainTextArr.join('\n');
        
        document.getElementById('total-items').textContent = `${summary.totalItems} ชิ้น`;
        document.getElementById('total-price').textContent = `${summary.totalPrice.toLocaleString()} บาท`;
        
        resultSection.classList.remove('hidden');
        
        // Scroll to result
        resultSection.scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('btn-copy').addEventListener('click', () => {
        const text = document.getElementById('summary-content').dataset.plainText;
        navigator.clipboard.writeText(text).then(() => {
            alert('คัดลอกสำเร็จแล้ว!');
        });
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        rawDataState = [];
        dataSection.classList.add('hidden');
        resultSection.classList.add('hidden');
        statusMsg.classList.add('hidden');
        fileInput.value = '';
    });

    // Mock data for user's example
    function loadMockData() {
        rawDataState = [];
        // EQ Group (19 items)
        let eqBase = 687878780;
        for(let i=0; i<15; i++) rawDataState.push({tracking: `EQ${eqBase+i}TH`, fee: 40});
        for(let i=15; i<19; i++) rawDataState.push({tracking: `EQ${eqBase+i}TH`, fee: 35});
        
        // EW Group (2 items)
        let ewBase = 787878782;
        for(let i=0; i<2; i++) rawDataState.push({tracking: `EW${ewBase+i}TH`, fee: 35});

        // EJ Group (9 items)
        let ejBase = 444545458;
        for(let i=0; i<8; i++) rawDataState.push({tracking: `EJ${ejBase+i}TH`, fee: 45});
        for(let i=8; i<9; i++) rawDataState.push({tracking: `EJ${ejBase+i}TH`, fee: 70});

        // Randomize the fees a bit in the array to prove the zipper algorithm works
        // The algorithm groups tracking, and separately groups fees.
        // Actually, the user says "มีข้อมูลมา แล้วจัดหมวด" so rawData already has tracking and fees paired, but the summarize algorithm groups tracking ranges and applies fee buckets.
        
        renderRawTable();
        dataSection.classList.remove('hidden');
    }
});
