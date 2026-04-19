const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const bot = new TelegramBot(token, { polling: true });

// =====================
let numeros = {}; 
let tableroChatId = null;
let tableroMsgId = null;

let timers = {};
let startTimes = {};

let numerosSorteados = [];
let sorteoActivo = false;

// =====================
// FORMATO TIEMPO
function tiempoRestante(ms) {
    let s = Math.max(0, Math.floor(ms / 1000));
    let m = Math.floor(s / 60);
    let sec = s % 60;
    return `${m}:${sec.toString().padStart(2,"0")}`;
}

// =====================
// TABLERO
function generarTablero() {

    let kb = [];

    for (let i = 1; i <= 15; i++) {

        let txt = `🟢 ${i}`;

        if (numeros[i]) {

            let u = numeros[i].user.name;

            if (numeros[i].estado === "reservado") {
                let restante = 600000 - (Date.now() - startTimes[i]);
                txt = `⛔ ${i} ${u} ⏱ ${tiempoRestante(restante)}`;
            }

            if (numeros[i].estado === "pendiente") {
                txt = `⏳ ${i} ${u}`;
            }

            if (numeros[i].estado === "pagado") {
                txt = `✅ ${i} ${u}`;
            }
        }

        kb.push([{ text: txt, callback_data: `num_${i}` }]);
    }

    return kb;
}

function actualizarTablero() {
    if (!tableroChatId || !tableroMsgId) return;

    bot.editMessageReplyMarkup(
        { inline_keyboard: generarTablero() },
        { chat_id: tableroChatId, message_id: tableroMsgId }
    ).catch(()=>{});
}

// refresca cada 3s
setInterval(actualizarTablero, 3000);

// =====================
// TIMER 10 MIN
function iniciarTimer(num) {

    startTimes[num] = Date.now();

    timers[num] = setInterval(() => {

        if (!numeros[num] || numeros[num].estado !== "reservado") {
            clearInterval(timers[num]);
            return;
        }

        let restante = 600000 - (Date.now() - startTimes[num]);

        if (restante <= 0) {

            let user = numeros[num].user.name;

            delete numeros[num];
            clearInterval(timers[num]);

            actualizarTablero();

            bot.sendMessage(tableroChatId,
`⛔ ${num} LIBERADO

👤 ${user} no pagó en 10 minutos`);
        }

    }, 5000);
}

// =====================
// INICIAR
bot.onText(/\/bingo/, async (msg) => {

    tableroChatId = msg.chat.id;

    let sent = await bot.sendMessage(msg.chat.id,
`🎰 BINGO ACTIVO`, {
        reply_markup: { inline_keyboard: generarTablero() }
    });

    tableroMsgId = sent.message_id;
});

// =====================
// TOMAR NÚMERO
bot.on('callback_query', (q) => {

    let data = q.data;

    if (data.startsWith("num_")) {

        let num = parseInt(data.split("_")[1]);

        if (numeros[num]) return;

        numeros[num] = {
            user: {
                id: q.from.id,
                name: q.from.username || q.from.first_name
            },
            estado: "reservado"
        };

        iniciarTimer(num);
        actualizarTablero();

        bot.sendMessage(tableroChatId,
`🎯 ${numeros[num].user.name} tomó ${num}

💰 Debes pagar y enviar comprobante`);
    }

    // ADMIN
    if (q.from.id !== ADMIN_ID) return;

    if (data.startsWith("ok_")) {

        let num = parseInt(data.split("_")[1]);

        if (!numeros[num]) return;

        numeros[num].estado = "pagado";
        clearInterval(timers[num]);

        actualizarTablero();

        // iniciar sorteo si todo vendido
        if (Object.keys(numeros).length === 15 &&
            Object.values(numeros).every(n => n.estado === "pagado")) {

            bot.sendMessage(tableroChatId,
`🎉 TODO PAGADO

🎰 INICIANDO SORTEO`);

            setTimeout(iniciarSorteo, 3000);
        }
    }

    if (data.startsWith("no_")) {

        let num = parseInt(data.split("_")[1]);

        delete numeros[num];
        clearInterval(timers[num]);

        actualizarTablero();
    }
});

// =====================
// FOTO
bot.on('message', (msg) => {

    if (!msg.photo) return;

    let userId = msg.from.id;
    let fileId = msg.photo[msg.photo.length - 1].file_id;

    let nums = [];

    for (let n in numeros) {
        if (numeros[n].user.id === userId &&
            numeros[n].estado === "reservado") {
            nums.push(n);
        }
    }

    if (!nums.length) {
        bot.sendMessage(msg.chat.id, "❌ No tienes números activos");
        return;
    }

    nums.forEach(n => {
        numeros[n].estado = "pendiente";
        clearInterval(timers[n]);
    });

    actualizarTablero();

    bot.sendPhoto(tableroChatId, fileId, {
        caption: `📥 PAGO\n🔢 ${nums.join(", ")}`,
        reply_markup: {
            inline_keyboard: [
                [{ text: "✅ APROBAR", callback_data: `ok_${nums[0]}` }],
                [{ text: "❌ RECHAZAR", callback_data: `no_${nums[0]}` }]
            ]
        }
    });
});

// =====================
// SORTEO
const LINEAS = [
    [1,2,3,4,5],
    [6,7,8,9,10],
    [11,12,13,14,15]
];

function iniciarSorteo() {
    sorteoActivo = true;
    numerosSorteados = [];
    bot.sendMessage(tableroChatId, "🎰 SORTEO EN VIVO");
    setTimeout(sacarNumero, 2000);
}

function sacarNumero() {

    if (!sorteoActivo) return;

    let disponibles = [];

    for (let i = 1; i <= 15; i++) {
        if (!numerosSorteados.includes(i)) {
            disponibles.push(i);
        }
    }

    let num = disponibles[Math.floor(Math.random() * disponibles.length)];
    numerosSorteados.push(num);

    bot.sendMessage(tableroChatId,
`🎯 SALE: ${num}

📊 ${numerosSorteados.join(" - ")}`);

    verificarLinea(num);

    setTimeout(sacarNumero, 3000);
}

function verificarLinea(ultimo) {

    for (let linea of LINEAS) {

        if (linea.every(n => numerosSorteados.includes(n))) {

            sorteoActivo = false;

            let ganador = numeros[ultimo]?.user?.name || "Jugador";

            bot.sendMessage(tableroChatId,
`🏆 ¡BINGO!

🎯 ${linea.join(" - ")}
👤 ${ganador}`);

            setTimeout(() => {
                numeros = {};
                numerosSorteados = [];
                bot.sendMessage(tableroChatId, "🔄 NUEVA RONDA");
                actualizarTablero();
            }, 5000);

            return;
        }
    }
} 