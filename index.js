const { Telegraf, Markup } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);

const ADMIN_ID = Number(process.env.ADMIN_ID);

const TOTAL = 15;
const TIME = 10 * 60;

let data = {};
let boardMsg = null;

// INIT
for (let i = 1; i <= TOTAL; i++) {
  data[i] = {
    state: 'free',
    userId: null,
    user: null,
    time: 0
  };
}

# 🎯 BOTONES (TABLERO REAL)
function boardButtons() {
  let rows = [];

  for (let i = 1; i <= TOTAL; i += 3) {
    let row = [];

    for (let j = i; j < i + 3 && j <= TOTAL; j++) {
      let n = data[j];

      let label = '';

      if (n.state === 'free') {
        label = `🟢 ${j}`;
      }

      if (n.state === 'reserved') {
        let m = Math.floor(n.time / 60);
        let s = n.time % 60;
        label = `⛔ ${j} ${n.user} ${m}:${s.toString().padStart(2,'0')}`;
      }

      if (n.state === 'paid') {
        label = `✅ ${j} ${n.user}`;
      }

      row.push(
        Markup.button.callback(
          label,
          `pick_${j}`,
          n.state !== 'free' // 🔒 bloqueado si no está libre
        )
      );
    }

    rows.push(row);
  }

  return Markup.inlineKeyboard(rows);
}

# 🚀 START
bot.command('start', async (ctx) => {
  const msg = await ctx.reply(
    '🎰 CASINO BINGO PRO',
    boardButtons()
  );

  boardMsg = msg.message_id;
});

# 🎯 CLICK EN NÚMERO
bot.action(/pick_(\d+)/, async (ctx) => {
  const num = ctx.match[1];
  const userId = ctx.from.id;

  if (data[num].state !== 'free') {
    return ctx.answerCbQuery('❌ No disponible');
  }

  let user = '@' + (ctx.from.username || ctx.from.first_name);

  data[num] = {
    state: 'reserved',
    userId,
    user,
    time: TIME
  };

  ctx.reply(`📩 ${user}, envía comprobante a Nequi`);

  startTimer(ctx, num);
  await updateBoard(ctx);

  ctx.answerCbQuery('✔ Reservado');
});

# ⏱ TIMER
function startTimer(ctx, num) {
  setInterval(async () => {

    if (data[num].state !== 'reserved') return;

    data[num].time--;

    if (data[num].time <= 0) {

      let user = data[num].user;

      data[num] = {
        state: 'free',
        userId: null,
        user: null,
        time: 0
      };

      ctx.telegram.sendMessage(
        ctx.chat.id,
        `⏰ ${user} no pagó. Número ${num} libre`
      );
    }

    await updateBoard(ctx);

  }, 1000);
}

# 🔄 UPDATE BOTONES
async function updateBoard(ctx) {
  if (!boardMsg) return;

  try {
    await ctx.telegram.editMessageReplyMarkup(
      ctx.chat.id,
      boardMsg,
      null,
      boardButtons().reply_markup
    );
  } catch {}
}

bot.launch();

console.log("🎰 Casino PRO activo");