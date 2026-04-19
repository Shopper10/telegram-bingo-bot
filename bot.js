const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });

// 📦 DATA
let numeros = {};
let tableroMessageId = null;
let tableroChatId = null;

// 👤 USER FORMAT
function getUser(user) {
    return user.username ? `@${user.username}` : user.first_name;
}

// 🎱 TABLERO
function generarTablero() {
    let keyboard = [];

    for (let i = 1; i <= 15; i++) {

        let texto = `🟢 ${i}`;

        const item = numeros[i];

        if (item) {

            const u = item.user;

            if (item.estado === "reservado") {
                texto = `🟡 ${i} ${u}`;
            }

            if (item.estado === "pendiente") {
                texto = `🟠 ${i} ${u} ⏳`;
            }

            if (item.estado === "pagado") {
                texto = `🔴 ${i} ${u} ✅`;
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

// 🎮 START
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎱 Bingo activo\nUsa /bingo para ver el tablero");
});

// 🎱 CREAR TABLERO (UNO SOLO)
bot.onText(/\/bingo/, async (msg) => {

    tableroChatId = msg.chat.id;

    const sent = await bot.sendMessage(msg.chat.id, "🎱 TABLERO BINGO EN VIVO:", {
        reply_markup: {
            inline_keyboard: generarTablero()
        }
    });

    tableroMessageId = sent.message_id;
});

// 🎯 CALLBACKS (TODO EN GRUPO)
bot.on('callback_query', (query) => {

    const data = query.data;
    const chatId = query.message.chat.id;

    const user = getUser(query.from);

    // 🎱 TOMAR NÚMERO
    if (data.startsWith("num_")) {

        const num = parseInt(data.split("_")[1]);

        if (numeros[num]) {
            bot.answerCallbackQuery(query.id, {
                text: "❌ No disponible"
            });
            return;
        }

        numeros[num] = {
            user: user,
            estado: "reservado"
        };

        bot.answerCallbackQuery(query.id, {
            text: `🟡 Reservado ${num}`
        });

        actualizarTablero();

        bot.sendMessage(chatId,
`🟡 ${user} reservaste el número ${num}

💰 Paga y envía comprobante en el grupo`
        );
    }

    // 💰 APROBAR / RECHAZAR (GRUPO)
    if (data.startsWith("ok_") || data.startsWith("no_")) {

        const num = parseInt(data.split("_")[1]);

        if (!numeros[num]) return;

        if (data.startsWith("ok_")) {

            numeros[num].estado = "pagado";

        } else {

            delete numeros[num];
        }

        actualizarTablero();

        bot.answerCallbackQuery(query.id, {
            text: "✔ actualizado"
        });
    }
});

// 📸 FOTO EN GRUPO → BOTONES EN EL MISMO GRUPO
bot.on('photo', (msg) => {

    const chatId = msg.chat.id;

    if (msg.chat.type === "private") return;

    const user = getUser(msg.from);

    const fileId = msg.photo[msg.photo.length - 1].file_id;

    let numero = null;

    for (let n in numeros) {
        if (numeros[n].user === user && numeros[n].estado === "reservado") {
            numero = n;
            break;
        }
    }

    if (!numero) {
        bot.sendMessage(chatId, `❌ ${user} no tiene número reservado`);
        return;
    }

    numeros[numero].estado = "pendiente";

    actualizarTablero();

    // 📩 MENSAJE EN EL GRUPO (BOTONES AQUÍ MISMO)
    bot.sendPhoto(chatId, fileId, {
        caption: `💰 COMPROBANTE\n👤 ${user}\n🎱 Número: ${numero}`,
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