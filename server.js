const express = require('express');
const mysql = require('mysql2');
const http = require('http');
const { Server } = require("socket.io");
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path'); // TAMBAHAN: Import library path

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(bodyParser.json());

// TAMBAHAN: Sajikan file statis (HTML/CSS) dari folder 'public'
app.use(express.static(path.join(__dirname, 'public')));



// --- 1. KONEKSI DATABASE ---
// Sesuaikan user dan password dengan settingan MySQL/XAMPP Anda
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',      
    password: '12345',      
    database: 'iot_banjir'
});

// --- 2. API UNTUK ESP32 (MENERIMA DATA) ---
app.post('/api/data', (req, res) => {
    const { kedalaman, kontak_air } = req.body;

    // Logika Penentuan Status (Backend Logic)
    let status = 'AMAN';
    
    // Jika sensor kontak kena air (1) ATAU jarak ultrasonik < 100cm
    if (kontak_air == 1 || kedalaman >= 300) {
        status = 'BAHAYA';
    } else if (kedalaman > 250) {
        status = 'WASPADA';
    }

    const query = 'INSERT INTO sensor_logs (kedalaman, sensor_kontak, status_alert) VALUES (?, ?, ?)';
    
    db.query(query, [kedalaman, kontak_air, status], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database Error');
        }

        // Kirim data real-time ke Web Frontend via Socket.io
        io.emit('sensor_update', {
            kedalaman: kedalaman,
            kontak: kontak_air,
            status: status,
            waktu: new Date().toLocaleTimeString()
        });

        console.log(`Data Masuk: kedalaman ${kedalaman}cm | Kontak: ${kontak_air} | Status: ${status}`);
        
        // Kirim balasan ke ESP32 (Bisa dipakai untuk trigger sirine balik jika mau logic terpusat)
        res.json({ message: "Data saved", command_siren: status === 'BAHAYA' });
    });
});

// --- 3. API UNTUK WEB (AMBIL DATA HISTORY) ---
app.get('/api/history', (req, res) => {
    db.query('SELECT * FROM sensor_logs ORDER BY waktu DESC LIMIT 20', (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

// Jalankan Server
server.listen(3000, () => {
    console.log('Server berjalan di port 3000');
    console.log('Pastikan ESP32 mengirim data ke: http://localhost:3000/api/data');
    console.log("halaman dashboard http://localhost:3000")
    console.log("halaman simulais esp http://localhost:3000/simulator.html")
});