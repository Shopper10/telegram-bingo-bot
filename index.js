const TelegramBot = require('node-telegram-bot-api');
const fs = require("fs");

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const bot = new TelegramBot(token, { polling: true });

// 📦 ARCHIVO PERSISTENTE
const DATA_FILE = "./data.json";

// =====================
// 🔄 ESTADO GLOBAL
// =====================
let numeros = {};
let tableroChatId = null;
let tableroMessageId = null;
let totalDinero = 0;

let timers = {};
let startTimes = {};
let alertados = {};
let juegoAnunciado = false;

// =====================
// 💾 GUARDAR / CARGAR
// =====================
function cargarDatos() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE));

            numeros = data.numeros || {};
            totalDinero = data.totalDinero || 0;

            console.log("📦 Datos cargados");
        }
    } catch (e) {
        console.log("Error cargando datos", e.message);
    }
}

function guardarDatos() {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
        numeros,
        totalDinero
    }));
}

// =====================
// 👤 USER
// =====================
function getUser(user) {
    return user.username ? `@${user.username}` : user.first_name;
}

// =====================
// ⏱️ TIEMPO
// =====================
function formatTiempo(ms) {
    let total = Math.max(0, Math.floor(ms / 1000));
    let min = Math.floor(total / 60);
    let sec = total % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

// =====================
// 🎰 TABLERO
// =====================
function generarTablero() {

    let keyboard = [];

    for (let i = 1; i <= 15; i++) {

        const item = numeros[i];
        let texto = `🟢 ${i} - DISPONIBLE`;

        if (item) {

            const u = item.user.name;

            if (item.estado === "reservado") {
                texto = `⛔️ ${i} - ${u}`;
            }

            if (item.estado === "pendiente") {
                texto = `⏱️ ${i} - ${u}`;
            }

            if (item.estado === "pagado") {
                texto = `✅ ${i} - ${u}`;
            }
        }

        keyboard.push([{
            text: texto,
            callback_data: `num_${i}`
        }]);
    }

    return keyboard;
}

// =====================
// 🔄 ACTUALIZAR TABLERO
// =====================
function actualizarTablero() {

    if (!tableroChatId || !tableroMessageId) return;

    bot.editMessageReplyMarkup(
        { inline_keyboard: generarTablero() },
        {
            chat_id: tableroChatId,
            message_id: tableroMessageId
        }
    ).catch(() => {});
}

// =====================
// 📢 REPOST TABLERO
// =====================
function reenviarTablero() {

    if (!tableroChatId) return;

    bot.sendMessage(tableroChatId,
`🎰 TABLERO ACTUALIZADO

💰 Total: $${totalDinero}`, {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    }).then(msg => {
        tableroMessageId = msg.message_id;
    });
}

// =====================
// 🧠 JUEGO COMPLETO
// =====================
function juegoCompleto() {

    for (let i = 1; i <= 15; i++) {
        if (!numeros[i] || numeros[i].estado !== "pagado") {
            return false;
        }
    }
    return true;
}

function verificarJuegoLleno() {

    if (juegoAnunciado) return;

    if (juegoCompleto()) {

        juegoAnunciado = true;

        bot.sendMessage(tableroChatId,
`🎉 TODOS LOS NÚMEROS VENDIDOS 🎉

🎰 INICIA EL BINGO`);
    }
}

// =====================
// 🔁 LOOP
// =====================
setInterval(actualizarTablero, 5000);

// =====================
// 🚀 INICIO
// =====================
cargarDatos();

bot.onText(/\/bingo/, async (msg) => {

    tableroChatId = msg.chat.id;

    const sent = await bot.sendMessage(msg.chat.id,
`🎰 BINGO ACTIVO

💰 Total: $${totalDinero}`, {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    });

    tableroMessageId = sent.message_id;
});

// =====================
// ⏱️ TIMER
// =====================
function iniciarTimer(num) {

    startTimes[num] = Date.now();

    timers[num] = setTimeout(() => {

        if (numeros[num] && numeros[num].estado === "reservado") {

            const user = numeros[num].user.name;

            delete numeros[num];

            actualizarTablero();
            guardarDatos();

            bot.sendMessage(tableroChatId,
`⛔️ TIEMPO AGOTADO

👤 ${user}
🔢 ${num}`);
        }

    }, 600000);
}

// =====================
// 🎯 CALLBACKS
// =====================
bot.on('callback_query', async (query) => {

    const data = query.data;
    const user = getUser(query.from);

    if (data.startsWith("num_")) {

        const num = parseInt(data.split("_")[1]);

        if (numeros[num]) return;

        numeros[num] = {
            user: {
                id: query.from.id,
                name: user
            },
            estado: "reservado"
        };

        iniciarTimer(num);

        actualizarTablero();
        guardarDatos();

        bot.sendMessage(tableroChatId,
`🎯 TOMADO

👤 ${user}
🔢 ${num}`);

        return;
    }

    if (query.from.id !== ADMIN_ID) return;

    const num = parseInt(data.split("_")[1]);

    if (!numeros[num]) return;

    // ❌ RECHAZAR
    if (data.startsWith("no_")) {

        delete numeros[num];

        actualizarTablero();
        guardarDatos();

        reenviarTablero();
        return;
    }

    // ✅ APROBAR
    if (data.startsWith("ok_")) {

        numeros[num].estado = "pagado";
        totalDinero += 3000;

        actualizarTablero();
        guardarDatos();

        bot.sendMessage(tableroChatId, "⏳ verificando...");

        setTimeout(() => {

            bot.sendMessage(tableroChatId,
`✅ PAGO OK

🔢 ${num}`);

            reenviarTablero();
            verificarJuegoLleno();

        }, 1200);
    }
});

// =====================
// 📸 FOTO MULTI
// =====================
bot.on('photo', (msg) => {

    const userId = msg.from.id;
    const fileId = msg.photo[msg.photo.length - 1].file_id;

    let nums = [];

    for (let n in numeros) {
        if (numeros[n].user.id === userId && numeros[n].estado === "reservado") {
            nums.push(n);
        }
    }

    if (!nums.length) return;

    nums.forEach(n => {
        numeros[n].estado = "pendiente";
        clearTimeout(timers[n]);
    });

    actualizarTablero();
    guardarDatos();

    bot.sendPhoto(tableroChatId, fileId, {
        caption:
`📥 PAGO

🔢 ${nums.join(", ")}
💰 $${nums.length * 3000}`
    });
});

// =====================
// 🔁 AUTO GUARDADO
// =====================
setInterval(() => {
    guardarDatos();
}, 10000);