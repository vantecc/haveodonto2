const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode'); // Biblioteca para gerar QR Code como imagem
const express = require('express'); // Biblioteca para criar o servidor web

const client = new Client({
    authStrategy: new LocalAuth(),
});

const app = express(); // Inicializa o servidor Express
const PORT = process.env.PORT || 3000; // Define a porta do servidor

let qrCodeImageURL = ''; // Variável para armazenar o QR Code como imagem

// Evento para lidar com o QR Code
client.on('qr', async (qr) => {
    console.log('QR Code gerado. Acesse o navegador para escanear.');

    // Gera o QR Code como uma URL de imagem
    qrCodeImageURL = await qrcode.toDataURL(qr);
});

// Rota para exibir o QR Code no navegador
app.get('/', (req, res) => {
    if (qrCodeImageURL) {
        res.send(`
            <h1>Escaneie o QR Code abaixo:</h1>
            <img src="${qrCodeImageURL}" alt="QR Code">
        `);
    } else {
        res.send('<h1>QR Code ainda não gerado. Tente novamente em alguns segundos.</h1>');
    }
});

// Inicializa o servidor Express
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});

client.on('ready', async () => {
    console.log('Bot conectado com sucesso!');

    const chats = await client.getChats();
    for (let chat of chats) {
        if (chat.unreadCount > 0) {
            if (chat.id.server === 'g.us') {
                console.log(`Ignorando mensagens nao lidas no grupo: ${chat.name}`);
                continue;
            }

            console.log(`Processando mensagens nao lidas de ${chat.name || chat.id.user}`);

            const messages = await chat.fetchMessages({ limit: chat.unreadCount });
            for (let message of messages) {
                if (!message.fromMe) {
                    processMessage(message);
                }
            }
        }
    }
});

const chatStates = {};

async function processMessage(message) {
    const chat = await message.getChat();

    if (chat.id.server === 'g.us') {
        console.log(`Mensagem ignorada no grupo: ${chat.name}`);
        return;
    }

    const userId = message.from; 
    const now = Date.now();

    if (!chatStates[userId]) {
        chatStates[userId] = {
            welcomed: false,
            lastInteraction: 0,
        };
    }

    const userState = chatStates[userId];
    const fiveMinutesPassed = now - userState.lastInteraction > 300000; 

    if (!userState.welcomed || fiveMinutesPassed) {
        message.reply(
            `Bem-vindo(a) à Have Odonto! Escolha uma das opções abaixo:
1. Horários de Funcionamento
2. Serviços Disponíveis
3. Localização e Contato`
        );
        userState.welcomed = true; 
        userState.lastInteraction = now;
        return;
    }

    userState.lastInteraction = now;

    if (message.body === '1') {
        message.reply('Horários de funcionamento: Segunda a sexta, das 8h às 18h.');
    } else if (message.body === '2') {
        message.reply('Serviços disponíveis: Limpeza, restauração, clareamento..');
    } else if (message.body === '3') {
        message.reply('Localização: Av. José dos Santos e Silva, 26. Teresina-PI.');
    } else {
        console.log(`Mensagem irrelevante de ${message.from}: ${message.body}`);
    }
}

client.on('message', processMessage);

client.initialize();
