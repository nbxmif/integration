require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { generateSignatureB2B } = require('./signature');

const app = express();
app.use(express.json());
app.use(cors()); // Sangat penting agar index.html bisa akses server

const BASE_URL = 'https://api.snap.uat.airpay.co.id';

// Fungsi HMAC untuk Signature Step 2
function generateServiceSignature(method, url, accessToken, body, timestamp, clientSecret) {
    const hashedBody = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex').toLowerCase();
    const stringToSign = `${method.toUpperCase()}:${url}:${accessToken}:${hashedBody}:${timestamp}`;
    return crypto.createHmac('sha512', clientSecret).update(stringToSign).digest('base64');
}

// ENDPOINT HARUS /api/topup AGAR COCOK DENGAN index.html KAMU
app.post('/api/topup', async (req, res) => {
    try {
        const { customerNumber, amount, notes, merchantDisplayName } = req.body;
        const timestamp = new Date().toISOString();

        // 1. Get Token (RSA)
        const b2bSignature = generateSignatureB2B(process.env.CLIENT_ID, timestamp, process.env.PRIVATE_KEY_PATH);
        const tokenRes = await axios.post(`${BASE_URL}/v1.0/access-token/b2b`, 
            { grantType: "client_credentials" }, 
            { headers: { 'X-CLIENT-KEY': process.env.CLIENT_ID, 'X-TIMESTAMP': timestamp, 'X-SIGNATURE': b2bSignature, 'Content-Type': 'application/json' } }
        );

        const accessToken = tokenRes.data.accessToken;

        // 2. Execute Topup (HMAC)
        const path = '/merchant_wallet/v1.0/emoney/topup';
        const payload = {
            partnerReferenceNo: "REF-" + Date.now(),
            customerNumber: customerNumber,
            amount: { value: parseFloat(amount).toFixed(2), currency: "IDR" },
            notes: notes || "Topup",
            additionalInfo: {
                merchantExtId: process.env.MERCHANT_EXT_ID,
                storeExtId: process.env.STORE_EXT_ID,
                merchantDisplayName: merchantDisplayName || "ShopeePay"
            }
        };

        const serviceSignature = generateServiceSignature('POST', path, accessToken, payload, timestamp, process.env.CLIENT_SECRET);

        const topupRes = await axios.post(`${BASE_URL}${path}`, payload, {
            headers: {
                'X-PARTNER-ID': process.env.CLIENT_ID,
                'X-TIMESTAMP': timestamp,
                'X-SIGNATURE': serviceSignature,
                'CHANNEL-ID': process.env.CHANNEL_ID,
                'X-EXTERNAL-ID': uuidv4(),
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });

        res.json(topupRes.data);

    } catch (error) {
        console.error("Error Detail:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
    }
});

app.listen(3000, () => {
    console.log('✅ Server Aktif di http://localhost:3000');
    console.log('🚀 Siap menerima request dari index.html');
});