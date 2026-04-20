const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const token = process.env.TOKEN;

if (global.__RUN__) process.exit(0);
global.__RUN__ = true;

const bot = new TelegramBot(token, {
    polling: { autoStart: true, interval: 2000 }
});

console.log("🎰 CASINO TEXT CLEAN ONLINE");

// =====================
const DB_FILE = "./data.json";

let db = {
    numeros: {},
    total: 0
};

let chatId = null;
let messageId = null;
let bingoActive = false;

// =====================
function load() {
    if (fs.existsSync(DB_FILE)) {
        db = JSON.parse(fs.readFileSync(DB_FILE));
    }
}

function save() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

load();

// =====================
function user(u) {
    return u.username ? `@${u.username}` : u.first_name;
}

// =====================
// 🎰 TABLERO EN TEXTO (EXACTO COMO QUIERES)
function buildBoard() {

    let text = `🎰 CASINO BINGO\n\n`;

    for (let i = 1; i <= 15; i++) {

        const n = db.numeros[i];

        // 🟢 DISPONIBLE
        if (!n) {
            text += `🟢 ${i} - DISPONIBLE\n`;
            continue;
        }

        // ⛔ RESERVADO
        if (n.estado === "reservado") {
            text += `⛔️ ${n.name} ⏱️ 10min\n`;
            continue;
        }

        // ⏳ PENDIENTE
        if (n.estado === "pendiente") {
            text += `🔍 ${n.name} COMPROBANDO...\n`;
            continue;
        }

        // ✅ PAGADO
        if (n.estado === "pagado") {
            text += `✅ ${n.name} PAGADO\n`;
            continue;
        }
    }

    text += `\n💰 TOTAL: $${db.total}`;

    return text;
}

// =====================
function updateBoard() {

    if (!chatId || !messageId) return;

    bot.editMessageText(buildBoard(), {
        chat_id: chatId,
        message_id: messageId
    }).catch(()=>{});
}

// =====================
// 🔥 SOLD OUT CHECK
function checkSoldOut() {

    if (bingoActive) return;

    for (let i = 1; i <= 15; i++) {
        if (!db.numeros[i]) return;
    }

    bingoActive = true;

    bot.sendMessage(chatId,
`🎉🔥 TODOS LOS NÚMEROS VENDIDOS 🔥🎉

🚀 INICIANDO BINGO...`);

    setTimeout(startBingo, 3000);
}

// =====================
// 🎰 BINGO FINAL
function startBingo() {

    let nums = Array.from({ length: 15 }, (_, i) => i + 1);

    let winner = nums[Math.floor(Math.random() * nums.length)];
    let name = db.numeros[winner]?.name || "Sin registro";

    bot.sendMessage(chatId,
`🏆 BINGO FINAL 🏆

🎰 Número ganador: ${winner}
👤 ${name}

🎉 FELICIDADES!`);
}

// =====================
// 🚀 INICIAR TABLERO
bot.onText(/\/bingo/, async (msg) => {

    chatId = msg.chat.id;

    const sent = await bot.sendMessage(chatId, buildBoard());

    messageId = sent.message_id;
});

// =====================
// 🎯 COMPRA DE NÚMEROS (SIN BOTONES)
bot.on("message", (msg) => {

    if (!msg.text) return;

    // ejemplo simple: escribir "1", "2", etc
    let num = parseInt(msg.text);

    if (isNaN(num) || num < 1 || num > 15) return;

    if (db.numeros[num]) return;

    db.numeros[num] = {
        name: user(msg.from),
        estado: "reservado",
        time: Date.now()
    };

    db.total += 3000;

    save();
    updateBoard();

    bot.sendMessage(chatId,
`💰 NÚMERO RESERVADO
🎰 ${num}
👤 ${user(msg.from)}

📸 Envía comprobante`);
});

// =====================
// 📸 COMPROBANTE
bot.on("message", (msg) => {

    if (!msg.photo) return;

    let nums = [];

    for (let n in db.numeros) {

        if (db.numeros[n].name === user(msg.from)) {
            db.numeros[n].estado = "pendiente";
            nums.push(n);
        }
    }

    if (!nums.length) return;

    save();

    bot.sendMessage(chatId, "🔍 COMPROBANDO PAGOS...");

    setTimeout(() => {

        nums.forEach(n => {
            db.numeros[n].estado = "pagado";
        });

        save();
        updateBoard();
        checkSoldOut();

        bot.sendMessage(chatId, "✅ PAGOS APROBADOS");

    }, 3000);
});