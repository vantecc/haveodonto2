const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode'); // Biblioteca para gerar o QR Code como imagem
const express = require('express'); // Biblioteca para criar o servidor web
const fs = require('fs'); // Para manipulação de arquivos

const app = express(); // Inicializa o servidor Express
const PORT = process.env.PORT || 3000;
const HOST = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`; // URL pública do Render ou localhost

const SESSION_PATH = './session'; // Diretório personalizado para a sessão

// Certifique-se de que o diretório da sessão existe e está limpo
if (fs.existsSync(SESSION_PATH)) {
    fs.rmSync(SESSION_PATH, { recursive: true, force: true }); // Remove o diretório se existir
}

// Inicializa o cliente do WhatsApp com o LocalAuth
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'default', // Identificador único para o cliente
        dataPath: SESSION_PATH, // Caminho para o diretório da sessão
    }),
});

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
        res.send(`
            <h1>QR Code ainda não gerado. Tentando novamente em 5 segundos...</h1>
            <script>
                setTimeout(() => {
                    window.location.reload();
                }, 5000); // Recarrega a página automaticamente após 5 segundos
            </script>
        `);
    }
});

// Inicializa o servidor Express
app.listen(PORT, () => {
    console.log(`Servidor rodando em ${HOST}`);
});

// Evento quando o bot estiver pronto
client.on('ready', async () => {
    console.log('Bot conectado com sucesso!');

    const chats = await client.getChats();
    for (let chat of chats) {
        if (chat.unreadCount > 0) {
            if (chat.id.server === 'g.us') {
                console.log(`Ignorando mensagens não lidas no grupo: ${chat.name}`);
                continue;
            }

            console.log(`Processando mensagens não lidas de ${chat.name || chat.id.user}`);

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
        message.reply('Serviços disponíveis: Limpeza, restauração, clareamento...');
    } else if (message.body === '3') {
        message.reply('Localização: Av. José dos Santos e Silva, 26. Teresina-PI.');
    } else {
        console.log(`Mensagem irrelevante de ${message.from}: ${message.body}`);
    }
}

client.on('message', processMessage);

// Inicializa o cliente do WhatsApp
client.initialize();
