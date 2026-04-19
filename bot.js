function generarTablero() {
    let keyboard = [];

    for (let i = 1; i <= 15; i++) {

        let texto = `🟢 ${i}`;

        if (numeros[i]) {
            let user = numeros[i].user;

            if (numeros[i].estado === "reservado") {
                texto = `🟡 ${i} ${user}`;
            }

            if (numeros[i].estado === "pagado") {
                texto = `🔴 ${i} ${user}`;
            }
        }

        keyboard.push([{
            text: texto,
            callback_data: `num_${i}`
        }]);
    }

    return keyboard;
}