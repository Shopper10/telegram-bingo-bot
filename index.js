const { Telegraf, Markup } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);

const ADMIN_ID = Number(process.env.ADMIN_ID);

const TOTAL = 15;
const TIME = 600;

let data = {};
let board = null;

/* 🚀 INIT */
for (let i = 1; i <= TOTAL; i++) {
  data[i] = {
    state: 'free',
    user: null,
    time: 0
  };
}

/* ⏱ FORMAT */
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* 🎯 TABLERO */
function keyboard() {
  let rows = [];

  for (let i = 1; i <= TOTAL; i++) {
    let n = data[i];

    let text = '';

    if (n.state === 'free') {
      text = `🟢 ${i} - DISPONIBLE`;
    }

    if (n.state === 'reserved') {
      text = `⛔ ${i} - @${n.user} ⏱ ${formatTime(n.time)}`;
    }

    if (n.state === 'paid') {
      text = `✅ ${i} - @${n.user} PAGADO`;
    }

    rows.push([
      Markup.button.callback(text, `pick_${i}`)
    ]);
  }

  return Markup.inlineKeyboard(rows);
}

/* 🚀 START */
bot.command('start', async (ctx) => {
  const msg = await ctx.reply(
    '🎱 BINGO RECKER PRO 15 NÚMEROS',
    keyboard()
  );

  board = {
    chatId: ctx.chat.id,
    messageId: msg.message_id
  };
});

/* 🎯 TOMAR NÚMERO */
bot.action(/pick_(\d+)/, async (ctx) => {
  const num = ctx.match[1];

  if (data[num].state !== 'free') {
    return ctx.answerCbQuery('❌ No disponible');
  }

  const user = ctx.from.username || ctx.from.first_name;

  data[num] = {
    state: 'reserved',
    user,
    time: TIME
  };

  ctx.reply(
`📩 PAGO REQUERIDO
ENVIAR CAPTURE PAGO AL GRUPO

⏱ 10 minutos o vuelve a disponible

💳 Nequi: 3123902322`
  );

  await updateBoard();
  ctx.answerCbQuery('✔ tomado');
});

/* 📸 FOTO COMPROBANTE (MULTI NUMEROS) */
bot.on('photo', async (ctx) => {
  const user = ctx.from.username || ctx.from.first_name;

  let nums = [];

  for (let i = 1; i <= TOTAL; i++) {
    if (data[i].user === user && data[i].state === 'reserved') {
      nums.push(i);
    }
  }

  if (nums.length === 0) return;

  await ctx.reply(
`📩 Pago recibido de @${user}

🎟 Números: ${nums.join(', ')}

⚠️ Esperando admin`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ APROBAR TODO', `ok_all_${user}`),
        Markup.button.callback('❌ RECHAZAR TODO', `no_all_${user}`)
      ]
    ])
  );
});

/* 👑 APROBAR TODO */
bot.action(/ok_all_(.+)/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.answerCbQuery('⛔ Solo admin');
  }

  const user = ctx.match[1];

  let nums = [];

  for (let i = 1; i <= TOTAL; i++) {
    if (data[i].user === user && data[i].state === 'reserved') {
      data[i].state = 'paid';
      nums.push(i);
    }
  }

  let msg = await ctx.reply('💚 Procesando pagos...');

  for (let i = 0; i <= 10; i++) {
    const bar = '🟩'.repeat(i) + '⬜️'.repeat(10 - i);

    await ctx.telegram.editMessageText(
      msg.chat.id,
      msg.message_id,
      null,
      `💚 Aprobando pagos...\n${bar}`
    );

    await new Promise(r => setTimeout(r, 200));
  }

  await ctx.telegram.editMessageText(
    msg.chat.id,
    msg.message_id,
    null,
    `💚 PAGOS APROBADOS ✅\n🎟 ${nums.join(', ')}`
  );

  const newMsg = await ctx.telegram.sendMessage(
    board.chatId,
    '🎱 TABLERO ACTUALIZADO 👇',
    keyboard()
  );

  board.messageId = newMsg.message_id;
});

/* ❌ RECHAZAR TODO */
bot.action(/no_all_(.+)/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.answerCbQuery('⛔ Solo admin');
  }

  const user = ctx.match[1];

  let nums = [];

  for (let i = 1; i <= TOTAL; i++) {
    if (data[i].user === user && data[i].state === 'reserved') {
      data[i] = {
        state: 'free',
        user: null,
        time: 0
      };
      nums.push(i);
    }
  }

  await ctx.reply(`❌ Rechazados: ${nums.join(', ')}`);
  await updateBoard();
});

/* 🔄 UPDATE TABLERO */
async function updateBoard() {
  if (!board) return;

  try {
    await bot.telegram.editMessageReplyMarkup(
      board.chatId,
      board.messageId,
      null,
      keyboard().reply_markup
    );
  } catch {}
}

/* ⏱ TIMER + AVISO EXPIRACIÓN */
setInterval(() => {
  let changed = false;

  for (let i = 1; i <= TOTAL; i++) {
    let n = data[i];

    if (n.state === 'reserved') {
      n.time--;

      if (n.time <= 0) {
        const user = n.user;

        data[i] = {
          state: 'free',
          user: null,
          time: 0
        };

        bot.telegram.sendMessage(
          board.chatId,
          `⏰ Número ${i} quedó DISPONIBLE nuevamente`
        );

        changed = true;
      }
    }
  }

  if (changed) updateBoard();

}, 1000);

/* 🔁 RESET TOTAL */
bot.command('reset', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.reply('⛔ Solo admin');
  }

  for (let i = 1; i <= TOTAL; i++) {
    data[i] = {
      state: 'free',
      user: null,
      time: 0
    };
  }

  const msg = await ctx.reply('🔄 Juego reiniciado');

  const newMsg = await ctx.telegram.sendMessage(
    board.chatId,
    '🎱 NUEVO JUEGO INICIADO 👇',
    keyboard()
  );

  board.messageId = newMsg.message_id;
});

/* 🔄 REFRESH MANUAL */
bot.command('refresh', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  await updateBoard();
  ctx.reply('🔄 Tablero actualizado');
});

bot.launch();

console.log('🎱 BINGO FINAL PRODUCCIÓN ONLINE');