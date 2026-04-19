const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const bot = new TelegramBot(token, { polling: true });

// 📦 DATA
let numeros = {};
let tableroChatId = null;
let tableroMessageId = null;
let totalDinero = 0;

// ⏱️ control
let timers = {};
let startTimes = {};
let alertados = {};

// 👤 USER
function getUser(user) {
    return user.username ? `@${user.username}` : user.first_name;
}

// ⏱️ FORMATO TIEMPO
function formatTiempo(ms) {
    let total = Math.max(0, Math.floor(ms / 1000));
    let min = Math.floor(total / 60);
    let sec = total % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

// 🎰 TABLERO
function generarTablero() {
    let keyboard = [];

    for (let i = 1; i <= 15; i++) {

        const item = numeros[i];
        let texto = `🟢 ${i} - DISPONIBLE`;

        if (item) {

            const u = item.user.name;

            if (item.estado === "reservado") {

                let tiempo = "";

                if (startTimes[i]) {
                    let restante = 300000 - (Date.now() - startTimes[i]);
                    tiempo = ` ${formatTiempo(restante)}`;

                    // ⚠️ alerta 30s
                    if (restante <= 30000 && !alertados[i]) {
                        alertados[i] = true;

                        bot.sendMessage(tableroChatId,
`⚠️ ÚLTIMOS 30 SEGUNDOS

👤 ${u}
🔢 ${i}

⏳ Si no paga se libera`);
                    }
                }

                texto = `⛔️ ${i} - ${u}${tiempo}`;
            }

            if (item.estado === "pendiente") {
                texto = `⏱️ ${i} - ${u} PENDIENTE`;
            }

            if (item.estado === "pagado") {
                texto = `✅ ${i} - ${u} PAGADO`;
            }
        }

        keyboard.push([{
            text: texto,
            callback_data: `num_${i}`
        }]);
    }

    return keyboard;
}

// 🔄 ACTUALIZAR TABLERO
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

// 🔁 REFRESH
setInterval(() => {
    actualizarTablero();
}, 5000);

// 🎰 CREAR TABLERO
bot.onText(/\/bingo/, async (msg) => {

    tableroChatId = msg.chat.id;

    const sent = await bot.sendMessage(msg.chat.id,
`🎰 CASINO BINGO EN VIVO

💰 Total: $${totalDinero}`, {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    });

    tableroMessageId = sent.message_id;
});

// ⏱️ TIMER 5 MIN
function iniciarTimer(num) {

    startTimes[num] = Date.now();
    alertados[num] = false;

    timers[num] = setTimeout(() => {

        if (numeros[num] && numeros[num].estado === "reservado") {

            const user = numeros[num].user.name;

            delete numeros[num];
            delete timers[num];
            delete startTimes[num];
            delete alertados[num];

            actualizarTablero();

            bot.sendMessage(tableroChatId,
`⛔️ TIEMPO AGOTADO

👤 ${user}
🔢 ${num}

🟢 Disponible nuevamente`);
        }

    }, 300000);
}

// 🎯 TOMAR NÚMERO
bot.on('callback_query', (query) => {

    const num = parseInt(query.data.split("_")[1]);
    const user = getUser(query.from);

    if (numeros[num]) {
        bot.answerCallbackQuery(query.id, { text: "❌ Ocupado" });
        return;
    }

    numeros[num] = {
        user: {
            id: query.from.id,
            name: user
        },
        estado: "reservado"
    };

    iniciarTimer(num);

    actualizarTablero();

    bot.sendMessage(tableroChatId,
`🎯 NÚMERO RESERVADO

👤 ${user}
🔢 ${num}

⏱️ Tienes 5 minutos
💰 $3.000 NEQUI
📸 Envía captura`);
});

// 📸 FOTO
bot.on('photo', (msg) => {

    if (msg.chat.type === "private") return;

    const userId = msg.from.id;
    const fileId = msg.photo[msg.photo.length - 1].file_id;

    let numero = null;

    for (let n in numeros) {
        if (
            numeros[n].user.id === userId &&
            numeros[n].estado === "reservado"
        ) {
            numero = n;
            break;
        }
    }

    if (!numero) {
        bot.sendMessage(msg.chat.id, `❌ No tienes números reservados`);
        return;
    }

    clearTimeout(timers[numero]);
    delete timers[numero];
    delete startTimes[numero];
    delete alertados[numero];

    numeros[numero].estado = "pendiente";

    actualizarTablero();

    bot.sendPhoto(tableroChatId, fileId, {
        caption: `📥 VERIFICAR PAGO

👤 ${numeros[numero].user.name}
🔢 ${numero}`,
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "✅ APROBAR", callback_data: `ok_${numero}` },
                    { text: "❌ RECHAZAR", callback_data: `no_${numero}` }
                ]
            ]
        }
    });
});

// 🔥 ADMIN (CON SLOT + REPOST)
bot.on('callback_query', async (query) => {

    const data = query.data;
    const userId = query.from.id;

    if (userId !== ADMIN_ID) {
        bot.answerCallbackQuery(query.id, { text: "⛔ No autorizado" });
        return;
    }

    const num = parseInt(data.split("_")[1]);
    if (!numeros[num]) return;

    const user = numeros[num].user.name;

    // ❌ RECHAZAR
    if (data.startsWith("no_")) {

        delete numeros[num];

        actualizarTablero();

        bot.sendMessage(tableroChatId,
`❌ PAGO RECHAZADO

🔢 ${num}
👤 ${user}`);
    }

    // ✅ APROBAR (CON ANIMACIÓN)
    if (data.startsWith("ok_")) {

        const anim = await bot.sendMessage(tableroChatId,
`🎰 GIRANDO RUEDA...`);

        const slots = ["🎰", "🎲", "🎯", "💰", "🎉"];

        for (let i = 0; i < slots.length; i++) {
            setTimeout(() => {
                bot.editMessageText(
`${slots[i]} Verificando pago...`, {
                    chat_id: tableroChatId,
                    message_id: anim.message_id
                });
            }, i * 600);
        }

        setTimeout(() => {

            numeros[num].estado = "pagado";
            totalDinero += 3000;

            bot.editMessageText(
`✅ PAGO APROBADO

👤 ${user}
🔢 ${num}
💰 +$3.000`, {
                chat_id: tableroChatId,
                message_id: anim.message_id
            });

            actualizarTablero();

            // 📢 REPOST TABLERO
            bot.sendMessage(tableroChatId,
`🎰 TABLERO ACTUALIZADO EN VIVO`, {
                reply_markup: {
                    inline_keyboard: generarTablero()
                }
            });

        }, 3500);

        bot.answerCallbackQuery(query.id, { text: "Procesando..." });
    }
});const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('Bot activo');
});

app.listen(process.env.PORT || 3000, () => {
    console.log('Servidor activo');
});