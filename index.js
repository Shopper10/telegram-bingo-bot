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

/* ⏱ FORMAT TIME */
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
`📩 REALIZA EL PAGO

⏱ 10 minutos o vuelve a libre

💳 Nequi: 3123902322`
  );

  await updateBoard();
  ctx.answerCbQuery('✔ tomado');
});

/* 📸 FOTO COMPROBANTE (MULTI NÚMEROS) */
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
    `📩 Pago recibido de @${user}\n\nNúmeros: ${nums.join(', ')}`,
    Markup.inlineKeyboard(
      nums.map(n => ([
        Markup.button.callback(`✅ Aprobar ${n}`, `ok_${n}`),
        Markup.button.callback(`❌ Rechazar ${n}`, `no_${n}`)
      ])).flat()
    )
  );
});

/* 👑 APROBAR (SOLO ADMIN) */
bot.action(/ok_(\d+)/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.answerCbQuery('⛔ Solo admin puede aprobar');
  }

  const num = ctx.match[1];

  data[num].state = 'paid';

  let msg = await ctx.reply('💚 Procesando pago...');

  /* 🔥 BARRA ANIMADA */
  for (let i = 0; i <= 10; i++) {
    const bar = '🟩'.repeat(i) + '⬜️'.repeat(10 - i);

    await ctx.telegram.editMessageText(
      msg.chat.id,
      msg.message_id,
      null,
      `💚 Aprobando pago...\n${bar}`
    );

    await new Promise(r => setTimeout(r, 200));
  }

  /* 💚 FINAL */
  await ctx.telegram.editMessageText(
    msg.chat.id,
    msg.message_id,
    null,
    `💚 PAGO APROBADO ✅`
  );

  /* 🔁 NUEVO TABLERO */
  const newMsg = await ctx.telegram.sendMessage(
    board.chatId,
    '🎱 TABLERO ACTUALIZADO 👇',
    keyboard()
  );

  board.messageId = newMsg.message_id;
});

/* ❌ RECHAZAR (SOLO ADMIN) */
bot.action(/no_(\d+)/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.answerCbQuery('⛔ Solo admin puede rechazar');
  }

  const num = ctx.match[1];

  data[num] = {
    state: 'free',
    user: null,
    time: 0
  };

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

/* ⏱ CRONÓMETRO GLOBAL */
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
          `⏰ @${user} no pagó. Número ${i} liberado`
        );

        changed = true;
      }
    }
  }

  if (changed) updateBoard();

}, 1000);

bot.launch();

console.log('🎱 BINGO RAILWAY PRO FINAL ONLINE');