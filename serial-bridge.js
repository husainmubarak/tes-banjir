const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const axios = require('axios');

// =======================================================
// === ⚠️ KONFIGURASI WAJIB DIGANTI ⚠️ ===================
// =======================================================

// 1. Ganti dengan nama port komunikasi Arduino Anda
// Contoh Windows: 'COM3'
// Contoh macOS/Linux: '/dev/ttyACM0' atau '/dev/ttyUSB0'
const SERIAL_PORT_PATH = 'COM3'; 

// 2. Sesuaikan dengan baud rate di kode Arduino (standar: 9600)
const BAUD_RATE = 9600;

// 3. Ganti dengan URL server backend Anda yang siap menerima data POST
const BACKEND_URL = 'http://localhost:3000/api/data';

// =======================================================
// === INSIALISASI PORT SERIAL ===========================
// =======================================================

// Membuat instance SerialPort
const port = new SerialPort({ 
    path: SERIAL_PORT_PATH, 
    baudRate: BAUD_RATE 
}, (err) => {
    if (err) {
        console.error(`Error saat membuka port serial ${SERIAL_PORT_PATH}: ${err.message}`);
        console.log("Pastikan Arduino terhubung, driver terinstal, dan port komunikasi sudah benar.");
        process.exit(1); // Keluar jika ada error
    }
});

// Menggunakan parser Readline untuk membaca data per baris
const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

console.log(`✅ Serial Bridge Node.js berjalan. Mendengarkan ${SERIAL_PORT_PATH} pada ${BAUD_RATE} baud.`);
console.log(`📤 Data akan dikirim ke: ${BACKEND_URL}`);

// =======================================================
// === FUNGSI UTAMA (Serial ke HTTP) =====================
// =======================================================

parser.on('data', async (data) => {
    // Membersihkan data dari spasi atau karakter newline tambahan
    const cleanedData = data.trim(); 
    
    // Asumsi Arduino HANYA mengirim nilai angka (distanceCm)
    const distanceCm = parseInt(cleanedData);

    // Pastikan data yang diterima adalah angka yang valid
    if (isNaN(distanceCm)) {
        console.log(`[SERIAL] Data tidak valid (bukan angka): ${cleanedData}`);
        return;
    }

    console.log(`[SERIAL] Jarak diterima: ${distanceCm} cm`);

    // Objek data yang akan dikirim ke server
    const payload = {
        jarak: distanceCm
    };

    try {
        // Mengirim data ke server backend menggunakan HTTP POST
        const response = await axios.post(BACKEND_URL, payload);
        
        console.log(`[HTTP] Berhasil kirim data. Status: ${response.status} (${response.statusText})`);
    
    } catch (error) {
        // Tangani jika terjadi error saat koneksi HTTP (misalnya server mati atau URL salah)
        console.error(`[HTTP] ❌ Gagal mengirim data ke server.`);
        
        // Jika error adalah error response dari server
        if (error.response) {
            console.error(`Status Server: ${error.response.status}, Pesan: ${error.response.data}`);
        } else if (error.request) {
            // Jika tidak ada respons (timeout atau koneksi terputus)
            console.error("Tidak ada respons dari server (Timeout/Koneksi Gagal).");
        } else {
            console.error(`Error lainnya: ${error.message}`);
        }
    }
});

// Menangani error pada port serial
port.on('error', (err) => {
    console.error(`\n[FATAL ERROR PORT]: ${err.message}`);
});