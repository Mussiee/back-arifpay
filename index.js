const axios = require('axios');
const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS for Flutter app

// ArifPay headers
const ARIFPAY_HEADERS = {
    "Content-Type": "application/json",
    "x-arifpay-key": process.env.ARIFPAY_API_KEY,
};

// Payment methods supported
const PAYMENT_METHODS = ["TELEBIRR"];

// NEW ENDPOINT: Create gym subscription checkout
app.post('/api/create-subscription-checkout', async (req, res) => {
    try {
        const {
            userId,
            gymId,
            planId,
            gymName,
            planName,
            durationDays,
            amount,
            quantity,
            phone,
            email,
            userName
        } = req.body;

        // Validate required fields
        if (!userId || !gymId || !planId || !amount || !phone || !email) {
            return res.status(400).json({
                error: "Missing required fields"
            });
        }

        // Build subscription item for ArifPay
        const subscriptionItem = {
            name: `${gymName} - ${planName}`,
            quantity: quantity || 1,
            price: amount,
            description: `${planName} subscription for ${durationDays} days at ${gymName}`,
            image: 'https://via.placeholder.com/150', // You can add gym logo URL here
        };

        // Build payload for ArifPay
        const payload = {
            cancelUrl: `${process.env.ARIFPAY_CANCEL_URL}?userId=${userId}&subscriptionId=${planId}`,
            errorUrl: `${process.env.ARIFPAY_ERROR_URL}?userId=${userId}`,
            notifyUrl: `${process.env.ARIFPAY_NOTIFY_URL}`,
            successUrl: `${process.env.ARIFPAY_SUCCESS_URL}?userId=${userId}&gymId=${gymId}&planId=${planId}`,
            phone,
            email,
            nonce: `${userId}_${planId}_${Date.now()}`, // Unique identifier
            paymentMethods: PAYMENT_METHODS,
            expireDate: new Date(Date.now() + 30 * 60000).toISOString(), // 30 minutes
            items: [subscriptionItem],
            beneficiaries: [
                {
                    accountNumber: process.env.ARIFPAY_ACCOUNT,
                    bank: process.env.ARIFPAY_BANK,
                    amount: amount,
                },
            ],
            lang: "EN",
        };

        // Call ArifPay API
        const response = await axios.post(
            process.env.ARIFPAY_ENDPOINT,
            payload,
            { headers: ARIFPAY_HEADERS }
        );
        console.log('ArifPay Response:', JSON.stringify(response.data, null, 2));

        // Extract session ID and checkout URL from different possible response structures

        res.status(200).json({
            success: true,
            sessionId: response.data.data?.sessionId,
            paymentUrl: response.data.data?.paymentUrl,
            cancelUrl: response.data.data?.cancelUrl,
            message: "Checkout session created successfully"
        });

    } catch (err) {
        console.error("ArifPay subscription error:", err.response?.data || err.message);
        res.status(500).json({
            error: "Failed to create subscription checkout",
            details: err.response?.data || err.message,
        });
    }
});



// Payment status check endpoint (optional)
app.post('/api/payment/status', async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: "sessionId is required" });
        }

        // Fetch session status from ArifPay
        const response = await axios.get(
            `https://gateway.arifpay.org/api/checkout/session/${sessionId}`,
            { headers: ARIFPAY_HEADERS }
        );
        console.log('Session data:', response.data);
        res.status(200).json(response.data);
    } catch (err) {
        console.error("Status check error:", err.response?.data || err.message);
        res.status(500).json({
            error: "Failed to check payment status",
            details: err.response?.data || err.message,
        });
    }

});

// Test routes for callbacks
app.get('/payment/success', (req, res) => {
    const { userId, gymId, planId } = req.query;
    res.send(`<h1>✅ Payment Successful!</h1>
    <p>Thank you for subscribing!</p>
    <p>User: ${userId}</p>
    <p>Gym: ${gymId}</p>
    <p>Plan: ${planId}</p>`);
});


app.get('/payment/cancel', (req, res) => {
    res.send('<h1>Payment Cancelled</h1><p>You cancelled the payment.</p>');
});

app.get('/payment/error', (req, res) => {
    res.send('<h1>Payment Error</h1><p>Something went wrong with the payment.</p>');
});

app.post('/payment/notify', (req, res) => {
    console.log('Payment notification received:', req.body);
    // Here you would update your database with payment status
    res.status(200).json({ received: true });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Backend running on http://localhost:${PORT}`);
});
