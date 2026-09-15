const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Inisialisasi Socket.IO dengan CORS
const io = new Server(server, {
  cors: {
    origin: "*", // Mengizinkan akses dari domain/HP mana saja
    methods: ["GET", "POST"]
  }
});

// Database Sementara di Memori Server
let students = [];
let logs = [];
let blokEvaluations = {};
let teacherBonusPoints = {};

// ==========================================
// REST API ENDPOINTS
// ==========================================

// 1. Ambil Data Awal saat Frontend/HP Murid Baru Dibuka
app.get('/api/initial-data', (req, res) => {
  res.json({ students, logs, blokEvaluations, teacherBonusPoints });
});

// 2. Registrasi Akun Santri Mandiri
app.post('/api/auth/register', (req, res) => {
  const { name, phone, pass } = req.body;
  const existing = students.find(s => s.name.toLowerCase() === name.toLowerCase());
  
  if (existing) {
    return res.status(400).json({ message: 'Nama santri sudah terdaftar!' });
  }

  const newStudent = {
    id: Date.now().toString(),
    name,
    phone,
    pass,
    status: 'PENDING',
    createdAt: new Date().toISOString()
  };

  students.push(newStudent);
  
  // Broadcast ke Pengajar bahwa ada santri baru mendaftar
  io.emit('student_registered', newStudent);
  res.status(201).json({ message: 'Registrasi berhasil', student: newStudent });
});

// 3. Simpan / Edit Setoran Hafalan (Trigger Broadcast Realtime!)
app.post('/api/setoran', (req, res) => {
  const logData = req.body;
  const existingIndex = logs.findIndex(l => l.id === logData.id);

  if (existingIndex !== -1) {
    logs[existingIndex] = logData;
  } else {
    logs.unshift(logData);
  }

  // 🚀 SIARKAN KE SELURUH HP MURID & PENGAJAR SECARA INSTAN
  io.emit('update_setoran', { logData, logs });
  res.status(200).json({ message: 'Setoran berhasil diperbarui', logData });
});

// 4. Simpan Evaluasi Ujian Blok Hafalan
app.post('/api/evaluasi-blok', (req, res) => {
  const { userKey, evalData } = req.body;
  blokEvaluations[userKey] = evalData;
  
  // Broadcast update evaluasi blok
  io.emit('update_evaluasi_blok', { userKey, evalData, blokEvaluations });
  res.status(200).json({ message: 'Evaluasi blok berhasil disimpan' });
});

// 5. Tambah Poin Bonus / Apresiasi dari Pengajar
app.post('/api/bonus-points', (req, res) => {
  const { studentName, amount } = req.body;
  if (!teacherBonusPoints[studentName]) teacherBonusPoints[studentName] = 0;
  teacherBonusPoints[studentName] += amount;
  
  // Broadcast update papan skor/leaderboard
  io.emit('update_bonus_points', { studentName, total: teacherBonusPoints[studentName], teacherBonusPoints });
  res.status(200).json({ message: 'Bonus poin diperbarui' });
});

// 6. Verifikasi / Disetujui Akun Santri oleh Pengajar
app.post('/api/students/approve', (req, res) => {
  const { id } = req.body;
  students = students.map(s => s.id === id ? { ...s, status: 'APPROVED' } : s);
  
  io.emit('update_students', students);
  res.status(200).json({ message: 'Akun disetujui' });
});

// 7. Hapus Akun Santri
app.post('/api/students/delete', (req, res) => {
  const { id } = req.body;
  students = students.filter(s => s.id !== id);
  
  io.emit('update_students', students);
  res.status(200).json({ message: 'Akun dihapus' });
});

// ==========================================
// KONEKSI REALTIME WEBSOCKET (SOCKET.IO)
// ==========================================
io.on('connection', (socket) => {
  console.log('⚡ Perangkat (HP/Laptop) terhubung:', socket.id);

  socket.on('disconnect', () => {
    console.log('🔥 Koneksi terputus:', socket.id);
  });
});

// Jalankan Server di Port 5000 (Otomatis menyesuaikan port Cloud)
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server Taj Al-A'zham Realtime berjalan di port ${PORT}`);
});
