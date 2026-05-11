const crypto = require('crypto');
const fs = require('fs');

function generateSignatureB2B(clientId, timestamp, privateKeyPath) {
    const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    const dataToSign = clientId + "|" + timestamp;
    const sign = crypto.createSign('SHA256');
    sign.update(dataToSign);
    return sign.sign(privateKey, 'base64');
}

module.exports = { generateSignatureB2B };
