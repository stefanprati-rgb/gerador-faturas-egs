const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
    // Força o Puppeteer a baixar o Chrome na pasta local do projeto
    // Isso garante que a função consiga encontrar o executável
    cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
