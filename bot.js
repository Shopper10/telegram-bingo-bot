const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });

// ⚙️ CONFIG
const ADMIN_ID = 1448948861; // 👈 CAMBIAR
const NEQUI_NUMERO = "3123902322";
const NEQUI_NOMBRE = "Carlos";

// 📦 DATA
let numeros = {};
let tableroMessageId = null;
let tableroChatId = null;

// 👤 USER
function getUser(user) {
    return user.username ? `@${user.username}` : user.first_name;
}

// 🎱 TABLERO
function generarTablero() {
    let keyboard = [];

    for (let i = 1; i <= 15; i++) {

        let texto = `🟢 ${i}`;

        if (numeros[i]) {
            let u = numeros[i].user;

            if (numeros[i].estado === "reservado") {
                texto = `🟡 ${i} ${u}`;
            }

            if (numeros[i].estado === "pagado") {
                texto = `🔴 ${i} ${u}`;
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
    bot.sendMessage(msg.chat.id, "🎱 Bingo activo\nUsa /bingo para ver tablero");
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

// 🎯 CALLBACKS
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

💰 Paga a Nequi:
📱 ${NEQUI_NUMERO}
👤 ${NEQUI_NOMBRE}

📸 Envía la captura en el grupo`
        );
    }

    // 💰 APROBAR / RECHAZAR
    if (data.startsWith("ok_") || data.startsWith("no_")) {

        const num = parseInt(data.split("_")[1]);

        if (!numeros[num]) return;

        if (data.startsWith("ok_")) {

            numeros[num].estado = "pagado";

            bot.sendMessage(ADMIN_ID,
                `🔴 Número ${num} APROBADO`
            );

        } else {

            delete numeros[num];

            bot.sendMessage(ADMIN_ID,
                `❌ Número ${num} RECHAZADO`
            );
        }

        actualizarTablero();
        bot.answerCallbackQuery(query.id);
    }
});

// 📸 FOTO EN GRUPO → ADMIN
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

    // 📩 ENVIAR AL ADMIN CON BOTONES
    bot.sendPhoto(ADMIN_ID, fileId, {
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

    bot.sendMessage(chatId, "⏳ Enviado al admin para revisión...");
});