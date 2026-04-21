const { Telegraf, Markup } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);

const TOTAL = 15;
const TIME = 10 * 60;

let data = {};

// INIT
for (let i = 1; i <= TOTAL; i++) {
  data[i] = { state: 'free', user: null, time: 0 };
}

# 🎰 BOTONES (ESTO ES CLAVE)
function keyboard() {
  let rows = [];

  for (let i = 1; i <= TOTAL; i += 3) {
    let row = [];

    for (let j = i; j < i + 3 && j <= TOTAL; j++) {

      let n = data[j];

      let text =
        n.state === 'free'
          ? `🟢 ${j}`
          : n.state === 'reserved'
          ? `⛔ ${j}`
          : `✅ ${j}`;

      row.push(Markup.button.callback(text, `pick_${j}`));
    }

    rows.push(row);
  }

  return Markup.inlineKeyboard(rows);
}

# 🚀 START (AQUÍ ESTABA TU ERROR)
bot.command('start', async (ctx) => {

  await ctx.reply(
    '🎰 CASINO BINGO PRO\n👇 Selecciona un número',
    {
      reply_markup: keyboard().reply_markup
    }
  );
});

# 🎯 CLICK
bot.action(/pick_(\d+)/, async (ctx) => {
  const num = ctx.match[1];

  if (data[num].state !== 'free') {
    return ctx.answerCbQuery('❌ Ocupado');
  }

  data[num] = {
    state: 'reserved',
    user: '@' + (ctx.from.username || ctx.from.first_name),
    time: TIME
  };

  await ctx.answerCbQuery('✔ OK');
});

bot.launch();

console.log("BOT OK");